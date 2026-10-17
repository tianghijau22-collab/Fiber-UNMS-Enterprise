<?php
namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\OnuTelemetrySample as Sample;
use App\Services\Olt\SnmpWalkRunner;
use App\Services\Olt\FastOpticalProbeService as Probe;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class SnmpAcquisitionTest extends TestCase
{
    private function cache(int $ago=0): array {return ['schema'=>3,'observed_at'=>date(DATE_ATOM,time()-$ago),'entries'=>[Identity::ifIndexFromPort('1/1/15').'_1'=>'TEST00000001']];}
    private function tables(): array {return ['sn1'=>[Identity::PRIMARY.'.'.Identity::ifIndexFromPort('1/1/15').'.1'=>'TEST00000001'],'sn2'=>[],'_complete'=>true];}
    private function olt(): OltDevice {return (new OltDevice)->forceFill(['id'=>1,'ip_address'=>'192.0.2.1','connection_mode'=>'live','snmp_version'=>'v2c','snmp_community_type'=>'public']);}
    public function test_first_v3_refresh_failure_can_retain_unexpired_v2_hardware_evidence_without_retiming(): void
    {
        $previous=array_replace($this->cache(60),['schema'=>2]);Cache::put('olt_bulk_sn_map_v2_1',$previous,600);$calls=0;
        $out=Identity::remember(1,1,function()use(&$calls){$calls++;return ['sn1'=>[],'sn2'=>[],'_complete'=>false];});
        $this->assertSame(1,$calls);$this->assertSame($previous['observed_at'],$out['observed_at']);$this->assertSame($previous['entries'],$out['entries']);
        $this->assertFalse(Cache::has(Identity::cacheKey(1)));$this->assertSame($previous,Cache::get('olt_bulk_sn_map_v2_1'));
    }
    public function test_young_identity_cache_is_reused_without_querying_hardware(): void
    {
        $old=$this->cache(200);Cache::put(Identity::cacheKey(1),$old,600);
        $this->assertSame($old,Identity::remember(1,1,fn()=>throw new \RuntimeException('Unexpected read')));
    }
    public function test_identity_refresh_starts_before_expiry_and_keeps_the_query_start_time(): void
    {
        Cache::put(Identity::cacheKey(1),$this->cache(301),600);$called=null;
        $new=Identity::remember(1,1,function()use(&$called){$called=Sample::timestamp();return $this->tables();});
        $this->assertNotNull($called);$this->assertLessThanOrEqual(Sample::epoch($called),Sample::epoch($new['observed_at']));
        $this->assertSame($this->cache()['entries'],$new['entries']);
    }
    public function test_failed_or_partial_identity_refresh_preserves_age_and_has_bounded_backoff(): void
    {
        $key=Identity::cacheKey(1);$old=$this->cache(350);Cache::put($key,$old,600);$calls=0;
        $read=function()use(&$calls){$calls++;return array_replace($this->tables(),['_complete'=>false]);};
        $this->assertSame($old,Identity::remember(1,1,$read));$this->assertSame($old,Identity::remember(1,1,$read));
        $this->assertSame(1,$calls);$this->assertSame($old,Cache::get($key));
    }
    public function test_expired_identity_cannot_be_revived_when_refresh_fails(): void
    {
        Cache::put(Identity::cacheKey(1),$this->cache(601),600);
        $value=Identity::remember(1,1,fn()=>[]);$this->assertSame([],$value['entries']);$this->assertNull($value['observed_at']);
    }
    public function test_refresh_lock_does_not_block_or_duplicate_a_parallel_probe(): void
    {
        $key=Identity::cacheKey(1);$old=$this->cache(301);Cache::put($key,$old,600);$lock=Cache::lock($key.'_refresh_lock',50);$lock->get();
        try {$this->assertSame($old,Identity::remember(1,1,fn()=>throw new \RuntimeException('Unexpected read')));} finally {$lock->release();}
    }
    private function child(string $code): SnmpWalkRunner
    {
        return new class($code) extends SnmpWalkRunner {
            public function __construct(private string $code){}
            protected function process(array $arguments): Process
            {return new Process([PHP_BINARY,'-r',str_replace('__OID__',end($arguments),$this->code)],base_path());}
        };
    }
    public function test_concurrent_children_are_drained_beyond_pipe_buffer_size(): void
    {
        $r=$this->child('for($i=1;$i<=3000;$i++)echo "__OID__.$i = INTEGER: 3\n";');
        $out=$r->walk($this->olt(),['a'=>'1.3.6.1.4.1.999','b'=>'1.3.6.1.4.1.998'],10,1,0,3);
        foreach($out['reports'] as $report){$this->assertTrue($report['complete']);$this->assertSame(3000,$report['rows']);}
    }
    public function test_partial_nonzero_exit_and_timeout_are_reported_without_command_or_stderr(): void
    {
        $r=$this->child('echo "__OID__.1 = INTEGER: 3\n";fwrite(STDERR,"private fixture");exit(1);');
        $out=$r->walk($this->olt(),['a'=>'1.3.6.1.4.1.999'],10,1,0,3);
        $this->assertFalse($out['reports']['a']['complete']);$this->assertSame('nonzero_exit',$out['reports']['a']['reason']);
        $this->assertStringNotContainsString('private fixture',json_encode($out));
        $r=$this->child('echo "__OID__.1 = INTEGER: 3\n";usleep(2000000);');
        $out=$r->walk($this->olt(),['a'=>'1.3.6.1.4.1.999'],50,15,9,0.15);
        $this->assertSame(10,$out['parameters']['repetitions']);$this->assertSame(5.0,$out['parameters']['timeout']);$this->assertSame(2,$out['parameters']['retries']);
        $this->assertFalse($out['reports']['a']['complete']);$this->assertSame('deadline',$out['reports']['a']['reason']);$this->assertLessThan(1500,$out['duration_ms']);
    }
    public function test_parser_rejects_outside_subtree_and_conflicting_values(): void
    {
        $out=SnmpWalkRunner::parse(".1.3.6.1.999.1 = INTEGER: 3\n.1.3.6.1.998.1 = INTEGER: 4\n.1.3.6.1.999.2 = No Such Instance\n",'1.3.6.1.999');
        $this->assertSame(['1.3.6.1.999.1'=>'INTEGER: 3'],$out['rows']);
        $this->assertTrue(SnmpWalkRunner::parse(".1.3.6.1.999.1 = 3\n.1.3.6.1.999.1 = 4",'1.3.6.1.999')['conflict']);
    }
}
