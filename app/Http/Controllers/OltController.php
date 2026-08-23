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
            return response()->json($snapshot);
        }

        // 2. Jika dipaksa refresh atau snapshot belum ada, ambil live via Driver dan simpan ke Database
        $driver = $this->getDriver($vendor, $device?->id);

        $driverDeviceInfo = $driver->getDeviceInfo();
        $driverPonPorts   = $driver->getPonPorts();
        $driverOnuList    = $driver->getOnuList();
        $driverUncfg      = $driver->getUnconfiguredOnus();

        $snapshot = [
            'device_info'       => $driverDeviceInfo,
            'pon_ports'         => $driverPonPorts,
            'onu_list'          => $driverOnuList,
            'unconfigured_onus' => $driverUncfg,
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
}
