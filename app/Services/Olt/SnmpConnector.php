<?php

namespace App\Services\Olt;

/**
 * SnmpConnector — Handles SNMP queries to OLT devices.
 *
 * Supports:
 *  - SNMPv2c (community string: public or custom)
 *  - SNMPv3 (username + auth + priv)
 *  - Adaptive Timeout & Auto-Retry Boost
 *
 * Gracefully falls back to simulation if PHP SNMP extension is not loaded.
 */
class SnmpConnector
{
    private string $ip;
    private string $snmpVersion;    // 'v2c' or 'v3'
    private string $community;      // for v2c
    private int $port;
    private int $timeout;           // microseconds for snmp functions
    private int $retries;

    // SNMPv3 params
    private ?string $v3Username;
    private ?string $v3AuthProtocol;
    private ?string $v3AuthPassword;
    private ?string $v3PrivProtocol;
    private ?string $v3PrivPassword;

    public function __construct(
        string $ip,
        string $snmpVersion = 'v2c',
        string $community = 'public',
        int $port = 161,
        int $timeout = 1,
        int $retries = 0,
        ?string $v3Username = null,
        ?string $v3AuthProtocol = null,
        ?string $v3AuthPassword = null,
        ?string $v3PrivProtocol = null,
        ?string $v3PrivPassword = null
    ) {
        $this->ip = $ip;
        $this->snmpVersion = $snmpVersion;
        $this->community = $community ?: 'public';
        $this->port = $port ?: 161;
        $this->timeout = max(500000, (int)($timeout * 1000000)); // minimal 500ms
        $this->retries = $retries;
        $this->v3Username = $v3Username;
        $this->v3AuthProtocol = $v3AuthProtocol;
        $this->v3AuthPassword = $v3AuthPassword;
        $this->v3PrivProtocol = $v3PrivProtocol;
        $this->v3PrivPassword = $v3PrivPassword;
    }

    private ?bool $cachedReachable = null;

    /**
     * Check if PHP SNMP extension is available.
     */
    public static function isAvailable(): bool
    {
        return extension_loaded('snmp');
    }

    /**
     * Quick reachability check with single sysDescr query cached for the lifecycle.
     */
    public function isReachable(): bool
    {
        if ($this->cachedReachable !== null) {
            return $this->cachedReachable;
        }
        if (!self::isAvailable()) {
            $this->cachedReachable = false;
            return false;
        }
        $test = @$this->get('1.3.6.1.2.1.1.1.0');
        $this->cachedReachable = ($test !== false && $test !== null);
        return $this->cachedReachable;
    }

    /**
     * Test ICMP reachability (ping).
     * Returns latency in ms, or -1 if unreachable.
     */
    public function pingTest(): int
    {
        $startTime = microtime(true);
        $cmd = PHP_OS_FAMILY === 'Windows'
            ? "ping -n 1 -w 2000 {$this->ip}"
            : "ping -c 1 -W 2 {$this->ip}";

        exec($cmd . " 2>&1", $output, $exitCode);
        $elapsed = (int)((microtime(true) - $startTime) * 1000);

        return $exitCode === 0 ? $elapsed : -1;
    }

    /**
     * Test SNMP reachability by querying sysDescr OID.
     */
    public function snmpTest(): array
    {
        if (!self::isAvailable()) {
            return [
                'success' => false,
                'error' => 'SNMP extension not loaded on server',
                'extension_missing' => true,
            ];
        }

        try {
            $oid = '1.3.6.1.2.1.1.1.0'; // sysDescr
            $result = $this->get($oid);

            if ($result !== false && $result !== null) {
                return [
                    'success' => true,
                    'sys_descr' => $result,
                    'snmp_version' => $this->snmpVersion,
                    'community_used' => $this->snmpVersion === 'v2c' ? $this->community : 'v3:' . $this->v3Username,
                ];
            }

            return ['success' => false, 'error' => 'No SNMP response from device'];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * SNMP GET — single OID value with Adaptive Auto-Retry.
     */
    public function get(string $oid, ?int $customTimeout = null, ?int $customRetries = null): mixed
    {
        if (!self::isAvailable()) return false;

        $target = "{$this->ip}:{$this->port}";
        $timeout = $customTimeout ?? $this->timeout;
        $retries = $customRetries ?? $this->retries;

        // Attempt 1: Normal Timeout
        $result = ($this->snmpVersion === 'v3')
            ? @snmp3_get(
                $target,
                $this->v3Username ?? '',
                'authPriv',
                $this->v3AuthProtocol ?? 'SHA',
                $this->v3AuthPassword ?? '',
                $this->v3PrivProtocol ?? 'AES',
                $this->v3PrivPassword ?? '',
                $oid,
                $timeout,
                $retries
            )
            : @snmpget($target, $this->community, $oid, $timeout, $retries);

        // Attempt 2 (Adaptive Timeout Boost): Jika gagal/timeout, coba 1x lagi dengan waktu tambahan +1.5s
        if ($result === false || $result === null) {
            $boostedTimeout = max($timeout * 2, 2000000); // 2.0s boost
            $result = ($this->snmpVersion === 'v3')
                ? @snmp3_get(
                    $target,
                    $this->v3Username ?? '',
                    'authPriv',
                    $this->v3AuthProtocol ?? 'SHA',
                    $this->v3AuthPassword ?? '',
                    $this->v3PrivProtocol ?? 'AES',
                    $this->v3PrivPassword ?? '',
                    $oid,
                    $boostedTimeout,
                    1
                )
                : @snmpget($target, $this->community, $oid, $boostedTimeout, 1);
        }

        return $result;
    }

    /**
     * SNMP WALK — traverse a subtree of OIDs with Adaptive Auto-Retry & Timeout Boost.
     */
    public function walk(string $oid, ?int $customTimeout = null, ?int $customRetries = null): array|false
    {
        if (!self::isAvailable()) return false;

        $target = "{$this->ip}:{$this->port}";
        $timeout = $customTimeout ?? $this->timeout;
        $retries = $customRetries ?? $this->retries;

        // Attempt 1: Normal Walk
        if ($this->snmpVersion === 'v3') {
            $result = @snmp3_real_walk(
                $target,
                $this->v3Username ?? '',
                'authPriv',
                $this->v3AuthProtocol ?? 'SHA',
                $this->v3AuthPassword ?? '',
                $this->v3PrivProtocol ?? 'AES',
                $this->v3PrivPassword ?? '',
                $oid,
                $timeout,
                $retries
            );
        } else {
            $result = @snmp2_real_walk($target, $this->community, $oid, $timeout, $retries);
            if ($result === false) {
                $result = @snmprealwalk($target, $this->community, $oid, $timeout, $retries);
            }
        }

        // Attempt 2 (Adaptive Timeout Boost): Jika gagal, retry 1x dengan durasi lebih longgar (+1.5s)
        if ($result === false || empty($result)) {
            $boostedTimeout = max($timeout * 2, 2500000); // 2.5s boost
            if ($this->snmpVersion === 'v3') {
                $result = @snmp3_real_walk(
                    $target,
                    $this->v3Username ?? '',
                    'authPriv',
                    $this->v3AuthProtocol ?? 'SHA',
                    $this->v3AuthPassword ?? '',
                    $this->v3PrivProtocol ?? 'AES',
                    $this->v3PrivPassword ?? '',
                    $oid,
                    $boostedTimeout,
                    1
                );
            } else {
                $result = @snmp2_real_walk($target, $this->community, $oid, $boostedTimeout, 1);
                if ($result === false) {
                    $result = @snmprealwalk($target, $this->community, $oid, $boostedTimeout, 1);
                }
            }
        }

        return $result;
    }

    /**
     * Clean raw SNMP return values (removes type prefixes like "STRING: ", "INTEGER: ", quotes, etc.).
     */
    public static function parseValue(string $val): string
    {
        $val = trim($val);
        // Strip common PHP SNMP type prefixes
        $val = preg_replace('/^(STRING|INTEGER|Gauge32|Counter32|Counter64|Timeticks|IpAddress|OID|Hex-STRING):\s*/i', '', $val);
        // Strip surrounding quotes
        $val = trim($val, '"\'');
        return $val;
    }
}
