<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PopupAlert extends Model
{
    use HasFactory;

    protected $table = 'popup_alerts';

    protected $fillable = [
        'title',
        'message',
        'image_url',
        'type',
        'badge_text',
        'target_roles',
        'is_active',
        'show_once_per_user',
        'starts_at',
        'expires_at',
        'action_button_text',
        'action_button_url',
        'created_by',
        'created_by_name',
    ];

    protected $casts = [
        'target_roles'       => 'array',
        'is_active'          => 'boolean',
        'show_once_per_user' => 'boolean',
        'starts_at'          => 'datetime',
        'expires_at'         => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
