<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    private function checkSuperAdmin()
    {
        $user = auth()->user();
        if (!$user || $user->role !== 'Super Administrator') {
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

        DB::transaction(function () use ($user, $validated) {
            $user->update($validated);
            if (isset($validated['password']) || (isset($validated['status']) && $validated['status'] !== 'Active')) {
                $user->tokens()->delete();
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
        });
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
        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete();
        });

        AuditLog::record(
            'DELETE',
            'Management Pengguna',
            "Menghapus akun pengguna {$deletedUser['name']} ({$deletedUser['email']})",
            $deletedUser,
            null
        );

        return response()->json(['message' => 'Akun pengguna berhasil dihapus!']);
    }

    public static function getDefaultRoutePermissions(): array
    {
        return [
            '/dashboard' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service', 'Finance & Billing'],
            '/server-monitoring' => ['Super Administrator', 'Operator Jaringan'],
            '/system-alerts' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service', 'Finance & Billing'],
            '/olt-management' => ['Super Administrator', 'Operator Jaringan'],
            '/network-bridge-setup' => ['Super Administrator'],
            '/otdr-tracing' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/cable-management' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/cable-routes' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/field-tech' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/odp-checks' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/bts-management' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/network' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/gis-map' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/gis-map/fullscreen' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/core-matrix' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer'],
            '/customers' => ['Super Administrator', 'Operator Jaringan', 'Customer Service', 'Finance & Billing'],
            '/tickets' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Customer Service'],
            '/inventory' => ['Super Administrator', 'Operator Jaringan', 'Teknisi Jointer', 'Finance & Billing'],
            '/users' => ['Super Administrator'],
            '/audit-logs' => ['Super Administrator', 'Operator Jaringan'],
            '/database-backup' => ['Super Administrator'],
            '/broadcast-notifications' => ['Super Administrator', 'Operator Jaringan'],
            '/mobile-app-testing' => ['Super Administrator'],
            '/popup-alerts' => ['Super Administrator'],
        ];
    }

    public function getRoutePermissions()
    {
        return response()->json(app(\App\Services\SidebarPreferences::class)->snapshot());
    }

    public function saveRoutePermissions(Request $request)
    {
        $this->checkSuperAdmin();
        $validated=$request->validate([
            'permissions'=>'required|array','permissions.*'=>'array','permissions.*.*'=>'string',
            'sidebar'=>'sometimes|array:order,super_admin_hidden','sidebar.order'=>'required_with:sidebar|array','sidebar.order.*'=>'string',
            'sidebar.super_admin_hidden'=>'present_with:sidebar|array','sidebar.super_admin_hidden.*'=>'string',
            'expected_version'=>'required_with:sidebar|nullable|string|size:64',
        ]);
        $settings=app(\App\Services\SidebarPreferences::class);
        $sidebar=isset($validated['sidebar'])?$settings->validate($validated['sidebar']):null;
        $permissions=$validated['permissions'];
        foreach ($permissions as &$roles) if (!in_array('Super Administrator',$roles,true)) array_unshift($roles,'Super Administrator');
        unset($roles);
        $result=DB::transaction(function()use($settings,$validated,$permissions,$sidebar){
            $settings->lock();$before=$settings->snapshot();
            if (isset($validated['expected_version'])) abort_unless(hash_equals($before['settings_version'],$validated['expected_version']),409,'Pengaturan telah diubah oleh administrator lain. Muat ulang sebelum menyimpan; draf Anda tetap tersedia.');
            // A sidebar-only change leaves the stored RBAC permissions untouched.
            if ($permissions!==$before['data']) \App\Models\SystemSetting::set('rbac_route_permissions',json_encode($permissions,JSON_THROW_ON_ERROR));
            if ($sidebar!==null && $sidebar!==$before['sidebar']) \App\Models\SystemSetting::set(\App\Services\SidebarPreferences::KEY,json_encode($sidebar,JSON_THROW_ON_ERROR));
            $after=$settings->snapshot();$this->navigationAudit($before,$after,'Memperbarui hak akses halaman dan tampilan sidebar.');return $after;
        },3);
        return response()->json($result+['message'=>'Pengaturan berhasil disimpan. Akses penuh Super Administrator tetap tersedia.']);
    }

    public function resetRoutePermissions(Request $request)
    {
        $this->checkSuperAdmin();
        $v=$request->validate(['expected_version'=>'sometimes|string|size:64']);
        $settings=app(\App\Services\SidebarPreferences::class);
        $result=DB::transaction(function()use($settings,$v){
            $settings->lock();$before=$settings->snapshot();
            if (isset($v['expected_version'])) abort_unless(hash_equals($before['settings_version'],$v['expected_version']),409,'Pengaturan telah berubah. Muat ulang sebelum melakukan reset.');
            \App\Models\SystemSetting::set('rbac_route_permissions',json_encode(self::getDefaultRoutePermissions(),JSON_THROW_ON_ERROR));
            $after=$settings->snapshot();$this->navigationAudit($before,$after,'Mereset hak akses halaman; urutan dan tampilan sidebar dipertahankan.');return $after;
        },3);
        return response()->json($result+['message'=>'Hak akses halaman kembali ke bawaan. Pengaturan sidebar tetap dipertahankan.']);
    }

    private function navigationAudit(array $before,array $after,string $description): void
    {
        $user=auth()->user();
        AuditLog::create(['user_id'=>$user->id,'user_name'=>$user->name,'user_role'=>$user->role,'action'=>'UPDATE','module'=>'RBAC Permissions',
            'description'=>$description,'ip_address'=>request()->ip(),'user_agent'=>request()->userAgent(),
            'old_values'=>['permissions'=>$before['data'],'sidebar'=>$before['sidebar']],
            'new_values'=>['permissions'=>$after['data'],'sidebar'=>$after['sidebar']]]);
    }
}
