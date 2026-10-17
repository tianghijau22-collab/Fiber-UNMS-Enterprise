<?php
namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\OltReadLease as Lease;
use App\Services\Olt\OltReadBusy as Busy;
use App\Services\Olt\SnmpWalkRunner;
use App\Services\Olt\ZteC320Driver;
use App\Services\Olt\ZteC300Driver;
use App\Http\Controllers\OltController;
use App\Http\Controllers\CustomerController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class OltReadCoordinationTest extends TestCase
{
    private const IP='192.0.2.241';
    private ?Process $holder=null;
    private ?string $control=null;
    private function child(string $body): Process
    {
        return new Process([PHP_BINARY,'-r','require '.var_export(base_path('vendor/autoload.php'),true).';$app=require '.var_export(base_path('bootstrap/app.php'),true).';'.$body],base_path());
    }
    private function holdElsewhere(): void
    {
        $this->control=tempnam(sys_get_temp_dir(),'fona-lease-test-');
        $this->holder=$this->child('$l=App\Services\Olt\OltReadLease::acquire("'.self::IP.'");echo "HELD\n";flush();$until=microtime(true)+5;while(microtime(true)<$until && file_get_contents('.var_export($this->control,true).')!=="exit"){usleep(10000);}exit(0);');
        $this->holder->setTimeout(8);$this->holder->start();
        $until=microtime(true)+3;
        while(microtime(true)<$until && !str_contains($this->holder->getOutput(),'HELD')) {
            if(!$this->holder->isRunning())break;
            usleep(1000);
        }
        $this->assertStringContainsString('HELD',$this->holder->getOutput(),$this->holder->getErrorOutput());
    }
    protected function tearDown(): void
    {
        $this->releaseHolder();
        parent::tearDown();
    }
    private function releaseHolder(): void
    {
        if($this->holder?->isRunning()) {
            file_put_contents($this->control,'exit');$this->holder->wait();
        }
        if($this->control && is_file($this->control))unlink($this->control);
        $this->control=null;
    }
    private function olt(): OltDevice
    {
        Schema::create('olt_devices',function(Blueprint $t){$t->id();$t->string('name');$t->string('ip_address');$t->string('connection_mode');$t->string('vendor_key');$t->string('status');$t->json('last_telemetry_snapshot');$t->timestamps();});
        DB::table('olt_devices')->insert(['id'=>1,'name'=>'Fixture OLT','ip_address'=>self::IP,'connection_mode'=>'live','vendor_key'=>'zte-c320','status'=>'active',
            'last_telemetry_snapshot'=>json_encode(['polled_at'=>'2026-10-16T12:00:00Z','onu_list'=>[],'pon_ports'=>[]])]);
        return OltDevice::findOrFail(1);
    }
    public function test_another_process_is_excluded_and_a_different_target_can_progress(): void
    {
        $this->holdElsewhere();$other=Lease::acquire('192.0.2.242');$other->release();
        try {Lease::acquire(self::IP);$this->fail('Concurrent owner accepted');}catch(Busy $e){$this->assertSame('olt_busy',$e->reason);}
    }
    public function test_process_exit_releases_ownership_without_deleting_the_lock_file(): void
    {
        $this->holdElsewhere();$this->releaseHolder();$l=Lease::acquire(self::IP);
        $this->assertInstanceOf(Lease::class,$l);$l->release();
    }
    public function test_cache_flush_cannot_remove_a_live_process_lease(): void
    {
        $this->holdElsewhere();Cache::flush();$this->expectException(Busy::class);Lease::acquire(self::IP);
    }
    public function test_nested_calls_keep_the_outer_read_locked_and_exceptions_release_it(): void
    {
        $outer=Lease::acquire(self::IP);$inner=Lease::acquire(self::IP);$inner->release();
        $p=$this->child('try{App\Services\Olt\OltReadLease::acquire("'.self::IP.'");echo "WRONG";}catch(App\Services\Olt\OltReadBusy $e){echo $e->reason;}');
        $p->run();$this->assertSame('olt_busy',$p->getOutput());$outer->release();
        try {Lease::forTarget(self::IP,161,fn()=>throw new \RuntimeException('fixture'));}catch(\RuntimeException){}
        $l=Lease::acquire(self::IP);$l->release();$this->assertTrue(true);
    }
    public function test_driver_and_runner_are_blocked_before_any_network_request(): void
    {
        $this->holdElsewhere();$olt=(new OltDevice)->forceFill(['id'=>1,'ip_address'=>self::IP,'snmp_version'=>'v2c']);
        foreach([
            fn()=>(new SnmpWalkRunner)->walk($olt,['states'=>'1.3.6.1.2.1']),
            fn()=>(new SnmpWalkRunner)->getQueued($olt,['q'=>['1.3.6.1.2.1']]),
            fn()=>(new ZteC320Driver(ip:self::IP,isLive:true))->getOnuList(),
            fn()=>(new ZteC300Driver(ip:self::IP,isLive:true))->getDeviceInfo(),
        ] as $read) {
            try {$read();$this->fail('Read was not excluded');}catch(Busy $e){$this->assertSame('olt_busy',$e->reason);}
        }
    }
    public function test_blocked_poller_preserves_the_previous_hardware_attempt_and_snapshot(): void
    {
        $olt=$this->olt();$old=['result'=>'SUCCESS','finished_at'=>'2026-10-16T12:00:00Z'];
        Cache::put('olt_poll_health_v1_1',$old,60);$before=$olt->last_telemetry_snapshot;$this->holdElsewhere();
        $poller=new CoordinationPollHarness;
        $this->assertSame(2,$poller->observe());$this->assertSame(0,$poller->reads);
        $this->assertSame($old,Cache::get('olt_poll_health_v1_1'));$this->assertSame($before,OltDevice::find(1)->last_telemetry_snapshot);
    }
    public function test_manual_reads_do_not_write_or_disguise_contention_as_a_hardware_failure(): void
    {
        $olt=$this->olt();$before=$olt->last_telemetry_snapshot;$this->holdElsewhere();
        foreach([
            fn()=>app(OltController::class)->index(Request::create('/olt','GET',['device_id'=>1,'fresh'=>1])),
            fn()=>app(OltController::class)->syncPort(Request::create('/sync','POST',['device_id'=>1,'port'=>'1/1/1'])),
            fn()=>app(CustomerController::class)->probeInterfaceOptical(Request::create('/probe','POST',['olt_id'=>1,'interface'=>'1/1/1'])),
        ] as $read) {
            try {$read();$this->fail('Manual read was not excluded');}catch(Busy $e){$this->assertSame('olt_busy',$e->reason);}
        }
        $this->assertSame($before,OltDevice::find(1)->last_telemetry_snapshot);
        foreach(['olt_busy'=>423,'read_coordination_unavailable'=>503] as $reason=>$status) {
            $r=(new Busy($reason))->render(Request::create('/api/olt'));$this->assertSame($status,$r->getStatusCode());
            $this->assertSame('2',$r->headers->get('Retry-After'));$this->assertSame($reason,$r->getData(true)['reason']);
        }
    }
    public function test_cached_inventory_page_stays_available_while_live_reads_are_excluded(): void
    {
        $this->olt();$this->holdElsewhere();
        $controller=\Mockery::mock(OltController::class)->makePartial();
        $controller->shouldNotReceive('getDriver');
        $controller->shouldReceive('processAndPartitionTelemetry')->once()->andReturn(['onu_list'=>[]]);
        $response=$controller->index(Request::create('/api/olt','GET',['device_id'=>1]));
        $this->assertSame(200,$response->getStatusCode());
        $this->assertSame('2026-10-16T12:00:00Z',$response->getData(true)['polled_at']);
    }
    public function test_busy_dispatch_does_not_count_old_inventory_as_a_successful_new_read(): void
    {
        $this->olt();
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode(['onu_list'=>[['status'=>'Online']],'pon_ports'=>[['status'=>'Up']]])]);
        Cache::put('olt_poll_health_v1_1',['result'=>'SUCCESS'],60);
        foreach(['last_mass_client_down_check_ts','last_hardware_sfp_pulse_ts','last_audit_logs_auto_prune_ts'] as $key)Cache::put($key,time(),60);
        (new CoordinationDispatchHarness)->dispatch();
        $stats=Cache::get('backend_worker_telemetry');
        $this->assertSame('PARTIAL',$stats['cycle_result']);$this->assertSame(0,$stats['total_onus_polled']);
        $this->assertSame('BUSY',$stats['device_reports'][0]['status']);
        $this->assertSame(0,$stats['device_reports'][0]['onus_found']);
        $this->assertSame(1,$stats['device_reports'][0]['db_registered_total']);
    }
}
class CoordinationPollHarness extends \App\Console\Commands\PollOltTelemetry
{
    public int $reads=0;
    public function observe(): int {return $this->pollObservedDevice(1,app(OltController::class),'slot_parallel');}
    protected function pollObservedDeviceUnlocked(int $id,OltController $controller,string $mode,?string $port=null): int {$this->reads++;return 0;}
}
class CoordinationDispatchHarness extends \App\Console\Commands\PollOltTelemetry
{
    public function dispatch(): int {return $this->dispatchSinglePortParallel(app(OltController::class),'slot_parallel');}
    protected function pollObservedDevice(int $id,OltController $controller,string $mode,?string $port=null): int {return 2;}
}
