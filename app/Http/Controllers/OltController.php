<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\OltDevice;
use App\Models\OntRegistration;
use App\Models\NetworkNode;
use App\Models\AuditLog;
use App\Services\Olt\ZteC300Driver;
use App\Services\Olt\ZteC320Driver;
use App\Services\Olt\HuaweiDriver;
use App\Services\Olt\VsolDriver;
use App\Services\Olt\HiosoDriver;
use App\Services\Olt\HsgqDriver;
use App\Services\Olt\TarmocDriver;
use Illuminate\Support\Facades\DB;

class OltController extends Controller
{
    public function getDriver(string $vendor, ?int $deviceId = null)
    {
        $device = $deviceId ? OltDevice::find($deviceId) : null;
        $isLive = $device ? ($device->connection_mode === 'live') : false;
        $ip = $device ? $device->ip_address : '10.10.10.1';
        $port = $device ? ($device->snmp_port ?? 161) : 161;
        $community = $device ? $device->getEffectiveCommunity() : 'public';
        $snmpVersion = $device ? ($device->snmp_version ?? 'v2c') : 'v2c';

        $v = strtolower($vendor);
        if (str_contains($v, 'huawei')) {
            return new HuaweiDriver(
                ip: $ip,
                community: $community,
                snmpVersion: $snmpVersion,
                isLive: $isLive
            );
        }

        if (str_contains($v, 'vsol')) {
            return new VsolDriver(
                ip: $ip,
                community: $community,
                snmpVersion: $snmpVersion,
                isLive: $isLive
            );
        }

        switch ($v) {
            case 'zte-c320':
                return new ZteC320Driver();
            case 'hioso':
                return new HiosoDriver();
            case 'hsgq':
                return new HsgqDriver(
                    ip: $ip,
                    community: $community,
                    snmpVersion: $snmpVersion,
                    isLive: $isLive,
                    port: $port
                );
            case 'tarmoc':
                return new TarmocDriver();
            case 'zte-c300':
            default:
                return new ZteC300Driver(
                    ip: $ip,
                    community: $community,
                    snmpVersion: $snmpVersion,
                    isLive: $isLive
                );
        }
    }

    public function index(Request $request)
    {
        $vendor   = $request->input('vendor') ?: $request->query('vendor', 'zte-c300');
        $deviceId = $request->input('device_id') ?: ($request->query('device_id') ?: null);
        $isFresh  = $request->boolean('fresh') || $request->boolean('force');

        $device = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::first();

        // 1. Jika data snapshot database sudah ada dan tidak dipaksa refresh, sajikan INSTAN dari database (< 5ms)
        if (!$isFresh && $device && !empty($device->last_telemetry_snapshot)) {
            $snapshot = $device->last_telemetry_snapshot;
            if (!isset($snapshot['orphaned_onus'])) {
                $snapshot['orphaned_onus'] = $this->computeOrphanedOnus($device, $snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
            }
            return response()->json($snapshot);
        }

        // 2. Jika dipaksa refresh atau snapshot belum ada, ambil live via Driver dan simpan ke Database
        $driver = $this->getDriver($vendor, $device?->id);

        $driverDeviceInfo = $driver->getDeviceInfo();
        $driverPonPorts   = $driver->getPonPorts();
        $driverOnuList    = $driver->getOnuList();
        $driverUncfg      = $driver->getUnconfiguredOnus();
        $driverOrphaned   = $this->computeOrphanedOnus($device, $driverOnuList, $driverUncfg);

        $snapshot = [
            'device_info'       => $driverDeviceInfo,
            'pon_ports'         => $driverPonPorts,
            'onu_list'          => $driverOnuList,
            'unconfigured_onus' => $driverUncfg,
            'orphaned_onus'     => $driverOrphaned,
            'polled_at'         => now()->toIso8601String(),
        ];

        if ($device) {
            $device->update([
                'last_telemetry_snapshot' => $snapshot,
                'last_connected_at'       => now(),
            ]);
        }

        return response()->json($snapshot);
    }

    private function buildRealCards(OltDevice $device): array
    {
        $totalPorts = $device->total_ports ?: 16;
        $slots = max(1, (int)ceil($totalPorts / 16));
        $cards = [];

        for ($s = 1; $s <= $slots; $s++) {
            $cards[] = [
                'slot'   => $s,
                'type'   => 'GTGH',
                'ports'  => min(16, $totalPorts - (($s - 1) * 16)),
                'status' => 'Online',
            ];
        }

        return $cards;
    }

    private function buildRealPonPorts(OltDevice $device): array
    {
        $totalPorts = $device->total_ports ?: 16;
        $ports = [];

        for ($i = 1; $i <= $totalPorts; $i++) {
            $slot = ceil($i / 16);
            $portInSlot = (($i - 1) % 16) + 1;
            $portId = "gpon-olt_1/{$slot}/{$portInSlot}";

            // Hitung ONU terdaftar riil di database untuk port ini
            $registered = OntRegistration::whereHas('customerService.networkPort.node', function ($q) use ($device, $slot, $portInSlot) {
                $q->where('olt_device_id', $device->id)
                  ->where(function ($sq) use ($slot, $portInSlot) {
                      $sq->where('olt_port_ref', 'ilike', "%1/{$slot}/{$portInSlot}%");
                  });
            })->count();

            $online = OntRegistration::whereHas('customerService.networkPort.node', function ($q) use ($device, $slot, $portInSlot) {
                $q->where('olt_device_id', $device->id)
                  ->where(function ($sq) use ($slot, $portInSlot) {
                      $sq->where('olt_port_ref', 'ilike', "%1/{$slot}/{$portInSlot}%");
                  });
            })->where('status', 'active')->count();

            $ports[] = [
                '_source'         => 'database',
                'port_id'         => $portId,
                'slot'            => (int)$slot,
                'port'            => (int)$portInSlot,
                'status'          => 'Up',
                'tx_power_dbm'    => 4.5,
                'registered_onus' => $registered,
                'online_onus'     => $online,
                'los_onus'        => max(0, $registered - $online),
            ];
        }

        return $ports;
    }

    private function buildRealOnuList(OltDevice $device): array
    {
        $onus = OntRegistration::with(['customerService.customer', 'oltPort.node'])
            ->whereHas('customerService.networkPort.node', function ($q) use ($device) {
                $q->where('olt_device_id', $device->id);
            })
            ->get();

        if ($onus->isEmpty()) {
            return [];
        }

        return $onus->map(function ($reg) {
            $customerName = $reg->customerService?->customer?->name ?: ('Pelanggan ONT #' . $reg->id);
            $nodePort = $reg->oltPort?->node?->olt_port_ref ?: 'gpon-olt_1/1/1';
            $portClean = str_replace('gpon_olt_', 'gpon-olt_', $nodePort);

            return [
                '_source'         => 'database',
                'onu_id'          => $reg->onu_serial,
                'port'            => explode(',', $portClean)[0] ?? 'gpon-olt_1/1/1',
                'customer_name'   => $customerName,
                'serial_number'   => $reg->onu_serial,
                'status'          => $reg->status === 'active' ? 'Online' : 'LOS (Dying Gasp)',
                'rx_power'        => (float)($reg->rx_power ?? -19.50),
                'tx_power'        => (float)($reg->tx_power ?? 2.10),
                'distance_meters' => 850,
                'ip_address'      => $reg->customerService?->ip_address ?: '—',
            ];
        })->toArray();
    }

    private function buildRealUnconfiguredOnus(OltDevice $device): array
    {
        $pending = OntRegistration::where('status', 'pending')->get();

        if ($pending->isEmpty()) {
            return [];
        }

        return $pending->map(function ($reg) {
            return [
                '_source'       => 'database',
                'serial_number' => $reg->onu_serial,
                'vendor_model'  => $reg->onu_type ?: 'Generic ONU',
                'detected_port' => 'gpon-olt_1/1/1',
                'detected_at'   => $reg->created_at?->diffForHumans() ?: 'Baru saja',
            ];
        })->toArray();
    }

    public function authorizeOnu(Request $request)
    {
        $request->validate([
            'serial_number' => 'required|string',
            'vendor'        => 'nullable|string',
            'profile_id'    => 'nullable|string',
            'device_id'     => 'nullable|integer',
        ]);

        $vendor   = $request->input('vendor', 'zte-c300');
        $deviceId = $request->input('device_id') ? (int)$request->input('device_id') : null;
        $driver   = $this->getDriver($vendor, $deviceId);

        $success = $driver->authorizeOnu($request->serial_number, $request->profile_id ?? 'PROFILE-DEFAULT');

        AuditLog::record(
            'PROVISIONING',
            'OLT & Telemetry Engine',
            "Mengotorisasi ONU {$request->serial_number} pada OLT ({$vendor}) dengan Profil: " . ($request->profile_id ?? 'PROFILE-DEFAULT'),
            null,
            ['serial_number' => $request->serial_number, 'vendor' => $vendor, 'profile_id' => $request->profile_id ?? 'PROFILE-DEFAULT']
        );

        return response()->json([
            'message' => "ONU {$request->serial_number} berhasil diregistrasi & dikonfigurasi pada OLT.",
            'success' => $success
        ]);
    }

    public function opticalPower(Request $request, string $serialNumber)
    {
        $vendor   = $request->query('vendor', 'zte-c300');
        $deviceId = $request->query('device_id') ? (int)$request->query('device_id') : null;
        $driver   = $this->getDriver($vendor, $deviceId);

        return response()->json($driver->getOnuOpticalPower($serialNumber));
    }

    /**
     * Hitung daftar ONU di database UNMS yang sudah tidak ditemukan lagi pada OLT fisik
     */
    public function computeOrphanedOnus(?OltDevice $device, array $activeOnuList = [], array $activeUncfg = []): array
    {
        // Kumpulkan semua serial number & MAC yang AKTIF atau terdeteksi di OLT
        $activeSerials = collect($activeOnuList)
            ->pluck('serial_number')
            ->merge(collect($activeUncfg)->pluck('serial_number'))
            ->merge(collect($activeUncfg)->pluck('mac_address'))
            ->filter()
            ->map(fn($s) => strtoupper(trim((string)$s)))
            ->unique()
            ->values();

        // Ambil data registrasi ONT di database UNMS
        $query = OntRegistration::with([
            'customerService.customer',
            'customerService.networkPort.node',
            'oltPort.node'
        ]);

        if ($device) {
            $query->whereHas('customerService.networkPort.node', function ($q) use ($device) {
                $q->where('olt_device_id', $device->id);
            });
        }

        $dbOnts = $query->get();
        $orphaned = [];

        foreach ($dbOnts as $reg) {
            $sn  = strtoupper(trim((string)$reg->onu_serial));
            $mac = strtoupper(trim((string)$reg->onu_mac));

            // Jika SN atau MAC tidak ditemukan di OLT fisik sama sekali
            $isFoundOnOlt = false;
            if (!empty($sn) && $activeSerials->contains($sn)) {
                $isFoundOnOlt = true;
            }
            if (!empty($mac) && $activeSerials->contains($mac)) {
                $isFoundOnOlt = true;
            }

            if (!$isFoundOnOlt) {
                $customerName = $reg->customerService?->customer?->name ?: ('Pelanggan #' . $reg->id);
                $customerCode = $reg->customerService?->customer?->customer_number ?: ('CUST-' . $reg->id);
                $customerId   = $reg->customerService?->customer?->id;
                $serviceId    = $reg->customerService?->id;
                $node         = $reg->customerService?->networkPort?->node ?: $reg->oltPort?->node;
                $portNumber   = $reg->customerService?->networkPort?->port_number;
                $oltName      = $device?->name ?: ($node?->oltDevice?->name ?: 'OLT Utama');
                $oltPortRef   = $node?->olt_port_ref ?: 'epon_0/1';

                $orphaned[] = [
                    'id'                  => $reg->id,
                    'customer_id'         => $customerId,
                    'customer_name'       => $customerName,
                    'customer_number'     => $customerCode,
                    'service_id'          => $serviceId,
                    'onu_serial'          => $reg->onu_serial,
                    'onu_mac'             => $reg->onu_mac,
                    'onu_type'            => $reg->onu_type ?: 'HGU EPON/GPON',
                    'odp_name'            => $node?->name ?: 'ODP Tidak Diketahui',
                    'odp_port'            => $portNumber ? "Port {$portNumber}" : '—',
                    'olt_name'            => $oltName,
                    'olt_port'            => $oltPortRef,
                    'registered_at'       => $reg->registered_at?->format('d M Y H:i') ?: ($reg->created_at?->format('d M Y H:i') ?: '—'),
                    'last_online_at'      => $reg->last_online_at?->format('d M Y H:i') ?: 'Tidak Pernah Online',
                    'unms_status'         => $reg->status ?: 'inactive',
                    'orphan_reason'       => 'Tidak Ditemukan di OLT (Telah Dihapus dari Perangkat OLT / Putus Berlangganan)',
                ];
            }
        }

        return $orphaned;
    }

    public function getOrphanedOnus(Request $request)
    {
        $deviceId = $request->query('device_id');
        $device   = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::first();
        $snapshot = $device?->last_telemetry_snapshot;

        $orphaned = $this->computeOrphanedOnus($device, $snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);

        return response()->json([
            'success'       => true,
            'orphaned_onus' => $orphaned,
            'total'         => count($orphaned),
        ]);
    }

    public function deleteOrphanedOnu(Request $request, $id)
    {
        $reg = OntRegistration::with(['customerService.networkPort', 'customerService.customer'])->findOrFail($id);
        $sn = $reg->onu_serial ?: $reg->onu_mac;
        $custName = $reg->customerService?->customer?->name ?: "Pelanggan #{$reg->id}";

        DB::transaction(function () use ($reg, $sn, $custName) {
            // 1. Bebaskan port ODP jika ada
            if ($reg->customerService && $reg->customerService->networkPort) {
                $reg->customerService->networkPort->update([
                    'status' => 'available',
                    'customer_service_id' => null,
                ]);
            }

            // 2. Putus kaitan pada customer service
            if ($reg->customerService) {
                $reg->customerService->update([
                    'status' => 'terminated',
                    'notes' => trim(($reg->customerService->notes ?? '') . ' [Data ONU dibersihkan dari OLT/UNMS pada ' . now()->format('d/m/Y H:i') . ']'),
                ]);
            }

            // 3. Hapus record OntRegistration
            $reg->delete();

            // 4. Catat ke AuditLog
            AuditLog::record(
                'PEMBERSIHAN_DATA',
                'Manajemen OLT & Inventaris',
                "Pembersihan Data: Menghapus data ONU terputus {$sn} milik {$custName} dari UNMS dan membebaskan port ODP terkait.",
                auth()->user()?->id,
                ['onu_serial' => $sn, 'customer_name' => $custName]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Data ONU {$sn} milik {$custName} berhasil dibersihkan dari sistem UNMS dan port ODP telah dibebaskan.",
        ]);
    }

    public function bulkDeleteOrphanedOnus(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer',
        ]);

        $ids = $request->input('ids', []);
        if (empty($ids)) {
            return response()->json(['success' => false, 'message' => 'Tidak ada data yang dipilih.'], 400);
        }

        $regs = OntRegistration::with(['customerService.networkPort', 'customerService.customer'])->whereIn('id', $ids)->get();
        $deletedCount = 0;

        DB::transaction(function () use ($regs, &$deletedCount) {
            foreach ($regs as $reg) {
                $sn = $reg->onu_serial ?: $reg->onu_mac;
                $custName = $reg->customerService?->customer?->name ?: "Pelanggan #{$reg->id}";

                // Bebaskan port ODP
                if ($reg->customerService && $reg->customerService->networkPort) {
                    $reg->customerService->networkPort->update([
                        'status' => 'available',
                        'customer_service_id' => null,
                    ]);
                }

                if ($reg->customerService) {
                    $reg->customerService->update([
                        'status' => 'terminated',
                    ]);
                }

                $reg->delete();
                $deletedCount++;
            }

            AuditLog::record(
                'PEMBERSIHAN_DATA_MASAL',
                'Manajemen OLT & Inventaris',
                "Pembersihan Masal: Menghapus {$deletedCount} data ONU terputus dari UNMS.",
                auth()->user()?->id,
                ['count' => $deletedCount]
            );
        });

        return response()->json([
            'success' => true,
            'deleted_count' => $deletedCount,
            'message' => "Berhasil membersihkan {$deletedCount} data ONU terputus dari UNMS. Seluruh port ODP terkait telah dibebaskan.",
        ]);
    }
}
