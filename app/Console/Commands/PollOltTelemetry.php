<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\OltDevice;
use App\Http\Controllers\OltController;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
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
            $process->setTimeout(60); // 60 detik max — toleransi aman untuk batch 4-port padat ONU
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

        $maxProcessTimeoutSec = 60; // Maksimal 60 detik per sub-process OLT

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

            usleep(15000); // 15ms non-blocking check
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
            'throttling_delay_ms'  => 15,
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
            // 🔹 TAHAP 3: WORKER POOL 4-PORT SIMULTAN (GRANULAR & ULTRA-CEPAT)
            // ═══════════════════════════════════════════════════════════════════
            $batchSize = 4; // 4 Port PON per Siklus Worker Pool (Aman untuk CPU OLT & Cepat)

            if ($specificPort) {
                $targetPorts = [$specificPort];
            } else {
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

            self::appendWorkerLog($device->name, $batchLabel, 'SYNCING', "Tahap 3: Worker Pool memproses 4-Port (" . $batchLabel . ") simultan...");

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
                if (!empty($sn)) {
                    $physicalOnuMap[$sn] = $o;
                }
            }

            // 2. Hapus entri lama khusus untuk 4 port yang sedang di-query di batch ini (agar selalu fresh)
            foreach ($physicalOnuMap as $sn => $o) {
                $p = strtolower($o['port'] ?? ($o['detected_port'] ?? ''));
                foreach ($targetPorts as $tPort) {
                    $targetClean = strtolower($tPort);
                    if ($p === $targetClean || str_contains($p, $targetClean) || str_contains($targetClean, $p)) {
                        unset($physicalOnuMap[$sn]);
                        break;
                    }
                }
            }

            // 3. Masukkan data ONU segar hasil pembacaan 4 port saat ini
            if (!empty($batchOnusCombined)) {
                foreach ($batchOnusCombined as $onuData) {
                    $sn = strtoupper(trim((string)($onuData['serial_number'] ?? ($onuData['mac_address'] ?? ''))));
                    if (!$sn) continue;

                    $physicalOnuMap[$sn] = $onuData;
                    $newStatus = ($onuData['status'] === 'Online') ? 'active' : 'inactive';
                    $newRx     = $onuData['rx_power'] ?? null;
                    $newTx     = $onuData['tx_power'] ?? null;

                    $ontReg = \App\Models\OntRegistration::with(['customerService.customer', 'oltPort.node'])
                        ->where('onu_serial', $sn)
                        ->orWhere('onu_mac', $sn)
                        ->first();

                    if ($ontReg) {
                        $oldStatus = $ontReg->status;
                        $custName  = $ontReg->customerService?->customer?->name ?: ('Pelanggan #' . $ontReg->id);
                        $portName  = $onuData['port'] ?? ($ontReg->oltPort?->node?->olt_port_ref ?: ($targetPorts[0] ?? 'PON'));

                        // Alarm LOS Baru
                        if ($oldStatus === 'active' && $newStatus === 'inactive') {
                            $downReason = $onuData['last_down_reason'] ?? 'Loss of Signal (Kabel Putus / Dying Gasp)';
                            \App\Models\AuditLog::record('ALARM_LOS', 'Monitoring OLT', "🚨 ALERT: Modem {$custName} ({$sn}) LOS pada {$portName}", null, ['serial_number' => $sn, 'port' => $portName]);
                            \App\Services\TelegramService::send("🚨 ALARM GANGGUAN OPTIK (LOS)", "<b>Pelanggan:</b> {$custName}\n<b>SN:</b> <code>{$sn}</code>\n<b>OLT:</b> {$device->name} ({$portName})\n<b>Status:</b> 🔴 OFFLINE / LOS", 'NOC');
                        }

                        // Alarm Recovery
                        if ($oldStatus === 'inactive' && $newStatus === 'active') {
                            \App\Models\AuditLog::record('ALARM_RECOVERY', 'Monitoring OLT', "🟢 RECOVERY: Modem {$custName} ({$sn}) Online kembali pada {$portName}", null, ['serial_number' => $sn, 'port' => $portName]);
                            \App\Services\TelegramService::send("🟢 PEMULIHAN LAYANAN (RECOVERY)", "<b>Pelanggan:</b> {$custName}\n<b>SN:</b> <code>{$sn}</code>\n<b>OLT:</b> {$device->name} ({$portName})\n<b>Status:</b> 🟢 ONLINE\n<b>Rx:</b> <code>{$newRx} dBm</code>", 'NOC');
                        }

                        $ontReg->update([
                            'rx_power' => $newRx,
                            'tx_power' => $newTx,
                            'status'   => $newStatus,
                        ]);
                    }
                }
            }

            // 4. Perbarui status port fisik di pon_ports snapshot
            $allPonPorts = array_map(function ($p) use ($portsResults) {
                $pId = $p['port_id'] ?? '';
                if (isset($portsResults[$pId])) {
                    $found = $portsResults[$pId]['count'];
                    $p['status'] = $found > 0 ? 'Up' : ($p['status'] ?? 'Down');
                    $p['registered_onus'] = $found;
                }
                return $p;
            }, $allPonPorts);

            // 5. Update snapshot database langsung dengan seluruh akumulasi ONU dari semua port
            $deviceInfo = $existingSnapshot['device_info'] ?? $driver->getDeviceInfo();
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
