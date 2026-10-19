<?php

namespace App\Services;

use App\Models\NetworkCable;
use App\Models\NetworkNode;
use Illuminate\Validation\ValidationException;

/** Read stored geometry only. No telemetry, OLT commands, or inventory writes. */
class TopologyConnectionGeometry
{
    public function point(mixed $value): ?array
    {
        if (!is_array($value)) return null;
        $lat = $value['lat'] ?? $value['latitude'] ?? $value[0] ?? null;
        $lng = $value['lng'] ?? $value['longitude'] ?? $value[1] ?? null;
        if (!is_numeric($lat) || !is_numeric($lng) || !is_finite((float) $lat) || !is_finite((float) $lng) || abs((float) $lat) > 90 || abs((float) $lng) > 180) return null;
        return ['lat'=>(float) $lat, 'lng'=>(float) $lng];
    }

    public function meters(array $a, array $b): float
    {
        $h = sin(deg2rad($b['lat'] - $a['lat']) / 2) ** 2 + cos(deg2rad($a['lat'])) * cos(deg2rad($b['lat'])) * sin(deg2rad($this->wrap($b['lng'] - $a['lng'])) / 2) ** 2;
        return 6371000 * 2 * asin(sqrt(min(1, max(0, $h))));
    }

    private function wrap(float $n): float { return fmod(fmod($n + 180, 360) + 360, 360) - 180; }

    public function version(array $value): string { return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION)); }

    public function node(int $id, bool $lock = false): NetworkNode
    {
        $query = NetworkNode::whereKey($id);
        $node = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($node && $this->point($node->getAttributes()), 409, 'Node tidak tersedia atau GPS berubah/tidak valid. Muat ulang pratinjau.');
        return $node;
    }

    public function nodeOption(NetworkNode $node): array
    {
        return ['id'=>$node->id, 'name'=>$node->name, 'code'=>$node->code, 'node_type'=>$node->node_type,
            'point'=>$this->point($node->getAttributes()), 'version'=>$this->version($node->getAttributes()),
            'olt_device_id'=>$node->olt_device_id, 'pon'=>$node->olt_port_ref];
    }

    private function route(NetworkCable $cable, bool $lock): array
    {
        $raw = $cable->route_coordinates;
        if (is_string($raw)) $raw = json_decode($raw, true);
        if ($raw === null || $raw === []) {
            $a = $cable->from_node_id ? $this->node($cable->from_node_id, $lock) : null;
            $b = $cable->to_node_id ? $this->node($cable->to_node_id, $lock) : null;
            $raw = $a && $b ? [$this->point($a->getAttributes()), $this->point($b->getAttributes())] : [];
        }
        $points = is_array($raw) ? array_map(fn ($p) => $this->point($p), $raw) : [];
        abort_unless(count($points) >= 2 && !in_array(null, $points, true) && count(array_filter($points, fn ($p) => $p && $this->meters($points[0], $p) > 0.01)), 409, 'Rute kabel belum valid. Muat ulang atau lengkapi rute terlebih dahulu.');
        return $points;
    }

    private function nearest(array $p, array $route): array
    {
        $nearest = null; $along = 0;
        for ($i=1; $i<count($route); $i++) {
            $a=$route[$i-1]; $b=$route[$i]; $cos=max(1e-8, cos(deg2rad($p['lat'])));
            $ax=deg2rad($this->wrap($a['lng']-$p['lng']))*6371000*$cos; $ay=deg2rad($a['lat']-$p['lat'])*6371000;
            $dx=deg2rad($this->wrap($b['lng']-$a['lng']))*6371000*$cos; $dy=deg2rad($b['lat']-$a['lat'])*6371000;
            $squared=$dx*$dx+$dy*$dy; $f=$squared ? max(0,min(1,-($ax*$dx+$ay*$dy)/$squared)) : 0;
            $hit=['lat'=>$a['lat']+($b['lat']-$a['lat'])*$f,'lng'=>$this->wrap($a['lng']+$this->wrap($b['lng']-$a['lng'])*$f)];
            $distance=$this->meters($p,$hit); $length=$this->meters($a,$b);
            if (!$nearest || $distance<$nearest['distance']) $nearest=['point'=>$hit,'distance'=>$distance,'position_meters'=>$along+$length*$f];
            $along+=$length;
        }
        return $nearest;
    }

    public function prepare(string $id, int $tolerance, bool $lock = false): array
    {
        $patterns=['endpoint_node'=>'/^endpoint-node:([1-9]\d*):([01]):([1-9]\d*)$/', 'node_route'=>'/^node-route:([1-9]\d*):([1-9]\d*)$/',
            'cable_endpoint'=>'/^cable-end:([1-9]\d*):([01]):([1-9]\d*):([01])$/', 'cable_branch'=>'/^cable-branch:([1-9]\d*):([01]):([1-9]\d*)$/'];
        $kind=null; $parts=[];
        foreach ($patterns as $k=>$pattern) if (preg_match($pattern,$id,$parts)) { $kind=$k; break; }
        if (!$kind) throw ValidationException::withMessages(['candidate_id'=>'Identitas calon hubungan tidak valid.']);
        $nodeId=match($kind) { 'endpoint_node'=>(int)$parts[3], 'node_route'=>(int)$parts[2], default=>null };
        $ids=in_array($kind,['endpoint_node','node_route']) ? [(int)$parts[1]] : [(int)$parts[1],(int)$parts[3]];
        if (count(array_unique($ids))!==count($ids)) throw ValidationException::withMessages(['candidate_id'=>'Kabel tidak boleh dihubungkan ke dirinya sendiri.']);
        if ($kind==='cable_endpoint' && $ids[0]>$ids[1]) throw ValidationException::withMessages(['candidate_id'=>'Urutan kabel tidak valid. Muat ulang pratinjau.']);
        $query=NetworkCable::whereIn('id',$ids)->orderBy('id'); $models=($lock?$query->lockForUpdate():$query)->get()->keyBy('id');
        abort_unless($models->count()===count($ids),409,'Kabel sudah berubah atau dihapus. Muat ulang pratinjau.');
        $cables=[]; $versions=[]; $tokens=['cables'=>[], 'nodes'=>[]];
        foreach ($ids as $cableId) {
            $c=$models[$cableId]; $route=$this->route($c,$lock);
            $cables[$cableId]=['id'=>$c->id,'label'=>trim(($c->code ? $c->code.' · ' : '').$c->name),'route'=>$route,'core_count_total'=>(int)$c->core_count_total,'status'=>$c->status];
            $versions[]=['cable'=>$c->getAttributes(),'route'=>$route];
            $tokens['cables'][$c->id]=$this->version($c->getAttributes());
            if (!$c->route_coordinates || $c->route_coordinates === '[]') foreach (array_filter([$c->from_node_id,$c->to_node_id]) as $fallbackId) {
                $fallback=$this->node($fallbackId,$lock);$tokens['nodes'][$fallbackId]=$this->version($fallback->getAttributes());
            }
        }
        $node=$nodeId ? $this->node($nodeId,$lock) : null;
        if ($node) $versions[]=['node'=>$node->getAttributes()];
        if ($node) $tokens['nodes'][$node->id]=$this->version($node->getAttributes());
        $first=$cables[$ids[0]]; $route=$first['route']; $last=count($route)-1;
        $nodeSide=$node ? ['kind'=>'node','node_id'=>$node->id,'label'=>($node->code ? $node->code.' · ' : '').$node->name,'point'=>$this->point($node->getAttributes())] : null;
        $end=(int)($kind==='node_route'?0:$parts[2]);
        $sideA=['kind'=>'cable','cable_id'=>$ids[0],'end'=>$end,'label'=>$first['label'].' · Ujung '.($end+1),'point'=>$route[$end?$last:0], 'position_meters'=>$end?array_sum(array_map(fn($i)=>$this->meters($route[$i-1],$route[$i]),range(1,$last))):0];
        if ($kind==='endpoint_node') $sideB=$nodeSide;
        elseif ($kind==='node_route') {
            $hit=$this->nearest($nodeSide['point'],$route); $sideA=$nodeSide;
            $sideB=['kind'=>'cable','cable_id'=>$ids[0],'label'=>$first['label'].' · Tengah rute','point'=>$hit['point'],'position_meters'=>$hit['position_meters']];
            abort_if($this->meters($sideA['point'],$route[0])<=$tolerance || $this->meters($sideA['point'],$route[$last])<=$tolerance,409,'Calon telah menjadi hubungan ujung kabel. Muat ulang pratinjau.');
        } else {
            $second=$cables[$ids[1]]; $other=$second['route']; $otherLast=count($other)-1;
            if ($kind==='cable_endpoint') { $endB=(int)$parts[4]; $sideB=['kind'=>'cable','cable_id'=>$ids[1],'end'=>$endB,'label'=>$second['label'].' · Ujung '.($endB+1),'point'=>$other[$endB?$otherLast:0],'position_meters'=>$endB?array_sum(array_map(fn($i)=>$this->meters($other[$i-1],$other[$i]),range(1,$otherLast))):0]; }
            else {
                abort_if($this->meters($sideA['point'],$other[0])<=$tolerance || $this->meters($sideA['point'],$other[$otherLast])<=$tolerance,409,'Calon telah menjadi hubungan ujung antarkabel. Muat ulang pratinjau.');
                $hit=$this->nearest($sideA['point'],$other); $sideB=['kind'=>'cable','cable_id'=>$ids[1],'label'=>$second['label'].' · Tengah rute','point'=>$hit['point'],'position_meters'=>$hit['position_meters']];
            }
        }
        $distance=$this->meters($sideA['point'],$sideB['point']);
        abort_if($distance>$tolerance+0.001,409,'Koordinat tidak lagi memenuhi toleransi calon ini. Muat ulang pratinjau.');
        $options=$node ? collect([$node]) : NetworkNode::whereNotNull('latitude')->whereNotNull('longitude')->orderBy('id')->get()->filter(function($n)use($sideA,$sideB){$p=$this->point($n->getAttributes());return $p && $this->meters($p,$sideA['point'])<=100 && $this->meters($p,$sideB['point'])<=100;});
        return ['candidate_id'=>$id,'kind'=>$kind,'title'=>$sideA['label'].' ↔ '.$sideB['label'],'a'=>$sideA,'b'=>$sideB,'node_id'=>$nodeId,
            'cables'=>array_values($cables),'distance_meters'=>$distance,'tolerance_meters'=>$tolerance,
            'source_version'=>$this->version(['candidate_id'=>$id,'tolerance'=>$tolerance,'sources'=>$versions]),
            'source_tokens'=>$tokens,
            'junction_nodes'=>$options->map(fn($n)=>$this->nodeOption($n))->values()->all()];
    }
}
