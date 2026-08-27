<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\OltDevice;
use App\Models\OntRegistration;
use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\Customer;
use App\Models\CustomerService;
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

        $v = strtolower(str_replace(' ', '-', $vendor));
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

        if (str_contains($v, 'c320')) {
            return new ZteC320Driver(
                ip: $ip,
                community: $community,
                snmpVersion: $snmpVersion,
                isLive: $isLive,
                port: $port
            );
        }

        switch ($v) {
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
                    isLive: $isLive,
                    port: $port
                );
        }
    }

    public function index(Request $request)
    {
        $vendor   = $request->input('vendor') ?: $request->query('vendor', 'zte-c300');
        $deviceId = $request->input('device_id') ?: ($request->query('device_id') ?: null);
        $isFresh  = $request->boolean('fresh') || $request->boolean('force');

        $device = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::first();

        // 1. Jika data snapshot database sudah ada dan tidak dipaksa refresh, selalu partisi ulang dengan data customer database UNMS terbaru
        if (!$isFresh && $device && !empty($device->last_telemetry_snapshot)) {
            $rawSnapshot = $device->last_telemetry_snapshot;
            $snapshot = $this->processAndPartitionTelemetry(
                $device,
                $rawSnapshot['device_info'] ?? [],
                $rawSnapshot['pon_ports'] ?? [],
                $rawSnapshot['onu_list'] ?? [],
                $rawSnapshot['unconfigured_onus'] ?? []
            );
            $snapshot['polled_at'] = $rawSnapshot['polled_at'] ?? now()->toIso8601String();
            return response()->json($snapshot);
        }

        // 2. Jika dipaksa refresh atau snapshot belum ada, ambil live via Driver dan simpan ke Database
        $driver = $this->getDriver($vendor, $device?->id);

        $driverDeviceInfo = $driver->getDeviceInfo();
        $driverPonPorts   = $driver->getPonPorts();
        $driverOnuList    = $driver->getOnuList();
        $driverUncfg      = $driver->getUnconfiguredOnus();

        $snapshot = $this->processAndPartitionTelemetry($device, $driverDeviceInfo, $driverPonPorts, $driverOnuList, $driverUncfg);

        if ($device) {
            $device->update([
                'last_telemetry_snapshot' => $snapshot,
                'last_connected_at'       => now(),
            ]);
            $this->syncOntRegistrations($device, $driverOnuList);
        }

        return response()->json($snapshot);
    }

    /**
     * Mempartisi ONU dari OLT menjadi 3 kategori UNMS yang presisi:
     * 1. onu_list: ONU yang terdaftar di database UNMS (OntRegistration & Customer)
     * 2. unconfigured_onus: ONU fisik yang terdeteksi di OLT namun BELUM terdaftar di database UNMS
     * 3. orphaned_onus: ONU di database UNMS yang sudah tidak terdeteksi di OLT fisik
     */
    public function processAndPartitionTelemetry(?OltDevice $device, array $driverDeviceInfo, array $driverPonPorts, array $driverOnuList, array $driverUncfg): array
    {
        // 1. Ambil seluruh data ONT di database UNMS yang sudah terhubung ke Pelanggan
        $query = OntRegistration::with([
            'customerService.customer',
            'customerService.networkPort.node',
            'customerService.servicePackage',
            'oltPort.node'
        ])
        ->whereNotNull('customer_service_id')
        ->whereHas('customerService.customer');

        if ($device) {
            $query->where(function ($q) use ($device) {
                $q->whereHas('customerService.networkPort.node', fn($sq) => $sq->where('olt_device_id', $device->id))
                  ->orWhereHas('oltPort.node', fn($sq) => $sq->where('olt_device_id', $device->id));
            });
        }

        $dbOnts = $query->get();

        // Buat map pencarian berdasarkan Serial Number & MAC Address
        $registeredMap = [];
        foreach ($dbOnts as $ont) {
            $sn  = strtoupper(trim((string)$ont->onu_serial));
            $mac = strtoupper(trim((string)$ont->onu_mac));
            if (!empty($sn)) $registeredMap[$sn] = $ont;
            if (!empty($mac)) $registeredMap[$mac] = $ont;
        }

        $registeredOnus   = [];
        $unregisteredOnus = [];
        $matchedOntIds    = [];

        // Buat map pencarian live SNMP berdasarkan Serial Number & MAC Address
        $driverOnuMap = [];
        foreach ($driverOnuList as $onu) {
            $sn  = strtoupper(trim((string)($onu['serial_number'] ?? '')));
            $mac = strtoupper(trim((string)($onu['mac_address'] ?? ($onu['onu_mac'] ?? ''))));
            if (!empty($sn)) $driverOnuMap[$sn] = $onu;
            if (!empty($mac)) $driverOnuMap[$mac] = $onu;
        }

        // 2. Kategori 1: Seluruh ONU terdaftar di database UNMS (Customer)
        foreach ($dbOnts as $ont) {
            $sn  = strtoupper(trim((string)$ont->onu_serial));
            $mac = strtoupper(trim((string)$ont->onu_mac));

            $liveOnu = null;
            if (!empty($sn) && isset($driverOnuMap[$sn])) {
                $liveOnu = $driverOnuMap[$sn];
            } elseif (!empty($mac) && isset($driverOnuMap[$mac])) {
                $liveOnu = $driverOnuMap[$mac];
            }

            $matchedOntIds[] = $ont->id;
            $customerName = $ont->customerService?->customer?->name ?: ('Pelanggan #' . $ont->id);
            $customerCode = $ont->customerService?->customer?->customer_number ?: ('CUST-' . $ont->id);
            $nodePort     = $ont->oltPort?->node?->olt_port_ref ?: 'gpon-olt_1/1/1';
            $portClean    = str_replace('gpon_olt_', 'gpon-olt_', $nodePort);

            $rawStatus = $liveOnu['status'] ?? ($ont->status === 'active' ? 'Online' : 'Offline');
            $statusClean = (strtoupper($rawStatus) === 'ONLINE') ? 'Online' : 'Offline';

            $registeredOnus[] = [
                '_source'         => $liveOnu ? 'live_snmp' : 'database',
                'ont_id'          => $ont->id,
                'onu_id'          => $liveOnu['onu_id'] ?? ($liveOnu['onu_index'] ?? (string)$ont->id),
                'port'            => $liveOnu['port'] ?? (explode(',', $portClean)[0] ?? $nodePort),
                'customer_id'     => $ont->customerService?->customer?->id,
                'customer_name'   => $customerName,
                'customer_number' => $customerCode,
                'serial_number'   => $ont->onu_serial,
                'mac_address'     => $ont->onu_mac,
                'status'          => $statusClean,
                'rx_power'        => isset($liveOnu['rx_power']) ? (float)$liveOnu['rx_power'] : (float)($ont->rx_power ?? -19.5),
                'tx_power'        => isset($liveOnu['tx_power']) ? (float)$liveOnu['tx_power'] : (float)($ont->tx_power ?? 2.1),
                'distance_meters' => $liveOnu['distance_meters'] ?? 850,
                'ip_address'      => $ont->customerService?->ip_address ?: '—',
                'onu_type'        => $ont->onu_type ?: 'HGU EPON/GPON',
            ];
        }

        // Kategori 2: ONU Fisik dari OLT driver yang BELUM ada di DB UNMS
        foreach ($driverOnuList as $onu) {
            $sn  = strtoupper(trim((string)($onu['serial_number'] ?? '')));
            $mac = strtoupper(trim((string)($onu['mac_address'] ?? ($onu['onu_mac'] ?? ''))));

            $isRegistered = (!empty($sn) && isset($registeredMap[$sn])) || (!empty($mac) && isset($registeredMap[$mac]));
            if (!$isRegistered) {
                $unregisteredOnus[] = [
                    '_source'                  => 'live_snmp',
                    'onu_name'                 => $onu['onu_name'] ?? ($onu['customer_name'] ?? ('ONU ' . ($onu['serial_number'] ?? ''))),
                    'serial_number'            => $onu['serial_number'] ?? null,
                    'mac_address'              => $onu['mac_address'] ?? ($onu['onu_mac'] ?? ($onu['serial_number'] ?? null)),
                    'detected_port'            => $onu['port'] ?? ($onu['detected_port'] ?? 'gpon-olt_1/1/1'),
                    'onu_index'                => $onu['onu_id'] ?? ($onu['onu_index'] ?? '1'),
                    'onu_id'                   => $onu['onu_id'] ?? ($onu['onu_index'] ?? '1'),
                    'vendor_model'             => $onu['vendor_model'] ?? ($onu['onu_type'] ?? 'HGU EPON/GPON'),
                    'status'                   => $onu['status'] ?? 'Online',
                    'rx_power'                 => isset($onu['rx_power']) ? (float)$onu['rx_power'] : null,
                    'tx_power'                 => isset($onu['tx_power']) ? (float)$onu['tx_power'] : null,
                    'distance_meters'          => $onu['distance_meters'] ?? null,
                    'detected_at'              => $onu['detected_at'] ?? 'Terdeteksi Aktif di OLT',
                    'is_unregistered_physical' => true,
                ];
            }
        }

        // 3. Gabungkan unconfigured / autofind ONUs dari driver
        $existingUncfgSns = collect($unregisteredOnus)->pluck('serial_number')->filter()->map(fn($s) => strtoupper(trim((string)$s)))->toArray();
        foreach ($driverUncfg as $uncfg) {
            $uSn = strtoupper(trim((string)($uncfg['serial_number'] ?? '')));
            if (!empty($uSn) && in_array($uSn, $existingUncfgSns)) {
                continue;
            }
            if (!empty($uSn) && isset($registeredMap[$uSn])) {
                continue;
            }
            $unregisteredOnus[] = $uncfg;
        }

        // 4. Kategori 3: Orphaned ONUs (Ada di UNMS tapi tidak ditemukan di OLT fisik)
        $orphanedOnus = [];
        foreach ($dbOnts as $ont) {
            if (!in_array($ont->id, $matchedOntIds)) {
                $customerName = $ont->customerService?->customer?->name ?: ('Pelanggan #' . $ont->id);
                $customerCode = $ont->customerService?->customer?->customer_number ?: ('CUST-' . $ont->id);
                $node         = $ont->customerService?->networkPort?->node ?: $ont->oltPort?->node;
                $portNumber   = $ont->customerService?->networkPort?->port_number;
                $oltName      = $device?->name ?: ($node?->oltDevice?->name ?: 'OLT Utama');
                $oltPortRef   = $node?->olt_port_ref ?: 'epon_0/1';

                $orphanedOnus[] = [
                    'id'                  => $ont->id,
                    'customer_id'         => $ont->customerService?->customer?->id,
                    'customer_name'       => $customerName,
                    'customer_number'     => $customerCode,
                    'service_id'          => $ont->customerService?->id,
                    'onu_serial'          => $ont->onu_serial,
                    'onu_mac'             => $ont->onu_mac,
                    'onu_type'            => $ont->onu_type ?: 'HGU EPON/GPON',
                    'odp_name'            => $node?->name ?: 'ODP Tidak Diketahui',
                    'odp_port'            => $portNumber ? "Port {$portNumber}" : '—',
                    'olt_name'            => $oltName,
                    'olt_port'            => $oltPortRef,
                    'registered_at'       => $ont->registered_at?->format('d M Y H:i') ?: ($ont->created_at?->format('d M Y H:i') ?: '—'),
                    'last_online_at'      => $ont->last_online_at?->format('d M Y H:i') ?: 'Tidak Pernah Online',
                    'unms_status'         => $ont->status ?: 'inactive',
                    'orphan_reason'       => 'Tidak Ditemukan di OLT (Telah Dihapus dari Perangkat OLT / Putus Berlangganan)',
                ];
            }
        }

        // 5. Perbarui hitungan port PON
        $updatedPonPorts = array_map(function ($port) use ($registeredOnus) {
            $portId = $port['port_id'] ?? '';
            $regCount = 0;
            $onCount = 0;
            foreach ($registeredOnus as $ro) {
                $roPort = $ro['port'] ?? '';
                if ($this->portsMatch($portId, $roPort)) {
                    $regCount++;
                    if (strcasecmp($ro['status'] ?? '', 'Online') === 0) $onCount++;
                }
            }
            if ($regCount > 0) {
                $port['registered_onus'] = $regCount;
                $port['online_onus']     = $onCount;
                $port['los_onus']        = max(0, $regCount - $onCount);
            } else {
                $port['registered_onus'] = $port['registered_onus'] ?? 0;
                $port['online_onus']     = $port['online_onus'] ?? 0;
                $port['los_onus']        = $port['los_onus'] ?? 0;
            }
            return $port;
        }, $driverPonPorts);

        return [
            'device_info'       => $driverDeviceInfo,
            'pon_ports'         => $updatedPonPorts,
            'onu_list'          => $registeredOnus,
            'unconfigured_onus' => $unregisteredOnus,
            'orphaned_onus'     => $orphanedOnus,
            'polled_at'         => now()->toIso8601String(),
        ];
    }

    public function syncOntRegistrations(OltDevice $device, array $onuList): void
    {
        foreach ($onuList as $onuData) {
            $sn = $onuData['serial_number'] ?? null;
            if (!$sn) continue;

            $newStatus = ($onuData['status'] === 'Online') ? 'active' : 'inactive';
            $newRx     = isset($onuData['rx_power']) ? (float)$onuData['rx_power'] : null;
            $newTx     = isset($onuData['tx_power']) ? (float)$onuData['tx_power'] : null;

            $ontReg = OntRegistration::where('onu_serial', $sn)
                ->orWhere('onu_mac', $sn)
                ->first();

            if ($ontReg) {
                $ontReg->update([
                    'rx_power' => $newRx,
                    'tx_power' => $newTx,
                    'status'   => $newStatus,
                ]);
            }
        }
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

    /**
     * Fitur Sinkronisasi Cadangan & Fallback Sync dari Portal Eksternal / Probe Agent / Backup File
     * Sangat berguna ketika OLT SNMP mengalami timeout/migrasi ke VPS.
     */
    public function syncExternal(Request $request)
    {
        $request->validate([
            'device_id'    => 'required|integer|exists:olt_devices,id',
            'source_type'  => 'required|string|in:regis_zte,json_import,probe_agent',
            'external_url' => 'nullable|string',
            'username'     => 'nullable|string',
            'password'     => 'nullable|string',
            'raw_json'     => 'nullable|string',
        ]);

        $device = OltDevice::findOrFail($request->device_id);
        $sourceType = $request->source_type;

        $imported = 0;
        $updated  = 0;

        if ($sourceType === 'regis_zte') {
            $regisUrl = rtrim($request->external_url ?: 'http://103.152.119.26:2227', '/');
            $user     = $request->username ?: 'amar';
            $pass     = $request->password ?: 'amar';

            $cookieFile = sys_get_temp_dir() . "/regis_cookie_{$device->id}.txt";
            if (file_exists($cookieFile)) @unlink($cookieFile);

            // 1. GET index.php
            $ch = curl_init("{$regisUrl}/index.php");
            curl_setopt_array($ch, [CURLOPT_COOKIEJAR => $cookieFile, CURLOPT_COOKIEFILE => $cookieFile, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
            curl_exec($ch);
            curl_close($ch);

            // 2. POST login
            $ch = curl_init("{$regisUrl}/index.php");
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query(['username' => $user, 'password' => $pass, 'login' => '']),
                CURLOPT_COOKIEJAR => $cookieFile,
                CURLOPT_COOKIEFILE => $cookieFile,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT => 15,
            ]);
            curl_exec($ch);
            curl_close($ch);

            // 3. Fetch konfig_data_dt.php
            $ch = curl_init("{$regisUrl}/halaman_operator/konfig_data_dt.php");
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query(['draw' => 1, 'start' => 0, 'length' => 5000, 'olt' => $device->ip_address, 'interface' => '', 'status' => '', 'odp' => '']),
                CURLOPT_COOKIEFILE => $cookieFile,
                CURLOPT_COOKIEJAR => $cookieFile,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
            ]);
            $respJson = curl_exec($ch);
            curl_close($ch);

            $data = json_decode($respJson, true);
            $items = $data['data'] ?? [];

            DB::transaction(function () use ($items, $device, &$imported, &$updated) {
                foreach ($items as $idx => $item) {
                    $rawSn   = strip_tags($item['serialnumber'] ?? '');
                    $sn      = strtoupper(trim($rawSn));
                    $rawName = strip_tags($item['name'] ?? '');
                    $name    = trim($rawName) ?: ("Pelanggan " . ($sn ?: "UNMS"));
                    $iface   = strip_tags($item['interface'] ?? '');
                    $rxPower = strip_tags($item['rx_power'] ?? '');
                    $statusStr = strip_tags($item['status_onu'] ?? '');

                    if (empty($sn)) continue;

                    $portRef = "gpon-olt_1/1/1";
                    if (preg_match('/^(\d+\/\d+\/\d+)/', $iface, $m)) {
                        $portRef = "gpon-olt_" . $m[1];
                    }

                    $rxFloat = null;
                    if (preg_match('/([-+]?\d+\.\d+)/', $rxPower, $m)) {
                        $rxFloat = (float)$m[1];
                    }

                    $status = ($statusStr === 'OFFLINE' || str_contains(strtoupper($rxPower), 'OFFLINE')) ? 'inactive' : 'active';

                    $customer = Customer::where('name', $name)->first();
                    if (!$customer) {
                        $nextId = (Customer::max('id') ?: 0) + 1;
                        $custNum = 'CUST-' . sprintf('%05d', $nextId);
                        $customer = Customer::create([
                            'name'            => $name,
                            'customer_number' => $custNum,
                            'status'          => 'active',
                            'address'         => $device->location ?: 'Kota Solok',
                        ]);
                    }

                    $nodeCode = 'NODE-' . strtoupper(str_replace(['gpon-olt_', '/'], ['', '-'], $portRef));
                    $node = NetworkNode::firstOrCreate(['olt_device_id' => $device->id, 'olt_port_ref' => $portRef], ['name' => "PON Port {$portRef}", 'code' => $nodeCode, 'node_type' => 'olt_port', 'status' => 'active']);

                    $netPort = NetworkPort::firstOrCreate(['node_id' => $node->id, 'port_number' => '1'], ['status' => 'used', 'port_type' => 'PON']);

                    $service = CustomerService::where('customer_id', $customer->id)->first();
                    if (!$service) {
                        $nextSvcId = (CustomerService::max('id') ?: 0) + 1;
                        $svcNum = 'SVC-' . sprintf('%05d', $nextSvcId);
                        $service = CustomerService::create([
                            'customer_id'        => $customer->id,
                            'service_number'     => $svcNum,
                            'service_package_id' => 1,
                            'network_port_id'    => $netPort->id,
                            'status'             => 'active',
                            'ip_address'         => '10.11.11.' . rand(2, 254),
                        ]);
                    }

                    $ontReg = OntRegistration::where('onu_serial', $sn)->first();
                    if (!$ontReg) {
                        OntRegistration::create([
                            'customer_service_id' => $service->id,
                            'olt_port_id'         => $netPort->id,
                            'onu_serial'          => $sn,
                            'onu_type'            => 'ZTE ONU GPON',
                            'rx_power'            => $rxFloat ?? -19.50,
                            'tx_power'            => 2.10,
                            'status'              => $status,
                            'registered_at'       => now(),
                            'last_online_at'      => $status === 'active' ? now() : null,
                        ]);
                        $imported++;
                    } else {
                        $ontReg->update([
                            'customer_service_id' => $service->id,
                            'olt_port_id'         => $netPort->id,
                            'rx_power'            => $rxFloat ?? $ontReg->rx_power,
                            'status'              => $status,
                            'last_online_at'      => $status === 'active' ? now() : $ontReg->last_online_at,
                        ]);
                        $updated++;
                    }
                }
            });
        }

        // Trigger snapshot update
        $driver = $this->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);
        $snapshot = $this->processAndPartitionTelemetry($device, $driver->getDeviceInfo(), $driver->getPonPorts(), $driver->getOnuList(), []);
        $device->update(['last_telemetry_snapshot' => $snapshot, 'last_connected_at' => now()]);

        AuditLog::record(
            'SINKRONISASI_EKSTERNAL',
            'Manajemen OLT',
            "Sinkronisasi Cadangan: Impor {$imported} baru dan {$updated} update ONU dari {$sourceType} untuk OLT {$device->name}.",
            auth()->user()?->id,
            ['imported' => $imported, 'updated' => $updated, 'source' => $sourceType]
        );

        return response()->json([
            'success'  => true,
            'message'  => "Berhasil melakukan sinkronisasi cadangan: {$imported} baru ditambahkan, {$updated} diperbarui.",
            'imported' => $imported,
            'updated'  => $updated,
            'total'    => count($snapshot['onu_list'] ?? []),
        ]);
    }

    /**
     * Tombol 1-Klik Khusus: Impor 1.628 ONU dari REGIS ZTE (http://103.152.119.26:2227)
     */
    public function import1628Onus(Request $request)
    {
        $deviceId = $request->input('device_id');
        $device   = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::where('ip_address', '10.11.11.90')->first();

        if (!$device) {
            $device = OltDevice::first();
        }

        if (!$device) {
            return response()->json(['success' => false, 'message' => 'Tidak ada perangkat OLT terdaftar di database.'], 404);
        }

        $regisUrl = "http://103.152.119.26:2227";
        $username = "amar";
        $password = "amar";

        $cookieFile = sys_get_temp_dir() . "/regis_cookie_direct.txt";
        if (file_exists($cookieFile)) @unlink($cookieFile);

        // 1. GET index.php
        $ch = curl_init("{$regisUrl}/index.php");
        curl_setopt_array($ch, [CURLOPT_COOKIEJAR => $cookieFile, CURLOPT_COOKIEFILE => $cookieFile, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        curl_exec($ch);
        curl_close($ch);

        // 2. POST login
        $ch = curl_init("{$regisUrl}/index.php");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query(['username' => $username, 'password' => $password, 'login' => '']),
            CURLOPT_COOKIEJAR => $cookieFile,
            CURLOPT_COOKIEFILE => $cookieFile,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        curl_exec($ch);
        curl_close($ch);

        // 3. Fetch konfig_data_dt.php (5000 rows limit to capture all 1628 entries)
        $ch = curl_init("{$regisUrl}/halaman_operator/konfig_data_dt.php");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query(['draw' => 1, 'start' => 0, 'length' => 5000, 'olt' => '10.11.11.90', 'interface' => '', 'status' => '', 'odp' => '']),
            CURLOPT_COOKIEFILE => $cookieFile,
            CURLOPT_COOKIEJAR => $cookieFile,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 45,
        ]);
        $respJson = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($respJson, true);
        $items = $data['data'] ?? [];

        if (empty($items)) {
            return response()->json(['success' => false, 'message' => 'Gagal menarik data dari server REGIS ZTE (Respon kosong / Login gagal).'], 500);
        }

        $imported = 0;
        $updated  = 0;

        DB::transaction(function () use ($items, $device, &$imported, &$updated) {
            foreach ($items as $idx => $item) {
                $rawSn   = strip_tags($item['serialnumber'] ?? '');
                $sn      = strtoupper(trim($rawSn));
                $rawName = strip_tags($item['name'] ?? '');
                $name    = trim($rawName) ?: ("Pelanggan " . ($sn ?: "UNMS"));
                $iface   = strip_tags($item['interface'] ?? '');
                $rxPower = strip_tags($item['rx_power'] ?? '');
                $statusStr = strip_tags($item['status_onu'] ?? '');

                if (empty($sn)) continue;

                $portRef = "gpon-olt_1/1/1";
                if (preg_match('/^(\d+\/\d+\/\d+)/', $iface, $m)) {
                    $portRef = "gpon-olt_" . $m[1];
                }

                $rxFloat = null;
                if (preg_match('/([-+]?\d+\.\d+)/', $rxPower, $m)) {
                    $rxFloat = (float)$m[1];
                }

                $status = ($statusStr === 'OFFLINE' || str_contains(strtoupper($rxPower), 'OFFLINE')) ? 'inactive' : 'active';

                $custNum = 'CUST-' . sprintf('%05d', $idx + 1);
                $customer = Customer::firstOrCreate(['name' => $name], ['customer_number' => $custNum, 'status' => 'active', 'address' => 'Kota Solok']);

                $nodeCode = 'NODE-' . strtoupper(str_replace(['gpon-olt_', '/'], ['', '-'], $portRef));
                $node = NetworkNode::firstOrCreate(['olt_device_id' => $device->id, 'olt_port_ref' => $portRef], ['name' => "PON Port {$portRef}", 'code' => $nodeCode, 'node_type' => 'olt_port', 'status' => 'active']);

                $netPort = NetworkPort::firstOrCreate(['node_id' => $node->id, 'port_number' => '1'], ['status' => 'used', 'port_type' => 'PON']);

                $svcNum = 'SVC-' . sprintf('%05d', $idx + 1);
                $service = CustomerService::firstOrCreate(['customer_id' => $customer->id], ['service_number' => $svcNum, 'service_package_id' => 1, 'network_port_id' => $netPort->id, 'status' => 'active', 'ip_address' => '10.11.11.' . rand(2, 254)]);

                $ontReg = OntRegistration::where('onu_serial', $sn)->first();
                if (!$ontReg) {
                    OntRegistration::create([
                        'customer_service_id' => $service->id,
                        'olt_port_id'         => $netPort->id,
                        'onu_serial'          => $sn,
                        'onu_type'            => 'ZTE ONU GPON',
                        'rx_power'            => $rxFloat ?? -19.50,
                        'tx_power'            => 2.10,
                        'status'              => $status,
                        'registered_at'       => now(),
                        'last_online_at'      => $status === 'active' ? now() : null,
                    ]);
                    $imported++;
                } else {
                    $ontReg->update([
                        'customer_service_id' => $service->id,
                        'olt_port_id'         => $netPort->id,
                        'rx_power'            => $rxFloat ?? $ontReg->rx_power,
                        'status'              => $status,
                        'last_online_at'      => $status === 'active' ? now() : $ontReg->last_online_at,
                    ]);
                    $updated++;
                }
            }
        });

        // Trigger snapshot update
        $driver = $this->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);
        $snapshot = $this->processAndPartitionTelemetry($device, $driver->getDeviceInfo(), $driver->getPonPorts(), $driver->getOnuList(), []);
        $device->update(['last_telemetry_snapshot' => $snapshot, 'last_connected_at' => now()]);

        AuditLog::record(
            'IMPOR_1628_ONU',
            'Manajemen OLT',
            "Impor Langsung 1-Klik: Berhasil mengimpor {$imported} baru dan {$updated} update ONU dari REGIS ZTE ke OLT {$device->name}.",
            auth()->user()?->id,
            ['imported' => $imported, 'updated' => $updated]
        );

        return response()->json([
            'success'  => true,
            'message'  => "Berhasil mengimpor {$imported} baru dan memperbarui {$updated} data ONU dari REGIS ZTE.",
            'imported' => $imported,
            'updated'  => $updated,
            'total'    => count($items),
        ]);
    }

    private function portsMatch(string $p1, string $p2): bool
    {
        if (empty($p1) || empty($p2)) return false;
        if ($p1 === $p2) return true;

        $c1 = strtolower(preg_replace('/^(gpon|epon)[-_]?(olt)?[-_]?/i', '', trim($p1)));
        $c2 = strtolower(preg_replace('/^(gpon|epon)[-_]?(olt)?[-_]?/i', '', trim($p2)));

        if ($c1 === $c2) return true;

        $parts1 = explode('/', $c1);
        $parts2 = explode('/', $c2);
        $last1 = end($parts1);
        $last2 = end($parts2);

        if ($last1 !== '' && $last1 === $last2) {
            return true;
        }

        return str_contains($c1, $c2) || str_contains($c2, $c1);
    }
}
