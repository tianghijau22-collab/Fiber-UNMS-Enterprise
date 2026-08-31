<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\OltDevice;
use App\Http\Controllers\OltController;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class PollOltTelemetry extends Command
{
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll} {--force : Force polling regardless of interval}';
    protected $description = 'Polls live telemetry from active OLTs via SNMP and stores snapshot in database';

    public function handle(OltController $oltCtrl)
    {
        $cycleStart = microtime(true);
        $deviceId = $this->option('device');
        $query = OltDevice::where('status', 'active');
        if ($deviceId) {
            $query->where('id', (int)$deviceId);
        }

        $devices = $query->get();
        if ($devices->isEmpty()) {
            $this->info('No active OLT devices found for telemetry polling.');
            return 0;
        }

        $totalPortsPolled = 0;
        $totalOnusPolled = 0;
        $totalUncfgPolled = 0;
        $deviceReports = [];

        foreach ($devices as $device) {
            $devStart = microtime(true);
            $interval = $device->polling_interval_seconds ?: 60;
            $force = $this->option('force');

            // Cek apakah sudah saatnya di-poll berdasarkan interval masing-masing perangkat
            if (!$force && $device->last_connected_at) {
                $secondsSinceLast = now()->diffInSeconds($device->last_connected_at);
                if ($secondsSinceLast < ($interval - 5)) {
                    $this->info("Skipping {$device->name}: last polled {$secondsSinceLast}s ago (configured interval: {$interval}s).");
                    continue;
                }
            }

            $this->info("Polling OLT: {$device->name} ({$device->ip_address}:{$device->snmp_port}) Mode: {$device->connection_mode} Interval: {$interval}s (Throttling: 15ms)...");

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

                // Clear web API fast cache so all frontend users get the latest DB snapshot immediately
                $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
                Cache::forget($cacheKey);

                $devDurationMs = round((microtime(true) - $devStart) * 1000, 1);
                $totalPortsPolled += $activePortCount;
                $totalOnusPolled += count($allOnus);
                $totalUncfgPolled += count($uncfg);

                $deviceReports[] = [
                    'device_id'     => $device->id,
                    'device_name'   => $device->name,
                    'ip'            => $device->ip_address,
                    'vendor'        => $device->vendor,
                    'total_ports'   => count($ponPorts),
                    'active_ports'  => $activePortCount,
                    'onus_found'    => count($allOnus),
                    'uncfg_found'   => count($uncfg),
                    'duration_ms'   => $devDurationMs,
                    'status'        => 'SUCCESS',
                    'timestamp'     => now()->format('H:i:s'),
                ];

                $this->info("Successfully updated database telemetry snapshot for {$device->name} in {$devDurationMs} ms.");
            } catch (\Exception $e) {
                $devDurationMs = round((microtime(true) - $devStart) * 1000, 1);
                $deviceReports[] = [
                    'device_id'     => $device->id,
                    'device_name'   => $device->name,
                    'ip'            => $device->ip_address,
                    'vendor'        => $device->vendor,
                    'total_ports'   => 0,
                    'active_ports'  => 0,
                    'onus_found'    => 0,
                    'uncfg_found'   => 0,
                    'duration_ms'   => $devDurationMs,
                    'status'        => 'ERROR: ' . $e->getMessage(),
                    'timestamp'     => now()->format('H:i:s'),
                ];
                $this->error("Failed to poll OLT {$device->name}: " . $e->getMessage());
                Log::warning("OLT Telemetry Polling failed for {$device->name}: " . $e->getMessage());
            }
        }

        $totalCycleDurationMs = round((microtime(true) - $cycleStart) * 1000, 1);

        // Record backend worker telemetry metadata to Cache for live monitoring
        $workerStats = [
            'status'               => 'ACTIVE',
            'last_run_at'          => now()->toIso8601String(),
            'last_run_human'       => now()->format('d M Y, H:i:s'),
            'cycle_duration_ms'    => $totalCycleDurationMs,
            'cycle_duration_human' => ($totalCycleDurationMs < 1000) ? "{$totalCycleDurationMs} ms" : round($totalCycleDurationMs / 1000, 2) . " s",
            'throttling_delay_ms'  => 15,
            'total_devices'        => count($devices),
            'total_ports_polled'   => $totalPortsPolled,
            'total_onus_polled'    => $totalOnusPolled,
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
            'onus'        => $totalOnusPolled,
            'uncfg'       => $totalUncfgPolled,
            'status'      => 'OK',
        ];
        if (count($cycleHistory) > 15) {
            $cycleHistory = array_slice($cycleHistory, -15);
        }
        Cache::put('backend_worker_history', $cycleHistory, 86400);

        return 0;
    }
}
