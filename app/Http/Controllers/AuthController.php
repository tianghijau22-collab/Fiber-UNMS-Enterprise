<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $input = trim($validated['username']);

        // Find user by username OR email OR phone number
        $user = User::where('username', $input)
                    ->orWhere('email', $input)
                    ->orWhere('phone', $input)
                    ->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            // Log failed login attempt
            AuditLog::record(
                'LOGIN_FAILED',
                'Authentication',
                "Percobaan login gagal untuk username '{$validated['username']}' (Password salah atau user tidak ditemukan).",
                null,
                ['attempt_username' => $validated['username'], 'status' => 'FAILED']
            );

            return response()->json([
                'message' => 'Username atau password yang Anda masukkan salah.'
            ], 401);
        }

        if ($user->status !== 'Active') {
            // Log suspended user login attempt
            AuditLog::record(
                'LOGIN_BLOCKED',
                'Authentication',
                "Login ditolak karena akun {$user->name} berstatus '{$user->status}'.",
                null,
                ['user_id' => $user->id, 'account_status' => $user->status]
            );

            return response()->json([
                'message' => "Akun Anda saat ini berstatus '{$user->status}'. Silakan hubungi Super Administrator."
            ], 403);
        }

        // Update last login timestamp
        $user->update(['last_login_at' => Carbon::now()]);

        // Record successful login in Audit Logs & notify Telegram
        AuditLog::record(
            'LOGIN',
            'Authentication',
            "Pengguna {$user->name} ({$user->role}) berhasil login ke sistem Fiber-UNMS Enterprise.",
            null,
            [
                'user_id'  => $user->id,
                'username' => $user->username,
                'role'     => $user->role,
                'division' => $user->division,
            ]
        );

        return response()->json([
            'message' => 'Login berhasil! Selamat datang kembali, ' . $user->name . '.',
            'user'    => $user,
            'token'   => 'session_' . md5($user->id . time()),
        ]);
    }

    public function logout(Request $request)
    {
        $userId = $request->input('user_id');
        $user = $userId ? User::find($userId) : null;

        AuditLog::record(
            'LOGOUT',
            'Authentication',
            $user ? "Pengguna {$user->name} ({$user->role}) telah logout dari sistem." : "Sesi pengguna telah diakhiri (Logout).",
            null,
            $user ? ['user_id' => $user->id, 'username' => $user->username] : []
        );

        return response()->json(['message' => 'Berhasil logout dari sistem.']);
    }

    public function me(Request $request)
    {
        $userId = $request->input('user_id');
        if (!$userId) {
            return response()->json(['user' => null]);
        }

        $user = User::find($userId);
        return response()->json(['user' => $user]);
    }

    public function updateProfile(Request $request)
    {
        $userId = $request->input('user_id');
        $user = $userId ? User::find($userId) : auth()->user();

        if (!$user) {
            return response()->json(['message' => 'Pengguna tidak ditemukan.'], 404);
        }

        $oldData = $user->only(['name', 'email', 'phone', 'username']);

        $validated = $request->validate([
            'name'         => 'sometimes|required|string|max:255',
            'email'        => "sometimes|required|email|unique:users,email,{$user->id}",
            'username'     => "sometimes|required|string|max:255|unique:users,username,{$user->id}",
            'phone'        => 'nullable|string|max:30',
            'password'     => 'nullable|string|min:6',
            'old_password' => 'nullable|string',
        ]);

        if (!empty($validated['password'])) {
            if (!empty($validated['old_password']) && !Hash::check($validated['old_password'], $user->password)) {
                return response()->json(['message' => 'Password lama yang Anda masukkan salah.'], 422);
            }
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }
        unset($validated['old_password']);

        $user->update($validated);
        $newData = $user->only(['name', 'email', 'phone', 'username']);

        AuditLog::create([
            'user_id'     => $user->id,
            'user_name'   => $user->name,
            'user_role'   => $user->role,
            'action'      => 'UPDATE',
            'module'      => 'Pengaturan Profil',
            'description' => "Pengguna {$user->name} memperbarui data profil pribadinya.",
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'old_values'  => $oldData,
            'new_values'  => $newData,
        ]);

        return response()->json([
            'message' => 'Profil berhasil diperbarui!',
            'user'    => $user->fresh(),
        ]);
    }
}
