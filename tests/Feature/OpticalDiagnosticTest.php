<?php
namespace Tests\Feature;

use App\Http\Controllers\OltController;
use App\Models\OltDevice;
use App\Services\Olt\OnuOpticalDiagnostic;
use App\Services\Olt\OnuTelemetrySample as Sample;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\SnmpWalkRunner;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Tests\TestCase;

class OpticalDiagnosticTest extends TestCase
{
    private const SN='TEST00000001';
    private object $runner;
    protected function setUp(): void
    {
        parent::setUp();$this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Schema::create('olt_devices',function(Blueprint $t){$t->id();$t->string('name');$t->string('vendor_key');$t->string('status');$t->string('connection_mode');$t->string('ip_address');$t->json('last_telemetry_snapshot')->nullable();$t->timestamps();});
        Schema::create('network_nodes',function(Blueprint $t){$t->id();$t->string('name');$t->string('type')->default('ODP');$t->integer('parent_node_id')->nullable();$t->integer('olt_device_id')->nullable();$t->integer('splitter_type_id')->nullable();$t->softDeletes();});
        Schema::create('network_ports',function(Blueprint $t){$t->id();$t->integer('node_id');$t->integer('customer_service_id')->nullable();$t->integer('port_number')->nullable();});
        Schema::create('customers',function(Blueprint $t){$t->id();$t->string('name');$t->string('customer_number');$t->softDeletes();});
        Schema::create('customer_services',function(Blueprint $t){$t->id();$t->integer('customer_id');$t->integer('service_package_id')->nullable();$t->softDeletes();});
        Schema::create('service_packages',function(Blueprint $t){$t->id();});
        Schema::create('ont_registrations',function(Blueprint $t){$t->id();$t->integer('customer_service_id');$t->integer('olt_port_id')->nullable();$t->string('onu_serial');$t->string('onu_mac')->nullable();$t->string('status')->default('active');$t->softDeletes();});
        foreach([1,2] as $id){
            DB::table('olt_devices')->insert(['id'=>$id,'name'=>'Fixture OLT '.$id,'vendor_key'=>'zte-c320','status'=>'active','connection_mode'=>'live','ip_address'=>'192.0.2.'.$id,
                'last_telemetry_snapshot'=>json_encode(['onu_list'=>[$this->row()]])]);
            DB::table('network_nodes')->insert(['id'=>$id,'name'=>'Fixture ODP '.$id,'olt_device_id'=>$id]);$this->registration($id,$id);
        }
        $this->runner=new class extends SnmpWalkRunner {
            public array $calls=[];public bool $complete=true;public bool $busy=false;public string $serial='TEST00000001';public ?string $secondary=null;public int $state=3;public ?int $rx=2500;
            public function getQueued(OltDevice $olt,array $requests,float $budget=20): array {
                if($this->busy)throw new \App\Services\Olt\OltReadBusy;
                $this->calls[]=['olt'=>(int)$olt->id,'requests'=>$requests,'budget'=>$budget];$values=[];
                foreach($requests['onu'] as $oid) {
                    if(str_starts_with($oid,Identity::PRIMARY.'.'))$values[$oid]=$this->serial;
                    elseif(str_starts_with($oid,Identity::SECONDARY.'.')){if($this->secondary!==null)$values[$oid]=$this->secondary;}
                    elseif(str_contains($oid,'.50.11.2.1.4.'))$values[$oid]='INTEGER: '.$this->state;
                    elseif($this->rx!==null)$values[$oid]='INTEGER: '.$this->rx;
                }
                return ['tables'=>['onu'=>$values],'reports'=>['onu'=>['complete'=>$this->complete]]];
            }
        };app()->instance(SnmpWalkRunner::class,$this->runner);
    }
    private function row(int $age=20): array {
        $at=now()->subSeconds($age)->toIso8601String();
        return ['serial_number'=>self::SN,'port'=>'gpon-olt_1/1/16','onu_id'=>'2','identity_source'=>Identity::SOURCE,'identity_observed_at'=>now()->toIso8601String(),
            ...Sample::normalize(['is_online'=>true,'rx_power'=>-26],$at)];
    }
    private function registration(int $id,int $node): void {
        DB::table('customers')->insert(['id'=>$id,'name'=>'Fixture '.$id,'customer_number'=>'FIX'.$id]);
        DB::table('customer_services')->insert(['id'=>$id,'customer_id'=>$id]);
        DB::table('network_ports')->insert(['id'=>$id,'node_id'=>$node,'customer_service_id'=>$id,'port_number'=>1]);
        DB::table('ont_registrations')->insert(['id'=>$id,'customer_service_id'=>$id,'onu_serial'=>self::SN]);
    }
    private function read(): array {return app(OnuOpticalDiagnostic::class)->read(OltDevice::findOrFail(1),self::SN);}
    private function endpoint(array $query=['device_id'=>1]): array {
        return app(OltController::class)->opticalPower(Request::create('/api/olt/optical-power/'.self::SN,'GET',$query),self::SN)->getData(true);
    }
    public function test_live_state_and_rx_use_selected_olt_and_full_hardware_tuple(): void {
        $d=$this->endpoint();$this->assertTrue($d['is_online']);$this->assertEquals(-25.0,$d['rx_power']);
        $this->assertSame('snmp_point',$d['_source']);$this->assertSame('gpon-olt_1/1/16',$d['port']);$this->assertSame('2',$d['onu_id']);
        $this->assertSame(1,$this->runner->calls[0]['olt']);$this->assertCount(4,$this->runner->calls[0]['requests']['onu']);
        $this->assertSame(6.0,$this->runner->calls[0]['budget']);$this->assertSame(1,$d['customer']['id']);
        foreach(['tx_power_dbm','olt_rx_power_dbm','voltage_v','bias_current_ma','temperature_c','distance_meters'] as $field)$this->assertNull($d[$field]);
        $this->assertNull($d['package']['name']);$this->assertNull($d['package']['speed_mbps']);
    }
    public function test_missing_rx_and_sensor_sentinels_never_make_working_onu_offline(): void {
        foreach([null,0,65535] as $rx){$this->runner->rx=$rx;$d=$this->read();$this->assertTrue($d['is_online']);$this->assertNull($d['rx_power']);$this->assertSame('rx_unavailable',$d['probe_reason']);}
    }
    public function test_unknown_state_and_verified_offline_are_distinct(): void {
        $this->runner->state=2;$d=$this->read();$this->assertNull($d['is_online']);$this->assertSame('Unknown',$d['status']);
        $this->runner->state=4;$d=$this->read();$this->assertFalse($d['is_online']);$this->assertSame('Offline',$d['status']);$this->assertNull($d['rx_power']);
        $this->assertStringNotContainsString('Dying Gasp',json_encode($d));
    }
    public function test_serial_conflict_never_falls_back_to_snapshot_or_database(): void {
        $this->runner->secondary='TEST00000002';$d=$this->endpoint();
        $this->assertSame('identity_mismatch',$d['probe_reason']);$this->assertNull($d['is_online']);$this->assertNull($d['port']);$this->assertNull($d['customer']['id']);
    }
    public function test_explicitly_unconfirmed_serial_cannot_reuse_old_online_state(): void {
        $this->runner->serial='No Such Instance';$d=$this->read();
        $this->assertSame('identity_unconfirmed',$d['probe_reason']);$this->assertNull($d['is_online']);$this->assertNull($d['sampled_at']);
    }
    public function test_failed_probe_preserves_snapshot_time_and_source_without_fabricating_sensors(): void {
        $this->runner->complete=false;$row=$this->row(60);DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        $d=$this->read();$this->assertSame('snapshot',$d['_source']);$this->assertSame($row['sample_observed_at'],$d['sampled_at']);
        $this->assertTrue($d['is_online']);$this->assertSame(-26.0,$d['rx_power']);$this->assertNull($d['voltage_v']);
    }
    public function test_expired_sample_is_unknown_and_keeps_its_original_time_when_probe_fails(): void {
        $this->runner->complete=false;$row=$this->row(300);DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        $d=$this->read();$this->assertNull($d['is_online']);$this->assertNull($d['rx_power']);$this->assertSame('stale',$d['telemetry_freshness']);$this->assertSame($row['sample_observed_at'],$d['sampled_at']);
    }
    public function test_client_tuple_cannot_override_current_inventory_identity(): void {
        $d=app(OnuOpticalDiagnostic::class)->read(OltDevice::findOrFail(1),self::SN,'1/1/15',2);
        $this->assertSame('tuple_mismatch',$d['probe_reason']);$this->assertNull($d['port']);$this->assertSame([],$this->runner->calls);
    }
    public function test_unregistered_hint_only_becomes_identity_after_hardware_confirmation(): void {
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>'{}']);
        $d=app(OnuOpticalDiagnostic::class)->read(OltDevice::findOrFail(1),self::SN,'1/1/16',2);
        $this->assertSame('resolved',$d['identity_status']);$this->assertSame('snmp_point',$d['_source']);
        $this->runner->serial='TEST00000002';$d=app(OnuOpticalDiagnostic::class)->read(OltDevice::findOrFail(1),self::SN,'1/1/16',2);
        $this->assertSame('unresolved',$d['identity_status']);$this->assertNull($d['rx_power']);
    }
    public function test_duplicate_hardware_locations_are_rejected_before_live_query(): void {
        $other=$this->row();$other['port']='1/1/15';
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$this->row(),$other]])]);
        $d=$this->read();$this->assertSame('identity_conflict',$d['probe_reason']);$this->assertSame([],$this->runner->calls);
    }
    public function test_customer_context_never_uses_foreign_or_ambiguous_registration(): void {
        $this->assertSame(1,$this->endpoint()['customer']['id']);$this->registration(3,1);
        $d=$this->endpoint();$this->assertSame('ambiguous',$d['registration_status']);$this->assertNull($d['customer']['id']);$this->assertTrue($d['is_online']);
    }
    public function test_deleted_and_unmapped_customer_context_is_not_exposed(): void {
        DB::table('customers')->where('id',1)->update(['deleted_at'=>now()]);$d=$this->endpoint();$this->assertNull($d['customer']['id']);$this->assertSame('unlinked',$d['registration_status']);
    }
    public function test_multiple_service_ports_cannot_select_an_arbitrary_odp_or_foreign_binding(): void {
        DB::table('network_ports')->insert(['id'=>9,'node_id'=>2,'customer_service_id'=>1,'port_number'=>2]);
        $d=$this->endpoint();$this->assertSame('ambiguous',$d['registration_status']);$this->assertNull($d['customer']['id']);$this->assertNull($d['distribution']['odp_id']);
        DB::table('network_ports')->where('id',9)->update(['node_id'=>1]);
        $d=$this->endpoint();$this->assertSame('ambiguous',$d['registration_status']);$this->assertNull($d['customer']['id']);
    }
    public function test_no_olt_selection_never_chooses_first_device(): void {
        $response=app(OltController::class)->opticalPower(Request::create('/diagnostic','GET'),self::SN);
        $this->assertSame(422,$response->getStatusCode());$this->assertSame([],$this->runner->calls);
    }
    public function test_legacy_scanner_can_resolve_only_one_fresh_hardware_owner(): void {
        DB::table('olt_devices')->where('id',2)->update(['last_telemetry_snapshot'=>'{}']);
        $d=$this->endpoint([]);$this->assertSame(1,$d['olt']['id']);$this->assertSame('snmp_point',$d['_source']);
    }
    public function test_legacy_port_only_hint_uses_hardware_onu_id_not_registration_id(): void {
        $d=$this->endpoint(['device_id'=>1,'port'=>'1/1/16']);$this->assertSame('2',$d['onu_id']);$this->assertTrue($d['is_online']);
    }
    public function test_expired_identity_cannot_auto_select_an_olt_for_legacy_scanner(): void {
        $row=$this->row();$row['identity_observed_at']=now()->subSeconds(601)->toIso8601String();
        DB::table('olt_devices')->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        $response=app(OltController::class)->opticalPower(Request::create('/diagnostic','GET'),self::SN);
        $this->assertSame(422,$response->getStatusCode());$this->assertSame([],$this->runner->calls);
    }
    public function test_unknown_device_never_chooses_first_device(): void {
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);$this->endpoint(['device_id'=>999]);
    }
    public function test_unsupported_device_does_not_call_legacy_simulated_driver(): void {
        DB::table('olt_devices')->where('id',1)->update(['connection_mode'=>'simulation']);
        $d=$this->endpoint();$this->assertSame('unsupported_device',$d['probe_reason']);$this->assertNull($d['is_online']);$this->assertSame([],$this->runner->calls);
    }
    public function test_diagnostic_get_does_not_write_customer_or_snapshot_state(): void {
        DB::enableQueryLog();DB::flushQueryLog();$this->endpoint();
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
    }

    public function test_stored_optical_updates_from_new_snapshots_without_any_hardware_read(): void {
        $first=$this->endpoint(['device_id'=>1,'stored_only'=>1]);
        $this->assertSame('stored',$first['probe_status']);$this->assertSame('snapshot',$first['telemetry_source']);
        $this->assertNull($first['probe_started_at']);$this->assertEquals(-26,$first['rx_power']);
        $row=$this->row(5);$row=array_replace($row,Sample::normalize(['is_online'=>true,'rx_power'=>-24.3],$row['sample_observed_at']));
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        DB::enableQueryLog();DB::flushQueryLog();
        $second=$this->endpoint(['device_id'=>1,'stored_only'=>1]);
        $this->assertEquals(-24.3,$second['rx_power']);$this->assertSame($row['sample_observed_at'],$second['sampled_at']);
        $this->assertSame([],$this->runner->calls);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
    }

    public function test_stored_optical_never_refreshes_a_stale_or_missing_sample(): void {
        $row=$this->row(301);DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        $d=$this->endpoint(['device_id'=>1,'stored_only'=>1]);
        $this->assertSame('stale',$d['telemetry_freshness']);$this->assertNull($d['rx_power']);$this->assertSame($row['sample_observed_at'],$d['sampled_at']);
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>null]);
        $d=$this->endpoint(['device_id'=>1,'stored_only'=>1]);$this->assertNull($d['sampled_at']);$this->assertNull($d['rx_power']);
        $this->assertSame([],$this->runner->calls);
    }

    public function test_stored_hardware_and_port_reads_never_fall_back_to_driver_when_snapshot_is_missing(): void {
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>null,'ip_address'=>'invalid']);
        $controller=new class extends OltController {
            public function getDriver(string $vendor,?int $deviceId=null) {throw new \RuntimeException('Hardware must not be accessed');}
        };
        DB::enableQueryLog();DB::flushQueryLog();
        $r=$controller->index(Request::create('/hardware','GET',['device_id'=>1,'stored_only'=>1,'fresh'=>1,'force'=>1]));
        $this->assertSame(200,$r->getStatusCode());$d=$r->getData(true);$this->assertNull($d['polled_at']);
        $this->assertCount(1,$d['onu_list']);$this->assertNull($d['onu_list'][0]['rx_power']);$this->assertNull($d['onu_list'][0]['sample_observed_at']);
        $r=$controller->getPortOnus(Request::create('/port-onus','GET',['device_id'=>1,'port'=>'1/1/16','stored_only'=>1,'fresh'=>1]));
        $this->assertSame(200,$r->getStatusCode());$d=$r->getData(true);$this->assertNull($d['polled_at']);$this->assertSame([],$d['onu_list']);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
    }

    public function test_stored_read_with_unknown_device_does_not_select_a_different_olt(): void {
        $c=app(OltController::class);$q=Request::create('/stored','GET',['device_id'=>999,'stored_only'=>1]);
        $this->assertSame(404,$c->index($q)->getStatusCode());$this->assertSame(404,$c->getPortOnus($q)->getStatusCode());
    }

    public function test_busy_olt_keeps_stored_measurement_time_and_does_not_claim_a_live_result(): void {
        $this->runner->busy=true;$row=$this->row(60);
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
        DB::enableQueryLog();DB::flushQueryLog();$d=$this->read();
        $this->assertSame('busy',$d['probe_status']);$this->assertSame('olt_busy',$d['probe_reason']);
        $this->assertSame('snapshot',$d['_source']);$this->assertSame($row['sample_observed_at'],$d['sampled_at']);
        $this->assertTrue($d['is_online']);$this->assertSame(-26.0,$d['rx_power']);$this->assertSame([],$this->runner->calls);
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|insert|delete)\b/i',$q['query']))));
    }
}
