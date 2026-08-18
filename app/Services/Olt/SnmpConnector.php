<?php

namespace App\Services\Olt;

/**
 * SnmpConnector — Handles SNMP queries to OLT devices.
 *
 * Supports:
 *  - SNMPv2c (community string: public or custom)
 *  - SNMPv3 (username + auth + priv)
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
        $this->community = $community;
        $this->port = $port;
        $this->timeout = $timeout * 1000000; // convert to microseconds
        $this->retries = $retries;
        $this->v3Username = $v3Username;
        $this->v3AuthProtocol = $v3AuthProtocol;
        $this->v3AuthPassword = $v3AuthPassword;
        $this->v3PrivProtocol = $v3PrivProtocol;
        $this->v3PrivPassword = $v3PrivPassword;
    }

    /**
     * Check if PHP SNMP extension is available.
     */
    public static function isAvailable(): bool
    {
        return extension_loaded('snmp');
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

            if ($result !== false) {
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
     * SNMP GET — single OID value.
     */
    public function get(string $oid): mixed
    {
        if (!self::isAvailable()) return false;

        $target = "{$this->ip}:{$this->port}";

        if ($this->snmpVersion === 'v3') {
            return @snmp3_get(
                $target,
                $this->v3Username ?? '',
                'authPriv',
                $this->v3AuthProtocol ?? 'SHA',
                $this->v3AuthPassword ?? '',
                $this->v3PrivProtocol ?? 'AES',
                $this->v3PrivPassword ?? '',
                $oid,
                $this->timeout,
                $this->retries
            );
        }

        return @snmpget($target, $this->community, $oid, $this->timeout, $this->retries);
    }

    /**
     * SNMP WALK — traverse a subtree of OIDs.
     */
    public function walk(string $oid): array|false
    {
        if (!self::isAvailable()) return false;

        $target = "{$this->ip}:{$this->port}";

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
                $this->timeout,
                $this->retries
            );
        } else {
            $result = @snmprealwalk($target, $this->community, $oid, $this->timeout, $this->retries);
        }

        return $result ?: [];
    }

    /**
     * Parse raw SNMP value (remove type prefix like "STRING: ", "INTEGER: ").
     */
    public static function parseValue(string $raw): string
    {
        if (preg_match('/^[A-Z0-9_]+:\s*(.+)$/i', $raw, $matches)) {
            return trim($matches[1], '"');
        }
        return trim($raw, '"');
    }

    public function getIp(): string { return $this->ip; }
}
