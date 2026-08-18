<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNetworkCableRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:100|unique:network_cables,code',
            'cable_type_id' => 'required|exists:cable_types,id',
            'from_node_id' => 'required|exists:network_nodes,id',
            'to_node_id' => 'required|exists:network_nodes,id',
            'length_meters' => 'required|numeric|min:0',
            'core_count_total' => 'required|integer|min:0',
            'core_count_used' => 'required|integer|min:0',
            'installation_type' => 'nullable|string|max:100',
            'route_description' => 'nullable|string',
            'status' => 'required|string|in:active,inactive',
            'installed_at' => 'nullable|date',
            'notes' => 'nullable|string',
        ];
    }
}
