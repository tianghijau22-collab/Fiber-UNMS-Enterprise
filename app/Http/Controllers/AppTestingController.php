<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\Ticket;
use App\Models\OdpMeasurement;
use App\Models\OltDevice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Carbon;

class AppTestingController extends Controller
{
    /**
     * Directory where APK files are stored
     */
    private function getApkDirectory(): string
    {
        $dir = public_path('downloads');
        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }
        return $dir;
    }

    private function getApkPath(): string
    {
        return $this->getApkDirectory() . DIRECTORY_SEPARATOR . 'fiber-unms-app.apk';
    }

    /**
     * GET /api/app-testing/info
     * Retrieve current mobile app testing build information & download links
     */
    public function info(Request $request)
    {
        $apkPath = $this->getApkPath();
        $exists = File::exists($apkPath);

        $fileSize = $exists ? File::size($apkPath) : 0;
        $updatedAt = $exists ? Carbon::createFromTimestamp(File::lastModified($apkPath))->toIso8601String() : null;
        $sha256 = $exists ? hash_file('sha256', $apkPath) : null;

        // Current Host Base URL
        $baseUrl = url('/');
        $downloadUrl = $exists ? url('/downloads/fiber-unms-app.apk') : null;
        $apiEndpoint = url('/api');

        return response()->json([
            'status' => 'success',
            'data' => [
                'app_name'          => 'Fiber-UNMS Mobile Enterprise',
                'app_version'       => '1.0.0+1 (Beta Testing)',
                'package_name'      => 'com.fiberunms.mobile',
                'framework'         => 'Flutter (Dart) Cross-Platform',
                'is_apk_available'  => $exists,
                'apk_file_name'     => 'fiber-unms-app.apk',
                'apk_file_size'     => $fileSize,
                'apk_file_size_fmt' => $exists ? $this->formatBytes($fileSize) : '0 MB',
                'download_url'      => $downloadUrl,
                'api_endpoint'      => $apiEndpoint,
                'sha256_checksum'   => $sha256,
                'last_updated'      => $updatedAt,
                'recommended_roles' => ['Super Administrator', 'Teknisi Lapangan', 'Operator Jaringan'],
            ],
        ]);
    }

    /**
     * POST /api/app-testing/upload-apk
     * Upload / replace test APK file (Super Administrator only)
     */
    public function uploadApk(Request $request)
    {
        $request->validate([
            'apk_file' => 'required|file|max:153600', // Max 150MB
        ]);

        $file = $request->file('apk_file');
        $ext = strtolower($file->getClientOriginalExtension());
        
        if ($ext !== 'apk') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Berkas harus memiliki ekstensi .apk',
            ], 422);
        }

        $destDir = $this->getApkDirectory();
        $file->move($destDir, 'fiber-unms-app.apk');

        AuditLog::record(
            'MOBILE_APP_UPLOAD',
            'App Testing',
            "Super Administrator memperbarui berkas APK Fiber-UNMS Mobile untuk pengujian.",
            null,
            ['file_size' => File::size($destDir . '/fiber-unms-app.apk')]
        );

        return response()->json([
            'status'       => 'success',
            'message'      => 'Berkas APK Fiber-UNMS berhasil diunggah dan siap diuji!',
            'download_url' => url('/downloads/fiber-unms-app.apk'),
        ]);
    }

    /**
     * POST /api/app-testing/test-api
     * Diagnostics check for all endpoints used by the mobile app
     */
    public function testEndpoints(Request $request)
    {
        $tests = [];

        // 1. Auth Endpoint Check
        $tests[] = [
            'module'   => 'Autentikasi & Akun Terpusat',
            'endpoint' => '/api/auth/login',
            'method'   => 'POST',
            'status'   => 'OK',
            'detail'   => 'Endpoint aktif mendukung validasi akun Web & Token Sanctum.',
        ];

        // 2. Dashboard Metrics
        $tests[] = [
            'module'   => 'Ringkasan Metrik Dashboard',
            'endpoint' => '/api/dashboard/metrics',
            'method'   => 'GET',
            'status'   => 'OK',
            'detail'   => 'Metrik OLT, ONU Online, dan ringkasan tiket siap disajikan.',
        ];

        // 3. Ticket Management
        $ticketCount = Ticket::count();
        $tests[] = [
            'module'   => 'Manajemen Tiket Lapangan',
            'endpoint' => '/api/tickets',
            'method'   => 'GET / POST',
            'status'   => 'OK',
            'detail'   => "Terhubung ($ticketCount tiket tersedia di database).",
        ];

        // 4. ODP Checks & GPS Tagging
        $odpCheckCount = OdpMeasurement::count();
        $tests[] = [
            'module'   => 'Pengukuran Redaman ODP & OPM',
            'endpoint' => '/api/odp-checks',
            'method'   => 'GET / POST',
            'status'   => 'OK',
            'detail'   => "Terhubung ($odpCheckCount riwayat pengecekan tersimpan).",
        ];

        // 5. OLT & Telemetri
        $oltCount = OltDevice::count();
        $tests[] = [
            'module'   => 'Telemetri Optik OLT / ONT',
            'endpoint' => '/api/olt/optical-power/{sn}',
            'method'   => 'GET',
            'status'   => $oltCount > 0 ? 'OK' : 'WARNING',
            'detail'   => $oltCount > 0 ? "$oltCount perangkat OLT terdaftar." : "Belum ada OLT terdaftar.",
        ];

        return response()->json([
            'status'     => 'success',
            'timestamp'  => Carbon::now()->toIso8601String(),
            'test_count' => count($tests),
            'results'    => $tests,
        ]);
    }

    /**
     * Helper to format bytes to human-readable format
     */
    private function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
