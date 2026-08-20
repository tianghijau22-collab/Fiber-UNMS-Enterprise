<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\OltDevice;
use App\Models\NetworkNode;
use App\Models\BtsSite;
use App\Models\Ticket;
use App\Services\MikrotikApiService;
use App\Services\Olt\SnmpConnector;
use App\Http\Controllers\OltController;

class LiveMonitorController extends Controller
{
    /**
     * GET /api/monitoring/router/live-metrics
     * Polling telemetri CPU, RAM, Uptime, Interface Traffic & PPPoE MikroTik
     */
    public function getRouterMetrics(Request $request)
    {
        $ip = $request->input('ip', '192.168.88.1');
        $user = $request->input('user', 'admin');
        $pass = $request->input('password', '');
        $port = (int) $request->input('port', 8728);
        $wanInterface = $request->input('wan_interface', 'ether1');

        $api = new MikrotikApiService($ip, $user, $pass, $port, false, 2);
        $connected = $api->connect();

        if ($connected) {
            $sys = $api->getSystemResource();
            $traffic = $api->monitorInterfaceTraffic($wanInterface);
            $interfaces = $api->getInterfaces();
            $pppoe = $api->getActivePppoeSessions();
            $dhcp = $api->getDhcpLeases();
            $api->disconnect();

            return response()->json([
                'success'    => true,
                'mode'       => 'live_api',
                'connected'  => true,
                'target_ip'  => $ip,
                'data'       => [
                    'system'     => $sys,
                    'traffic'    => $traffic,
                    'interfaces' => $interfaces,
                    'pppoe_active_count' => count($pppoe),
                    'dhcp_leases_count'  => count($dhcp),
                    'pppoe_sessions'     => array_slice($pppoe, 0, 10),
                    'timestamp'          => now()->toIso8601String(),
                ]
            ]);
        }

        // Mode fallback jika router belum terhubung ke API socket
        return response()->json([
            'success'    => false,
            'mode'       => 'offline_or_simulation',
            'connected'  => false,
            'target_ip'  => $ip,
            'message'    => "Router di {$ip}:{$port} belum merespon API. Pastikan RouterOS API (Port 8728) aktif di menu /ip service.",
            'data'       => [
                'system' => [
                    'board_name'      => 'MikroTik hAP lite',
                    'version'         => 'RouterOS v6.49.10',
                    'uptime'          => 'Standby (Menunggu Koneksi)',
                    'cpu_load'        => 0,
                    'free_memory_mb'  => 0,
                    'total_memory_mb' => 32,
                    'architecture'    => 'smips',
                ],
                'traffic' => [
                    'interface' => $wanInterface,
                    'rx_bps'    => 0,
                    'tx_bps'    => 0,
                    'rx_mbps'   => 0,
                    'tx_mbps'   => 0,
                ],
                'interfaces' => [],
                'pppoe_active_count' => 0,
                'dhcp_leases_count'  => 0,
                'pppoe_sessions'     => [],
                'timestamp'          => now()->toIso8601String(),
            ]
        ]);
    }

    /**
     * GET /api/monitoring/olt/{id}/live-telemetry
     * Polling telemetri OLT fisik via pure SNMP UDP Port 161
     */
    public function getOltTelemetry(Request $request, $id)
    {
        $olt = OltDevice::find($id);
        if (!$olt) {
            return response()->json([
                'success' => false,
                'message' => 'Perangkat OLT tidak ditemukan di database.',
            ], 404);
        }

        $connector = new SnmpConnector(
            ip: $olt->ip_address,
            snmpVersion: $olt->snmp_version ?? 'v2c',
            community: $olt->snmp_community ?? 'public',
            timeout: (int) ($olt->snmp_timeout ?? 2),
            retries: 0
        );

        $pingMs = $connector->pingTest();
        $isLive = $pingMs >= 0;

        if ($isLive) {
            // Gunakan driver vendor OLT terkait
            try {
                $oltCtrl = new OltController();
                $driver = $oltCtrl->getDriver($olt->vendor, $olt->ip_address, $olt->snmp_community ?? 'public');
                $devInfo = $driver->getDeviceInfo();
                $ponPorts = $driver->getPonPorts();
                $onus = $driver->getOnuList();

                $olt->update([
                    'status' => 'online',
                    'last_sync_at' => now(),
                ]);

                return response()->json([
                    'success'    => true,
                    'is_live'    => true,
                    'latency_ms' => $pingMs,
                    'olt'        => $olt,
                    'telemetry'  => [
                        'device_info' => $devInfo,
                        'pon_ports'   => $ponPorts,
                        'onu_count'   => count($onus),
                        'onus'        => $onus,
                        'timestamp'   => now()->toIso8601String(),
                    ]
                ]);
            } catch (\Exception $e) {
                // Fallback graceful
            }
        }

        return response()->json([
            'success'    => false,
            'is_live'    => false,
            'latency_ms' => null,
            'olt'        => $olt,
            'message'    => "OLT {$olt->name} ({$olt->ip_address}) tidak merespon query SNMP.",
            'telemetry'  => [
                'device_info' => [
                    'vendor'      => $olt->vendor,
                    'model'       => $olt->model ?? 'HSGQ-E04',
                    'uptime'      => 'Offline',
                    'cpu_usage'   => 0,
                    'memory_usage'=> 0,
                    'temperature' => 0,
                ],
                'pon_ports'   => [],
                'onu_count'   => 0,
                'onus'        => [],
                'timestamp'   => now()->toIso8601String(),
            ]
        ]);
    }

    /**
     * POST /api/monitoring/ping-sweep
     * Uji jangkauan (latency & link health) seluruh node jaringan secara serentak
     */
    public function pingSweep(Request $request)
    {
        $nodes = NetworkNode::all(['id', 'name', 'code', 'node_type', 'latitude', 'longitude', 'status']);
        $olts = OltDevice::all(['id', 'name', 'code', 'ip_address', 'status']);
        $bts = BtsSite::all(['id', 'name', 'code', 'status', 'latitude', 'longitude']);

        $results = [];

        // Ping OLT Devices
        foreach ($olts as $o) {
            $conn = new SnmpConnector(ip: $o->ip_address, timeout: 1);
            $ms = $conn->pingTest();
            $results[] = [
                'type'       => 'OLT',
                'id'         => $o->id,
                'name'       => $o->name,
                'code'       => $o->code,
                'target'     => $o->ip_address,
                'online'     => $ms >= 0,
                'latency_ms' => $ms >= 0 ? $ms : null,
            ];
        }

        return response()->json([
            'success'   => true,
            'timestamp' => now()->toIso8601String(),
            'total_tested' => count($results),
            'results'   => $results,
        ]);
    }
}
