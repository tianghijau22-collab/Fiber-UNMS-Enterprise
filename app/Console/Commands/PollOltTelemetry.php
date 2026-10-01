<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\OltDevice;
use App\Http\Controllers\OltController;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\TelegramService;
use App\Models\AppNotification;
use App\Services\Olt\FastOpticalProbeService;
use Symfony\Component\Process\Process;

class PollOltTelemetry extends Command
{
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll} {--port= : Specific Port to poll} {--force : Force polling} {--daemon : Run continuously in a 24/7 non-stop loop} {--mode= : Polling engine mode: slot_parallel, per_port, or global_bulk}';
    protected $description = 'Polls live telemetry in 24/7 loop supporting Slot Parallel, Per-Port, and Global Bulk Polling';

    public function handle(OltController $oltCtrl)
    {
        $deviceId = $this->option('device');
        $specificPort = $this->option('port');
        $isDaemon = $this->option('daemon');
        $modeOption = $this->option('mode');
        if ($modeOption) {
            Cache::put('olt_polling_engine_mode', $modeOption, 86400 * 30);
        }
        $engineMode = $modeOption ?: Cache::get('olt_polling_engine_mode', 'slot_parallel');

        // JIKA SPECIFIC DEVICE ID: Jalankan polling untuk OLT ini sesuai mode
        if ($deviceId) {
            if ($engineMode === 'slot_parallel') {
                return $this->pollSlotParallelTelemetry((int)$deviceId, $oltCtrl);
            } elseif ($engineMode === 'global_bulk') {
                return $this->pollGlobalBulkTelemetry((int)$deviceId, $oltCtrl);
            }
            return $this->pollSinglePortOnDevice((int)$deviceId, $oltCtrl, $specificPort);
        }

        // JIKA MODE DAEMON 24/7: Jalankan continuous loop tanpa henti (non-stop)
        if ($isDaemon) {
            $this->info("🌀 Menjalankan Continuous 24/7 Polling Daemon [Mode: {$engineMode}]...");
            self::appendWorkerLog('SYSTEM', 'DAEMON', 'INFO', "Daemon 24/7 continuous loop dimulai dengan engine [Mode: {$engineMode}].");

            while (true) {
                $isPaused = (bool)Cache::get('backend_worker_paused', false);
                $loopDelay = (int)Cache::get('backend_worker_loop_delay_sec', 3);
                $currentEngineMode = Cache::get('olt_polling_engine_mode', 'slot_parallel');

                if ($isPaused) {
                    sleep(2);
                    continue;
                }

                try {
                    $this->dispatchSinglePortParallel($oltCtrl, $currentEngineMode);
                } catch (\Throwable $e) {
                    $this->error("Error in daemon loop: " . $e->getMessage());
                    self::appendWorkerLog('SYSTEM', 'DAEMON', 'ERROR', "Daemon loop error: " . $e->getMessage());
                }

                // Jeda sesuai konfigurasi interval (default 3 detik untuk slot_parallel)
                sleep(max(1, $loopDelay));
            }
            return 0;
        }

        // SINGLE RUN DISPATCHER (Dipanggil manual via web trigger atau cron)
        return $this->dispatchSinglePortParallel($oltCtrl, $engineMode);
    }

    /**
     * Master Dispatcher: Menjalankan polling OLT secara IN-PROCESS (Mendukung Slot Parallel, Global Bulk, dan Per-Port)
     */
    protected function dispatchSinglePortParallel(OltController $oltCtrl, string $engineMode = 'slot_parallel'): int
    {
        $cycleStart = microtime(true);
        $devices = OltDevice::where('status', 'active')->get();

        if ($devices->isEmpty()) {
            $this->info('No active OLT devices found.');
            return 0;
        }

        $deviceReports = [];
        $totalPortsPolled = 0;
        $totalOnusPolled = 0;
        $totalUncfgPolled = 0;

        // Eksekusi IN-PROCESS secara berurutan untuk setiap OLT aktif
        foreach ($devices as $device) {
            $devStart = microtime(true);
            try {
                if ($engineMode === 'slot_parallel') {
                    // ⚡ SKEMA UTAMA: Parallel Slot/Card Polling (Realtime ~8-12s + Anti-Flapping Filter)
                    $this->pollSlotParallelTelemetry((int)$device->id, $oltCtrl);
                } elseif ($engineMode === 'global_bulk') {
                    // 🚀 SKEMA BACKUP 1: Global Bulk Polling Se-OLT Sekaligus
                    $this->pollGlobalBulkTelemetry((int)$device->id, $oltCtrl);
                } else {
                    // 🔄 SKEMA BACKUP 2: Polling Port-by-Port Round-Robin (TETAP DIPERTAHANKAN)
                    $this->pollSinglePortOnDevice((int)$device->id, $oltCtrl);
                }

                $durationMs = round((microtime(true) - $devStart) * 1000, 1);

                // Ambil snapshot data yang baru saja diperbarui
                $freshDev = OltDevice::find($device->id);
                $snapshot = $freshDev?->last_telemetry_snapshot ?? [];
                $ponPorts = $snapshot['pon_ports'] ?? [];
                $allOnus  = $snapshot['onu_list'] ?? [];
                $uncfg    = $snapshot['unconfigured_onus'] ?? [];

                $activePorts = count(array_filter($ponPorts, fn($p) => ($p['status'] ?? '') === 'Up' || ($p['registered_onus'] ?? 0) > 0));
                $onusCount   = count($allOnus);
                $uncfgCount  = count($uncfg);
                $onlineCount = count(array_filter($allOnus, fn($o) => ($o['status'] ?? '') === 'Online' || ($o['status'] ?? '') === 'active'));

                $activeQuery = Cache::get("olt_active_querying_port_{$device->id}");

                $totalPortsPolled += $activePorts;
                $totalOnusPolled += $onusCount;
                $totalUncfgPolled += $uncfgCount;

                $deviceReports[] = [
                    'device_id'             => $device->id,
                    'device_name'           => $device->name,
                    'ip'                    => $device->ip_address,
                    'vendor'                => $device->vendor,
                    'total_ports'           => count($ponPorts),
                    'active_ports'          => $activePorts,
                    'db_registered_total'   => $onusCount,
                    'db_registered_online'  => $onlineCount,
                    'db_unregistered_total' => $uncfgCount,
                    'last_port_polled'      => $activeQuery['port'] ?? null,
                    'last_port_onu_count'   => $activeQuery['onu_count'] ?? 0,
                    'onus_found'            => $onusCount,
                    'uncfg_found'           => $uncfgCount,
                    'duration_ms'           => $durationMs,
                    'status'                => 'SUCCESS',
                    'timestamp'             => now()->format('H:i:s'),
                ];
            } catch (\Throwable $e) {
                $durationMs = round((microtime(true) - $devStart) * 1000, 1);
                $this->error("Error in-process polling device {$device->name}: " . $e->getMessage());
                self::appendWorkerLog($device->name, 'ALL', 'ERROR', "In-process error: " . $e->getMessage());

                $deviceReports[] = [
                    'device_id'    => $device->id,
                    'device_name'  => $device->name,
                    'ip'           => $device->ip_address,
                    'vendor'       => $device->vendor,
                    'duration_ms'  => $durationMs,
                    'status'       => 'FAILED: ' . $e->getMessage(),
                    'timestamp'    => now()->format('H:i:s'),
                ];
            }
        }

        $totalCycleDurationMs = round((microtime(true) - $cycleStart) * 1000, 1);
        $prevStats = Cache::get('backend_worker_telemetry', []);

        // Record backend worker telemetry metadata to Cache for live monitoring
        $workerStats = [
            'status'               => 'ACTIVE (24/7 IN-PROCESS LOOP)',
            'engine_mode'          => $engineMode,
            'last_run_at'          => now()->toIso8601String(),
            'last_run_human'       => now()->format('d M Y, H:i:s'),
            'cycle_duration_ms'    => $totalCycleDurationMs,
            'cycle_duration_human' => ($totalCycleDurationMs < 1000) ? "{$totalCycleDurationMs} ms" : round($totalCycleDurationMs / 1000, 2) . " s",
            'throttling_delay_ms'  => 0,
            'mode'                 => match ($engineMode) {
                'slot_parallel' => 'Parallel Slot/Card Batching (Realtime ~8-12s + Anti-Flap)',
                'global_bulk'   => 'Global Bulk Polling (Se-OLT Sekaligus)',
                default         => 'Per-Port Round-Robin Polling (Klasik 2-Port)',
            },
            'total_devices'        => count($devices),
            'total_ports_polled'   => $totalPortsPolled > 0 ? $totalPortsPolled : ($prevStats['total_ports_polled'] ?? 8),
            'total_onus_polled'    => $totalOnusPolled > 0 ? $totalOnusPolled : ($prevStats['total_onus_polled'] ?? \App\Models\OntRegistration::count()),
            'total_uncfg_detected' => $totalUncfgPolled,
            'device_reports'       => $deviceReports,
        ];

        Cache::put('backend_worker_telemetry', $workerStats, 86400);

        // Keep last 15 cycle history
        $cycleHistory = Cache::get('backend_worker_history', []);
        $cycleHistory[] = [
            'time'        => now()->format('H:i:s'),
            'duration_ms' => $totalCycleDurationMs,
            'devices'     => count($devices),
            'ports'       => $workerStats['total_ports_polled'],
            'onus'        => $workerStats['total_onus_polled'],
            'uncfg'       => $totalUncfgPolled,
            'status'      => 'OK',
        ];
        if (count($cycleHistory) > 15) {
            $cycleHistory = array_slice($cycleHistory, -15);
        }
        Cache::put('backend_worker_history', $cycleHistory, 86400);

        // 🛡️ Evaluasi Deteksi Gangguan Massal ODP (100% LOS) secara berkala (interval 20 detik)
        $lastMassCheck = (int)Cache::get('last_mass_client_down_check_ts', 0);
        if (time() - $lastMassCheck >= 20) {
            Cache::put('last_mass_client_down_check_ts', time(), 120);
            try {
                \App\Services\OpticalFaultLocalizationService::detectMassClientDown(2, 100.0);
            } catch (\Throwable $e) {
                // Ignore error
            }
        }

        // ⚡ PILAR 3: Hardware SFP Link Pulse (Interval 15 Detik, Multi-OID ~34ms)
        // Memeriksa status fisik link SFP (ifOperStatus) seluruh port PON OLT secara serentak
        $lastSfpPulse = (int)Cache::get('last_hardware_sfp_pulse_ts', 0);
        if (time() - $lastSfpPulse >= 15) {
            Cache::put('last_hardware_sfp_pulse_ts', time(), 60);
            try {
                $this->executeHardwareSfpLinkPulse();
            } catch (\Throwable $e) {
                // Ignore error
            }
        }

        // 🧹 Pembersihan Otomatis Database Audit Logs & Notifikasi (Setiap 24 Jam)
        $lastAutoPrune = (int)Cache::get('last_audit_logs_auto_prune_ts', 0);
        if (time() - $lastAutoPrune >= 86400) {
            Cache::put('last_audit_logs_auto_prune_ts', time(), 86400 * 30);
            try {
                \Illuminate\Support\Facades\Artisan::call('audit-logs:prune', ['--vacuum' => true]);
            } catch (\Throwable $e) {
                // Ignore error
            }
        }

        // Garbage collection untuk menjaga konsumsi RAM daemon selalu bersih & konstan
        if (function_exists('gc_collect_cycles')) {
            gc_collect_cycles();
        }

        return 0;
    }

    /**
     * ⚡ SKEMA UTAMA: Parallel Slot/Card Polling (Carrier-Grade Hybrid Realtime ~8-12s):
     * Mengambil telemetri redaman & status dengan membagi OLT per Slot Card secara paralel.
     * Dilengkapi Defensive State Preservation (Anti-Flapping & Anti-Corrupt Filter).
     */
    protected function pollSlotParallelTelemetry(int $deviceId, OltController $oltCtrl): int
    {
        $device = OltDevice::find($deviceId);
        if (!$device) {
            $this->error("OLT Device ID {$deviceId} not found.");
            return 1;
        }

        // Fallback ke per-port polling jika device bukan live connection (misal mode simulasi)
        if ($device->connection_mode !== 'live') {
            return $this->pollSinglePortOnDevice($deviceId, $oltCtrl);
        }

        $devStart = microtime(true);
        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);
            $existingSnapshot = $device->last_telemetry_snapshot ?? [];

            // 1. Pastikan Chassis & PON Ports sudah ada di Database
            $deviceInfo = $existingSnapshot['device_info'] ?? [];
            if ($device->connection_mode === 'live') {
                $deviceInfo['_source'] = 'live_snmp';
            }
            $cards = $deviceInfo['cards'] ?? [];
            if (empty($cards)) {
                $freshDeviceInfo = $driver->getDeviceInfo();
                $cards = $freshDeviceInfo['cards'] ?? [];
                if (!empty($cards)) {
                    $deviceInfo = array_merge($deviceInfo, $freshDeviceInfo);
                    $existingSnapshot['device_info'] = $deviceInfo;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                }
            }

            $allPonPorts = $existingSnapshot['pon_ports'] ?? [];
            if (empty($allPonPorts)) {
                $allPonPorts = $driver->getPonPorts();
                if (!empty($allPonPorts)) {
                    $existingSnapshot['pon_ports'] = $allPonPorts;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                }
            }

            if (empty($allPonPorts)) {
                self::appendWorkerLog($device->name, 'SLOT_PARALLEL', 'EMPTY', "Tidak ditemukan port PON pada database {$device->name}");
                return 0;
            }

            // 2. Buka SNMP Session berkecepatan tinggi
            $session = FastOpticalProbeService::getSnmpSession($device, 3500, 1);
            if (!$session) {
                self::appendWorkerLog($device->name, 'SLOT_PARALLEL', 'ERROR', "Gagal membuka sesi SNMP ke {$device->ip_address}");
                $this->error("SNMP session failed for {$device->name}");
                return 1;
            }

            // Catat status aktif query slot parallel untuk pulse indicator di UI
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'       => 'PARALLEL SLOTS (Card Chunks)',
                'status'     => 'SYNCING',
                'timestamp'  => now()->format('H:i:s'),
                'started_at' => microtime(true),
            ], 60);

            self::appendWorkerLog($device->name, 'ALL', 'SYNCING', "⚡ Slot Parallel Polling: Membaca redaman seluruh Card/Slot secara paralel...");

            $walkStart = microtime(true);

            // 3. Ultra-Fast Parallel SNMP Bulk Walk (Menjalankan Phase State & Rx Power simultan dalam proses terpisah)
            // Menggunakan maxRepetitions 35 dan timeout 12s dengan subprocess terisolasi
            $parallelWalks = FastOpticalProbeService::executeParallelSnmpBulkWalk($device, [
                'states' => "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4",
                'rx'     => "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10",
            ], 35, 12);

            $rawStates   = $parallelWalks['states'] ?? [];
            $rawRxPowers = $parallelWalks['rx'] ?? [];

            $walkDuration = round((microtime(true) - $walkStart) * 1000, 1);

            // 4. Cache & Discover Serial Numbers (Diperbarui berkala setiap 24 jam agar tidak membebani walk)
            $snCacheKey = "olt_bulk_sn_map_{$device->id}";
            $snMap = Cache::get($snCacheKey, []);

            if (empty($snMap) || count($snMap) < (count($rawStates) * 0.5)) {
                $parallelSn = FastOpticalProbeService::executeParallelSnmpBulkWalk($device, [
                    'sn1' => "1.3.6.1.4.1.3902.1012.3.50.11.2.1.3",
                    'sn2' => "1.3.6.1.4.1.3902.1012.3.28.1.1.5",
                ], 35, 10);
                $rawSn1 = $parallelSn['sn1'] ?? [];
                $rawSn2 = $parallelSn['sn2'] ?? [];

                $snMap = [];
                foreach ($rawSn2 as $oid => $val) {
                    $parts = explode('.', $oid);
                    $onuId = (int)end($parts);
                    $ifIdx = (int)$parts[count($parts) - 2];
                    $cleanSn = FastOpticalProbeService::parseZteSerialNumber((string)$val);
                    if ($cleanSn && strlen($cleanSn) >= 6) {
                        $snMap["{$ifIdx}_{$onuId}"] = $cleanSn;
                    }
                }
                foreach ($rawSn1 as $oid => $val) {
                    $parts = explode('.', $oid);
                    $onuId = (int)end($parts);
                    $ifIdx = (int)$parts[count($parts) - 2];
                    if (!isset($snMap["{$ifIdx}_{$onuId}"])) {
                        $cleanSn = FastOpticalProbeService::parseZteSerialNumber((string)$val);
                        if ($cleanSn && strlen($cleanSn) >= 6) {
                            $snMap["{$ifIdx}_{$onuId}"] = $cleanSn;
                        }
                    }
                }

                // Tambahkan serial dari snapshot database sebelumnya jika ada yang belum terbaca
                $prevSnapshotOnus = $existingSnapshot['onu_list'] ?? [];
                foreach ($prevSnapshotOnus as $so) {
                    $soSn = strtoupper(trim((string)($so['serial_number'] ?? ($so['onu_mac'] ?? ''))));
                    $soPort = $so['port'] ?? '';
                    $soId = (int)($so['onu_id'] ?? 0);
                    if ($soSn && $soPort && $soId > 0) {
                        $soIfIndex = FastOpticalProbeService::calculateIfIndex($soPort);
                        if (!isset($snMap["{$soIfIndex}_{$soId}"])) {
                            $snMap["{$soIfIndex}_{$soId}"] = $soSn;
                        }
                    }
                }

                Cache::put($snCacheKey, $snMap, 600); // 10 menit TTL
            }

            // 5. Normalisasi Data Status & Redaman
            $stateMap = [];
            foreach ($rawStates as $oid => $val) {
                $parts = explode('.', $oid);
                $onuId = (int)end($parts);
                $ifIdx = (int)$parts[count($parts) - 2];
                $stateMap["{$ifIdx}_{$onuId}"] = (int)\App\Services\Olt\SnmpConnector::parseValue((string)$val);
            }

            $rxMap = [];
            foreach ($rawRxPowers as $oid => $val) {
                $parts = explode('.', $oid);
                $onuId = (int)$parts[count($parts) - 2];
                $ifIdx = (int)$parts[count($parts) - 3];
                $rxMap["{$ifIdx}_{$onuId}"] = (int)\App\Services\Olt\SnmpConnector::parseValue((string)$val);
            }

            // 6. Map ONU Sebelumnya untuk Defensive State Filter (Anti-Flapping & Anti-Corrupt)
            $prevSnapshotOnus = collect($existingSnapshot['onu_list'] ?? [])->keyBy(fn($o) => strtoupper(trim((string)($o['serial_number'] ?? ''))));

            $physicalOnuMap = [];
            $onusByPort = [];
            $allDiscoveredKeys = array_unique(array_merge(array_keys($stateMap), array_keys($snMap)));

            foreach ($allDiscoveredKeys as $compositeKey) {
                $kParts = explode('_', $compositeKey);
                $ifIndex = (int)($kParts[0] ?? 0);
                $onuId   = (int)($kParts[1] ?? 0);

                if ($ifIndex <= 0 || $onuId <= 0) {
                    continue;
                }

                $slotNum = ($ifIndex >> 16) & 0xFF ?: 1;
                $portNum = ($ifIndex >> 8) & 0xFF ?: ($ifIndex & 0xFF ?: 1);
                $portName = "gpon-olt_1/{$slotNum}/{$portNum}";

                $sn = $snMap[$compositeKey] ?? null;
                if (!$sn || $sn === '00000000' || strlen($sn) < 6 || preg_match('/^0+$/', $sn)) {
                    continue;
                }

                $stateCode = $stateMap[$compositeKey] ?? null;
                $rawRx     = $rxMap[$compositeKey] ?? null;

                // Hitung Nilai Redaman Optik (DDM Formula)
                $hasValidRawRx = ($rawRx !== null && $rawRx > 0 && $rawRx < 65534);
                $calculatedRx  = $hasValidRawRx ? round(($rawRx * 0.002) - 30.0, 2) : null;
                $isExplicitStateOnline = ($stateCode === 3);

                // 🛡️ DEFENSIVE STATE PRESERVATION FILTER (Anti-Glitch / Anti-Packet-Drop)
                $prevItem = $prevSnapshotOnus->get(strtoupper($sn));
                $prevWasOnline = $prevItem && in_array(strtolower($prevItem['status'] ?? ''), ['online', 'active', 'working']);
                $prevRx = (float)($prevItem['rx_power'] ?? -21.50);

                if ($isExplicitStateOnline && $hasValidRawRx && $calculatedRx > -38.0 && $calculatedRx < -5.0) {
                    // Valid Online dengan redaman riil
                    $rxPower = $calculatedRx;
                    $status = 'Online';
                    $isOnline = true;
                    Cache::forget("ont_miss_count_{$sn}");
                } elseif ($isExplicitStateOnline && (!$hasValidRawRx || $calculatedRx <= -38.0)) {
                    // Phase State Online tapi redaman DDM belum terkirim / jitter: pertahankan redaman terakhir
                    $rxPower = ($prevWasOnline && $prevRx > -38.0) ? $prevRx : -21.50;
                    $status = 'Online';
                    $isOnline = true;
                    Cache::forget("ont_miss_count_{$sn}");
                } else {
                    // SNMP tidak mengembalikan state=3: Cek apakah drop sementara atau permanen
                    $hasTrapDown = Cache::get("ont_trap_down_{$sn}", false);
                    $missCount = (int)Cache::get("ont_miss_count_{$sn}", 0) + 1;
                    Cache::put("ont_miss_count_{$sn}", $missCount, 120);

                    if ($prevWasOnline && $missCount < 2 && !$hasTrapDown && $stateCode !== 1) {
                        // 🛡️ Filter Packet Loss: Pertahankan status Online 1 siklus
                        $rxPower = $prevRx;
                        $status = 'Online';
                        $isOnline = true;
                    } else {
                        // Terkonfirmasi Down / LOS
                        $rxPower = -40.00;
                        $status = 'LOS';
                        $isOnline = false;
                    }
                }

                $txPower = 1.95;

                $onuItem = [
                    '_source'         => 'live_snmp',
                    'onu_id'          => (string)$onuId,
                    'port'            => $portName,
                    'customer_name'   => "ONU {$sn}",
                    'serial_number'   => $sn,
                    'vendor_model'    => 'F670L',
                    'status'          => $status,
                    'rx_power'        => $rxPower,
                    'tx_power'        => $txPower,
                    'distance_meters' => 850,
                    'ip_address'      => '—',
                ];

                $mapKey = $sn . '@' . strtolower($portName);
                $physicalOnuMap[$mapKey] = $onuItem;
                $onusByPort[$portName][] = $onuItem;
            }

            // 7. Evaluasi Kesehatan Port Fisik
            $massDownPorts = [];
            $allPonPorts = array_map(function ($p) use ($onusByPort, $device, &$massDownPorts) {
                $pId = $p['port_id'] ?? '';
                $portOnus = $onusByPort[$pId] ?? ($onusByPort[str_replace('gpon-olt_', '', $pId)] ?? []);
                $found = count($portOnus);
                $onlineCount = count(array_filter($portOnus, fn($o) => 
                    ($o['status'] === 'Online' || strtolower($o['status'] ?? '') === 'working') 
                    && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0
                ));

                $isMassDown = false;
                if ($found >= 10) {
                    $isMassDown = ($onlineCount === 0) || ((($found - $onlineCount) / $found) >= 0.90 && $onlineCount <= 3);
                } elseif ($found >= 3) {
                    $isMassDown = ($onlineCount === 0);
                }

                if ($isMassDown) {
                    $massDownPorts[$pId] = true;
                    $massDownPorts[str_replace('gpon-olt_', '', $pId)] = true;
                }

                $p['status']          = $found > 0 ? ($isMassDown ? 'Down' : 'Up') : ($p['status'] ?? 'Down');
                $p['registered_onus'] = $found > 0 ? $found : ($p['registered_onus'] ?? 0);
                $p['online_onus']     = $onlineCount;
                $p['is_mass_outage']  = $isMassDown;

                if ($found > 0) {
                    $this->handleInterfaceMassOutagePollCheck($device, $pId, $found, $onlineCount, $portOnus);
                }

                return $p;
            }, $allPonPorts);

            // 8. Bulk Sync Database OntRegistration & Alarms (Anti-Flapping & Instant Notifications)
            $allSerials = array_unique(array_map(fn($o) => strtoupper(trim((string)$o['serial_number'])), $physicalOnuMap));
            
            if (!empty($allSerials)) {
                $dbOnts = \App\Models\OntRegistration::with(['customerService.customer', 'customerService.networkPort.node', 'oltPort.node'])
                    ->whereIn('onu_serial', $allSerials)
                    ->orWhereIn('onu_mac', $allSerials)
                    ->get()
                    ->keyBy(fn($r) => strtoupper(trim((string)($r->onu_serial ?: $r->onu_mac))));

                DB::transaction(function() use ($physicalOnuMap, $dbOnts, $device, $massDownPorts) {
                    foreach ($physicalOnuMap as $onuData) {
                        $sn = strtoupper(trim((string)$onuData['serial_number']));
                        $ontReg = $dbOnts->get($sn);
                        if (!$ontReg) continue;

                        $isOnline = ($onuData['status'] === 'Online' || strtolower($onuData['status']) === 'working') && (float)$onuData['rx_power'] > -38.0;
                        $newStatus = $isOnline ? 'active' : 'inactive';
                        $newRx     = (float)$onuData['rx_power'];
                        $newTx     = (float)$onuData['tx_power'];
                        $oldStatus = $ontReg->status;

                        $portName  = $onuData['port'] ?? 'PON';
                        $custName  = $ontReg->customerService?->customer?->name ?: ('Pelanggan #' . $ontReg->id);

                        // Deteksi perubahan status untuk alarm & notifikasi
                        if ($oldStatus !== $newStatus) {
                            $flapTrackerKey = "ont_flap_tracker_{$sn}";
                            $flaps = Cache::get($flapTrackerKey, []);
                            $now = now()->timestamp;
                            $flaps = array_values(array_filter($flaps, fn($t) => ($now - $t) <= 900));
                            $flaps[] = $now;
                            Cache::put($flapTrackerKey, $flaps, 1800);

                            $suppressKey = "ont_flap_suppressed_{$sn}";
                            if (count($flaps) >= 3) {
                                Cache::put($suppressKey, true, 1800);
                            }

                            $isSuppressed = Cache::get($suppressKey, false);
                            $alertCooldownKey = "ont_alert_cooldown_{$sn}_{$newStatus}";
                            $inCooldown = Cache::has($alertCooldownKey);

                            if (!$isSuppressed && !$inCooldown) {
                                Cache::put($alertCooldownKey, true, 600); // 10 menit cooldown

                                if ($oldStatus === 'active' && $newStatus === 'inactive') {
                                    \App\Models\AuditLog::record('ALARM_SUDDEN_LOS', 'Monitoring OLT', "🚨 SUDDEN LOSS: Modem {$custName} ({$sn}) putus / LOS pada {$portName}", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => -40.00]);
                                    $isPortMassOutage = !empty($massDownPorts[$portName]) || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}");
                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "🚨 SUDDEN LOSS: Modem {$custName} Putus!",
                                            "Modem {$custName} (SN: {$sn}) pada port {$portName} mengalami kehilangan sinyal (LOS).",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                        TelegramService::send(
                                            "🚨 SUDDEN LOSS: Modem {$custName} Putus!",
                                            "Modem {$custName} (SN: {$sn}) pada port {$portName} mengalami kehilangan sinyal (LOS).",
                                            'NOC',
                                            '/customers'
                                        );
                                    }
                                } elseif ($oldStatus === 'inactive' && $newStatus === 'active') {
                                    \App\Models\AuditLog::record('ALARM_RECOVERY', 'Monitoring OLT', "✨ RECOVERY: Modem {$custName} ({$sn}) kembali ONLINE pada {$portName} (Rx: {$newRx} dBm)", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => $newRx]);
                                    $isPortMassOutage = !empty($massDownPorts[$portName]) || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}");
                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "✨ RECOVERY: Modem {$custName} Online Kembali",
                                            "Modem {$custName} (SN: {$sn}) pada port {$portName} telah kembali aktif (Rx: {$newRx} dBm).",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                        TelegramService::send(
                                            "✨ RECOVERY: Modem {$custName} Online Kembali",
                                            "Modem {$custName} (SN: {$sn}) pada port {$portName} telah kembali aktif (Rx: {$newRx} dBm).",
                                            'NOC',
                                            '/customers'
                                        );
                                    }
                                }
                            }
                        }

                        $updatePayload = [
                            'status'     => $newStatus,
                            'rx_power'   => $newRx,
                            'tx_power'   => $newTx,
                            'updated_at' => now(),
                        ];
                        if ($isOnline) {
                            $updatePayload['last_online_at'] = now();
                        }
                        $ontReg->update($updatePayload);
                    }
                });
            }

            // 9. Simpan Snapshot Data Lengkap ke Database OLT
            $existingUncfg = $existingSnapshot['unconfigured_onus'] ?? [];
            $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $allPonPorts, array_values($physicalOnuMap), $existingUncfg);

            $device->update([
                'last_telemetry_snapshot' => $finalSnapshot,
                'last_connected_at'       => now(),
            ]);

            $totalDurationMs = round((microtime(true) - $devStart) * 1000, 1);
            $totalFound      = count($physicalOnuMap);
            $totalOnline     = count(array_filter($physicalOnuMap, fn($o) => $o['status'] === 'Online'));

            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'        => 'PARALLEL SLOTS (Card Chunks)',
                'status'      => $totalFound > 0 ? 'SUCCESS' : 'EMPTY',
                'onu_count'   => $totalFound,
                'duration_ms' => $totalDurationMs,
                'timestamp'   => now()->format('H:i:s'),
            ], 60);

            self::appendWorkerLog(
                $device->name,
                'SLOT_PARALLEL',
                $totalFound > 0 ? 'SUCCESS' : 'EMPTY',
                "⚡ Slot Parallel Selesai: {$totalFound} ONU ({$totalOnline} Online) se-OLT berhasil diperbarui ({$totalDurationMs} ms, SNMP walk: {$walkDuration} ms)",
                ['onu_count' => $totalFound, 'online_count' => $totalOnline, 'duration_ms' => $totalDurationMs]
            );

            $this->info("⚡ Slot Parallel Polling on {$device->name}: {$totalFound} ONUs ({$totalOnline} Online) updated in {$totalDurationMs} ms.");

            $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
            Cache::forget($cacheKey);

            return 0;
        } catch (\Throwable $e) {
            self::appendWorkerLog(
                $device->name,
                'SLOT_PARALLEL',
                'ERROR',
                "Gagal Slot Parallel Polling pada {$device->name}: " . $e->getMessage(),
                ['error' => $e->getMessage()]
            );
            $this->error("Failed Slot Parallel Polling on {$device->name}: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * 🚀 SKEMA BACKUP 1: Global Bulk Polling Se-OLT Sekaligus (~5-10 detik)
     * Menggunakan SNMP walk pada subtree status dan redaman optik tanpa query per-port bertahap.
     */
    protected function pollGlobalBulkTelemetry(int $deviceId, OltController $oltCtrl): int
    {
        $device = OltDevice::find($deviceId);
        if (!$device) {
            $this->error("OLT Device ID {$deviceId} not found.");
            return 1;
        }

        // Fallback ke per-port polling jika device bukan live connection (misal mode simulasi)
        if ($device->connection_mode !== 'live') {
            return $this->pollSinglePortOnDevice($deviceId, $oltCtrl);
        }

        $devStart = microtime(true);
        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);
            $existingSnapshot = $device->last_telemetry_snapshot ?? [];

            // 1. Pastikan Chassis & PON Ports sudah ada di Database
            $deviceInfo = $existingSnapshot['device_info'] ?? [];
            if ($device->connection_mode === 'live') {
                $deviceInfo['_source'] = 'live_snmp';
            }
            $cards = $deviceInfo['cards'] ?? [];
            if (empty($cards)) {
                $freshDeviceInfo = $driver->getDeviceInfo();
                $cards = $freshDeviceInfo['cards'] ?? [];
                if (!empty($cards)) {
                    $deviceInfo = array_merge($deviceInfo, $freshDeviceInfo);
                    $existingSnapshot['device_info'] = $deviceInfo;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                }
            }

            $allPonPorts = $existingSnapshot['pon_ports'] ?? [];
            if (empty($allPonPorts)) {
                $allPonPorts = $driver->getPonPorts();
                if (!empty($allPonPorts)) {
                    $existingSnapshot['pon_ports'] = $allPonPorts;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                }
            }

            if (empty($allPonPorts)) {
                self::appendWorkerLog($device->name, 'GLOBAL_BULK', 'EMPTY', "Tidak ditemukan port PON pada database {$device->name}");
                return 0;
            }

            // 2. Buka SNMP Session berkecepatan tinggi
            $session = FastOpticalProbeService::getSnmpSession($device, 3500, 1);
            if (!$session) {
                self::appendWorkerLog($device->name, 'GLOBAL_BULK', 'ERROR', "Gagal membuka sesi SNMP ke {$device->ip_address}");
                $this->error("SNMP session failed for {$device->name}");
                return 1;
            }

            // Catat status aktif query global bulk untuk pulse indicator di UI
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'       => 'ALL PORTS (Global Bulk)',
                'status'     => 'SYNCING',
                'timestamp'  => now()->format('H:i:s'),
                'started_at' => microtime(true),
            ], 60);

            self::appendWorkerLog($device->name, 'ALL', 'SYNCING', "🚀 Global Bulk Polling dimulai: Menarik seluruh redaman & status ONU se-OLT...");

            $walkStart = microtime(true);

            // 3. Ultra-Fast Parallel SNMP Bulk Walk (Menjalankan Phase State & Rx Power simultan dalam proses terpisah)
            $parallelWalks = FastOpticalProbeService::executeParallelSnmpBulkWalk($device, [
                'states' => "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4",
                'rx'     => "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10",
            ], 50, 15);

            $rawStates   = $parallelWalks['states'] ?? [];
            $rawRxPowers = $parallelWalks['rx'] ?? [];

            $walkDuration = round((microtime(true) - $walkStart) * 1000, 1);

            // 4. Cache & Discover Serial Numbers (Diperbarui berkala setiap 24 jam agar tidak membebani walk)
            $snCacheKey = "olt_bulk_sn_map_{$device->id}";
            $snMap = Cache::get($snCacheKey, []);

            // Jika cache SN kosong atau perlu refresh, lakukan SNMP bulk walk pada subtree Serial Number
            if (empty($snMap) || count($snMap) < (count($rawStates) * 0.5)) {
                $parallelSn = FastOpticalProbeService::executeParallelSnmpBulkWalk($device, [
                    'sn1' => "1.3.6.1.4.1.3902.1012.3.50.11.2.1.3",
                    'sn2' => "1.3.6.1.4.1.3902.1012.3.28.1.1.5",
                ], 50, 12);
                $rawSn1 = $parallelSn['sn1'] ?? [];
                $rawSn2 = $parallelSn['sn2'] ?? [];

                $snMap = [];
                foreach ($rawSn2 as $oid => $val) {
                    $parts = explode('.', $oid);
                    $onuId = (int)end($parts);
                    $ifIdx = (int)$parts[count($parts) - 2];
                    $cleanSn = FastOpticalProbeService::parseZteSerialNumber((string)$val);
                    if ($cleanSn && strlen($cleanSn) >= 6) {
                        $snMap["{$ifIdx}_{$onuId}"] = $cleanSn;
                    }
                }
                foreach ($rawSn1 as $oid => $val) {
                    $parts = explode('.', $oid);
                    $onuId = (int)end($parts);
                    $ifIdx = (int)$parts[count($parts) - 2];
                    if (!isset($snMap["{$ifIdx}_{$onuId}"])) {
                        $cleanSn = FastOpticalProbeService::parseZteSerialNumber((string)$val);
                        if ($cleanSn && strlen($cleanSn) >= 6) {
                            $snMap["{$ifIdx}_{$onuId}"] = $cleanSn;
                        }
                    }
                }

                // Tambahkan serial dari snapshot database sebelumnya jika ada yang belum terbaca
                $prevSnapshotOnus = $existingSnapshot['onu_list'] ?? [];
                foreach ($prevSnapshotOnus as $so) {
                    $soSn = strtoupper(trim((string)($so['serial_number'] ?? ($so['onu_mac'] ?? ''))));
                    $soPort = $so['port'] ?? '';
                    $soId = (int)($so['onu_id'] ?? 0);
                    if ($soSn && $soPort && $soId > 0) {
                        $soIfIndex = FastOpticalProbeService::calculateIfIndex($soPort);
                        if (!isset($snMap["{$soIfIndex}_{$soId}"])) {
                            $snMap["{$soIfIndex}_{$soId}"] = $soSn;
                        }
                    }
                }

                Cache::put($snCacheKey, $snMap, 600); // 10 menit TTL
            }

            // 5. Normalisasi Data Status, Rx Power, dan Tx Power
            $stateMap = [];
            foreach ($rawStates as $oid => $val) {
                $parts = explode('.', $oid);
                $onuId = (int)end($parts);
                $ifIdx = (int)$parts[count($parts) - 2];
                $stateMap["{$ifIdx}_{$onuId}"] = (int)\App\Services\Olt\SnmpConnector::parseValue((string)$val);
            }

            $rxMap = [];
            foreach ($rawRxPowers as $oid => $val) {
                $parts = explode('.', $oid);
                $onuId = (int)$parts[count($parts) - 2];
                $ifIdx = (int)$parts[count($parts) - 3];
                $rxMap["{$ifIdx}_{$onuId}"] = (int)\App\Services\Olt\SnmpConnector::parseValue((string)$val);
            }

            $txMap = [];

            // 6. Bangun Physical ONU Map untuk seluruh ONU di OLT
            $physicalOnuMap = [];
            $onusByPort = [];
            $allDiscoveredKeys = array_unique(array_merge(array_keys($stateMap), array_keys($snMap)));

            foreach ($allDiscoveredKeys as $compositeKey) {
                $kParts = explode('_', $compositeKey);
                $ifIndex = (int)($kParts[0] ?? 0);
                $onuId   = (int)($kParts[1] ?? 0);

                if ($ifIndex <= 0 || $onuId <= 0) {
                    continue;
                }

                $slotNum = ($ifIndex >> 16) & 0xFF ?: 1;
                $portNum = ($ifIndex >> 8) & 0xFF ?: ($ifIndex & 0xFF ?: 1);
                $portName = "gpon-olt_1/{$slotNum}/{$portNum}";

                $sn = $snMap[$compositeKey] ?? null;
                if (!$sn || $sn === '00000000' || strlen($sn) < 6 || preg_match('/^0+$/', $sn)) {
                    continue;
                }

                $stateCode = $stateMap[$compositeKey] ?? 0;
                $rawRx     = $rxMap[$compositeKey] ?? null;
                $rawTx     = $txMap[$compositeKey] ?? null;

                // Hitung Nilai Redaman Optik (DDM Formula)
                if ($rawRx === null || $rawRx <= 0 || $rawRx >= 65534) {
                    $rxPower = -40.00;
                } else {
                    $rxPower = round(($rawRx * 0.002) - 30.0, 2);
                }

                if ($rawTx === null || $rawTx <= 0 || $rawTx >= 65534) {
                    $txPower = 0.00;
                } else {
                    $txPower = round(($rawTx * 0.002) - 30.0, 2);
                    if ($txPower < 0 || $txPower > 10) {
                        $txPower = 1.95;
                    }
                }

                $isOnline = ($stateCode === 3 && $rxPower > -35.0 && $rxPower < -5.0);
                $status   = $isOnline ? 'Online' : 'LOS';
                if (!$isOnline) {
                    $rxPower = -40.00;
                }

                $onuItem = [
                    '_source'         => 'live_snmp',
                    'onu_id'          => (string)$onuId,
                    'port'            => $portName,
                    'customer_name'   => "ONU {$sn}",
                    'serial_number'   => $sn,
                    'vendor_model'    => 'F670L',
                    'status'          => $status,
                    'rx_power'        => $rxPower,
                    'tx_power'        => $txPower,
                    'distance_meters' => 850,
                    'ip_address'      => '—',
                ];

                $mapKey = $sn . '@' . strtolower($portName);
                $physicalOnuMap[$mapKey] = $onuItem;
                $onusByPort[$portName][] = $onuItem;
            }

            // 7. Evaluasi Kesehatan Port Fisik & Deteksi Gangguan Massal Interface
            $massDownPorts = [];
            $allPonPorts = array_map(function ($p) use ($onusByPort, $device, &$massDownPorts) {
                $pId = $p['port_id'] ?? '';
                $portOnus = $onusByPort[$pId] ?? ($onusByPort[str_replace('gpon-olt_', '', $pId)] ?? []);
                $found = count($portOnus);
                $onlineCount = count(array_filter($portOnus, fn($o) => 
                    ($o['status'] === 'Online' || strtolower($o['status'] ?? '') === 'working') 
                    && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0
                ));

                $isMassDown = false;
                if ($found >= 10) {
                    $isMassDown = ($onlineCount === 0) || ((($found - $onlineCount) / $found) >= 0.90 && $onlineCount <= 3);
                } elseif ($found >= 3) {
                    $isMassDown = ($onlineCount === 0);
                }

                if ($isMassDown) {
                    $massDownPorts[$pId] = true;
                    $massDownPorts[str_replace('gpon-olt_', '', $pId)] = true;
                }

                $p['status']          = $found > 0 ? ($isMassDown ? 'Down' : 'Up') : ($p['status'] ?? 'Down');
                $p['registered_onus'] = $found > 0 ? $found : ($p['registered_onus'] ?? 0);
                $p['online_onus']     = $onlineCount;
                $p['is_mass_outage']  = $isMassDown;

                if ($found > 0) {
                    $this->handleInterfaceMassOutagePollCheck($device, $pId, $found, $onlineCount, $portOnus);
                }

                return $p;
            }, $allPonPorts);

            // 8. Bulk Sync Database OntRegistration & Alarms (Anti-Flapping & Instant Notifications)
            $allSerials = array_unique(array_map(fn($o) => strtoupper(trim((string)$o['serial_number'])), $physicalOnuMap));
            
            if (!empty($allSerials)) {
                $dbOnts = \App\Models\OntRegistration::with(['customerService.customer', 'customerService.networkPort.node', 'oltPort.node'])
                    ->whereIn('onu_serial', $allSerials)
                    ->orWhereIn('onu_mac', $allSerials)
                    ->get()
                    ->keyBy(fn($r) => strtoupper(trim((string)($r->onu_serial ?: $r->onu_mac))));

                DB::transaction(function() use ($physicalOnuMap, $dbOnts, $device, $massDownPorts) {
                    foreach ($physicalOnuMap as $onuData) {
                        $sn = strtoupper(trim((string)$onuData['serial_number']));
                        $ontReg = $dbOnts->get($sn);
                        if (!$ontReg) continue;

                        $isOnline = ($onuData['status'] === 'Online' || strtolower($onuData['status']) === 'working') && (float)$onuData['rx_power'] > -38.0;
                        $newStatus = $isOnline ? 'active' : 'inactive';
                        $newRx     = (float)$onuData['rx_power'];
                        $newTx     = (float)$onuData['tx_power'];
                        $oldStatus = $ontReg->status;
                        $oldRx     = (float)($ontReg->rx_power ?? -40.00);

                        $portName  = $onuData['port'] ?? 'PON';
                        $custName  = $ontReg->customerService?->customer?->name ?: ('Pelanggan #' . $ontReg->id);

                        // Deteksi perubahan status untuk alarm & notifikasi
                        if ($oldStatus !== $newStatus) {
                            // Flap dampening tracking
                            $flapTrackerKey = "ont_flap_tracker_{$sn}";
                            $flaps = Cache::get($flapTrackerKey, []);
                            $now = now()->timestamp;
                            $flaps = array_values(array_filter($flaps, fn($t) => ($now - $t) <= 900));
                            $flaps[] = $now;
                            Cache::put($flapTrackerKey, $flaps, 1800);

                            $suppressKey = "ont_flap_suppressed_{$sn}";
                            if (count($flaps) >= 3) {
                                Cache::put($suppressKey, true, 1800);
                                $notifiedKey = "ont_flap_notified_{$sn}";
                                if (!Cache::has($notifiedKey)) {
                                    Cache::put($notifiedKey, true, 1800);
                                    \App\Models\AuditLog::record('ALARM_FLAPPING', 'Monitoring OLT', "⚠️ FLAPPING: Modem {$custName} ({$sn}) mengalami status naik-turun berulang kali (" . count($flaps) . "x / 15 mnt).", null, ['serial_number' => $sn, 'port' => $portName]);
                                    \App\Models\AppNotification::notifyAll(
                                        "⚠️ PERINGATAN FLAPPING: Modem {$custName} Tidak Stabil!",
                                        "Modem {$custName} (SN: {$sn}) pada port {$portName} mengalami status putus-nyambung berulang kali. Notifikasi diredam selama 30 menit.",
                                        'NOC',
                                        '/customers',
                                        null,
                                        false
                                    );
                                }
                            }

                            $isSuppressed = Cache::get($suppressKey, false);
                            $alertCooldownKey = "ont_alert_cooldown_{$sn}_{$newStatus}";
                            $inCooldown = Cache::has($alertCooldownKey);

                            if (!$isSuppressed && !$inCooldown) {
                                Cache::put($alertCooldownKey, true, 600); // 10 menit cooldown

                                // Sudden Loss
                                if ($oldStatus === 'active' && $newStatus === 'inactive') {
                                    \App\Models\AuditLog::record('ALARM_SUDDEN_LOS', 'Monitoring OLT', "🚨 SUDDEN LOSS: Modem {$custName} ({$sn}) putus / LOS pada {$portName}", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => -40.00]);
                                    $isPortMassOutage = !empty($massDownPorts[$portName]) || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}");
                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "🚨 ALARM GANGGUAN: Modem {$custName} Putus / LOS!",
                                            "Modem pelanggan {$custName} (SN: {$sn}) pada port {$portName} mengalami putus sinyal mendadak (redaman jatuh ke -40.00 dBm).",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                    }
                                }

                                // Recovery
                                if ($oldStatus === 'inactive' && $newStatus === 'active') {
                                    \App\Models\AuditLog::record('ALARM_RECOVERY', 'Monitoring OLT', "🟢 RECOVERY: Modem {$custName} ({$sn}) pulih normal pada {$portName} (Rx: {$newRx} dBm)", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => $newRx]);
                                    $isPortMassOutage = !empty($massDownPorts[$portName]) || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}");
                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "🟢 PEMULIHAN LAYANAN: Modem {$custName} Online Kembali!",
                                            "Koneksi optik pelanggan {$custName} (SN: {$sn}) pada port {$portName} telah kembali pulih dengan redaman sehat {$newRx} dBm.",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                    }
                                }
                            }

                            $ontReg->update([
                                'rx_power' => $newRx,
                                'tx_power' => $newTx,
                                'status'   => $newStatus,
                            ]);
                        } elseif (abs($oldRx - $newRx) >= 0.5) {
                            // Perbarui jika redaman berubah signifikan tanpa merusak status
                            $ontReg->update([
                                'rx_power' => $newRx,
                                'tx_power' => $newTx,
                            ]);
                        }
                    }
                });
            }

            // 9. Simpan Snapshot Data Lengkap ke Database OLT
            $existingUncfg = $existingSnapshot['unconfigured_onus'] ?? [];
            $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $allPonPorts, array_values($physicalOnuMap), $existingUncfg);

            $device->update([
                'last_telemetry_snapshot' => $finalSnapshot,
                'last_connected_at'       => now(),
            ]);

            $totalDurationMs = round((microtime(true) - $devStart) * 1000, 1);
            $totalFound      = count($physicalOnuMap);
            $totalOnline     = count(array_filter($physicalOnuMap, fn($o) => $o['status'] === 'Online'));

            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'        => 'ALL PORTS (Global Bulk)',
                'status'      => $totalFound > 0 ? 'SUCCESS' : 'EMPTY',
                'onu_count'   => $totalFound,
                'duration_ms' => $totalDurationMs,
                'timestamp'   => now()->format('H:i:s'),
            ], 60);

            self::appendWorkerLog(
                $device->name,
                'GLOBAL_BULK',
                $totalFound > 0 ? 'SUCCESS' : 'EMPTY',
                "✨ Global Bulk Selesai: {$totalFound} ONU ({$totalOnline} Online) se-OLT berhasil diperbarui ({$totalDurationMs} ms, SNMP walk: {$walkDuration} ms)",
                ['onu_count' => $totalFound, 'online_count' => $totalOnline, 'duration_ms' => $totalDurationMs]
            );

            $this->info("✨ Global Bulk Polling on {$device->name}: {$totalFound} ONUs ({$totalOnline} Online) updated in {$totalDurationMs} ms.");

            // Clear web fast cache
            $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
            Cache::forget($cacheKey);

            return 0;
        } catch (\Throwable $e) {
            self::appendWorkerLog(
                $device->name,
                'GLOBAL_BULK',
                'ERROR',
                "Gagal Global Bulk Polling pada {$device->name}: " . $e->getMessage(),
                ['error' => $e->getMessage()]
            );
            $this->error("Failed Global Bulk Polling on {$device->name}: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * Polling Khusus 1 PORT PON pada 1 Perangkat OLT (Murni Per Port PON)
     */
    protected function pollSinglePortOnDevice(int $deviceId, OltController $oltCtrl, ?string $specificPort = null): int
    {
        $device = OltDevice::find($deviceId);
        if (!$device) {
            $this->error("OLT Device ID {$deviceId} not found.");
            return 1;
        }

        $devStart = microtime(true);
        $targetPortId = $specificPort ?? 'INIT';
        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);
            $existingSnapshot = $device->last_telemetry_snapshot ?? [];

            // ═══════════════════════════════════════════════════════════════════
            // 🔹 TAHAP 1: OID SLOT & CARD (CHASSIS INVENTORY) DARI DATABASE
            // ═══════════════════════════════════════════════════════════════════
            // Membaca inventori kartu chassis dari Database Snapshot lokal
            $deviceInfo = $existingSnapshot['device_info'] ?? [];
            if ($device->connection_mode === 'live') {
                $deviceInfo['_source'] = 'live_snmp';
            }
            $cards = $deviceInfo['cards'] ?? [];

            // Jika database belum memiliki data kartu fisik, ambil sekali via SNMP lalu simpan ke database
            if (empty($cards)) {
                $freshDeviceInfo = $driver->getDeviceInfo();
                $cards = $freshDeviceInfo['cards'] ?? [];
                if (!empty($cards)) {
                    $deviceInfo = array_merge($deviceInfo, $freshDeviceInfo);
                    $existingSnapshot['device_info'] = $deviceInfo;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                    self::appendWorkerLog($device->name, 'CHASSIS', 'INFO', "Tahap 1: Slot & Card tersimpan ke Database (" . count($cards) . " cards aktif)");
                }
            }

            // ═══════════════════════════════════════════════════════════════════
            // 🔹 TAHAP 2: STATUS PORT PON & POWER OPTICAL (SFP) DARI DATABASE
            // ═══════════════════════════════════════════════════════════════════
            // Membaca daftar port fisik dan status SFP dari Database Snapshot lokal
            $allPonPorts = $existingSnapshot['pon_ports'] ?? [];

            // Jika database belum memiliki daftar port PON, ambil sekali via SNMP lalu simpan ke database
            if (empty($allPonPorts)) {
                $allPonPorts = $driver->getPonPorts();
                if (!empty($allPonPorts)) {
                    $existingSnapshot['pon_ports'] = $allPonPorts;
                    $device->update(['last_telemetry_snapshot' => $existingSnapshot]);
                    self::appendWorkerLog($device->name, 'SFP_PORTS', 'INFO', "Tahap 2: Status Port PON & SFP Power tersimpan ke Database (" . count($allPonPorts) . " port fisik)");
                }
            }

            if (empty($allPonPorts)) {
                self::appendWorkerLog($device->name, 'ALL', 'EMPTY', "Tidak ditemukan port PON pada database {$device->name}");
                return 0;
            }

            // Filter daftar Port AKTIF langsung dari data Database Snapshot
            $activePonPorts = array_values(array_filter($allPonPorts, fn($p) =>
                in_array(strtolower($p['status'] ?? ''), ['up', 'active', 'online']) ||
                ($p['registered_onus'] ?? 0) > 0 ||
                ($p['unconfigured_onus'] ?? 0) > 0
            ));

            if (empty($activePonPorts)) {
                $activePonPorts = $allPonPorts;
            }

            // ═══════════════════════════════════════════════════════════════════
            // 🔹 TAHAP 3: DUAL-LANE WORKER POOL (PRIORITY FAST LANE & ROUND-ROBIN)
            // ═══════════════════════════════════════════════════════════════════
            $batchSize = 2; // 2 Port PON per Siklus Worker Pool (Optimal & Anti-Timeout)
            $priorityKey = "olt_priority_ports_{$device->id}";
            $priorityPorts = Cache::get($priorityKey, []);

            // Filter port prioritas yang valid sesuai daftar port fisik OLT
            $validPriorityPorts = array_values(array_filter($priorityPorts, function($pId) use ($allPonPorts) {
                return collect($allPonPorts)->contains(function($p) use ($pId) {
                    return ($p['port_id'] ?? '') === $pId || str_contains($pId, (string)($p['port'] ?? '---'));
                });
            }));

            if ($specificPort) {
                $targetPorts = [$specificPort];
            } elseif (!empty($validPriorityPorts)) {
                // ── JALUR PRIORITAS (FAST LANE): Port dengan modem LOS / dalam perbaikan diprioritaskan! ──
                $priorityCursorKey = "olt_priority_cursor_{$device->id}";
                $pCursor = (int)Cache::get($priorityCursorKey, 0);
                $chosenPriorityPort = $validPriorityPorts[$pCursor % count($validPriorityPorts)];
                Cache::put($priorityCursorKey, ($pCursor + 1) % count($validPriorityPorts), 86400);

                $targetPorts = [$chosenPriorityPort];

                // Tambahkan 1 port reguler dari Round-Robin agar port sehat tetap terpantau
                $totalAvailable = count($allPonPorts);
                if ($totalAvailable > 1) {
                    $cursorKey = "olt_poll_port_cursor_{$device->id}";
                    $cursor = (int)Cache::get($cursorKey, 0);
                    $regularPort = $allPonPorts[$cursor % $totalAvailable]['port_id'];
                    if ($regularPort !== $chosenPriorityPort) {
                        $targetPorts[] = $regularPort;
                    } else {
                        $regularPort2 = $allPonPorts[($cursor + 1) % $totalAvailable]['port_id'];
                        $targetPorts[] = $regularPort2;
                    }
                    Cache::put($cursorKey, ($cursor + 1) % $totalAvailable, 86400);
                }

                self::appendWorkerLog($device->name, $chosenPriorityPort, 'FAST_LANE', "🔥 [Fast-Lane Prioritas] Memprioritaskan pemeriksaan port LOS: {$chosenPriorityPort}");
            } else {
                // ── JALUR REGULER (ROUND-ROBIN): Seluruh port normal bergulir seimbang ──
                $totalAvailable = count($allPonPorts);
                if ($totalAvailable === 0) {
                    return 0;
                }

                $cursorKey = "olt_poll_port_cursor_{$device->id}";
                $cursor = (int)Cache::get($cursorKey, 0);
                if ($cursor >= $totalAvailable) {
                    $cursor = 0;
                }

                $targetPorts = [];
                for ($i = 0; $i < min($batchSize, $totalAvailable); $i++) {
                    $idx = ($cursor + $i) % $totalAvailable;
                    $targetPorts[] = $allPonPorts[$idx]['port_id'];
                }

                // Majukan cursor sesuai batch size
                $nextCursor = ($cursor + count($targetPorts)) % $totalAvailable;
                Cache::put($cursorKey, $nextCursor, 86400);
            }

            $batchLabel = implode(', ', $targetPorts);

            // Catat port yang sedang di-query real-time untuk pulse indicator di UI
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'       => $batchLabel,
                'status'     => 'SYNCING',
                'timestamp'  => now()->format('H:i:s'),
                'started_at' => microtime(true),
            ], 60);

            self::appendWorkerLog($device->name, $batchLabel, 'SYNCING', "Tahap 3: Worker Pool memproses (" . $batchLabel . ") simultan...");

            // Eksekusi penarikan data untuk setiap port di dalam batch
            $batchStart = microtime(true);
            $batchOnusCombined = [];
            $portsResults = [];

            foreach ($targetPorts as $pId) {
                $pStart = microtime(true);
                $pOnus = $driver->getOnuListByPort($pId);
                $pDuration = round((microtime(true) - $pStart) * 1000, 1);
                
                $portsResults[$pId] = [
                    'count'       => count($pOnus),
                    'duration_ms' => $pDuration,
                    'onus'        => $pOnus,
                ];

                $batchOnusCombined = array_merge($batchOnusCombined, $pOnus);
            }

            $batchDuration = round((microtime(true) - $batchStart) * 1000, 1);
            $totalBatchFound = count($batchOnusCombined);

            // Update status pulse selesai
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'        => $batchLabel,
                'status'      => $totalBatchFound > 0 ? 'SUCCESS' : 'EMPTY',
                'onu_count'   => $totalBatchFound,
                'duration_ms' => $batchDuration,
                'timestamp'   => now()->format('H:i:s'),
            ], 60);

            // 1. Ambil data fisik ONU yang sudah tersimpan sebelumnya (baik Registered maupun Unconfigured)
            $existingRegistered   = $existingSnapshot['onu_list'] ?? [];
            $existingUnconfigured = $existingSnapshot['unconfigured_onus'] ?? [];

            $physicalOnuMap = [];
            foreach (array_merge($existingRegistered, $existingUnconfigured) as $o) {
                $sn = strtoupper(trim((string)($o['serial_number'] ?? ($o['mac_address'] ?? ''))));
                $p  = strtolower(trim((string)($o['port'] ?? ($o['detected_port'] ?? ''))));
                if (!empty($sn)) {
                    $key = $sn . '@' . $p;
                    $physicalOnuMap[$key] = $o;
                }
            }

            // 2. Hapus entri lama khusus untuk port yang sedang di-query di batch ini secara PRESISI
            foreach ($physicalOnuMap as $key => $o) {
                $p = $o['port'] ?? ($o['detected_port'] ?? '');
                foreach ($targetPorts as $tPort) {
                    if ($oltCtrl->portsMatch($p, $tPort)) {
                        unset($physicalOnuMap[$key]);
                        break;
                    }
                }
            }

            // 3. Evaluasi KESEHATAN PORT DI BATCH INI (Deteksi Dini Gangguan Massal Interface)
            $massDownPorts = [];
            foreach ($portsResults as $pIdKey => $pRes) {
                $pFound = $pRes['count'] ?? 0;
                $pOnusList = $pRes['onus'] ?? [];
                $pOnlineCount = count(array_filter($pOnusList, fn($o) => 
                    ($o['status'] === 'Online' || strtolower($o['status'] ?? '') === 'working') 
                    && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0
                ));
                
                // Gangguan Massal Interface: >= 3 pelanggan & 0 online (100% mati), ATAU >= 6 pelanggan & online <= 15%
                $isMassDown = ($pFound >= 3 && $pOnlineCount === 0) || ($pFound >= 6 && $pOnlineCount <= (int)ceil($pFound * 0.15));
                if ($isMassDown) {
                    $massDownPorts[$pIdKey] = true;
                    $massDownPorts[str_replace('gpon-olt_', '', $pIdKey)] = true;
                    $this->handleInterfaceMassOutagePollCheck($device, $pIdKey, $pFound, $pOnlineCount, $pOnusList);
                }
            }

            // Masukkan data ONU segar hasil pembacaan port saat ini & Kelola Priority Watchlist
            $activePriorityPorts = $validPriorityPorts;

            if (!empty($batchOnusCombined)) {
                foreach ($batchOnusCombined as $onuData) {
                    $sn = strtoupper(trim((string)($onuData['serial_number'] ?? ($onuData['mac_address'] ?? ''))));
                    $p  = strtolower(trim((string)($onuData['port'] ?? ($onuData['detected_port'] ?? ''))));
                    if (!$sn) continue;

                    $isOnline = ($onuData['status'] === 'Online' || strtolower($onuData['status']) === 'working') && isset($onuData['rx_power']) && is_numeric($onuData['rx_power']) && (float)$onuData['rx_power'] > -38.0;
                    $newStatus = $isOnline ? 'active' : 'inactive';
                    $newRx     = $isOnline ? (float)$onuData['rx_power'] : -40.00;
                    $newTx     = $isOnline ? ($onuData['tx_power'] ?? 1.95) : 0.0;

                    // 🛡️ LAYER 1: MULTI-PORT CONFLICT & GHOST ONU GUARD
                    // Cek apakah serial ini tercatat aktif/online di port lain (dalam physicalOnuMap atau batch saat ini)
                    $isOnlineElsewhere = false;
                    $elsewherePort = null;

                    foreach ($physicalOnuMap as $otherKey => $otherOnu) {
                        $otherSn = strtoupper(trim((string)($otherOnu['serial_number'] ?? ($otherOnu['mac_address'] ?? ''))));
                        $otherP  = strtolower(trim((string)($otherOnu['port'] ?? ($otherOnu['detected_port'] ?? ''))));
                        if ($otherSn === $sn && !$oltCtrl->portsMatch($otherP, $p)) {
                            $otherIsOnline = ($otherOnu['status'] === 'Online' || strtolower($otherOnu['status'] ?? '') === 'working')
                                && isset($otherOnu['rx_power']) && is_numeric($otherOnu['rx_power']) && (float)$otherOnu['rx_power'] > -38.0;
                            if ($otherIsOnline) {
                                $isOnlineElsewhere = true;
                                $elsewherePort = $otherOnu['port'] ?? $otherP;
                                break;
                            }
                        }
                    }

                    // KASUS A: Port ini melaporkan Offline/LOS, tapi modem terbukti AKTIF ONLINE di port lain!
                    // Ini membuktikan entri di port saat ini adalah konfigurasi lama/ghost di OLT yang belum dihapus.
                    if (!$isOnline && $isOnlineElsewhere) {
                        $this->warn("[GHOST_ONU_IGNORED] Serial {$sn} aktif online di port {$elsewherePort}. Mengabaikan status offline/ghost dari port {$p}.");
                        // Hapus entri ghost ini dari physicalOnuMap jika ada agar tidak mengotori snapshot dan port health
                        $ghostKey = $sn . '@' . $p;
                        unset($physicalOnuMap[$ghostKey]);
                        continue;
                    }

                    // KASUS B: Port ini melaporkan ONLINE, bersihkan entri lama/stale yang offline untuk serial ini dari port lain
                    if ($isOnline) {
                        foreach ($physicalOnuMap as $chkKey => $chkOnu) {
                            $chkSn = strtoupper(trim((string)($chkOnu['serial_number'] ?? ($chkOnu['mac_address'] ?? ''))));
                            $chkP  = strtolower(trim((string)($chkOnu['port'] ?? ($chkOnu['detected_port'] ?? ''))));
                            if ($chkSn === $sn && !$oltCtrl->portsMatch($chkP, $p)) {
                                unset($physicalOnuMap[$chkKey]);
                            }
                        }
                    }

                    $key = $sn . '@' . $p;
                    $physicalOnuMap[$key] = $onuData;

                    // Cari kecocokan data pelanggan
                    $ontReg = \App\Models\OntRegistration::with(['customerService.customer', 'customerService.networkPort.node', 'oltPort.node'])
                        ->whereRaw('LOWER(onu_serial) = ?', [strtolower($sn)])
                        ->orWhereRaw('LOWER(onu_mac) = ?', [strtolower($sn)])
                        ->first();

                    if ($ontReg) {
                        // 🛡️ LAYER 1.5: GHOST PORT MISMATCH GUARD
                        // Ambil port resmi OLT dari ODP pelanggan atau ONT registration
                        $officialPort = $ontReg->customerService?->networkPort?->node?->olt_port_ref 
                            ?: ($ontReg->oltPort?->node?->olt_port_ref ?: null);

                        // Jika modem terbaca offline/LOS pada port $p, tetapi port resmi pelanggan adalah port lain:
                        // Ini 100% ghost config sisa di OLT! Lewati agar tidak merusak status riil pelanggan!
                        if (!$isOnline && $officialPort && !$oltCtrl->portsMatch($p, $officialPort)) {
                            $this->warn("[GHOST_PORT_IGNORED] Serial {$sn} resmi terdaftar di {$officialPort} (ODP " . ($ontReg->customerService?->networkPort?->node?->name ?? 'N/A') . "), namun terbaca offline di port {$p}. Mengabaikan status ghost.");
                            $ghostKey = $sn . '@' . $p;
                            unset($physicalOnuMap[$ghostKey]);
                            continue;
                        }

                        $oldStatus = $ontReg->status;
                        $custName  = $ontReg->customerService?->customer?->name ?: ('Pelanggan #' . $ontReg->id);
                        $portName  = $onuData['port'] ?? ($ontReg->oltPort?->node?->olt_port_ref ?: ($targetPorts[0] ?? 'PON'));
                        $onuIdVal  = $onuData['onu_id'] ?? null;
                        $portDesc  = $portName . ($onuIdVal ? ":{$onuIdVal}" : "");
                        $odpName   = $ontReg->customerService?->networkPort?->node?->name;
                        $odpInfo   = $odpName ? "\n<b>Lokasi ODP:</b> {$odpName}" : "";

                        // Cek perubahan status untuk deteksi Alarm & Anti-Flapping
                        if ($oldStatus !== $newStatus) {
                            // 🛡️ LAYER 2: FLAP DAMPENING TRACKER & RATE LIMITING
                            $flapTrackerKey = "ont_flap_tracker_{$sn}";
                            $flaps = Cache::get($flapTrackerKey, []);
                            $now = now()->timestamp;
                            // Filter transisi dalam jendela 15 menit terakhir (900 detik)
                            $flaps = array_values(array_filter($flaps, fn($t) => ($now - $t) <= 900));
                            $flaps[] = $now;
                            Cache::put($flapTrackerKey, $flaps, 1800);

                            // Jika berfluktuasi >= 3 kali dalam 15 menit, aktifkan peredam notifikasi (suppression)
                            $suppressKey = "ont_flap_suppressed_{$sn}";
                            if (count($flaps) >= 3) {
                                Cache::put($suppressKey, true, 1800); // Redam notifikasi selama 30 menit
                                $notifiedKey = "ont_flap_notified_{$sn}";
                                if (!Cache::has($notifiedKey)) {
                                    Cache::put($notifiedKey, true, 1800);
                                    \App\Models\AuditLog::record('ALARM_FLAPPING', 'Monitoring OLT', "⚠️ FLAPPING: Modem {$custName} ({$sn}) mengalami status naik-turun berulang kali (" . count($flaps) . "x / 15 mnt). Notifikasi diredam 30 menit.", null, ['serial_number' => $sn, 'port' => $portName]);
                                    \App\Models\AppNotification::notifyAll(
                                        "⚠️ PERINGATAN FLAPPING: Modem {$custName} Tidak Stabil!",
                                        "Modem {$custName} (SN: {$sn}) pada port {$portName} mengalami status putus-nyambung berulang kali. Notifikasi peringatan untuk modem ini otomatis diredam selama 30 menit demi mencegah spam.",
                                        'NOC',
                                        '/customers',
                                        null,
                                        false
                                    );
                                }
                            }

                            $isSuppressed = Cache::get($suppressKey, false);
                            // Cooldown per status: jangan kirim notifikasi jenis status yang sama jika sudah terkirim dalam 10 menit terakhir
                            $alertCooldownKey = "ont_alert_cooldown_{$sn}_{$newStatus}";
                            $inCooldown = Cache::has($alertCooldownKey);

                            if (!$isSuppressed && !$inCooldown) {
                                Cache::put($alertCooldownKey, true, 600); // 10 menit cooldown per event tipe

                                // 🚨 ALARM SUDDEN LOSS: Modem tiba-tiba drop dari Online menjadi LOS/Mati
                                if ($oldStatus === 'active' && $newStatus === 'inactive') {
                                    \App\Models\AuditLog::record('ALARM_SUDDEN_LOS', 'Monitoring OLT', "🚨 SUDDEN LOSS: Modem {$custName} ({$sn}) tiba-tiba putus / LOS pada {$portName}", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => -40.00]);

                                    // REDAM ALERT INDIVIDUAL JIKA PORT SEDANG GANGGUAN MASSAL!
                                    // Notifikasi difokuskan pada ALARM GANGGUAN MASSAL INTERFACE agar tidak spamming puluhan alert per modem
                                    $isPortMassOutage = !empty($massDownPorts[$portName]) 
                                        || !empty($massDownPorts[str_replace('gpon-olt_', '', $portName)])
                                        || !empty($massDownPorts[$p])
                                        || !empty($massDownPorts[str_replace('gpon-olt_', '', $p)])
                                        || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}")
                                        || Cache::has("interface_in_mass_outage_{$device->id}_" . str_replace('gpon-olt_', '', $portName));

                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "🚨 ALARM GANGGUAN: Modem {$custName} Putus / LOS!",
                                            "Modem pelanggan {$custName} (SN: {$sn}) pada port {$portName} mengalami putus sinyal mendadak (redaman jatuh ke -40.00 dBm). Port otomatis dimasukkan ke Jalur Prioritas Cepat.",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                    }

                                    // Masukkan port ini ke antrean prioritas cepat
                                    if (!in_array($portName, $activePriorityPorts)) {
                                        $activePriorityPorts[] = $portName;
                                    }
                                }

                                // 🟢 ALARM INSTANT RECOVERY: Modem terdeteksi pulih kembali online!
                                if ($oldStatus === 'inactive' && $newStatus === 'active') {
                                    \App\Models\AuditLog::record('ALARM_RECOVERY', 'Monitoring OLT', "🟢 RECOVERY: Modem {$custName} ({$sn}) pulih normal pada {$portName} (Rx: {$newRx} dBm)", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => $newRx]);

                                    $isPortMassOutage = !empty($massDownPorts[$portName]) 
                                        || !empty($massDownPorts[str_replace('gpon-olt_', '', $portName)])
                                        || !empty($massDownPorts[$p])
                                        || !empty($massDownPorts[str_replace('gpon-olt_', '', $p)])
                                        || Cache::has("interface_in_mass_outage_{$device->id}_{$portName}")
                                        || Cache::has("interface_in_mass_outage_{$device->id}_" . str_replace('gpon-olt_', '', $portName));

                                    if (!$isPortMassOutage) {
                                        \App\Models\AppNotification::notifyAll(
                                            "🟢 PEMULIHAN LAYANAN: Modem {$custName} Online Kembali!",
                                            "Koneksi optik pelanggan {$custName} (SN: {$sn}) pada port {$portName} telah kembali pulih dengan redaman sehat {$newRx} dBm.",
                                            'NOC',
                                            '/customers',
                                            null,
                                            false
                                        );
                                    }
                                }
                            }
                        }

                        $ontReg->update([
                            'rx_power' => $newRx,
                            'tx_power' => $newTx,
                            'status'   => $newStatus,
                        ]);
                    }
                }
            }

            // 🛡️ LAYER 3: EVALUASI PORT PRIORITAS DENGAN FILTER GHOST ONU
            // Jika semua modem riil pada port tersebut sudah online, keluarkan dari prioritas
            foreach ($targetPorts as $tPort) {
                $onusOnPort = array_filter(array_values($physicalOnuMap), function($o) use ($tPort, $oltCtrl) {
                    $p = $o['port'] ?? ($o['detected_port'] ?? '');
                    return $oltCtrl->portsMatch($p, $tPort);
                });

                $hasLossOnPort = false;
                foreach ($onusOnPort as $o) {
                    $isOnline = ($o['status'] === 'Online' || strtolower($o['status'] ?? '') === 'working') && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0;
                    if (!$isOnline) {
                        // Verifikasi apakah ONU offline ini sebenarnya aktif online di port lain (ghost ONU)
                        $sn = strtoupper(trim((string)($o['serial_number'] ?? ($o['mac_address'] ?? ''))));
                        $isGhost = false;
                        if ($sn) {
                            foreach ($physicalOnuMap as $otherKey => $otherOnu) {
                                $otherSn = strtoupper(trim((string)($otherOnu['serial_number'] ?? ($otherOnu['mac_address'] ?? ''))));
                                $otherP  = strtolower(trim((string)($otherOnu['port'] ?? ($otherOnu['detected_port'] ?? ''))));
                                if ($otherSn === $sn && !$oltCtrl->portsMatch($otherP, $tPort)) {
                                    $otherIsOnline = ($otherOnu['status'] === 'Online' || strtolower($otherOnu['status'] ?? '') === 'working')
                                        && isset($otherOnu['rx_power']) && (float)$otherOnu['rx_power'] > -38.0;
                                    if ($otherIsOnline) {
                                        $isGhost = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!$isGhost) {
                            $hasLossOnPort = true;
                            break;
                        }
                    }
                }

                if ($hasLossOnPort) {
                    if (!in_array($tPort, $activePriorityPorts)) {
                        $activePriorityPorts[] = $tPort;
                    }
                } else {
                    // Semua modem pada port ini sudah sehat (atau ghost yang diabaikan) -> Keluarkan dari antrean prioritas
                    $activePriorityPorts = array_values(array_filter($activePriorityPorts, fn($p) => !$oltCtrl->portsMatch($p, $tPort)));
                }
            }

            Cache::put($priorityKey, array_values(array_unique($activePriorityPorts)), 86400);

            // 4. Perbarui status port fisik di pon_ports snapshot (Termasuk deteksi Mati Massal)
            $allPonPorts = array_map(function ($p) use ($portsResults, $device) {
                $pId = $p['port_id'] ?? '';
                if (isset($portsResults[$pId])) {
                    $found = $portsResults[$pId]['count'];
                    $onus = $portsResults[$pId]['onus'] ?? [];
                    $onlineCount = count(array_filter($onus, fn($o) => ($o['status'] === 'Online' || strtolower($o['status'] ?? '') === 'working') && isset($o['rx_power']) && (float)$o['rx_power'] > -38.0));
                    
                    // Port Down jika ada registered ONUs tetapi seluruhnya mati (online == 0)
                    $isMassDown = $found > 0 && $onlineCount === 0;
                    $p['status'] = $found > 0 ? ($isMassDown ? 'Down' : 'Up') : ($p['status'] ?? 'Down');
                    $p['registered_onus'] = $found;
                    $p['online_onus'] = $onlineCount;
                    $p['is_mass_outage'] = $isMassDown;

                    // Evaluasi fail-safe alert gangguan massal via background poller
                    $this->handleInterfaceMassOutagePollCheck($device, $pId, $found, $onlineCount, $onus);
                }
                return $p;
            }, $allPonPorts);

            // 5. Update snapshot database langsung dengan seluruh akumulasi ONU dari semua port
            $deviceInfo = $existingSnapshot['device_info'] ?? $driver->getDeviceInfo();
            if ($device->connection_mode === 'live') {
                $deviceInfo['_source'] = 'live_snmp';
            }
            if (!empty($cards)) {
                $deviceInfo['cards'] = $cards;
            }
            
            $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $allPonPorts, array_values($physicalOnuMap), []);
            
            $device->update([
                'last_telemetry_snapshot' => $finalSnapshot,
                'last_connected_at'       => now(),
            ]);

            self::appendWorkerLog(
                $device->name,
                $batchLabel,
                $totalBatchFound > 0 ? 'SUCCESS' : 'EMPTY',
                "Worker Pool Batch 4-Port (" . $batchLabel . "): {$totalBatchFound} ONU terbaca & database terupdate ({$batchDuration} ms)",
                ['onu_count' => $totalBatchFound, 'duration_ms' => $batchDuration]
            );

            $this->info("Worker Pool Batch ({$batchLabel}) updated: {$totalBatchFound} ONUs in {$batchDuration} ms.");

            // Clear web fast cache
            $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
            Cache::forget($cacheKey);

            $devDurationMs = round((microtime(true) - $devStart) * 1000, 1);
            return 0;
        } catch (\Exception $e) {
            $portLabel = $targetPortId ?? 'ERROR';
            self::appendWorkerLog(
                $device->name,
                $portLabel,
                'ERROR',
                "Gagal query port {$portLabel}: " . $e->getMessage(),
                ['error' => $e->getMessage()]
            );
            $this->error("Failed to poll port on {$device->name}: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * Evaluasi gangguan massal interface via background poller (Fail-safe backup untuk SNMP trap)
     */
    protected function handleInterfaceMassOutagePollCheck(OltDevice $device, string $pId, int $found, int $onlineCount, array $onus): void
    {
        $oltId = $device->id;
        $oltName = $device->name;
        $cleanP = str_replace(['gpon-olt_', 'epon-olt_'], '', $pId);
        $fullP  = (str_starts_with($pId, 'gpon-') || str_starts_with($pId, 'epon-')) ? $pId : "gpon-olt_{$pId}";

        $activeMassKey = "interface_in_mass_outage_{$oltId}_{$pId}";
        $activeMassKeyClean = "interface_in_mass_outage_{$oltId}_{$cleanP}";
        $activeMassKeyFull = "interface_in_mass_outage_{$oltId}_{$fullP}";

        $alertSentKey = "interface_mass_alert_sent_{$oltId}_{$pId}";
        $recAlertCooldownKey = "interface_mass_recovery_alert_{$oltId}_{$pId}";

        $isCurrentlyInMassOutage = (bool)Cache::get($activeMassKey, false)
            || (bool)Cache::get($activeMassKeyClean, false)
            || (bool)Cache::get($activeMassKeyFull, false);

        // Kriteria Gangguan Massal via Polling:
        $pctDown = $found > 0 ? round((($found - $onlineCount) / $found) * 100.0, 1) : 0;

        // 🎯 POLA CERDAS GANGGUAN MASSAL INTERFACE (POLLER):
        // 1. Port >= 10 pelanggan: 100% loss ATAU minimal 90% down & toleransi online <= 3
        // 2. Port < 10 pelanggan (minimal 3): Wajib 100% loss (onlineCount === 0)
        $isMassDown = false;
        if ($found >= 10) {
            $isMassDown = ($onlineCount === 0) || ($pctDown >= 90.0 && $onlineCount <= 3);
        } elseif ($found >= 3) {
            $isMassDown = ($onlineCount === 0);
        }

        if ($isMassDown) {
            // Kunci hierarki mass outage di cache selama 1 jam
            Cache::put($activeMassKey, true, 3600);
            Cache::put($activeMassKeyClean, true, 3600);
            Cache::put($activeMassKeyFull, true, 3600);

            if (!Cache::has($alertSentKey)) {
                Cache::put($alertSentKey, true, 900); // 15 menit cooldown
                Cache::forget($recAlertCooldownKey);

                // Ambil data pelanggan dari DB untuk port ini secara aman
                $serials = array_filter(array_map(fn($o) => strtoupper(trim((string)($o['serial_number'] ?? $o['sn'] ?? ''))), $onus));
                $dbClients = collect();
                try {
                    $dbClients = DB::table('ont_registrations')
                        ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                        ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
                        ->leftJoin('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                        ->leftJoin('network_nodes', 'network_nodes.id', '=', 'network_ports.node_id')
                        ->where(function ($q) use ($serials, $cleanP, $fullP) {
                            if (!empty($serials)) {
                                $q->whereIn('ont_registrations.onu_serial', $serials)
                                  ->orWhereIn('ont_registrations.onu_mac', $serials);
                            }
                            $q->orWhere('network_nodes.olt_port_ref', $fullP)
                              ->orWhere('network_nodes.olt_port_ref', $cleanP);
                        })
                        ->select([
                            'customers.name as customer_name',
                            'customers.id as customer_id',
                            'customers.customer_number',
                            'ont_registrations.onu_serial',
                            'ont_registrations.rx_power',
                            'network_nodes.name as odp_name',
                        ])
                        ->get()
                        ->keyBy(fn($item) => strtoupper(trim((string)$item->onu_serial)));
                } catch (\Throwable $dbEx) {
                    \Illuminate\Support\Facades\Log::warning("handleInterfaceMassOutagePollCheck DB query error: " . $dbEx->getMessage());
                }

                // 🎯 TAMPILKAN 100% SELURUH PELANGGAN PADA PORT (Down = 🔴, Online = 🟢)
                $sampleList = [];
                $onlineSerials = [];
                foreach (array_values($onus) as $idx => $o) {
                    $sn = strtoupper(trim((string)($o['serial_number'] ?? $o['sn'] ?? '—')));
                    $matched = $dbClients->get($sn);
                    $cName = $matched->customer_name ?? ($o['customer_name'] ?? ($o['name'] ?? 'Pelanggan'));
                    $cId = !empty($matched->customer_number) ? $matched->customer_number : (!empty($matched->customer_id) ? "ID-{$matched->customer_id}" : "");
                    $cIdStr = $cId ? "[{$cId}] " : "";
                    $odpStr = !empty($matched->odp_name) ? " (ODP: {$matched->odp_name})" : "";

                    $st = strtolower((string)($o['status'] ?? ''));
                    $isUp = in_array($st, ['online', 'working', 'active']);
                    $rxPower = $o['rx_power'] ?? ($matched->rx_power ?? null);

                    if ($isUp) {
                        $onlineSerials[] = $sn;
                        $rxStr = ($rxPower !== null && (float)$rxPower > -35.0) ? number_format((float)$rxPower, 2, '.', '') . " dBm (ONLINE)" : "Online";
                        $sampleList[] = ($idx + 1) . ". 🟢 {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                    } else {
                        $sampleList[] = ($idx + 1) . ". 🔴 {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$sn}</code> • <code>-40.00 dBm (LOS)</code>";
                    }
                }
                $sampleListText = !empty($sampleList) ? implode("\n", $sampleList) : "—";
                $downCount = $found - $onlineCount;

                if ($onlineCount === 0 || $downCount >= $found) {
                    $smartTitle = "🚨 ALARM GANGGUAN MASSAL: Interface {$fullP} (100% TOTAL LOSS)";
                    $totalTerdampakText = "🔴 <b>{$found} dari {$found} Pelanggan (100% TOTAL LOSS)</b>";
                } else {
                    $smartTitle = "🚨 ALARM GANGGUAN MASSAL: Interface {$fullP} ({$pctDown}% LOSS • {$onlineCount} MODEM MASIH ON)";
                    $totalTerdampakText = "🔴 <b>{$downCount} dari {$found} Pelanggan ({$pctDown}% LOSS • {$onlineCount} Masih ON)</b>";
                }

                \App\Models\AppNotification::notifyAll(
                    $smartTitle,
                    "<b>• OLT:</b> {$oltName}\n" .
                    "<b>• Interface / Port:</b> <code>{$fullP}</code>\n" .
                    "<b>• Penyebab:</b> Kabel Putus / Masalah lainnya\n" .
                    "<b>• Total Terdampak:</b> {$totalTerdampakText}\n\n" .
                    "<b>Daftar Seluruh Pelanggan pada Interface:</b>\n{$sampleListText}",
                    'MASS_OUTAGE',
                    '/network',
                    'MASS_OUTAGE',
                    true,
                    'POLL_TELEMETRY'
                );

                // 💾 Bulk sync DB hanya untuk yang offline (exclude online modems)
                \App\Services\Olt\FastOpticalProbeService::instantBulkDbSync('inactive', $fullP, null, -40.00, $onlineSerials);

                // Push ke Live Events Queue untuk UI
                $recentEvents = Cache::get('telemetry_live_events', []);
                $recentEvents[] = [
                    'id'            => (string)Str::uuid(),
                    'timestamp'     => now()->toIso8601String(),
                    'time_human'    => now()->format('H:i:s'),
                    'olt_id'        => $oltId,
                    'olt_name'      => $oltName,
                    'event_type'    => 'MASS_OUTAGE',
                    'event_label'   => "GANGGUAN MASSAL: Port {$fullP} (" . ($found - $onlineCount) . "/{$found} Pelanggan)",
                    'event_level'   => 'critical',
                    'is_loss'       => true,
                    'serial_number' => 'MASS_OUTAGE',
                    'customer_name' => ($found - $onlineCount) . " dari {$found} Pelanggan pada {$fullP}",
                    'node_id'       => null,
                    'node_name'     => "Feeder {$fullP}",
                    'port'          => $fullP,
                    'onu_id'        => null,
                    'rx_power'      => -40.00,
                ];
                Cache::put('telemetry_live_events', $recentEvents, 300);
                Cache::forget('dashboard_metrics_payload');

                try {
                    DB::table('audit_logs')->insert([
                        'user_name'   => 'SYSTEM_POLLER_MASS_DETECTOR',
                        'user_role'   => 'system',
                        'action'      => 'MASS_OUTAGE',
                        'module'      => 'POLL_TELEMETRY',
                        'description' => "Gangguan massal terdeteksi via Polling pada {$oltName} Port {$fullP}: " . ($found - $onlineCount) . "/{$found} modem down",
                        'ip_address'  => $device->ip_address ?? '127.0.0.1',
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                } catch (\Throwable $e) {}
            }
        } elseif ($isCurrentlyInMassOutage && $onlineCount >= (int)ceil($found * 0.50)) {
            // Port yang tadinya mass outage sekarang sudah pulih (>= 50% online)
            Cache::forget($activeMassKey);
            Cache::forget($activeMassKeyClean);
            Cache::forget($activeMassKeyFull);
            Cache::forget($alertSentKey);

            if (!Cache::has($recAlertCooldownKey)) {
                Cache::put($recAlertCooldownKey, true, 900); // 15 menit cooldown
                Cache::forget('dashboard_metrics_payload');

                $serials = array_filter(array_map(fn($o) => strtoupper(trim((string)($o['serial_number'] ?? $o['sn'] ?? ''))), $onus));
                $dbClients = collect();
                try {
                    $dbClients = DB::table('ont_registrations')
                        ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                        ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
                        ->leftJoin('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                        ->leftJoin('network_nodes', 'network_nodes.id', '=', 'network_ports.node_id')
                        ->where(function ($q) use ($serials, $cleanP, $fullP) {
                            if (!empty($serials)) {
                                $q->whereIn('ont_registrations.onu_serial', $serials)
                                  ->orWhereIn('ont_registrations.onu_mac', $serials);
                            }
                            $q->orWhere('network_nodes.olt_port_ref', $fullP)
                              ->orWhere('network_nodes.olt_port_ref', $cleanP);
                        })
                        ->select([
                            'customers.name as customer_name',
                            'customers.id as customer_id',
                            'customers.customer_number',
                            'ont_registrations.onu_serial',
                            'network_nodes.name as odp_name',
                        ])
                        ->get()
                        ->keyBy(fn($item) => strtoupper(trim((string)$item->onu_serial)));
                } catch (\Throwable $dbEx) {
                    \Illuminate\Support\Facades\Log::warning("handleInterfaceMassOutagePollCheck recovery DB query error: " . $dbEx->getMessage());
                }

                $recList = [];
                $displayRecCount = count($onus);
                foreach (array_values($onus) as $idx => $o) {
                    $sn = strtoupper(trim((string)($o['serial_number'] ?? $o['sn'] ?? '—')));
                    $matched = $dbClients->get($sn);
                    $cName = $matched->customer_name ?? ($o['customer_name'] ?? ($o['name'] ?? 'Pelanggan'));
                    $cId = !empty($matched->customer_number) ? $matched->customer_number : (!empty($matched->customer_id) ? "ID-{$matched->customer_id}" : "");
                    $cIdStr = $cId ? "[{$cId}] " : "";
                    $odpStr = !empty($matched->odp_name) ? " (ODP: {$matched->odp_name})" : "";

                    $status = strtolower($o['status'] ?? '');
                    $rxVal = isset($o['rx_power']) ? (float)$o['rx_power'] : null;
                    $isUp = ($rxVal !== null && $rxVal > -35.0 && $rxVal < -5.0) && in_array($status, ['online', 'working']);

                    if ($isUp) {
                        $badge = "🟢";
                        $rxStr = number_format($rxVal, 2, '.', '') . " dBm (ONLINE)";
                    } else {
                        $badge = "🔴";
                        $rxStr = "-40.00 dBm (LOS)";
                    }

                    $recList[] = ($idx + 1) . ". {$badge} {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                }
                $recListText = !empty($recList) ? implode("\n", $recList) : "—";

                if ($onlineCount === $found) {
                    $smartRecTitle = "🟢 PEMULIHAN GANGGUAN MASSAL: Interface {$fullP} (100% PULIH NORMAL)";
                    $totalKlienText = "<b>{$onlineCount} dari {$found} Pelanggan (100% Pulih Normal)</b>";
                } else {
                    $smartRecTitle = "🟢 PEMULIHAN GANGGUAN MASSAL: Interface {$fullP} ({$onlineCount}/{$found} KLIEN ONLINE)";
                    $losCount = max(0, $found - $onlineCount);
                    $totalKlienText = "<b>{$onlineCount} dari {$found} Pelanggan Pulih Online</b> (🔴 {$losCount} Klien Masih LOS)";
                }

                \App\Models\AppNotification::notifyAll(
                    $smartRecTitle,
                    "<b>• OLT:</b> {$oltName}\n" .
                    "<b>• Interface / Port:</b> <code>{$fullP}</code>\n" .
                    "<b>• Status:</b> 🟢 <b>JALUR ON</b>\n" .
                    "<b>• Klien Pulih:</b> {$totalKlienText}\n\n" .
                    "<b>Daftar Seluruh Pelanggan pada Interface:</b>\n{$recListText}\n\n" .
                    "<b>Keterangan:</b> Sinyal optik pada interface <code>{$fullP}</code> telah stabil dan normal kembali.",
                    'MASS_RECOVERY',
                    '/network',
                    'MASS_RECOVERY',
                    true,
                    'POLL_TELEMETRY'
                );

                // 💾 Bulk sync DB ke active
                \App\Services\Olt\FastOpticalProbeService::instantBulkDbSync('active', $fullP, null);
            }
        }
    }

    /**
     * ⚡ PILAR 3: Hardware SFP Link Pulse (Single-Packet Multi-OID ifOperStatus ~34 milidetik)
     * Memeriksa seluruh modul SFP port PON pada OLT apakah link fisik UP (1) atau DOWN (2).
     * Mampu mendeteksi kabel patchcord putus atau SFP dicabut dalam 15 detik tanpa menunggu trap!
     */
    protected function executeHardwareSfpLinkPulse(): void
    {
        $devices = OltDevice::where('status', 'active')->where('connection_mode', 'live')->get();
        if ($devices->isEmpty()) {
            return;
        }

        foreach ($devices as $device) {
            try {
                $probe = FastOpticalProbeService::probePortHardwareStatus($device);
                if (empty($probe['success']) || empty($probe['ports'])) {
                    continue;
                }

                $cacheKey = "olt_{$device->id}_sfp_hardware_status";
                $previousPorts = Cache::get($cacheKey, []);
                $currentPorts = [];

                foreach ($probe['ports'] as $portName => $pData) {
                    $currentStatus = $pData['status_str']; // 'UP' or 'DOWN'
                    $currentPorts[$portName] = $currentStatus;
                    $prevStatus = $previousPorts[$portName] ?? null;

                    if ($prevStatus !== null) {
                        // Transisi 1: UP -> DOWN (SFP Dicabut / Kabel Putus Dekat OLT)
                        if ($prevStatus === 'UP' && $currentStatus === 'DOWN') {
                            $this->warn("🚨 [HARDWARE SFP PULSE] Port {$portName} pada {$device->name} TRANSISI UP -> DOWN!");

                            // 1. Bulk DB Sync ke inactive & -40.00 dBm seketika (<3ms)
                            FastOpticalProbeService::instantBulkDbSync('inactive', $portName, null, -40.00);

                            // 2. Kirim Notifikasi Alarm Gangguan Massal (Telegram & Web UI)
                            AppNotification::notifyAll(
                                "🚨 ALARM GANGGUAN MASSAL: Interface {$portName}",
                                "<b>• OLT:</b> {$device->name}\n" .
                                "<b>• Interface / Port:</b> <code>{$portName}</code>\n" .
                                "<b>• Penyebab:</b> 🔌 <b>PORT SFP OPTIK PADAM (LINK DOWN)</b>\n" .
                                "<b>• Deteksi:</b> Sensor fisik Hardware SFP Link Pulse (ifOperStatus)\n\n" .
                                "<b>Keterangan:</b> Sensor operasional port mendeteksi port fisik mati. Indikasi kabel patchcord putus di dekat OLT, modul SFP longgar/rusak, atau laser padam.",
                                'MASS_OUTAGE',
                                '/network',
                                'MASS_OUTAGE',
                                true, // sendTelegram = true (Eksklusif Gangguan Massal)
                                'HARDWARE_SFP_PULSE'
                            );
                        }
                        // Transisi 2: DOWN -> UP (SFP Dicolok / Patchcord Tersambung)
                        elseif ($prevStatus === 'DOWN' && $currentStatus === 'UP') {
                            $this->info("🟢 [HARDWARE SFP PULSE] Port {$portName} pada {$device->name} TRANSISI DOWN -> UP!");

                            // 1. Bulk DB Sync ke active seketika
                            FastOpticalProbeService::instantBulkDbSync('active', $portName, null);

                            // 2. Kirim Notifikasi Pemulihan Massal (Telegram & Web UI)
                            AppNotification::notifyAll(
                                "🟢 PEMULIHAN GANGGUAN MASSAL: Interface {$portName}",
                                "<b>• OLT:</b> {$device->name}\n" .
                                "<b>• Interface / Port:</b> <code>{$portName}</code>\n" .
                                "<b>• Status:</b> 🟢 <b>LINK SFP TELAH AKTIF KEMBALI (OPERATIONAL UP)</b>\n" .
                                "<b>• Deteksi:</b> Sensor fisik Hardware SFP Link Pulse (ifOperStatus)\n\n" .
                                "<b>Keterangan:</b> Jalur fisik transmisi optik pada port ini telah tersambung kembali dengan normal.",
                                'MASS_RECOVERY',
                                '/network',
                                'MASS_RECOVERY',
                                true, // sendTelegram = true
                                'HARDWARE_SFP_PULSE'
                            );
                        }
                    }
                }

                Cache::put($cacheKey, $currentPorts, 86400);
            } catch (\Throwable $e) {
                // Ignore error agar tidak menghambat polling
            }
        }
    }

    /**
     * Catat log aktivitas worker ke Cache untuk live activity stream di UI (Simpan hingga 100 log)
     */
    public static function appendWorkerLog(string $oltName, string $port, string $level, string $message, array $meta = []): void
    {
        $logs = Cache::get('backend_worker_logs', []);
        
        $entry = [
            'id'        => uniqid('log_'),
            'time'      => now()->format('H:i:s'),
            'timestamp' => now()->toIso8601String(),
            'olt'       => $oltName,
            'port'      => $port,
            'level'     => strtoupper($level), // SUCCESS, SYNCING, EMPTY, ERROR, INFO
            'message'   => $message,
            'meta'      => $meta,
        ];

        array_unshift($logs, $entry); // Tambahkan di paling atas

        // Pertahankan maksimal 100 log terakhir
        if (count($logs) > 100) {
            $logs = array_slice($logs, 0, 100);
        }

        Cache::put('backend_worker_logs', $logs, 86400);
    }
}
