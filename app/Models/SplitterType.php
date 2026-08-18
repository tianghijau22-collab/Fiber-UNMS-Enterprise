<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SplitterType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'ratio', 'input_ports', 'output_ports', 'loss_db', 'description'];
}
