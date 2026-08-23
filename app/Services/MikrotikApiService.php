<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;

/**
 * Pure PHP MikroTik RouterOS API Client
 * Berjalan via socket port 8728 (atau 8729 SSL) tanpa dependensi library eksternal.
 */
class MikrotikApiService
{
    private $socket = null;
    private bool $connected = false;
    private int $timeout = 3;

    public function __construct(
        private string $host = '192.168.88.1',
        private string $username = 'admin',
        private string $password = '',
        private int $port = 8728,
        private bool $ssl = false,
        int $timeout = 3
    ) {
        $this->timeout = $timeout;
    }

    /**
     * Buka koneksi socket dan login ke RouterOS
     */
    public function connect(): bool
    {
        $proto = $this->ssl ? 'ssl://' : '';
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ]
        ]);

        $this->socket = @stream_socket_client(
            "{$proto}{$this->host}:{$this->port}",
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if (!$this->socket) {
            Log::warning("MikrotikApiService: Gagal koneksi ke {$this->host}:{$this->port} - {$errstr} ({$errno})");
            return false;
        }

        stream_set_timeout($this->socket, $this->timeout);

        // Login ke RouterOS v6.43+ / v7 (Modern plain auth)
        $loginRes = $this->comm('/login', [
            '=name=' . $this->username,
            '=password=' . $this->password,
        ]);

        if (isset($loginRes[0]['!trap'])) {
            // Coba legacy challenge-response jika diperlukan
            if (isset($loginRes[0]['=ret'])) {
                $challenge = pack('H*', $loginRes[0]['=ret']);
                $md5 = md5(chr(0) . $this->password . $challenge);
                $legacyRes = $this->comm('/login', [
                    '=name=' . $this->username,
                    '=response=00' . $md5,
                ]);
                $this->connected = !isset($legacyRes[0]['!trap']);
                if (!$this->connected) {
                    $this->disconnect();
                }
                return $this->connected;
            }
            $this->connected = false;
            $this->disconnect();
            return false;
        }

        $this->connected = true;
        return true;
    }

    /**
     * Putuskan koneksi socket
     */
    public function disconnect(): void
    {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
        $this->connected = false;
    }

    /**
     * Kirim command dan baca response kata per kata (RouterOS API protocol)
     */
    public function comm(string $command, array $params = []): array
    {
        if (!$this->socket) {
            return [];
        }

        $this->writeWord($command);
        foreach ($params as $param) {
            $this->writeWord($param);
        }
        $this->writeWord(''); // End of sentence

        $response = [];
        $sentence = [];

        while (true) {
            $word = $this->readWord();
            if ($word === '') {
                if (!empty($sentence)) {
                    $response[] = $sentence;
                    $sentence = [];
                }
                break;
            }

            if ($word === '!done') {
                $response[] = $sentence;
                break;
            }

            if ($word === '!trap' || $word === '!fatal') {
                $sentence['!trap'] = true;
            } elseif (str_starts_with($word, '=')) {
                $parts = explode('=', substr($word, 1), 2);
                if (count($parts) === 2) {
                    $sentence[$parts[0]] = $parts[1];
                }
            } else {
                $sentence['status'] = $word;
            }
        }

        return array_values(array_filter($response));
    }

    /**
     * Tulis 1 kata dengan prefix panjang byte sesuai format MikroTik API
     */
    private function writeWord(string $word): void
    {
        $len = strlen($word);
        if ($len < 0x80) {
            fwrite($this->socket, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($this->socket, chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        } elseif ($len < 0x200000) {
            $len |= 0xC00000;
            fwrite($this->socket, chr(($len >> 16) & 0xFF) . chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        } else {
            $len |= 0xE0000000;
            fwrite($this->socket, chr(($len >> 24) & 0xFF) . chr(($len >> 16) & 0xFF) . chr(($len >> 8) & 0xFF) . chr($len & 0xFF));
        }
        fwrite($this->socket, $word);
    }

    /**
     * Baca 1 kata dari socket
     */
    private function readWord(): string
    {
        $byte = fread($this->socket, 1);
        if ($byte === false || $byte === '') {
            return '';
        }

        $len = ord($byte);
        if (($len & 0x80) === 0x00) {
            // len < 0x80
        } elseif (($len & 0xC0) === 0x80) {
            $len = (($len & 0x3F) << 8) + ord(fread($this->socket, 1));
        } elseif (($len & 0xE0) === 0xC0) {
            $len = (($len & 0x1F) << 16) + (ord(fread($this->socket, 1)) << 8) + ord(fread($this->socket, 1));
        } elseif (($len & 0xF0) === 0xE0) {
            $len = (($len & 0x0F) << 24) + (ord(fread($this->socket, 1)) << 16) + (ord(fread($this->socket, 1)) << 8) + ord(fread($this->socket, 1));
        }

        $word = '';
        while (strlen($word) < $len) {
            $chunk = fread($this->socket, $len - strlen($word));
            if ($chunk === false || $chunk === '') break;
            $word .= $chunk;
        }

        return $word;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FUNGSI OPERASIONAL & METRIK LIVE MIKROTIK
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Dapatkan informasi spesifikasi CPU, RAM, Uptime, Versi RouterOS
     */
    public function getSystemResource(): array
    {
        $res = $this->comm('/system/resource/print');
        if (empty($res)) return [];
        $data = $res[0];

        return [
            'uptime'          => $data['uptime'] ?? '0s',
            'version'         => $data['version'] ?? 'Unknown',
            'cpu_load'        => isset($data['cpu-load']) ? (int) $data['cpu-load'] : 0,
            'free_memory_mb'  => isset($data['free-memory']) ? round(((int) $data['free-memory']) / 1048576, 1) : 0,
            'total_memory_mb' => isset($data['total-memory']) ? round(((int) $data['total-memory']) / 1048576, 1) : 0,
            'cpu_count'       => $data['cpu-count'] ?? 1,
            'board_name'      => $data['board-name'] ?? 'MikroTik RouterBOARD',
            'architecture'    => $data['architecture-name'] ?? 'mipsbe',
        ];
    }

    /**
     * Dapatkan seluruh antarmuka (interface) beserta status Link, Rx/Tx Bytes
     */
    public function getInterfaces(): array
    {
        $raw = $this->comm('/interface/print');
        $interfaces = [];

        foreach ($raw as $if) {
            if (!isset($if['name'])) continue;
            $interfaces[] = [
                'name'        => $if['name'],
                'type'        => $if['type'] ?? 'ether',
                'running'     => ($if['running'] ?? 'false') === 'true',
                'disabled'    => ($if['disabled'] ?? 'false') === 'true',
                'rx_byte'     => (int) ($if['rx-byte'] ?? 0),
                'tx_byte'     => (int) ($if['tx-byte'] ?? 0),
                'rx_packet'   => (int) ($if['rx-packet'] ?? 0),
                'tx_packet'   => (int) ($if['tx-packet'] ?? 0),
                'comment'     => $if['comment'] ?? '',
            ];
        }

        return $interfaces;
    }

    /**
     * Monitor traffic real-time pada interface tertentu (Rx/Tx bps)
     */
    public function monitorInterfaceTraffic(string $interfaceName = 'ether1'): array
    {
        $res = $this->comm('/interface/monitor-traffic', [
            '=interface=' . $interfaceName,
            '=once=',
        ]);

        if (empty($res)) {
            return ['rx_bps' => 0, 'tx_bps' => 0, 'rx_mbps' => 0, 'tx_mbps' => 0];
        }

        $rxBps = (int) ($res[0]['rx-bits-per-second'] ?? 0);
        $txBps = (int) ($res[0]['tx-bits-per-second'] ?? 0);

        return [
            'interface' => $interfaceName,
            'rx_bps'    => $rxBps,
            'tx_bps'    => $txBps,
            'rx_mbps'   => round($rxBps / 1000000, 2),
            'tx_mbps'   => round($txBps / 1000000, 2),
            'rx_packet' => (int) ($res[0]['rx-packets-per-second'] ?? 0),
            'tx_packet' => (int) ($res[0]['tx-packets-per-second'] ?? 0),
        ];
    }

    /**
     * Dapatkan daftar pelanggan PPPoE yang sedang aktif online
     */
    public function getActivePppoeSessions(): array
    {
        $raw = $this->comm('/ppp/active/print');
        $sessions = [];

        foreach ($raw as $s) {
            if (!isset($s['name'])) continue;
            $sessions[] = [
                'username'    => $s['name'],
                'service'     => $s['service'] ?? 'pppoe',
                'caller_id'   => $s['caller-id'] ?? '',
                'address'     => $s['address'] ?? '',
                'uptime'      => $s['uptime'] ?? '0s',
                'encoding'    => $s['encoding'] ?? '',
            ];
        }

        return $sessions;
    }

    /**
     * Dapatkan status DHCP Leases aktif
     */
    public function getDhcpLeases(): array
    {
        $raw = $this->comm('/ip/dhcp-server/lease/print');
        $leases = [];

        foreach ($raw as $l) {
            if (!isset($l['address'])) continue;
            $leases[] = [
                'address'   => $l['address'],
                'mac'       => $l['mac-address'] ?? '',
                'hostname'  => $l['host-name'] ?? '',
                'status'    => $l['status'] ?? 'bound',
                'expires'   => $l['expires-after'] ?? '',
                'comment'   => $l['comment'] ?? '',
            ];
        }

        return $leases;
    }
}
