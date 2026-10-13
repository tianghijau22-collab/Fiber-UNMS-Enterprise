<?php

namespace Tests\Feature;

use App\Http\Controllers\OltController;
use App\Models\OltDevice;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\ZteOnuOpticalBatch;
use App\Services\Olt\FastOpticalProbeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OltIdentityPartitionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake(); Http::preventStrayRequests();
        IdentityProbeHarness::$identities=[];IdentityProbeHarness::$values=[];IdentityProbeHarness::$calls=0;
        Schema::create('olt_devices', function(Blueprint $t){$t->id();$t->string('name');$t->string('vendor_key');$t->string('connection_mode');$t->string('status');$t->string('ip_address');});
        foreach([1,2] as $id)DB::table('olt_devices')->insert(['id'=>$id,'name'=>'Fixture OLT '.$id,'vendor_key'=>'zte-c320','connection_mode'=>'live','status'=>'active','ip_address'=>'192.0.2.'.$id]);
        Schema::create('customers', function(Blueprint $t){$t->id();$t->string('name');$t->string('customer_number');$t->softDeletes();});
        Schema::create('customer_services', function(Blueprint $t){$t->id();$t->integer('customer_id');$t->integer('service_package_id')->nullable();$t->string('ip_address')->nullable();$t->softDeletes();});
        Schema::create('service_packages', function(Blueprint $t){$t->id();});
        Schema::create('network_nodes', function(Blueprint $t){$t->id();$t->string('name');$t->integer('parent_node_id')->nullable();$t->integer('splitter_type_id')->nullable();$t->integer('olt_device_id');$t->string('olt_port_ref');$t->softDeletes();});
        Schema::create('network_ports', function(Blueprint $t){$t->id();$t->integer('node_id');$t->integer('customer_service_id');$t->integer('port_number');});
        Schema::create('ont_registrations', function(Blueprint $t){$t->id();$t->integer('customer_service_id');$t->integer('olt_port_id')->nullable();$t->string('onu_serial');$t->string('onu_mac')->nullable();$t->string('onu_type')->nullable();$t->string('status');$t->float('rx_power')->nullable();$t->float('tx_power')->nullable();$t->timestamp('last_online_at')->nullable();$t->timestamps();$t->softDeletes();});
        DB::table('network_nodes')->insert(['id'=>1,'name'=>'Mixed PON ODP fixture','olt_device_id'=>1,'olt_port_ref'=>'gpon-olt_1/1/15']);
        foreach([1,2] as $id){
            DB::table('customers')->insert(['id'=>$id,'name'=>'Fixture '.$id,'customer_number'=>'FIX-'.$id]);
            DB::table('customer_services')->insert(['id'=>$id,'customer_id'=>$id]);
            DB::table('network_ports')->insert(['id'=>$id,'node_id'=>1,'customer_service_id'=>$id,'port_number'=>$id]);
            DB::table('ont_registrations')->insert(['id'=>1700+$id,'customer_service_id'=>$id,'onu_serial'=>'TEST0000000'.$id,'status'=>'active','rx_power'=>-25.0]);
        }
    }

    private function partition(array $rows): array
    {
        $device=new OltDevice; $device->setRawAttributes(['id'=>1,'vendor_key'=>'zte-c320','connection_mode'=>'live']);
        return app(OltController::class)->processAndPartitionTelemetry($device,[],[['port_id'=>'gpon-olt_1/1/15'],['port_id'=>'gpon-olt_1/1/16']],$rows,[]);
    }

    private function row(int $sn, string $port, int $id): array
    {
        return ['_source'=>'live_snmp','identity_source'=>Identity::SOURCE,'identity_observed_at'=>now()->toIso8601String(),'serial_number'=>'TEST0000000'.$sn,'port'=>$port,'onu_id'=>$id,'status'=>'Online','rx_power'=>-26.0];
    }

    public function test_one_odp_retains_two_individual_pons_and_never_uses_registration_ids(): void
    {
        $out=$this->partition([$this->row(1,'1/1/15',1),$this->row(2,'1/1/16',2)]);
        $this->assertSame(['gpon-olt_1/1/15','gpon-olt_1/1/16'],array_column($out['onu_list'],'port'));
        $this->assertSame(['1','2'],array_column($out['onu_list'],'onu_id'));
        $this->assertSame([1701,1702],array_column($out['onu_list'],'ont_id'));
        $this->assertSame([1,1],array_column($out['pon_ports'],'registered_onus'));
    }

    public function test_missing_or_legacy_identity_is_unknown_without_erasing_customer_or_writing_database(): void
    {
        DB::enableQueryLog(); DB::flushQueryLog();
        $old=$this->row(1,'1/1/15',1755);unset($old['identity_source']);
        $out=$this->partition([$old]);
        $this->assertCount(2,$out['onu_list']);
        foreach($out['onu_list'] as $row){
            $this->assertNull($row['onu_id']);$this->assertNull($row['port']);
            $this->assertSame('unresolved',$row['identity_status']);
            $this->assertSame('gpon-olt_1/1/15',$row['topology_port']);
            $this->assertSame('Online',$row['status']);$this->assertSame(-25.0,$row['rx_power']);
        }
        $this->assertSame([],array_values(array_filter(DB::getQueryLog(),fn($q)=>preg_match('/^\s*(update|delete|insert)\b/i',$q['query']))));
    }

    public function test_conflicting_physical_locations_are_quarantined_in_either_input_order(): void
    {
        $rows=[$this->row(1,'1/1/15',1),$this->row(1,'1/1/16',1)];
        foreach([$rows,array_reverse($rows)] as $input){
            $out=$this->partition($input);
            $this->assertNull($out['onu_list'][0]['onu_id']);
            $this->assertSame('unresolved',$out['onu_list'][0]['identity_status']);
        }
    }

    public function test_hardware_pon_one_is_valid_and_foreign_olt_customer_is_not_partitioned(): void
    {
        DB::table('network_nodes')->insert(['id'=>2,'name'=>'Foreign ODP','olt_device_id'=>2,'olt_port_ref'=>'gpon-olt_1/1/1']);
        DB::table('network_ports')->where('id',2)->update(['node_id'=>2]);
        $out=$this->partition([$this->row(1,'gpon-olt_1/1/1',1)]);
        $this->assertCount(1,$out['onu_list']);
        $this->assertSame('gpon-olt_1/1/1',$out['onu_list'][0]['port']);
    }

    public function test_contaminated_legacy_cache_is_ignored_but_unrelated_keys_are_preserved(): void
    {
        $index=Identity::ifIndexFromPort('1/1/16');
        Cache::put('olt_bulk_sn_map_1',[$index.'_1755'=>'TEST00000001'],600);
        Cache::put('unrelated_session_fixture','preserved',600);
        $calls=0;
        $reader=function()use(&$calls,$index){$calls++;return ['sn1'=>[Identity::PRIMARY.".$index.1"=>'TEST00000001'],'sn2'=>[]];};
        $cold=Identity::remember(1,1,$reader);
        $warm=Identity::remember(1,1,fn()=>throw new \RuntimeException('Warm cache must not query hardware'));
        $this->assertSame([$index.'_1'=>'TEST00000001'],$cold['entries']);$this->assertSame($cold,$warm);$this->assertSame(1,$calls);
        $this->assertSame([$index.'_1755'=>'TEST00000001'],Cache::get('olt_bulk_sn_map_1'));
        $this->assertSame('preserved',Cache::get('unrelated_session_fixture'));
        $this->assertSame([],Identity::remember(2,1,fn()=>['sn1'=>[],'sn2'=>[]])['entries']);
        $this->assertSame($cold,Cache::get(Identity::cacheKey(1)));
    }

    private function opticalFixture(bool $secondSerialMismatch=false): void
    {
        IdentityProbeHarness::$identities=[$this->row(1,'1/1/15',1),$this->row(2,'1/1/16',1)];
        foreach(IdentityProbeHarness::$identities as $idx=>$row){
            $index=Identity::ifIndexFromPort($row['port']);$id=$row['onu_id'];$actual=$secondSerialMismatch&&$idx===1?'TEST00000009':$row['serial_number'];
            IdentityProbeHarness::$values += [Identity::PRIMARY.".$index.$id"=>$actual,Identity::SECONDARY.".$index.$id"=>$actual,
                "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$index.$id"=>3,
                "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$index.$id.1"=>$idx===0?2526:1712];
        }
    }

    public function test_odp_live_probe_writes_only_confirmed_customers_using_individual_pons(): void
    {
        $this->opticalFixture();
        $out=IdentityProbeHarness::probeOdpLiveOptical(1);
        $this->assertTrue($out['success']);$this->assertSame(0,$out['unknown_count']);
        $this->assertSame('gpon-olt_1/1/15',$out['probed_states']['TEST00000001']['port']);
        $this->assertSame('gpon-olt_1/1/16',$out['probed_states']['TEST00000002']['port']);
        $this->assertEquals(-24.95,DB::table('ont_registrations')->where('id',1701)->value('rx_power'));
        $this->assertEquals(-26.58,DB::table('ont_registrations')->where('id',1702)->value('rx_power'));
        $status=IdentityProbeHarness::probeOdpStatus(1);
        $this->assertTrue($status['success']);$this->assertFalse($status['is_odp_down']);$this->assertSame(2,$status['online_count']);
    }

    public function test_unconfirmed_partial_read_cannot_overwrite_customer_or_trigger_mass_loss(): void
    {
        $this->opticalFixture(true);
        $index=Identity::ifIndexFromPort('1/1/15');
        IdentityProbeHarness::$values["1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$index.1"]=1;
        $out=IdentityProbeHarness::probeOdpLiveOptical(1);
        $this->assertFalse($out['success']);$this->assertSame(1,$out['unknown_count']);
        $this->assertSame('inactive',DB::table('ont_registrations')->where('id',1701)->value('status'));
        $untouched=DB::table('ont_registrations')->where('id',1702)->first();
        $this->assertSame('active',$untouched->status);$this->assertEquals(-25,$untouched->rx_power);$this->assertNull($untouched->updated_at);
        $status=IdentityProbeHarness::probeOdpStatus(1);
        $this->assertFalse($status['success']);$this->assertFalse($status['is_odp_down']);$this->assertSame(1,$status['unknown_count']);
    }

    public function test_wrong_olt_provided_to_odp_probe_is_rejected_before_querying_hardware(): void
    {
        $out=IdentityProbeHarness::probeOdpLiveOptical(1,OltDevice::findOrFail(2));
        $this->assertFalse($out['success']);$this->assertSame(0,IdentityProbeHarness::$calls);
        $status=IdentityProbeHarness::probeOdpStatus(1,OltDevice::findOrFail(2));
        $this->assertFalse($status['success']);$this->assertFalse($status['is_odp_down']);$this->assertSame(0,IdentityProbeHarness::$calls);
    }
}

class IdentityProbeHarness extends FastOpticalProbeService
{
    public static array $identities=[];
    public static array $values=[];
    public static int $calls=0;
    protected static function readVerifiedOdpOnus(OltDevice $olt,array $onus): array
    {
        self::$calls++;
        return ZteOnuOpticalBatch::read(array_map(fn($onu)=>$onu->onu_serial?:$onu->onu_mac,$onus),self::$identities,fn($oids)=>array_intersect_key(self::$values,array_flip($oids)));
    }
}
