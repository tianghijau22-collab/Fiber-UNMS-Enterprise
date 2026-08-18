<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Designation extends Model
{
    use HasFactory;

    protected $fillable = ['division_id', 'name', 'code', 'description'];

    public function division()
    {
        return $this->belongsTo(Division::class);
    }
}
