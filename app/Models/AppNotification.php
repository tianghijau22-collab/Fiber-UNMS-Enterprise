<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AppNotification extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'system_notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'url',
        'icon',
        'image_url',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    public function getImageUrlAttribute($value)
    {
        if (!$value) {
            return null;
        }
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return url(ltrim($value, '/'));
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Kirim notifikasi siaran (Broadcast) ke SELURUH USER di sistem
     * ATURAN KETAT: Notifikasi siaran / Push FCM / Telegram HANYA diizinkan untuk:
     * 1. Notifikasi Massal (BROADCAST / ANNOUNCEMENT / MAINTENANCE)
     * 2. Gangguan Interface Massal (MASS_OUTAGE / MASS_RECOVERY Interface)
     * 3. Gangguan ODP Massal (MASS_OUTAGE / MASS_RECOVERY ODP)
     * Notifikasi perorangan / modem individual / flap individual DITOLAK.
     */
    public static function notifyAll(
        string $title,
        string $body,
        string $type = 'NOC',
        ?string $url = null,
        ?string $icon = null,
        bool $sendTelegram = true,
        ?string $source = null,
        ?string $imageUrl = null
    ): ?self {
        $upperType = strtoupper($type);
        $upperTitle = strtoupper($title);

        // Filter Penolak Notifikasi Individual / Modem Tunggal
        $isIndividualReject = in_array($upperType, ['TRAP_INDIVIDUAL', 'INDIVIDUAL', 'POLL', 'SNMP'])
            || str_contains($upperTitle, 'SUDDEN LOSS: MODEM')
            || str_contains($upperTitle, 'RECOVERY: MODEM')
            || str_contains($upperTitle, 'FLAPPING: MODEM')
            || str_contains($upperTitle, 'ALARM GANGGUAN: MODEM')
            || str_contains($upperTitle, 'PEMULIHAN LAYANAN: MODEM')
            || str_contains($upperTitle, 'MODEM PELANGGAN');

        if ($isIndividualReject) {
            \Illuminate\Support\Facades\Log::info("AppNotification::notifyAll ditolak karena merupakan notifikasi perorangan: {$title}");
            return null;
        }

        // Whitelist Notifikasi yang Diizinkan
        $isAllowed = in_array($upperType, ['MASS_OUTAGE', 'MASS_RECOVERY', 'BROADCAST', 'ANNOUNCEMENT', 'MAINTENANCE', 'SYSTEM_MAINTENANCE', 'GLOBAL'])
            || str_contains($upperTitle, 'GANGGUAN MASSAL')
            || str_contains($upperTitle, 'PEMULIHAN GANGGUAN MASSAL')
            || str_contains($upperTitle, 'PEMELIHARAAN')
            || str_contains($upperTitle, 'SIARAN')
            || str_contains($upperTitle, 'DISPATCH TIM MAINTENANCE OTDR');

        if (!$isAllowed) {
            \Illuminate\Support\Facades\Log::info("AppNotification::notifyAll ditolak karena bukan tipe gangguan massal / siaran: [{$type}] {$title}");
            return null;
        }

        if (!$source) {
            $cmd = implode(' ', $_SERVER['argv'] ?? []);
            if (str_contains($cmd, 'olt:listen-events') || str_contains($cmd, 'ListenOltEvents') || str_contains($body, 'via SNMP Trap')) {
                $source = 'SNMP_TRAP';
            } elseif (str_contains($cmd, 'olt:poll-telemetry') || str_contains($cmd, 'PollOltTelemetry')) {
                $source = 'POLL_TELEMETRY';
            } else {
                $source = 'SYSTEM';
            }
        }

        $icon = $icon ?: $source;

        $notif = self::create([
            'user_id'   => null, // null = broadcast ke seluruh user
            'type'      => $type,
            'title'     => $title,
            'body'      => $body,
            'url'       => $url,
            'icon'      => $icon,
            'image_url' => $imageUrl,
            'is_read'   => false,
        ]);

        // Otomatis sinkronisasi kirim ke Telegram Bot jika diaktifkan (Eksklusif Gangguan Massal)
        if ($sendTelegram) {
            \App\Services\TelegramService::send($title, $body, $type, $url, $source);
        }

        // Otomatis kirim FCM Push Notification ke seluruh perangkat mobile FONA
        try {
            \App\Services\FcmService::sendTopicNotification(
                'fona_global_alerts',
                $title,
                strip_tags(preg_replace('/<[^>]*>/', ' ', $body)),
                $type,
                $url,
                [],
                $imageUrl
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("FCM Broadcast Warning: " . $e->getMessage());
        }

        return $notif;
    }

    /**
     * Kirim notifikasi khusus ke 1 user tertentu
     */
    public static function notifyUser(
        int $userId,
        string $title,
        string $body,
        string $type = 'NOC',
        ?string $url = null,
        ?string $icon = null,
        ?string $source = null,
        ?string $imageUrl = null
    ): self {
        if (!$source) {
            $source = 'SYSTEM';
        }
        $icon = $icon ?: $source;

        $notif = self::create([
            'user_id'   => $userId,
            'type'      => $type,
            'title'     => $title,
            'body'      => $body,
            'url'       => $url,
            'icon'      => $icon,
            'image_url' => $imageUrl,
            'is_read'   => false,
        ]);

        // Otomatis sinkronisasi kirim ke Telegram Bot jika diaktifkan
        \App\Services\TelegramService::send($title, $body, $type, $url, $source);

        // Kirim FCM ke perangkat spesifik jika memiliki token
        try {
            $subscriptions = \App\Models\PushSubscription::where('user_id', $userId)->get();
            foreach ($subscriptions as $sub) {
                if (str_starts_with($sub->endpoint, 'fcm:')) {
                    $token = str_replace('fcm:', '', $sub->endpoint);
                    \App\Services\FcmService::sendToDevice(
                        $token,
                        $title,
                        strip_tags(preg_replace('/<[^>]*>/', ' ', $body)),
                        $type,
                        $url,
                        [],
                        $imageUrl
                    );
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("FCM User Push Warning: " . $e->getMessage());
        }

        return $notif;
    }
}
