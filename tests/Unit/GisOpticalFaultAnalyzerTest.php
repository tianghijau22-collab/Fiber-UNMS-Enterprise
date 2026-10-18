<?php

namespace Tests\Unit;

use App\Services\GisOpticalFaultAnalyzer as Analyzer;
use PHPUnit\Framework\TestCase;

class GisOpticalFaultAnalyzerTest extends TestCase
{
    private int $now = 1800000000;

    private function view(?bool $online = true, ?float $rx = -24): array
    {
        return ['identity_status'=>'resolved', 'telemetry_freshness'=>'fresh', 'is_online'=>$online,
            'rx_power'=>$rx, 'rx_available'=>$rx !== null, 'sampled_at'=>gmdate(DATE_ATOM,$this->now-20),
            'olt_id'=>1, 'gpon_interface'=>'gpon-olt_1/3/1'];
    }

    private function node(int $id, string $state = 'no_rx'): array
    {
        $views = [$this->view(true,$state === 'signal' ? -34.5 : null)];
        return ['id'=>$id, 'name'=>'ODP '.$id, 'node_type'=>'ODP', 'status'=>'active',
            'latitude'=>-0.8, 'longitude'=>100.6+$id/1000, 'best_rx_power'=>$state === 'signal' ? -34.5 : null,
            'optical_evidence'=>Analyzer::evidence($views,1,$this->now)];
    }

    private function cable(int $from, int $to, int $id = 1): array
    {
        return ['id'=>$id,'from_node_id'=>$from,'to_node_id'=>$to,'status'=>'active','route_coordinates'=>null];
    }

    private function analyze(array $nodes, array $cables): array { return Analyzer::analyze($nodes,$cables,$this->now); }

    public function test_online_with_empty_rx_and_offline_both_make_all_na_but_keep_raw_state_unchanged(): void
    {
        $views=[$this->view(true,null),$this->view(false,null)];$before=$views;
        $e=Analyzer::evidence($views,2,$this->now);
        $this->assertSame('no_rx',$e['state']);$this->assertSame(2,$e['no_rx_clients']);$this->assertSame(0,$e['unverified_clients']);$this->assertSame($before,$views);
        $this->assertSame('signal',Analyzer::evidence([$this->view(true,-35.5),...$views],3,$this->now)['state']);
        $this->assertSame('signal',Analyzer::evidence([$this->view(true,0)],1,$this->now)['state']);
    }

    public function test_missing_clients_stale_unresolved_or_unknown_states_cannot_prove_all_na(): void
    {
        $this->assertSame('empty',Analyzer::evidence([],0,$this->now)['state']);
        $this->assertSame('unknown',Analyzer::evidence([$this->view(true,null)],2,$this->now)['state']);
        foreach ([['identity_status'=>'unresolved'],['telemetry_freshness'=>'stale'],['is_online'=>null],['sampled_at'=>null],['sampled_at'=>gmdate(DATE_ATOM,$this->now-181)],['sampled_at'=>gmdate(DATE_ATOM,$this->now+6)]] as $changes) {
            $e=Analyzer::evidence([array_replace($this->view(true,null),$changes)],1,$this->now);
            $this->assertSame('unknown',$e['state']);$this->assertSame(1,$e['unverified_clients']);
        }
    }

    public function test_real_cable_order_locates_last_signal_to_first_na_and_whole_downstream_tail(): void
    {
        $nodes=[$this->node(99,'signal'),$this->node(2),$this->node(1)];
        // IDs and input order are unrelated to cable order; reversed endpoint storage works too.
        $cables=[$this->cable(2,99),$this->cable(1,2,2)];$before=[$nodes,$cables];
        $out=$this->analyze($nodes,$cables);$this->assertCount(1,$out['faults']);$f=$out['faults'][0];
        $this->assertSame(99,$f['last_signal_node']['id']);$this->assertSame(2,$f['first_no_rx_node']['id']);
        $this->assertSame([2,1],$f['affected_node_ids']);$this->assertSame(2,$f['affected_clients']);$this->assertSame('between_nodes',$f['route_source']);
        $this->assertSame($before,[$nodes,$cables]);
    }

    public function test_branch_with_a_working_odp_further_down_is_not_a_total_downstream_cut(): void
    {
        $nodes=[$this->node(1,'signal'),$this->node(2),$this->node(3,'signal')];
        $this->assertSame([],$this->analyze($nodes,[$this->cable(1,2),$this->cable(2,3,2)])['faults']);
    }

    public function test_unknown_empty_or_maintenance_downstream_cannot_be_treated_as_a_broken_tail(): void
    {
        foreach (['unknown','empty','maintenance'] as $state) {
            $n=$this->node(3);
            if ($state==='maintenance') $n['status']='maintenance';
            else $n['optical_evidence']=Analyzer::evidence([],$state==='empty'?0:1,$this->now);
            $this->assertSame([],$this->analyze([$this->node(1,'signal'),$this->node(2),$n],[$this->cable(1,2),$this->cable(2,3,2)])['faults']);
        }
    }

    public function test_all_na_branches_are_collected_without_inventing_order_between_siblings(): void
    {
        $nodes=[$this->node(1,'signal'),$this->node(2),$this->node(3),$this->node(4)];
        $out=$this->analyze($nodes,[$this->cable(1,2),$this->cable(2,3,2),$this->cable(2,4,3)]);
        $this->assertCount(1,$out['faults']);$this->assertSame(3,$out['faults'][0]['affected_odps']);
    }

    public function test_rings_and_parallel_feeds_cannot_produce_a_unique_break_location(): void
    {
        $nodes=[$this->node(1,'signal'),$this->node(2),$this->node(3)];
        $this->assertSame([],$this->analyze($nodes,[$this->cable(1,2),$this->cable(2,3,2),$this->cable(3,1,3)])['faults']);
        $this->assertSame([],$this->analyze(array_slice($nodes,0,2),[$this->cable(1,2),$this->cable(1,2,2)])['faults']);
    }

    public function test_other_or_mixed_pon_and_expired_evidence_cannot_localize_a_cut(): void
    {
        foreach ([['2:1/3/1'],['1:1/3/2'],['1:1/3/1','1:1/3/2'],[]] as $keys) {
            $node=$this->node(2);$node['optical_evidence']['pon_keys']=$keys;
            $this->assertSame([],$this->analyze([$this->node(1,'signal'),$node],[$this->cable(1,2)])['faults']);
        }
        $node=$this->node(2);$node['optical_evidence']['valid_until']=gmdate(DATE_ATOM,$this->now-1);
        $this->assertSame([],$this->analyze([$this->node(1,'signal'),$node],[$this->cable(1,2)])['faults']);
    }

    public function test_unlinked_routes_and_sibling_parentage_never_invent_cable_connections(): void
    {
        $nodes=[$this->node(1,'signal'),$this->node(2)];foreach($nodes as &$n)$n['parent_node_id']=8;unset($n);
        $out=$this->analyze($nodes,[['id'=>1,'from_node_id'=>null,'to_node_id'=>null],$this->cable(1,999,2)]);
        $this->assertSame([],$out['faults']);$this->assertSame(1,$out['coverage']['unlinked_routes']);$this->assertSame(1,$out['coverage']['invalid_routes']);
    }

    public function test_inspection_landmark_follows_recorded_route_and_invalid_geometry_never_produces_a_false_pin(): void
    {
        $c=$this->cable(1,2);$c['route_coordinates']=[[0,100],[0,100.01],[0,100.04]];
        $f=$this->analyze([$this->node(1,'signal'),$this->node(2)],[$c])['faults'][0];
        $this->assertSame('recorded_route',$f['route_source']);$this->assertEqualsWithDelta(100.02,$f['inspection_point'][1],0.000001);
        $c['route_coordinates']='[[999,100],[0,100.04]]';$nodes=[$this->node(1,'signal'),$this->node(2)];
        foreach($nodes as &$n){$n['latitude']=null;$n['longitude']=null;}unset($n);
        $f=$this->analyze($nodes,[$c])['faults'][0];$this->assertNull($f['inspection_point']);$this->assertSame([],$f['route_coordinates']);
    }
}
