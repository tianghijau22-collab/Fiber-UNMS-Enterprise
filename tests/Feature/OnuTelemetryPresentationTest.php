<?php

namespace Tests\Feature;

use App\Http\Controllers\CustomerController;
use App\Http\Controllers\NetworkNodeController;
use App\Models\NetworkNode;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OnuTelemetryPresentationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Http::fake();Http::preventStrayRequests();
        Schema::create('olt_devices',function(Blueprint $t){$t->id();foreach(['name','vendor_key','connection_mode','status','ip_address','code'] as $f)$t->string($f)->nullable();$t->text('last_telemetry_snapshot')->nullable();});
        Schema::create('customers',function(Blueprint $t){$t->id();$t->string('name');$t->string('customer_number');$t->string('phone')->nullable();$t->timestamps();$t->softDeletes();});
        Schema::create('customer_services',function(Blueprint $t){$t->id();$t->integer('customer_id');$t->integer('service_package_id')->nullable();foreach(['service_number','status','sobok_service_status','sobok_profile','ip_address','onu_serial'] as $f)$t->string($f)->nullable();$t->timestamp('sobok_sync_at')->nullable();$t->softDeletes();});
        Schema::create('service_packages',function(Blueprint $t){$t->id();$t->string('name')->nullable();});
        Schema::create('splitter_types',function(Blueprint $t){$t->id();$t->string('name')->nullable();$t->string('ratio')->nullable();$t->integer('output_ports')->nullable();});
        Schema::create('network_nodes',function(Blueprint $t){$t->id();foreach(['name','node_type','status','code','olt_port_ref'] as $f)$t->string($f)->nullable();foreach(['parent_node_id','olt_device_id','splitter_type_id','total_ports','used_ports'] as $f)$t->integer($f)->nullable();$t->timestamps();$t->softDeletes();});
        Schema::create('network_ports',function(Blueprint $t){$t->id();$t->integer('node_id');$t->integer('customer_service_id')->nullable();foreach(['port_number','port_type','status','customer_name_cache','notes','destination_label'] as $f)$t->string($f)->nullable();});
        Schema::create('ont_registrations',function(Blueprint $t){$t->id();$t->integer('customer_service_id');$t->integer('olt_port_id')->nullable();foreach(['onu_serial','onu_mac','onu_type','status'] as $f)$t->string($f)->nullable();$t->float('rx_power')->nullable();$t->float('tx_power')->nullable();$t->timestamp('last_online_at')->nullable();$t->timestamps();$t->softDeletes();});
        DB::table('network_nodes')->insert(['id'=>1,'name'=>'Fixture ODP','node_type'=>'ODP','status'=>'active','olt_device_id'=>1,'olt_port_ref'=>'gpon-olt_1/1/15','total_ports'=>3,'used_ports'=>2]);
        foreach([1,2] as $id){
            DB::table('customers')->insert(['id'=>$id,'name'=>'Fixture '.$id,'customer_number'=>'FIX-'.$id]);
            DB::table('customer_services')->insert(['id'=>$id,'customer_id'=>$id,'sobok_service_status'=>'OPEN']);
            DB::table('network_ports')->insert(['id'=>$id,'node_id'=>1,'customer_service_id'=>$id,'port_number'=>$id,'status'=>'used']);
            DB::table('ont_registrations')->insert(['id'=>1700+$id,'customer_service_id'=>$id,'onu_serial'=>'TEST0000000'.$id,'status'=>'active','rx_power'=>0]);
        }
        DB::table('network_ports')->insert(['id'=>3,'node_id'=>1,'port_number'=>3,'status'=>'available']);
        $row=['serial_number'=>'TEST00000001','port'=>'gpon-olt_1/1/16','onu_id'=>'1','status'=>'Online','rx_power'=>-26.2,'_source'=>'live_snmp','identity_source'=>Identity::SOURCE,'identity_observed_at'=>date(DATE_ATOM)];
        $row=array_replace($row,\App\Services\Olt\OnuTelemetrySample::normalize($row,date(DATE_ATOM)));
        foreach([1,2] as $id){
            $r=$row;if($id===2){$r['port']='gpon-olt_1/1/3';$r['rx_power']=-20;}
            DB::table('olt_devices')->insert(['id'=>$id,'name'=>'Fixture OLT '.$id,'vendor_key'=>'zte-c320','connection_mode'=>'live','status'=>'active','last_telemetry_snapshot'=>json_encode(['polled_at'=>date(DATE_ATOM),'onu_list'=>[$r]])]);
        }
    }

    private function customers(): array
    {
        return app(CustomerController::class)->index(Request::create('/api/customers'))->getData(true)['data'];
    }

    private function assertStoredPortsPreserved(array $expected, array $actual): void
    {
        $this->assertCount(count($expected),$actual);
        foreach($expected as $i=>$port) {
            if($port['sample_age_seconds']!==null)$this->assertGreaterThanOrEqual($port['sample_age_seconds'],$actual[$i]['sample_age_seconds']);
            unset($expected[$i]['sample_age_seconds'],$actual[$i]['sample_age_seconds']);
        }
        $this->assertSame($expected,$actual);
    }

    public function test_customer_list_and_odp_ports_use_the_same_scoped_identity_and_unknown_contract(): void
    {
        $list=collect($this->customers())->keyBy('id');
        DB::enableQueryLog();DB::flushQueryLog();
        $response=app(NetworkNodeController::class)->portDetail(Request::create('/api/node/1/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1));
        $detail=$response->getData(true);$ports=collect($detail['ports'])->keyBy('customer_id');
        foreach([1,2] as $id)foreach(['gpon_interface','onu_id','identity_status','is_online','rx_power','rx_available','telemetry_source','sampled_at'] as $f)$this->assertSame($list[$id][$f],$ports[$id][$f],$f);
        $this->assertSame('gpon-olt_1/1/16',$ports[1]['gpon_interface']);$this->assertSame(-26.2,$ports[1]['rx_power']);
        $this->assertNull($ports[2]['is_online']);$this->assertNull($ports[2]['rx_power']);$this->assertNull($ports[2]['gpon_interface']);
        $this->assertCount(3,$detail['ports']);$this->assertSame(1,$detail['attenuation']['unknown_count']);$this->assertSame('unknown',$detail['attenuation']['signal_status']);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|delete|insert)\b/i',$q['query']))));
    }

    public function test_missing_optical_value_is_null_on_both_pages_without_database_zero_fallback(): void
    {
        $snap=json_decode(DB::table('olt_devices')->where('id',1)->value('last_telemetry_snapshot'),true);$snap['onu_list'][0]['rx_power']=null;
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snap)]);
        $list=collect($this->customers())->keyBy('id');$this->assertTrue($list[1]['is_online']);$this->assertNull($list[1]['rx_power']);
        $detail=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1))->getData(true);
        $port=collect($detail['ports'])->firstWhere('customer_id',1);$this->assertTrue($port['is_online']);$this->assertNull($port['rx_power']);
    }

    public function test_unmapped_customer_list_and_diagnostics_use_one_fresh_hardware_location_without_assigning_ports(): void
    {
        DB::table('olt_devices')->where('id',2)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[]])]);
        DB::table('network_ports')->where('customer_service_id',1)->update(['customer_service_id'=>null]);
        DB::enableQueryLog();DB::flushQueryLog();
        $c=collect($this->customers())->firstWhere('id',1);$d=app(CustomerController::class)->diagnostics(1)->getData(true);
        $this->assertSame(-26.2,$c['rx_power']);$this->assertSame('hardware_serial',$c['olt_resolution']);$this->assertSame(1,$c['olt_id']);
        $this->assertNull($c['odp_id']);$this->assertNull($c['odp_port_id']);$this->assertSame('gpon-olt_1/1/16',$c['gpon_interface']);
        $this->assertSame($c['rx_power'],$d['optical']['rx_power']);$this->assertSame($c['sampled_at'],$d['optical']['sampled_at']);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
        $this->assertNull(DB::table('network_ports')->where('id',1)->value('customer_service_id'));
    }

    public function test_unmapped_customer_with_cross_olt_serial_conflict_does_not_pick_first_or_strongest_reading(): void
    {
        DB::table('network_ports')->where('customer_service_id',1)->update(['customer_service_id'=>null]);
        $c=collect($this->customers())->firstWhere('id',1);
        $this->assertNull($c['rx_power']);$this->assertNull($c['olt_id']);$this->assertSame('olt_identity_conflict',$c['telemetry_reason']);
    }

    public function test_registration_port_owner_is_respected_when_the_service_has_no_odp(): void
    {
        DB::table('network_ports')->where('customer_service_id',1)->update(['customer_service_id'=>null]);
        DB::table('ont_registrations')->where('id',1701)->update(['olt_port_id'=>1]);
        $c=collect($this->customers())->firstWhere('id',1);
        $this->assertNull($c['odp_id']);$this->assertSame(1,$c['olt_id']);$this->assertSame(-26.2,$c['rx_power']);
        $this->assertArrayNotHasKey('olt_resolution',$c);
    }

    public function test_diagnostics_return_unavailable_history_and_icmp_instead_of_fabricated_samples(): void
    {
        $out=app(CustomerController::class)->diagnostics(2)->getData(true);
        $this->assertNull($out['optical']['rx_power']);$this->assertSame([],$out['optical']['history']);
        $this->assertNull($out['optical']['attenuation_loss_db']);$this->assertNull($out['ping']['latency_ms']);
        $this->assertFalse($out['ping']['available']);$this->assertSame(0,$out['ping']['packets_sent']);$this->assertNull($out['ping']['tested_at']);
    }

    public function test_stale_snapshot_does_not_restore_online_from_active_registration(): void
    {
        $snap=json_decode(DB::table('olt_devices')->where('id',1)->value('last_telemetry_snapshot'),true);$snap['polled_at']=date(DATE_ATOM);foreach($snap['onu_list'] as &$row){foreach(['sample_observed_at','state_observed_at','rx_observed_at'] as $field)$row[$field]=date(DATE_ATOM,time()-300);}unset($row);
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snap)]);
        $c=collect($this->customers())->firstWhere('id',1);$this->assertSame('stale',$c['telemetry_freshness']);$this->assertNull($c['is_online']);$this->assertNull($c['rx_power']);
    }

    public function test_deleted_customer_does_not_supply_live_telemetry_to_its_occupied_port(): void
    {
        DB::table('customers')->where('id',1)->update(['deleted_at'=>now()]);
        $out=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1))->getData(true);
        $port=collect($out['ports'])->firstWhere('id',1);
        $this->assertNull($port['customer_id']);$this->assertNull($port['is_online']);$this->assertNull($port['gpon_interface']);$this->assertNull($port['rx_power']);
        $this->assertCount(3,$out['ports']);
    }

    public function test_node_summary_uses_occupied_ports_instead_of_a_stale_stored_counter(): void
    {
        DB::table('network_nodes')->where('id',1)->update(['used_ports'=>99]);
        $node=NetworkNode::findOrFail(1);
        $data=(new \App\Http\Resources\NetworkNodeResource($node))->resolve(Request::create('/node'));
        $this->assertSame(2,$data['total_clients']);$this->assertSame(1,$data['unknown_clients']);$this->assertFalse($data['is_loss_total']);
    }

    public function test_busy_live_read_returns_all_ports_and_preserves_stored_sample_on_open_and_refresh(): void
    {
        DB::table('olt_devices')->where('id',1)->update(['ip_address'=>'192.0.2.239']);
        $before=DB::table('olt_devices')->where('id',1)->value('last_telemetry_snapshot');
        $stored=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1))->getData(true);
        $control=tempnam(sys_get_temp_dir(),'odp-busy-');
        $body='require '.var_export(base_path('vendor/autoload.php'),true).';$app=require '.var_export(base_path('bootstrap/app.php'),true).';$lease=App\\Services\\Olt\\OltReadLease::acquire("192.0.2.239");echo "HELD";flush();$until=microtime(true)+8;while(microtime(true)<$until&&file_get_contents('.var_export($control,true).')!=="exit"){usleep(10000);}';
        $holder=new \Symfony\Component\Process\Process([PHP_BINARY,'-r',$body],base_path());
        try {
            $holder->start();$until=microtime(true)+3;
            while(microtime(true)<$until&&!str_contains($holder->getOutput(),'HELD')) {if(!$holder->isRunning())break;usleep(1000);}
            $this->assertStringContainsString('HELD',$holder->getOutput(),$holder->getErrorOutput());
            foreach([[],['live'=>1]] as $query) {
                DB::enableQueryLog();DB::flushQueryLog();
                $response=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',$query),NetworkNode::findOrFail(1));
                $detail=$response->getData(true);
                $this->assertSame(200,$response->getStatusCode());
                $this->assertStoredPortsPreserved($stored['ports'],$detail['ports']);
                $this->assertSame($stored['attenuation'],$detail['attenuation']);
                $this->assertFalse($detail['live_probe']['success']);
                $this->assertSame('olt_busy',$detail['live_probe']['reason_code']);
                $this->assertSame([],$detail['live_probe']['probed_states']);
                $this->assertArrayNotHasKey('probed_at',$detail['live_probe']);
                $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|delete|insert)\b/i',$q['query']))));
            }
            $this->assertSame($before,DB::table('olt_devices')->where('id',1)->value('last_telemetry_snapshot'));
        } finally {
            file_put_contents($control,'exit');if($holder->isRunning())$holder->wait();unlink($control);
        }
    }

    public function test_failed_optional_probe_does_not_hide_ports_or_expose_internal_error(): void
    {
        $controller=new class extends NetworkNodeController {
            protected function probeOdpOptical(int $odpId): array { throw new \RuntimeException('private connection details'); }
        };
        $stored=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1))->getData(true);
        $out=$controller->portDetail(Request::create('/ports'),NetworkNode::findOrFail(1))->getData(true);
        $this->assertStoredPortsPreserved($stored['ports'],$out['ports']);
        $this->assertSame('live_probe_failed',$out['live_probe']['reason_code']);
        $this->assertFalse($out['live_probe']['success']);
        $this->assertStringNotContainsString('private',json_encode($out));
    }

    public function test_stored_interface_read_tracks_snapshot_updates_without_reading_hardware_or_writing_data(): void
    {
        DB::table('olt_devices')->where('id',1)->update(['ip_address'=>'invalid']);
        $q=Request::create('/api/customers/probe-interface-optical','GET',['olt_id'=>1,'interface'=>'1/1/16']);
        DB::enableQueryLog();DB::flushQueryLog();
        $d=app(CustomerController::class)->storedInterfaceOptical($q)->getData(true);
        $this->assertSame('snapshot',$d['source']);$this->assertCount(1,$d['data']);
        $this->assertSame(1,$d['data'][0]['customer_id']);$this->assertSame(-26.2,$d['data'][0]['rx_power']);
        $this->assertNull($d['summary']['probed_at']);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
        $snap=json_decode(DB::table('olt_devices')->where('id',1)->value('last_telemetry_snapshot'),true);
        $snap['onu_list'][0]=array_replace($snap['onu_list'][0],\App\Services\Olt\OnuTelemetrySample::normalize(['is_online'=>true,'rx_power'=>-22.4],date(DATE_ATOM)));
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snap)]);
        $d=app(CustomerController::class)->storedInterfaceOptical($q)->getData(true);
        $this->assertSame(-22.4,$d['data'][0]['rx_power']);$this->assertSame($snap['onu_list'][0]['sample_observed_at'],$d['data'][0]['sampled_at']);
        $other=app(CustomerController::class)->storedInterfaceOptical(Request::create('/stored','GET',['olt_id'=>2,'interface'=>'1/1/16']))->getData(true);
        $this->assertSame([],$other['data']);
    }

    public function test_stored_interface_does_not_assign_an_ambiguous_customer_binding(): void
    {
        DB::table('network_ports')->insert(['id'=>9,'node_id'=>1,'customer_service_id'=>1,'port_number'=>4,'status'=>'used']);
        $q=Request::create('/stored','GET',['olt_id'=>1,'interface'=>'1/1/16']);
        $d=app(CustomerController::class)->storedInterfaceOptical($q)->getData(true);
        $this->assertCount(1,$d['data']);$this->assertNull($d['data'][0]['customer_id']);$this->assertFalse($d['data'][0]['is_registered']);
        $this->assertSame(-26.2,$d['data'][0]['rx_power']);
    }

    public function test_stored_bts_list_and_stats_never_seed_sample_data_when_empty(): void
    {
        Schema::create('bts_sites',function(Blueprint $t){$t->id();$t->string('name');$t->float('rx_power')->nullable();$t->softDeletes();});
        $c=app(\App\Http\Controllers\BtsSiteController::class);$q=Request::create('/bts','GET',['stored_only'=>1]);
        DB::enableQueryLog();DB::flushQueryLog();
        $this->assertSame([],$c->index($q)->getData(true)['data']);
        $this->assertSame(0,$c->stats($q)->getData(true)['total_bts']);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
    }

    public function test_unavailable_read_coordination_returns_stored_ports_without_a_freshness_upgrade(): void
    {
        $controller=new class extends NetworkNodeController {
            protected function probeOdpOptical(int $odpId): array { throw new \App\Services\Olt\OltReadBusy('read_coordination_unavailable'); }
        };
        $stored=app(NetworkNodeController::class)->portDetail(Request::create('/ports','GET',['skip_live'=>1]),NetworkNode::findOrFail(1))->getData(true);
        $out=$controller->portDetail(Request::create('/ports'),NetworkNode::findOrFail(1))->getData(true);
        $this->assertStoredPortsPreserved($stored['ports'],$out['ports']);
        $this->assertSame('read_coordination_unavailable',$out['live_probe']['reason_code']);
        $this->assertFalse($out['live_probe']['success']);
    }
}
