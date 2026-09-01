<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class NetworkNodeResource extends JsonResource
{
    protected ?array $_cachedClientRxPowers = null;

    /**
     * Transform the resource into an array.
     */
    public function toArray($request)
    {
        $opticalData = $this->getClientRxPowers();
        $bestPower = !empty($opticalData['powers']) ? max($opticalData['powers']) : null;
        $worstPower = !empty($opticalData['powers']) ? min($opticalData['powers']) : null;
        $opticalDbm = $worstPower;

        $rangeStr = null;
        if (!empty($opticalData['total'])) {
            if (empty($opticalData['powers'])) {
                $rangeStr = "Loss (-∞ dBm)";
            } elseif ($opticalData['has_loss']) {
                $rangeStr = "{$bestPower} dBm (Ada LOS)";
            } elseif ($bestPower === $worstPower) {
                $rangeStr = "{$bestPower} dBm";
            } else {
                $rangeStr = "{$bestPower} s/d {$worstPower} dBm";
            }
        }

        $autoData = $this->getAutoDetectedInterfaceAndOlt();
        $autoPort = $autoData['port_ref'];
        $effectivePortRef = $this->olt_port_ref ?: $autoPort;
        $isAuto = empty($this->olt_port_ref) && !empty($autoPort);

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
            'olt_device_id'          => $this->olt_device_id ?: ($autoData['olt_device']['id'] ?? null),
            'splitter_type_id'       => $this->splitter_type_id,
            'splitter_cascade_level' => $this->splitter_cascade_level,
            'olt_port_ref'           => $effectivePortRef,
            'stored_olt_port_ref'    => $this->olt_port_ref,
            'auto_detected_port_ref' => $autoPort,
            'is_auto_detected'       => $isAuto,
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
            'olt_device'             => $this->oltDevice ? [
                'id'   => $this->oltDevice->id,
                'name' => $this->oltDevice->name,
                'code' => $this->oltDevice->code,
                'ip_address' => $this->oltDevice->ip_address,
            ] : ($this->parent?->oltDevice ? [
                'id'   => $this->parent->oltDevice->id,
                'name' => $this->parent->oltDevice->name,
                'code' => $this->parent->oltDevice->code,
            ] : ($autoData['olt_device'] ? [
                'id'   => $autoData['olt_device']['id'],
                'name' => $autoData['olt_device']['name'],
                'code' => null,
            ] : null)),
            'splitter_type'          => $this->whenLoaded('splitterType', fn() => [
                'id'           => $this->splitterType->id,
                'name'         => $this->splitterType->name,
                'ratio'        => $this->splitterType->ratio,
                'output_ports' => $this->splitterType->output_ports,
            ]),
            'optical_power_dbm'      => $opticalDbm,
            'best_rx_power'          => $bestPower,
            'worst_rx_power'         => $worstPower,
            'rx_power_range'         => $rangeStr,
        ];
    }

    private function getClientRxPowers(): array
    {
        if ($this->_cachedClientRxPowers !== null) {
            return $this->_cachedClientRxPowers;
        }

        if ($this->node_type !== 'ODP') {
            return $this->_cachedClientRxPowers = ['powers' => [], 'total' => 0, 'has_loss' => false];
        }

        // Single optimized direct JOIN query
        $onts = DB::table('ont_registrations')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'ont_registrations.customer_service_id')
            ->where('network_ports.node_id', $this->id)
            ->select('ont_registrations.status', 'ont_registrations.rx_power')
            ->get();

        if ($onts->isEmpty()) {
            return $this->_cachedClientRxPowers = ['powers' => [], 'total' => 0, 'has_loss' => false];
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

        return $this->_cachedClientRxPowers = [
            'powers'   => $powers,
            'total'    => $onts->count(),
            'has_loss' => $hasLoss
        ];
    }
}
