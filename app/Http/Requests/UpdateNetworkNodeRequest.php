<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateNetworkNodeRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        // Safe parameter extraction whether route binding is 'network_node', 'networkNode', 'id', payload 'id', or URI path
        $node = $this->route('network_node') 
            ?? $this->route('networkNode') 
            ?? $this->route('id') 
            ?? $this->route('node')
            ?? $this->input('id');

        if (!$node) {
            $pathParts = explode('/', trim($this->path(), '/'));
            $lastPart = end($pathParts);
            if (is_numeric($lastPart)) {
                $node = (int) $lastPart;
            }
        }

        $nodeId = is_object($node) ? $node->id : ($node ?? $this->input('id'));

        return [
            'name'                   => 'sometimes|required|string|max:255',
            'code'                   => ['sometimes', 'required', 'string', 'max:100', Rule::unique('network_nodes', 'code')->ignore($nodeId)->whereNull('deleted_at')],
            'node_type'              => 'sometimes|required|string|in:POP,ODC,ODP',
            'device_type_id'         => 'nullable|exists:device_types,id',
            'brand_id'               => 'nullable|exists:brands,id',
            'model'                  => 'nullable|string|max:255',
            'serial_number'          => 'nullable|string|max:255',
            'status'                 => 'sometimes|required|string|in:active,inactive,maintenance,damaged',
            'latitude'               => 'nullable|numeric|between:-90,90',
            'longitude'              => 'nullable|numeric|between:-180,180',
            'address'                => 'nullable|string|max:500',
            'province_id'            => 'nullable|exists:provinces,id',
            'regency_id'             => 'nullable|exists:regencies,id',
            'district_id'            => 'nullable|exists:districts,id',
            'village_id'             => 'nullable|exists:villages,id',
            'parent_node_id'         => 'nullable|exists:network_nodes,id',
            'olt_device_id'          => 'nullable|exists:olt_devices,id',
            'splitter_type_id'       => 'nullable|exists:splitter_types,id',
            'splitter_cascade_level' => 'nullable|integer|between:0,3',
            'olt_port_ref'           => 'nullable|string|max:500',
            'total_ports'            => 'sometimes|required|integer|min:0|max:512',
            'used_ports'             => 'sometimes|required|integer|min:0',
            'installed_at'           => 'nullable|date',
            'notes'                  => 'nullable|string',
            'core_power'             => 'nullable|string',
            'core_color'             => 'nullable|string',
            'splitter_config'        => 'nullable|array',
            'tube_count'             => 'nullable|integer|min:0|max:99',
            'tube_info'              => 'nullable|string',
            'splitter_count'         => 'nullable|integer|min:0|max:99',
            'odc_topology_type'      => 'nullable|string|in:tunggal,induk,anak',
            'created_by'             => 'nullable|exists:users,id',
        ];
    }

    public function messages()
    {
        return [
            'code.unique'   => 'Kode unik node ini sudah digunakan oleh node lain. Silakan gunakan kode unik yang berbeda.',
            'code.required' => 'Kode unik wajib diisi.',
            'name.required' => 'Nama node wajib diisi.',
        ];
    }
}
