<?php

namespace App\Services\Olt;

use App\Models\OltDevice;

/**
 * ConnectionManager — Orchestrates OLT connection testing and mode selection.
 *
 * Deployment Modes:
 *   direct  → Server se-jaringan dengan OLT (internal ISP atau via VPN)
 *   vpn     → Server terhubung ke OLT via VPN (treated same as direct)
 *   probe   → Server di cloud, OLT dijembatani via NMS Probe Agent
 *
 * SNMP Versions:
 *   v2c → community string (public or custom)
 *   v3  → username + auth protocol/password + priv protocol/password
 */
class ConnectionManager
{
    /**
     * Run a full connectivity test on an OLT device.
     * Returns structured result for API response.
     */
    public static function testDevice(OltDevice $device): array
    {
        $result = [
            'device_id'       => $device->id,
            'device_name'     => $device->name,
            'ip_address'      => $device->ip_address,
            'deployment_mode' => $device->deployment_mode,
            'snmp_version'    => $device->snmp_version,
            'snmp_ext_loaded' => SnmpConnector::isAvailable(),
            'timestamp'       => now()->toIso8601String(),

            // Test results
            'ping'            => ['success' => false, 'latency_ms' => -1],
            'snmp'            => ['success' => false],
            'connection_mode' => 'simulation',
            'ready_for_live'  => false,
            'message'         => '',
            'recommendations' => [],
        ];

        // ── Probe Agent Mode ──────────────────────────────────────────────
        if ($device->deployment_mode === 'probe') {
            if (!$device->probe_agent_url) {
                $result['message'] = 'Probe Agent URL belum dikonfigurasi.';
                $result['recommendations'][] = 'Masukkan URL NMS Probe Agent yang terinstall di jaringan ISP Anda.';
                return $result;
            }

            $probeResult = self::testProbeAgent($device);
            $result['probe'] = $probeResult;
            $result['connection_mode'] = $probeResult['success'] ? 'live' : 'simulation';
            $result['ready_for_live'] = $probeResult['success'];
            $result['message'] = $probeResult['success']
                ? '✅ Probe Agent terhubung. Data real dari OLT tersedia.'
                : '⚠️ Probe Agent tidak merespon. Menggunakan mode simulasi.';
            return $result;
        }

        // ── Direct / VPN Mode ─────────────────────────────────────────────
        // Step 1: Ping test
        $connector = self::buildConnector($device);
        $pingMs = $connector->pingTest();
        $result['ping'] = [
            'success'    => $pingMs >= 0,
            'latency_ms' => $pingMs >= 0 ? $pingMs : null,
            'error'      => $pingMs < 0 ? 'Host tidak merespon ping (mungkin ICMP diblokir)' : null,
        ];

        // Step 2: SNMP test
        $snmpResult = $connector->snmpTest();
        $result['snmp'] = $snmpResult;

        // Step 3: Determine overall connection mode
        if ($snmpResult['success']) {
            $result['connection_mode'] = 'live';
            $result['ready_for_live']  = true;
            $result['message']         = '✅ Koneksi SNMP berhasil! Sistem akan menggunakan data real dari OLT.';
        } elseif ($pingMs >= 0 && !SnmpConnector::isAvailable()) {
            $result['connection_mode'] = 'simulation';
            $result['message']         = '⚠️ OLT dapat di-ping namun SNMP extension PHP belum aktif di server.';
            $result['recommendations'][] = 'Aktifkan extension PHP SNMP: tambahkan "extension=snmp" di php.ini';
            $result['recommendations'][] = 'Lokasi php.ini: jalankan "php --ini" di server';
        } elseif ($pingMs >= 0) {
            $result['connection_mode'] = 'simulation';
            $result['message']         = '⚠️ OLT dapat di-ping tapi SNMP tidak merespon. Periksa community string dan firewall port 161/UDP.';
            $result['recommendations'][] = 'Pastikan SNMP service aktif di OLT';
            $result['recommendations'][] = 'Cek firewall: port 161/UDP harus terbuka dari server ke OLT';
            $result['recommendations'][] = 'Verifikasi community string yang digunakan';
        } else {
            $result['connection_mode'] = 'simulation';
            $result['message']         = '❌ OLT tidak dapat dijangkau. Menggunakan mode simulasi.';
            $result['recommendations'][] = 'Pastikan IP Address OLT benar';
            $result['recommendations'][] = 'Untuk deployment external tanpa VPN, gunakan mode Probe Agent';
            $result['recommendations'][] = 'Untuk deployment via VPN, pastikan VPN aktif dan terhubung';
        }

        return $result;
    }

    /**
     * Test connection to NMS Probe Agent (for external/cloud deployment).
     */
    private static function testProbeAgent(OltDevice $device): array
    {
        if (!$device->probe_agent_url) {
            return ['success' => false, 'error' => 'Probe Agent URL not set'];
        }

        try {
            $url = rtrim($device->probe_agent_url, '/') . '/api/health';
            $token = $device->probe_agent_token;

            $context = stream_context_create([
                'http' => [
                    'method'  => 'GET',
                    'header'  => "Authorization: Bearer {$token}\r\nContent-Type: application/json\r\n",
                    'timeout' => 5,
                ],
                'ssl' => ['verify_peer' => false],
            ]);

            $response = @file_get_contents($url, false, $context);
            if ($response !== false) {
                $data = json_decode($response, true);
                return [
                    'success'       => true,
                    'agent_version' => $data['version'] ?? 'unknown',
                    'agent_uptime'  => $data['uptime'] ?? null,
                ];
            }

            return ['success' => false, 'error' => 'No response from Probe Agent'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Build an SnmpConnector from OltDevice config.
     */
    public static function buildConnector(OltDevice $device): SnmpConnector
    {
        return new SnmpConnector(
            ip: $device->ip_address,
            snmpVersion: $device->snmp_version ?? 'v2c',
            community: $device->getEffectiveCommunity(),
            port: $device->snmp_port ?? 161,
            timeout: $device->snmp_timeout ?? 5,
            retries: $device->snmp_retries ?? 2,
            v3Username: $device->snmp_v3_username,
            v3AuthProtocol: $device->snmp_v3_auth_protocol,
            v3AuthPassword: $device->snmp_v3_auth_password
                ? decrypt($device->snmp_v3_auth_password) : null,
            v3PrivProtocol: $device->snmp_v3_priv_protocol,
            v3PrivPassword: $device->snmp_v3_priv_password
                ? decrypt($device->snmp_v3_priv_password) : null,
        );
    }

    /**
     * Returns system-level connection capabilities summary.
     */
    public static function getSystemCapabilities(): array
    {
        return [
            'snmp_extension'   => SnmpConnector::isAvailable(),
            'snmp_v2c_ready'   => SnmpConnector::isAvailable(),
            'snmp_v3_ready'    => SnmpConnector::isAvailable() && function_exists('snmp3_get'),
            'probe_agent_ready' => true, // HTTP always available
            'cli_telnet_ready' => function_exists('fsockopen'),
            'php_version'      => PHP_VERSION,
        ];
    }
}
