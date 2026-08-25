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
            'optical_power_dbm'      => $this->getOpticalPowerDbm(),
            'best_rx_power'          => $this->getBestRxPower(),
            'worst_rx_power'         => $this->getWorstRxPower(),
            'rx_power_range'         => $this->getRxPowerRange(),
        ];
    }

    private function getClientRxPowers(): array
    {
        if ($this->node_type !== 'ODP') {
            return ['powers' => [], 'total' => 0, 'has_loss' => false];
        }

        $onts = \App\Models\OntRegistration::whereHas('customerService.networkPort', function ($q) {
            $q->where('node_id', $this->id);
        })->get();

        if ($onts->isEmpty()) {
            return ['powers' => [], 'total' => 0, 'has_loss' => false];
        }

        $powers = [];
        $hasLoss = false;
        foreach ($onts as $ont) {
            if ($ont->status === 'active' && $ont->rx_power !== null && (float)$ont->rx_power > -40) {
                $powers[] = (float)$ont->rx_power;
            } else {
                $hasLoss = true;
            }
        }

        return ['powers' => $powers, 'total' => $onts->count(), 'has_loss' => $hasLoss];
    }

    private function getOpticalPowerDbm(): ?float
    {
        $data = $this->getClientRxPowers();
        if (empty($data['powers'])) {
            return null;
        }
        return min($data['powers']);
    }

    private function getBestRxPower(): ?float
    {
        $data = $this->getClientRxPowers();
        if (empty($data['powers'])) {
            return null;
        }
        return max($data['powers']);
    }

    private function getWorstRxPower(): ?float
    {
        $data = $this->getClientRxPowers();
        if (empty($data['powers'])) {
            return null;
        }
        return min($data['powers']);
    }

    private function getRxPowerRange(): ?string
    {
        $data = $this->getClientRxPowers();
        if (empty($data['total'])) {
            return null;
        }

        if (empty($data['powers'])) {
            return "Loss (-∞ dBm)";
        }

        $best = max($data['powers']);
        $worst = min($data['powers']);

        if ($data['has_loss']) {
            return "{$best} dBm (Ada LOS)";
        }

        if ($best === $worst) {
            return "{$best} dBm";
        }
        return "{$best} s/d {$worst} dBm";
    }
}
