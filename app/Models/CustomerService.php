<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerService extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'service_number',
        'customer_id',
        'service_package_id',
        'status',
        'installation_date',
        'activated_at',
        'terminated_at',
        'onu_serial',
        'onu_mac',
        'pppoe_username',
        'pppoe_password',
        'ip_address',
        'installation_notes',
        'installed_by',
    ];

    protected $casts = [
        'installation_date' => 'date',
        'activated_at'      => 'date',
        'terminated_at'     => 'date',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class);
    }

    public function installedBy()
    {
        return $this->belongsTo(User::class, 'installed_by');
    }

    public function networkPort()
    {
        return $this->hasOne(NetworkPort::class, 'customer_service_id');
    }

    public function ontRegistration()
    {
        return $this->hasOne(OntRegistration::class, 'customer_service_id');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }
}
