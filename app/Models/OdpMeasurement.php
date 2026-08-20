<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class OdpMeasurement extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'odp_measurements';

    protected $fillable = [
        'odp_node_id',
        'odp_code',
        'odp_name',
        'technician_id',
        'technician_name',
        'power_measurement_dbm',
        'power_status',
        'port_number',
        'odp_condition',
        'latitude',
        'longitude',
        'address_location',
        'notes',
        'odp_photo_path',
        'opm_photo_path',
        'forwarded_to_telegram',
        'telegram_sent_at',
    ];

    protected $casts = [
        'power_measurement_dbm' => 'decimal:2',
        'latitude'              => 'decimal:7',
        'longitude'             => 'decimal:7',
        'forwarded_to_telegram' => 'boolean',
        'telegram_sent_at'      => 'datetime',
    ];

    protected $appends = [
        'odp_photo_url',
        'opm_photo_url',
        'power_status_label',
    ];

    // ─── Accessors ─────────────────────────────────────────────────────────────

    public function getOdpPhotoUrlAttribute(): ?string
    {
        if (!$this->odp_photo_path) return null;
        return asset($this->odp_photo_path);
    }

    public function getOpmPhotoUrlAttribute(): ?string
    {
        if (!$this->opm_photo_path) return null;
        return asset($this->opm_photo_path);
    }

    public function getPowerStatusLabelAttribute(): string
    {
        return match ($this->power_status) {
            'good'     => 'Baik / Normal',
            'warning'  => 'Peringatan / Sedang',
            'critical' => 'Kritis / Redaman Tinggi',
            default    => 'Tidak Diketahui',
        };
    }

    // ─── Relationships ─────────────────────────────────────────────────────────

    public function odpNode()
    {
        return $this->belongsTo(NetworkNode::class, 'odp_node_id');
    }

    public function technician()
    {
        return $this->belongsTo(User::class, 'technician_id');
    }
}
