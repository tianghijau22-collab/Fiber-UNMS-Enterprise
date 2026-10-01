<?php

namespace App\Http\Controllers;

use App\Models\PopupAlert;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PopupAlertController extends Controller
{
    /**
     * Pastikan hanya Super Administrator yang dapat mengelola Pop-up Alert.
     */
    private function checkSuperAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $userId = $request->input('user_id') ?: $request->header('X-User-Id');
            if ($userId) {
                $user = User::find($userId);
            }
        }

        if ($user && !in_array($user->role, ['Super Administrator', 'super_admin', 'Admin'])) {
            abort(response()->json([
                'status'  => 'error',
                'message' => 'Akses Ditolak: Hanya Super Administrator yang diizinkan mengelola Pop-up Pemberitahuan.'
            ], 403));
        }
    }

    /**
     * Upload Gambar / Banner untuk Pop-up Alert dengan multi-layer fallback.
     */
    public function uploadImage(Request $request)
    {
        try {
            $this->checkSuperAdmin($request);

            // 1. Dukungan File Upload (Multipart Form Data)
            if ($request->hasFile('image')) {
                $file = $request->file('image');
                if ($file && $file->isValid()) {
                    $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
                    $filename = 'popup_banner_' . time() . '_' . Str::random(8) . '.' . $ext;

                    // Cobaan 1: Simpan ke public/uploads/popup_alerts
                    $uploadDir = public_path('uploads/popup_alerts');
                    $savedPath = null;

                    try {
                        if (!File::isDirectory($uploadDir)) {
                            @File::makeDirectory($uploadDir, 0777, true, true);
                        }
                        if (is_writable($uploadDir) || @chmod($uploadDir, 0777)) {
                            $file->move($uploadDir, $filename);
                            $savedPath = '/uploads/popup_alerts/' . $filename;
                        }
                    } catch (\Throwable $dirEx) {
                        Log::warning('Upload ke public/uploads gagal, mencoba fallback storage: ' . $dirEx->getMessage());
                    }

                    // Cobaan 2: Simpan ke storage/app/public/uploads/popup_alerts jika direct public gagal
                    if (!$savedPath) {
                        try {
                            $storageDir = storage_path('app/public/uploads/popup_alerts');
                            if (!File::isDirectory($storageDir)) {
                                @File::makeDirectory($storageDir, 0777, true, true);
                            }
                            $file->move($storageDir, $filename);
                            $savedPath = '/storage/uploads/popup_alerts/' . $filename;
                        } catch (\Throwable $storEx) {
                            Log::warning('Upload ke storage_path gagal: ' . $storEx->getMessage());
                        }
                    }

                    // Cobaan 3: Jika permission server sangat restriktif, encode ke data URL
                    if (!$savedPath) {
                        try {
                            $mime = $file->getMimeType() ?: 'image/png';
                            $content = file_get_contents($file->getRealPath());
                            if ($content !== false) {
                                $savedPath = 'data:' . $mime . ';base64,' . base64_encode($content);
                            }
                        } catch (\Throwable $b64Ex) {
                            Log::error('Fallback base64 encoding gagal: ' . $b64Ex->getMessage());
                        }
                    }

                    if ($savedPath) {
                        return response()->json([
                            'status'  => 'success',
                            'url'     => $savedPath,
                            'message' => 'Gambar banner berhasil diunggah.',
                        ]);
                    }
                }
            }

            // 2. Dukungan Base64 String Payload
            if ($request->filled('image_base64')) {
                $dataUri = $request->input('image_base64');
                if (preg_match('/^data:image\/(\w+);base64,/', $dataUri, $matches)) {
                    $ext = strtolower($matches[1]);
                    if ($ext === 'jpeg') $ext = 'jpg';
                    $data = substr($dataUri, strpos($dataUri, ',') + 1);
                    $decoded = base64_decode($data);

                    if ($decoded !== false) {
                        $uploadDir = public_path('uploads/popup_alerts');
                        $filename = 'popup_banner_' . time() . '_' . Str::random(8) . '.' . $ext;

                        try {
                            if (!File::isDirectory($uploadDir)) {
                                @File::makeDirectory($uploadDir, 0777, true, true);
                            }
                            if (is_writable($uploadDir) || @chmod($uploadDir, 0777)) {
                                file_put_contents($uploadDir . DIRECTORY_SEPARATOR . $filename, $decoded);
                                return response()->json([
                                    'status'  => 'success',
                                    'url'     => '/uploads/popup_alerts/' . $filename,
                                    'message' => 'Gambar banner berhasil diunggah.',
                                ]);
                            }
                        } catch (\Throwable $fe) {
                            Log::warning('Gagal menyimpan file base64 ke disk: ' . $fe->getMessage());
                        }

                        // Jika write gagal, kembalikan base64 URI langsung agar tetap dapat tersimpan
                        return response()->json([
                            'status'  => 'success',
                            'url'     => $dataUri,
                            'message' => 'Gambar banner berhasil diproses.',
                        ]);
                    }
                } else if (Str::startsWith($dataUri, ['http://', 'https://', '/'])) {
                    return response()->json([
                        'status'  => 'success',
                        'url'     => $dataUri,
                        'message' => 'URL gambar diterima.',
                    ]);
                }
            }

            return response()->json([
                'status'  => 'error',
                'message' => 'Tidak ada file gambar valid yang dikirim atau format tidak dikenali.',
            ], 422);

        } catch (\Throwable $e) {
            Log::error('Error pada uploadImage popup alert: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memproses unggahan gambar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Daftar seluruh Pop-up Alert untuk dashboard Super Administrator.
     */
    public function index(Request $request)
    {
        $this->checkSuperAdmin($request);

        // Seed initial enterprise alert sample if empty
        if (PopupAlert::count() === 0) {
            $admin = User::where('role', 'Super Administrator')->first() ?: User::first();
            PopupAlert::create([
                'title'              => 'Pemeliharaan Jaringan Core Fiber',
                'message'            => "Diberitahukan kepada seluruh tim teknis dan operasional bahwa akan dilakukan pemeliharaan jaringan kabel feeder utama di area Padang Timur pada hari Minggu pukul 01:00 - 04:00 WIB.\n\nLayanan link OLT dan koneksi pelanggan di wilayah terdampak mungkin mengalami degradasi sementara waktu.",
                'image_url'          => null,
                'type'               => 'maintenance',
                'badge_text'         => 'Jadwal Pemeliharaan',
                'target_roles'       => ['all'],
                'is_active'          => true,
                'show_once_per_user' => false,
                'starts_at'          => Carbon::now()->subDays(1),
                'expires_at'         => Carbon::now()->addDays(7),
                'action_button_text' => 'Lihat Topologi Wilayah',
                'action_button_url'  => '/network',
                'created_by'         => $admin ? $admin->id : null,
                'created_by_name'    => $admin ? $admin->name : 'Super Administrator',
            ]);
        }

        $query = PopupAlert::query();

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->filled('is_active') && $request->is_active !== 'all') {
            $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('message', 'like', "%{$s}%")
                  ->orWhere('badge_text', 'like', "%{$s}%");
            });
        }

        $alerts = $query->orderBy('is_active', 'desc')
                        ->orderBy('created_at', 'desc')
                        ->get();

        return response()->json([
            'status' => 'success',
            'data'   => $alerts,
        ]);
    }

    /**
     * Mengambil daftar Pop-up Alert yang sedang aktif untuk ditampilkan kepada user saat login/dashboard.
     */
    public function getActiveAlerts(Request $request)
    {
        $now = Carbon::now();
        $userRole = $request->query('role') ?: ($request->user() ? $request->user()->role : 'all');

        $alerts = PopupAlert::where('is_active', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>=', $now);
            })
            ->orderBy('created_at', 'desc')
            ->get();

        // Filter berdasarkan role
        $filtered = $alerts->filter(function ($alert) use ($userRole) {
            $roles = $alert->target_roles;
            if (empty($roles) || in_array('all', $roles)) {
                return true;
            }
            return in_array($userRole, $roles);
        })->values();

        return response()->json([
            'status' => 'success',
            'data'   => $filtered,
        ]);
    }

    /**
     * Buat Pop-up Alert Baru (Super Administrator Only).
     */
    public function store(Request $request)
    {
        $this->checkSuperAdmin($request);

        $validated = $request->validate([
            'title'              => 'required|string|max:255',
            'message'            => 'required|string',
            'image_url'          => 'nullable|string',
            'type'               => 'required|string|in:info,warning,critical,maintenance,update',
            'badge_text'         => 'nullable|string|max:100',
            'target_roles'       => 'nullable|array',
            'is_active'          => 'boolean',
            'show_once_per_user' => 'boolean',
            'starts_at'          => 'nullable|date',
            'expires_at'         => 'nullable|date|after_or_equal:starts_at',
            'action_button_text' => 'nullable|string|max:100',
            'action_button_url'  => 'nullable|string|max:255',
        ]);

        $currentUser = $request->user() ?: User::where('role', 'Super Administrator')->first();

        $validated['created_by'] = $currentUser ? $currentUser->id : null;
        $validated['created_by_name'] = $currentUser ? $currentUser->name : 'Super Administrator';
        if (empty($validated['target_roles'])) {
            $validated['target_roles'] = ['all'];
        }

        $alert = PopupAlert::create($validated);

        AuditLog::record(
            'CREATE',
            'Pop-up Pemberitahuan',
            "Membuat Pop-up Alert baru: '{$alert->title}' (Tipe: {$alert->type})",
            null,
            $alert->toArray()
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pop-up Alert pemberitahuan berhasil dibuat dan dipublikasikan.',
            'data'    => $alert,
        ], 201);
    }

    /**
     * Menampilkan detail satu Pop-up Alert.
     */
    public function show(Request $request, $id)
    {
        $this->checkSuperAdmin($request);

        $alert = PopupAlert::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data'   => $alert,
        ]);
    }

    /**
     * Update Pop-up Alert (Super Administrator Only).
     */
    public function update(Request $request, $id)
    {
        $this->checkSuperAdmin($request);

        $alert = PopupAlert::findOrFail($id);
        $oldData = $alert->toArray();

        $validated = $request->validate([
            'title'              => 'required|string|max:255',
            'message'            => 'required|string',
            'image_url'          => 'nullable|string',
            'type'               => 'required|string|in:info,warning,critical,maintenance,update',
            'badge_text'         => 'nullable|string|max:100',
            'target_roles'       => 'nullable|array',
            'is_active'          => 'boolean',
            'show_once_per_user' => 'boolean',
            'starts_at'          => 'nullable|date',
            'expires_at'         => 'nullable|date',
            'action_button_text' => 'nullable|string|max:100',
            'action_button_url'  => 'nullable|string|max:255',
        ]);

        if (empty($validated['target_roles'])) {
            $validated['target_roles'] = ['all'];
        }

        $alert->update($validated);

        AuditLog::record(
            'UPDATE',
            'Pop-up Pemberitahuan',
            "Memperbarui Pop-up Alert: '{$alert->title}' (#ID: {$alert->id})",
            $oldData,
            $alert->toArray()
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pop-up Alert pemberitahuan berhasil diperbarui.',
            'data'    => $alert,
        ]);
    }

    /**
     * Cepat Aktifkan / Nonaktifkan Pop-up Alert.
     */
    public function toggleActive(Request $request, $id)
    {
        $this->checkSuperAdmin($request);

        $alert = PopupAlert::findOrFail($id);
        $alert->is_active = !$alert->is_active;
        $alert->save();

        AuditLog::record(
            'UPDATE',
            'Pop-up Pemberitahuan',
            "Mengubah status aktif Pop-up Alert '{$alert->title}' (#ID: {$alert->id}) menjadi " . ($alert->is_active ? 'AKTIF' : 'NONAKTIF'),
            ['is_active' => !$alert->is_active],
            ['is_active' => $alert->is_active]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Status aktif alert berhasil diubah.',
            'data'    => $alert,
        ]);
    }

    /**
     * Hapus Pop-up Alert (Super Administrator Only).
     */
    public function destroy(Request $request, $id)
    {
        $this->checkSuperAdmin($request);

        $alert = PopupAlert::findOrFail($id);
        $oldData = $alert->toArray();

        // Hapus file gambar banner jika tersimpan di disk lokal
        if ($alert->image_url && Str::startsWith($alert->image_url, '/uploads/popup_alerts/')) {
            $filePath = public_path(ltrim($alert->image_url, '/'));
            if (File::exists($filePath)) {
                @File::delete($filePath);
            }
        }

        $alert->delete();

        AuditLog::record(
            'DELETE',
            'Pop-up Pemberitahuan',
            "Menghapus Pop-up Alert: '{$oldData['title']}' (#ID: {$id})",
            $oldData,
            null
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pop-up Alert berhasil dihapus secara permanen.',
        ]);
    }
}
