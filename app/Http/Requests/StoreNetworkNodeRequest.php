<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreNetworkNodeRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'name'                   => 'required|string|max:255',
            'code'                   => ['required', 'string', 'max:100', Rule::unique('network_nodes', 'code')->whereNull('deleted_at')],
            // Hanya POP, ODC, ODP yang dikelola di halaman /network
            // OLT dikelola di /olt-management (sinkron realtime dari perangkat)
            'node_type'              => 'required|string|in:POP,ODC,ODP',
            'device_type_id'         => 'nullable|exists:device_types,id',
            'brand_id'               => 'nullable|exists:brands,id',
            'model'                  => 'nullable|string|max:255',
            'serial_number'          => 'nullable|string|max:255',
            'status'                 => 'required|string|in:active,inactive,maintenance,damaged',
            'latitude'               => 'nullable|numeric|between:-90,90',
            'longitude'              => 'nullable|numeric|between:-180,180',
            'address'                => 'nullable|string|max:500',
            'province_id'            => 'nullable|exists:provinces,id',
            'regency_id'             => 'nullable|exists:regencies,id',
            'district_id'            => 'nullable|exists:districts,id',
            'village_id'             => 'nullable|exists:villages,id',
            // Hierarki: ODC → POP, ODP → ODC
            'parent_node_id'         => 'nullable|exists:network_nodes,id',
            // Link ke OLT device yang melayani node ini
            'olt_device_id'          => 'nullable|exists:olt_devices,id',
            // Splitter pasif (PLC 1:2, 1:4, 1:8, dll)
            'splitter_type_id'       => 'nullable|exists:splitter_types,id',
            'splitter_cascade_level' => 'nullable|integer|between:0,3',
            // Referensi port OLT yang melayani subtree ini
            'olt_port_ref'           => 'nullable|string|max:500',
            // Kapasitas port (jumlah port akan di-generate otomatis oleh controller)
            'total_ports'            => 'required|integer|min:0|max:512',
            'used_ports'             => 'required|integer|min:0',
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
            'code.unique'   => 'Kode unik node ini sudah digunakan. Silakan gunakan kode unik lain (contoh: ODC 01-01, ODC 01-02).',
            'code.required' => 'Kode unik wajib diisi.',
            'name.required' => 'Nama node wajib diisi.',
        ];
    }
}
