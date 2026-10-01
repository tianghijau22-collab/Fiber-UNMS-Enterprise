<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Models\SystemSetting;
use App\Models\AuditLog;

class PruneAuditLogs extends Command
{
    protected $signature = 'audit-logs:prune 
                            {--days= : Retention days for automated telemetry/alarm logs (default: from settings or 14)} 
                            {--user-days= : Retention days for human user activity logs (default: from settings or 90)}
                            {--vacuum : Run PostgreSQL vacuum after prune}';

    protected $description = 'Prune old telemetry alarms, system notifications, and audit logs to keep database lean and fast';

    public function handle()
    {
        $this->info("══════════════════════════════════════════════════════════════════");
        $this->info("🧹 FIBER UNMS AUDIT LOGS & NOTIFICATIONS AUTO-PRUNING ENGINE");
        $this->info("══════════════════════════════════════════════════════════════════");

        $telemetryDays = (int)($this->option('days') ?: SystemSetting::get('audit_log_telemetry_retention_days', 14));
        $userDays      = (int)($this->option('user-days') ?: SystemSetting::get('audit_log_user_retention_days', 90));
        $runVacuum     = (bool)$this->option('vacuum');

        if ($telemetryDays < 1) $telemetryDays = 14;
        if ($userDays < 7) $userDays = 90;

        $telemetryCutoff = now()->subDays($telemetryDays);
        $userCutoff      = now()->subDays($userDays);

        $this->info("📅 Kebijakan Retensi:");
        $this->info("   • Log Telemetri / Alarm Otomatis : Simpan {$telemetryDays} hari (sebelum {$telemetryCutoff->format('Y-m-d H:i')})");
        $this->info("   • Log Aktivitas Pengguna (User)  : Simpan {$userDays} hari (sebelum {$userCutoff->format('Y-m-d H:i')})");

        // 1. DAFTAR AKSI TELEMETRI / ENGINE OTOMATIS (Volume tinggi)
        $telemetryActions = [
            'RECOVERY',
            'DYING_GASP',
            'ALARM_SUDDEN_LOS',
            'ALARM_RECOVERY',
            'MASS_OUTAGE',
            'ALARM_FLAPPING',
            'LOS',
            'SUDDEN_LOS',
            'TELEMETRY_SYNC',
            'PROVISIONING',
            'POLL_TELEMETRY',
            'PORT_DOWN',
            'PORT_UP',
            'ODP_DOWN',
            'ODP_RECOVERY',
        ];

        $tStart = microtime(true);

        // 2. PRUNE LOG TELEMETRI OTOMATIS
        $deletedTelemetry = DB::table('audit_logs')
            ->where(function ($q) use ($telemetryActions) {
                $q->whereIn('action', $telemetryActions)
                  ->orWhere('user_role', 'System')
                  ->orWhere('user_name', 'System Engine')
                  ->orWhere('user_name', 'System Telemetry Engine')
                  ->orWhere('module', 'Monitoring OLT')
                  ->orWhere('module', 'OLT & Telemetry Engine')
                  ->orWhere('module', 'Fault Localization Engine');
            })
            ->where('created_at', '<', $telemetryCutoff)
            ->delete();

        $this->info("✅ Berhasil memangkas {$deletedTelemetry} baris log telemetri/alarm lama.");

        // 3. PRUNE LOG AKTIVITAS PENGGUNA LAMA (Retensi lebih panjang)
        $deletedUserLogs = DB::table('audit_logs')
            ->where('created_at', '<', $userCutoff)
            ->delete();

        $this->info("✅ Berhasil memangkas {$deletedUserLogs} baris log user lawas (> {$userDays} hari).");

        // 4. PRUNE SYSTEM NOTIFICATIONS LAMA (Notifikasi yang sudah lewat retensi)
        $notifCutoff = now()->subDays($telemetryDays);
        $deletedNotifs = DB::table('system_notifications')
            ->where('created_at', '<', $notifCutoff)
            ->delete();

        $this->info("✅ Berhasil memangkas {$deletedNotifs} baris notifikasi sistem lama (> {$telemetryDays} hari).");

        $totalPruned = $deletedTelemetry + $deletedUserLogs;
        $durationMs = round((microtime(true) - $tStart) * 1000, 1);

        // 5. OPSI VACUUM POSTGRESQL (Untuk mengembalikan disk space secara instan)
        if ($runVacuum || $totalPruned > 50000) {
            $this->info("🔄 Menjalankan VACUUM ANALYZE pada PostgreSQL untuk mengklaim kembali ruang disk...");
            try {
                DB::statement('VACUUM ANALYZE audit_logs;');
                DB::statement('VACUUM ANALYZE system_notifications;');
                $this->info("✨ VACUUM ANALYZE selesai.");
            } catch (\Throwable $e) {
                $this->warn("⚠️  VACUUM warning: " . $e->getMessage());
            }
        }

        // Catat metrik pembersihan ke Cache untuk Dashboard & Monitoring
        Cache::put('last_audit_logs_auto_prune_ts', time(), 86400 * 30);
        Cache::put('last_audit_logs_pruned_count', $totalPruned, 86400 * 30);
        Cache::put('last_audit_logs_pruned_at', now()->toIso8601String(), 86400 * 30);

        // Buat 1 log ringkasan aktivitas pembersihan
        if ($totalPruned > 0) {
            AuditLog::record(
                'CLEANUP',
                'System Maintenance',
                "Pembersihan otomatis database log: {$totalPruned} log lama dan {$deletedNotifs} notifikasi berhasil dipangkas ({$durationMs} ms).",
                null,
                [
                    'telemetry_pruned' => $deletedTelemetry,
                    'user_pruned'      => $deletedUserLogs,
                    'notifs_pruned'    => $deletedNotifs,
                    'duration_ms'      => $durationMs,
                ]
            );
        }

        $remainingLogs   = DB::table('audit_logs')->count();
        $remainingNotifs = DB::table('system_notifications')->count();

        $this->info("📊 Status Database Terkini:");
        $this->info("   • Sisa Total Audit Logs   : " . number_format($remainingLogs) . " baris");
        $this->info("   • Sisa Total Notifikasi   : " . number_format($remainingNotifs) . " baris");
        $this->info("   • Waktu Eksekusi          : {$durationMs} ms");
        $this->info("✨ Pembersihan selesai dengan sukses!");

        return 0;
    }
}
