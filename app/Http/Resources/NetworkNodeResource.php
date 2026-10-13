<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use App\Services\Olt\OnuTelemetryView;

class NetworkNodeResource extends JsonResource
{
    protected ?array $_cachedClientRxPowers = null;

    /**
     * Transform the resource into an array.
     */
    public function toArray($request)
    {
        $opticalData = $this->preloaded_client_rx_powers ?? $this->getClientRxPowers();
        $bestPower = !empty($opticalData['powers']) ? max($opticalData['powers']) : null;
        $worstPower = !empty($opticalData['powers']) ? min($opticalData['powers']) : null;
        $opticalDbm = $worstPower;

        $rangeStr = $opticalData['rx_power_range'] ?? null;

        $autoData = $this->preloaded_auto_detected ?? $this->getAutoDetectedInterfaceAndOlt();
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
            'telemetry_contract'     => 1,
            'total_clients'          => $opticalData['total'] ?? 0,
            'online_clients'         => $opticalData['online_clients'] ?? 0,
            'loss_clients'           => $opticalData['loss_clients'] ?? 0,
            'unknown_clients'        => $opticalData['unknown_clients'] ?? 0,
            'is_loss_total'          => $opticalData['is_loss_total'] ?? false,
            'signal_status'          => $opticalData['signal_status'] ?? 'unknown',
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

        $telemetry = OnuTelemetryView::forRequest();

        // Optimized query joining ports & ont_registrations
        $onts = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->whereNull('customer_services.deleted_at')
            ->whereNull('customers.deleted_at')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'ont_registrations.customer_service_id')
            ->where('network_ports.node_id', $this->id)
            ->whereNull('ont_registrations.deleted_at')
            ->select('ont_registrations.onu_serial', 'ont_registrations.onu_mac', 'ont_registrations.status', 'ont_registrations.rx_power')
            ->get();

        $views = [];
        foreach ($onts as $ont) {
            $views[] = $telemetry->forNode($this->resource, $ont->onu_serial, $ont->onu_mac);
        }
        $ports = DB::table('network_ports')->where('node_id', $this->id)->get(['customer_service_id','status','customer_name_cache']);
        return $this->_cachedClientRxPowers = OnuTelemetryView::summarize($views, OnuTelemetryView::occupiedPortCount($ports));
    }
}
