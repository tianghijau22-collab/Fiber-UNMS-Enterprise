<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class OntRegistration extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_service_id',
        'olt_port_id',
        'onu_serial',
        'onu_mac',
        'onu_type',
        'profile_name',
        'vlan_id',
        'status',
        'registered_at',
        'last_online_at',
        'rx_power',
        'tx_power',
        'notes',
    ];

    protected $casts = [
        'registered_at'  => 'datetime',
        'last_online_at' => 'datetime',
        'rx_power'       => 'decimal:2',
        'tx_power'       => 'decimal:2',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function customerService()
    {
        return $this->belongsTo(CustomerService::class);
    }

    public function oltPort()
    {
        return $this->belongsTo(NetworkPort::class, 'olt_port_id');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isOnline(): bool
    {
        return $this->status === 'active'
            && $this->last_online_at
            && $this->last_online_at->diffInMinutes(now()) < 5;
    }

    /** Cek apakah level sinyal Rx dalam range normal (-8 s/d -27 dBm) */
    public function isRxPowerNormal(): bool
    {
        if ($this->rx_power === null) {
            return false;
        }
        return $this->rx_power >= -27 && $this->rx_power <= -8;
    }
}
