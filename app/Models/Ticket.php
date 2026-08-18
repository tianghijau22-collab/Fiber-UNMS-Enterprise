<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'title',
        'description',
        'category',
        'priority',
        'status',
        'customer_id',
        'network_node_id',
        'network_cable_id',
        'technician_name',
        'dispatch_team',
        'initial_power_dbm',
        'final_power_dbm',
        'materials_used',
        'timeline_logs',
        'sla_deadline',
        'is_sla_breached',
        'resolution_notes',
        'resolved_at',
    ];

    protected $casts = [
        'materials_used'  => 'array',
        'timeline_logs'   => 'array',
        'sla_deadline'    => 'datetime',
        'resolved_at'     => 'datetime',
        'is_sla_breached' => 'boolean',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function networkNode()
    {
        return $this->belongsTo(NetworkNode::class);
    }

    public function networkCable()
    {
        return $this->belongsTo(NetworkCable::class);
    }

    public function isOverdue(): bool
    {
        if ($this->status === 'Resolved' || $this->status === 'Closed') {
            return false;
        }
        return $this->sla_deadline && now()->greaterThan($this->sla_deadline);
    }
}
