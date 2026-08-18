<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VoiceCall extends Model
{
    use HasFactory;

    protected $fillable = [
        'caller_id',
        'receiver_id',
        'status',
        'sdp_offer',
        'sdp_answer',
        'caller_ice',
        'receiver_ice',
        'started_at',
        'ended_at',
        'duration_seconds',
    ];

    protected $casts = [
        'caller_ice'   => 'array',
        'receiver_ice' => 'array',
        'started_at'   => 'datetime',
        'ended_at'     => 'datetime',
    ];

    public function caller()
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }
}
