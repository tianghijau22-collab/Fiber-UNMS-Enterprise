<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NetworkNode extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'node_type',
        'device_type_id',
        'brand_id',
        'model',
        'serial_number',
        'status',
        'latitude',
        'longitude',
        'address',
        'province_id',
        'regency_id',
        'district_id',
        'village_id',
        'parent_node_id',
        'olt_device_id',
        'splitter_type_id',
        'splitter_cascade_level',
        'olt_port_ref',
        'total_ports',
        'used_ports',
        'installed_at',
        'notes',
        'core_power',
        'core_color',
        'splitter_config',
        'tube_count',
        'tube_info',
        'splitter_count',
        'odc_topology_type',
        'created_by',
    ];

    protected $casts = [
        'latitude'               => 'decimal:7',
        'longitude'              => 'decimal:7',
        'installed_at'           => 'date',
        'total_ports'            => 'integer',
        'used_ports'             => 'integer',
        'splitter_cascade_level' => 'integer',
        'splitter_config'        => 'array',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function oltDevice()
    {
        return $this->belongsTo(OltDevice::class, 'olt_device_id');
    }

    public function deviceType()
    {
        return $this->belongsTo(DeviceType::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function province()
    {
        return $this->belongsTo(Province::class);
    }

    public function regency()
    {
        return $this->belongsTo(Regency::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }

    /** Node induk (misal: ODC induk ODP ini) */
    public function parent()
    {
        return $this->belongsTo(NetworkNode::class, 'parent_node_id');
    }

    /** Node-node anak di bawah node ini */
    public function children()
    {
        return $this->hasMany(NetworkNode::class, 'parent_node_id');
    }

    public function ports()
    {
        return $this->hasMany(NetworkPort::class, 'node_id');
    }

    public function splitters()
    {
        return $this->hasMany(NetworkSplitter::class, 'node_id');
    }

    /** Tipe splitter pasif yang terpasang di node ini (PLC 1:2, 1:4, 1:8, dll) */
    public function splitterType()
    {
        return $this->belongsTo(\App\Models\SplitterType::class, 'splitter_type_id');
    }

    /** Kabel yang berangkat dari node ini */
    public function cablesFrom()
    {
        return $this->hasMany(NetworkCable::class, 'from_node_id');
    }

    /** Kabel yang menuju node ini */
    public function cablesTo()
    {
        return $this->hasMany(NetworkCable::class, 'to_node_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function availablePorts(): int
    {
        return $this->total_ports - $this->used_ports;
    }

    public function isOlt(): bool
    {
        return $this->node_type === 'OLT';
    }
}
