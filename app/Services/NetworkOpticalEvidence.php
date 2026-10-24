<?php

namespace App\Services;

use App\Models\NetworkCable;
use App\Models\NetworkNode;
use App\Models\OltDevice;
use App\Services\Olt\OltHealthMonitor;
use App\Services\Olt\OnuTelemetryView;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Shared stored evidence for GIS and alarms. Never probes devices or changes customer state. */
class NetworkOpticalEvidence
{
    protected function network(): array
    {
        // Inspect local interfaces/routes only; overview() would also initiate a VPN ping.
        return app(OltHealthMonitor::class)->network();
    }

    public static function source(OltDevice $device, array $network, array $attempt): array
    {
        $probe = $attempt['connection'] ?? [];
        $age = OltHealthMonitor::age($probe['checked_at'] ?? null);
        $route = OltHealthMonitor::routeStatus((string) $device->ip_address, $network);
        $status = 'unknown';
        $reason = 'connection_unverified';
        if ($device->connection_mode !== 'live' || !in_array($device->status, ['active', 'offline'], true)) {
            $reason = 'source_not_live';
        } elseif ($route === 'UNAVAILABLE') {
            $status = 'unavailable';
            $reason = 'vpn_or_route_missing';
        } elseif ($age !== null && $age <= OltHealthMonitor::CONNECTION_MAX_AGE) {
            if (($probe['status'] ?? '') === 'RESPONDING') {
                $status = 'available';
                $reason = null;
            } elseif (in_array($probe['status'] ?? '', ['NO_RESPONSE', 'PATH_UNAVAILABLE'], true)) {
                $status = 'unavailable';
                $reason = 'olt_not_responding';
            }
        }
        return ['id'=>(int) $device->id, 'name'=>$device->name, 'status'=>$status, 'reason'=>$reason,
            'sampled_at'=>$route === 'UNAVAILABLE' ? ($network['checked_at'] ?? null) : ($probe['checked_at'] ?? null)];
    }

    public static function evidence(array $views, int $expected, array $sources): array
    {
        $unique = []; $locations = []; $sourceStatus = 'available';
        foreach ($views as $view) {
            $source = $sources[$view['olt_id'] ?? 0]['status'] ?? 'unknown';
            if ($source !== 'available') $sourceStatus = $source === 'unavailable' ? 'unavailable' : ($sourceStatus === 'unavailable' ? $sourceStatus : 'unknown');
            // Reused customer serials are display aliases, not independent optical observations.
            $tuple = !empty($view['olt_id']) && !empty($view['gpon_interface']) && !empty($view['onu_id'])
                ? $view['olt_id'].':'.$view['gpon_interface'].':'.$view['onu_id'] : null;
            if ($tuple !== null && isset($locations[$tuple])) continue;
            if ($tuple !== null) $locations[$tuple] = true;
            $unique[] = $view;
        }
        $evidence = GisOpticalFaultAnalyzer::evidence($unique, max($expected, count($views)));
        if (!$views && $expected > 0) $sourceStatus = 'unknown';
        if ($evidence['state'] !== 'empty' && $sourceStatus !== 'available') {
            $evidence = array_replace($evidence, ['state'=>'unknown', 'signal_clients'=>0, 'no_rx_clients'=>0,
                'unverified_clients'=>$evidence['total'], 'valid_until'=>null]);
        }
        $evidence['source_status'] = $sourceStatus;
        return $evidence;
    }

    public function observe(Collection $nodes, ?OnuTelemetryView $telemetry = null): array
    {
        $devices = OltDevice::all();
        $telemetry ??= new OnuTelemetryView($devices->filter(fn($d)=>$d->status === 'active' && $d->connection_mode === 'live'));
        $network = $this->network(); $sources = [];
        foreach ($devices as $device) $sources[$device->id] = self::source($device, $network, OltHealthMonitor::cachedArray('olt_poll_health_v1_'.$device->id));
        $byId = $nodes->keyBy('id');
        foreach ($nodes as $node) $node->setRelation('parent', $byId->get($node->parent_node_id));
        $ids = $nodes->pluck('id');
        $registrations = DB::table('ont_registrations as ont')
            ->join('customer_services as svc', 'svc.id', '=', 'ont.customer_service_id')
            ->join('customers as customer', 'customer.id', '=', 'svc.customer_id')
            ->join('network_ports as port', 'port.customer_service_id', '=', 'svc.id')
            ->whereNull('ont.deleted_at')->whereNull('svc.deleted_at')->whereNull('customer.deleted_at')
            ->whereIn('port.node_id', $ids)
            ->select('ont.id', 'ont.customer_service_id', 'ont.onu_serial', 'ont.onu_mac', 'port.node_id', 'customer.name as customer_name', 'customer.customer_number')
            ->orderBy('ont.id')->get()->groupBy('node_id');
        $ports = DB::table('network_ports')->whereIn('node_id', $ids)
            ->get(['node_id', 'status', 'customer_service_id', 'customer_name_cache'])->groupBy('node_id');
        $observations = [];
        foreach ($nodes as $node) {
            $views = []; $clients = []; $members = [];
            foreach ($registrations->get($node->id, collect()) as $row) {
                $view = $telemetry->forNode($node, $row->onu_serial, $row->onu_mac);
                $views[] = $view;
                $clients[] = ['name'=>$row->customer_name, 'customer_number'=>$row->customer_number,
                    'serial'=>$row->onu_serial ?: $row->onu_mac, 'telemetry'=>$view];
                $members[] = [$row->id, $row->customer_service_id, $row->onu_serial, $row->onu_mac];
            }
            $expected = max(count($views), OnuTelemetryView::occupiedPortCount($ports->get($node->id, [])));
            $evidence = self::evidence($views, $expected, $sources);
            $observations[$node->id] = ['views'=>$views, 'clients'=>$clients, 'evidence'=>$evidence,
                'summary'=>OnuTelemetryView::summarize($views, $expected),
                'members'=>hash('sha256', json_encode([$members, $expected, $node->status, $node->olt_device_id, $node->parent_node_id]))];
        }
        return ['observations'=>$observations, 'sources'=>$sources, 'network_status'=>$network['status'] ?? 'UNKNOWN'];
    }

    public function capture(): array
    {
        $nodes = NetworkNode::all();
        $data = $this->observe($nodes);
        $formatted = [];
        foreach ($nodes as $node) {
            $observation = $data['observations'][$node->id];
            $formatted[] = ['id'=>$node->id, 'name'=>$node->name, 'code'=>$node->code, 'node_type'=>$node->node_type,
                'status'=>$node->status, 'latitude'=>$node->latitude, 'longitude'=>$node->longitude,
                'best_rx_power'=>$observation['summary']['best_rx_power'], 'optical_evidence'=>$observation['evidence']];
        }
        $data['nodes'] = $formatted;
        $data['cables'] = NetworkCable::all()->toArray();
        $data['diagnostics'] = GisOpticalFaultAnalyzer::analyze($formatted, $data['cables']);
        return $data;
    }
}
