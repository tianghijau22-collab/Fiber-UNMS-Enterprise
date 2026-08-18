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
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Kirim notifikasi siaran (Broadcast) ke SELURUH USER di sistem
     */
    public static function notifyAll(string $title, string $body, string $type = 'NOC', ?string $url = null, ?string $icon = null): self
    {
        $notif = self::create([
            'user_id' => null, // null = broadcast ke seluruh user
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'url'     => $url,
            'icon'    => $icon,
            'is_read' => false,
        ]);

        // Otomatis sinkronisasi kirim ke Telegram Bot jika diaktifkan
        \App\Services\TelegramService::send($title, $body, $type, $url);

        return $notif;
    }

    /**
     * Kirim notifikasi khusus ke 1 user tertentu
     */
    public static function notifyUser(int $userId, string $title, string $body, string $type = 'NOC', ?string $url = null, ?string $icon = null): self
    {
        $notif = self::create([
            'user_id' => $userId,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'url'     => $url,
            'icon'    => $icon,
            'is_read' => false,
        ]);

        // Otomatis sinkronisasi kirim ke Telegram Bot jika diaktifkan
        \App\Services\TelegramService::send($title, $body, $type, $url);

        return $notif;
    }
}
