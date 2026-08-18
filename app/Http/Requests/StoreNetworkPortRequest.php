<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNetworkPortRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'node_id' => 'required|exists:network_nodes,id',
            'port_number' => 'required|string|max:50',
            'port_type' => 'required|string|max:50',
            'status' => 'required|string|in:available,unavailable',
            'connected_to_port_id' => 'nullable|exists:network_ports,id',
            'notes' => 'nullable|string',
        ];
    }
}
