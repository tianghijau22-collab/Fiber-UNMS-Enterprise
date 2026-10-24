<?php

namespace App\Services;

use App\Jobs\PublishOpticalFaultNotification;
use Illuminate\Support\Facades\Cache;

/** GIS and automatic ODP/segment alarms consume the same stored observations. */
class OpticalFaultLocalizationService
{
    public const STATE_KEY = 'optical_fault_state_v2';
    public const LOCK_KEY = 'optical_fault_evaluation_v2';

    public static function preview(): array
    {
        return app(self::class)->describe(app(NetworkOpticalEvidence::class)->capture());
    }

    public static function runDiagnostic(): array { return app(self::class)->evaluate(); }

    /** Compatibility: thresholds now follow the all-N/A GIS evidence contract. */
    public static function detectMassClientDown(int $minThreshold = 2, float $downPercentageThreshold = 100.0): array
    {
        return self::runDiagnostic()['mass_outages'];
    }

    public static function localizeOpticalBreakBoundaries(): array { return self::preview()['boundary_breaks']; }

    public function describe(array $data): array
    {
        $outages = [];
        foreach ($data['nodes'] as $node) {
            $e = $node['optical_evidence'];
            if ($this->operating($node) && $e['state'] === 'no_rx' && $e['total'] >= 2) {
                $outages[] = ['odp_id'=>$node['id'], 'odp_name'=>$node['name'], 'odp_code'=>$node['code'],
                    'total_clients'=>$e['total'], 'down_clients'=>$e['no_rx_clients'], 'down_percentage'=>100,
                    'sampled_at'=>$e['sampled_at'], 'evidence'=>$e];
            }
        }
        return ['timestamp'=>now()->toIso8601String(), 'evaluation_status'=>'PREVIEW',
            'mass_outages_detected'=>count($outages), 'mass_outages'=>$outages,
            'boundary_breaks_count'=>count($data['diagnostics']['faults']), 'boundary_breaks'=>$data['diagnostics']['faults'],
            'coverage'=>$data['diagnostics']['coverage'], 'sources'=>$data['sources'], 'notifications_sent'=>0];
    }

    public function evaluate(): array
    {
        $lock = Cache::lock(self::LOCK_KEY, 30);
        if (!$lock->get()) return $this->skipped('BUSY');
        $jobs = [];
        try {
            $state = Cache::get(self::STATE_KEY, ['records'=>[], 'evaluated_at'=>0]);
            if (time() - ($state['evaluated_at'] ?? 0) < 2) return $this->skipped('THROTTLED');
            $data = app(NetworkOpticalEvidence::class)->capture();
            $result = $this->describe($data);
            $nodes = array_column($data['nodes'], null, 'id');
            $vpnDown = ($data['network_status'] ?? '') === 'DISCONNECTED';
            if ($vpnDown) {
                $this->advance($state, 'source:vpn', 'down', now()->toIso8601String(), 'vpn',
                    ['kind'=>'source', 'name'=>'Jalur VPN', 'reason'=>'Interface VPN tidak tersedia'], []);
            } elseif (($data['network_status'] ?? '') === 'AVAILABLE') {
                // An available interface alone does not prove restored communication.
                $responding = array_filter($data['sources'], fn($s)=>$s['status'] === 'available');
                $at = $responding ? min(array_column($responding, 'sampled_at')) : null;
                $this->advance($state, 'source:vpn', $responding ? 'up' : 'unknown', $at, 'vpn',
                    ['kind'=>'source', 'name'=>'Jalur VPN', 'reason'=>'Interface tersedia dan OLT kembali merespons'], []);
            } else {
                $this->advance($state, 'source:vpn', 'unknown', null, 'vpn', ['kind'=>'source', 'name'=>'Jalur VPN'], []);
            }
            foreach ($data['sources'] as $source) {
                $condition = $vpnDown || $source['reason'] === 'source_not_live' ? 'unknown'
                    : match ($source['status']) { 'available'=>'up', 'unavailable'=>'down', default=>'unknown' };
                $this->advance($state, 'source:olt:'.$source['id'], $condition, $source['sampled_at'], 'olt:'.$source['id'],
                    ['kind'=>'source', 'name'=>$source['name'], 'reason'=>$source['reason']], []);
            }
            foreach ($data['nodes'] as $node) {
                if ($node['node_type'] !== 'ODP') continue;
                $o = $data['observations'][$node['id']]; $e = $o['evidence'];
                $condition = $this->operating($node) && $e['total'] >= 2 ? $this->condition($e) : 'unknown';
                $suppressed = false;
                foreach ($e['pon_keys'] as $pon) {
                    [$owner, $port] = explode(':', $pon, 2);
                    if (Cache::has('interface_in_mass_outage_'.$owner.'_'.$port)
                        || Cache::has('interface_in_mass_outage_'.$owner.'_gpon-olt_'.$port)) $suppressed = true;
                }
                $this->advance($state, 'odp:'.$node['id'], $condition, $e['sampled_at'], $o['members'],
                    ['kind'=>'odp', 'name'=>$node['name'], 'evidence'=>$e], $o['clients'], $suppressed);
            }
            $faults = array_column($data['diagnostics']['faults'], null, 'id');
            $cables = array_column($data['cables'], null, 'id');
            $graph = [];
            foreach ($cables as $c) $graph[] = [$c['id'], $c['from_node_id'], $c['to_node_id'], $c['status']];
            sort($graph); $graphSignature = hash('sha256', json_encode($graph));
            foreach ($faults as $id => $fault) {
                $ids = [$fault['last_signal_node']['id'], ...$fault['affected_node_ids']];
                $members = $this->segmentMembers($fault, $cables, $data['observations']);
                $key = 'segment:'.$id;
                if (!isset($state['records'][$key]) && ($state['graph_signature'] ?? null) === $graphSignature) {
                    $wasHealthy = true;
                    foreach ($ids as $nodeId) {
                        $before = $state['previous_nodes'][$nodeId] ?? [];
                        if (($before['state'] ?? '') !== 'signal' || ($before['members'] ?? null) !== $data['observations'][$nodeId]['members']) $wasHealthy = false;
                    }
                    if ($wasHealthy) $state['records'][$key] = ['active'=>false, 'notified'=>false, 'initialized'=>true, 'members'=>$members, 'pending'=>null];
                }
                $this->advance($state, $key, 'down', min(array_map(fn($id)=>$nodes[$id]['optical_evidence']['sampled_at'], $ids)),
                    $members, ['kind'=>'segment', 'name'=>$fault['last_signal_node']['name'].' → '.$fault['first_no_rx_node']['name'], 'fault'=>$fault], []);
            }
            // Missing candidates can mean stale data or topology edits, not restored signal.
            foreach ($state['records'] as $key => $record) {
                if (!str_starts_with($key, 'segment:') || isset($faults[substr($key, 8)])) continue;
                $context = $record['context']; $fault = $context['fault'];
                $ids = [$fault['last_signal_node']['id'], ...$fault['affected_node_ids']];
                $complete = isset($cables[$fault['cable_id']])
                    && $this->segmentMembers($fault, $cables, $data['observations']) === ($record['members'] ?? null);
                foreach ($ids as $id) {
                    if (!isset($nodes[$id]) || !$this->operating($nodes[$id]) || $this->condition($nodes[$id]['optical_evidence']) !== 'up') $complete = false;
                }
                $at = $complete ? min(array_map(fn($id)=>$nodes[$id]['optical_evidence']['sampled_at'], $ids)) : null;
                $this->advance($state, $key, $complete ? 'up' : 'unknown', $at, $record['members'] ?? '', $context, []);
            }
            foreach ($state['records'] as $key => &$record) {
                if ((str_starts_with($key, 'odp:') && !isset($nodes[(int) substr($key, 4)]))
                    || (str_starts_with($key, 'source:olt:') && !isset($data['sources'][(int) substr($key, 11)]))) {
                    $record['condition'] = 'unknown';
                    unset($record['pending_notification']);
                }
                if (isset($record['pending_notification']) && $record['condition'] === ($record['active'] ? 'down' : 'up')
                    && time() - ($record['last_dispatch_at'] ?? 0) >= 60) {
                    $record['last_dispatch_at'] = time();
                    $jobs[] = $record['pending_notification'];
                }
            }
            unset($record);
            $state['graph_signature'] = $graphSignature;
            $state['previous_nodes'] = [];
            foreach ($data['nodes'] as $node) $state['previous_nodes'][$node['id']] = [
                'members'=>$data['observations'][$node['id']]['members'], 'state'=>$node['optical_evidence']['state']];
            $state['evaluated_at'] = time();
            Cache::forever(self::STATE_KEY, $state);
            $result['evaluation_status'] = 'EVALUATED';
            $result['notifications_queued'] = count($jobs);
        } finally { $lock->release(); }
        foreach ($jobs as $job) PublishOpticalFaultNotification::dispatch($job);
        return $result;
    }

    private function condition(array $evidence): string
    {
        if (($evidence['source_status'] ?? '') !== 'available' || $evidence['unverified_clients'] > 0) return 'unknown';
        if ($evidence['state'] === 'no_rx') return 'down';
        return $evidence['total'] > 0 && $evidence['signal_clients'] === $evidence['total'] ? 'up' : 'partial';
    }

    private function operating(array $node): bool
    {
        return $node['node_type'] === 'ODP' && !in_array($node['status'], ['inactive', 'maintenance'], true);
    }

    private function segmentMembers(array $fault, array $cables, array $observations): string
    {
        $edges = [];
        foreach ($cables as $c) $edges[] = [$c['id'], $c['from_node_id'], $c['to_node_id'], $c['status']];
        sort($edges);
        $members = [];
        foreach ([$fault['last_signal_node']['id'], ...$fault['affected_node_ids']] as $id) $members[$id] = $observations[$id]['members'] ?? null;
        return hash('sha256', json_encode([$edges, $members]));
    }

    private function advance(array &$state, string $key, string $condition, ?string $at, string $members, array $context, array $clients, bool $suppressed = false): void
    {
        $previous = $state['records'][$key] ?? null;
        $next = OpticalFaultState::advance($previous, $condition, $at, $members);
        $record = $next['record']; $record['context'] = $context;
        if ($next['transition']) {
            unset($record['pending_notification']);
            if (!$suppressed && ($next['transition'] === 'outage' || ($previous['notified'] ?? false))) {
                $record['pending_notification'] = ['key'=>$key, 'token'=>bin2hex(random_bytes(16)), 'transition'=>$next['transition'],
                    'context'=>$context, 'clients'=>$clients, 'sampled_at'=>$at];
                $record['last_dispatch_at'] = 0;
            }
            if ($next['transition'] === 'outage') $record['notified'] = false;
        }
        if (($record['members'] ?? null) !== ($previous['members'] ?? null)) unset($record['pending_notification']);
        $state['records'][$key] = $record;
    }

    public static function deliveryCurrent(array $event): bool
    {
        $state = Cache::get(self::STATE_KEY, []);
        $record = $state['records'][$event['key']] ?? [];
        return ($record['pending_notification']['token'] ?? null) === $event['token']
            && ($record['condition'] ?? '') === ($event['transition'] === 'outage' ? 'down' : 'up');
    }

    public static function delivered(array $event): void
    {
        Cache::lock(self::LOCK_KEY, 30)->block(5, function () use ($event) {
            $state = Cache::get(self::STATE_KEY, []);
            if (($state['records'][$event['key']]['pending_notification']['token'] ?? null) !== $event['token']) return;
            $state['records'][$event['key']]['notified'] = $event['transition'] === 'outage';
            unset($state['records'][$event['key']]['pending_notification']);
            Cache::forever(self::STATE_KEY, $state);
        });
    }

    private function skipped(string $status): array
    {
        return ['evaluation_status'=>$status, 'mass_outages'=>[], 'mass_outages_detected'=>0,
            'boundary_breaks'=>[], 'boundary_breaks_count'=>0, 'notifications_sent'=>0, 'notifications_queued'=>0];
    }
}
