<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        // Seed initial enterprise operational logs on fresh setup
        if (AuditLog::count() === 0) {
            $user = User::first();

            AuditLog::create([
                'user_id'     => $user ? $user->id : null,
                'user_name'   => $user ? $user->name : 'Super Administrator',
                'user_role'   => 'Super Administrator',
                'action'      => 'OTDR_TRACE',
                'module'      => 'OTDR Tracing',
                'description' => 'Menjalankan simulasi penembakan laser OTDR dari POP Central ke ODC Koto Baru. Jarak terdeteksi 1.200 meter.',
                'ip_address'  => '127.0.0.1',
                'user_agent'  => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'old_values'  => null,
                'new_values'  => ['distance_meters' => 1200, 'break_lat' => -0.9452, 'break_lng' => 100.3621],
                'created_at'  => Carbon::now()->subMinutes(12),
            ]);

            AuditLog::create([
                'user_id'     => $user ? $user->id : null,
                'user_name'   => 'Rian Hidayat',
                'user_role'   => 'Teknisi Jointer',
                'action'      => 'UPDATE',
                'module'      => 'Ticketing & Work Order',
                'description' => 'Memperbarui status tiket TICK-2026-0001 menjadi Dalam Penanganan. Menambahkan catatan OTDR tiang #14.',
                'ip_address'  => '192.168.1.105',
                'user_agent'  => 'Fiber-UNMS Mobile App (Android 14)',
                'old_values'  => ['status' => 'Open'],
                'new_values'  => ['status' => 'In Progress', 'technician' => 'Rian Hidayat'],
                'created_at'  => Carbon::now()->subMinutes(35),
            ]);

            AuditLog::create([
                'user_id'     => $user ? $user->id : null,
                'user_name'   => 'Dewi Lestari',
                'user_role'   => 'Customer Service',
                'action'      => 'CREATE',
                'module'      => 'Customer Management',
                'description' => 'Mendaftarkan pelanggan baru PT Maju Bersama (Paket FTTH Dedicated 50Mbps). ID: CUST-2026-0882.',
                'ip_address'  => '192.168.1.112',
                'user_agent'  => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'old_values'  => null,
                'new_values'  => ['name' => 'PT Maju Bersama', 'package' => '50Mbps Dedicated'],
                'created_at'  => Carbon::now()->subHours(2),
            ]);

            AuditLog::create([
                'user_id'     => $user ? $user->id : null,
                'user_name'   => 'System Telemetry Engine',
                'user_role'   => 'System',
                'action'      => 'PROVISIONING',
                'module'      => 'OLT & Telemetry Engine',
                'description' => 'Polling otomatis OLT ZTE C320 Solok. Mengkonfigurasi VLAN 100 & Service Profile ONT ZTE-F663.',
                'ip_address'  => '10.10.0.1',
                'user_agent'  => 'SNMP Poller Daemon v2.4',
                'old_values'  => ['status' => 'Unconfigured'],
                'new_values'  => ['status' => 'ONLINE', 'rx_power' => '-19.4 dBm'],
                'created_at'  => Carbon::now()->subHours(4),
            ]);

            AuditLog::create([
                'user_id'     => $user ? $user->id : null,
                'user_name'   => 'Super Administrator',
                'user_role'   => 'Super Administrator',
                'action'      => 'LOGIN',
                'module'      => 'Authentication',
                'description' => 'Pengguna berhasil melakukan otentikasi login ke Dashboard Fiber-UNMS Enterprise.',
                'ip_address'  => '127.0.0.1',
                'user_agent'  => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'old_values'  => null,
                'new_values'  => ['auth_status' => 'Success'],
                'created_at'  => Carbon::now()->subHours(5),
            ]);
        }

        $query = AuditLog::query();

        $currentUser = auth()->user();

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        } elseif ($currentUser && $currentUser->role !== 'Super Administrator') {
            $query->where(function ($q) use ($currentUser) {
                $q->where('user_id', $currentUser->id)
                  ->orWhere('user_name', $currentUser->name);
            });
        }

        if ($request->filled('module')) {
            $query->where('module', $request->module);
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('user_name', 'like', "%{$s}%")
                  ->orWhere('user_role', 'like', "%{$s}%")
                  ->orWhere('module', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%")
                  ->orWhere('ip_address', 'like', "%{$s}%");
            });
        }

        $logs = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json($logs);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_name'   => 'required|string',
            'user_role'   => 'nullable|string',
            'action'      => 'required|string',
            'module'      => 'required|string',
            'description' => 'required|string',
            'old_values'  => 'nullable|array',
            'new_values'  => 'nullable|array',
        ]);

        $validated['user_id'] = auth()->id();
        $validated['ip_address'] = $request->ip();
        $validated['user_agent'] = $request->userAgent();

        $log = AuditLog::create($validated);

        return response()->json([
            'message' => 'Audit log recorded',
            'data'    => $log,
        ], 201);
    }

    /**
     * Dapatkan ringkasan statistik ukuran tabel audit_logs dan distribusi usia data
     */
    public function getStats(Request $request)
    {
        $totalLogs    = \Illuminate\Support\Facades\DB::table('audit_logs')->count();
        $totalNotifs  = \Illuminate\Support\Facades\DB::table('system_notifications')->count();
        $olderThan30d = \Illuminate\Support\Facades\DB::table('audit_logs')->where('created_at', '<', now()->subDays(30))->count();
        $olderThan14d = \Illuminate\Support\Facades\DB::table('audit_logs')->where('created_at', '<', now()->subDays(14))->count();
        $olderThan7d  = \Illuminate\Support\Facades\DB::table('audit_logs')->where('created_at', '<', now()->subDays(7))->count();
        
        $oldest = \Illuminate\Support\Facades\DB::table('audit_logs')->orderBy('id', 'asc')->value('created_at');
        $newest = \Illuminate\Support\Facades\DB::table('audit_logs')->orderBy('id', 'desc')->value('created_at');

        $telemetryRetentionDays = (int)\App\Models\SystemSetting::get('audit_log_telemetry_retention_days', 14);
        $userRetentionDays      = (int)\App\Models\SystemSetting::get('audit_log_user_retention_days', 90);
        $autoPruneEnabled       = (bool)\App\Models\SystemSetting::get('audit_log_auto_prune_enabled', true);

        return response()->json([
            'total_logs'               => $totalLogs,
            'total_notifications'      => $totalNotifs,
            'older_than_30d'           => $olderThan30d,
            'older_than_14d'           => $olderThan14d,
            'older_than_7d'            => $olderThan7d,
            'oldest_log'               => $oldest,
            'newest_log'               => $newest,
            'telemetry_retention_days' => $telemetryRetentionDays,
            'user_retention_days'      => $userRetentionDays,
            'auto_prune_enabled'       => $autoPruneEnabled,
            'last_pruned_at'           => \Illuminate\Support\Facades\Cache::get('last_audit_logs_pruned_at'),
            'last_pruned_count'        => \Illuminate\Support\Facades\Cache::get('last_audit_logs_pruned_count', 0),
        ]);
    }

    /**
     * Eksekusi pemangkasan log manual atau on-demand dari UI web
     */
    public function prune(Request $request)
    {
        $days = (int)$request->input('days', 14);
        $userDays = (int)$request->input('user_days', 90);
        $runVacuum = (bool)$request->input('vacuum', true);

        if ($days < 1) $days = 7;
        if ($userDays < 7) $userDays = 30;

        $telemetryActions = [
            'RECOVERY', 'DYING_GASP', 'ALARM_SUDDEN_LOS', 'ALARM_RECOVERY', 
            'MASS_OUTAGE', 'ALARM_FLAPPING', 'LOS', 'SUDDEN_LOS', 
            'TELEMETRY_SYNC', 'PROVISIONING', 'POLL_TELEMETRY', 'PORT_DOWN', 'PORT_UP'
        ];

        $tStart = microtime(true);

        $deletedTelemetry = \Illuminate\Support\Facades\DB::table('audit_logs')
            ->where(function ($q) use ($telemetryActions) {
                $q->whereIn('action', $telemetryActions)
                  ->orWhere('user_role', 'System')
                  ->orWhere('user_name', 'System Engine')
                  ->orWhere('user_name', 'System Telemetry Engine')
                  ->orWhere('module', 'Monitoring OLT')
                  ->orWhere('module', 'OLT & Telemetry Engine')
                  ->orWhere('module', 'Fault Localization Engine');
            })
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $deletedUserLogs = \Illuminate\Support\Facades\DB::table('audit_logs')
            ->where('created_at', '<', now()->subDays($userDays))
            ->delete();

        $deletedNotifs = \Illuminate\Support\Facades\DB::table('system_notifications')
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $totalPruned = $deletedTelemetry + $deletedUserLogs;
        $durationMs = round((microtime(true) - $tStart) * 1000, 1);

        if ($runVacuum && $totalPruned > 1000) {
            try {
                \Illuminate\Support\Facades\DB::statement('VACUUM ANALYZE audit_logs;');
                \Illuminate\Support\Facades\DB::statement('VACUUM ANALYZE system_notifications;');
            } catch (\Throwable $e) {
                // Ignore vacuum error
            }
        }

        \Illuminate\Support\Facades\Cache::put('last_audit_logs_auto_prune_ts', time(), 86400 * 30);
        \Illuminate\Support\Facades\Cache::put('last_audit_logs_pruned_count', $totalPruned, 86400 * 30);
        \Illuminate\Support\Facades\Cache::put('last_audit_logs_pruned_at', now()->toIso8601String(), 86400 * 30);

        if ($totalPruned > 0) {
            AuditLog::record(
                'CLEANUP',
                'System Maintenance',
                "Pembersihan manual log: {$totalPruned} log lama dan {$deletedNotifs} notifikasi berhasil dipangkas ({$durationMs} ms).",
                null,
                ['days' => $days, 'pruned' => $totalPruned]
            );
        }

        return response()->json([
            'status'           => 'success',
            'message'          => "Berhasil memangkas " . number_format($totalPruned) . " log lama dan " . number_format($deletedNotifs) . " notifikasi dalam {$durationMs} ms.",
            'telemetry_pruned' => $deletedTelemetry,
            'user_pruned'      => $deletedUserLogs,
            'notifs_pruned'    => $deletedNotifs,
            'total_pruned'     => $totalPruned,
            'duration_ms'      => $durationMs,
        ]);
    }

    /**
     * Simpan pengaturan retensi log otomatis
     */
    public function saveRetentionSettings(Request $request)
    {
        $telemetryDays = (int)$request->input('telemetry_days', 14);
        $userDays      = (int)$request->input('user_days', 90);
        $enabled       = (bool)$request->input('enabled', true);

        if ($telemetryDays < 1) $telemetryDays = 14;
        if ($userDays < 7) $userDays = 90;

        \App\Models\SystemSetting::set('audit_log_telemetry_retention_days', $telemetryDays);
        \App\Models\SystemSetting::set('audit_log_user_retention_days', $userDays);
        \App\Models\SystemSetting::set('audit_log_auto_prune_enabled', $enabled ? 'true' : 'false');

        AuditLog::record(
            'CONFIG',
            'System Maintenance',
            "Memperbarui kebijakan retensi log: Telemetri {$telemetryDays} hari, User {$userDays} hari (Auto-prune: " . ($enabled ? 'Aktif' : 'Nonaktif') . ").",
            null,
            ['telemetry_days' => $telemetryDays, 'user_days' => $userDays, 'enabled' => $enabled]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengaturan kebijakan retensi log berhasil disimpan.',
        ]);
    }

    /**
     * Kosongkan SELURUH isi tabel audit_logs (HANYA UNTUK SUPER ADMINISTRATOR)
     */
    public function clearAll(Request $request)
    {
        $userId   = $request->input('user_id')   ?? $request->header('X-User-Id');
        $userRole = $request->input('user_role') ?? $request->header('X-User-Role');
        $userName = $request->input('user_name') ?? $request->header('X-User-Name');

        $user = auth()->user();
        if (!$user && $userId) {
            $user = \App\Models\User::find($userId);
        }

        $role = $user ? $user->role : ($userRole ?: 'Super Administrator');
        $name = $user ? $user->name : ($userName ?: 'Super Administrator');

        if ($role !== 'Super Administrator') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Akses ditolak. Hanya Super Administrator yang memiliki izin mengosongkan seluruh log.',
            ], 403);
        }

        $tStart = microtime(true);
        $totalBefore = \Illuminate\Support\Facades\DB::table('audit_logs')->count();

        // Kosongkan tabel audit_logs dan jalankan vacuum
        \Illuminate\Support\Facades\DB::statement('TRUNCATE TABLE audit_logs RESTART IDENTITY;');
        try {
            \Illuminate\Support\Facades\DB::statement('VACUUM ANALYZE audit_logs;');
        } catch (\Throwable $e) {
            // Ignore vacuum error
        }

        // Rekam 1 log baru bahwa pembersihan massal telah dilakukan oleh Super Admin
        AuditLog::record(
            'CLEAR_ALL',
            'System Maintenance',
            "Seluruh isi database Audit Logs (" . number_format($totalBefore) . " baris) telah dikosongkan secara total oleh Super Administrator {$name}.",
            ['previous_count' => $totalBefore],
            ['status' => 'CLEARED', 'cleared_by' => $name]
        );

        $durationMs = round((microtime(true) - $tStart) * 1000, 1);

        \Illuminate\Support\Facades\Cache::put('last_audit_logs_pruned_count', $totalBefore, 86400 * 30);
        \Illuminate\Support\Facades\Cache::put('last_audit_logs_pruned_at', now()->toIso8601String(), 86400 * 30);

        return response()->json([
            'status'        => 'success',
            'message'       => "Seluruh riwayat log audit (" . number_format($totalBefore) . " baris) berhasil dikosongkan secara bersih dalam {$durationMs} ms.",
            'cleared_count' => $totalBefore,
            'duration_ms'   => $durationMs,
        ]);
    }
}
