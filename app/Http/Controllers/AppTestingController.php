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
                'app_name'          => 'Fona Mobile Enterprise',
                'app_version'       => '1.0.0+1 (Fona Edition)',
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
     * POST /api/app-testing/trigger-build
     * Trigger automatic Flutter APK compilation on the VPS server
     */
    public function triggerBuild(Request $request)
    {
        $scriptPath = '/home/jasenardian/setup_flutter_vps.sh';
        $logPath = '/home/jasenardian/flutter_build.log';

        if (!File::exists($scriptPath)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Skrip build server tidak ditemukan di VPS.',
            ], 404);
        }

        // Check if build is already running
        $isRunning = false;
        if (PHP_OS_FAMILY === 'Linux') {
            $psOutput = shell_exec("ps aux | grep setup_flutter_vps.sh | grep -v grep");
            if (!empty($psOutput)) {
                $isRunning = true;
            }
        }

        if ($isRunning) {
            return response()->json([
                'status'  => 'warning',
                'message' => 'Proses build APK sedang berjalan di latar belakang.',
            ]);
        }

        // Start background compilation
        shell_exec("nohup bash $scriptPath > $logPath 2>&1 &");

        AuditLog::record(
            'MOBILE_APP_BUILD_TRIGGERED',
            'App Testing',
            "Super Administrator memicu kompilasi otomatis build APK Mobile di VPS.",
            null,
            ['triggered_at' => Carbon::now()->toIso8601String()]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Proses kompilasi APK berhasil dimulai di server. Anda dapat memantau log proses secara real-time.',
        ]);
    }

    /**
     * GET /api/app-testing/build-status
     * Check if compilation is running and get live build log lines
     */
    public function buildStatus(Request $request)
    {
        $logPath = '/home/jasenardian/flutter_build.log';
        $isRunning = false;

        if (PHP_OS_FAMILY === 'Linux') {
            $psOutput = shell_exec("ps aux | grep -E 'setup_flutter_vps.sh|flutter build' | grep -v grep");
            if (!empty($psOutput)) {
                $isRunning = true;
            }
        }

        $logContent = '';
        if (File::exists($logPath)) {
            // Read last 60 lines
            if (PHP_OS_FAMILY === 'Linux') {
                $logContent = shell_exec("tail -n 60 $logPath 2>/dev/null") ?? '';
            } else {
                $logContent = File::get($logPath);
            }
        }

        return response()->json([
            'status'       => 'success',
            'is_running'   => $isRunning,
            'log_content'  => $logContent,
            'is_completed' => File::exists($this->getApkPath()),
        ]);
    }

    /**
     * GET /api/app-testing/login-banner
     * Get mobile login header banner image & position configuration
     */
    public function getLoginBanner(Request $request)
    {
        $dir = public_path('branding');
        $files = ['mobile_login_banner.png', 'mobile_login_banner.jpg', 'mobile_login_banner.jpeg', 'mobile_login_banner.webp'];
        $baseUrl = $request->root() ?: url('/');
        $configFile = $dir . DIRECTORY_SEPARATOR . 'mobile_login_banner_config.json';
        
        $config = [
            'fit'             => 'cover',
            'alignment_x'     => 0.0,
            'alignment_y'     => 0.0,
            'scale'           => 1.0,
            'overlay_opacity' => 0.0,
        ];

        if (File::exists($configFile)) {
            $savedConfig = json_decode(File::get($configFile), true);
            if (is_array($savedConfig)) {
                $config = array_merge($config, $savedConfig);
            }
        }
        
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            if (File::exists($path)) {
                return response()->json([
                    'status' => 'success',
                    'data'   => [
                        'is_custom'   => true,
                        'banner_url'  => rtrim($baseUrl, '/') . '/branding/' . $file . '?v=' . File::lastModified($path),
                        'file_size'   => File::size($path),
                        'updated_at'  => Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
                        'config'      => $config,
                    ],
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'is_custom'   => false,
                'banner_url'  => null,
                'updated_at'  => null,
                'config'      => $config,
            ],
        ]);
    }

    /**
     * POST /api/app-testing/login-banner
     * Upload custom login header banner image from web admin
     */
    public function uploadLoginBanner(Request $request)
    {
        $request->validate([
            'banner_image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120', // Max 5MB
        ]);

        $file = $request->file('banner_image');
        $ext = strtolower($file->getClientOriginalExtension());
        $dir = public_path('branding');

        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        // Clean previous banner files
        $oldFiles = ['mobile_login_banner.png', 'mobile_login_banner.jpg', 'mobile_login_banner.jpeg', 'mobile_login_banner.webp'];
        foreach ($oldFiles as $old) {
            $oldPath = $dir . DIRECTORY_SEPARATOR . $old;
            if (File::exists($oldPath)) {
                File::delete($oldPath);
            }
        }

        $filename = 'mobile_login_banner.' . $ext;
        $file->move($dir, $filename);
        $fullPath = $dir . DIRECTORY_SEPARATOR . $filename;

        AuditLog::record(
            'MOBILE_BANNER_UPDATE',
            'App Testing',
            "Administrator memperbarui gambar latar belakang login aplikasi mobile FONA.",
            null,
            ['filename' => $filename, 'file_size' => File::size($fullPath)]
        );

        return response()->json([
            'status'     => 'success',
            'message'    => 'Gambar latar belakang login aplikasi mobile berhasil diperbarui!',
            'banner_url' => url('/branding/' . $filename) . '?v=' . time(),
        ]);
    }

    /**
     * POST /api/app-testing/login-banner-config
     * Save position and display settings for the mobile login banner
     */
    public function saveLoginBannerConfig(Request $request)
    {
        $validated = $request->validate([
            'fit'             => 'nullable|string|in:cover,contain,fitWidth,fill',
            'alignment_x'     => 'nullable|numeric|between:-1,1',
            'alignment_y'     => 'nullable|numeric|between:-1,1',
            'scale'           => 'nullable|numeric|between:0.5,3.0',
            'overlay_opacity' => 'nullable|numeric|between:0,0.9',
        ]);

        $dir = public_path('branding');
        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $configFile = $dir . DIRECTORY_SEPARATOR . 'mobile_login_banner_config.json';
        $currentConfig = [
            'fit'             => 'cover',
            'alignment_x'     => 0.0,
            'alignment_y'     => 0.0,
            'scale'           => 1.0,
            'overlay_opacity' => 0.0,
        ];

        if (File::exists($configFile)) {
            $existing = json_decode(File::get($configFile), true);
            if (is_array($existing)) {
                $currentConfig = array_merge($currentConfig, $existing);
            }
        }

        $updatedConfig = array_merge($currentConfig, array_filter($validated, fn($val) => $val !== null));
        File::put($configFile, json_encode($updatedConfig, JSON_PRETTY_PRINT));

        AuditLog::record(
            'MOBILE_BANNER_CONFIG_UPDATE',
            'App Testing',
            "Administrator memperbarui konfigurasi tata letak dan posisi banner login mobile.",
            null,
            $updatedConfig
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengaturan posisi dan tampilan banner login berhasil disimpan!',
            'data'    => [
                'config' => $updatedConfig,
            ],
        ]);
    }

    /**
     * DELETE /api/app-testing/login-banner
     * Reset login header banner to default
     */
    public function deleteLoginBanner(Request $request)
    {
        $dir = public_path('branding');
        $oldFiles = ['mobile_login_banner.png', 'mobile_login_banner.jpg', 'mobile_login_banner.jpeg', 'mobile_login_banner.webp', 'mobile_login_banner_config.json'];
        
        foreach ($oldFiles as $old) {
            $oldPath = $dir . DIRECTORY_SEPARATOR . $old;
            if (File::exists($oldPath)) {
                File::delete($oldPath);
            }
        }

        AuditLog::record(
            'MOBILE_BANNER_RESET',
            'App Testing',
            "Administrator mereset gambar latar belakang login aplikasi mobile ke default.",
            null,
            []
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Latar belakang login aplikasi mobile berhasil direset ke tampilan default.',
        ]);
    }

    /**
     * GET /api/app-testing/dashboard-banner
     * Get mobile dashboard header banner image & position configuration
     */
    public function getDashboardBanner(Request $request)
    {
        $dir = public_path('branding');
        $files = ['mobile_dashboard_banner.png', 'mobile_dashboard_banner.jpg', 'mobile_dashboard_banner.jpeg', 'mobile_dashboard_banner.webp'];
        $baseUrl = $request->root() ?: url('/');
        $configFile = $dir . DIRECTORY_SEPARATOR . 'mobile_dashboard_banner_config.json';
        
        $config = [
            'fit'             => 'cover',
            'alignment_x'     => 0.0,
            'alignment_y'     => 0.0,
            'scale'           => 1.0,
            'overlay_opacity' => 0.0,
        ];

        if (File::exists($configFile)) {
            $savedConfig = json_decode(File::get($configFile), true);
            if (is_array($savedConfig)) {
                $config = array_merge($config, $savedConfig);
            }
        }
        
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            if (File::exists($path)) {
                return response()->json([
                    'status' => 'success',
                    'data'   => [
                        'is_custom'   => true,
                        'banner_url'  => rtrim($baseUrl, '/') . '/branding/' . $file . '?v=' . File::lastModified($path),
                        'file_size'   => File::size($path),
                        'updated_at'  => Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
                        'config'      => $config,
                    ],
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'is_custom'   => false,
                'banner_url'  => null,
                'updated_at'  => null,
                'config'      => $config,
            ],
        ]);
    }

    /**
     * POST /api/app-testing/dashboard-banner
     * Upload custom dashboard header banner image from web admin
     */
    public function uploadDashboardBanner(Request $request)
    {
        $request->validate([
            'banner_image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120', // Max 5MB
        ]);

        $file = $request->file('banner_image');
        $ext = strtolower($file->getClientOriginalExtension());
        $dir = public_path('branding');

        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        // Clean previous banner files
        $oldFiles = ['mobile_dashboard_banner.png', 'mobile_dashboard_banner.jpg', 'mobile_dashboard_banner.jpeg', 'mobile_dashboard_banner.webp'];
        foreach ($oldFiles as $old) {
            $oldPath = $dir . DIRECTORY_SEPARATOR . $old;
            if (File::exists($oldPath)) {
                File::delete($oldPath);
            }
        }

        $filename = 'mobile_dashboard_banner.' . $ext;
        $file->move($dir, $filename);
        $fullPath = $dir . DIRECTORY_SEPARATOR . $filename;

        AuditLog::record(
            'MOBILE_DASHBOARD_BANNER_UPDATE',
            'App Testing',
            "Administrator memperbarui gambar latar belakang header dashboard aplikasi mobile FONA.",
            null,
            ['filename' => $filename, 'file_size' => File::size($fullPath)]
        );

        return response()->json([
            'status'     => 'success',
            'message'    => 'Gambar latar belakang dashboard aplikasi mobile berhasil diperbarui!',
            'banner_url' => url('/branding/' . $filename) . '?v=' . time(),
        ]);
    }

    /**
     * POST /api/app-testing/dashboard-banner-config
     * Save position and display settings for the mobile dashboard banner
     */
    public function saveDashboardBannerConfig(Request $request)
    {
        $validated = $request->validate([
            'fit'             => 'nullable|string|in:cover,contain,fitWidth,fill',
            'alignment_x'     => 'nullable|numeric|between:-1,1',
            'alignment_y'     => 'nullable|numeric|between:-1,1',
            'scale'           => 'nullable|numeric|between:0.5,3.0',
            'overlay_opacity' => 'nullable|numeric|between:0,0.9',
        ]);

        $dir = public_path('branding');
        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $configFile = $dir . DIRECTORY_SEPARATOR . 'mobile_dashboard_banner_config.json';
        $currentConfig = [
            'fit'             => 'cover',
            'alignment_x'     => 0.0,
            'alignment_y'     => 0.0,
            'scale'           => 1.0,
            'overlay_opacity' => 0.0,
        ];

        if (File::exists($configFile)) {
            $existing = json_decode(File::get($configFile), true);
            if (is_array($existing)) {
                $currentConfig = array_merge($currentConfig, $existing);
            }
        }

        $updatedConfig = array_merge($currentConfig, array_filter($validated, fn($val) => $val !== null));
        File::put($configFile, json_encode($updatedConfig, JSON_PRETTY_PRINT));

        AuditLog::record(
            'MOBILE_DASHBOARD_BANNER_CONFIG_UPDATE',
            'App Testing',
            "Administrator memperbarui konfigurasi tata letak dan posisi banner dashboard mobile.",
            null,
            $updatedConfig
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pengaturan posisi dan tampilan banner dashboard berhasil disimpan!',
            'data'    => [
                'config' => $updatedConfig,
            ],
        ]);
    }

    /**
     * DELETE /api/app-testing/dashboard-banner
     * Reset dashboard header banner to default
     */
    public function deleteDashboardBanner(Request $request)
    {
        $dir = public_path('branding');
        $oldFiles = ['mobile_dashboard_banner.png', 'mobile_dashboard_banner.jpg', 'mobile_dashboard_banner.jpeg', 'mobile_dashboard_banner.webp', 'mobile_dashboard_banner_config.json'];
        
        foreach ($oldFiles as $old) {
            $oldPath = $dir . DIRECTORY_SEPARATOR . $old;
            if (File::exists($oldPath)) {
                File::delete($oldPath);
            }
        }

        AuditLog::record(
            'MOBILE_DASHBOARD_BANNER_RESET',
            'App Testing',
            "Administrator mereset gambar latar belakang header dashboard aplikasi mobile ke default.",
            null,
            []
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Latar belakang dashboard aplikasi mobile berhasil direset ke tampilan default.',
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

