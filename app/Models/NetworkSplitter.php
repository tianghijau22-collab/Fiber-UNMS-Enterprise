<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NetworkSplitter extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'node_id',
        'splitter_type_id',
        'slot_position',
        'serial_number',
        'status',
        'installed_at',
        'notes',
    ];

    protected $casts = [
        'installed_at' => 'date',
    ];

    public function node()
    {
        return $this->belongsTo(NetworkNode::class, 'node_id');
    }

    public function splitterType()
    {
        return $this->belongsTo(SplitterType::class);
    }
}
