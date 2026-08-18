<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PppoeProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'service_package_id',
        'max_rate_kbps',
        'burst_kbps',
        'access_type',
        'description',
    ];

    public function servicePackage()
    {
        return $this->belongsTo(ServicePackage::class);
    }
}
