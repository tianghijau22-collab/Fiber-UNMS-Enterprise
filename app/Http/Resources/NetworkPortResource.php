<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NetworkPortResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'node_id' => $this->node_id,
            'port_number' => $this->port_number,
            'port_type' => $this->port_type,
            'status' => $this->status,
            'connected_to_port_id' => $this->connected_to_port_id,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
