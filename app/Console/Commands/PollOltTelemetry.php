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
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll} {--force : Force polling regardless of interval}';
    protected $description = 'Polls live telemetry from active OLTs concurrently with instant per-port DB sync and live request activity streaming';

    public function handle(OltController $oltCtrl)
    {
        $deviceId = $this->option('device');

        // JIKA SPECIFIC DEVICE ID: Jalankan worker terisolasi untuk 1 OLT ini saja
        if ($deviceId) {
            return $this->pollSingleDevice((int)$deviceId, $oltCtrl);
        }

        // MASTER DISPATCHER: Jalankan SEMUA OLT secara PARALEL BERSAMAAN
        return $this->pollAllDevicesConcurrently($oltCtrl);
    }

    /**
     * Master Dispatcher: Menjalankan worker independen untuk setiap OLT secara SIMULTAN & PARALEL
     */
    protected function pollAllDevicesConcurrently(OltController $oltCtrl): int
    {
        $cycleStart = microtime(true);
        $devices = OltDevice::where('status', 'active')->get();

        if ($devices->isEmpty()) {
            $this->info('No active OLT devices found for telemetry polling.');
            return 0;
        }

        $this->info("🚀 Memulai Parallel Multi-Process Poller untuk " . count($devices) . " OLT secara SIMULTAN (Zero-Queue)...");
        self::appendWorkerLog('SYSTEM', 'ALL', 'INFO', "Memulai siklus polling paralel untuk " . count($devices) . " OLT aktif...");

        $processes = [];
        $phpBinary = PHP_BINARY ?: 'php';
        $artisanPath = base_path('artisan');

        // 1. Spawn sub-process untuk setiap OLT pada DETIK YANG SAMA
        foreach ($devices as $device) {
            $cmd = [$phpBinary, $artisanPath, 'olt:poll-telemetry', "--device={$device->id}", '--force'];
            $process = new Process($cmd);
            $process->setTimeout(25); // Max 25s isolation timeout
            $process->start();

            $processes[$device->id] = [
                'process' => $process,
                'device'  => $device,
                'start'   => microtime(true),
            ];

            self::appendWorkerLog($device->name, 'INIT', 'SYNCING', "Worker #{$device->id} dimulai (IP: {$device->ip_address})");
            $this->line("  ⚡ [Worker #{$device->id}] Spawning sub-process paralel untuk {$device->name} ({$device->ip_address})...");
        }

        // 2. Tunggu semua worker selesai secara non-blocking
        $deviceReports = [];
        $totalPortsPolled = 0;
        $totalOnusPolled = 0;
        $totalUncfgPolled = 0;

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

                    // Ambil snapshot data yang baru saja diperbarui secara realtime oleh sub-process
                    $freshDev = OltDevice::find($id);
                    $snapshot = $freshDev?->last_telemetry_snapshot ?? [];
                    $ponPorts = $snapshot['pon_ports'] ?? [];
                    $allOnus  = $snapshot['onu_list'] ?? [];
                    $uncfg    = $snapshot['unconfigured_onus'] ?? [];

                    $activePorts = count(array_filter($ponPorts, fn($p) => ($p['status'] ?? '') === 'Up' || ($p['registered_onus'] ?? 0) > 0));
                    $onusCount   = count($allOnus);
                    $uncfgCount  = count($uncfg);

                    $isSuccess = $proc->isSuccessful();
                    $statusStr = $isSuccess ? 'SUCCESS' : ('FAILED: ' . ($errorOutput ?: 'Process timeout'));

                    $totalPortsPolled += $activePorts;
                    $totalOnusPolled += $onusCount;
                    $totalUncfgPolled += $uncfgCount;

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

                    self::appendWorkerLog(
                        $dev->name,
                        'SUMMARY',
                        $isSuccess ? 'SUCCESS' : 'ERROR',
                        "Selesai dalam {$durationMs} ms (Port: {$activePorts}, ONU: {$onusCount}, Uncfg: {$uncfgCount})",
                        ['duration_ms' => $durationMs, 'onus' => $onusCount]
                    );

                    $this->info("  ✅ [Worker #{$dev->id}] {$dev->name} selesai dalam {$durationMs} ms (Port: {$activePorts}, ONU: {$onusCount}).");

                    unset($processes[$id]);
                }
            }

            usleep(15000); // 15ms non-blocking check interval
        }

        $totalCycleDurationMs = round((microtime(true) - $cycleStart) * 1000, 1);
        $prevStats = Cache::get('backend_worker_telemetry', []);

        // Record backend worker telemetry metadata to Cache for live monitoring
        $workerStats = [
            'status'               => 'ACTIVE (PARALLEL CONCURRENT)',
            'last_run_at'          => now()->toIso8601String(),
            'last_run_human'       => now()->format('d M Y, H:i:s'),
            'cycle_duration_ms'    => $totalCycleDurationMs,
            'cycle_duration_human' => ($totalCycleDurationMs < 1000) ? "{$totalCycleDurationMs} ms" : round($totalCycleDurationMs / 1000, 2) . " s",
            'throttling_delay_ms'  => 15,
            'mode'                 => 'Parallel Multi-Process',
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
            'status'      => 'OK (PARALLEL)',
        ];
        if (count($cycleHistory) > 15) {
            $cycleHistory = array_slice($cycleHistory, -15);
        }
        Cache::put('backend_worker_history', $cycleHistory, 86400);

        $this->info("✨ Seluruh " . count($devices) . " OLT selesai di-poll secara paralel dalam {$totalCycleDurationMs} ms.");
        return 0;
    }

    /**
     * Polling Khusus 1 Unit OLT Terisolasi (Sub-Process dengan Update Database Inkremental per Port)
     */
    protected function pollSingleDevice(int $deviceId, OltController $oltCtrl): int
    {
        $device = OltDevice::find($deviceId);
        if (!$device) {
            $this->error("OLT Device ID {$deviceId} not found.");
            return 1;
        }

        $devStart = microtime(true);
        $this->info("Polling OLT: {$device->name} ({$device->ip_address}:{$device->snmp_port}) Mode: {$device->connection_mode} (Throttling: 15ms)...");

        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);

            $deviceInfo = $driver->getDeviceInfo();
            $ponPorts   = $driver->getPonPorts();
            
            $allOnus = [];
            $activePortCount = 0;

            // Inisialisasi snapshot awal dari database jika ada
            $existingSnapshot = $device->last_telemetry_snapshot ?? [];
            $existingOnuMap = [];
            foreach ($existingSnapshot['onu_list'] ?? [] as $o) {
                if (isset($o['serial_number'])) {
                    $existingOnuMap[$o['serial_number']] = $o;
                }
            }

            foreach ($ponPorts as $port) {
                $portId = $port['port_id'];
                $hasOnus = (($port['registered_onus'] ?? 0) > 0 || ($port['unconfigured_onus'] ?? 0) > 0);

                if ($hasOnus) {
                    $activePortCount++;
                    $portStart = microtime(true);
                    
                    self::appendWorkerLog($device->name, $portId, 'SYNCING', "Sedang query SNMP port {$portId}...");

                    try {
                        // Query OLT per port (dengan auto-retry & adaptive timeout di SnmpConnector)
                        $portOnus = $driver->getOnuListByPort($portId);
                        $portDuration = round((microtime(true) - $portStart) * 1000, 1);

                        if (!empty($portOnus)) {
                            $allOnus = array_merge($allOnus, $portOnus);
                            
                            // ── INKREMENTAL: LANGSUNG UPDATE DATABASE UNTUK PORT INI DETIK ITU JUGA ──
                            foreach ($portOnus as $onuData) {
                                $sn = $onuData['serial_number'] ?? null;
                                if (!$sn) continue;

                                $existingOnuMap[$sn] = $onuData;
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
                                    $portName  = $onuData['port'] ?? ($ontReg->oltPort?->node?->olt_port_ref ?: 'epon_0/1');

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

                            // Update snapshot database langsung
                            $device->update([
                                'last_telemetry_snapshot' => $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $ponPorts, array_values($existingOnuMap), []),
                                'last_connected_at'       => now(),
                            ]);

                            self::appendWorkerLog(
                                $device->name,
                                $portId,
                                'SUCCESS',
                                "Port {$portId}: " . count($portOnus) . " ONU terbaca & database terupdate ({$portDuration} ms)",
                                ['onu_count' => count($portOnus), 'duration_ms' => $portDuration]
                            );
                        } else {
                            self::appendWorkerLog(
                                $device->name,
                                $portId,
                                'EMPTY',
                                "Port {$portId}: Standby (0 ONU terdeteksi pada laser SFP, {$portDuration} ms)",
                                ['onu_count' => 0]
                            );
                        }
                    } catch (\Exception $e) {
                        self::appendWorkerLog(
                            $device->name,
                            $portId,
                            'ERROR',
                            "Port {$portId}: Timeout / Error ({$e->getMessage()})",
                            ['error' => $e->getMessage()]
                        );
                    }

                    // Jeda throttling 15 milidetik (0.015s) antar port aktif
                    usleep(15000);
                }
            }

            // Fallback jika tidak ada data port yang didapat
            if (empty($allOnus)) {
                $allOnus = $driver->getOnuList();
            }

            $uncfg = $driver->getUnconfiguredOnus();

            // Final Snapshot Update
            $finalSnapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $ponPorts, $allOnus, $uncfg);
            $device->update([
                'last_telemetry_snapshot' => $finalSnapshot,
                'last_connected_at'       => now(),
            ]);

            // Clear web API fast cache
            $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
            Cache::forget($cacheKey);

            $devDurationMs = round((microtime(true) - $devStart) * 1000, 1);
            $this->info("Successfully updated database telemetry snapshot for {$device->name} in {$devDurationMs} ms.");
            return 0;
        } catch (\Exception $e) {
            self::appendWorkerLog(
                $device->name,
                'FATAL',
                'ERROR',
                "Gagal terhubung ke OLT: " . $e->getMessage(),
                ['error' => $e->getMessage()]
            );
            $this->error("Failed to poll OLT {$device->name}: " . $e->getMessage());
            Log::warning("OLT Telemetry Polling failed for {$device->name}: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * Catat log aktivitas worker ke Cache untuk live activity stream di UI
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

        // Pertahankan maksimal 50 log terakhir
        if (count($logs) > 50) {
            $logs = array_slice($logs, 0, 50);
        }

        Cache::put('backend_worker_logs', $logs, 86400);
    }
}
