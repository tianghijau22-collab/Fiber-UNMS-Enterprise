<?php

namespace App\Http\Controllers;

use App\Models\MobileSliderBanner;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MobileSliderBannerController extends Controller
{
    /**
     * Pastikan otentikasi administrator.
     */
    private function checkAdmin(Request $request)
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
                'message' => 'Akses Ditolak: Hanya Administrator yang diizinkan mengelola Slide Banner.'
            ], 403));
        }

        return $user;
    }

    /**
     * Format banner agar image_url selalu full URL yang dapat diakses oleh mobile app.
     */
    private function formatBanner(MobileSliderBanner $banner, Request $request)
    {
        $baseUrl = rtrim($request->root() ?: url('/'), '/');
        $img = $banner->image_url;

        if ($img && !str_starts_with($img, 'http://') && !str_starts_with($img, 'https://') && !str_starts_with($img, 'data:')) {
            $img = $baseUrl . '/' . ltrim($img, '/');
        }

        $array = $banner->toArray();
        $array['image_url_full'] = $img;
        return $array;
    }

    /**
     * GET /api/app-testing/slider-banners/active
     * Ambil daftar slide banner yang aktif untuk aplikasi mobile (atau preview).
     */
    public function getActiveBanners(Request $request)
    {
        $banners = MobileSliderBanner::where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $formatted = $banners->map(function ($banner) use ($request) {
            return $this->formatBanner($banner, $request);
        });

        return response()->json([
            'status' => 'success',
            'data'   => $formatted,
            'total'  => $formatted->count(),
        ]);
    }

    /**
     * GET /api/app-testing/slider-banners
     * Ambil seluruh slide banner untuk panel admin.
     */
    public function index(Request $request)
    {
        $this->checkAdmin($request);

        $banners = MobileSliderBanner::orderBy('sort_order', 'asc')
            ->orderBy('id', 'desc')
            ->get();

        $formatted = $banners->map(function ($banner) use ($request) {
            return $this->formatBanner($banner, $request);
        });

        return response()->json([
            'status' => 'success',
            'data'   => $formatted,
            'total'  => $formatted->count(),
        ]);
    }

    /**
     * Upload helper gambar slide banner dengan multi-layer fallback.
     */
    public function uploadImage(Request $request)
    {
        $this->checkAdmin($request);

        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $file = $request->file('image');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
        $filename = 'slider_' . time() . '_' . Str::random(8) . '.' . $ext;

        $savedPath = null;
        $uploadDir = public_path('uploads/slider_banners');

        try {
            if (!File::isDirectory($uploadDir)) {
                @File::makeDirectory($uploadDir, 0777, true, true);
            }
            if (is_writable($uploadDir) || @chmod($uploadDir, 0777)) {
                $file->move($uploadDir, $filename);
                $savedPath = '/uploads/slider_banners/' . $filename;
            }
        } catch (\Throwable $e) {
            Log::warning('Upload ke public/uploads gagal: ' . $e->getMessage());
        }

        if (!$savedPath) {
            try {
                $storageDir = storage_path('app/public/uploads/slider_banners');
                if (!File::isDirectory($storageDir)) {
                    @File::makeDirectory($storageDir, 0777, true, true);
                }
                $file->move($storageDir, $filename);
                $savedPath = '/storage/uploads/slider_banners/' . $filename;
            } catch (\Throwable $e) {
                Log::warning('Upload ke storage gagal: ' . $e->getMessage());
            }
        }

        if (!$savedPath) {
            $mime = $file->getMimeType() ?: 'image/png';
            $content = file_get_contents($file->getRealPath());
            $savedPath = 'data:' . $mime . ';base64,' . base64_encode($content);
        }

        $fullUrl = $savedPath;
        if (!str_starts_with($savedPath, 'data:') && !str_starts_with($savedPath, 'http')) {
            $fullUrl = url($savedPath);
        }

        return response()->json([
            'status'     => 'success',
            'url'        => $savedPath,
            'url_full'   => $fullUrl,
            'message'    => 'Gambar slide banner berhasil diunggah.',
        ]);
    }

    /**
     * POST /api/app-testing/slider-banners
     * Simpan slide banner baru.
     */
    public function store(Request $request)
    {
        $user = $this->checkAdmin($request);

        $validated = $request->validate([
            'title'       => 'nullable|string|max:150',
            'subtitle'    => 'nullable|string|max:300',
            'image_url'   => 'nullable|string',
            'image'       => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'badge_text'  => 'nullable|string|max:50',
            'action_type' => 'nullable|string|in:none,url,screen',
            'action_url'  => 'nullable|string|max:255',
            'is_active'   => 'nullable|boolean',
            'sort_order'  => 'nullable|integer',
        ]);

        $imageUrl = $request->input('image_url');

        // Jika upload file langsung
        if ($request->hasFile('image')) {
            $uploadRes = $this->uploadImage($request);
            $data = $uploadRes->getData(true);
            if (isset($data['url'])) {
                $imageUrl = $data['url'];
            }
        }

        if (empty($imageUrl)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gambar banner (file gambar atau tautan URL) wajib diisi.',
            ], 422);
        }

        $banner = MobileSliderBanner::create([
            'title'           => $validated['title'] ?? null,
            'subtitle'        => $validated['subtitle'] ?? null,
            'image_url'       => $imageUrl,
            'badge_text'      => $validated['badge_text'] ?? null,
            'action_type'     => $validated['action_type'] ?? 'none',
            'action_url'      => $validated['action_url'] ?? null,
            'is_active'       => $request->has('is_active') ? (bool) $request->input('is_active') : true,
            'sort_order'      => $validated['sort_order'] ?? 0,
            'created_by'      => $user ? $user->id : null,
            'created_by_name' => $user ? ($user->name ?? $user->username) : 'Administrator',
        ]);

        AuditLog::record(
            'MOBILE_SLIDER_BANNER_CREATE',
            'App Testing',
            "Administrator menambahkan slide banner baru: '" . ($banner->title ?: 'Tanpa Judul') . "'.",
            null,
            $banner->toArray()
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Slide banner mobile berhasil ditambahkan!',
            'data'    => $this->formatBanner($banner, $request),
        ], 201);
    }

    /**
     * GET /api/app-testing/slider-banners/{id}
     */
    public function show(Request $request, $id)
    {
        $this->checkAdmin($request);
        $banner = MobileSliderBanner::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data'   => $this->formatBanner($banner, $request),
        ]);
    }

    /**
     * PUT /api/app-testing/slider-banners/{id}
     * Perbarui slide banner.
     */
    public function update(Request $request, $id)
    {
        $this->checkAdmin($request);
        $banner = MobileSliderBanner::findOrFail($id);

        $validated = $request->validate([
            'title'       => 'nullable|string|max:150',
            'subtitle'    => 'nullable|string|max:300',
            'image_url'   => 'nullable|string',
            'image'       => 'nullable|image|mimes:jpeg,png,jpg,webp|max:5120',
            'badge_text'  => 'nullable|string|max:50',
            'action_type' => 'nullable|string|in:none,url,screen',
            'action_url'  => 'nullable|string|max:255',
            'is_active'   => 'nullable|boolean',
            'sort_order'  => 'nullable|integer',
        ]);

        if ($request->hasFile('image')) {
            $uploadRes = $this->uploadImage($request);
            $data = $uploadRes->getData(true);
            if (isset($data['url'])) {
                $validated['image_url'] = $data['url'];
            }
        }

        $banner->update($validated);

        AuditLog::record(
            'MOBILE_SLIDER_BANNER_UPDATE',
            'App Testing',
            "Administrator memperbarui slide banner ID #{$id}.",
            null,
            $banner->toArray()
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Slide banner mobile berhasil diperbarui!',
            'data'    => $this->formatBanner($banner, $request),
        ]);
    }

    /**
     * PATCH /api/app-testing/slider-banners/{id}/toggle
     * Toggle status aktif / nonaktif.
     */
    public function toggleActive(Request $request, $id)
    {
        $this->checkAdmin($request);
        $banner = MobileSliderBanner::findOrFail($id);
        $banner->is_active = !$banner->is_active;
        $banner->save();

        $statusStr = $banner->is_active ? 'diaktifkan' : 'dinonaktifkan';

        AuditLog::record(
            'MOBILE_SLIDER_BANNER_TOGGLE',
            'App Testing',
            "Status slide banner ID #{$id} diubah menjadi {$statusStr}.",
            null,
            ['id' => $id, 'is_active' => $banner->is_active]
        );

        return response()->json([
            'status'    => 'success',
            'message'   => "Slide banner berhasil {$statusStr}!",
            'is_active' => $banner->is_active,
            'data'      => $this->formatBanner($banner, $request),
        ]);
    }

    /**
     * DELETE /api/app-testing/slider-banners/{id}
     * Hapus slide banner.
     */
    public function destroy(Request $request, $id)
    {
        $this->checkAdmin($request);
        $banner = MobileSliderBanner::findOrFail($id);

        // Hapus file fisik jika disimpan di public/uploads
        if ($banner->image_url && str_starts_with($banner->image_url, '/uploads/slider_banners/')) {
            $filePath = public_path($banner->image_url);
            if (File::exists($filePath)) {
                @File::delete($filePath);
            }
        }

        $banner->delete();

        AuditLog::record(
            'MOBILE_SLIDER_BANNER_DELETE',
            'App Testing',
            "Administrator menghapus slide banner ID #{$id}.",
            null,
            ['id' => $id]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Slide banner berhasil dihapus!',
        ]);
    }
}
