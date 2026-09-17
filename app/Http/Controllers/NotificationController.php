<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\AppNotification;
use App\Models\PushSubscription;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $userId = Auth::id();

        $notifications = AppNotification::query()
            ->where(function ($q) use ($userId) {
                $q->whereNull('user_id')
                  ->orWhere('user_id', $userId);
            })
            ->orderBy('created_at', 'desc')
            ->limit(30)
            ->get();

        $unreadCount = AppNotification::query()
            ->where(function ($q) use ($userId) {
                $q->whereNull('user_id')
                  ->orWhere('user_id', $userId);
            })
            ->where('is_read', false)
            ->count();

        return response()->json([
            'unread_count'  => $unreadCount,
            'notifications' => $notifications,
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $userId = Auth::id();
        $notification = AppNotification::query()
            ->where(function ($q) use ($userId) {
                $q->whereNull('user_id')
                  ->orWhere('user_id', $userId);
            })
            ->findOrFail($id);

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return response()->json(['message' => 'Notifikasi ditandai telah dibaca.', 'success' => true]);
    }

    public function markAllAsRead(Request $request)
    {
        $userId = Auth::id();

        AppNotification::query()
            ->where(function ($q) use ($userId) {
                $q->whereNull('user_id')
                  ->orWhere('user_id', $userId);
            })
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json(['message' => 'Semua notifikasi ditandai telah dibaca.', 'success' => true]);
    }

    public function destroy($id)
    {
        $notification = AppNotification::findOrFail($id);
        $notification->delete();

        return response()->json([
            'message' => 'Notifikasi berhasil dihapus.',
            'success' => true,
        ]);
    }

    public function clearAll()
    {
        AppNotification::query()->delete();

        return response()->json([
            'message' => 'Seluruh riwayat notifikasi berhasil dibersihkan.',
            'success' => true,
        ]);
    }

    public function pushSubscribe(Request $request)
    {
        $request->validate([
            'endpoint'    => 'required|string',
            'p256dh_key'  => 'nullable|string',
            'auth_token'  => 'nullable|string',
            'device_name' => 'nullable|string',
        ]);

        $userId = Auth::id();

        PushSubscription::updateOrCreate(
            [
                'user_id'  => $userId,
                'endpoint' => $request->endpoint,
            ],
            [
                'p256dh_key'  => $request->p256dh_key,
                'auth_token'  => $request->auth_token,
                'device_name' => $request->device_name ?: $request->header('User-Agent'),
            ]
        );

        return response()->json([
            'message' => 'Langganan notifikasi perangkat berhasil didaftarkan.',
            'success' => true,
        ]);
    }

    public function testPush(Request $request)
    {
        $userId = Auth::id();
        $userName = Auth::user()?->name ?: 'User';

        $notif = AppNotification::create([
            'user_id' => $userId,
            'type'    => 'NOC',
            'title'   => ' Notifikasi Tes Perangkat Berhasil!',
            'body'    => "Halo {$userName}, notifikasi sistem UNMS di perangkat " . ($request->header('User-Agent') ? 'Windows / Mobile' : 'Anda') . " telah aktif & berfungsi 100% normal.",
            'url'     => '/dashboard',
            'is_read' => false,
        ]);

        AuditLog::record(
            'TEST',
            'Pusat Notifikasi',
            "Pengguna {$userName} menguji notifikasi perangkat.",
            null,
            ['notification_id' => $notif->id]
        );

        return response()->json([
            'message'      => 'Notifikasi tes berhasil dikirim ke perangkat Anda.',
            'notification' => $notif,
            'success'      => true,
        ]);
    }

    public function broadcastMass(Request $request)
    {
        $request->validate([
            'title'       => 'required|string|max:255',
            'body'        => 'required|string',
            'type'        => 'required|string|in:NOC,SECURITY,BILLING,PROVISIONING',
            'target_role' => 'required|string',
            'url'         => 'nullable|string|max:255',
        ]);

        $senderName = Auth::user()?->name ?: 'Administrator';
        $targetRole = $request->target_role;
        $url        = $request->url ?: '/dashboard';

        if ($targetRole === 'ALL') {
            $notif = AppNotification::notifyAll(
                $request->title,
                $request->body,
                $request->type,
                $url
            );
            $targetCount = \App\Models\User::count();
        } else {
            $users = \App\Models\User::where('role', $targetRole)->get();
            $targetCount = $users->count();

            if ($targetCount === 0) {
                // If no users match role, send broadcast
                AppNotification::notifyAll(
                    $request->title,
                    $request->body,
                    $request->type,
                    $url
                );
                $targetCount = \App\Models\User::count();
            } else {
                foreach ($users as $u) {
                    AppNotification::notifyUser(
                        $u->id,
                        $request->title,
                        $request->body,
                        $request->type,
                        $url
                    );
                }
            }
        }

        AuditLog::record(
            'BROADCAST',
            'Pusat Notifikasi',
            "Pengiriman Notifikasi Massal oleh {$senderName}: {$request->title} (Target: {$targetRole})",
            null,
            [
                'title'       => $request->title,
                'type'        => $request->type,
                'target_role' => $targetRole,
                'recipients'  => $targetCount,
            ]
        );

        return response()->json([
            'message'           => "Notifikasi massal berhasil dikirimkan ke {$targetCount} pengguna!",
            'target_recipients' => $targetCount,
            'success'           => true,
        ]);
    }

    public function getTelegramConfig()
    {
        return response()->json([
            'telegram_enabled'   => \App\Models\SystemSetting::get('telegram_enabled', 'false') === 'true',
            'telegram_bot_token' => \App\Models\SystemSetting::get('telegram_bot_token', ''),
            'telegram_chat_id'   => \App\Models\SystemSetting::get('telegram_chat_id', ''),
        ]);
    }

    public function saveTelegramConfig(Request $request)
    {
        $request->validate([
            'telegram_enabled'   => 'required|boolean',
            'telegram_bot_token' => 'nullable|string',
            'telegram_chat_id'   => 'nullable|string',
        ]);

        \App\Models\SystemSetting::set('telegram_enabled', $request->telegram_enabled ? 'true' : 'false');
        \App\Models\SystemSetting::set('telegram_bot_token', $request->telegram_bot_token ?: '');
        \App\Models\SystemSetting::set('telegram_chat_id', $request->telegram_chat_id ?: '');

        return response()->json([
            'message' => 'Konfigurasi Bot Telegram berhasil disimpan.',
            'success' => true,
        ]);
    }

    public function testTelegramConnection(Request $request)
    {
        $botToken = $request->telegram_bot_token ?: \App\Models\SystemSetting::get('telegram_bot_token');
        $chatId   = $request->telegram_chat_id ?: \App\Models\SystemSetting::get('telegram_chat_id');

        if (empty($botToken) || empty($chatId)) {
            return response()->json([
                'success' => false,
                'message' => 'Silakan isi Bot Token dan Chat ID Telegram terlebih dahulu.',
            ], 422);
        }

        $result = \App\Services\TelegramService::testConnection($botToken, $chatId);

        return response()->json($result);
    }

    // ─── Multi-Channel Telegram Groups Management ────────────────────────────

    public function getChannels()
    {
        $channels = \App\Models\TelegramChannel::orderBy('id', 'asc')->get();
        return response()->json([
            'channels'         => $channels,
            'available_topics' => \App\Models\TelegramChannel::AVAILABLE_TOPICS,
        ]);
    }

    public function storeChannel(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'chat_id'     => 'required|string|max:100',
            'topics'      => 'nullable|array',
            'is_active'   => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $channel = \App\Models\TelegramChannel::create([
            'name'        => $validated['name'],
            'chat_id'     => trim($validated['chat_id']),
            'topics'      => $validated['topics'] ?? ['NOC', 'TICKET', 'CUSTOMER', 'INFRASTRUCTURE', 'OLT_MGMT', 'USER_MGMT', 'BROADCAST', 'BILLING'],
            'is_active'   => $validated['is_active'] ?? true,
            'description' => $validated['description'] ?? null,
        ]);

        AuditLog::record(
            'CREATE',
            'Pusat Notifikasi',
            "Menambahkan grup channel Telegram baru: {$channel->name} ({$channel->chat_id})",
            null,
            $channel->toArray()
        );

        return response()->json([
            'message' => "Grup Telegram {$channel->name} berhasil ditambahkan!",
            'channel' => $channel,
            'success' => true,
        ], 201);
    }

    public function updateChannel(Request $request, $id)
    {
        $channel = \App\Models\TelegramChannel::findOrFail($id);

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'chat_id'     => 'required|string|max:100',
            'topics'      => 'nullable|array',
            'is_active'   => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $old = $channel->toArray();

        $channel->update([
            'name'        => $validated['name'],
            'chat_id'     => trim($validated['chat_id']),
            'topics'      => $validated['topics'] ?? [],
            'is_active'   => $validated['is_active'] ?? $channel->is_active,
            'description' => $validated['description'] ?? null,
        ]);

        AuditLog::record(
            'UPDATE',
            'Pusat Notifikasi',
            "Memperbarui grup channel Telegram: {$channel->name} ({$channel->chat_id})",
            $old,
            $channel->toArray()
        );

        return response()->json([
            'message' => "Grup Telegram {$channel->name} berhasil diperbarui!",
            'channel' => $channel,
            'success' => true,
        ]);
    }

    public function deleteChannel($id)
    {
        $channel = \App\Models\TelegramChannel::findOrFail($id);
        $name    = $channel->name;
        $chatId  = $channel->chat_id;
        $channel->delete();

        AuditLog::record(
            'DELETE',
            'Pusat Notifikasi',
            "Menghapus grup channel Telegram: {$name} ({$chatId})",
            ['name' => $name, 'chat_id' => $chatId]
        );

        return response()->json([
            'message' => "Grup Telegram {$name} berhasil dihapus.",
            'success' => true,
        ]);
    }

    public function testChannel($id)
    {
        $channel = \App\Models\TelegramChannel::findOrFail($id);
        $result  = \App\Services\TelegramService::testChannel($channel);

        return response()->json($result);
    }

    /**
     * Mengambil feed pesan alert sistem dengan format teks Telegram & metadata lengkap
     */
    public function getAlertFeed(Request $request)
    {
        Carbon::setLocale('id');

        $type = $request->query('type', 'ALL');
        $search = $request->query('search', '');
        $limit = (int)$request->query('limit', 50);
        if ($limit < 10) $limit = 10;
        if ($limit > 100) $limit = 100;

        $query = AppNotification::query()
            ->orderBy('created_at', 'desc');

        if ($type !== 'ALL') {
            if ($type === 'OUTAGE') {
                $query->where(function ($q) {
                    $q->where('title', 'like', '%GANGGUAN MASSAL%')
                      ->orWhere('title', 'like', '%ALARM%')
                      ->orWhere('title', 'like', '%LOS%')
                      ->orWhere('title', 'like', '%DOWN%');
                });
            } elseif ($type === 'RECOVERY') {
                $query->where(function ($q) {
                    $q->where('title', 'like', '%PEMULIHAN%')
                      ->orWhere('title', 'like', '%PULIH%')
                      ->orWhere('title', 'like', '%RECOVERY%');
                });
            } elseif ($type === 'TRAP') {
                $query->where(function ($q) {
                    $q->where('icon', 'SNMP_TRAP')
                      ->orWhere('body', 'like', '%SNMP Trap%')
                      ->orWhere('body', 'like', '%#TRAP%');
                });
            } elseif ($type === 'POLL') {
                $query->where(function ($q) {
                    $q->where('icon', 'POLL_TELEMETRY')
                      ->orWhere('body', 'like', '%Jalur Prioritas Cepat%')
                      ->orWhere('body', 'like', '%FLAPPING%')
                      ->orWhere('body', 'like', '%#POLL%');
                });
            } else {
                $query->where('type', $type);
            }
        }

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('body', 'like', "%{$search}%");
            });
        }

        $notifications = $query->limit($limit)->get();

        // Format pesan agar teks persis dengan format Telegram
        $formatted = $notifications->map(function ($n) {
            $createdCarbon = Carbon::parse($n->created_at);
            $timeStr = $createdCarbon->format('d/m/Y, H.i.s');
            
            // Resolusi identitas sumber: SNMP Trap vs Polling Telemetri
            $source = $n->icon;
            if (!$source || $source === 'NOC' || $source === 'SYSTEM') {
                if (str_contains($n->body, 'SNMP Trap') || str_contains($n->title, 'SNMP Trap') || str_contains($n->body, '#TRAP')) {
                    $source = 'SNMP_TRAP';
                } elseif (str_contains($n->body, 'Jalur Prioritas Cepat') || str_contains($n->title, 'FLAPPING') || str_contains($n->body, '#POLL') || str_contains($n->body, 'redaman jatuh ke -40.00 dBm')) {
                    $source = 'POLL_TELEMETRY';
                } else {
                    $source = 'SYSTEM';
                }
            }

            $sourceLabel = match($source) {
                'SNMP_TRAP'      => '⚡ SNMP Trap Engine (Realtime Event)',
                'POLL_TELEMETRY' => '🔄 Polling Telemetri Daemon',
                default          => '🖥️ Sistem Otomatis UNMS',
            };

            $sourceCode = match($source) {
                'SNMP_TRAP'      => '#TRAP',
                'POLL_TELEMETRY' => '#POLL',
                default          => '#UNMS',
            };

            $sourceShortBadge = match($source) {
                'SNMP_TRAP'      => 'SNMP TRAP',
                'POLL_TELEMETRY' => 'POLLING TELEMETRI',
                default          => 'SISTEM UNMS',
            };

            // Bersihkan format lama (hapus Diagnosa NOC, Tindakan, ODC Induk, dan footer lama)
            $cleanBody = $n->body;
            $cleanBody = preg_replace('/\n*────────────────────────────\n.*$/s', '', $cleanBody);
            $cleanBody = preg_replace('/\n*<b>Diagnosa NOC:<\/b>.*?(?=\n\n|\z|\n<b>)/s', '', $cleanBody);
            $cleanBody = preg_replace('/\n*<b>Tindakan:<\/b>.*?(?=\n\n|\z|\n<b>)/s', '', $cleanBody);
            $cleanBody = preg_replace('/<b>• ODC Induk:<\/b>.*?\n/', '', $cleanBody);
            $cleanBody = preg_replace('/\n*<code>\[#(?:POLL|TRAP|UNMS)\]<\/code>$/s', '', $cleanBody);
            $cleanBody = trim($cleanBody);
            $cleanBody = str_replace('JALUR TRANSMISI UTAMA PULIH NORMAL', 'JALUR ON', $cleanBody);
            $cleanBody = str_replace('Kabel Feeder Putus / SFP Port Down', 'Kabel Putus / Masalah lainnya', $cleanBody);

            // Cukup tampilkan kode [#POLL] atau [#TRAP] di bagian paling bawah
            $cardBody = $cleanBody . "\n\n<code>[{$sourceCode}]</code>";

            // Format pesan utuh persis Telegram untuk fitur copy clipboard
            $telegramText = "<b>" . htmlspecialchars($n->title, ENT_QUOTES, 'UTF-8') . "</b>\n";
            $telegramText .= "────────────────────────────\n\n";
            $telegramText .= $cardBody;

            $isRecovery = str_contains($n->title, 'PEMULIHAN') || str_contains($n->title, 'PULIH') || str_contains($n->title, 'RECOVERY') || str_contains($n->title, 'NORMAL') || str_contains($n->title, 'RESTORED');
            $isOutage = !$isRecovery && (str_contains($n->title, 'GANGGUAN') || str_contains($n->title, 'ALARM') || str_contains($n->title, 'LOS') || str_contains($n->title, 'DOWN') || str_contains($n->title, 'PUTUS') || str_contains($n->title, 'DYING GASP') || str_contains($n->title, 'CRITICAL'));

            return [
                'id'                 => $n->id,
                'type'               => $n->type,
                'source'             => $source,
                'source_code'        => $sourceCode,
                'source_label'       => $sourceLabel,
                'source_short_badge' => $sourceShortBadge,
                'title'              => $n->title,
                'body'               => $cardBody,
                'url'                => $n->url,
                'is_read'            => (bool)$n->is_read,
                'created_at'         => $n->created_at->toIso8601String(),
                'time_human'         => $createdCarbon->format('H:i'),
                'time_seconds'       => $createdCarbon->format('H:i:s'),
                'date_human'         => $createdCarbon->isoFormat('D MMMM Y'),
                'datetime_human'     => $createdCarbon->format('d/m/Y H:i:s'),
                'is_outage'          => $isOutage,
                'is_recovery'        => $isRecovery,
                'level'              => $isRecovery ? 'recovery' : ($isOutage ? 'critical' : 'info'),
                'telegram_text'      => $telegramText,
            ];
        });

        // Metrik Statistik
        $todayStart = now()->startOfDay();
        $totalToday = AppNotification::where('created_at', '>=', $todayStart)->count();
        $outagesToday = AppNotification::where('created_at', '>=', $todayStart)
            ->where(function ($q) {
                $q->where('title', 'like', '%GANGGUAN%')
                  ->orWhere('title', 'like', '%ALARM%')
                  ->orWhere('title', 'like', '%LOS%')
                  ->orWhere('title', 'like', '%DOWN%');
            })
            ->where('title', 'not like', '%PEMULIHAN%')
            ->where('title', 'not like', '%PULIH%')
            ->count();
        $recoveryToday = AppNotification::where('created_at', '>=', $todayStart)
            ->where(function ($q) {
                $q->where('title', 'like', '%PEMULIHAN%')
                  ->orWhere('title', 'like', '%PULIH%')
                  ->orWhere('title', 'like', '%RECOVERY%');
            })->count();

        $lastNotif = AppNotification::latest('created_at')->first();

        return response()->json([
            'status'   => 'success',
            'messages' => $formatted,
            'stats'    => [
                'total_all'        => AppNotification::count(),
                'total_today'      => $totalToday,
                'outages_today'    => $outagesToday,
                'recovery_today'   => $recoveryToday,
                'last_alert_at'    => $lastNotif?->created_at?->toIso8601String(),
                'last_alert_ago'   => $lastNotif ? Carbon::parse($lastNotif->created_at)->diffForHumans() : 'Belum ada',
            ],
            'bot_info' => [
                'name'     => 'Fiber-UNMS NOC Alert Bot',
                'username' => '@FiberUNMS_NOC_bot',
                'status'   => 'ONLINE',
            ],
        ]);
    }

    /**
     * Bersihkan seluruh pesan feed notifikasi alert sistem
     */
    public function clearAlertFeed()
    {
        AppNotification::query()->delete();
        return response()->json([
            'status'  => 'success',
            'message' => 'Seluruh riwayat pesan alert sistem berhasil dibersihkan.',
        ]);
    }
}
