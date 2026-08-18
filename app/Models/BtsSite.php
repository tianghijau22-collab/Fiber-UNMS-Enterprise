<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BtsSite extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'bts_sites';

    protected $fillable = [
        'name',
        'link_segment',
        'code',
        'measurement_date',
        'sfp_sm_link_length',
        'sfp_vendor',
        'tx_power',
        'rx_power',
        'cable_length_km',
        'tube_number',
        'tube_color',
        'core_number',
        'core_color',
        'latitude',
        'longitude',
        'address',
        'mikrotik_ip',
        'sfp_port_name',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'measurement_date' => 'date:Y-m-d',
        'tx_power'         => 'decimal:3',
        'rx_power'         => 'decimal:3',
        'cable_length_km'  => 'decimal:2',
        'tube_number'      => 'integer',
        'core_number'      => 'integer',
        'latitude'         => 'decimal:7',
        'longitude'        => 'decimal:7',
    ];

    protected $appends = [
        'optical_status',
        'formatted_date',
        'google_maps_url',
    ];

    /**
     * Evaluasi status kualitas sinyal optik berdasarkan Rx Power (Redaman)
     * - Bagus / Optimal: -5 dBm s/d -22 dBm
     * - Waspada / Warning: -23 dBm s/d -26 dBm
     * - Kritis / High Loss: < -26 dBm
     */
    public function getOpticalStatusAttribute(): string
    {
        if ($this->rx_power === null) {
            return 'unknown';
        }

        $val = (float) $this->rx_power;
        if ($val >= -22.0) {
            return 'good';
        } elseif ($val >= -26.0) {
            return 'warning';
        } else {
            return 'critical';
        }
    }

    public function getFormattedDateAttribute(): string
    {
        return $this->measurement_date ? $this->measurement_date->format('d-m-Y') : date('d-m-Y');
    }

    public function getGoogleMapsUrlAttribute(): ?string
    {
        if ($this->latitude && $this->longitude) {
            return "https://www.google.com/maps?q={$this->latitude},{$this->longitude}";
        }
        return null;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Sinkronisasi record BTS ke network_nodes agar OTDR Tracing dan Peta GIS mengenali BTS ini
     */
    public function syncToNetworkNode(): void
    {
        if (!$this->latitude || !$this->longitude) {
            return;
        }

        NetworkNode::updateOrCreate(
            ['code' => $this->code],
            [
                'name'         => $this->name,
                'node_type'    => 'BTS',
                'latitude'     => $this->latitude,
                'longitude'    => $this->longitude,
                'address'      => $this->address ?? $this->link_segment ?? "Site BTS {$this->name}",
                'status'       => $this->optical_status === 'critical' ? 'maintenance' : 'active',
                'core_power'   => $this->rx_power !== null ? "{$this->rx_power} dBm" : null,
                'core_color'   => $this->core_color,
                'tube_info'    => "Tube {$this->tube_number} ({$this->tube_color})",
                'notes'        => "BTS FO Link: {$this->link_segment} | SFP: {$this->sfp_vendor} ({$this->sfp_sm_link_length}) | Tx: {$this->tx_power} dBm, Rx: {$this->rx_power} dBm | Jarak: {$this->cable_length_km} Km",
            ]
        );
    }
}
