<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    private function checkSuperAdmin()
    {
        $user = auth()->user();
        if ($user && $user->role !== 'Super Administrator') {
            abort(response()->json(['message' => 'Akses Ditolak: Hanya Super Administrator yang diizinkan mengelola akun pengguna.'], 403));
        }
    }

    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('division', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%");
            });
        }

        $users = $query->orderBy('created_at', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data'   => $users,
        ]);
    }

    public function store(Request $request)
    {
        $this->checkSuperAdmin();

        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'username' => 'nullable|string|max:255|unique:users,username',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role'     => 'required|string',
            'division' => 'required|string',
            'phone'    => 'nullable|string|max:30',
            'status'   => 'required|string|in:Active,Inactive,Suspended',
        ]);

        if (empty($validated['username'])) {
            // Auto-generate username from email prefix if blank
            $validated['username'] = strtolower(explode('@', $validated['email'])[0]);
        }

        $rawPassword = $validated['password'];
        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);

        AuditLog::record(
            'CREATE',
            'Management Pengguna',
            "Membuat akun pengguna baru {$user->name} (Username: {$user->username}, Role: {$user->role})",
            null,
            ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role, 'division' => $user->division, 'status' => $user->status]
        );

        return response()->json([
            'message' => 'Akun pengguna berhasil dibuat!',
            'data'    => $user,
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $this->checkSuperAdmin();

        $oldData = $user->only(['name', 'username', 'email', 'role', 'division', 'phone', 'status']);

        $validated = $request->validate([
            'name'     => 'sometimes|required|string|max:255',
            'username' => "sometimes|required|string|max:255|unique:users,username,{$user->id}",
            'email'    => "sometimes|required|email|unique:users,email,{$user->id}",
            'password' => 'nullable|string|min:6',
            'role'     => 'sometimes|required|string',
            'division' => 'sometimes|required|string',
            'phone'    => 'nullable|string|max:30',
            'status'   => 'sometimes|required|string|in:Active,Inactive,Suspended',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        $newData = $user->only(['name', 'username', 'email', 'role', 'division', 'phone', 'status']);

        AuditLog::record(
            'UPDATE',
            'Management Pengguna',
            "Memperbarui data akun pengguna {$user->name} (#ID: {$user->id})",
            $oldData,
            $newData
        );

        return response()->json([
            'message' => 'Data akun pengguna berhasil diperbarui!',
            'data'    => $user,
        ]);
    }

    public function destroy(User $user)
    {
        $this->checkSuperAdmin();

        if ($user->role === 'Super Administrator' && User::where('role', 'Super Administrator')->count() <= 1) {
            return response()->json([
                'message' => 'Tidak dapat menghapus Super Administrator utama sistem!'
            ], 422);
        }

        $deletedUser = $user->only(['id', 'name', 'email', 'role', 'division']);
        $user->delete();

        AuditLog::record(
            'DELETE',
            'Management Pengguna',
            "Menghapus akun pengguna {$deletedUser['name']} ({$deletedUser['email']})",
            $deletedUser,
            null
        );

        return response()->json(['message' => 'Akun pengguna berhasil dihapus!']);
    }
}
