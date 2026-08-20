<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\TelegramChannel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    /**
     * Tentukan topik/kategori notifikasi berdasarkan tipe, modul, atau aksi
     */
    public static function determineTopic(string $type, ?string $module = null, ?string $action = null): string
    {
        $m = strtolower($module ?? '');
        $a = strtoupper($action ?? '');
        $t = strtoupper($type);

        if ($a === 'BROADCAST' || $m === 'pusat notifikasi' || $m === 'broadcast') {
            return 'BROADCAST';
        }

        if (str_contains($m, 'customer') || str_contains($m, 'pelanggan')) {
            return 'CUSTOMER';
        }

        if (str_contains($m, 'ticket') || str_contains($m, 'tiket') || str_contains($m, 'maintenance')) {
            return 'TICKET';
        }

        if (str_contains($m, 'olt') || str_contains($m, 'telemetry')) {
            return 'OLT_MGMT';
        }

        if (str_contains($m, 'infrastruktur') || str_contains($m, 'node') || str_contains($m, 'cable') || str_contains($m, 'kabel')) {
            return 'INFRASTRUCTURE';
        }

        if (str_contains($m, 'user') || str_contains($m, 'auth') || str_contains($m, 'pengguna')) {
            return 'USER_MGMT';
        }

        if (str_contains($m, 'billing') || str_contains($m, 'keuangan') || $t === 'BILLING') {
            return 'BILLING';
        }

        if ($t === 'SECURITY') {
            return 'USER_MGMT';
        }

        return 'NOC';
    }

    /**
     * Dapatkan daftar Chat ID grup Telegram yang terdaftar untuk topik tertentu
     */
    public static function getActiveChatIdsForTopic(string $topic): array
    {
        $channels = TelegramChannel::where('is_active', true)->get();

        if ($channels->isEmpty()) {
            // Fallback ke chat_id legacy dari system_settings jika tabel channel kosong
            $defaultChatId = SystemSetting::get('telegram_chat_id', env('TELEGRAM_CHAT_ID'));
            return !empty($defaultChatId) ? [$defaultChatId] : [];
        }

        $chatIds = [];
        foreach ($channels as $ch) {
            $topics = is_array($ch->topics) ? $ch->topics : [];
            // Jika channel subscribe ke topik ini atau subscribe ke 'ALL'
            if (empty($topics) || in_array($topic, $topics) || in_array('ALL', $topics)) {
                $chatIds[] = trim($ch->chat_id);
            }
        }

        return array_unique(array_filter($chatIds));
    }

    /**
     * Kirim notifikasi pesan ke seluruh Grup Telegram (Non-Blocking / Asynchronous)
     */
    public static function send(string $title, string $body, string $type = 'NOC', ?string $url = null): bool
    {
        try {
            $enabled = SystemSetting::get('telegram_enabled', env('TELEGRAM_ENABLED', 'false'));
            if ($enabled !== 'true' && $enabled !== true && $enabled !== '1') {
                return false;
            }

            $botToken = SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'));
            if (empty($botToken)) {
                return false;
            }

            $topic = static::determineTopic($type);
            $targetChatIds = static::getActiveChatIdsForTopic($topic);

            if (empty($targetChatIds)) {
                return false;
            }

            // Eksekusi non-blocking di background setelah HTTP response dikirim ke browser (0ms delay)
            if (app()->runningInConsole()) {
                static::executeSendDispatch($title, $body, $type, $url, $botToken, $targetChatIds);
            } else {
                app()->terminating(function () use ($title, $body, $type, $url, $botToken, $targetChatIds) {
                    static::executeSendDispatch($title, $body, $type, $url, $botToken, $targetChatIds);
                });
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Telegram Service Exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Eksekusi pengiriman pesan broadcast secara paralel dengan Http::pool
     */
    public static function executeSendDispatch(
        string $title,
        string $body,
        string $type,
        ?string $url,
        string $botToken,
        array $targetChatIds
    ): void {
        try {
            $timeStr = now()->format('d/m/Y, H.i.s');
            $appUrl = env('APP_URL', 'http://127.0.0.1:8000');
            $targetUrl = $url ? (str_starts_with($url, 'http') ? $url : rtrim($appUrl, '/') . '/' . ltrim($url, '/')) : null;

            $message = "<b>" . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . "</b>\n";
            $message .= "────────────────────────────\n\n";
            $message .= $body . "\n\n";
            $message .= "────────────────────────────\n";
            $message .= "<b>Waktu:</b> {$timeStr}\n";
            $message .= "<b>Sistem:</b> Fiber-UNMS Enterprise";

            $payload = [
                'text'                     => $message,
                'parse_mode'               => 'HTML',
                'disable_web_page_preview' => false,
            ];

            if ($targetUrl) {
                $payload['reply_markup'] = json_encode([
                    'inline_keyboard' => [
                        [
                            [
                                'text' => 'Buka Detail di Sistem UNMS',
                                'url'  => $targetUrl,
                            ]
                        ]
                    ]
                ]);
            }

            // Pengiriman paralel cepat (Concurrent cURL pool)
            Http::pool(function ($pool) use ($targetChatIds, $botToken, $payload) {
                return array_map(function ($chatId) use ($pool, $botToken, $payload) {
                    $p = array_merge($payload, ['chat_id' => $chatId]);
                    return $pool->as($chatId)
                        ->connectTimeout(2)
                        ->timeout(4)
                        ->post("https://api.telegram.org/bot{$botToken}/sendMessage", $p);
                }, $targetChatIds);
            });
        } catch (\Throwable $e) {
            Log::warning('Telegram Send Dispatch Error: ' . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi Audit Log CRUD ke Grup Telegram (Non-Blocking / Asynchronous)
     */
    public static function sendAuditLog(
        string $action,
        string $module,
        string $description,
        ?string $userName = null,
        ?string $userRole = null,
        ?string $ipAddress = null,
        ?array $oldValues = null,
        ?array $newValues = null
    ): bool {
        try {
            $enabled = SystemSetting::get('telegram_enabled', 'false');
            if ($enabled !== 'true' && $enabled !== true && $enabled !== '1') {
                return false;
            }

            $botToken = SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'));
            if (empty($botToken)) {
                return false;
            }

            $topic = static::determineTopic('INFO', $module, $action);
            $targetChatIds = static::getActiveChatIdsForTopic($topic);

            if (empty($targetChatIds)) {
                return false;
            }

            // Eksekusi non-blocking di background setelah HTTP response dikirim ke browser (0ms delay)
            if (app()->runningInConsole()) {
                static::executeAuditLogDispatch(
                    $action,
                    $module,
                    $description,
                    $userName,
                    $userRole,
                    $ipAddress,
                    $oldValues,
                    $newValues,
                    $botToken,
                    $targetChatIds
                );
            } else {
                app()->terminating(function () use (
                    $action,
                    $module,
                    $description,
                    $userName,
                    $userRole,
                    $ipAddress,
                    $oldValues,
                    $newValues,
                    $botToken,
                    $targetChatIds
                ) {
                    static::executeAuditLogDispatch(
                        $action,
                        $module,
                        $description,
                        $userName,
                        $userRole,
                        $ipAddress,
                        $oldValues,
                        $newValues,
                        $botToken,
                        $targetChatIds
                    );
                });
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('Telegram Audit Log Error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Dapatkan label nama entitas dari nama modul & nilai atribut
     */
    private static function getEntityLabel(string $module, ?array $values = null): string
    {
        $m = strtolower($module);
        if (str_contains($m, 'customer') || str_contains($m, 'pelanggan')) {
            return 'Pelanggan';
        }
        if (str_contains($m, 'ticket') || str_contains($m, 'tiket')) {
            return 'Tiket Gangguan';
        }
        if (str_contains($m, 'olt')) {
            return 'OLT';
        }
        if (str_contains($m, 'kabel') || str_contains($m, 'cable')) {
            return 'Kabel Optik';
        }
        if (str_contains($m, 'user') || str_contains($m, 'pengguna')) {
            return 'Pengguna';
        }
        if (str_contains($m, 'auth') || str_contains($m, 'login') || str_contains($m, 'otentikasi')) {
            return 'Akun';
        }
        if (str_contains($m, 'infrastruktur') || str_contains($m, 'node')) {
            $nodeType = strtoupper($values['node_type'] ?? $values['type'] ?? '');
            if (!empty($nodeType) && in_array($nodeType, ['ODP', 'ODC', 'POP', 'OLT'])) {
                return $nodeType;
            }
            return 'Node Jaringan';
        }
        return 'Data';
    }

    /**
     * Eksekusi pengiriman pesan audit log secara paralel dengan Http::pool
     * Format struktur rapi dan elegan sesuai standar korporat
     */
    public static function executeAuditLogDispatch(
        string $action,
        string $module,
        string $description,
        ?string $userName,
        ?string $userRole,
        ?string $ipAddress,
        ?array $oldValues,
        ?array $newValues,
        string $botToken,
        array $targetChatIds
    ): void {
        try {
            $userStr = $userName ?: 'Super Administrator';
            $timeStr = now()->format('d/m/Y, H.i.s');
            $actionUpper = strtoupper($action);

            $sampleValues = !empty($newValues) ? $newValues : (!empty($oldValues) ? $oldValues : []);
            $entityLabel = static::getEntityLabel($module, $sampleValues);

            // 1. Header Judul
            $headerTitle = match ($actionUpper) {
                'CREATE'       => "Data {$entityLabel} Baru Ditambahkan",
                'UPDATE'       => "Data {$entityLabel} Telah Diperbarui",
                'DELETE'       => "Data {$entityLabel} Telah Dihapus",
                'PROVISIONING' => "Otorisasi & Konfigurasi {$entityLabel} Selesai",
                'BROADCAST'    => "Siaran Notifikasi Massal",
                'TEST'         => "Uji Koneksi Sistem UNMS",
                'LOGIN'        => "Aktivitas Login Pengguna",
                'LOGOUT'       => "Aktivitas Logout Pengguna",
                'LOGIN_FAILED' => "Peringatan Percobaan Login Gagal",
                'LOGIN_BLOCKED'=> "Peringatan Login Akun Ditangguhkan",
                'OTDR_TRACE'   => "Hasil Penembakan Laser OTDR",
                default        => "Aktivitas {$entityLabel}",
            };

            // 2. Sub-judul Rincian
            $sectionTitle = match ($actionUpper) {
                'CREATE'       => "Detail {$entityLabel}:",
                'UPDATE'       => "Detail Perubahan:",
                'DELETE'       => "Detail Data Terhapus:",
                default        => "Detail Aktivitas:",
            };

            // 3. Label Pelaksana
            $executorLabel = match ($actionUpper) {
                'CREATE'       => "Ditambahkan oleh:",
                'UPDATE'       => "Diperbarui oleh:",
                'DELETE'       => "Dihapus oleh:",
                default        => "Pelaksana:",
            };

            // 4. Catatan Kaki Status
            $statusFootnote = match ($actionUpper) {
                'CREATE'       => "<b>Status:</b> Data berhasil disimpan ke sistem",
                'UPDATE'       => "<b>Status:</b> Perubahan berhasil disimpan ke sistem",
                'DELETE'       => "<b>Status:</b> Data telah dihapus dari sistem",
                'PROVISIONING' => "<b>Status:</b> Konfigurasi provisioning berhasil diterapkan",
                'LOGIN'        => "<b>Status:</b> Sesi pengguna aktif",
                'LOGOUT'       => "<b>Status:</b> Sesi pengguna telah diakhiri",
                'LOGIN_FAILED', 'LOGIN_BLOCKED' => "<b>Status:</b> Percobaan akses ditolak oleh sistem keamanan",
                default        => "<b>Status:</b> Aktivitas berhasil dicatat di sistem",
            };

            // Susun Pesan
            $message = "<b>{$headerTitle}</b>\n\n";
            $message .= "<b>{$sectionTitle}</b>\n";

            $payloadDetails = static::formatDataPayload($oldValues, $newValues, $actionUpper, $entityLabel);
            if (!empty($payloadDetails)) {
                $message .= $payloadDetails . "\n";
            } else {
                $message .= "• " . htmlspecialchars($description, ENT_QUOTES, 'UTF-8') . "\n\n";
            }

            $message .= "<b>{$executorLabel}</b> " . htmlspecialchars($userStr, ENT_QUOTES, 'UTF-8') . "\n";
            $message .= "<b>Waktu:</b> {$timeStr}\n\n";
            $message .= $statusFootnote;

            // Pengiriman paralel cepat (Concurrent cURL pool)
            Http::pool(function ($pool) use ($targetChatIds, $botToken, $message) {
                return array_map(function ($chatId) use ($pool, $botToken, $message) {
                    return $pool->as($chatId)
                        ->connectTimeout(2)
                        ->timeout(4)
                        ->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                            'chat_id'                  => $chatId,
                            'text'                     => $message,
                            'parse_mode'               => 'HTML',
                            'disable_web_page_preview' => true,
                        ]);
                }, $targetChatIds);
            });
        } catch (\Throwable $e) {
            Log::warning('Telegram Audit Dispatch Pool Error: ' . $e->getMessage());
        }
    }

    /**
     * Format rincian data input, perubahan, atau penghapusan dengan kamus bahasa Indonesia yang rapi
     */
    private static function formatDataPayload(?array $oldValues, ?array $newValues, string $action, string $entityLabel = 'Data'): string
    {
        $output = "";

        // Kunci yang TIDAK PERLU ditampilkan sama sekali pada notifikasi Telegram
        $sensitiveKeys = [
            'password', 'cli_password', 'snmp_community_string', 'remember_token', 'token', 'auth_token',
            'updated_at', 'created_at', 'deleted_at',
            'latitude', 'longitude', 'lat', 'lng', 'route_coordinates',
            'parent_node_id', 'parent_id', 'code', 'id', 'user_id',
            'network_node_id', 'network_cable_id', 'olt_device_id', 'device_type_id',
            'brand_id', 'province_id', 'regency_id', 'district_id', 'village_id',
            'splitter_type_id', 'customer_service_id', 'olt_port_id', 'created_by'
        ];

        // Kamus terjemahan field teknis ke nama resmi Indonesia
        $labelMap = [
            'name'                   => 'Nama ' . $entityLabel,
            'customer_name'          => 'Nama Pelanggan',
            'customer_number'        => 'No. Pelanggan',
            'phone'                  => 'No. HP / WA',
            'package_name'           => 'Paket Layanan',
            'service_package'        => 'Paket Layanan',
            'odp_name'               => 'Nama ODP',
            'odc_name'               => 'Nama ODC',
            'node_type'              => 'Tipe Node',
            'tube_info'              => 'Tube ' . $entityLabel,
            'tube_count'             => 'Jumlah Tube',
            'tube_number'            => 'Tube',
            'core_color'             => 'Core',
            'core_number'            => 'Core',
            'core_power'             => 'Power / Redaman',
            'rx_power'               => 'Redaman (Rx)',
            'tx_power'               => 'Power (Tx)',
            'olt_port_ref'           => 'Interface',
            'port_name'              => 'Interface',
            'device_type'            => 'Jenis',
            'splitter_type'          => 'Jenis Splitter',
            'total_ports'            => 'Kapasitas Port',
            'used_ports'             => 'Port Terpakai',
            'status'                 => 'Status',
            'address'                => 'Daerah / Alamat',
            'length_meters'          => 'Panjang Kabel (m)',
            'installation_type'      => 'Jenis Instalasi',
            'core_count_total'       => 'Total Core',
            'ticket_number'          => 'No. Tiket',
            'title'                  => 'Judul',
            'category'               => 'Kategori',
            'priority'               => 'Prioritas',
            'technician_name'        => 'Teknisi Jointer',
            'onu_serial'             => 'Serial Number ONT',
            'ip_address'             => 'IP Address',
            'username'               => 'Username',
            'role'                   => 'Hak Akses',
            'division'               => 'Divisi',
        ];

        $cleanArray = function ($arr) use ($sensitiveKeys, $labelMap) {
            if (!is_array($arr)) return [];
            $res = [];
            foreach ($arr as $k => $v) {
                $kLower = strtolower($k);
                if (in_array($kLower, $sensitiveKeys)) continue;
                if (is_array($v) || is_object($v)) continue;
                if ($v === null || $v === '') continue;

                $label = $labelMap[$kLower] ?? ucwords(str_replace('_', ' ', $k));
                $res[$label] = (string) $v;
            }
            return $res;
        };

        $actionUpper = strtoupper($action);

        if ($actionUpper === 'CREATE' && !empty($newValues)) {
            $cleaned = $cleanArray($newValues);
            if (!empty($cleaned)) {
                $count = 0;
                foreach ($cleaned as $key => $val) {
                    if ($count >= 10) break;
                    $output .= "• <b>{$key}:</b> " . htmlspecialchars($val, ENT_QUOTES, 'UTF-8') . "\n";
                    $count++;
                }
            }
        } elseif ($actionUpper === 'UPDATE') {
            $oldClean = $cleanArray($oldValues);
            $newClean = $cleanArray($newValues);

            $changes = [];
            if (!empty($oldClean) && !empty($newClean)) {
                foreach ($newClean as $key => $newVal) {
                    if (isset($oldClean[$key])) {
                        $oldVal = $oldClean[$key];
                        $isDifferent = false;

                        if (is_numeric($oldVal) && is_numeric($newVal)) {
                            // Bandingkan secara numerik untuk mencegah perbedaan trailing zeroes desimal
                            $isDifferent = abs((float)$oldVal - (float)$newVal) > 0.00001;
                        } else {
                            $isDifferent = trim((string)$oldVal) !== trim((string)$newVal);
                        }

                        if ($isDifferent) {
                            $changes[$key] = ['old' => $oldVal, 'new' => $newVal];
                        }
                    }
                }
            }

            if (!empty($changes)) {
                $count = 0;
                foreach ($changes as $key => $diff) {
                    if ($count >= 10) break;
                    $oldVal = htmlspecialchars($diff['old'], ENT_QUOTES, 'UTF-8');
                    $newVal = htmlspecialchars($diff['new'], ENT_QUOTES, 'UTF-8');
                    $output .= "• <b>{$key}:</b> {$oldVal} -> <b>{$newVal}</b>\n";
                    $count++;
                }
            } elseif (!empty($newClean)) {
                $count = 0;
                foreach ($newClean as $key => $val) {
                    if ($count >= 8) break;
                    $output .= "• <b>{$key}:</b> " . htmlspecialchars($val, ENT_QUOTES, 'UTF-8') . "\n";
                    $count++;
                }
            }
        } elseif ($actionUpper === 'DELETE' && (!empty($oldValues) || !empty($newValues))) {
            $deletedData = $cleanArray(!empty($oldValues) ? $oldValues : $newValues);
            if (!empty($deletedData)) {
                $count = 0;
                foreach ($deletedData as $key => $val) {
                    if ($count >= 8) break;
                    $output .= "• <b>{$key}:</b> " . htmlspecialchars($val, ENT_QUOTES, 'UTF-8') . "\n";
                    $count++;
                }
            }
        }

        return $output;
    }

    /**
     * Uji koneksi pengiriman pesan ke grup/channel tertentu (Synchronous untuk UI feedback)
     */
    public static function testChannel(TelegramChannel $channel): array
    {
        $botToken = SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'));
        if (empty($botToken)) {
            return [
                'success' => false,
                'message' => 'Telegram Bot Token belum diisi pada konfigurasi master.',
            ];
        }

        $topicsText = empty($channel->topics) ? 'Semua Notifikasi' : implode(', ', array_map(function ($t) {
            return TelegramChannel::AVAILABLE_TOPICS[$t]['label'] ?? $t;
        }, $channel->topics));

        $timeStr = now()->format('d/m/Y, H.i.s');

        $message = "<b>Uji Koneksi Channel Telegram UNMS</b>\n\n";
        $message .= "<b>Detail Channel:</b>\n";
        $message .= "• <b>Nama Channel:</b> " . htmlspecialchars($channel->name, ENT_QUOTES, 'UTF-8') . "\n";
        $message .= "• <b>Chat ID:</b> <code>" . htmlspecialchars($channel->chat_id, ENT_QUOTES, 'UTF-8') . "</code>\n";
        $message .= "• <b>Topik Berlangganan:</b> " . htmlspecialchars($topicsText, ENT_QUOTES, 'UTF-8') . "\n\n";
        $message .= "<b>Waktu:</b> {$timeStr}\n\n";
        $message .= "<b>Status:</b> Bot berhasil terhubung dan siap menerima notifikasi";

        return static::sendMessageRaw($botToken, $channel->chat_id, $message);
    }

    /**
     * Uji koneksi Telegram Bot master (Synchronous untuk UI feedback)
     */
    /**
     * Kirim Laporan Pengukuran Redaman ODP ke Telegram Group beserta Foto Watermark Lapangan
     */
    public static function sendOdpCheckReport($measurement): array
    {
        try {
            $enabled = SystemSetting::get('telegram_enabled', env('TELEGRAM_ENABLED', 'false'));
            if ($enabled !== 'true' && $enabled !== true && $enabled !== '1') {
                return ['success' => false, 'message' => 'Integrasi Telegram tidak aktif.'];
            }

            $botToken = SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'));
            if (empty($botToken)) {
                return ['success' => false, 'message' => 'Token Bot Telegram belum dikonfigurasi.'];
            }

            $targetChatIds = static::getActiveChatIdsForTopic('INFRASTRUCTURE');
            if (empty($targetChatIds)) {
                $targetChatIds = static::getActiveChatIdsForTopic('NOC');
            }

            if (empty($targetChatIds)) {
                return ['success' => false, 'message' => 'Tidak ada Chat ID Telegram yang terdaftar.'];
            }

            $statusText = match ($measurement->power_status) {
                'good'     => 'BAIK / NORMAL',
                'warning'  => 'PERINGATAN / SEDANG',
                'critical' => 'KRITIS / REDAMAN TINGGI',
                default    => strtoupper($measurement->power_status ?? 'NORMAL'),
            };

            $timeStr = $measurement->created_at ? $measurement->created_at->format('d/m/Y H:i') . ' WIB' : now()->format('d/m/Y H:i') . ' WIB';
            $coords = ($measurement->latitude && $measurement->longitude)
                ? "{$measurement->latitude}, {$measurement->longitude}"
                : "Tidak tersedia";

            $caption = "<b>LAPORAN PENGUKURAN REDAMAN ODP</b>\n";
            $caption .= "━━━━━━━━━━━━━━━━━━━━\n";
            $caption .= "• <b>Nama / Label ODP:</b> <b>" . e($measurement->odp_name ?: $measurement->odp_code) . "</b>\n";
            $caption .= "• <b>Hasil Ukur OPM:</b> <b>" . e($measurement->power_measurement_dbm) . " dBm</b> [{$statusText}]\n";
            $caption .= "• <b>Koordinat GPS:</b> <code>{$coords}</code>\n";
            $caption .= "• <b>Petugas / Teknisi:</b> " . e($measurement->technician_name ?? 'Teknisi Lapangan') . "\n";
            $caption .= "• <b>Waktu Cek:</b> {$timeStr}\n";
            $caption .= "━━━━━━━━━━━━━━━━━━━━\n";
            $caption .= "<i>Verifikasi Lapangan Fiber-UNMS Enterprise</i>";

            // Kumpulkan file foto yang ada
            $photos = [];
            if (!empty($measurement->odp_photo_path) && file_exists(public_path($measurement->odp_photo_path))) {
                $photos[] = [
                    'path' => public_path($measurement->odp_photo_path),
                    'type' => 'Foto Fisik ODP'
                ];
            }
            if (!empty($measurement->opm_photo_path) && file_exists(public_path($measurement->opm_photo_path))) {
                $photos[] = [
                    'path' => public_path($measurement->opm_photo_path),
                    'type' => 'Foto Display OPM'
                ];
            }

            $successCount = 0;
            foreach ($targetChatIds as $chatId) {
                try {
                    if (count($photos) === 1) {
                        // Kirim 1 foto dengan caption lengkap
                        $res = Http::timeout(15)->attach(
                            'photo',
                            file_get_contents($photos[0]['path']),
                            basename($photos[0]['path'])
                        )->post("https://api.telegram.org/bot{$botToken}/sendPhoto", [
                            'chat_id'    => $chatId,
                            'caption'    => $caption,
                            'parse_mode' => 'HTML',
                        ]);
                        if ($res->successful()) $successCount++;
                    } elseif (count($photos) >= 2) {
                        // Kirim 2 foto dalam media group
                        $mediaGroup = [
                            [
                                'type'       => 'photo',
                                'media'      => 'attach://photo1',
                                'caption'    => $caption,
                                'parse_mode' => 'HTML'
                            ],
                            [
                                'type'       => 'photo',
                                'media'      => 'attach://photo2',
                            ]
                        ];
                        $req = Http::timeout(20)
                            ->attach('photo1', file_get_contents($photos[0]['path']), basename($photos[0]['path']))
                            ->attach('photo2', file_get_contents($photos[1]['path']), basename($photos[1]['path']));

                        $res = $req->post("https://api.telegram.org/bot{$botToken}/sendMediaGroup", [
                            'chat_id' => $chatId,
                            'media'   => json_encode($mediaGroup),
                        ]);
                        if ($res->successful()) $successCount++;
                    } else {
                        // Kirim pesan teks jika foto belum diunggah
                        $res = Http::timeout(10)->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                            'chat_id'    => $chatId,
                            'text'       => $caption,
                            'parse_mode' => 'HTML',
                        ]);
                        if ($res->successful()) $successCount++;
                    }
                } catch (\Throwable $e) {
                    Log::warning("Gagal mengirim laporan ODP ke Telegram Chat ID {$chatId}: " . $e->getMessage());
                }
            }

            return [
                'success'     => $successCount > 0,
                'sent_count'  => $successCount,
                'total_chats' => count($targetChatIds),
            ];
        } catch (\Throwable $e) {
            Log::error('sendOdpCheckReport Error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    public static function testConnection(string $botToken, string $chatId): array
    {
        $timeStr = now()->format('d/m/Y, H.i.s');

        $message = "<b>Uji Koneksi Bot Dispatcher UNMS</b>\n\n";
        $message .= "<b>Detail Konfigurasi:</b>\n";
        $message .= "• <b>Status:</b> Bot Telegram Berhasil Terhubung\n";
        $message .= "• <b>Sistem:</b> Fiber-UNMS Enterprise\n\n";
        $message .= "<b>Waktu:</b> {$timeStr}\n\n";
        $message .= "<b>Status:</b> Bot siap mendistribusikan notifikasi ke seluruh grup";

        return static::sendMessageRaw($botToken, $chatId, $message);
    }

    /**
     * Kirim pesan raw dengan exception handling cURL offline yang ramah
     */
    private static function sendMessageRaw(string $botToken, string $chatId, string $message): array
    {
        try {
            $response = Http::connectTimeout(3)->timeout(5)->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id'    => $chatId,
                'text'       => $message,
                'parse_mode' => 'HTML',
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Pesan pengujian berhasil dikirimkan ke Telegram.',
                ];
            } else {
                $err = json_decode($response->body(), true);
                return [
                    'success' => false,
                    'message' => 'Gagal mengirim ke Telegram: ' . ($err['description'] ?? 'Token atau Chat ID tidak valid'),
                ];
            }
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, 'Could not resolve host') || str_contains($msg, 'cURL error 6')) {
                $msg = 'Komputer/Server saat ini tidak terhubung ke jaringan Internet (Gagal menghubungkan ke api.telegram.org). Pastikan koneksi Internet di komputer Anda aktif.';
            }
            return [
                'success' => false,
                'message' => $msg,
            ];
        }
    }
}

