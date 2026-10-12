<?php

namespace App\Services\Olt;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class OdpTopologyCache
{
    private const FIELDS = [
        'odp_id', 'odp_name', 'odp_code', 'olt_port_ref', 'odc_name', 'olt_name',
        'ont_id', 'onu_serial', 'onu_mac', 'status', 'rx_power',
        'customer_id', 'customer_number', 'customer_name',
    ];

    public function get(int $odpId): Collection
    {
        // A new namespace avoids legacy objects when class deserialization is disabled.
        $key = "odp_onus_topology_v2_{$odpId}";
        $rows = Cache::get($key);

        if (!$this->valid($rows, $odpId)) {
            $rows = DB::table('ont_registrations')
                ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
                ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
                ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
                ->join('network_nodes as odp', 'odp.id', '=', 'network_ports.node_id')
                ->leftJoin('network_nodes as odc', 'odc.id', '=', 'odp.parent_node_id')
                ->leftJoin('olt_devices', 'olt_devices.id', '=', 'odp.olt_device_id')
                ->where('odp.id', $odpId)
                ->select([
                    'odp.id as odp_id', 'odp.name as odp_name', 'odp.code as odp_code',
                    'odp.olt_port_ref', 'odc.name as odc_name', 'olt_devices.name as olt_name',
                    'ont_registrations.id as ont_id', 'ont_registrations.onu_serial',
                    'ont_registrations.onu_mac', 'ont_registrations.status', 'ont_registrations.rx_power',
                    'customers.id as customer_id', 'customers.customer_number', 'customers.name as customer_name',
                ])
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all();

            if (!$this->valid($rows, $odpId)) {
                throw new \UnexpectedValueException('ODP topology contains an invalid row');
            }

            Cache::put($key, $rows, 30);
        }

        return collect($rows);
    }

    private function valid(mixed $rows, int $odpId): bool
    {
        if (!is_array($rows) || !array_is_list($rows)) {
            return false;
        }
        foreach ($rows as $row) {
            if (!is_array($row) || array_diff(self::FIELDS, array_keys($row))) {
                return false;
            }
            foreach ($row as $value) {
                if ($value !== null && !is_scalar($value)) {
                    return false;
                }
            }
            if ((string) $row['odp_id'] !== (string) $odpId) {
                return false;
            }
        }

        return true;
    }
}
