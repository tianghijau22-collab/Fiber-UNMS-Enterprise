<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Models\OltDevice;
use App\Models\AuditLog;
use App\Models\OntRegistration;

class ListenOltEvents extends Command
{
    protected $signature = 'olt:listen-events {--syslog-port=514} {--trap-port=162}';
    protected $description = 'Listen to OLT SNMP Traps & Syslog UDP events for sub-second Sudden Loss & Instant Recovery detection';

    public function handle()
    {
        $syslogPort = (int)$this->option('syslog-port');
        $trapPort   = (int)$this->option('trap-port');

        $this->info("══════════════════════════════════════════════════════════════════");
        $this->info("🛰️  FIBER UNMS EVENT LISTENER DAEMON (SUB-SECOND DETECTOR)");
        $this->info("══════════════════════════════════════════════════════════════════");
        $this->info("📡 Syslog Listener Port : UDP {$syslogPort}");
        $this->info("⚡ SNMP Trap Listener   : UDP {$trapPort}");

        // 1. Buat socket Syslog UDP
        $syslogSocket = @socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
        if ($syslogSocket) {
            socket_set_option($syslogSocket, SOL_SOCKET, SO_REUSEADDR, 1);
            if (!@socket_bind($syslogSocket, '0.0.0.0', $syslogPort)) {
                $err = socket_strerror(socket_last_error($syslogSocket));
                $this->warn("⚠️  Gagal bind Syslog port {$syslogPort}: {$err}");
                $syslogSocket = null;
            } else {
                socket_set_nonblock($syslogSocket);
                $this->info("✅ Syslog UDP listener aktif pada 0.0.0.0:{$syslogPort}");
            }
        }

        // 2. Buat socket SNMP Trap UDP
        $trapSocket = @socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
        if ($trapSocket) {
            socket_set_option($trapSocket, SOL_SOCKET, SO_REUSEADDR, 1);
            if (!@socket_bind($trapSocket, '0.0.0.0', $trapPort)) {
                $err = socket_strerror(socket_last_error($trapSocket));
                $this->warn("⚠️  Gagal bind Trap port {$trapPort}: {$err}");
                $trapSocket = null;
            } else {
                socket_set_nonblock($trapSocket);
                $this->info("✅ SNMP Trap UDP listener aktif pada 0.0.0.0:{$trapPort}");
            }
        }

        if (!$syslogSocket && !$trapSocket) {
            $this->error("❌ Kedua listener UDP gagal di-bind. Keluar.");
            return 1;
        }

        $this->info("🚀 Berhasil siap mendengarkan sinyal event dari OLT 24/7...");

        while (true) {
            $read = array_filter([$syslogSocket, $trapSocket]);
            $write = null;
            $except = null;

            if (empty($read)) {
                sleep(1);
                continue;
            }

            $numChanged = @socket_select($read, $write, $except, 1, 0);
            if ($numChanged === false || $numChanged === 0) {
                continue;
            }

            foreach ($read as $sock) {
                $buf = '';
                $fromIp = '';
                $fromPort = 0;
                $bytes = @socket_recvfrom($sock, $buf, 4096, 0, $fromIp, $fromPort);

                if ($bytes > 0 && !empty($buf)) {
                    $this->processIncomingPacket($buf, $fromIp, $sock === $trapSocket ? 'TRAP' : 'SYSLOG');
                }
            }
        }

        return 0;
    }

    protected function processIncomingPacket(string $rawMsg, string $fromIp, string $sourceType)
    {
        $now = now()->toDateTimeString();
        $cleanMsg = trim(preg_replace('/[\x00-\x1F\x7F]/', ' ', $rawMsg));

        // 1. Temukan OLT berdasarkan IP pengirim
        $olt = OltDevice::where('ip_address', $fromIp)->first();
        if (!$olt) {
            $olt = OltDevice::where('status', 'active')->first();
        }

        $oltName = $olt ? $olt->name : "OLT ({$fromIp})";
        $oltId   = $olt ? $olt->id : null;

        $isAlarmLoss = false;
        $isAlarmRecovery = false;
        $portRef = null;
        $onuId = null;
        $eventLabel = '';

        // Regex ZTE GPON / EPON
        if (preg_match('/(?:GPON|EPON)-ALARM:?\s*ONU\s+([0-9\/\:\_\-]+)\s+(.+)/i', $cleanMsg, $matches)) {
            $onuPath = trim($matches[1]);
            $restDesc = trim($matches[2]);

            if (strpos($onuPath, ':') !== false) {
                [$portRef, $onuId] = explode(':', $onuPath, 2);
            } else {
                $portRef = $onuPath;
            }

            if (preg_match('/(Loss of Signal|LOS|Dying Gasp|DyingGasp|Down|Wire down|Power off|Offline)/i', $restDesc)) {
                $isAlarmLoss = true;
                $eventLabel = preg_match('/Dying Gasp/i', $restDesc) ? 'Dying Gasp (Mati Listrik)' : 'Loss of Signal (Kabel Putus / LOS)';
            } elseif (preg_match('/(cleared|Online|Up|Working|Recovered)/i', $restDesc)) {
                $isAlarmRecovery = true;
                $eventLabel = 'Koneksi Pulih (Online)';
            }
        } elseif (preg_match('/(?:ONU|ONT)\s+([0-9\/\:\_\-]+).*?(LOS|Loss of Signal|Dying Gasp|down|offline|cleared|online|up)/i', $cleanMsg, $matches)) {
            $onuPath = trim($matches[1]);
            $actionWord = strtolower(trim($matches[2]));

            if (strpos($onuPath, ':') !== false) {
                [$portRef, $onuId] = explode(':', $onuPath, 2);
            } else {
                $portRef = $onuPath;
            }

            if (in_array($actionWord, ['los', 'loss of signal', 'dying gasp', 'down', 'offline'])) {
                $isAlarmLoss = true;
                $eventLabel = 'Loss of Signal (LOS)';
            } else {
                $isAlarmRecovery = true;
                $eventLabel = 'Koneksi Pulih (Online)';
            }
        }

        if (!$isAlarmLoss && !$isAlarmRecovery) {
            return;
        }

        $standardPort = $portRef;
        if ($portRef && !str_starts_with($portRef, 'gpon-olt_') && !str_starts_with($portRef, 'epon_')) {
            $standardPort = 'gpon-olt_' . $portRef;
        }

        $this->line("[{$now}] [{$sourceType}] Dari {$fromIp} ({$oltName}): Port {$standardPort}" . ($onuId ? ":{$onuId}" : "") . " -> {$eventLabel}");

        // 3. Masukkan ke Fast-Lane Priority Watchlist
        if ($oltId && $standardPort) {
            $priorityKey = "olt_priority_ports_{$oltId}";
            $currentPriority = Cache::get($priorityKey, []);
            if (!in_array($standardPort, $currentPriority)) {
                $currentPriority[] = $standardPort;
                Cache::put($priorityKey, array_values(array_unique($currentPriority)), now()->addHours(24));
                $this->info("   🏎️  [FAST-LANE ACTIVATED] Port {$standardPort} didaftarkan ke Priority Watchlist OLT ID #{$oltId}!");
            }
        }

        // 4. Cari modem terkait di Database dan Cache
        $targetOnt = null;
        if ($oltId && $onuId) {
            $snapshot = $olt?->last_telemetry_snapshot ?? [];
            $allOnus = $snapshot['onu_list'] ?? [];
            foreach ($allOnus as $so) {
                $p = $so['port'] ?? '';
                $oId = $so['onu_id'] ?? null;
                if (($p === $standardPort || $p === $portRef || str_ends_with($p, $portRef)) && (string)$oId === (string)$onuId) {
                    $targetOnt = $so;
                    break;
                }
            }
        }

        $targetName = $targetOnt['customer_name'] ?? ($targetOnt['name'] ?? "ONU {$standardPort}:{$onuId}");
        $targetSn   = $targetOnt['serial_number'] ?? ($targetOnt['onu_mac'] ?? '—');

        // 5. Update Status & Buat Alarm
        if ($isAlarmLoss) {
            if (!empty($targetSn) && $targetSn !== '—') {
                DB::table('ont_registrations')
                    ->where(function($q) use ($targetSn) {
                        $q->where('onu_serial', $targetSn)->orWhere('onu_mac', $targetSn);
                    })
                    ->update([
                        'status'   => 'inactive',
                        'rx_power' => -40.00,
                        'notes'    => "Sudden Loss via {$sourceType} ({$eventLabel}) pada {$now}",
                    ]);
            }

            // Kirim notifikasi Telegram rapi (tanpa indikasi)
            \App\Services\TelegramService::send(
                "🚨 ALARM GANGGUAN OPTIK (LOS)",
                "<b>Pelanggan:</b> {$targetName}\n" .
                "<b>Serial Number:</b> <code>{$targetSn}</code>\n" .
                "<b>OLT / Port:</b> {$oltName} ({$standardPort})\n" .
                "<b>Status:</b> 🔴 OFFLINE / LOS (-40.00 dBm)",
                'NOC'
            );

            $this->error("   🚨 [ALARM LOS CREATED] Modem {$targetName} seketika dijatuhkan ke -40.00 dBm!");
        } elseif ($isAlarmRecovery) {
            if (!empty($targetSn) && $targetSn !== '—') {
                DB::table('ont_registrations')
                    ->where(function($q) use ($targetSn) {
                        $q->where('onu_serial', $targetSn)->orWhere('onu_mac', $targetSn);
                    })
                    ->update([
                        'status'         => 'active',
                        'last_online_at' => now(),
                        'notes'          => "Online recovery via {$sourceType} pada {$now}",
                    ]);
            }

            \App\Services\TelegramService::send(
                "🟢 PEMULIHAN LAYANAN (RECOVERY)",
                "<b>Pelanggan:</b> {$targetName}\n" .
                "<b>Serial Number:</b> <code>{$targetSn}</code>\n" .
                "<b>OLT / Port:</b> {$oltName} ({$standardPort})\n" .
                "<b>Status:</b> 🟢 ONLINE (Normal)",
                'NOC'
            );

            $this->info("   🟢 [RECOVERY CREATED] Modem {$targetName} terdeteksi kembali online!");
        }
    }
}
