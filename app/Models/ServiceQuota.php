<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceQuota extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_service_id',
        'bandwidth_limit_kbps',
        'data_cap_gb',
    ];

    public function customerService()
    {
        return $this->belongsTo(CustomerService::class);
    }
}
