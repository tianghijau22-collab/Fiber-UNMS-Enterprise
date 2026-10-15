<?php

namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\OltHealthMonitor as Monitor;
use App\Services\Olt\OltPollingHealth as PollHealth;
use App\Services\Olt\OnuTelemetrySample as Sample;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Console\Commands\PollOltTelemetry;
use App\Http\Controllers\OltController;
use App\Http\Controllers\ServerMonitoringController;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

class OltMonitoringHealthTest extends TestCase
{
    private function at(int $ago=0): string {return now()->subSeconds($ago)->format('Y-m-d\TH:i:s.uP');}
    private function network(bool $up=true): array
    {
        return Monitor::networkEvidence($up ? [['ifname'=>'ppp0','flags'=>['UP','LOWER_UP'],'operstate'=>'UNKNOWN',
            'addr_info'=>[['local'=>'10.254.0.1','address'=>'10.254.0.2']]]] : [],
            [['dst'=>'default','dev'=>'eth0'],...($up ? [['dst'=>'10.11.0.0/16','dev'=>'ppp0']]:[])],'10.254.0.1');
    }
    private function row(?bool $online=true,?float $rx=-25): array
    {
        return ['serial_number'=>'TEST00000001','port'=>'gpon-olt_1/1/15','onu_id'=>'1',
            'identity_source'=>Identity::SOURCE,'identity_observed_at'=>$this->at(),
            ...Sample::normalize(['is_online'=>$online,'rx_power'=>$rx],$this->at())];
    }
    private function olt(array $rows=[]): OltDevice
    {
        return (new OltDevice(['id'=>1,'name'=>'Fixture','ip_address'=>'10.11.11.90','connection_mode'=>'live',
            'vendor'=>'ZTE','vendor_key'=>'zte','status'=>'active','last_telemetry_snapshot'=>['polled_at'=>$this->at(),'onu_list'=>$rows]]))->forceFill(['id'=>1]);
    }
    private function attempt(int $ago=0): array
    {
        return ['attempt_id'=>'fixture','phase'=>'FINISHED','result'=>'SUCCESS','finished_at'=>$this->at($ago),
            'connection'=>['status'=>'RESPONDING','checked_at'=>$this->at($ago),'latency_ms'=>25]];
    }
    private function observer(string $response='RESPONDING'): PollHealth
    {
        $net=$this->network();
        app()->instance(Monitor::class,new class($net) extends Monitor {
            public function __construct(private array $fixture){}
            public function network(): array {return $this->fixture;}
        });
        return new class($response) extends PollHealth {
            public function __construct(private string $response){}
            protected function probe(OltDevice $olt,array $network): array
            {return ['status'=>$this->response,'checked_at'=>Sample::timestamp(),'latency_ms'=>null,'reason'=>$this->response==='NO_RESPONSE' ? 'snmp_no_response':null];}
        };
    }
    private function controller(array $reports=[],string $service='RUNNING',string $vpn='AVAILABLE'): ServerMonitoringController
    {
        $c=new class extends ServerMonitoringController {
            public function fixture(array $v): void {$this->monitoringHealth=$v;}
            public function worker(): array {return $this->getWorkerMetrics();}
            public function listener(): array {return $this->getSnmpTrapMetrics();}
        };
        $c->fixture(['vpn'=>['status'=>$vpn],'devices'=>$reports,'checked_at'=>$this->at(),
            'poller_service'=>['status'=>$service],'listener_service'=>['status'=>$service]]);return $c;
    }

    public function test_missing_vpn_overrides_recent_success_without_declaring_customer_offline(): void
    {
        $r=Monitor::device($this->olt([$this->row()]),$this->network(false),$this->attempt());
        $this->assertSame('PATH_UNAVAILABLE',$r['connection']['status']);$this->assertSame('FAILED',$r['status']);
        $this->assertNull($r['connection']['latency_ms']);$this->assertSame('FRESH',$r['data_health']['status']);
        $this->assertTrue($this->row()['is_online']);
    }
    public function test_default_route_or_more_specific_blackhole_cannot_establish_private_olt_path(): void
    {
        $n=$this->network();$n['routes']=[['dst'=>'default','dev'=>'eth0']];
        $this->assertSame('UNAVAILABLE',Monitor::routeStatus('10.11.11.90',$n));
        $n=$this->network();$n['routes'][]=['dst'=>'10.11.11.90/32','type'=>'blackhole'];
        $this->assertSame('UNAVAILABLE',Monitor::routeStatus('10.11.11.90',$n));
    }
    public function test_interface_up_is_not_a_device_response_or_vpn_latency_measurement(): void
    {
        $n=$this->network();$this->assertSame('AVAILABLE',$n['status']);$this->assertNull($n['peer_latency_ms']);
        $r=Monitor::device($this->olt(),$n,[]);$this->assertSame('UNKNOWN',$r['connection']['status']);$this->assertSame('UNKNOWN',$r['status']);
        $this->assertSame('UNKNOWN',Monitor::networkEvidence(null,null,'10.254.0.1')['status']);
    }
    public function test_old_response_expires_independently_from_fresh_customer_data(): void
    {
        $r=Monitor::device($this->olt([$this->row()]),$this->network(),$this->attempt(181));
        $this->assertSame('UNKNOWN',$r['connection']['status']);$this->assertSame('STALE',$r['status']);
        $this->assertSame('FRESH',$r['data_health']['status']);$this->assertNull($r['connection']['latency_ms']);
    }
    public function test_new_snapshot_timestamp_does_not_refresh_old_or_undated_samples(): void
    {
        $old=$this->row();$old['sample_observed_at']=$this->at(181);$missing=$this->row();unset($missing['sample_observed_at']);
        $d=Monitor::data(['polled_at'=>$this->at(),'onu_list'=>[$old,$missing]]);
        $this->assertSame('STALE',$d['status']);$this->assertSame(0,$d['fresh_samples']);$this->assertSame(1,$d['missing_samples']);
        $this->assertSame(1,$d['stale_samples']);
    }
    public function test_age_bounds_future_and_missing_samples_and_partial_state_are_honest(): void
    {
        $future=$this->row();$future['sample_observed_at']=$this->at(-20);
        $d=Monitor::data(['onu_list'=>[$this->row(null,null),$this->row(true,null),$future]]);
        $this->assertSame('PARTIAL',$d['status']);$this->assertSame(1,$d['unknown_state']);
        $this->assertSame(1,$d['rx_missing_online']);$this->assertFalse($d['complete']);
    }
    public function test_failed_state_walk_does_not_count_preserved_inventory_as_success(): void
    {
        $o=$this->observer();$d=$this->olt([$this->row()]);$o->begin($d,'slot_parallel');
        $this->assertSame('FAILED',$o->read(1,[$this->row()],0));$a=$o->finish($d,0);
        $this->assertSame('FAILED',$a['result']);$this->assertSame(0,$a['rows_read']);
    }
    public function test_working_without_rx_and_unknown_state_are_partial_not_failed_transport(): void
    {
        $o=$this->observer();$d=$this->olt();$o->begin($d,'slot_parallel');
        $this->assertSame('PARTIAL',$o->read(1,[$this->row(true,null),$this->row(null,null)],2));
        $a=$o->finish($d,0);$this->assertSame('RESPONDING',$a['connection']['status']);$this->assertSame('PARTIAL',$a['result']);
    }
    public function test_known_offline_with_no_rx_can_be_a_complete_read(): void
    {
        $o=$this->observer();$d=$this->olt();$o->begin($d,'global_bulk');
        $this->assertSame('SUCCESS',$o->read(1,[$this->row(false,null)],1));
        $this->assertSame('SUCCESS',$o->finish($d,0)['result']);
    }
    public function test_nonzero_return_code_and_no_read_evidence_cannot_report_success(): void
    {
        $o=$this->observer();$d=$this->olt();$o->begin($d,'slot_parallel');$o->read(1,[$this->row()],1);
        $this->assertSame('FAILED',$o->finish($d,1)['result']);
        $o->begin($d,'slot_parallel');$this->assertSame('UNKNOWN',$o->finish($d,0)['result']);
    }
    public function test_lost_snmp_response_is_distinct_from_a_successful_function_return(): void
    {
        $o=$this->observer('NO_RESPONSE');$d=$this->olt();$o->begin($d,'slot_parallel');$o->read(1,[$this->row()],1);
        $a=$o->finish($d,0);$this->assertSame('FAILED',$a['result']);$this->assertSame('NO_RESPONSE',$a['connection']['status']);
    }
    public function test_partial_port_scope_and_rejected_samples_are_not_full_device_success(): void
    {
        $o=$this->observer();$d=$this->olt();$o->begin($d,'per_port');$this->assertSame('PARTIAL',$o->read(1,[$this->row()],null));$o->finish($d,0);
        $o->begin($d,'global_bulk');$this->assertSame('PARTIAL',$o->read(1,[$this->row()],1,['rejected'=>1]));
    }
    public function test_previous_attempt_cannot_overwrite_newer_concurrent_monitoring(): void
    {
        $a=$this->observer();$b=$this->observer();$d=$this->olt();$a->begin($d,'global_bulk');$b->begin($d,'slot_parallel');
        $latest=Cache::get('olt_poll_health_v1_1');$a->finish($d,1);
        $this->assertSame($latest,Cache::get('olt_poll_health_v1_1'));
    }
    public function test_empty_worker_cache_has_no_fabricated_run_time_counts_or_success(): void
    {
        $c=$this->controller([], 'STOPPED');$a=$c->worker();
        $this->assertSame('STOPPED',$a['status']);$this->assertSame('UNKNOWN',$a['cycle_result']);
        $this->assertNull($a['last_run_at']);$this->assertNull($a['cycle_duration_ms']);$this->assertNull($a['total_ports_polled']);
        $this->assertSame(0,$a['total_onus_polled']);$this->assertSame([],$a['device_reports']);
    }
    public function test_old_cache_status_cannot_override_service_state_or_new_device_evidence(): void
    {
        Cache::put('backend_worker_telemetry',['status'=>'ACTIVE','device_reports'=>[['device_id'=>1,'status'=>'SUCCESS']]],100);
        Cache::put('backend_worker_history',[['status'=>'OK']],100);
        $r=Monitor::device($this->olt([$this->row()]),$this->network(false),$this->attempt());
        $a=$this->controller([$r],'STOPPED','DISCONNECTED')->worker();
        $this->assertSame('STOPPED',$a['status']);$this->assertSame('FAILED',$a['device_reports'][0]['status']);
        $this->assertSame('UNKNOWN',$a['history'][0]['status']);
    }
    public function test_listener_heartbeat_does_not_invent_two_open_ports_or_alarm_delivery(): void
    {
        Cache::put('snmp_trap_listener_heartbeat',time(),30);
        Cache::put('snmp_trap_listener_status',['trap_active'=>true,'syslog_active'=>false],100);
        $a=$this->controller([],'RUNNING','DISCONNECTED')->listener();
        $this->assertSame('LISTENING',$a['ports']['trap_162']['status']);$this->assertSame('CLOSED',$a['ports']['syslog_514']['status']);
        $this->assertSame('UNVERIFIED',$a['health']);$this->assertSame('UNVERIFIED',$a['alarm_delivery_status']);
        Cache::put('snmp_trap_listener_heartbeat',time()-60,100);
        $this->assertSame('UNKNOWN',$this->controller()->listener()['ports']['trap_162']['status']);
    }
    public function test_stopped_process_does_not_leave_an_attempt_displayed_as_running(): void
    {
        $a=$this->attempt();$a['phase']='READING';$a['started_at']=$this->at(30);
        $r=Monitor::device($this->olt(),$this->network(),$a);
        $this->assertSame('IN_PROGRESS',$r['status']);
        $data=$this->controller([$r],'STOPPED')->worker()['device_reports'][0];
        $this->assertSame('UNKNOWN',$data['status']);$this->assertNull($data['query_elapsed_seconds']);
        $this->assertSame('UNCONFIRMED',$data['poll']['phase']);
    }
    public function test_conflicting_hardware_locations_are_not_counted_as_resolved_identity(): void
    {
        $a=$this->row();$b=$a;$b['port']='gpon-olt_1/1/16';
        $d=Monitor::data(['onu_list'=>[$a,$b]]);
        $this->assertSame(2,$d['identity_unresolved']);$this->assertFalse($d['complete']);
    }
    public function test_fewer_observations_than_expected_inventory_remains_partial(): void
    {
        $a=$this->row();$b=$a;$b['serial_number']='TEST00000002';$b['onu_id']='2';
        $d=$this->olt([$a,$b]);$o=$this->observer();$o->begin($d,'slot_parallel');
        $this->assertSame('PARTIAL',$o->read(1,[$a],1));
    }
    public function test_non_live_device_does_not_require_vpn_or_claim_real_hardware_response(): void
    {
        $d=$this->olt();$d->connection_mode='simulation';
        $a=Monitor::device($d,$this->network(false),$this->attempt());
        $this->assertSame('NOT_LIVE',$a['status']);$this->assertSame('NOT_LIVE',$a['connection']['status']);
        $this->assertSame('NOT_REQUIRED',$a['connection']['route_status']);
    }
    public function test_malformed_legacy_cache_cannot_create_success_or_break_health_response(): void
    {
        Cache::put('backend_worker_telemetry','invalid',100);Cache::put('backend_worker_history',['invalid'],100);
        Cache::put('snmp_trap_listener_status','invalid',100);
        $c=$this->controller();$this->assertSame('UNKNOWN',$c->worker()['cycle_result']);$this->assertSame([],$c->worker()['history']);
        Cache::put('snmp_trap_listener_heartbeat',time(),30);
        $this->assertSame('UNKNOWN',$c->listener()['ports']['trap_162']['status']);
    }
    public function test_dispatcher_propagates_swallowed_inner_failure_into_report_and_history(): void
    {
        $this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Schema::create('olt_devices',function(Blueprint $t){$t->id();foreach(['name','vendor','vendor_key','ip_address','connection_mode','status'] as $c)$t->string($c);$t->json('last_telemetry_snapshot')->nullable();$t->timestamps();});
        DB::table('olt_devices')->insert(['id'=>1,'name'=>'Fixture','vendor'=>'ZTE','vendor_key'=>'zte','ip_address'=>'10.11.11.90','connection_mode'=>'live','status'=>'active','last_telemetry_snapshot'=>json_encode(['onu_list'=>[$this->row()],'pon_ports'=>[]])]);
        foreach(['last_mass_client_down_check_ts','last_hardware_sfp_pulse_ts','last_audit_logs_auto_prune_ts'] as $k)Cache::put($k,time(),100);
        app()->instance(PollHealth::class,$this->observer());
        $cmd=new class extends PollOltTelemetry {
            protected function pollSlotParallelTelemetry(int $id,OltController $c): int{return 1;}
            public function runFixture(): int{return $this->dispatchSinglePortParallel(new OltController(),'slot_parallel');}
        };
        $cmd->setOutput(new \Illuminate\Console\OutputStyle(new \Symfony\Component\Console\Input\ArrayInput([]),new \Symfony\Component\Console\Output\BufferedOutput()));
        $cmd->runFixture();$stats=Cache::get('backend_worker_telemetry');
        $this->assertSame('FAILED',$stats['device_reports'][0]['status']);$this->assertSame(1,$stats['device_reports'][0]['return_code']);
        $this->assertSame('FAILED',$stats['cycle_result']);$this->assertSame('FAILED',Cache::get('backend_worker_history')[0]['status']);
    }
}
