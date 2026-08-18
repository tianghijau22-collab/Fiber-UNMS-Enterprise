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
}
