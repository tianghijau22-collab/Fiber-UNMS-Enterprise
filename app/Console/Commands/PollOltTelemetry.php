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
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll} {--force : Force polling regardless of interval} {--sync : Run synchronously instead of parallel}';
    protected $description = 'Polls live telemetry from active OLTs concurrently in parallel without queuing';

    public function handle(OltController $oltCtrl)
    {
        $deviceId = $this->option('device');

        // JIKA SPECIFIC DEVICE ID: Jalankan polling terisolasi untuk 1 OLT ini saja
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

        $processes = [];
        $phpBinary = PHP_BINARY ?: 'php';
        $artisanPath = base_path('artisan');

        // 1. Spawn sub-process untuk setiap OLT pada DETIK YANG SAMA
        foreach ($devices as $device) {
            $cmd = [$phpBinary, $artisanPath, 'olt:poll-telemetry', "--device={$device->id}", '--force'];
            $process = new Process($cmd);
            $process->setTimeout(25); // Max 25s isolation timeout agar tidak pernah hang
            $process->start();

            $processes[$device->id] = [
                'process' => $process,
                'device'  => $device,
                'start'   => microtime(true),
            ];

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

                    // Ambil snapshot data yang baru saja diperbarui oleh sub-process
                    $freshDev = OltDevice::find($id);
                    $snapshot = $freshDev?->last_telemetry_snapshot ?? [];
                    $ponPorts = $snapshot['pon_ports'] ?? [];
                    $allOnus  = $snapshot['onu_list'] ?? [];
                    $uncfg    = $snapshot['unconfigured_onus'] ?? [];

                    $activePorts = count(array_filter($ponPorts, fn($p) => ($p['status'] ?? '') === 'Up' || ($p['registered_onus'] ?? 0) > 0));
                    $onusCount   = count($allOnus);
                    $uncfgCount  = count($uncfg);

                    $isSuccess = $proc->isSuccessful() && empty($errorOutput);
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

                    $this->info("  ✅ [Worker #{$dev->id}] {$dev->name} selesai dalam {$durationMs} ms (Port: {$activePorts}, ONU: {$onusCount}).");

                    unset($processes[$id]);
                }
            }

            usleep(15000); // 15ms non-blocking check interval
        }

        $totalCycleDurationMs = round((microtime(true) - $cycleStart) * 1000, 1);

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
            'total_ports_polled'   => $totalPortsPolled,
            'total_onus_polled'    => $totalOnusPolled > 0 ? $totalOnusPolled : \App\Models\OntRegistration::count(),
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
            'ports'       => $totalPortsPolled,
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
     * Polling Khusus 1 Unit OLT Terisolasi (Sub-Process)
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

        $activePortCount = 0;
        try {
            $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);

            $deviceInfo = $driver->getDeviceInfo();
            $ponPorts   = $driver->getPonPorts();
            
            // Polling bertahap HANYA pada port PON yang memiliki ONU aktif/terdaftar
            $allOnus = [];
            foreach ($ponPorts as $port) {
                $hasOnus = (($port['registered_onus'] ?? 0) > 0 || ($port['unconfigured_onus'] ?? 0) > 0);
                if ($hasOnus) {
                    $activePortCount++;
                    try {
                        $portOnus = $driver->getOnuListByPort($port['port_id']);
                        if (!empty($portOnus)) {
                            $allOnus = array_merge($allOnus, $portOnus);
                        }
                    } catch (\Exception $e) {
                        // Lewati jika terjadi timeout pada salah satu port
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

            $snapshot = $oltCtrl->processAndPartitionTelemetry($device, $deviceInfo, $ponPorts, $allOnus, $uncfg);

            $device->update([
                'last_telemetry_snapshot' => $snapshot,
                'last_connected_at'       => now(),
            ]);

            // Sync live optical data directly to OntRegistration records & detect state transitions for instant alerts
            foreach ($allOnus as $onuData) {
                $sn = $onuData['serial_number'] ?? null;
                if (!$sn) continue;

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

                    // 1. Deteksi Gangguan Baru (Transition from Active -> Inactive / LOS)
                    if ($oldStatus === 'active' && $newStatus === 'inactive') {
                        $downReason = $onuData['last_down_reason'] ?? 'Loss of Signal (Kabel Putus / Dying Gasp)';
                        
                        \App\Models\AuditLog::record(
                            'ALARM_LOS',
                            'Monitoring OLT',
                            "🚨 ALERT: Modem {$custName} ({$sn}) mengalami gangguan LOS/Offline pada Port {$portName}. Indikasi: {$downReason}",
                            null,
                            [
                                'serial_number' => $sn,
                                'customer_name' => $custName,
                                'port'          => $portName,
                                'reason'        => $downReason,
                                'olt_name'      => $device->name,
                            ]
                        );

                        \App\Services\TelegramService::send(
                            "🚨 ALARM GANGGUAN OPTIK (LOS)",
                            "<b>Pelanggan:</b> {$custName}\n" .
                            "<b>Serial Number:</b> <code>{$sn}</code>\n" .
                            "<b>OLT / Port:</b> {$device->name} ({$portName})\n" .
                            "<b>Status:</b> 🔴 OFFLINE / LOS\n" .
                            "<b>Indikasi:</b> {$downReason}",
                            'NOC'
                        );
                    }

                    // 2. Deteksi Pemulihan Gangguan (Transition from Inactive -> Active)
                    if ($oldStatus === 'inactive' && $newStatus === 'active') {
                        \App\Models\AuditLog::record(
                            'ALARM_RECOVERY',
                            'Monitoring OLT',
                            "🟢 RECOVERY: Modem {$custName} ({$sn}) telah pulih/Online kembali pada Port {$portName}. Redaman Rx: {$newRx} dBm",
                            null,
                            [
                                'serial_number' => $sn,
                                'customer_name' => $custName,
                                'port'          => $portName,
                                'rx_power'      => $newRx,
                                'olt_name'      => $device->name,
                            ]
                        );

                        \App\Services\TelegramService::send(
                            "🟢 PEMULIHAN LAYANAN (RECOVERY)",
                            "<b>Pelanggan:</b> {$custName}\n" .
                            "<b>Serial Number:</b> <code>{$sn}</code>\n" .
                            "<b>OLT / Port:</b> {$device->name} ({$portName})\n" .
                            "<b>Status:</b> 🟢 ONLINE (Normal)\n" .
                            "<b>Redaman Rx:</b> <code>{$newRx} dBm</code>",
                            'NOC'
                        );
                    }

                    // 3. Deteksi Lonjakan Redaman Parah (< -27.0 dBm)
                    if ($newStatus === 'active' && $newRx !== null && (float)$newRx < -27.0) {
                        \App\Models\AuditLog::record(
                            'ALARM_HIGH_LOSS',
                            'Monitoring OLT',
                            "⚠️ WARNING: Redaman modem {$custName} ({$sn}) drop ke level kritis: {$newRx} dBm",
                            null,
                            ['serial_number' => $sn, 'rx_power' => $newRx]
                        );
                    }

                    $ontReg->update([
                        'rx_power' => $newRx,
                        'tx_power' => $newTx,
                        'status'   => $newStatus,
                    ]);
                }
            }

            // Clear web API fast cache
            $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
            Cache::forget($cacheKey);

            $devDurationMs = round((microtime(true) - $devStart) * 1000, 1);
            $this->info("Successfully updated database telemetry snapshot for {$device->name} in {$devDurationMs} ms.");
            return 0;
        } catch (\Exception $e) {
            $this->error("Failed to poll OLT {$device->name}: " . $e->getMessage());
            Log::warning("OLT Telemetry Polling failed for {$device->name}: " . $e->getMessage());
            return 1;
        }
    }
}
