<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NetworkCable extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'cable_type_id',
        'from_node_id',
        'to_node_id',
        'length_meters',
        'core_count_total',
        'core_count_used',
        'installation_type',
        'route_description',
        'route_coordinates',
        'cable_color',
        'status',
        'installed_at',
        'notes',
    ];

    protected $casts = [
        'installed_at'       => 'date',
        'length_meters'      => 'decimal:2',
        'core_count_total'   => 'integer',
        'core_count_used'    => 'integer',
        'route_coordinates'  => 'array',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function cableType()
    {
        return $this->belongsTo(CableType::class);
    }

    public function fromNode()
    {
        return $this->belongsTo(NetworkNode::class, 'from_node_id');
    }

    public function toNode()
    {
        return $this->belongsTo(NetworkNode::class, 'to_node_id');
    }

    public function cores()
    {
        return $this->hasMany(NetworkCableCore::class, 'cable_id');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function availableCores(): int
    {
        return $this->core_count_total - $this->core_count_used;
    }
}
