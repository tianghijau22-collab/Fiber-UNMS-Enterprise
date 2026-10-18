<?php

namespace App\Services;

/** Stored observations only: no device reads, writes, notifications, or invented optical measurements. */
class GisOpticalFaultAnalyzer
{
    public static function evidence(array $views, int $expectedTotal, ?int $now = null): array
    {
        $now ??= time();
        $total = max(count($views), $expectedTotal);
        $signal = 0; $missing = 0; $times = []; $pons = [];
        foreach ($views as $v) {
            $at = is_string($v['sampled_at'] ?? null) ? strtotime($v['sampled_at']) : false;
            if (($v['identity_status'] ?? '') !== 'resolved' || ($v['telemetry_freshness'] ?? '') !== 'fresh'
                || !is_bool($v['is_online'] ?? null) || $at === false || $at < $now - 180 || $at > $now + 5) continue;
            $times[] = $at;
            if (!empty($v['olt_id']) && preg_match('~^(?:gpon-(?:olt|onu)_)?(\d+/\d+/\d+)(?::\d+)?$~i', trim($v['gpon_interface'] ?? ''), $m)) $pons[$v['olt_id'].':'.$m[1]] = true;
            $rx = $v['rx_power'] ?? null;
            if ($v['is_online'] && ($v['rx_available'] ?? false) === true && is_numeric($rx)
                && is_finite((float)$rx) && $rx > -40 && $rx <= 10) $signal++;
            else $missing++;
        }
        $unknown = $total - $signal - $missing;
        return ['version'=>1, 'state'=>!$total ? 'empty' : ($signal ? 'signal' : ($missing === $total ? 'no_rx' : 'unknown')),
            'total'=>$total, 'signal_clients'=>$signal, 'no_rx_clients'=>$missing, 'unverified_clients'=>$unknown,
            'pon_keys'=>array_keys($pons),
            'sampled_at'=>$times ? gmdate(DATE_ATOM, min($times)) : null,
            'valid_until'=>$times ? gmdate(DATE_ATOM, min($times) + 180) : null];
    }

    public static function analyze(array $nodes, array $cables, ?int $now = null): array
    {
        $now ??= time(); $byId = []; $graph = []; $linked = 0; $unlinked = 0; $invalid = 0;
        foreach ($nodes as $node) $byId[(string)$node['id']] = $node;
        foreach ($cables as $cable) {
            $from = (string)($cable['from_node_id'] ?? ''); $to = (string)($cable['to_node_id'] ?? '');
            if (!$from || !$to) { $unlinked++; continue; }
            if ($from === $to || !isset($byId[$from], $byId[$to])) { $invalid++; continue; }
            $linked++;
            // Planned, inactive, or maintenance links cannot establish the operating signal path.
            if (!in_array($cable['status'] ?? '', ['active', 'damaged'], true)) continue;
            $edge = ['from'=>$from, 'to'=>$to, 'cable'=>$cable];
            $graph[$from][] = $edge; $graph[$to][] = $edge;
        }
        $faults = []; $rejected = 0;
        foreach ($byId as $id => $healthy) {
            if (!self::operatingOdp($healthy) || self::state($healthy, $now) !== 'signal') continue;
            foreach ($graph[$id] ?? [] as $edge) {
                $firstId = $edge['from'] === (string)$id ? $edge['to'] : $edge['from'];
                $first = $byId[$firstId];
                if (!self::operatingOdp($first) || self::state($first, $now) !== 'no_rx') continue;
                if (!self::samePon($healthy, $first)) { $rejected++; continue; }
                // Removing the candidate boundary must leave a whole, unambiguous downstream branch without signal.
                $queue = [[$firstId, (string)$edge['cable']['id']]]; $seen = []; $affected = []; $safe = true;
                while ($queue && $safe) {
                    [$current, $incoming] = array_pop($queue);
                    if (isset($seen[$current])) { $safe = false; break; }
                    $seen[$current] = true; $node = $byId[$current];
                    if (!self::operatingOdp($node) || self::state($node, $now) !== 'no_rx' || !self::samePon($healthy, $node)) { $safe = false; break; }
                    $affected[] = $node;
                    foreach ($graph[$current] ?? [] as $next) {
                        if ((string)$next['cable']['id'] === $incoming) continue;
                        $neighbor = $next['from'] === (string)$current ? $next['to'] : $next['from'];
                        $queue[] = [$neighbor, (string)$next['cable']['id']];
                    }
                }
                if (!$safe) { $rejected++; continue; }
                $route = self::route($edge['cable']['route_coordinates'] ?? null);
                $routeSource = 'recorded_route';
                if (!$route) {
                    $a = self::point([$healthy['latitude'] ?? null, $healthy['longitude'] ?? null]);
                    $b = self::point([$first['latitude'] ?? null, $first['longitude'] ?? null]);
                    $route = $a && $b ? [$a, $b] : [];
                    $routeSource = 'between_nodes';
                }
                $until = array_map(fn($n)=>strtotime($n['optical_evidence']['valid_until']), [$healthy, ...$affected]);
                $faults[] = ['id'=>'cable-'.$edge['cable']['id'], 'cable_id'=>$edge['cable']['id'],
                    'last_signal_node'=>['id'=>$healthy['id'], 'name'=>$healthy['name'], 'rx_power'=>$healthy['best_rx_power'] ?? null],
                    'first_no_rx_node'=>['id'=>$first['id'], 'name'=>$first['name']],
                    'affected_node_ids'=>array_column($affected, 'id'), 'affected_odps'=>count($affected),
                    'affected_clients'=>array_sum(array_column(array_column($affected, 'optical_evidence'), 'total')),
                    'route_coordinates'=>$route, 'route_source'=>$routeSource, 'inspection_point'=>self::midpoint($route),
                    'length_meters'=>is_numeric($edge['cable']['length_meters'] ?? null) && $edge['cable']['length_meters'] > 0 ? (float)$edge['cable']['length_meters'] : null,
                    'valid_until'=>gmdate(DATE_ATOM, min($until)), 'certainty'=>'indication',
                    'explanation'=>'Perkiraan segmen berdasarkan batas sinyal dan seluruh ODP sesudahnya N/A. Periksa kabel, sambungan, splitter, serta catu daya ONU. Titik pin adalah patokan segmen, bukan koordinat pasti kabel putus.'];
            }
        }
        usort($faults, fn($a,$b)=>$b['affected_clients'] <=> $a['affected_clients'] ?: strcmp($a['id'],$b['id']));
        $odps = array_filter($nodes, fn($n)=>($n['node_type'] ?? '') === 'ODP');
        return ['version'=>1, 'evaluated_at'=>gmdate(DATE_ATOM, $now), 'faults'=>$faults,
            'coverage'=>['total_routes'=>count($cables), 'linked_routes'=>$linked, 'unlinked_routes'=>$unlinked, 'invalid_routes'=>$invalid,
                'all_na_odps'=>count(array_filter($odps, fn($n)=>self::state($n,$now) === 'no_rx')),
                'unverified_odps'=>count(array_filter($odps, fn($n)=>self::state($n,$now) === 'unknown')),
                'ambiguous_boundaries'=>$rejected]];
    }

    private static function operatingOdp(array $node): bool
    {
        return ($node['node_type'] ?? '') === 'ODP' && !in_array($node['status'] ?? '', ['inactive', 'maintenance'], true);
    }

    private static function state(array $node, int $now): string
    {
        $e = $node['optical_evidence'] ?? [];
        if (($e['version'] ?? null) !== 1) return 'unknown';
        if (($e['state'] ?? '') === 'empty') return 'empty';
        $until = is_string($e['valid_until'] ?? null) ? strtotime($e['valid_until']) : false;
        return $until !== false && $until >= $now ? ($e['state'] ?? 'unknown') : 'unknown';
    }

    private static function samePon(array $a, array $b): bool
    {
        $aKeys = $a['optical_evidence']['pon_keys'] ?? [];
        $bKeys = $b['optical_evidence']['pon_keys'] ?? [];
        return count($aKeys) === 1 && count($bKeys) === 1 && $aKeys[0] === $bKeys[0];
    }

    private static function point(mixed $p): ?array
    {
        if (!is_array($p) || count($p) !== 2 || !is_numeric($p[0] ?? null) || !is_numeric($p[1] ?? null)) return null;
        [$lat,$lng] = array_map('floatval', $p);
        return is_finite($lat) && is_finite($lng) && abs($lat) <= 90 && abs($lng) <= 180 ? [$lat,$lng] : null;
    }

    private static function route(mixed $value): array
    {
        if (is_string($value)) $value = json_decode($value, true);
        if (!is_array($value) || count($value) < 2) return [];
        $points = [];
        foreach ($value as $p) { if (!($point = self::point($p))) return []; $points[] = $point; }
        return $points;
    }

    /** Midpoint by route length, used only as an inspection landmark. */
    private static function midpoint(array $route): ?array
    {
        if (count($route) < 2) return null;
        $lengths = [];
        for ($i=1; $i<count($route); $i++) {
            [$a,$b] = [$route[$i-1],$route[$i]];
            $lengths[] = hypot(($b[0]-$a[0]), ($b[1]-$a[1])*cos(deg2rad(($a[0]+$b[0])/2)));
        }
        $remaining = array_sum($lengths)/2;
        foreach ($lengths as $i=>$length) {
            if ($remaining <= $length && $length > 0) {
                $ratio = $remaining/$length;
                return [$route[$i][0]+($route[$i+1][0]-$route[$i][0])*$ratio, $route[$i][1]+($route[$i+1][1]-$route[$i][1])*$ratio];
            }
            $remaining -= $length;
        }
        return $route[0];
    }
}
