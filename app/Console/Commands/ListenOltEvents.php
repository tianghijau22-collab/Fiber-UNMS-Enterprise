<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\OltDevice;
use App\Models\AuditLog;
use App\Models\OntRegistration;
use App\Models\AppNotification;
use App\Services\SnmpTrapDecoder;
use App\Services\TelegramService;
use App\Services\Olt\SnmpConnector;

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

        Cache::put('snmp_trap_listener_status', [
            'status'        => 'ACTIVE',
            'trap_port'     => $trapPort,
            'syslog_port'   => $syslogPort,
            'started_at'    => now()->toIso8601String(),
            'trap_active'   => (bool)$trapSocket,
            'syslog_active' => (bool)$syslogSocket,
        ], 86400 * 30);

        $lastHeartbeat = 0;
        $lastDbPing    = 0;

        while (true) {
            $nowTs = time();
            if ($nowTs - $lastHeartbeat >= 5) {
                $lastHeartbeat = $nowTs;
                Cache::put('snmp_trap_listener_heartbeat', $nowTs, 30);
            }

            // DB Health Check & Auto-Reconnect setiap 30 detik agar daemon tahan berbulan-bulan tanpa crash
            if ($nowTs - $lastDbPing >= 30) {
                $lastDbPing = $nowTs;
                try {
                    DB::connection()->getPdo();
                } catch (\Throwable $dbEx) {
                    $this->warn("⚠️  [DB AUTO-RECONNECT] Koneksi database terputus. Melakukan reconnect otomatis...");
                    try {
                        DB::purge();
                        DB::reconnect();
                        $this->info("✅ [DB AUTO-RECONNECT] Berhasil tersambung kembali ke database.");
                    } catch (\Throwable $reErr) {
                        $this->error("❌ Gagal reconnect DB: " . $reErr->getMessage());
                    }
                }
            }

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
                    // Proteksi Total: Tangkap segala Exception/Error agar service Listener TIDAK PERNAH crash loop
                    try {
                        $this->processIncomingPacket($buf, $fromIp, $sock === $trapSocket ? 'TRAP' : 'SYSLOG');
                    } catch (\Throwable $packetEx) {
                        $this->error("⚠️  [LISTENER SAFETY CATCH] Error memproses paket dari {$fromIp}: " . $packetEx->getMessage() . " (" . basename($packetEx->getFile()) . ":" . $packetEx->getLine() . ")");
                        Log::error("ListenOltEvents packet error: " . $packetEx->getMessage(), [
                            'from_ip' => $fromIp,
                            'file'    => $packetEx->getFile(),
                            'line'    => $packetEx->getLine(),
                            'trace'   => $packetEx->getTraceAsString(),
                        ]);
                    }
                }
            }
        }

        return 0;
    }

    protected function processIncomingPacket(string $rawMsg, string $fromIp, string $sourceType)
    {
        $now = now()->toDateTimeString();

        // Rekam metrik paket masuk untuk Server Monitoring
        Cache::put('snmp_trap_last_received_at', now()->toIso8601String(), 86400 * 30);
        $todayKey = 'snmp_trap_packets_today_' . now()->toDateString();
        Cache::increment($todayKey);

        // 1. Coba decode via SnmpTrapDecoder (ZTE Trap OIDs, Community Headers, dsb)
        $decoded = SnmpTrapDecoder::decode($rawMsg, $fromIp);

        $serialNumber    = null;
        $eventType       = null;
        $eventLabel      = null;
        $eventLevel      = null;
        $isAlarmLoss     = false;
        $isAlarmRecovery = false;
        $portRef         = null;
        $onuId           = null;

        if ($decoded) {
            $serialNumber    = $decoded['serial_number'] ?? null;
            $eventType       = $decoded['event_type'] ?? null;
            $eventLabel      = $decoded['event_label'] ?? '';
            $eventLevel      = $decoded['event_level'] ?? 'info';
            $isAlarmLoss     = (bool)($decoded['is_loss'] ?? false);
            $isAlarmRecovery = ($eventType === 'RECOVERY');
            $portRef         = $decoded['port_ref'] ?? null;
            $onuId           = $decoded['onu_id'] ?? null;
        }

        // 2. Fallback Regex Syslog / Legacy Text jika belum terdeteksi
        if (!$isAlarmLoss && !$isAlarmRecovery) {
            $cleanMsg = trim(preg_replace('/[\x00-\x1F\x7F]/', ' ', $rawMsg));
            if (preg_match('/(?:GPON|EPON)-ALARM:?\s*ONU\s+([0-9\/\:\_\-]+)\s+(.+)/i', $cleanMsg, $matches)) {
                $onuPath = trim($matches[1]);
                $restDesc = trim($matches[2]);

                if (strpos($onuPath, ':') !== false) {
                    [$portRef, $onuId] = explode(':', $onuPath, 2);
                } else {
                    $portRef = $onuPath;
                }

                if (preg_match('/(Loss of Signal|LOS|Wire down|Down|Offline)/i', $restDesc)) {
                    $isAlarmLoss = true;
                    $eventType = 'LOS';
                    $eventLabel = 'Loss of Signal (Kabel Putus / LOS)';
                } elseif (preg_match('/(Dying\s*Gasp|Power\s*off|Power\s*fail)/i', $restDesc)) {
                    $isAlarmLoss = true;
                    $eventType = 'DYING_GASP';
                    $eventLabel = 'Dying Gasp (Mati Listrik / Power Cut)';
                } elseif (preg_match('/(cleared|Online|Up|Working|Recovered)/i', $restDesc)) {
                    $isAlarmRecovery = true;
                    $eventType = 'RECOVERY';
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

                if (in_array($actionWord, ['dying gasp', 'power off'])) {
                    $isAlarmLoss = true;
                    $eventType = 'DYING_GASP';
                    $eventLabel = 'Dying Gasp (Mati Listrik / Power Cut)';
                } elseif (in_array($actionWord, ['los', 'loss of signal', 'down', 'offline'])) {
                    $isAlarmLoss = true;
                    $eventType = 'LOS';
                    $eventLabel = 'Loss of Signal (LOS)';
                } else {
                    $isAlarmRecovery = true;
                    $eventType = 'RECOVERY';
                    $eventLabel = 'Koneksi Pulih (Online)';
                }
            }
        }

        if (!$isAlarmLoss && !$isAlarmRecovery) {
            return;
        }

        // GUARD FILTER: Pastikan event ini adalah event ONU modem pelanggan!
        if (empty($serialNumber) && empty($portRef) && empty($onuId)) {
            return;
        }

        // 3. Resolusi Perangkat OLT Pengirim
        $olt = OltDevice::where('ip_address', $fromIp)->first();

        // Jika trap lewat NAT / MikroTik Gateway (10.254.0.2 / 10.116.10.107) atau IP tidak langsung match
        if (!$olt && $serialNumber) {
            $devicesWithSnap = OltDevice::whereNotNull('last_telemetry_snapshot')->get();
            foreach ($devicesWithSnap as $dev) {
                $snap = $dev->last_telemetry_snapshot ?? [];
                $allOnus = array_merge($snap['onu_list'] ?? [], $snap['unconfigured_onus'] ?? []);
                foreach ($allOnus as $so) {
                    if (strcasecmp($so['serial_number'] ?? '', $serialNumber) === 0 || strcasecmp($so['onu_mac'] ?? '', $serialNumber) === 0) {
                        $olt = $dev;
                        if (!$portRef && !empty($so['port'])) $portRef = $so['port'];
                        if (!$onuId && !empty($so['onu_id'])) $onuId = $so['onu_id'];
                        break 2;
                    }
                }
            }
        }

        if (!$olt) {
            $olt = OltDevice::where('status', 'active')->first();
        }

        $oltName = $olt ? $olt->name : "OLT ({$fromIp})";
        $oltId   = $olt ? $olt->id : null;

        // 4. Standarisasi Format Port OLT (misal gpon-olt_1/2/4)
        $standardPort = $portRef;
        if ($portRef && !str_starts_with($portRef, 'gpon-olt_') && !str_starts_with($portRef, 'epon_')) {
            if (preg_match('/^[0-9]+\/[0-9]+\/[0-9]+$/', $portRef)) {
                $standardPort = 'gpon-olt_' . $portRef;
            } elseif (is_numeric($portRef)) {
                if ($olt && !empty($olt->last_telemetry_snapshot['pon_ports'])) {
                    foreach ($olt->last_telemetry_snapshot['pon_ports'] as $pp) {
                        if (str_ends_with($pp['port_id'] ?? '', "/{$portRef}")) {
                            $standardPort = $pp['port_id'];
                            break;
                        }
                    }
                }
                if (!$standardPort || is_numeric($standardPort)) {
                    $standardPort = 'gpon-olt_' . $portRef;
                }
            } else {
                $standardPort = 'gpon-olt_' . $portRef;
            }
        }

        // 5. Cari Data Pelanggan & Lokasi ODP di Database
        $reg = null;
        if ($serialNumber) {
            $reg = DB::table('ont_registrations')
                ->leftJoin('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                ->leftJoin('customers', 'customers.id', '=', 'customer_services.customer_id')
                ->leftJoin('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                ->leftJoin('network_nodes', 'network_nodes.id', '=', 'network_ports.node_id')
                ->where('ont_registrations.onu_serial', $serialNumber)
                ->orWhere('ont_registrations.onu_mac', $serialNumber)
                ->select([
                    'ont_registrations.*',
                    'customers.customer_number as customer_number',
                    'customers.id as customer_id',
                    'customers.name as customer_name',
                    'customers.phone as customer_phone',
                    'customer_services.id as service_id',
                    'network_nodes.id as node_id',
                    'network_nodes.name as node_name',
                    'network_nodes.code as node_code',
                    'network_ports.port_number as odp_port_number',
                ])
                ->first();
        }

        // Fallback pencarian melalui snapshot OLT jika di database belum ada serial
        $targetOnt = null;
        if ($oltId) {
            $snapshot = $olt?->last_telemetry_snapshot ?? [];
            $allOnus = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
            foreach ($allOnus as $so) {
                $matchSn = $serialNumber && (strcasecmp($so['serial_number'] ?? '', $serialNumber) === 0 || strcasecmp($so['onu_mac'] ?? '', $serialNumber) === 0);
                $p = $so['port'] ?? '';
                $oId = $so['onu_id'] ?? null;
                $matchPort = ($p === $standardPort || $p === $portRef || str_ends_with($p, (string)$portRef)) && (string)$oId === (string)$onuId;

                if ($matchSn || $matchPort) {
                    $targetOnt = $so;
                    if (!$serialNumber && !empty($so['serial_number'])) {
                        $serialNumber = $so['serial_number'];
                    }
                    break;
                }
            }
        }

        $targetName   = $reg?->customer_name ?? ($targetOnt['customer_name'] ?? ($targetOnt['name'] ?? null));
        $targetSn     = $serialNumber ?: ($reg?->onu_serial ?? ($targetOnt['serial_number'] ?? null));
        $targetCustId = $reg?->customer_number ?: ($reg?->customer_id ? "ID-{$reg->customer_id}" : null);
        $nodeId       = $reg?->node_id ?? null;
        $nodeName     = $reg?->node_name ?? null;

        // 🚨 KHUSUS EVENT LEVEL PORT / SFP FISIK DICABUT (PORT_DOWN):
        if ($eventType === 'PORT_DOWN' && $standardPort && $olt) {
            $this->error("[{$now}] [{$sourceType}] Dari {$fromIp} ({$oltName}): Interface {$standardPort} SFP DICABUT / PORT LINK DOWN!");

            // 1. Ambil seluruh ONU pada interface ini
            $onusOnPort = $this->getAllOnusOnInterface($olt, $standardPort);
            $serials = collect($onusOnPort)->pluck('sn')->filter()->toArray();

            // 2. SEGERA update status database seluruh pelanggan di port ini menjadi inactive & -40.00 dBm (REALTIME!)
            if (!empty($serials)) {
                DB::table('ont_registrations')
                    ->whereIn('onu_serial', $serials)
                    ->update([
                        'status'     => 'inactive',
                        'rx_power'   => -40.00,
                        'updated_at' => now(),
                    ]);
                $this->warn("   ⚡ [REALTIME DB SYNC] " . count($serials) . " modem pada {$standardPort} seketika diupdate ke -40.00 dBm (LOS)!");
            }

            // 3. Masukkan semua pelanggan ke window loss interface & picu notifikasi gangguan massal interface
            $windowKey = "interface_loss_window_{$oltId}_{$standardPort}";
            $nowTs = time();
            $window = [];
            foreach ($onusOnPort as $o) {
                $window[] = [
                    'sn'      => $o['sn'],
                    'name'    => $o['name'],
                    'cust_id' => $o['cust_id'],
                    'odp'     => $o['node'],
                    'type'    => 'PORT_DOWN',
                    'rx'      => '-40.00 dBm (PORT DOWN)',
                    'time'    => $nowTs,
                ];
            }
            Cache::put($windowKey, $window, 300);

            // Trigger alert interface mass outage
            $this->handleInterfaceMassOutageGuard(
                $olt,
                $standardPort,
                $serials[0] ?? 'PORT_DOWN',
                'Kabel Feeder / SFP Port',
                null,
                'PORT_DOWN',
                true,
                null,
                null
            );

            // Masukkan port ke priority watchlist agar langsung di-poll saat pulih
            Cache::put("olt_priority_ports_{$oltId}", array_unique(array_merge(Cache::get("olt_priority_ports_{$oltId}", []), [$standardPort])), 86400);

            return;
        }

        // 🟢 KHUSUS EVENT LEVEL PORT / SFP FISIK TERPASANG (PORT_UP):
        if ($eventType === 'PORT_UP' && $standardPort && $olt) {
            $this->info("[{$now}] [{$sourceType}] Dari {$fromIp} ({$oltName}): Interface {$standardPort} SFP TERPASANG / PORT LINK UP!");

            $onusOnPort = $this->getAllOnusOnInterface($olt, $standardPort);
            $serials = collect($onusOnPort)->pluck('sn')->filter()->toArray();

            // Trigger recovery di guard
            $this->handleInterfaceMassOutageGuard(
                $olt,
                $standardPort,
                $serials[0] ?? 'PORT_UP',
                'Kabel Feeder / SFP Port',
                null,
                'RECOVERY',
                false,
                -20.00,
                null
            );

            // Masukkan port ke priority watchlist agar langsung di-poll seketika untuk mendapatkan redaman asli
            Cache::put("olt_priority_ports_{$oltId}", array_unique(array_merge(Cache::get("olt_priority_ports_{$oltId}", []), [$standardPort])), 86400);

            return;
        }

        // GUARD: Jika setelah semua lookup tidak ada Serial Number DAN tidak ada port yang jelas, abaikan!
        if (empty($targetSn) && (empty($standardPort) || empty($onuId))) {
            return;
        }

        if (empty($targetName)) {
            $targetName = "ONU " . ($standardPort ? "{$standardPort}:{$onuId}" : ($targetSn ?: 'Unknown'));
        }
        if (empty($targetSn)) {
            $targetSn = '—';
        }

        $this->line("[{$now}] [{$sourceType}] Dari {$fromIp} ({$oltName}): Port {$standardPort}" . ($onuId ? ":{$onuId}" : "") . " [SN: {$targetSn}] -> {$eventLabel}");

        // 6. Masukkan Port ke Fast-Lane Priority Watchlist untuk Telemetry Poller
        if ($oltId && $standardPort) {
            $priorityKey = "olt_priority_ports_{$oltId}";
            $currentPriority = Cache::get($priorityKey, []);
            if (!in_array($standardPort, $currentPriority)) {
                $currentPriority[] = $standardPort;
                Cache::put($priorityKey, array_values(array_unique($currentPriority)), now()->addHours(24));
                $this->info("   🏎️  [FAST-LANE ACTIVATED] Port {$standardPort} masuk antrian prioritas OLT #{$oltId}!");
            }
        }

        // 7. Eksekusi Pembacaan Redaman Instan jika Event adalah RECOVERY (~50ms Direct SNMP)
        $recoveredRxPower = null;
        if ($isAlarmRecovery && $olt) {
            $queryPort = $targetOnt['port'] ?? $standardPort;
            $queryOnuId = $targetOnt['onu_id'] ?? $onuId;
            $recoveredRxPower = $this->queryInstantRxPower($olt, $queryPort, (int)$queryOnuId);
        }

        // 8. Deteksi Gangguan Massal per Interface (Correlated Mass Outage Detector)
        $suppressIndividualAlert = false;
        if ($olt && $standardPort) {
            $suppressIndividualAlert = $this->handleInterfaceMassCorrelator(
                $olt,
                $standardPort,
                $targetSn,
                $targetName,
                $nodeName,
                $eventType ?: 'LOS',
                $isAlarmLoss,
                $recoveredRxPower,
                $targetCustId
            );
        }

        // 9. Eksekusi Sinkronisasi Database & Snapshot OLT
        if ($isAlarmLoss) {
            // A. Update ont_registrations
            if (!empty($targetSn) && $targetSn !== '—') {
                DB::table('ont_registrations')
                    ->where('onu_serial', $targetSn)
                    ->orWhere('onu_mac', $targetSn)
                    ->update([
                        'status'     => 'inactive',
                        'rx_power'   => -40.00,
                        'notes'      => "Sudden Loss via {$sourceType} ({$eventLabel}) pada {$now}",
                        'updated_at' => now(),
                    ]);
            }

            // B. Sinkronkan In-Memory Database Snapshot OLT agar GIS & Telemetry langsung konsisten
            if ($olt && !empty($olt->last_telemetry_snapshot)) {
                $snapshot = $olt->last_telemetry_snapshot;
                $snapChanged = false;
                foreach (['onu_list', 'unconfigured_onus'] as $listKey) {
                    if (!empty($snapshot[$listKey])) {
                        foreach ($snapshot[$listKey] as &$so) {
                            $matchSn = !empty($targetSn) && $targetSn !== '—' && (
                                strcasecmp($so['serial_number'] ?? '', $targetSn) === 0 ||
                                strcasecmp($so['onu_mac'] ?? '', $targetSn) === 0 ||
                                strcasecmp($so['mac_address'] ?? '', $targetSn) === 0
                            );
                            $matchPortOnu = ($so['port'] ?? '') === $standardPort && (string)($so['onu_id'] ?? '') === (string)$onuId;

                            if ($matchSn || $matchPortOnu) {
                                $so['status'] = 'offline';
                                $so['rx_power'] = -40.00;
                                $so['last_down_cause'] = $eventLabel;
                                $snapChanged = true;
                                break;
                            }
                        }
                        unset($so);
                    }
                }
                if ($snapChanged) {
                    $olt->update(['last_telemetry_snapshot' => $snapshot]);
                }
            }

            $this->error("   🚨 [ALARM CREATED] Modem {$targetName} ({$targetSn}) seketika dijatuhkan ke -40.00 dBm!");
        } elseif ($isAlarmRecovery) {
            // A. Update ont_registrations
            if (!empty($targetSn) && $targetSn !== '—') {
                $updateData = [
                    'status'         => 'active',
                    'last_online_at' => now(),
                    'notes'          => "Online recovery via {$sourceType}" . ($recoveredRxPower ? " ({$recoveredRxPower} dBm)" : "") . " pada {$now}",
                    'updated_at'     => now(),
                ];
                if ($recoveredRxPower !== null) {
                    $updateData['rx_power'] = $recoveredRxPower;
                }

                DB::table('ont_registrations')
                    ->where('onu_serial', $targetSn)
                    ->orWhere('onu_mac', $targetSn)
                    ->update($updateData);
            }

            // B. Sinkronkan In-Memory Database Snapshot OLT
            if ($olt && !empty($olt->last_telemetry_snapshot)) {
                $snapshot = $olt->last_telemetry_snapshot;
                $snapChanged = false;
                foreach (['onu_list', 'unconfigured_onus'] as $listKey) {
                    if (!empty($snapshot[$listKey])) {
                        foreach ($snapshot[$listKey] as &$so) {
                            $matchSn = !empty($targetSn) && $targetSn !== '—' && (
                                strcasecmp($so['serial_number'] ?? '', $targetSn) === 0 ||
                                strcasecmp($so['onu_mac'] ?? '', $targetSn) === 0 ||
                                strcasecmp($so['mac_address'] ?? '', $targetSn) === 0
                            );
                            $matchPortOnu = ($so['port'] ?? '') === $standardPort && (string)($so['onu_id'] ?? '') === (string)$onuId;

                            if ($matchSn || $matchPortOnu) {
                                $so['status'] = 'online';
                                if ($recoveredRxPower !== null) {
                                    $so['rx_power'] = $recoveredRxPower;
                                }
                                $so['last_down_cause'] = null;
                                $snapChanged = true;
                                break;
                            }
                        }
                        unset($so);
                    }
                }
                if ($snapChanged) {
                    $olt->update(['last_telemetry_snapshot' => $snapshot]);
                }
            }

            $rxDesc = $recoveredRxPower ? " [{$recoveredRxPower} dBm]" : "";
            $this->info("   🟢 [RECOVERY CREATED] Modem {$targetName} ({$targetSn}) terdeteksi pulih online{$rxDesc}!");
        }

        // 9b. Deteksi & Notifikasi Gangguan Massal ODP Real-Time via SNMP Trap (Sub-Detik)
        if ($nodeId && !$suppressIndividualAlert) {
            $this->handleOdpMassCorrelator(
                (int)$nodeId,
                $nodeName ?: "ODP #{$nodeId}",
                $standardPort,
                $olt,
                $isAlarmLoss,
                $isAlarmRecovery
            );
        }

        // 10. Invalidate Cache Peta GIS & Dashboard Metrics agar UI Langsung Update Real-Time
        Cache::forget('gis_map_data_payload_v1');
        Cache::forget('gis_topology_hierarchy_all');
        Cache::forget('dashboard_metrics_payload');

        // 11. Simpan ke Cache Queue 'telemetry_live_events' untuk Streaming Frontend (Live Map)
        $recentEvents = Cache::get('telemetry_live_events', []);
        $eventItem = [
            'id'            => (string)Str::uuid(),
            'timestamp'     => now()->toIso8601String(),
            'time_human'    => now()->format('H:i:s'),
            'olt_id'        => $oltId,
            'olt_name'      => $oltName,
            'event_type'    => $eventType ?: ($isAlarmLoss ? 'LOS' : 'RECOVERY'),
            'event_label'   => $eventLabel,
            'event_level'   => $eventLevel,
            'is_loss'       => $isAlarmLoss,
            'serial_number' => $targetSn,
            'customer_name' => $targetName,
            'node_id'       => $nodeId,
            'node_name'     => $nodeName,
            'port'          => $standardPort,
            'onu_id'        => $onuId,
            'rx_power'      => $isAlarmLoss ? -40.00 : $recoveredRxPower,
        ];
        array_unshift($recentEvents, $eventItem);
        if (count($recentEvents) > 50) {
            $recentEvents = array_slice($recentEvents, 0, 50);
        }
        Cache::put('telemetry_live_events', $recentEvents, 300);

        // Rekam ke snmp_trap_recent_logs untuk halaman Server Monitoring
        $trapLogs = Cache::get('snmp_trap_recent_logs', []);
        $trapLogEntry = [
            'id'          => uniqid('trap_'),
            'time'        => now()->format('H:i:s'),
            'timestamp'   => now()->toIso8601String(),
            'from_ip'     => $fromIp,
            'olt_id'      => $oltId,
            'olt_name'    => $oltName ?: "OLT ({$fromIp})",
            'source_type' => $sourceType,
            'event_type'  => $eventType ?: ($isAlarmLoss ? 'LOS' : ($isAlarmRecovery ? 'RECOVERY' : 'EVENT')),
            'event_label' => $eventLabel,
            'event_level' => $eventLevel,
            'target_name' => $targetName,
            'target_sn'   => $targetSn,
            'port'        => $standardPort,
            'onu_id'      => $onuId,
            'odp'         => $nodeName,
            'rx_power'    => $isAlarmLoss ? -40.00 : $recoveredRxPower,
        ];
        array_unshift($trapLogs, $trapLogEntry);
        if (count($trapLogs) > 50) {
            $trapLogs = array_slice($trapLogs, 0, 50);
        }
        Cache::put('snmp_trap_recent_logs', $trapLogs, 86400 * 7);

        // Rekam aktivitas terakhir per IP OLT
        Cache::put("snmp_trap_last_from_{$fromIp}", [
            'time'        => now()->format('H:i:s'),
            'timestamp'   => now()->toIso8601String(),
            'event_label' => $eventLabel,
            'target_name' => $targetName,
            'port'        => $standardPort,
            'event_type'  => $eventType,
        ], 86400 * 30);

        // 12. Rekam ke Audit Logs
        try {
            DB::table('audit_logs')->insert([
                'user_name'   => 'SYSTEM_TRAP_LISTENER',
                'user_role'   => 'system',
                'action'      => $eventType ?: ($isAlarmLoss ? 'LOS' : 'RECOVERY'),
                'module'      => 'SNMP_TRAP_MONITOR',
                'description' => "{$eventLabel} pada {$targetName} (SN: {$targetSn}) di {$oltName} Port {$standardPort}" . ($recoveredRxPower ? " [{$recoveredRxPower} dBm]" : "") . ($nodeName ? " [ODP: {$nodeName}]" : ""),
                'ip_address'  => $fromIp,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            // Ignore audit log error if any
        }

        // 13. Kirim Notifikasi Telegram Real-Time (Kecuali jika disupresi karena sedang gangguan massal)
        if ($targetSn === '—' && (empty($standardPort) || empty($onuId))) {
            return;
        }

        // FILTER 1: Hanya kirim alarm layanan ke Telegram untuk modem yang terdaftar ke PELANGGAN RESMI (ont_registrations)
        // Modem unconfigured / rogue / testing yang tercolok di splitter tidak boleh membunyikan alarm layanan pelanggan!
        if (!$reg) {
            $this->line("   ℹ️ [UNREGISTERED ONU] Modem {$targetSn} belum terdaftar ke pelanggan. Notifikasi Telegram dilewati.");
            return;
        }

        // FILTER 2: State Machine Transition Check
        // Hanya kirim notifikasi jika TERJADI PERUBAHAN STATUS NYATA (bukan paket re-transmisi / alarm sekunder yang sama)
        $previousState = Cache::get("ont_live_state_{$targetSn}", $reg->status ?? 'active');
        $newState = $isAlarmLoss ? 'inactive' : 'active';

        if ($previousState === $newState) {
            $this->line("   ℹ️ [STATE UNCHANGED] Status modem {$targetName} ({$targetSn}) sudah {$newState}. Mengabaikan notifikasi Telegram redundan.");
            return;
        }
        Cache::put("ont_live_state_{$targetSn}", $newState, 86400);

        // 13. Kebijakan Anti-Spam Telegram NOC: Redam Notifikasi Individual
        // Telegram NOC difokuskan 100% eksklusif untuk 4 Pilar Gangguan Massal (ODP & Interface PON)
        $this->line("   ℹ️ [INDIVIDUAL ALERT SUPPRESSED] Alert individual untuk {$targetName} ({$targetSn}) diredam. Telegram eksklusif untuk insiden massal.");
        return;
    }

    /**
     * Correlate and detect mass outage / feeder cut per PON interface in real-time.
     * Returns true if individual Telegram notification should be suppressed.
     */
    protected function handleInterfaceMassCorrelator(
        OltDevice $olt,
        string $standardPort,
        string $targetSn,
        string $targetName,
        ?string $nodeName,
        string $eventType,
        bool $isLoss,
        ?float $recoveredRxPower = null,
        ?string $targetCustId = null
    ): bool {
        $oltId = $olt->id;
        $oltName = $olt->name;
        $nowTs = time();

        $activeMassKey = "interface_in_mass_outage_{$oltId}_{$standardPort}";
        $isCurrentlyInMassOutage = (bool)Cache::get($activeMassKey, false);

        if ($isLoss) {
            // Sliding window 60 detik untuk event loss pada interface ini
            $windowKey = "interface_loss_window_{$oltId}_{$standardPort}";
            $window = Cache::get($windowKey, []);

            // Filter entries older than 60 seconds
            $window = array_values(array_filter($window, fn($item) => ($nowTs - ($item['time'] ?? 0)) <= 60));

            // Tambahkan event ini jika belum ada SN yang sama di window
            $alreadyRecorded = collect($window)->contains('sn', $targetSn);
            if (!$alreadyRecorded) {
                $window[] = [
                    'sn'      => $targetSn,
                    'name'    => $targetName,
                    'cust_id' => $targetCustId,
                    'odp'     => $nodeName,
                    'type'    => $eventType, // LOS or DYING_GASP
                    'rx'      => ($eventType === 'DYING_GASP') ? 'Mati Listrik' : 'LOS (-40.00 dBm)',
                    'time'    => $nowTs,
                ];
                Cache::put($windowKey, $window, 120);
            }

            $countInWindow = count($window);

            // Ambil data seluruh pelanggan terdaftar pada interface ini
            $allOnusOnPort = $this->getAllOnusOnInterface($olt, $standardPort);
            $totalOnPort = count($allOnusOnPort);

            // Buat index mapping SN untuk lookup cepat data pelanggan
            $onuInfoMap = collect($allOnusOnPort)->keyBy('sn');

            // 🎯 AMBANG BATAS NYATA GANGGUAN MASSAL INTERFACE:
            // 1. Interface harus memiliki pelanggan terdaftar (minimal 4).
            // 2. Jika pelanggan >= 10: minimal 60% pelanggan down, ATAU minimal 12 pelanggan down serempak.
            // 3. Jika pelanggan < 10: minimal 75% pelanggan down (misal 3 dari 4, 4 dari 5, dst).
            // Catatan: Jika hanya 2-4 modem mati dari 40 pelanggan (hanya ~7%), itu BUKAN gangguan massal interface.
            $isMassOutage = false;
            if ($totalOnPort >= 10) {
                $pctThreshold = (int)ceil($totalOnPort * 0.60);
                $isMassOutage = ($countInWindow >= $pctThreshold) || ($countInWindow >= 12);
            } elseif ($totalOnPort >= 4) {
                $pctThreshold = max(3, (int)ceil($totalOnPort * 0.75));
                $isMassOutage = ($countInWindow >= $pctThreshold);
            }

            if ($isMassOutage) {
                $alertCooldownKey = "interface_mass_alert_sent_{$oltId}_{$standardPort}";
                $alreadyAlerted = Cache::has($alertCooldownKey);

                if (!$alreadyAlerted) {
                    Cache::put($alertCooldownKey, true, now()->addMinutes(15));
                    Cache::put($activeMassKey, true, now()->addHours(2));

                    // Analisa dominan penyebab: LOS (Kabel Putus) vs Dying Gasp (Mati Listrik)
                    $dyingCount = collect($window)->where('type', 'DYING_GASP')->count();
                    $losCount   = collect($window)->where('type', 'LOS')->count();

                    if ($dyingCount > $losCount && $dyingCount >= 2) {
                        $causeTitle = "⚡ MATI LISTRIK AREA / ODC (DYING GASP MASSAL)";
                        $causeDesc  = "Mayoritas modem mengirim sinyal Dying Gasp. Indikasi sumber daya listrik PLN atau power suplai ODC padam bersamaan.";
                    } elseif ($losCount >= $dyingCount) {
                        $causeTitle = "🚨 KABEL FEEDER UTAMA PUTUS (LOS MASSAL)";
                        $causeDesc  = "Sinyal optik terputus seketika pada banyak modem. Indikasi kabel feeder/distribusi utama terputus atau tertekuk parah.";
                    } else {
                        $causeTitle = "⚠️ GANGGUAN MASSAL PADA INTERFACE";
                        $causeDesc  = "Banyak modem pada interface ini offline hampir bersamaan.";
                    }

                    // HANYA tampilkan pelanggan yang BENAR-BENAR TERDAMPAK (ada di $window)
                    $sampleList = [];
                    $displayList = $window;
                    $displayCount = count($displayList);

                    foreach (array_slice($displayList, 0, 30) as $idx => $o) {
                        $cSn = $o['sn'] ?? '—';
                        $matched = $onuInfoMap->get($cSn);
                        $cName  = $matched['name'] ?? ($o['name'] ?? 'Pelanggan');
                        $cId    = $matched['cust_id'] ?? ($o['cust_id'] ?? '');
                        $cIdStr = $cId ? "[{$cId}] " : "";
                        $odpStr = !empty($matched['node']) ? " (ODP: {$matched['node']})" : (!empty($o['odp']) ? " (ODP: {$o['odp']})" : "");
                        $rxDesc = ($o['type'] === 'DYING_GASP') ? 'Mati Listrik (Dying Gasp)' : '-40.00 dBm (LOS)';

                        $sampleList[] = ($idx + 1) . ". 🔴 {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$cSn}</code> • <code>{$rxDesc}</code>";
                    }
                    if ($displayCount > 30) {
                        $sampleList[] = "<i>... dan " . ($displayCount - 30) . " pelanggan terdampak lainnya pada interface {$standardPort}</i>";
                    }
                    $sampleListText = implode("\n", $sampleList);
                    $pctDown = $totalOnPort > 0 ? round(($countInWindow / $totalOnPort) * 100) : 100;
                    $totalTerdampakText = "🔴 <b>{$countInWindow} dari {$totalOnPort} Pelanggan ({$pctDown}% Terdampak)</b>";

                    // Kirim Notifikasi Alarm Gangguan Massal ke Telegram
                    TelegramService::send(
                        "🚨🚨 ALARM GANGGUAN MASSAL INTERFACE 🚨🚨",
                        "<b>• OLT:</b> {$oltName}\n" .
                        "<b>• Interface / Port:</b> <code>{$standardPort}</code>\n" .
                        "<b>• Penyebab:</b> {$causeTitle}\n" .
                        "<b>• Total Terdampak:</b> {$totalTerdampakText}\n\n" .
                        "<b>Daftar Pelanggan Terdampak:</b>\n{$sampleListText}",
                        'NOC',
                        null,
                        'SNMP_TRAP'
                    );

                    $this->error("   🚨🚨 [MASS OUTAGE DETECTED] Interface {$standardPort} mengalami gangguan massal ({$countInWindow}/{$totalOnPort} clients down)!");

                    // Push ke Live Events Queue untuk GIS Map & Web UI
                    $recentEvents = Cache::get('telemetry_live_events', []);
                    $recentEvents[] = [
                        'id'            => (string)Str::uuid(),
                        'timestamp'     => now()->toIso8601String(),
                        'time_human'    => now()->format('H:i:s'),
                        'olt_id'        => $oltId,
                        'olt_name'      => $oltName,
                        'event_type'    => 'MASS_OUTAGE',
                        'event_label'   => "GANGGUAN MASSAL: Port {$standardPort} ({$countInWindow}/{$totalOnPort} Pelanggan)",
                        'event_level'   => 'critical',
                        'is_loss'       => true,
                        'serial_number' => 'MASS_OUTAGE',
                        'customer_name' => "{$countInWindow} dari {$totalOnPort} Pelanggan pada {$standardPort}",
                        'node_id'       => null,
                        'node_name'     => "Feeder {$standardPort}",
                        'port'          => $standardPort,
                        'onu_id'        => null,
                        'rx_power'      => -40.00,
                    ];
                    Cache::put('telemetry_live_events', $recentEvents, 300);
                    Cache::forget('dashboard_metrics_payload');

                    // Catat ke Audit Log
                    try {
                        DB::table('audit_logs')->insert([
                            'user_name'   => 'SYSTEM_MASS_DETECTOR',
                            'user_role'   => 'system',
                            'action'      => 'MASS_OUTAGE',
                            'module'      => 'OPTICAL_FAULT_DETECTOR',
                            'description' => "Gangguan massal pada {$oltName} Port {$standardPort}: {$countInWindow} dari {$totalOnPort} modem down ({$causeTitle})",
                            'ip_address'  => $olt->ip_address ?? '127.0.0.1',
                            'created_at'  => now(),
                            'updated_at'  => now(),
                        ]);
                    } catch (\Throwable $e) {}
                }

                return true;
            }

            return $isCurrentlyInMassOutage;
        } else {
            // JIKA EVENT ADALAH RECOVERY:
            $windowKey = "interface_loss_window_{$oltId}_{$standardPort}";
            $window = Cache::get($windowKey, []);
            if (!empty($window)) {
                $window = array_values(array_filter($window, fn($item) => ($item['sn'] ?? '') !== $targetSn));
                Cache::put($windowKey, $window, 120);
            }

            // Jika interface ini sebelumnya memang tercatat sedang dalam status Mass Outage
            if ($isCurrentlyInMassOutage) {
                $recKey = "interface_recovery_window_{$oltId}_{$standardPort}";
                $recWindow = Cache::get($recKey, []);
                $recWindow = array_values(array_filter($recWindow, fn($item) => ($nowTs - ($item['time'] ?? 0)) <= 120));

                if (!collect($recWindow)->contains('sn', $targetSn)) {
                    $recWindow[] = [
                        'sn'      => $targetSn,
                        'name'    => $targetName,
                        'cust_id' => $targetCustId,
                        'odp'     => $nodeName,
                        'rx'      => ($recoveredRxPower !== null && is_numeric($recoveredRxPower) && (float)$recoveredRxPower > -35.0) ? (float)$recoveredRxPower : -40.00,
                        'time'    => $nowTs,
                    ];
                    Cache::put($recKey, $recWindow, 180);
                }

                $recoveredCount = count($recWindow);

                // Ambil SELURUH pelanggan yang ada pada interface ini
                $allRecoveredOnPort = $this->getAllOnusOnInterface($olt, $standardPort);
                $totalRecOnPort = count($allRecoveredOnPort);

                // Kriteria Pemulihan Interface Massal:
                // Minimal 50% dari total pelanggan pada port telah pulih online (atau minimal 8 modem)
                $recThreshold = $totalRecOnPort >= 10 ? max(6, (int)ceil($totalRecOnPort * 0.50)) : max(3, (int)ceil($totalRecOnPort * 0.60));

                if ($recoveredCount >= $recThreshold) {
                    $recAlertCooldownKey = "interface_mass_recovery_alert_{$oltId}_{$standardPort}";
                    if (!Cache::has($recAlertCooldownKey)) {
                        Cache::put($recAlertCooldownKey, true, now()->addMinutes(15));
                        Cache::forget($activeMassKey);
                        Cache::forget("interface_mass_alert_sent_{$oltId}_{$standardPort}");
                        Cache::forget($windowKey);
                        Cache::forget('dashboard_metrics_payload');

                        $displayRecList = $totalRecOnPort > 0 ? $allRecoveredOnPort : $recWindow;
                        $displayRecCount = count($displayRecList);

                        $recList = [];
                        $actualOnlineCount = 0;
                        foreach (array_slice($displayRecList, 0, 30) as $idx => $rw) {
                            $cName  = $rw['name'] ?? ($rw['customer_name'] ?? 'Pelanggan');
                            $cSn    = $rw['sn'] ?? ($rw['serial_number'] ?? '—');
                            $cId    = !empty($rw['cust_id']) ? $rw['cust_id'] : (!empty($rw['customer_number']) ? $rw['customer_number'] : (!empty($rw['customer_id']) ? "ID-{$rw['customer_id']}" : ""));
                            $cIdStr = $cId ? "[{$cId}] " : "";
                            $odpStr = !empty($rw['node']) ? " (ODP: {$rw['node']})" : (!empty($rw['odp']) ? " (ODP: {$rw['odp']})" : "");

                            $status = strtolower(trim((string)($rw['status'] ?? '')));
                            $rxVal  = $rw['rx_power'] ?? ($rw['rx'] ?? null);

                            // Ekstrak nilai redaman
                            $rxNum = null;
                            if (is_numeric($rxVal)) {
                                $rxNum = (float)$rxVal;
                            } elseif (is_string($rxVal) && preg_match('/(-?\d+(?:\.\d+)?)/', $rxVal, $m)) {
                                $rxNum = (float)$m[1];
                            }

                            // Klien dianggap Up/Pulih HANYA jika sinyal terukur sehat (> -35.0 dBm dan < -5.0 dBm) dan status bukan offline/los
                            $isUp = ($rxNum !== null && $rxNum > -35.0 && $rxNum < -5.0)
                                && !str_contains($status, 'los')
                                && !str_contains($status, 'off')
                                && !str_contains($status, 'inact')
                                && !str_contains($status, 'gasp');

                            if ($isUp) {
                                $actualOnlineCount++;
                                $badge = "🟢";
                                $rxStr = number_format($rxNum, 2, '.', '') . " dBm";
                            } else {
                                $badge = "🔴";
                                $rxStr = "-40.00 dBm (LOS)";
                            }

                            $recList[] = ($idx + 1) . ". {$badge} {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$cSn}</code> • <code>{$rxStr}</code>";
                        }
                        if ($displayRecCount > 30) {
                            $recList[] = "<i>... dan " . ($displayRecCount - 30) . " pelanggan lainnya pada interface {$standardPort}</i>";
                        }
                        $recListText = implode("\n", $recList);

                        if ($actualOnlineCount === $displayRecCount) {
                            $totalKlienText = "<b>{$actualOnlineCount} dari {$displayRecCount} Pelanggan (100% Pulih Normal)</b>";
                        } else {
                            $losCount = max(0, $displayRecCount - $actualOnlineCount);
                            $totalKlienText = "<b>{$actualOnlineCount} dari {$displayRecCount} Pelanggan Pulih Online</b> (🔴 {$losCount} Klien Masih LOS)";
                        }

                        TelegramService::send(
                            "🟢🟢 PEMULIHAN GANGGUAN MASSAL INTERFACE 🟢🟢",
                            "<b>• OLT:</b> {$oltName}\n" .
                            "<b>• Interface / Port:</b> <code>{$standardPort}</code>\n" .
                            "<b>• Status:</b> 🟢 <b>JALUR TRANSMISI UTAMA PULIH NORMAL</b>\n" .
                            "<b>• Klien Pulih:</b> {$totalKlienText}\n\n" .
                            "<b>Daftar Pelanggan Pulih & Nilai Redaman:</b>\n{$recListText}\n\n" .
                            "<b>Keterangan:</b> Sinyal optik pada interface <code>{$standardPort}</code> telah stabil dan normal kembali.",
                            'NOC',
                            null,
                            'SNMP_TRAP'
                        );

                        $this->info("   🟢🟢 [MASS RECOVERY] Interface {$standardPort} telah pulih normal ({$displayRecCount} clients up)!");
                    }
                }
            }

            return false;
        }
    }

    /**
     * Ambil SELURUH ONU/Pelanggan yang terhubung pada interface PON ini
     * (Menggabungkan onu_list, unconfigured_onus dari snapshot OLT, dan tabel ont_registrations via ODP)
     */
    protected function getAllOnusOnInterface(OltDevice $olt, string $standardPort): array
    {
        $onusMap = [];

        // 1. Ambil dari snapshot OLT (baik onu_list maupun unconfigured_onus)
        $snapshot = $olt->last_telemetry_snapshot ?? [];
        $rawSnapshotOnus = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);

        foreach ($rawSnapshotOnus as $so) {
            $p = strtolower(trim((string)($so['port'] ?? ($so['detected_port'] ?? ''))));
            $std = strtolower(trim($standardPort));

            $match = ($p === $std || str_ends_with($p, $std) || str_ends_with($std, $p));
            if (!$match) {
                $pClean = str_replace(['gpon-olt_', 'gpon-onu_', 'gei_'], '', $p);
                $stdClean = str_replace(['gpon-olt_', 'gpon-onu_', 'gei_'], '', $std);
                $match = ($pClean === $stdClean);
            }

            if ($match) {
                $sn = strtoupper(trim((string)($so['serial_number'] ?? ($so['onu_mac'] ?? ''))));
                if ($sn) {
                    $onuId = $so['onu_id'] ?? null;
                    $defaultName = "ONU {$p}" . ($onuId ? ":{$onuId}" : "");
                    $onusMap[$sn] = [
                        'sn'       => $sn,
                        'name'     => $so['customer_name'] ?? ($so['name'] ?? $defaultName),
                        'cust_id'  => $so['customer_number'] ?? null,
                        'port'     => $p,
                        'onu_id'   => $onuId,
                        'status'   => $so['status'] ?? 'unknown',
                        'rx_power' => $so['rx_power'] ?? null,
                        'node'     => null,
                    ];
                }
            }
        }

        // 2. Ambil dari database ont_registrations via ODP
        $dbOnus = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->leftJoin('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->leftJoin('network_nodes', 'network_nodes.id', '=', 'network_ports.node_id')
            ->where(function ($q) use ($standardPort) {
                $q->where('network_nodes.olt_port_ref', $standardPort)
                  ->orWhere('network_nodes.olt_port_ref', str_replace('gpon-olt_', '', $standardPort));
            })
            ->select([
                'customers.customer_number',
                'customers.id as customer_id',
                'customers.name as customer_name',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'network_nodes.name as node_name',
                'ont_registrations.status',
                'ont_registrations.rx_power',
            ])
            ->get();

        foreach ($dbOnus as $do) {
            $sn = strtoupper(trim((string)($do->onu_serial ?: $do->onu_mac)));
            if (!$sn) continue;

            if (isset($onusMap[$sn])) {
                $onusMap[$sn]['name']    = $do->customer_name;
                $onusMap[$sn]['cust_id'] = $do->customer_number ?: "ID-{$do->customer_id}";
                $onusMap[$sn]['node']    = $do->node_name;
            } else {
                $onusMap[$sn] = [
                    'sn'       => $sn,
                    'name'     => $do->customer_name,
                    'cust_id'  => $do->customer_number ?: "ID-{$do->customer_id}",
                    'port'     => $standardPort,
                    'onu_id'   => null,
                    'status'   => $do->status,
                    'rx_power' => $do->rx_power,
                    'node'     => $do->node_name,
                ];
            }
        }

        return array_values($onusMap);
    }

    /**
     * Query direct optical power (Rx dBm) from OLT via SNMP in ~50ms
     */
    protected function queryInstantRxPower(?OltDevice $olt, ?string $port, ?int $onuId): ?float
    {
        if (!$olt || !$port || !$onuId || $olt->connection_mode !== 'live' || empty($olt->ip_address)) {
            return null;
        }

        try {
            $rawPortStr = str_replace(['gpon-olt_', 'epon-olt_', 'gpon_', 'epon_'], '', strtolower(trim($port)));
            $portParts = explode('/', $rawPortStr);
            if (count($portParts) < 3) {
                return null;
            }

            $slotNum = (int)$portParts[1];
            $portNum = (int)$portParts[2];
            $ifIndex = (0x10 << 24) | ($slotNum << 16) | ($portNum << 8);

            $community = $olt->getEffectiveCommunity();
            $version   = $olt->snmp_version ?? 'v2c';
            $snmpPort  = $olt->snmp_port ?? 161;

            $snmp = new SnmpConnector($olt->ip_address, $version, $community, $snmpPort, 1, 0);
            $rxRaw = $snmp->get("1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.{$ifIndex}.{$onuId}.1");

            if ($rxRaw !== false && $rxRaw !== null) {
                $rawVal = (int)SnmpConnector::parseValue((string)$rxRaw);
                if ($rawVal > 0 && $rawVal < 65535) {
                    $rxPower = round(($rawVal * 0.002) - 30.0, 2);
                    if ($rxPower > -38.0 && $rxPower < -5.0) {
                        return $rxPower;
                    }
                }
            }
        } catch (\Throwable $e) {
            // silent fallback
        }

        return null;
    }

    /**
     * Correlate and detect mass outage per ODP in real-time via SNMP Trap (Sub-second!).
     */
    protected function handleOdpMassCorrelator(
        int $odpId,
        string $odpName,
        ?string $standardPort,
        ?OltDevice $olt,
        bool $isAlarmLoss,
        bool $isAlarmRecovery
    ): void {
        $massKey = "notif_mass_down_{$odpId}";

        // 1. Ambil seluruh ONU pada ODP ini (Cache 30 detik agar jika ada rentetan trap datang dalam 1 detik, query DB hanya 1x)
        $odpCacheKey = "odp_onus_topology_{$odpId}";
        $onus = Cache::remember($odpCacheKey, 30, function () use ($odpId) {
            return DB::table('ont_registrations')
                ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
                ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                ->join('network_nodes as odp', 'odp.id', '=', 'network_ports.node_id')
                ->leftJoin('network_nodes as odc', 'odc.id', '=', 'odp.parent_node_id')
                ->leftJoin('olt_devices', 'olt_devices.id', '=', 'odp.olt_device_id')
                ->where('odp.id', $odpId)
                ->select([
                    'odp.id as odp_id',
                    'odp.name as odp_name',
                    'odp.code as odp_code',
                    'odp.olt_port_ref',
                    'odc.name as odc_name',
                    'olt_devices.name as olt_name',
                    'ont_registrations.id as ont_id',
                    'ont_registrations.onu_serial',
                    'ont_registrations.onu_mac',
                    'ont_registrations.status',
                    'ont_registrations.rx_power',
                    'customers.id as customer_id',
                    'customers.customer_number',
                    'customers.name as customer_name',
                ])
                ->get()
                ->toArray();
        });

        $onus = collect($onus);
        $totalOnus = $onus->count();
        if ($totalOnus < 2) {
            return;
        }

        // HIERARCHY GUARD: Jika interface induknya sedang mengalami mati massal (SFP lepas), jangan kirim alert ODP
        if (!empty($standardPort) && $olt) {
            $cleanP = strtolower(trim($standardPort));
            if (Cache::has("interface_in_mass_outage_{$olt->id}_{$cleanP}") ||
                Cache::has("interface_in_mass_outage_{$olt->id}_gpon-olt_{$cleanP}")) {
                return;
            }
        }

        if ($isAlarmLoss) {
            // Ambil status terkini seluruh pelanggan di ODP ini dari DB
            $downOnus = DB::table('ont_registrations')
                ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                ->where('network_ports.node_id', $odpId)
                ->where(function ($q) {
                    $q->where('ont_registrations.status', '!=', 'active')
                      ->orWhereNull('ont_registrations.rx_power')
                      ->orWhere('ont_registrations.rx_power', '<=', -32.0);
                })
                ->select('ont_registrations.onu_serial', 'ont_registrations.onu_mac')
                ->get();

            $downCount = $downOnus->count();
            $downSerials = $downOnus->pluck('onu_serial')->filter()->toArray();

            // 🚨 Deteksi ODP Down:
            // 1. 100% seluruh pelanggan pada ODP tersebut LOS, ATAU
            // 2. Untuk ODP dengan >= 6 pelanggan: jika >= 85% pelanggan LOS
            $isOdpDown = ($totalOnus >= 2 && $downCount === $totalOnus)
                      || ($totalOnus >= 6 && $downCount >= (int)ceil($totalOnus * 0.85));

            if ($isOdpDown && !Cache::has($massKey)) {
                Cache::put($massKey, true, now()->addHours(12));
                Cache::forget('dashboard_metrics_payload');

                $first = $onus->first();
                $cleanOdpTitle = preg_match('/^odp/i', $odpName) ? $odpName : "ODP {$odpName}";
                $odcName = $first->odc_name ?: 'ODC Induk';
                $oltName = $first->olt_name ?: ($olt->name ?? 'OLT');
                $portRef = $first->olt_port_ref ?: ($standardPort ?? 'PON Port');
                $pctVal = round(($downCount / $totalOnus) * 100.0, 1);

                // Susun daftar pelanggan
                $clientLines = [];
                $idx = 1;
                foreach ($onus as $onu) {
                    $cName = $onu->customer_name ?: "Pelanggan #{$onu->ont_id}";
                    $cId = $onu->customer_number ?: ($onu->customer_id ? "ID-{$onu->customer_id}" : "ID-{$onu->ont_id}");
                    $sn = $onu->onu_serial ?: ($onu->onu_mac ?: '—');
                    $isDown = in_array($sn, $downSerials);
                    $badge = $isDown ? "🔴" : "🟢";
                    $rxStr = $isDown ? "-40.00 dBm (LOS)" : "{$onu->rx_power} dBm";
                    $clientLines[] = "{$idx}. {$badge} [{$cId}] <b>{$cName}</b>\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                    $idx++;
                }
                $clientListText = implode("\n", $clientLines);

                $cleanMassMsg = "<b>• Node ODP:</b> {$cleanOdpTitle}\n" .
                                "<b>• Interface OLT:</b> <code>{$portRef}</code>\n" .
                                "<b>• Klien Terdampak:</b> 🔴 <b>{$downCount} dari {$totalOnus} Pelanggan ({$pctVal}% LOS)</b>\n\n" .
                                "<b>Daftar Klien Terdampak:</b>\n" .
                                "{$clientListText}\n\n" .
                                "<i>Status: Seluruh atau mayoritas pelanggan pada ODP ini mengalami pemutusan sinyal bersamaan via SNMP Trap.</i>";

                AppNotification::notifyAll(
                    "🚨 ALARM GANGGUAN MASSAL: {$cleanOdpTitle}",
                    $cleanMassMsg,
                    'NOC',
                    '/network',
                    'SNMP_TRAP',
                    true,
                    'SNMP_TRAP'
                );

                $this->error("   🚨🚨 [ODP MASS OUTAGE DETECTED VIA TRAP] {$cleanOdpTitle} ({$downCount}/{$totalOnus} down)!");
            }
        } elseif ($isAlarmRecovery) {
            if (Cache::has($massKey)) {
                $onlineCount = DB::table('ont_registrations')
                    ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                    ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                    ->where('network_ports.node_id', $odpId)
                    ->where('ont_registrations.status', 'active')
                    ->where('ont_registrations.rx_power', '>', -32.0)
                    ->count();

                if ($onlineCount >= (int)ceil($totalOnus * 0.70)) {
                    Cache::forget($massKey);
                    Cache::forget('dashboard_metrics_payload');

                    $first = $onus->first();
                    $cleanOdpTitle = preg_match('/^odp/i', $odpName) ? $odpName : "ODP {$odpName}";
                    $odcName = $first->odc_name ?: 'ODC Induk';
                    $portRef = $first->olt_port_ref ?: ($standardPort ?? 'PON Port');

                    $freshOnus = DB::table('ont_registrations')
                        ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                        ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
                        ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                        ->where('network_ports.node_id', $odpId)
                        ->select('ont_registrations.*', 'customers.name as customer_name', 'customers.customer_number', 'customers.id as customer_id')
                        ->get();

                    $clientRecoveryLines = [];
                    $idx = 1;
                    foreach ($freshOnus as $onu) {
                        $cName = $onu->customer_name ?: "Pelanggan #{$onu->id}";
                        $cId = $onu->customer_number ?: ($onu->customer_id ? "ID-{$onu->customer_id}" : "");
                        $sn = $onu->onu_serial ?: ($onu->onu_mac ?: '—');
                        $isUp = ($onu->status === 'active' && $onu->rx_power !== null && (float)$onu->rx_power > -32.0);
                        $badge = $isUp ? "🟢" : "🔴";
                        $rxStr = $isUp ? "{$onu->rx_power} dBm" : "-40.00 dBm (LOS)";
                        $clientRecoveryLines[] = "{$idx}. {$badge} [{$cId}] <b>{$cName}</b>\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                        $idx++;
                    }
                    $recoveryDetailText = implode("\n", $clientRecoveryLines);

                    $cleanRecoveryMsg = "<b>• Node ODP:</b> {$cleanOdpTitle}\n" .
                                        "<b>• Interface OLT:</b> <code>{$portRef}</code>\n" .
                                        "<b>• Status:</b> 🟢 <b>LAYANAN ODP PULIH NORMAL ({$onlineCount}/{$totalOnus} Klien Online)</b>\n\n" .
                                        "<b>Daftar Pelanggan Pulih:</b>\n" .
                                        "{$recoveryDetailText}\n\n" .
                                        "<i>Koneksi optik pada splitter ODP {$cleanOdpTitle} telah kembali normal dan stabil.</i>";

                    AppNotification::notifyAll(
                        "🟢 PEMULIHAN GANGGUAN MASSAL: {$cleanOdpTitle}",
                        $cleanRecoveryMsg,
                        'NOC',
                        '/network',
                        'SNMP_TRAP',
                        true,
                        'SNMP_TRAP'
                    );

                    $this->info("   🟢🟢 [ODP MASS RECOVERY DETECTED VIA TRAP] {$cleanOdpTitle} telah pulih normal!");
                }
            }
        }
    }
}
