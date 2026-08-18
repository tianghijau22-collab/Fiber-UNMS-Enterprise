<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceSurvey extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'survey_number',
        'customer_id',
        'surveyor_id',
        'scheduled_at',
        'completed_at',
        'status',
        'latitude',
        'longitude',
        'location_notes',
        'is_feasible',
        'feasibility_notes',
        'estimated_cable_meters',
        'obstacles',
    ];

    protected $casts = [
        'scheduled_at'   => 'datetime',
        'completed_at'   => 'datetime',
        'is_feasible'    => 'boolean',
        'latitude'       => 'decimal:7',
        'longitude'      => 'decimal:7',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function surveyor()
    {
        return $this->belongsTo(User::class, 'surveyor_id');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFeasible(): bool
    {
        return (bool) $this->is_feasible;
    }
}
