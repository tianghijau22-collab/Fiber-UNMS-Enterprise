<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NetworkPort extends Model
{
    use HasFactory;

    protected $fillable = [
        'node_id',
        'port_number',
        'port_type',
        'status',
        'connected_to_port_id',
        'customer_service_id',
        'destination_label',
        'customer_name_cache',
        'notes',
    ];

    protected static function booted()
    {
        static::saved(function ($port) {
            if ($port->node_id) {
                static::recalculateNodeUsedPorts($port->node_id);
            }
        });

        static::deleted(function ($port) {
            if ($port->node_id) {
                static::recalculateNodeUsedPorts($port->node_id);
            }
        });
    }

    /**
     * Recalculate used_ports for a node and update port status based on assignments.
     */
    public static function recalculateNodeUsedPorts($nodeId)
    {
        if (!$nodeId) return;

        $node = NetworkNode::find($nodeId);
        if (!$node) return;

        // Reset port status to available if no customer, label, or cache exists
        static::where('node_id', $nodeId)
            ->whereNull('customer_service_id')
            ->where(function ($q) {
                $q->whereNull('customer_name_cache')->orWhere('customer_name_cache', '');
            })
            ->where(function ($q) {
                $q->whereNull('destination_label')->orWhere('destination_label', '');
            })
            ->update(['status' => 'available']);

        // Set status to used if customer service, cache name, or destination label exists
        static::where('node_id', $nodeId)
            ->where(function ($q) {
                $q->whereNotNull('customer_service_id')
                  ->orWhere(function ($q2) {
                      $q2->whereNotNull('customer_name_cache')->where('customer_name_cache', '!=', '');
                  })
                  ->orWhere(function ($q3) {
                      $q3->whereNotNull('destination_label')->where('destination_label', '!=', '');
                  });
            })
            ->update(['status' => 'used']);

        // Count exact used ports
        $usedCount = static::where('node_id', $nodeId)
            ->where('status', 'used')
            ->count();

        $node->update(['used_ports' => $usedCount]);
    }

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function node()
    {
        return $this->belongsTo(NetworkNode::class, 'node_id');
    }

    /** Port lawan yang terhubung (patch cord / splicing) */
    public function connectedTo()
    {
        return $this->belongsTo(NetworkPort::class, 'connected_to_port_id');
    }

    public function connectedFrom()
    {
        return $this->hasMany(NetworkPort::class, 'connected_to_port_id');
    }

    public function ontRegistrations()
    {
        return $this->hasMany(OntRegistration::class, 'olt_port_id');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isAvailable(): bool
    {
        return $this->status === 'available';
    }
}
