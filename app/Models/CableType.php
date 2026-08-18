<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CableType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'core_capacity', 'jacket_color', 'installation_type', 'description'];
}
