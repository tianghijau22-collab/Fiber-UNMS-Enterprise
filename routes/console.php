<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\OltDevice;
use App\Services\Olt\ConnectionManager;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── Polling Otomatis Telemetri OLT & Snapshot Database (Setiap 1 Menit) ────────
Schedule::command('olt:poll-telemetry')->everyThirtySeconds()->withoutOverlapping()->name('olt:background-poll-telemetry');

// ─── Schedule Sync Health & Auto-Recovery OLT (Setiap 5 Menit) ────────────
Schedule::call(function () {
    $devices = OltDevice::where('connection_mode', 'live')->get();
    foreach ($devices as $device) {
        try {
            $result = ConnectionManager::testDevice($device);
            $isReachable = ($result['snmp']['reachable'] ?? false) || ($result['ping']['reachable'] ?? false);

            $device->update([
                'last_connected_at' => now(),
                'last_ping_ms'      => $result['ping']['latency_ms'] ?? null,
            ]);

            // Deteksi Otomatis OLT Down
            if (!$isReachable && $device->status === 'active') {
                $device->update(['status' => 'offline']);
                \App\Models\AppNotification::notifyAll(
                    "ALARM: Perangkat OLT {$device->name} Tidak Terjangkau (Down)",
                    "Perangkat OLT {$device->name} ({$device->code} - IP: {$device->ip_address}) tidak merespons SNMP/Ping. Harap tim NOC memeriksa catuan daya atau link transmisi.",
                    'NOC',
                    '/olt-management'
                );
            } 
            // Deteksi Otomatis OLT Pulih (Recovery)
            elseif ($isReachable && $device->status === 'offline') {
                $device->update(['status' => 'active']);
                \App\Models\AppNotification::notifyAll(
                    "RECOVERY: Perangkat OLT {$device->name} Kembali Normal (Online)",
                    "Koneksi telemetri ke OLT {$device->name} ({$device->code}) telah pulih normal dengan latensi ping " . ($result['ping']['latency_ms'] ?? 0) . " ms.",
                    'NOC',
                    '/olt-management'
                );
            }
        } catch (\Exception $e) {
            // Log silently without breaking execution
        }
    }

    // Jalankan Diagnosa Otomatis Gangguan Massal & Lokalisasi Batas Redaman Putus Jalur
    try {
        \App\Services\OpticalFaultLocalizationService::runDiagnostic();
    } catch (\Exception $e) {
        // Log silently
    }
})->everyFiveMinutes()->name('olt:sync-telemetry');

