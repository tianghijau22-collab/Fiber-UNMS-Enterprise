<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_name',
        'user_role',
        'action',
        'module',
        'description',
        'ip_address',
        'user_agent',
        'old_values',
        'new_values',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Static helper for clean enterprise audit log recording.
     */
    public static function record($action, $module, $description, $oldValues = null, $newValues = null)
    {
        $user = auth()->user();

        $headerUserId   = request()->header('X-User-Id');
        $headerUserName = request()->header('X-User-Name');
        $headerUserRole = request()->header('X-User-Role');

        if (!$user && $headerUserId) {
            $user = User::find($headerUserId);
        }

        $userName = $user ? $user->name : ($headerUserName ?: 'Super Administrator');
        $userRole = $user ? $user->role : ($headerUserRole ?: 'Super Administrator');
        $userId   = $user ? $user->id   : ($headerUserId ? (int)$headerUserId : null);
        $ip       = request()->ip() ?? '127.0.0.1';

        $log = static::create([
            'user_id'     => $userId,
            'user_name'   => $userName,
            'user_role'   => $userRole,
            'action'      => strtoupper($action),
            'module'      => $module,
            'description' => $description,
            'ip_address'  => $ip,
            'user_agent'  => request()->userAgent() ?? 'Fiber-UNMS Enterprise App',
            'old_values'  => $oldValues,
            'new_values'  => $newValues,
        ]);

        // Otomatis sinkronisasi kirim aktivitas ke Telegram Bot
        \App\Services\TelegramService::sendAuditLog(
            $action,
            $module,
            $description,
            $userName,
            $userRole,
            $ip,
            $oldValues,
            $newValues
        );

        return $log;
    }
}
