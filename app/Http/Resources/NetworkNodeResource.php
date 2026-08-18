<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NetworkNodeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray($request)
    {
        return [
            'id'                     => $this->id,
            'name'                   => $this->name,
            'code'                   => $this->code,
            'node_type'              => $this->node_type,
            'device_type_id'         => $this->device_type_id,
            'brand_id'               => $this->brand_id,
            'model'                  => $this->model,
            'serial_number'          => $this->serial_number,
            'status'                 => $this->status,
            'latitude'               => $this->latitude,
            'longitude'              => $this->longitude,
            'address'                => $this->address,
            'parent_node_id'         => $this->parent_node_id,
            'olt_device_id'          => $this->olt_device_id,
            'splitter_type_id'       => $this->splitter_type_id,
            'splitter_cascade_level' => $this->splitter_cascade_level,
            'olt_port_ref'           => $this->olt_port_ref,
            'total_ports'            => $this->total_ports,
            'used_ports'             => $this->used_ports,
            'installed_at'           => $this->installed_at,
            'notes'                  => $this->notes,
            'core_power'             => $this->core_power,
            'core_color'             => $this->core_color,
            'tube_info'              => $this->tube_info,
            'tube_count'             => $this->tube_count,
            'splitter_count'         => $this->splitter_count,
            'splitter_config'        => $this->splitter_config,
            'odc_topology_type'      => $this->odc_topology_type,
            'created_at'             => $this->created_at,
            'updated_at'             => $this->updated_at,
            'parent_node'            => $this->whenLoaded('parent', fn() => [
                'id'   => $this->parent->id,
                'name' => $this->parent->name,
                'code' => $this->parent->code,
                'olt_device' => $this->parent->relationLoaded('oltDevice') && $this->parent->oltDevice ? [
                    'id'   => $this->parent->oltDevice->id,
                    'name' => $this->parent->oltDevice->name,
                    'code' => $this->parent->oltDevice->code,
                ] : null,
            ]),
            'olt_device'             => $this->whenLoaded('oltDevice', fn() => [
                'id'   => $this->oltDevice->id,
                'name' => $this->oltDevice->name,
                'code' => $this->oltDevice->code,
                'ip_address' => $this->oltDevice->ip_address,
            ]),
            'splitter_type'          => $this->whenLoaded('splitterType', fn() => [
                'id'           => $this->splitterType->id,
                'name'         => $this->splitterType->name,
                'ratio'        => $this->splitterType->ratio,
                'output_ports' => $this->splitterType->output_ports,
            ]),
        ];
    }
}
