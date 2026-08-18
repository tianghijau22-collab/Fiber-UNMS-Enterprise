<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NetworkCableCore extends Model
{
    use HasFactory;

    protected $fillable = [
        'cable_id',
        'core_number',
        'tube_number',
        'tube_color',
        'color',
        'status',
        'destination_type',
        'destination_name',
        'destination_node_id',
        'odf_cassette_label',
        'customer_service_id',
        'notes',
    ];

    public function cable()
    {
        return $this->belongsTo(NetworkCable::class, 'cable_id');
    }

    public function destinationNode()
    {
        return $this->belongsTo(NetworkNode::class, 'destination_node_id');
    }

    public function customerService()
    {
        return $this->belongsTo(CustomerService::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === 'available';
    }
}
