<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VlanAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_service_id',
        'vlan_id',
        'description',
    ];

    public function customerService()
    {
        return $this->belongsTo(CustomerService::class);
    }
}
