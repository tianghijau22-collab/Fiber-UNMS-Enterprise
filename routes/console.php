<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── Polling Otomatis Telemetri OLT (Dikelola 24/7 oleh systemd daemon: fiber-telemetry-daemon) ────────
// Schedule::command('olt:poll-telemetry')->everyThirtySeconds()->withoutOverlapping()->name('olt:background-poll-telemetry');

// Evaluate the same stored evidence as GIS; OLT I/O remains owned by the telemetry daemon.
Schedule::command('fona:diagnose-optical')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->name('fona:stored-optical-diagnostics');

Schedule::command('fona:dispatch-optical-outbox')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->name('fona:optical-outbox-recovery');

// ─── Schedule Sync Status Layanan Sobok (Setiap 5 Menit) ────────────
Schedule::command('sobok:sync-status')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->name('sobok:sync-service-status');


