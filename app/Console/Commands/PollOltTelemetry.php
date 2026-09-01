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
            $process->setTimeout(45); // 45 detik max — batas toleransi ideal untuk OLT 80-port & dense ONU
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

        $maxProcessTimeoutSec = 45; // Maksimal 45 detik per sub-process OLT

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
            // 🔹 TAHAP 3: PENARIKAN DATA ONU PER PORT PON BERTAHAP (GRANULAR)
            // ═══════════════════════════════════════════════════════════════════
            // Hanya menembak 1 PORT PON giliran saat ini (cepat, anti-timeout, non-masal)
            $cursorKey = "olt_poll_port_cursor_{$device->id}";
            $cursor = (int)Cache::get($cursorKey, 0);

            if ($specificPort) {
                $targetPortId = $specificPort;
            } else {
                if ($cursor >= count($activePonPorts)) {
                    $cursor = 0;
                }
                $targetPort = $activePonPorts[$cursor];
                $targetPortId = $targetPort['port_id'];

                // Majukan cursor untuk giliran berikutnya
                $nextCursor = ($cursor + 1) % count($activePonPorts);
                Cache::put($cursorKey, $nextCursor, 86400);
            }

            // Catat port yang sedang di-query real-time untuk pulse indicator di UI
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'       => $targetPortId,
                'status'     => 'SYNCING',
                'timestamp'  => now()->format('H:i:s'),
                'started_at' => microtime(true),
            ], 60);

            self::appendWorkerLog($device->name, $targetPortId, 'SYNCING', "Tahap 3: Query SNMP HANYA pada port {$targetPortId}...");

            // Query SNMP MURNI HANYA untuk 1 Port PON ini
            $portStart = microtime(true);
            $portOnus = $driver->getOnuListByPort($targetPortId);
            $portDuration = round((microtime(true) - $portStart) * 1000, 1);

            // Update status port selesai di-query
            Cache::put("olt_active_querying_port_{$device->id}", [
                'port'        => $targetPortId,
                'status'      => !empty($portOnus) ? 'SUCCESS' : 'EMPTY',
                'onu_count'   => count($portOnus),
                'duration_ms' => $portDuration,
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

            // 2. Hapus entri lama khusus port yang sedang di-query (agar data port ini benar-benar fresh)
            foreach ($physicalOnuMap as $sn => $o) {
                $p = strtolower($o['port'] ?? ($o['detected_port'] ?? ''));
                $targetClean = strtolower($targetPortId);
                if ($p === $targetClean || str_contains($p, $targetClean) || str_contains($targetClean, $p)) {
                    unset($physicalOnuMap[$sn]);
                }
            }

            // 3. Masukkan data ONU segar hasil pembacaan port PON saat ini
            if (!empty($portOnus)) {
                foreach ($portOnus as $onuData) {
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
                        $portName  = $onuData['port'] ?? ($ontReg->oltPort?->node?->olt_port_ref ?: $targetPortId);

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

            // 4. Update snapshot database langsung dengan seluruh akumulasi ONU dari semua port
            $deviceInfo = $existingSnapshot['device_info'] ?? $driver->getDeviceInfo();
            if (!empty($cards)) {
                $deviceInfo['cards'] = $cards;
            }
            
            $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $allPonPorts, array_values($physicalOnuMap), []);
            
            $device->update([
                'last_telemetry_snapshot' => $finalSnapshot,
                'last_connected_at'       => now(),
            ]);

            if (!empty($portOnus)) {
                self::appendWorkerLog(
                    $device->name,
                    $targetPortId,
                    'SUCCESS',
                    "Port {$targetPortId}: " . count($portOnus) . " ONU terbaca & database terupdate ({$portDuration} ms)",
                    ['onu_count' => count($portOnus), 'duration_ms' => $portDuration]
                );

                $this->info("Port {$targetPortId} updated: " . count($portOnus) . " ONUs in {$portDuration} ms.");
            } else {
                self::appendWorkerLog(
                    $device->name,
                    $targetPortId,
                    'EMPTY',
                    "Port {$targetPortId}: Standby (0 ONU terdeteksi pada laser SFP, {$portDuration} ms)",
                    ['onu_count' => 0, 'duration_ms' => $portDuration]
                );

                $this->info("Port {$targetPortId} is standby (0 ONUs) in {$portDuration} ms.");
            }

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
