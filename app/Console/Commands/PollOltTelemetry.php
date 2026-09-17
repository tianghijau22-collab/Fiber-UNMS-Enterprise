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
use Symfony\Component\Process\Process;

class PollOltTelemetry extends Command
{
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll} {--port= : Specific Port to poll} {--force : Force polling} {--daemon : Run continuously in a 24/7 non-stop loop}';
    protected $description = 'Polls live telemetry per individual PON port sequentially in a continuous 24/7 loop with real-time activity streaming';

    public function handle(OltController $oltCtrl)
    {
        $deviceId = $this->option('device');
        $specificPort = $this->option('port');
        $isDaemon = $this->option('daemon');

        // JIKA SPECIFIC DEVICE ID: Jalankan polling 1 Port PON untuk OLT ini
        if ($deviceId) {
            return $this->pollSinglePortOnDevice((int)$deviceId, $oltCtrl, $specificPort);
        }

        // JIKA MODE DAEMON 24/7: Jalankan continuous loop tanpa henti (non-stop)
        if ($isDaemon) {
            $this->info("🌀 Menjalankan Continuous 24/7 Polling Daemon...");
            self::appendWorkerLog('SYSTEM', 'DAEMON', 'INFO', "Daemon 24/7 continuous loop dimulai.");

            while (true) {
                $isPaused = (bool)Cache::get('backend_worker_paused', false);
                $loopDelay = (int)Cache::get('backend_worker_loop_delay_sec', 2);

                if ($isPaused) {
                    sleep(2);
                    continue;
                }

                try {
                    $this->dispatchSinglePortParallel($oltCtrl);
                } catch (\Throwable $e) {
                    $this->error("Error in daemon loop: " . $e->getMessage());
                    self::appendWorkerLog('SYSTEM', 'DAEMON', 'ERROR', "Daemon loop error: " . $e->getMessage());
                }

                // Jeda sesuai konfigurasi interval (default 2 detik)
                sleep(max(1, $loopDelay));
            }
            return 0;
        }

        // SINGLE RUN DISPATCHER (Dipanggil manual via web trigger atau cron)
        return $this->dispatchSinglePortParallel($oltCtrl);
    }

    /**
     * Master Dispatcher: Menjalankan polling 1 Port PON per OLT secara SIMULTAN & PARALEL
     */
    protected function dispatchSinglePortParallel(OltController $oltCtrl): int
    {
        $cycleStart = microtime(true);
        $devices = OltDevice::where('status', 'active')->get();

        if ($devices->isEmpty()) {
            $this->info('No active OLT devices found.');
            return 0;
        }

        $processes = [];
        $phpBinary = PHP_BINARY ?: 'php';
        $artisanPath = base_path('artisan');

        // 1. Spawn sub-process untuk setiap OLT (masing-masing menembak 1 Port PON gilirannya)
        foreach ($devices as $device) {
            $cmd = [$phpBinary, $artisanPath, 'olt:poll-telemetry', "--device={$device->id}", '--force'];
            $process = new Process($cmd);
            $process->setTimeout(90); // 90 detik max — ruang aman 6x lipat agar tidak pernah timeout
            $process->start();

            $processes[$device->id] = [
                'process' => $process,
                'device'  => $device,
                'start'   => microtime(true),
            ];
        }

        // 2. Tunggu semua worker port selesai secara non-blocking
        $deviceReports = [];
        $totalPortsPolled = 0;
        $totalOnusPolled = 0;
        $totalUncfgPolled = 0;

        $maxProcessTimeoutSec = 90; // Maksimal 90 detik per sub-process OLT

        while (count($processes) > 0) {
            foreach ($processes as $id => $item) {
                /** @var Process $proc */
                $proc = $item['process'];
                /** @var OltDevice $dev */
                $dev = $item['device'];

                $elapsedSec = microtime(true) - $item['start'];

                // Paksa stop proses jika melebihi batas waktu (anti-hang mutlak)
                if ($elapsedSec > $maxProcessTimeoutSec && $proc->isRunning()) {
                    $proc->stop(1);
                }

                if (!$proc->isRunning()) {
                    $durationMs = round($elapsedSec * 1000, 1);
                    $output = trim($proc->getOutput());
                    $errorOutput = trim($proc->getErrorOutput());

                    // Ambil snapshot data yang baru saja diperbarui
                    $freshDev = OltDevice::find($id);
                    $snapshot = $freshDev?->last_telemetry_snapshot ?? [];
                    $ponPorts = $snapshot['pon_ports'] ?? [];
                    $allOnus  = $snapshot['onu_list'] ?? [];
                    $uncfg    = $snapshot['unconfigured_onus'] ?? [];

                    $activePorts = count(array_filter($ponPorts, fn($p) => ($p['status'] ?? '') === 'Up' || ($p['registered_onus'] ?? 0) > 0));
                    $onusCount   = count($allOnus);
                    $uncfgCount  = count($uncfg);
                    $onlineCount = count(array_filter($allOnus, fn($o) => ($o['status'] ?? '') === 'Online' || ($o['status'] ?? '') === 'active'));

                    $activeQuery = Cache::get("olt_active_querying_port_{$dev->id}");

                    $isSuccess = $proc->isSuccessful();
                    $statusStr = $isSuccess ? 'SUCCESS' : ('FAILED: ' . ($errorOutput ?: 'Process timed out or error'));

                    $totalPortsPolled += $activePorts;
                    $totalOnusPolled += $onusCount;
                    $totalUncfgPolled += $uncfgCount;

                    $deviceReports[] = [
                        'device_id'             => $dev->id,
                        'device_name'           => $dev->name,
                        'ip'                    => $dev->ip_address,
                        'vendor'                => $dev->vendor,
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
                        'status'                => $statusStr,
                        'timestamp'             => now()->format('H:i:s'),
                    ];

                    unset($processes[$id]);
                }
            }

            usleep(150000); // 150ms non-blocking check (low CPU overhead)
        }

        $totalCycleDurationMs = round((microtime(true) - $cycleStart) * 1000, 1);
        $prevStats = Cache::get('backend_worker_telemetry', []);

        // Record backend worker telemetry metadata to Cache for live monitoring
        $workerStats = [
            'status'               => 'ACTIVE (24/7 CONTINUOUS LOOP)',
            'last_run_at'          => now()->toIso8601String(),
            'last_run_human'       => now()->format('d M Y, H:i:s'),
            'cycle_duration_ms'    => $totalCycleDurationMs,
            'cycle_duration_human' => ($totalCycleDurationMs < 1000) ? "{$totalCycleDurationMs} ms" : round($totalCycleDurationMs / 1000, 2) . " s",
            'throttling_delay_ms'  => 150,
            'mode'                 => 'Continuous Port-by-Port Loop',
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
                // Ignore error agar tidak menghambat worker loop
            }
        }

        return 0;
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

            // 3. Masukkan data ONU segar hasil pembacaan port saat ini & Kelola Priority Watchlist
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
                                    \App\Models\AppNotification::notifyAll(
                                        "🚨 ALARM GANGGUAN: Modem {$custName} Putus / LOS!",
                                        "Modem pelanggan {$custName} (SN: {$sn}) pada port {$portName} mengalami putus sinyal mendadak (redaman jatuh ke -40.00 dBm). Port otomatis dimasukkan ke Jalur Prioritas Cepat.",
                                        'NOC',
                                        '/customers',
                                        null,
                                        false
                                    );

                                    // Masukkan port ini ke antrean prioritas cepat
                                    if (!in_array($portName, $activePriorityPorts)) {
                                        $activePriorityPorts[] = $portName;
                                    }
                                }

                                // 🟢 ALARM INSTANT RECOVERY: Modem terdeteksi pulih kembali online!
                                if ($oldStatus === 'inactive' && $newStatus === 'active') {
                                    \App\Models\AuditLog::record('ALARM_RECOVERY', 'Monitoring OLT', "🟢 RECOVERY: Modem {$custName} ({$sn}) pulih normal pada {$portName} (Rx: {$newRx} dBm)", null, ['serial_number' => $sn, 'port' => $portName, 'rx_power' => $newRx]);
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
        $activeMassKey = "interface_in_mass_outage_{$oltId}_{$pId}";
        $alertSentKey = "interface_mass_alert_sent_{$oltId}_{$pId}";
        $recAlertCooldownKey = "interface_mass_recovery_alert_{$oltId}_{$pId}";

        $isCurrentlyInMassOutage = (bool)Cache::get($activeMassKey, false);

        // Kriteria Gangguan Massal via Polling:
        // Ada >= 3 pelanggan terdaftar pada port, dan:
        // 1) onlineCount == 0 (100% mati), ATAU
        // 2) jika pelanggan >= 8 dan yang online <= 15% (artinya kabel distribusi utama putus)
        $isMassDown = ($found >= 3 && $onlineCount === 0) || ($found >= 8 && $onlineCount <= (int)ceil($found * 0.15));

        if ($isMassDown) {
            Cache::put($activeMassKey, true, 3600); // Kunci hierarki agar ODP alerts tidak spamming

            if (!Cache::has($alertSentKey)) {
                Cache::put($alertSentKey, true, 900); // 15 menit cooldown
                Cache::forget($recAlertCooldownKey);

                // Ambil data pelanggan dari DB untuk port ini
                $serials = array_filter(array_map(fn($o) => $o['serial_number'] ?? $o['sn'] ?? '', $onus));
                $dbClients = DB::table('ont_registrations')
                    ->leftJoin('odps', 'ont_registrations.odp_id', '=', 'odps.id')
                    ->whereIn('ont_registrations.onu_serial', $serials)
                    ->orWhere(function ($q) use ($oltId, $pId) {
                        $q->where('ont_registrations.olt_device_id', $oltId)
                          ->where('ont_registrations.port', $pId);
                    })
                    ->select(
                        'ont_registrations.customer_name',
                        'ont_registrations.customer_id',
                        'ont_registrations.customer_number',
                        'ont_registrations.onu_serial',
                        'odps.name as odp_name'
                    )
                    ->get()
                    ->keyBy('onu_serial');

                $affectedOnus = array_filter($onus, fn($o) => !in_array(strtolower($o['status'] ?? ''), ['online', 'working']));
                $displayCount = count($affectedOnus);
                $sampleList = [];
                foreach (array_slice(array_values($affectedOnus), 0, 30) as $idx => $o) {
                    $sn = $o['serial_number'] ?? $o['sn'] ?? '—';
                    $matched = $dbClients->get($sn);
                    $cName = $matched->customer_name ?? ($o['customer_name'] ?? ($o['name'] ?? 'Pelanggan'));
                    $cId = !empty($matched->customer_number) ? $matched->customer_number : (!empty($matched->customer_id) ? "ID-{$matched->customer_id}" : "");
                    $cIdStr = $cId ? "[{$cId}] " : "";
                    $odpStr = !empty($matched->odp_name) ? " (ODP: {$matched->odp_name})" : "";

                    $sampleList[] = ($idx + 1) . ". 🔴 {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$sn}</code> • <code>-40.00 dBm (LOS)</code>";
                }
                if ($displayCount > 30) {
                    $sampleList[] = "<i>... dan " . ($displayCount - 30) . " pelanggan terdampak lainnya pada interface {$pId}</i>";
                }
                $sampleListText = implode("\n", $sampleList);
                $pctDown = $found > 0 ? round((($found - $onlineCount) / $found) * 100) : 100;
                $totalTerdampakText = "🔴 <b>" . ($found - $onlineCount) . " dari {$found} Pelanggan ({$pctDown}% Terdampak)</b>";

                TelegramService::send(
                    "🚨🚨 ALARM GANGGUAN MASSAL INTERFACE 🚨🚨",
                    "<b>• OLT:</b> {$oltName}\n" .
                    "<b>• Interface / Port:</b> <code>{$pId}</code>\n" .
                    "<b>• Penyebab:</b> Kabel Feeder Putus / SFP Port Down\n" .
                    "<b>• Total Terdampak:</b> {$totalTerdampakText}\n\n" .
                    "<b>Daftar Pelanggan Terdampak:</b>\n{$sampleListText}\n\n" .
                    "<b>Diagnosa NOC:</b> Seluruh atau mayoritas pelanggan pada interface {$pId} kehilangan sinyal optik secara bersamaan.\n" .
                    "<b>Tindakan:</b> ⚠️ <i>Segera verifikasi jalur backbone/feeder interface {$pId}!</i>",
                    'NOC'
                );

                // Push ke Live Events Queue untuk UI
                $recentEvents = Cache::get('telemetry_live_events', []);
                $recentEvents[] = [
                    'id'            => (string)Str::uuid(),
                    'timestamp'     => now()->toIso8601String(),
                    'time_human'    => now()->format('H:i:s'),
                    'olt_id'        => $oltId,
                    'olt_name'      => $oltName,
                    'event_type'    => 'MASS_OUTAGE',
                    'event_label'   => "GANGGUAN MASSAL: Port {$pId} (" . ($found - $onlineCount) . "/{$found} Pelanggan)",
                    'event_level'   => 'critical',
                    'is_loss'       => true,
                    'serial_number' => 'MASS_OUTAGE',
                    'customer_name' => ($found - $onlineCount) . " dari {$found} Pelanggan pada {$pId}",
                    'node_id'       => null,
                    'node_name'     => "Feeder {$pId}",
                    'port'          => $pId,
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
                        'description' => "Gangguan massal terdeteksi via Polling pada {$oltName} Port {$pId}: " . ($found - $onlineCount) . "/{$found} modem down",
                        'ip_address'  => $device->ip_address ?? '127.0.0.1',
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                } catch (\Throwable $e) {}
            }
        } elseif ($isCurrentlyInMassOutage && $onlineCount >= (int)ceil($found * 0.50)) {
            // Port yang tadinya mass outage sekarang sudah pulih (>= 50% online)
            Cache::forget($activeMassKey);
            Cache::forget($alertSentKey);

            if (!Cache::has($recAlertCooldownKey)) {
                Cache::put($recAlertCooldownKey, true, 900); // 15 menit cooldown
                Cache::forget('dashboard_metrics_payload');

                $serials = array_filter(array_map(fn($o) => $o['serial_number'] ?? $o['sn'] ?? '', $onus));
                $dbClients = DB::table('ont_registrations')
                    ->leftJoin('odps', 'ont_registrations.odp_id', '=', 'odps.id')
                    ->whereIn('ont_registrations.onu_serial', $serials)
                    ->orWhere(function ($q) use ($oltId, $pId) {
                        $q->where('ont_registrations.olt_device_id', $oltId)
                          ->where('ont_registrations.port', $pId);
                    })
                    ->select(
                        'ont_registrations.customer_name',
                        'ont_registrations.customer_id',
                        'ont_registrations.customer_number',
                        'ont_registrations.onu_serial',
                        'odps.name as odp_name'
                    )
                    ->get()
                    ->keyBy('onu_serial');

                $recList = [];
                $displayRecCount = count($onus);
                foreach (array_slice(array_values($onus), 0, 30) as $idx => $o) {
                    $sn = $o['serial_number'] ?? $o['sn'] ?? '—';
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
                        $rxStr = number_format($rxVal, 2, '.', '') . " dBm";
                    } else {
                        $badge = "🔴";
                        $rxStr = "-40.00 dBm (LOS)";
                    }

                    $recList[] = ($idx + 1) . ". {$badge} {$cIdStr}<b>{$cName}</b>{$odpStr}\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                }
                if ($displayRecCount > 30) {
                    $recList[] = "<i>... dan " . ($displayRecCount - 30) . " pelanggan lainnya pada interface {$pId}</i>";
                }
                $recListText = implode("\n", $recList);

                if ($onlineCount === $found) {
                    $totalKlienText = "<b>{$onlineCount} dari {$found} Pelanggan (100% Pulih Normal)</b>";
                } else {
                    $losCount = max(0, $found - $onlineCount);
                    $totalKlienText = "<b>{$onlineCount} dari {$found} Pelanggan Pulih Online</b> (🔴 {$losCount} Klien Masih LOS)";
                }

                TelegramService::send(
                    "🟢🟢 PEMULIHAN GANGGUAN MASSAL INTERFACE 🟢🟢",
                    "<b>• OLT:</b> {$oltName}\n" .
                    "<b>• Interface / Port:</b> <code>{$pId}</code>\n" .
                    "<b>• Status:</b> 🟢 <b>JALUR TRANSMISI UTAMA PULIH NORMAL</b>\n" .
                    "<b>• Klien Pulih:</b> {$totalKlienText}\n\n" .
                    "<b>Daftar Pelanggan Pulih & Nilai Redaman:</b>\n{$recListText}\n\n" .
                    "<b>Keterangan:</b> Sinyal optik pada interface <code>{$pId}</code> telah stabil dan normal kembali.",
                    'NOC'
                );
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
