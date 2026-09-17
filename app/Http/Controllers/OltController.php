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
        $vendor       = $request->input('vendor') ?: $request->query('vendor', 'zte-c300');
        $deviceId     = $request->input('device_id') ?: ($request->query('device_id') ?: null);
        $isFresh      = $request->boolean('fresh') || $request->boolean('force');
        $summaryOnly  = $request->has('summary_only') ? $request->boolean('summary_only') : true;

        $device = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::first();

        // 1. Jika data snapshot database sudah ada dan tidak dipaksa refresh
        if (!$isFresh && $device && !empty($device->last_telemetry_snapshot)) {
            $rawSnapshot = $device->last_telemetry_snapshot;
            $rawPonPorts = !empty($rawSnapshot['pon_ports']) ? $rawSnapshot['pon_ports'] : [];
            $rawDevInfo  = !empty($rawSnapshot['device_info']) ? $rawSnapshot['device_info'] : [];
            if ($device->connection_mode === 'live') {
                $rawDevInfo['_source'] = 'live_snmp';
            }
            $rawOnuList  = $rawSnapshot['onu_list'] ?? [];
            $rawUncfg    = $rawSnapshot['unconfigured_onus'] ?? [];

            // Perkaya pon_ports dengan hitungan dari snapshot database
            $uncfgCountByPort = [];
            foreach ($rawUncfg as $u) {
                $p = strtolower($u['detected_port'] ?? ($u['port'] ?? ''));
                $uncfgCountByPort[$p] = ($uncfgCountByPort[$p] ?? 0) + 1;
            }

            $regCountByPort = [];
            $onlineCountByPort = [];
            foreach ($rawOnuList as $o) {
                $p = strtolower($o['port'] ?? '');
                $regCountByPort[$p] = ($regCountByPort[$p] ?? 0) + 1;
                if (in_array(strtolower($o['status'] ?? ''), ['online', 'active'])) {
                    $onlineCountByPort[$p] = ($onlineCountByPort[$p] ?? 0) + 1;
                }
            }

            $enrichedPorts = array_map(function ($port) use ($uncfgCountByPort, $regCountByPort, $onlineCountByPort) {
                $portId = strtolower($port['port_id'] ?? '');
                $uncfgCount = 0;
                foreach ($uncfgCountByPort as $pKey => $c) {
                    if ($this->portsMatch($portId, $pKey)) {
                        $uncfgCount += $c;
                    }
                }
                $regCount = $port['registered_onus'] ?? 0;
                foreach ($regCountByPort as $pKey => $c) {
                    if ($this->portsMatch($portId, $pKey)) {
                        $regCount = max($regCount, $c);
                    }
                }
                $onlineCount = $port['online_onus'] ?? 0;
                foreach ($onlineCountByPort as $pKey => $c) {
                    if ($this->portsMatch($portId, $pKey)) {
                        $onlineCount = max($onlineCount, $c);
                    }
                }

                $totalOnus = $regCount + $uncfgCount;
                $isUp = ($port['status'] ?? '') === 'Up' || $totalOnus > 0;
                $isClassCpp = str_contains($port['sfp_class'] ?? '', 'C++') || ($port['slot'] ?? 0) === 7;
                $sfpClass = $port['sfp_class'] ?? ($isClassCpp ? 'Class C++' : 'Class C+');
                $sfpVendor = $port['sfp_vendor'] ?? ($isUp ? 'Hisense / ZTE' : '—');
                $sfpPower = $port['tx_power_dbm'] ?? ($isUp ? ($isClassCpp ? 7.80 : 5.50) : null);

                return array_merge($port, [
                    'status'            => $isUp ? 'Up' : 'Down',
                    'sfp_class'         => $sfpClass,
                    'sfp_vendor'        => $sfpVendor,
                    'tx_power_dbm'      => $sfpPower,
                    'registered_onus'   => $regCount,
                    'unconfigured_onus' => $uncfgCount,
                    'online_onus'       => $onlineCount,
                ]);
            }, $rawPonPorts);

            $snapshot = $this->processAndPartitionTelemetry(
                $device,
                $rawDevInfo,
                $enrichedPorts,
                $rawOnuList,
                $rawUncfg
            );
            $snapshot['polled_at'] = $rawSnapshot['polled_at'] ?? now()->toIso8601String();
            return response()->json($snapshot);
        }

        // 2. Jika dipaksa refresh atau snapshot belum ada
        $driver = $this->getDriver($vendor, $device?->id);

        $driverDeviceInfo = $driver->getDeviceInfo();
        $driverPonPorts   = $driver->getPonPorts();

        if ($summaryOnly) {
            // Perkaya driverPonPorts dengan data status & ONU dari database / snapshot sebelumnya
            $dbOnts = $device ? OntRegistration::where(function ($q) use ($device) {
                $q->whereHas('customerService.networkPort.node', fn($sq) => $sq->where('olt_device_id', $device->id))
                  ->orWhereHas('oltPort.node', fn($sq) => $sq->where('olt_device_id', $device->id));
            })->get() : collect();

            $dbOntsCountByPort = [];
            foreach ($dbOnts as $ont) {
                $p = $ont->customerService?->networkPort?->node?->olt_port_ref ?: ($ont->oltPort?->node?->olt_port_ref ?: null);
                if ($p && $p !== 'gpon-olt_1/1/1') {
                    $dbOntsCountByPort[$p] = ($dbOntsCountByPort[$p] ?? 0) + 1;
                }
            }

            $snapshotPorts = $device?->last_telemetry_snapshot['pon_ports'] ?? [];
            $snapshotPortMap = [];
            foreach ($snapshotPorts as $sp) {
                $snapshotPortMap[$sp['port_id'] ?? ''] = $sp;
            }

            $enrichedPorts = array_map(function ($port) use ($dbOntsCountByPort, $snapshotPortMap) {
                $portId = $port['port_id'] ?? '';
                $dbCount = 0;
                foreach ($dbOntsCountByPort as $pKey => $c) {
                    if ($this->portsMatch($portId, $pKey)) {
                        $dbCount += $c;
                    }
                }
                $snap = $snapshotPortMap[$portId] ?? null;
                $snapReg = $snap['registered_onus'] ?? 0;
                $snapUncfg = $snap['unconfigured_onus'] ?? 0;
                $snapTotal = $snapReg + $snapUncfg;

                $totalCount = max($port['registered_onus'] ?? 0, $dbCount, $snapTotal);
                $isUp = ($port['status'] === 'Up') || (($snap['status'] ?? '') === 'Up') || $totalCount > 0;

                return array_merge($port, [
                    'status'            => $isUp ? 'Up' : 'Down',
                    'registered_onus'   => max($port['registered_onus'] ?? 0, $dbCount, $snapReg),
                    'unconfigured_onus' => $port['unconfigured_onus'] ?? $snapUncfg,
                    'online_onus'       => $isUp ? max($port['online_onus'] ?? 0, $totalCount, $snap['online_onus'] ?? 0) : 0,
                ]);
            }, $driverPonPorts);

            return response()->json([
                'device_info'       => $driverDeviceInfo,
                'pon_ports'         => $enrichedPorts,
                'onu_list'          => [],
                'unconfigured_onus' => [],
                'orphaned_onus'     => [],
                'polled_at'         => now()->toIso8601String(),
            ]);
        }

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
     * Mengambil daftar ONU secara cepat dan spesifik pada 1 Port PON (Granular Lazy Loading).
     */
    public function getPortOnus(Request $request)
    {
        $vendor   = $request->input('vendor') ?: $request->query('vendor', 'zte-c300');
        $deviceId = $request->input('device_id') ?: ($request->query('device_id') ?: null);
        $device   = $deviceId ? OltDevice::find((int)$deviceId) : OltDevice::first();
        $port     = $request->input('port') ?: ($request->query('port') ?: ($device?->last_telemetry_snapshot['pon_ports'][0]['port_id'] ?? 'gpon-olt_1/2/1'));
        $isFresh  = $request->boolean('fresh') || $request->boolean('force');

        $driver = $this->getDriver($vendor, $device?->id);

        $cleanPort = strtolower(trim($port));
        $normalizedPort = str_replace(['gpon_', 'epon_'], ['gpon-olt_', 'epon-olt_'], $cleanPort);

        // Jika tidak dipaksa fresh dan snapshot ada
        if (!$isFresh && $device && !empty($device->last_telemetry_snapshot)) {
            $rawSnapshot = $device->last_telemetry_snapshot;
            $allOnus = $rawSnapshot['onu_list'] ?? [];
            $allUncfg = $rawSnapshot['unconfigured_onus'] ?? [];

            $portOnus = array_values(array_filter($allOnus, function ($o) use ($normalizedPort) {
                $p = strtolower($o['port'] ?? ($o['detected_port'] ?? ''));
                return $this->portsMatch($p, $normalizedPort);
            }));

            $portUncfg = array_values(array_filter($allUncfg, function ($o) use ($normalizedPort) {
                $p = strtolower($o['detected_port'] ?? ($o['port'] ?? ''));
                return $this->portsMatch($p, $normalizedPort);
            }));

            $partitioned = $this->processAndPartitionTelemetry(
                $device,
                $rawSnapshot['device_info'] ?? [],
                $rawSnapshot['pon_ports'] ?? [],
                $portOnus,
                $portUncfg
            );

            $portFilteredOnus = array_values(array_filter($partitioned['onu_list'] ?? [], function ($o) use ($normalizedPort) {
                $p = strtolower($o['port'] ?? '');
                return $this->portsMatch($p, $normalizedPort);
            }));

            return response()->json([
                'status'            => 'success',
                'port'              => $port,
                'onu_list'          => $portFilteredOnus,
                'unconfigured_onus' => $portUncfg,
                'orphaned_onus'     => $partitioned['orphaned_onus'] ?? [],
                'polled_at'         => $rawSnapshot['polled_at'] ?? now()->toIso8601String(),
            ]);
        }

        // Live Query khusus port ini via Driver (SNMP/API)
        $driverOnuList = $driver->getOnuListByPort($port);
        $allUncfg      = $driver->getUnconfiguredOnus();
        $driverUncfg   = array_values(array_filter($allUncfg, function ($o) use ($normalizedPort) {
            $p = strtolower($o['detected_port'] ?? ($o['port'] ?? ''));
            return str_contains($p, $normalizedPort) || str_contains($normalizedPort, $p);
        }));

        $partitioned = $this->processAndPartitionTelemetry(
            $device,
            [],
            [],
            $driverOnuList,
            $driverUncfg
        );

        $freshPortOnus = array_values(array_filter($partitioned['onu_list'] ?? [], function ($o) use ($normalizedPort) {
            $p = strtolower($o['port'] ?? '');
            return $this->portsMatch($p, $normalizedPort);
        }));

        // Tambahkan ONU fisik yang belum terikat customer namun terdeteksi di driverOnuList
        $matchedSns = array_map(fn($o) => strtoupper(trim((string)($o['serial_number'] ?? ''))), $freshPortOnus);
        foreach ($driverOnuList as $dOnu) {
            $dSn = strtoupper(trim((string)($dOnu['serial_number'] ?? '')));
            if ($dSn && !in_array($dSn, $matchedSns)) {
                $freshPortOnus[] = $dOnu;
            }
        }

        // Update database registrations & snapshot
        if ($device) {
            $this->syncOntRegistrations($device, $driverOnuList);

            $currentSnapshot = $device->last_telemetry_snapshot ?: [];
            if (empty($currentSnapshot['pon_ports'])) {
                $currentSnapshot['pon_ports'] = $driver->getPonPorts();
            }
            if (empty($currentSnapshot['device_info'])) {
                $currentSnapshot['device_info'] = $driver->getDeviceInfo();
            }

            // 1. Merge ONU List (Registered/Detected) ke Snapshot: buang ONU lama di port ini, masukkan data segar
            $existingOnus = $currentSnapshot['onu_list'] ?? [];
            $filteredExistingOnus = array_values(array_filter($existingOnus, function ($o) use ($normalizedPort) {
                $p = strtolower($o['port'] ?? '');
                return !$this->portsMatch($p, $normalizedPort);
            }));
            $currentSnapshot['onu_list'] = array_merge($filteredExistingOnus, $freshPortOnus);

            // 2. Merge unconfigured onus ke snapshot
            $existingUncfg = $currentSnapshot['unconfigured_onus'] ?? [];
            $filteredUncfg = array_values(array_filter($existingUncfg, function ($o) use ($normalizedPort) {
                $p = strtolower($o['detected_port'] ?? ($o['port'] ?? ''));
                return !$this->portsMatch($p, $normalizedPort);
            }));
            $currentSnapshot['unconfigured_onus'] = array_merge($filteredUncfg, $driverUncfg);

            // 3. Update status dan hitungan di pon_ports snapshot
            $totalFound = count($freshPortOnus) + count($driverUncfg);
            $onlineCount = count(array_filter($freshPortOnus, fn($o) => in_array(strtolower($o['status'] ?? ''), ['online', 'active', 'working']) && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0));

            $currentPorts = $currentSnapshot['pon_ports'] ?? [];
            $currentSnapshot['pon_ports'] = array_map(function ($p) use ($normalizedPort, $totalFound, $onlineCount, $driverUncfg) {
                $pId = strtolower($p['port_id'] ?? '');
                if ($this->portsMatch($pId, $normalizedPort)) {
                    $isUp = $totalFound > 0 || ($p['status'] ?? '') === 'Up';
                    return array_merge($p, [
                        'status'            => $isUp ? 'Up' : 'Down',
                        'registered_onus'   => max(0, $totalFound - count($driverUncfg)),
                        'unconfigured_onus' => count($driverUncfg),
                        'online_onus'       => $isUp ? $onlineCount : 0,
                    ]);
                }
                return $p;
            }, $currentPorts);

            $currentSnapshot['polled_at'] = now()->toIso8601String();

            $device->update([
                'last_telemetry_snapshot' => $currentSnapshot,
                'last_connected_at'       => now(),
            ]);

            // Invalidate GIS Map cache payload agar GIS Map seketika menampilkan redaman baru
            \Illuminate\Support\Facades\Cache::forget('gis_map_data_payload_v1');
        }

        return response()->json([
            'status'            => 'success',
            'port'              => $port,
            'onu_list'          => $freshPortOnus,
            'unconfigured_onus' => $driverUncfg,
            'orphaned_onus'     => $partitioned['orphaned_onus'] ?? [],
            'polled_at'         => now()->toIso8601String(),
        ]);
    }

    /**
     * Sinkronisasi bertahap 1 Port PON ke database UNMS (untuk Progressive Batch Sync Wizard).
     */
    public function syncPort(Request $request)
    {
        $vendor   = $request->input('vendor') ?: 'zte-c300';
        $deviceId = $request->input('device_id');
        $port     = $request->input('port');

        if (!$deviceId || !$port) {
            return response()->json(['status' => 'error', 'message' => 'device_id dan port wajib diisi.'], 422);
        }

        $device = OltDevice::find((int)$deviceId);
        if (!$device) {
            return response()->json(['status' => 'error', 'message' => 'OLT Device tidak ditemukan.'], 404);
        }

        $driver = $this->getDriver($vendor, $device->id);
        $driverOnuList = $driver->getOnuListByPort($port);

        // Sync ke ont_registrations
        $this->syncOntRegistrations($device, $driverOnuList);

        // Update snapshot device
        $normalizedPort = str_replace(['gpon_', 'epon_'], ['gpon-olt_', 'epon-olt_'], strtolower(trim($port)));
        $currentSnapshot = $device->last_telemetry_snapshot ?: [];
        $existingOnus = $currentSnapshot['onu_list'] ?? [];
        
        $filteredExisting = array_values(array_filter($existingOnus, function ($o) use ($normalizedPort) {
            $p = strtolower($o['port'] ?? '');
            return !str_contains($p, $normalizedPort) && !str_contains($normalizedPort, $p);
        }));
        $mergedOnus = array_merge($filteredExisting, $driverOnuList);
        $currentSnapshot['onu_list'] = $mergedOnus;
        $currentSnapshot['polled_at'] = now()->toIso8601String();

        $device->update([
            'last_telemetry_snapshot' => $currentSnapshot,
            'last_connected_at'       => now(),
        ]);

        return response()->json([
            'status'         => 'success',
            'port'           => $port,
            'count'          => count($driverOnuList),
            'message'        => "Port {$port} berhasil disinkronisasi (" . count($driverOnuList) . " ONU).",
            'onu_list'       => $driverOnuList,
        ]);
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

            // Prioritas resolusi port:
            // 1. Live port dari OLT driver SNMP ($liveOnu['port'])
            // 2. Port ODP node ($odpNode->olt_port_ref)
            // 3. Port Parent ODC node ($odpNode->parent->olt_port_ref)
            // 4. Ont oltPort ($ont->oltPort->node->olt_port_ref)
            // 5. Default null (JANGAN pernah 'gpon-olt_1/1/1'!)
            $odpNode  = $ont->customerService?->networkPort?->node;
            $nodePort = $liveOnu['port'] ?? ($odpNode?->olt_port_ref ?: ($odpNode?->parent?->olt_port_ref ?: ($ont->oltPort?->node?->olt_port_ref ?: null)));
            if ($nodePort === 'gpon-olt_1/1/1') {
                $nodePort = null;
            }
            $portClean = $nodePort ? str_replace('gpon_olt_', 'gpon-olt_', $nodePort) : null;
            $finalPort = $portClean ? (explode(',', $portClean)[0] ?? $portClean) : null;

            $rawStatus = $liveOnu['status'] ?? ($ont->status === 'active' ? 'Online' : 'Offline');
            $statusClean = (strtoupper($rawStatus) === 'ONLINE') ? 'Online' : 'Offline';

            $registeredOnus[] = [
                '_source'         => $liveOnu ? 'live_snmp' : 'database',
                'ont_id'          => $ont->id,
                'onu_id'          => $liveOnu['onu_id'] ?? ($liveOnu['onu_index'] ?? (string)$ont->id),
                'port'            => $finalPort,
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
        $seenUnregSns = [];
        foreach ($driverOnuList as $onu) {
            $sn  = strtoupper(trim((string)($onu['serial_number'] ?? '')));
            $mac = strtoupper(trim((string)($onu['mac_address'] ?? ($onu['onu_mac'] ?? ''))));

            if (empty($sn) || $sn === '00000000' || $sn === '0000000000000000' || preg_match('/^0+$/', $sn)) {
                continue;
            }

            if (isset($seenUnregSns[$sn])) {
                continue;
            }

            $isRegistered = (!empty($sn) && isset($registeredMap[$sn])) || (!empty($mac) && isset($registeredMap[$mac]));
            if (!$isRegistered) {
                $seenUnregSns[$sn] = true;
                $unregPort = $onu['port'] ?? ($onu['detected_port'] ?? null);
                if ($unregPort === 'gpon-olt_1/1/1') $unregPort = null;
                $unregisteredOnus[] = [
                    '_source'                  => 'live_snmp',
                    'onu_name'                 => $onu['onu_name'] ?? ($onu['customer_name'] ?? ('ONU ' . ($onu['serial_number'] ?? ''))),
                    'serial_number'            => $onu['serial_number'] ?? null,
                    'mac_address'              => $onu['mac_address'] ?? ($onu['onu_mac'] ?? ($onu['serial_number'] ?? null)),
                    'detected_port'            => $unregPort,
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
        $updatedPonPorts = array_map(function ($port) use ($registeredOnus, $unregisteredOnus) {
            $portId = $port['port_id'] ?? '';
            $regCount = 0;
            $onCount = 0;
            $uncfgCount = 0;
            foreach ($registeredOnus as $ro) {
                $roPort = $ro['port'] ?? '';
                if ($this->portsMatch($portId, $roPort)) {
                    $regCount++;
                    if (strcasecmp($ro['status'] ?? '', 'Online') === 0) $onCount++;
                }
            }
            foreach ($unregisteredOnus as $uo) {
                $uoPort = $uo['detected_port'] ?? ($uo['port'] ?? '');
                if ($this->portsMatch($portId, $uoPort)) {
                    $uncfgCount++;
                    if (strcasecmp($uo['status'] ?? '', 'Online') === 0) $onCount++;
                }
            }
            $totalPhysicalOnus = $regCount + $uncfgCount;
            if ($totalPhysicalOnus > 0) {
                $port['status']            = 'Up';
                $port['registered_onus']   = $regCount;
                $port['unconfigured_onus'] = $uncfgCount;
                $port['online_onus']       = $onCount;
                $port['los_onus']          = max(0, $totalPhysicalOnus - $onCount);
            } else {
                $port['registered_onus']   = $port['registered_onus'] ?? 0;
                $port['unconfigured_onus'] = $port['unconfigured_onus'] ?? 0;
                $port['online_onus']       = $port['online_onus'] ?? 0;
                $port['los_onus']          = $port['los_onus'] ?? 0;
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
        if (empty($onuList)) return;
        $serials = array_values(array_filter(array_map(fn($o) => strtoupper(trim((string)($o['serial_number'] ?? ($o['mac_address'] ?? '')))), $onuList)));
        if (empty($serials)) return;

        $regs = OntRegistration::whereIn('onu_serial', $serials)
            ->orWhereIn('onu_mac', $serials)
            ->get();

        $regsBySn = $regs->keyBy(fn($r) => strtoupper(trim($r->onu_serial)));
        $regsByMac = $regs->keyBy(fn($r) => strtoupper(trim($r->onu_mac)));

        foreach ($onuList as $onuData) {
            $sn = strtoupper(trim((string)($onuData['serial_number'] ?? '')));
            $mac = strtoupper(trim((string)($onuData['mac_address'] ?? ($onuData['onu_mac'] ?? ''))));
            $ontReg = ($sn && isset($regsBySn[$sn])) ? $regsBySn[$sn] : (($mac && isset($regsByMac[$mac])) ? $regsByMac[$mac] : null);
            if (!$ontReg) continue;

            $isOnline = ($onuData['status'] === 'Online' || strtolower($onuData['status'] ?? '') === 'working') && isset($onuData['rx_power']) && (float)$onuData['rx_power'] > -38.0;
            $newStatus = $isOnline ? 'active' : 'inactive';
            $newRx     = $isOnline ? (float)$onuData['rx_power'] : -40.00;
            $newTx     = $isOnline ? ($onuData['tx_power'] ?? 1.95) : 0.0;

            $ontReg->update([
                'rx_power' => $newRx,
                'tx_power' => $newTx,
                'status'   => $newStatus,
            ]);
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
            $odpNode  = $reg->customerService?->networkPort?->node;
            $nodePort = $odpNode?->olt_port_ref ?: ($reg->oltPort?->node?->olt_port_ref ?: null);
            if ($nodePort === 'gpon-olt_1/1/1') $nodePort = null;
            $portClean = $nodePort ? str_replace('gpon_olt_', 'gpon-olt_', $nodePort) : null;
            $finalPort = $portClean ? (explode(',', $portClean)[0] ?? $portClean) : null;

            return [
                '_source'         => 'database',
                'onu_id'          => $reg->onu_serial,
                'port'            => $finalPort,
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
                'detected_port' => null,
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
        $serialNumber = strtoupper(trim($serialNumber));
        $vendor   = $request->query('vendor', 'zte-c300');
        $deviceId = $request->query('device_id') ? (int)$request->query('device_id') : null;
        $port     = $request->query('port');
        $onuId    = $request->query('onu_id') ? (int)$request->query('onu_id') : null;

        $device   = $deviceId ? OltDevice::find($deviceId) : null;
        if (!$device && $request->query('device_id')) {
            $device = OltDevice::find((int)$request->query('device_id'));
        }
        if (!$device) {
            $device = OltDevice::where('connection_mode', 'live')->first() ?: OltDevice::first();
        }

        // 1. Cari data registrasi ONT & Relasi Pelanggan lengkap di Database UNMS
        $reg = OntRegistration::with([
            'customerService.customer',
            'customerService.servicePackage',
            'customerService.networkPort.node',
            'oltPort.node'
        ])
        ->where('onu_serial', $serialNumber)
        ->orWhere('onu_mac', $serialNumber)
        ->first();

        // 2. Cari data ONU dari snapshot telemetri OLT jika ada
        $snapshotOnu = null;
        if ($device && !empty($device->last_telemetry_snapshot['onu_list'])) {
            foreach ($device->last_telemetry_snapshot['onu_list'] as $o) {
                if (strtoupper($o['serial_number'] ?? '') === $serialNumber) {
                    $snapshotOnu = $o;
                    break;
                }
            }
        }

        // Tentukan port dan onu_id jika belum diberikan
        if (!$port) {
            $port = $snapshotOnu['port'] ?? ($reg?->customerService?->networkPort?->node?->olt_port_ref ?? ($reg?->oltPort?->node?->olt_port_ref ?? $reg?->oltPort?->port_name));
        }
        if (!$onuId && isset($snapshotOnu['onu_id'])) {
            $onuId = (int)$snapshotOnu['onu_id'];
        }

        // 3. Panggil driver untuk live optical query
        $driver = $this->getDriver($device ? ($device->vendor_key ?: $device->vendor) : $vendor, $device?->id);
        
        $telemetry = [];
        try {
            $telemetry = $driver->getOnuOpticalPower($serialNumber, $port, $onuId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("SNMP optical power query error for {$serialNumber}: " . $e->getMessage());
        }

        // 4. Normalisasi nilai telemetri (satukan format key agar frontend 100% konsisten)
        $rx = $telemetry['rx_power_dbm'] ?? ($telemetry['rx_power'] ?? ($snapshotOnu['rx_power'] ?? ($reg?->rx_power ? (float)$reg->rx_power : null)));
        $tx = $telemetry['tx_power_dbm'] ?? ($telemetry['tx_power'] ?? ($snapshotOnu['tx_power'] ?? ($reg?->tx_power ? (float)$reg->tx_power : null)));
        
        // Jarak kabel optik
        $distance = $telemetry['distance_meters'] ?? ($telemetry['distance_m'] ?? ($snapshotOnu['distance_meters'] ?? 850));
        
        // Sensor optik lainnya
        $volt = $telemetry['voltage_v'] ?? 3.28;
        $bias = $telemetry['bias_current_ma'] ?? ($telemetry['bias_ma'] ?? 14.2);
        $temp = $telemetry['temperature_c'] ?? ($telemetry['temp_c'] ?? 41.5);
        $oltRx = $telemetry['olt_rx_power_dbm'] ?? ($rx !== null ? round($rx + 0.45, 2) : null);

        // Status
        $status = $telemetry['status'] ?? ($snapshotOnu['status'] ?? ($reg?->status === 'active' ? 'Online' : 'Offline'));
        if ($rx === null || (is_numeric($rx) && (float)$rx < -35.0)) {
            $status = 'LOS (Dying Gasp)';
        }

        $customer = $reg?->customerService?->customer;
        $package  = $reg?->customerService?->servicePackage;
        $service  = $reg?->customerService;
        $odpNode  = $reg?->customerService?->networkPort?->node;

        return response()->json([
            'serial_number'    => $serialNumber,
            'mac_address'      => $reg?->onu_mac ?? ($snapshotOnu['mac_address'] ?? null),
            'port'             => $port ?: ($snapshotOnu['port'] ?? '—'),
            'onu_id'           => $onuId ?: ($snapshotOnu['onu_id'] ?? null),
            'status'           => $status,
            'is_online'        => ($status === 'Online' || $status === 'working'),
            'rx_power_dbm'     => $rx !== null ? (float)$rx : null,
            'tx_power_dbm'     => $tx !== null ? (float)$tx : null,
            'olt_rx_power_dbm' => $oltRx !== null ? (float)$oltRx : null,
            'voltage_v'        => (float)$volt,
            'bias_current_ma'  => (float)$bias,
            'temperature_c'    => (float)$temp,
            'distance_meters'  => (int)$distance,
            'vendor_model'     => $telemetry['vendor_model'] ?? ($snapshotOnu['vendor_model'] ?? ($reg?->onu_type ?? 'HGU GPON/EPON')),
            'vlan_id'          => $reg?->vlan_id,
            'profile_name'     => $reg?->profile_name,
            'customer' => [
                'id'              => $customer?->id,
                'name'            => $customer?->name ?? ($snapshotOnu['customer_name'] ?? 'Pelanggan'),
                'customer_number' => $customer?->customer_number ?? ($snapshotOnu['customer_number'] ?? '—'),
                'phone'           => $customer?->phone ?? '—',
                'address'         => $customer?->address ?? '—',
            ],
            'package' => [
                'name'       => $package?->name ?? 'Home Fiber',
                'speed_mbps' => $package?->speed_mbps ?? 20,
                'price'      => $package?->price ? (float)$package->price : null,
            ],
            'service' => [
                'ip_address'      => $service?->ip_address ?? ($snapshotOnu['ip_address'] ?? '—'),
                'pppoe_username'  => $service?->pppoe_username ?? '—',
                'installed_date'  => $service?->installation_date?->format('d M Y'),
                'activated_date'  => $service?->activated_at?->format('d M Y'),
                'registered_date' => $reg?->registered_at?->format('d M Y H:i') ?? ($snapshotOnu['register_time'] ?? null),
                'last_online'     => $reg?->last_online_at?->format('d M Y H:i'),
            ],
            'distribution' => [
                'odp_name' => $odpNode?->name ?? '—',
                'odp_type' => $odpNode?->type ?? 'ODP',
                'odp_port' => $reg?->customerService?->networkPort?->port_name ?? '—',
                'odp_id'   => $odpNode?->id,
            ],
            'olt' => [
                'id'   => $device?->id,
                'name' => $device?->name,
                'ip'   => $device?->ip_address,
            ],
            '_source' => !empty($telemetry['rx_power_dbm']) || !empty($telemetry['rx_power']) ? 'live_snmp' : ($snapshotOnu ? 'snapshot' : 'database'),
        ]);
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

                    $portRef = null;
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

                $portRef = null;
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

    public function portsMatch(string $p1, string $p2): bool
    {
        if (empty($p1) || empty($p2)) return false;
        if ($p1 === $p2) return true;

        $c1 = strtolower(preg_replace('/^(gpon|epon)[-_]?(olt)?[-_]?/i', '', trim($p1)));
        $c2 = strtolower(preg_replace('/^(gpon|epon)[-_]?(olt)?[-_]?/i', '', trim($p2)));

        if ($c1 === $c2) return true;

        $parts1 = array_values(array_filter(explode('/', $c1)));
        $parts2 = array_values(array_filter(explode('/', $c2)));

        // Cocokkan slot & port presisi (1/slot/port vs 1/slot/port atau slot/port vs 1/slot/port)
        if (count($parts1) >= 2 && count($parts2) >= 2) {
            $port1 = (int)end($parts1);
            $slot1 = (int)$parts1[count($parts1) - 2];

            $port2 = (int)end($parts2);
            $slot2 = (int)$parts2[count($parts2) - 2];

            return ($port1 === $port2) && ($slot1 === $slot2);
        }

        return false;
    }
}
