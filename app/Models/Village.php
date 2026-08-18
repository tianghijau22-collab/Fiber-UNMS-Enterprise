<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    use HasFactory;

    protected $fillable = ['district_id', 'code', 'name', 'postal_code'];

    public function district()
    {
        return $this->belongsTo(District::class);
    }
}
