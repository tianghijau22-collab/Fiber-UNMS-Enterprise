<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\AppNotification;
use App\Models\PushSubscription;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

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
}
