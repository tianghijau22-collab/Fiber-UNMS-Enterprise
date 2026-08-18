<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Enums\CustomerStatus;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_number',
        'name',
        'nik',
        'phone',
        'email',
        'address',
        'province_id',
        'regency_id',
        'district_id',
        'village_id',
        'postal_code',
        'latitude',
        'longitude',
        'status',
        'customer_type',
        'id_card_photo',
        'house_photo',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'status' => CustomerStatus::class,
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

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

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function services()
    {
        return $this->hasMany(CustomerService::class);
    }

    public function activeService()
    {
        return $this->hasOne(CustomerService::class)->where('status', 'active')->latest();
    }

    public function surveys()
    {
        return $this->hasMany(ServiceSurvey::class);
    }

    public function contacts()
    {
        return $this->hasMany(CustomerContact::class);
    }

    public function notes()
    {
        return $this->hasMany(CustomerNote::class);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === CustomerStatus::ACTIVE;
    }

    public function isSuspended(): bool
    {
        return $this->status === CustomerStatus::SUSPENDED;
    }
}
