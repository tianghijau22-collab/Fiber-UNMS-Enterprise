<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNetworkPortRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'node_id'              => 'sometimes|required|exists:network_nodes,id',
            'port_number'          => 'sometimes|required|string|max:50',
            'port_type'            => 'sometimes|required|string|max:50',
            'status'               => 'sometimes|required|string|in:available,used,unavailable,maintenance,damaged',
            'connected_to_port_id' => 'nullable|exists:network_ports,id',
            'destination_label'    => 'nullable|string|max:255',
            'customer_name_cache'  => 'nullable|string|max:255',
            'notes'                => 'nullable|string',
        ];
    }
}
