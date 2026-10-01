<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use SNMP;

/**
 * FastOpticalProbeService
 * 
 * High-performance, sub-50ms reactive optical probing engine.
 * Eliminates passive waiting on SNMP traps by actively probing OLT interfaces,
 * ODP clusters, and hardware SFP link statuses in single-packet multi-OID queries.
 */
class FastOpticalProbeService
{
    /**
     * Hitung ifIndex standar ZTE GPON dari string port (misal gpon-olt_1/4/1 atau 1/4/1)
     */
    public static function calculateIfIndex(string $standardPort): int
    {
        $clean = str_replace(['gpon-olt_', 'epon-olt_', 'gpon_', 'epon_'], '', strtolower(trim($standardPort)));
        $parts = explode('/', $clean);
        $slotNum = (int)($parts[1] ?? 1);
        $portNum = (int)($parts[2] ?? 1);

        return (0x10 << 24) | ($slotNum << 16) | ($portNum << 8);
    }

    /**
     * Dapatkan instance \SNMP native PHP dengan konfigurasi timeout cepat (~1.5s, 1 retry)
     */
    public static function getSnmpSession(?OltDevice $olt, int $timeoutMs = 1500, int $retries = 1): ?SNMP
    {
        if (!$olt || $olt->connection_mode !== 'live' || empty($olt->ip_address)) {
            return null;
        }

        if (!extension_loaded('snmp')) {
            return null;
        }

        try {
            $community = $olt->getEffectiveCommunity() ?: 'public';
            $port = $olt->snmp_port ?: 161;
            $timeoutMicro = $timeoutMs * 1000;

            $version = strtolower((string)($olt->snmp_version ?? 'v2c')) === 'v3' ? SNMP::VERSION_3 : SNMP::VERSION_2C;
            $target = "{$olt->ip_address}:{$port}";

            $session = new SNMP($version, $target, $community, $timeoutMicro, $retries);
            $session->oid_output_format = SNMP_OID_OUTPUT_NUMERIC;
            $session->quick_print = 1;
            $session->valueretrieval = SNMP_VALUE_PLAIN;

            return $session;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Eksekusi SNMP Bulk Walk berkecepatan tinggi menggunakan CLI snmpbulkwalk (dengan fallback ke PHP SNMP session)
     */
    public static function executeSnmpBulkWalk(OltDevice $olt, string $oid, int $maxRepetitions = 30, int $timeoutSec = 10): array
    {
        $ip = $olt->ip_address;
        $community = $olt->getEffectiveCommunity() ?: 'public';
        $port = $olt->snmp_port ?: 161;

        // Cek apakah snmpbulkwalk CLI tersedia di server Linux
        static $hasBulkWalk = null;
        if ($hasBulkWalk === null) {
            $hasBulkWalk = (PHP_OS_FAMILY !== 'Windows' && !empty(shell_exec('which snmpbulkwalk 2>/dev/null')));
        }

        if ($hasBulkWalk) {
            $cmd = "snmpbulkwalk -v2c -c " . escapeshellarg($community) . " -t {$timeoutSec} -r 1 -Cr{$maxRepetitions} -On " . escapeshellarg("{$ip}:{$port}") . " " . escapeshellarg($oid) . " 2>/dev/null";
            $output = @shell_exec($cmd);
            if ($output) {
                $lines = explode("\n", trim($output));
                $results = [];
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (!$line || str_contains($line, 'No Such Object') || str_contains($line, 'No Such Instance')) {
                        continue;
                    }
                    $parts = explode('=', $line, 2);
                    if (count($parts) === 2) {
                        $resOid = ltrim(trim($parts[0]), '.');
                        $resVal = trim($parts[1]);
                        $results[$resOid] = $resVal;
                    }
                }
                if (!empty($results)) {
                    return $results;
                }
            }
        }

        // Fallback ke PHP SNMP extension
        $session = self::getSnmpSession($olt, $timeoutSec * 1000);
        if ($session) {
            try {
                return @$session->walk($oid) ?: [];
            } catch (\Throwable $e) {
                return [];
            }
        }

        return [];
    }

    /**
     * Eksekusi SNMP Bulk Walk secara PARALEL (Simultan) untuk beberapa OID sekaligus
     * Mengurangi waktu total dari T1 + T2 menjadi MAX(T1, T2).
     */
    public static function executeParallelSnmpBulkWalk(OltDevice $olt, array $oids, int $maxRepetitions = 50, int $timeoutSec = 15): array
    {
        $ip = $olt->ip_address;
        $community = $olt->getEffectiveCommunity() ?: 'public';
        $port = $olt->snmp_port ?: 161;

        // Cek apakah snmpbulkwalk CLI tersedia di server Linux
        static $hasBulkWalk = null;
        if ($hasBulkWalk === null) {
            $hasBulkWalk = (PHP_OS_FAMILY !== 'Windows' && !empty(shell_exec('which snmpbulkwalk 2>/dev/null')));
        }

        if (!$hasBulkWalk) {
            $results = [];
            foreach ($oids as $k => $oid) {
                $results[$k] = self::executeSnmpBulkWalk($olt, $oid, $maxRepetitions, $timeoutSec);
            }
            return $results;
        }

        $processes = [];
        $pipesList = [];

        foreach ($oids as $key => $oid) {
            $cmd = "snmpbulkwalk -v2c -c " . escapeshellarg($community) . " -t {$timeoutSec} -r 1 -Cr{$maxRepetitions} -On " . escapeshellarg("{$ip}:{$port}") . " " . escapeshellarg($oid) . " 2>/dev/null";
            $descriptors = [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ];
            $proc = @proc_open($cmd, $descriptors, $pipes);
            if (is_resource($proc)) {
                @fclose($pipes[0]);
                @fclose($pipes[2]);
                $processes[$key] = $proc;
                $pipesList[$key] = $pipes[1];
            }
        }

        $results = [];
        foreach ($processes as $key => $proc) {
            $output = @stream_get_contents($pipesList[$key]);
            @fclose($pipesList[$key]);
            @proc_close($proc);

            $parsed = [];
            if ($output) {
                $lines = explode("\n", trim($output));
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (!$line || str_contains($line, 'No Such Object') || str_contains($line, 'No Such Instance')) {
                        continue;
                    }
                    $parts = explode('=', $line, 2);
                    if (count($parts) === 2) {
                        $resOid = ltrim(trim($parts[0]), '.');
                        $resVal = trim($parts[1]);
                        $parsed[$resOid] = $resVal;
                    }
                }
            }
            $results[$key] = $parsed;
        }

        // Fallback jika ada OID yang kosong
        foreach ($oids as $key => $oid) {
            if (!isset($results[$key])) {
                $results[$key] = self::executeSnmpBulkWalk($olt, $oid, $maxRepetitions, $timeoutSec);
            }
        }

        return $results;
    }

    /**
     * Parse raw SNMP serial number string from ZTE OLT to clean format (e.g. ZTEGC123456)
     */
    public static function parseZteSerialNumber(string $raw): string
    {
        // 1. Cek jika biner murni 8-byte (JANGAN di-trim karena byte terakhir bisa berupa 0x0A \n atau 0x20 spasi!)
        if (strlen($raw) === 8) {
            $fullHex = bin2hex($raw);
            $vendor = @hex2bin(substr($fullHex, 0, 8));
            if ($vendor && ctype_print($vendor)) {
                return strtoupper($vendor) . strtoupper(substr($fullHex, 8));
            }
            return strtoupper($fullHex);
        }

        $cleanRaw = trim($raw);
        $val = trim(str_replace(['"', 'INTEGER:', 'Hex-STRING:', 'STRING:'], '', $cleanRaw));
        $hex = str_replace(' ', '', $val);
        if (strlen($hex) >= 16 && ctype_xdigit($hex)) {
            $vendor = @hex2bin(substr($hex, 0, 8));
            if ($vendor && ctype_print($vendor)) {
                return strtoupper($vendor) . strtoupper(substr($hex, 8));
            }
            return strtoupper($hex);
        }
        if (str_starts_with($val, 'ZTEG') && strlen($val) === 12) {
            return strtoupper($val);
        }
        if (str_starts_with($val, 'ZTEG') && strlen($val) >= 8) {
            $vendor = substr($val, 0, 4);
            $serial = bin2hex(substr($val, 4));
            return strtoupper($vendor . $serial);
        }
        return strtoupper($val);
    }

    /**
     * 🚀 PILAR 1: Event-Driven Fast Probe ODP (~30-50 milidetik)
     * Menembakkan multi-OID SNMP GET serentak ke OLT untuk seluruh ONU pada ODP tersebut.
     * Mengambil STATUS OPERASIONAL dan REDAMAN OPTIK RIIL (DDM) langsung dari chip OLT.
     */
    public static function probeOdpStatus(
        int $odpId,
        ?OltDevice $olt = null,
        ?string $standardPort = null,
        bool $isRecovery = false
    ): array {
        $tStart = microtime(true);

        // ⏱️ GRACE PERIOD: Jika dipanggil saat pemulihan, beri jeda 1.5 detik agar DDM OLT selesai mengukur redaman
        if ($isRecovery) {
            usleep(1500000);
        }

        // 1. Ambil seluruh ONU terdaftar di ODP ini
        $onus = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->join('network_nodes as odp', 'odp.id', '=', 'network_ports.node_id')
            ->leftJoin('olt_devices', 'olt_devices.id', '=', 'odp.olt_device_id')
            ->where('odp.id', $odpId)
            ->select([
                'odp.id as odp_id',
                'odp.name as odp_name',
                'odp.olt_port_ref',
                'odp.olt_device_id',
                'olt_devices.ip_address as olt_ip',
                'ont_registrations.id as ont_id',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'ont_registrations.status',
                'ont_registrations.rx_power',
                'customers.id as customer_id',
                'customers.customer_number',
                'customers.name as customer_name',
            ])
            ->get();

        $totalOnus = $onus->count();
        if ($totalOnus < 2) {
            return [
                'success'     => false,
                'reason'      => 'Klien pada ODP kurang dari 2',
                'total'       => $totalOnus,
                'is_odp_down' => false,
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $first = $onus->first();
        $portRef = $standardPort ?: ($first->olt_port_ref ?? '1/1/1');
        $oltId = $first->olt_device_id;
        $resolvedOlt = $olt ?: ($oltId ? OltDevice::find($oltId) : null);

        if (!$resolvedOlt) {
            return [
                'success'     => false,
                'reason'      => 'OLT tidak ditemukan',
                'total'       => $totalOnus,
                'is_odp_down' => false,
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        // Resolusi ONU IDs dari snapshot OLT
        $snapshot = $resolvedOlt->last_telemetry_snapshot ?? [];
        $rawSnapshotOnus = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
        $onuIdMap = [];
        foreach ($rawSnapshotOnus as $so) {
            $sn = strtoupper(trim((string)($so['serial_number'] ?? ($so['onu_mac'] ?? ''))));
            if ($sn && !empty($so['onu_id'])) {
                $onuIdMap[$sn] = (int)$so['onu_id'];
            }
        }

        $ifIndex = self::calculateIfIndex($portRef);
        $session = self::getSnmpSession($resolvedOlt, 1800);

        // 🔍 AUTO-DISCOVERY ONU ID: Jika ada SN pada ODP yang belum terpetakan di snapshot,
        // lakukan mini-walk cepat pada subtree serial number port ini (~30ms)
        $hasMissingOnuId = false;
        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            if ($sn && empty($onuIdMap[$sn])) {
                $hasMissingOnuId = true;
                break;
            }
        }

        if ($hasMissingOnuId && $session) {
            try {
                $portSnWalk = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.3.{$ifIndex}");
                if (is_array($portSnWalk)) {
                    foreach ($portSnWalk as $oid => $val) {
                        $parts = explode('.', $oid);
                        $foundOnuId = (int)end($parts);
                        $foundSn = self::parseZteSerialNumber((string)$val);
                        if ($foundSn && $foundOnuId > 0) {
                            $onuIdMap[$foundSn] = $foundOnuId;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        $oidsToQuery = [];
        $snToOidMap = [];

        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            $onuId = $onuIdMap[$sn] ?? null;
            if ($onuId) {
                // 1. OID Status Operasional (3 = Online)
                $stateOid = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.{$ifIndex}.{$onuId}";
                // 2. OID Redaman Optik Riil Rx Power (DDM Transceiver)
                $rxOid    = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.{$ifIndex}.{$onuId}.1";

                $oidsToQuery[] = $stateOid;
                $oidsToQuery[] = $rxOid;

                $snToOidMap[$sn] = [
                    'state_oid' => $stateOid,
                    'rx_oid'    => $rxOid,
                    'onu_id'    => $onuId,
                ];
            }
        }

        $downCount = 0;
        $onlineCount = 0;
        $probedStates = [];

        if ($session && !empty($oidsToQuery)) {
            try {
                // Multi-OID GET dalam 1 paket UDP bulat (~30-50ms)
                $rawResults = @$session->get($oidsToQuery);
                if (is_array($rawResults)) {
                    $normalized = [];
                    foreach ($rawResults as $k => $v) {
                        $cleanK = ltrim(str_replace('iso.', '1.', (string)$k), '.');
                        $normalized[$cleanK] = $v;
                    }

                    foreach ($onus as $onu) {
                        $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
                        $map = $snToOidMap[$sn] ?? null;

                        $stateVal = null;
                        $rawRx = null;
                        if ($map) {
                            $sOid = ltrim($map['state_oid'], '.');
                            $rOid = ltrim($map['rx_oid'], '.');
                            if (isset($normalized[$sOid])) {
                                $stateVal = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$normalized[$sOid]));
                            }
                            if (isset($normalized[$rOid])) {
                                $rawRx = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$normalized[$rOid]));
                            }
                        }

                        // 3 = Online (ZTE GPON MIB)
                        $isUp = ($stateVal === 3);
                        $currentRx = null;

                        if ($rawRx !== null && $rawRx > 0 && $rawRx < 65535) {
                            $calculated = round(($rawRx * 0.002) - 30.0, 2);
                            if ($calculated > -38.0 && $calculated < -5.0) {
                                $currentRx = $calculated;
                            }
                        }

                        if ($isUp) {
                            $onlineCount++;
                            // Jika DDM masih mengukur (65535 atau 0), tapi state sudah 3 (Online):
                            // Jangan beri -40.00 dBm! Gunakan redaman terakhir di DB jika valid atau baseline normal (-21.50 dBm)
                            if ($currentRx === null) {
                                $currentRx = (isset($onu->rx_power) && is_numeric($onu->rx_power) && (float)$onu->rx_power > -35.0)
                                    ? (float)$onu->rx_power
                                    : -21.50;
                            }
                        } else {
                            $downCount++;
                            $currentRx = -40.00;
                        }

                        $probedStates[$sn] = [
                            'name'      => $onu->customer_name,
                            'sn'        => $sn,
                            'onu_id'    => $map['onu_id'] ?? null,
                            'state'     => $stateVal,
                            'is_online' => $isUp,
                            'rx_power'  => $currentRx,
                        ];
                    }
                }
            } catch (\Throwable $e) {
                // fallback below
            }
        }

        // Fallback jika SNMP timeout/gagal: gunakan status DB saat ini
        if (empty($probedStates)) {
            foreach ($onus as $onu) {
                $isUp = ($onu->status === 'active' && is_numeric($onu->rx_power) && (float)$onu->rx_power > -32.0);
                if ($isUp) {
                    $onlineCount++;
                } else {
                    $downCount++;
                }
                $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
                $probedStates[$sn] = [
                    'name'     => $onu->customer_name,
                    'sn'       => $sn,
                    'is_online'=> $isUp,
                    'rx_power' => $isUp ? (float)$onu->rx_power : -40.00,
                ];
            }
        }

        $pctDown = $totalOnus > 0 ? round(($downCount / $totalOnus) * 100.0, 1) : 0;
        
        // 🎯 POLA CERDAS ODP:
        // 1. 100% Total Loss (Seluruh pelanggan pada ODP down)
        // 2. Parsial Berat (>= 80% down DAN hanya 1 s/d 3 modem yang masih ON)
        $isOdpDown = ($totalOnus >= 2 && $downCount === $totalOnus)
                  || ($totalOnus >= 4 && $pctDown >= 80.0 && $onlineCount <= 3);

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'      => true,
            'odp_id'       => $odpId,
            'odp_name'     => $first->odp_name,
            'port'         => $portRef,
            'total_onus'   => $totalOnus,
            'down_count'   => $downCount,
            'online_count' => $onlineCount,
            'pct_down'     => $pctDown,
            'is_odp_down'  => $isOdpDown,
            'onu_states'   => $probedStates,
            'duration_ms'  => $durationMs,
        ];
    }

    /**
     * ⚡ PILAR 3: Hardware SFP Link Pulse (Single-Packet Multi-OID ifOperStatus ~34 milidetik)
     * Memeriksa seluruh modul SFP port PON pada OLT apakah link fisik UP (1) atau DOWN (2).
     */
    public static function probePortHardwareStatus(OltDevice $olt, ?array $knownPonPorts = null): array
    {
        $tStart = microtime(true);

        if (!$knownPonPorts) {
            $snapshot = $olt->last_telemetry_snapshot ?? [];
            $knownPonPorts = $snapshot['pon_ports'] ?? [];
        }

        // Jika snapshot kosong, coba cari dari database network_nodes atau ont_registrations
        if (empty($knownPonPorts)) {
            $dbPorts = DB::table('network_nodes')
                ->where('olt_device_id', $olt->id)
                ->whereNotNull('olt_port_ref')
                ->distinct()
                ->pluck('olt_port_ref')
                ->toArray();

            foreach ($dbPorts as $dp) {
                $knownPonPorts[] = ['port_id' => $dp];
            }
        }

        if (empty($knownPonPorts)) {
            return [
                'success'     => false,
                'reason'      => 'Tidak ada port PON yang terdaftar untuk OLT ini',
                'ports'       => [],
                'down_ports'  => [],
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $session = self::getSnmpSession($olt, 1500);
        if (!$session) {
            return [
                'success'     => false,
                'reason'      => 'Gagal membuka sesi SNMP ke OLT',
                'ports'       => [],
                'down_ports'  => [],
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $portIndexMap = [];
        $oidsToQuery = [];

        foreach ($knownPonPorts as $pItem) {
            $pId = is_array($pItem) ? ($pItem['port_id'] ?? '') : (string)$pItem;
            if (empty($pId)) continue;

            $ifIndex = self::calculateIfIndex($pId);
            $oid = "1.3.6.1.2.1.2.2.1.8.{$ifIndex}";
            $oidsToQuery[] = $oid;
            $portIndexMap[$oid] = $pId;
        }

        $portStatuses = [];
        $downPorts = [];
        $upPorts = [];

        try {
            $raw = @$session->get($oidsToQuery);
            if (is_array($raw)) {
                foreach ($raw as $oid => $val) {
                    $cleanOid = str_replace('iso.', '1.', $oid);
                    // Match OID
                    $matchedPort = $portIndexMap[$oid] ?? ($portIndexMap[$cleanOid] ?? null);
                    if (!$matchedPort) {
                        foreach ($portIndexMap as $k => $v) {
                            if (str_ends_with($oid, substr($k, strrpos($k, '.')))) {
                                $matchedPort = $v;
                                break;
                            }
                        }
                    }

                    if ($matchedPort) {
                        $operVal = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$val));
                        // 1 = UP, 2 = DOWN (RFC 2863 IF-MIB)
                        $isUp = ($operVal === 1);
                        $portStatuses[$matchedPort] = [
                            'port'      => $matchedPort,
                            'oper_val'  => $operVal,
                            'is_up'     => $isUp,
                            'status_str'=> $isUp ? 'UP' : 'DOWN',
                        ];

                        if ($isUp) {
                            $upPorts[] = $matchedPort;
                        } else {
                            $downPorts[] = $matchedPort;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            // fallback silently
        }

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'     => !empty($portStatuses),
            'olt_id'      => $olt->id,
            'olt_name'    => $olt->name,
            'ports'       => $portStatuses,
            'down_ports'  => $downPorts,
            'up_ports'    => $upPorts,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * 🚀 PILAR 2: Fast Walk Status Operasional Seluruh ONU pada 1 Port PON (~1 - 2 detik)
     * Memverifikasi apakah suatu port PON mengalami gangguan massal atau telah pulih massal.
     */
    public static function probePortOnusQuickState(OltDevice $olt, string $standardPort): array
    {
        $tStart = microtime(true);
        $ifIndex = self::calculateIfIndex($standardPort);
        $session = self::getSnmpSession($olt, 2500);

        if (!$session) {
            return [
                'success' => false,
                'reason'  => 'Gagal koneksi SNMP',
            ];
        }

        $downCount = 0;
        $onlineCount = 0;
        $totalOnus = 0;
        $onuStates = [];
        $onuStatesBySn = [];
        $snMap = [];

        // 1. Walk subtree serial number port ini (~20ms) agar hasil probe bisa di-lookup via SN
        try {
            $snWalk = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.3.{$ifIndex}");
            if (is_array($snWalk) && !empty($snWalk)) {
                foreach ($snWalk as $snOid => $snVal) {
                    $snParts = explode('.', (string)$snOid);
                    $oId = (int)end($snParts);
                    $parsedSn = self::parseZteSerialNumber((string)$snVal);
                    if ($parsedSn && $oId > 0) {
                        $snMap[$oId] = strtoupper(trim($parsedSn));
                    }
                }
            }
        } catch (\Throwable $e) {}

        try {
            // 2. Walk subtree operasional status ONU port ini (1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.{$ifIndex})
            $states = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.{$ifIndex}");
            if (is_array($states) && !empty($states)) {
                $totalOnus = count($states);
                foreach ($states as $oid => $val) {
                    $parts = explode('.', (string)$oid);
                    $onuId = (int)end($parts);
                    $oper = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$val));
                    $isOnline = ($oper === 3);
                    if ($isOnline) {
                        $onlineCount++;
                    } else {
                        $downCount++;
                    }
                    $sn = $snMap[$onuId] ?? null;
                    $stateEntry = [
                        'onu_id'    => $onuId,
                        'sn'        => $sn,
                        'oper'      => $oper,
                        'is_online' => $isOnline,
                        'rx_power'  => $isOnline ? -21.50 : -40.00, // Baseline sehat jika DDM masih kalibrasi
                    ];
                    $onuStates[$onuId] = $stateEntry;
                    if ($sn) {
                        $onuStatesBySn[$sn] = $stateEntry;
                    }
                }
            }
        } catch (\Throwable $e) {
            // fallback
        }

        // 3. Walk subtree redaman optik port ini (~20-40ms) untuk mengambil redaman riil setiap ONU
        try {
            $rxWalk = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.{$ifIndex}");
            if (is_array($rxWalk) && !empty($rxWalk)) {
                foreach ($rxWalk as $rxOid => $rxVal) {
                    $rxParts = explode('.', (string)$rxOid);
                    $onuIdPart = (end($rxParts) === '1' && count($rxParts) >= 2) ? (int)$rxParts[count($rxParts)-2] : (int)end($rxParts);
                    $rawInt = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$rxVal));
                    if ($rawInt > 0 && $rawInt < 65535) {
                        $dbm = round(($rawInt * 0.002) - 30.0, 2);
                        if ($dbm > -38.0 && $dbm < -5.0 && isset($onuStates[$onuIdPart])) {
                            $onuStates[$onuIdPart]['rx_power'] = $dbm;
                            $sn = $onuStates[$onuIdPart]['sn'] ?? null;
                            if ($sn && isset($onuStatesBySn[$sn])) {
                                $onuStatesBySn[$sn]['rx_power'] = $dbm;
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {}

        $pctDown = $totalOnus > 0 ? round(($downCount / $totalOnus) * 100.0, 1) : 0;
        $pctOnline = $totalOnus > 0 ? round(($onlineCount / $totalOnus) * 100.0, 1) : 0;

        // 🎯 POLA CERDAS GANGGUAN MASSAL INTERFACE:
        // 1. 100% Seluruh Pelanggan LOSS (downCount === totalOnus)
        // 2. Ambang batas ketat >= 90% down DENGAN toleransi maksimal 1 s/d 3 modem ghost/on (hanya untuk port dengan >= 10 pelanggan)
        // Hapus total aturan lama 60% dan batas 12 down!
        $isMassOutage = false;
        if ($totalOnus >= 10) {
            $isMassOutage = ($downCount === $totalOnus) || ($pctDown >= 90.0 && $onlineCount <= 3);
        } elseif ($totalOnus >= 3) {
            $isMassOutage = ($downCount === $totalOnus);
        }

        // Kriteria Pemulihan Massal:
        // Minimal 70% online ATAU minimal 2 modem online jika <= 4 pelanggan
        $isMassRecovery = ($totalOnus <= 4) ? ($onlineCount >= 1) : ($pctOnline >= 70.0);

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'          => $totalOnus > 0,
            'port'             => $standardPort,
            'ifIndex'          => $ifIndex,
            'total_onus'       => $totalOnus,
            'online_count'     => $onlineCount,
            'down_count'       => $downCount,
            'pct_down'         => $pctDown,
            'pct_online'       => $pctOnline,
            'is_mass_outage'   => $isMassOutage,
            'is_mass_recovery' => $isMassRecovery,
            'onu_states'       => $onuStates,
            'onu_states_by_sn' => $onuStatesBySn,
            'duration_ms'      => $durationMs,
        ];
    }

    /**
     * 💾 PILAR 4: Instant Database Bulk Synchronization (< 3 milidetik)
     * Mengupdate data pelanggan pada port / ODP yang terdampak secara serentak,
     * serta mengosongkan cache GIS & Dashboard secara instan.
     */
    public static function instantBulkDbSync(
        string $targetStatus,
        ?string $standardPort = null,
        ?int $odpId = null,
        ?float $rxPower = null,
        ?array $excludeSerials = null
    ): int {
        $updatedRows = 0;

        try {
            if ($odpId) {
                $q = DB::table('ont_registrations')
                    ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                    ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                    ->where('network_ports.node_id', $odpId);

                if (!empty($excludeSerials)) {
                    $q->whereNotIn('ont_registrations.onu_serial', $excludeSerials)
                      ->whereNotIn('ont_registrations.onu_mac', $excludeSerials);
                }

                $updateData = [
                    'ont_registrations.status'     => $targetStatus,
                    'ont_registrations.updated_at' => now(),
                ];
                if ($targetStatus === 'inactive') {
                    $updateData['ont_registrations.rx_power'] = -40.00;
                    $updateData['ont_registrations.notes']    = 'Mass Outage via Fast Probe pada ' . now()->format('d/m/Y H:i:s');
                } elseif ($rxPower !== null) {
                    $updateData['ont_registrations.rx_power'] = $rxPower;
                    $updateData['ont_registrations.notes']    = 'Mass Recovery via Fast Probe pada ' . now()->format('d/m/Y H:i:s');
                }

                $updatedRows = $q->update($updateData);
            } elseif ($standardPort) {
                $cleanP = str_replace(['gpon-olt_', 'epon-olt_', 'gpon_', 'epon_'], '', strtolower(trim($standardPort)));
                $fullP  = 'gpon-olt_' . $cleanP;

                $updateData = [
                    'ont_registrations.status'     => $targetStatus,
                    'ont_registrations.updated_at' => now(),
                ];
                if ($targetStatus === 'inactive') {
                    $updateData['ont_registrations.rx_power'] = -40.00;
                    $updateData['ont_registrations.notes']    = "Interface Mass Outage ({$standardPort}) pada " . now()->format('d/m/Y H:i:s');
                } elseif ($rxPower !== null) {
                    $updateData['ont_registrations.rx_power'] = $rxPower;
                    $updateData['ont_registrations.notes']    = "Interface Mass Recovery ({$standardPort}) pada " . now()->format('d/m/Y H:i:s');
                }

                $q = DB::table('ont_registrations')
                    ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                    ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                    ->join('network_nodes', 'network_nodes.id', '=', 'network_ports.node_id')
                    ->where(function ($query) use ($cleanP, $fullP, $standardPort) {
                        $query->where('network_nodes.olt_port_ref', $cleanP)
                              ->orWhere('network_nodes.olt_port_ref', $fullP)
                              ->orWhere('network_nodes.olt_port_ref', $standardPort);
                    });

                if (!empty($excludeSerials)) {
                    $q->whereNotIn('ont_registrations.onu_serial', $excludeSerials)
                      ->whereNotIn('ont_registrations.onu_mac', $excludeSerials);
                }

                $updatedRows = $q->update($updateData);
            }

            // Invalidate seluruh Cache GIS & Dashboard agar UI langsung refresh real-time
            Cache::forget('gis_map_data_payload_v1');
            Cache::forget('gis_topology_hierarchy_all');
            Cache::forget('dashboard_metrics_payload');
        } catch (\Throwable $e) {
            Log::warning("[FastOpticalProbeService] Gagal bulk sync database: " . $e->getMessage());
        }

        return $updatedRows;
    }

    /**
     * 🚀 ON-DEMAND LIVE OPTICAL PROBE FOR ODP
     * Mengambil nilai redaman optik riil (Rx Power) & status operasional secara langsung ke chip OLT
     * via Fast Multi-OID SNMP Query (~30-60 milidetik), dan mengupdate database secara instan.
     */
    public static function probeOdpLiveOptical(
        int $odpId,
        ?OltDevice $olt = null,
        ?string $standardPort = null
    ): array {
        $tStart = microtime(true);

        // 1. Ambil data ODP dan seluruh ONU/pelanggan yang terhubung
        $odpNode = \App\Models\NetworkNode::with(['splitterType', 'oltDevice', 'parent'])->find($odpId);
        if (!$odpNode) {
            return [
                'success'     => false,
                'reason'      => 'Node ODP tidak ditemukan',
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $onus = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->where('network_ports.node_id', $odpId)
            ->select([
                'ont_registrations.id as ont_id',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'ont_registrations.status',
                'ont_registrations.rx_power',
                'customers.id as customer_id',
                'customers.name as customer_name',
                'network_ports.id as port_id',
                'network_ports.port_number',
            ])
            ->get();

        if ($onus->isEmpty()) {
            return [
                'success'      => true,
                'odp_id'       => $odpId,
                'odp_name'     => $odpNode->name,
                'total_onus'   => 0,
                'online_count' => 0,
                'down_count'   => 0,
                'message'      => 'Tidak ada pelanggan aktif pada port ODP ini',
                'duration_ms'  => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        // 2. Resolusi OLT dan Port Interface
        $resolvedOlt = $olt;
        $portRef = $standardPort;

        if (!$resolvedOlt) {
            if ($odpNode->olt_device_id) {
                $resolvedOlt = OltDevice::find($odpNode->olt_device_id);
            } elseif ($odpNode->parent && $odpNode->parent->olt_device_id) {
                $resolvedOlt = OltDevice::find($odpNode->parent->olt_device_id);
            } else {
                $auto = $odpNode->getAutoDetectedInterfaceAndOlt();
                if (!empty($auto['olt']['id'])) {
                    $resolvedOlt = OltDevice::find($auto['olt']['id']);
                }
            }
        }

        if (!$portRef) {
            $portRef = $odpNode->olt_port_ref;
            if (!$portRef && $odpNode->parent) {
                $portRef = $odpNode->parent->olt_port_ref;
            }
            if (!$portRef) {
                $auto = $odpNode->getAutoDetectedInterfaceAndOlt();
                $portRef = $auto['port_ref'] ?? null;
            }
        }

        if (!$resolvedOlt) {
            $resolvedOlt = OltDevice::where('status', 'active')->where('connection_mode', 'live')->first()
                        ?: OltDevice::first();
        }

        if (!$resolvedOlt || $resolvedOlt->connection_mode !== 'live') {
            return [
                'success'     => false,
                'reason'      => 'OLT tidak terhubung dalam mode Live atau tidak ditemukan',
                'odp_id'      => $odpId,
                'total_onus'  => $onus->count(),
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $portRef = $portRef ?: '1/1/1';
        $ifIndex = self::calculateIfIndex($portRef);
        $session = self::getSnmpSession($resolvedOlt, 2000, 1);

        if (!$session) {
            return [
                'success'     => false,
                'reason'      => 'Gagal membuka sesi SNMP ke OLT (' . $resolvedOlt->ip_address . ')',
                'odp_id'      => $odpId,
                'total_onus'  => $onus->count(),
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        // 3. Resolusi ONU ID dari snapshot / walk
        $snapshot = $resolvedOlt->last_telemetry_snapshot ?? [];
        $rawSnapshotOnus = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
        $onuIdMap = [];
        foreach ($rawSnapshotOnus as $so) {
            $sn = strtoupper(trim((string)($so['serial_number'] ?? ($so['onu_mac'] ?? ''))));
            if ($sn && !empty($so['onu_id'])) {
                $onuIdMap[$sn] = (int)$so['onu_id'];
            }
        }

        $hasMissingOnuId = false;
        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            if ($sn && empty($onuIdMap[$sn])) {
                $hasMissingOnuId = true;
                break;
            }
        }

        if ($hasMissingOnuId) {
            try {
                $portSnWalk = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.3.{$ifIndex}");
                if (is_array($portSnWalk)) {
                    foreach ($portSnWalk as $oid => $val) {
                        $parts = explode('.', (string)$oid);
                        $foundOnuId = (int)end($parts);
                        $foundSn = self::parseZteSerialNumber((string)$val);
                        if ($foundSn && $foundOnuId > 0) {
                            $onuIdMap[$foundSn] = $foundOnuId;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        // 4. Query SNMP Multi-OID untuk State & Rx Power
        $oidsToQuery = [];
        $snToOidMap = [];

        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            $onuId = $onuIdMap[$sn] ?? null;
            if ($onuId) {
                $stateOid = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.{$ifIndex}.{$onuId}";
                $rxOid    = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.{$ifIndex}.{$onuId}.1";

                $oidsToQuery[] = $stateOid;
                $oidsToQuery[] = $rxOid;

                $snToOidMap[$sn] = [
                    'ont_id'    => $onu->ont_id,
                    'state_oid' => $stateOid,
                    'rx_oid'    => $rxOid,
                    'onu_id'    => $onuId,
                ];
            }
        }

        $onlineCount = 0;
        $downCount = 0;
        $probedStates = [];

        if (!empty($oidsToQuery)) {
            try {
                $rawResults = @$session->get($oidsToQuery);
                if (is_array($rawResults)) {
                    $normalized = [];
                    foreach ($rawResults as $k => $v) {
                        $cleanK = ltrim(str_replace('iso.', '1.', (string)$k), '.');
                        $normalized[$cleanK] = $v;
                    }

                    foreach ($onus as $onu) {
                        $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
                        $map = $snToOidMap[$sn] ?? null;

                        $stateVal = null;
                        $rawRx = null;
                        if ($map) {
                            $sOid = ltrim($map['state_oid'], '.');
                            $rOid = ltrim($map['rx_oid'], '.');
                            if (isset($normalized[$sOid])) {
                                $stateVal = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$normalized[$sOid]));
                            }
                            if (isset($normalized[$rOid])) {
                                $rawRx = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$normalized[$rOid]));
                            }
                        }

                        $isUp = ($stateVal === 3);
                        $currentRx = null;

                        if ($rawRx !== null && $rawRx > 0 && $rawRx < 65535) {
                            $calculated = round(($rawRx * 0.002) - 30.0, 2);
                            if ($calculated > -38.0 && $calculated < -5.0) {
                                $currentRx = $calculated;
                            }
                        }

                        if ($isUp) {
                            $onlineCount++;
                            if ($currentRx === null) {
                                $currentRx = (isset($onu->rx_power) && is_numeric($onu->rx_power) && (float)$onu->rx_power > -35.0)
                                    ? (float)$onu->rx_power
                                    : -21.50;
                            }
                        } else {
                            $downCount++;
                            $currentRx = -40.00;
                        }

                        // 5. Update Database ont_registrations seketika
                        $updateData = [
                            'status'     => $isUp ? 'active' : 'inactive',
                            'rx_power'   => $currentRx,
                            'updated_at' => now(),
                        ];
                        if ($isUp) {
                            $updateData['last_online_at'] = now();
                        }

                        DB::table('ont_registrations')
                            ->where('id', $onu->ont_id)
                            ->update($updateData);

                        $probedStates[$sn] = [
                            'ont_id'     => $onu->ont_id,
                            'name'       => $onu->customer_name,
                            'sn'         => $sn,
                            'onu_id'     => $map['onu_id'] ?? null,
                            'is_online'  => $isUp,
                            'rx_power'   => $currentRx,
                        ];
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("[FastOpticalProbeService] Gagal probe live optical ODP #{$odpId}: " . $e->getMessage());
            }
        }

        // Invalidate GIS caches
        Cache::forget('gis_map_data_payload_v1');
        Cache::forget('gis_topology_hierarchy_all');
        Cache::forget('dashboard_metrics_payload');

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'       => true,
            'odp_id'        => $odpId,
            'odp_name'      => $odpNode->name,
            'olt_id'        => $resolvedOlt->id,
            'olt_name'      => $resolvedOlt->name,
            'port'          => $portRef,
            'total_onus'    => $onus->count(),
            'online_count'  => $onlineCount,
            'down_count'    => $downCount,
            'probed_states' => $probedStates,
            'duration_ms'   => $durationMs,
            'probed_at'     => now()->format('H:i:s'),
        ];
    }
}
