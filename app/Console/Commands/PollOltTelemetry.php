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
                try {
                    $this->dispatchSinglePortParallel($oltCtrl);
                } catch (\Throwable $e) {
                    $this->error("Error in daemon loop: " . $e->getMessage());
                    self::appendWorkerLog('SYSTEM', 'DAEMON', 'ERROR', "Daemon loop error: " . $e->getMessage());
                }

                // Jeda 2 detik sebelum melanjutkan ke port berikutnya pada seluruh OLT
                sleep(2);
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
            $process->setTimeout(30); // 30 detik maksimal per 1 port PON
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

        while (count($processes) > 0) {
            foreach ($processes as $id => $item) {
                /** @var Process $proc */
                $proc = $item['process'];
                /** @var OltDevice $dev */
                $dev = $item['device'];

                if (!$proc->isRunning()) {
                    $durationMs = round((microtime(true) - $item['start']) * 1000, 1);
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

                    $isSuccess = $proc->isSuccessful();
                    $statusStr = $isSuccess ? 'SUCCESS' : ('FAILED: ' . ($errorOutput ?: 'Process error'));

                    $totalPortsPolled += $activePorts;
                    $totalOnusPolled += $onusCount;

                    $deviceReports[] = [
                        'device_id'     => $dev->id,
                        'device_name'   => $dev->name,
                        'ip'            => $dev->ip_address,
                        'vendor'        => $dev->vendor,
                        'total_ports'   => count($ponPorts),
                        'active_ports'  => $activePorts,
                        'onus_found'    => $onusCount,
                        'uncfg_found'   => $uncfgCount,
                        'duration_ms'   => $durationMs,
                        'status'        => $statusStr,
                        'timestamp'     => now()->format('H:i:s'),
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
            'total_uncfg_detected' => 0,
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
            'uncfg'       => 0,
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
        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);

            // 1. Ambil daftar Port PON (seluruh port fisik, cache 5 menit)
            $allPonPorts = Cache::remember("olt_ports_list_{$device->id}", 300, function () use ($driver) {
                return $driver->getPonPorts();
            });

            if (empty($allPonPorts)) {
                $allPonPorts = $driver->getPonPorts();
                Cache::put("olt_ports_list_{$device->id}", $allPonPorts, 300);
            }

            if (empty($allPonPorts)) {
                self::appendWorkerLog($device->name, 'ALL', 'EMPTY', "Tidak ditemukan port PON pada {$device->name}");
                return 0;
            }

            // ✅ KRITIS: Hanya gunakan port AKTIF (memiliki ONU terdaftar/unconfigured)
            // Port kosong akan menyebabkan SNMP timeout 5+ detik → SKIP sepenuhnya
            $ponPorts = array_values(array_filter($allPonPorts, fn($p) =>
                ($p['registered_onus'] ?? 0) > 0 || ($p['unconfigured_onus'] ?? 0) > 0
            ));

            // Jika belum ada data ONU (pertama kali atau semua port kosong), query semua port
            // agar kita bisa "discover" port yang baru aktif
            if (empty($ponPorts)) {
                $ponPorts = $allPonPorts;
            }

            // Simpan daftar port aktif ke cache terpisah untuk cursor (TTL 5 menit)
            // Sehingga saat refresh port list, cursor tidak berjalan di port kosong
            $activePortsCacheKey = "olt_active_ports_{$device->id}";
            Cache::put($activePortsCacheKey, $ponPorts, 300);

            // 2. Tentukan target 1 Port PON yang akan di-query saat ini (Round-Robin Cursor)
            $cursorKey = "olt_poll_port_cursor_{$device->id}";
            $cursor = (int)Cache::get($cursorKey, 0);

            if ($specificPort) {
                $targetPortId = $specificPort;
            } else {
                if ($cursor >= count($ponPorts)) {
                    $cursor = 0;
                }
                $targetPort = $ponPorts[$cursor];
                $targetPortId = $targetPort['port_id'];

                // Majukan cursor untuk giliran berikutnya
                $nextCursor = ($cursor + 1) % count($ponPorts);
                Cache::put($cursorKey, $nextCursor, 86400);
            }

            self::appendWorkerLog($device->name, $targetPortId, 'SYNCING', "Query SNMP HANYA pada port {$targetPortId}...");

            // 3. Query SNMP MURNI HANYA untuk 1 Port PON ini saja (getOnuListByPort)
            $portStart = microtime(true);
            $portOnus = $driver->getOnuListByPort($targetPortId);
            $portDuration = round((microtime(true) - $portStart) * 1000, 1);

            // 4. Update Database Inkremental untuk Port PON ini
            $existingSnapshot = $device->last_telemetry_snapshot ?? [];
            $existingOnus = $existingSnapshot['onu_list'] ?? [];
            $onuMap = [];
            foreach ($existingOnus as $o) {
                if (isset($o['serial_number'])) {
                    $onuMap[$o['serial_number']] = $o;
                }
            }

            // Perbarui data ONU untuk port ini
            if (!empty($portOnus)) {
                foreach ($portOnus as $onuData) {
                    $sn = $onuData['serial_number'] ?? null;
                    if (!$sn) continue;

                    $onuMap[$sn] = $onuData;
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

                // Update snapshot database langsung (gunakan allPonPorts agar info seluruh port tersimpan)
                $deviceInfo = $existingSnapshot['device_info'] ?? $driver->getDeviceInfo();
                $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $allPonPorts, array_values($onuMap), []);
                
                $device->update([
                    'last_telemetry_snapshot' => $finalSnapshot,
                    'last_connected_at'       => now(),
                ]);

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
            self::appendWorkerLog(
                $device->name,
                $targetPortId ?? 'ERROR',
                'ERROR',
                "Gagal query port {$targetPortId}: " . $e->getMessage(),
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
