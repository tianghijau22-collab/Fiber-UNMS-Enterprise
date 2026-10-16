<?php
namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\FastOpticalProbeService as Probe;
use App\Services\Olt\SnmpWalkRunner;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\OnuTelemetrySample as Sample;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ExactPointPollingTest extends TestCase
{
    private const STATE='1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';
    private const RX='1.3.6.1.4.1.3902.1012.3.50.12.1.1.10';
    private function olt(): OltDevice {return (new OltDevice)->forceFill(['id'=>51,'ip_address'=>'192.0.2.1','snmp_version'=>'v2c','snmp_community_type'=>'public']);}
    private function child(string $code): SnmpWalkRunner
    {
        return new class($code) extends SnmpWalkRunner {
            public function __construct(private string $code){}
            protected function process(array $arguments): Process
            {
                $oids=array_values(array_filter($arguments,fn($v)=>preg_match('/^1(?:\.[0-9]+)+$/D',$v)));
                return new Process([PHP_BINARY,'-r',str_replace('__OIDS__',var_export($oids,true),$this->code)],base_path());
            }
        };
    }
    private function fixtureRunner(array $states,array $values=[],bool $complete=true): SnmpWalkRunner
    {
        $r=new class($states,$values,$complete) extends SnmpWalkRunner {
            public array $calls=[];public array $walkCalls=[];
            public function __construct(private array $states,private array $values,private bool $complete){}
            public function walk(OltDevice $olt,array $oids,int $repetitions=10,float $timeout=5,int $retries=2,float $budget=35): array
            {
                $this->walkCalls[]=$oids;
                return ['tables'=>['states'=>$this->states],'reports'=>['states'=>['complete'=>$this->complete,'rows'=>count($this->states)]],
                    'started_at'=>Sample::timestamp(),'duration_ms'=>0,'parameters'=>[]];
            }
            public function getQueued(OltDevice $olt,array $requests,float $budget=20): array
            {
                $this->calls[]=compact('requests','budget');$tables=[];$reports=[];
                foreach($requests as $key=>$oids) {
                    $tables[$key]=array_intersect_key($this->values,array_fill_keys($oids,true));
                    $reports[$key]=['complete'=>true,'reason'=>null,'rows'=>count($tables[$key]),'answered'=>count($oids),'requested'=>count($oids),'started'=>true];
                }
                return ['tables'=>$tables,'reports'=>$reports,'started_at'=>Sample::timestamp(),'duration_ms'=>0,'parameters'=>[]];
            }
            public function walkQueued(OltDevice $olt,array $requests,float $budget=35): array
            {
                $this->calls[]=compact('requests','budget');$tables=[];$reports=[];
                foreach($requests as $key=>$oids) {
                    $tables[$key]=array_filter($this->values,fn($oid)=>str_starts_with($oid,$oids[0].'.'),ARRAY_FILTER_USE_KEY);
                    $reports[$key]=['complete'=>true,'reason'=>null,'rows'=>count($tables[$key])];
                }
                return ['tables'=>$tables,'reports'=>$reports,'started_at'=>Sample::timestamp(),'duration_ms'=>0,'parameters'=>[]];
            }
        };
        app()->instance(SnmpWalkRunner::class,$r);return $r;
    }
    public function test_exact_response_accepts_explicit_no_such_but_never_outside_oids(): void
    {
        $r=$this->child('$oids=__OIDS__;echo $oids[0]." = INTEGER: 3\n".$oids[1]." = No Such Instance currently exists at this OID\n1.9.9 = INTEGER: 7\n";');
        $b=$r->getQueued($this->olt(),['a'=>['1.3.6.1.1','1.3.6.1.2']],2);
        $this->assertTrue($b['reports']['a']['complete']);$this->assertSame(2,$b['reports']['a']['answered']);
        $this->assertSame(['1.3.6.1.1'=>'INTEGER: 3'],$b['tables']['a']);
    }
    public function test_missing_response_is_partial_even_with_zero_exit_status(): void
    {
        $r=$this->child('$oids=__OIDS__;echo $oids[0]." = INTEGER: 3\n";');
        $b=$r->getQueued($this->olt(),['a'=>['1.3.6.1.1','1.3.6.1.2']],2);
        $this->assertFalse($b['reports']['a']['complete']);$this->assertSame('missing_response',$b['reports']['a']['reason']);
    }
    public function test_conflicting_exact_responses_are_not_last_wins(): void
    {
        $r=$this->child('$oids=__OIDS__;echo $oids[0]." = 3\n".$oids[0]." = 4\n";');
        $b=$r->getQueued($this->olt(),['a'=>['1.3.6.1.1']],2);
        $this->assertSame('conflicting_oid_values',$b['reports']['a']['reason']);$this->assertSame([],$b['tables']['a']);
    }
    public function test_queue_deadline_reports_unstarted_jobs_and_stops_children(): void
    {
        $r=$this->child('usleep(2000000);');$requests=[];
        for($i=1;$i<=12;$i++)$requests['q'.$i]=['1.3.6.1.'.$i];
        $b=$r->getQueued($this->olt(),$requests,0.12);
        $this->assertCount(12,$b['reports']);$started=count(array_filter($b['reports'],fn($r)=>$r['started']));
        $this->assertGreaterThan(0,$started);$this->assertLessThanOrEqual(4,$started);
        $this->assertLessThan(2500,$b['duration_ms']);foreach($b['reports'] as $report)$this->assertFalse($report['complete']);
    }
    public function test_finished_workers_accept_more_jobs_while_first_worker_is_slow(): void
    {
        $r=$this->child('$oids=__OIDS__;usleep(str_ends_with($oids[0],".1")?4000000:30000);echo $oids[0]." = 3\n";');
        $requests=[];for($i=1;$i<=5;$i++)$requests['q'.$i]=['1.3.6.1.'.$i];
        $b=$r->getQueued($this->olt(),$requests,2.5);
        $this->assertFalse($b['reports']['q1']['complete']);$this->assertTrue($b['reports']['q5']['complete']);
    }
    public function test_oversized_output_and_unsupported_requests_fail_explicitly(): void
    {
        $r=$this->child('echo str_repeat("x",70000);');
        $b=$r->getQueued($this->olt(),['a'=>['1.3.6.1.1'],'bad'=>['1.3.6;echo private']],2);
        $this->assertSame('output_limit',$b['reports']['a']['reason']);$this->assertSame('unsupported_request',$b['reports']['bad']['reason']);
        $this->assertFalse($b['reports']['bad']['started']);
    }
    public function test_rx_reads_only_current_online_tuples_without_bulk_rx_walk(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');$oid=self::RX.".$index.1.1";
        $r=$this->fixtureRunner([self::STATE.".$index.1"=>'3',self::STATE.".$index.2"=>'4'],[$oid=>'2500']);
        $b=Probe::readStateRxTables($this->olt());
        $this->assertSame([['states'=>self::STATE]],$r->walkCalls);$this->assertSame([$oid],array_merge(...array_values($r->calls[0]['requests'])));
        $this->assertTrue($b['_acquisition']['complete']);$this->assertSame(0,$b['_acquisition']['coverage']['missing_rx_after']);
    }
    public function test_pon_chunks_are_interleaved_and_first_pon_rotates(): void
    {
        $states=[];foreach([1,2,3] as $p){$index=Identity::ifIndexFromPort('1/1/'.$p);for($i=1;$i<=30;$i++)$states[self::STATE.".$index.$i"]='3';}
        $r=$this->fixtureRunner($states);Probe::readStateRxTables($this->olt());Probe::readStateRxTables($this->olt());
        $first=$r->calls[0]['requests'];$second=$r->calls[1]['requests'];$indexes=[];
        foreach(array_slice($first,0,3) as $oids){$this->assertCount(24,$oids);$parts=explode('.',$oids[0]);$indexes[]=$parts[count($parts)-3];}
        $this->assertCount(3,array_unique($indexes));
        $this->assertNotSame(reset($first)[0],reset($second)[0]);$this->assertLessThanOrEqual(20,$r->calls[0]['budget']);
    }
    public function test_identity_queries_both_hardware_serial_tables_for_current_state_scope(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');$states=[self::STATE.".$index.1"=>'3'];
        $r=$this->fixtureRunner($states,[Identity::PRIMARY.".$index.1"=>'TEST00000001']);
        $b=Probe::readIdentityTables($this->olt(),$states,true);
        $this->assertSame([Identity::PRIMARY.".$index",Identity::SECONDARY.".$index"],array_merge(...array_values($r->calls[0]['requests'])));
        $this->assertTrue($b['_complete']);$this->assertSame([''.$index.'_1'=>'TEST00000001'],Identity::fromTables($b['sn1'],$b['sn2']));
    }
    public function test_invalid_rx_is_unavailable_and_does_not_trigger_repeated_queries(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');$r=$this->fixtureRunner([self::STATE.".$index.1"=>'3'],[self::RX.".$index.1.1"=>'65535']);
        $b=Probe::readStateRxTables($this->olt());$this->assertCount(1,$r->calls);
        $sample=Sample::fromZteState(3,65535,Sample::timestamp());$this->assertTrue($sample['is_online']);$this->assertNull($sample['rx_power']);
    }
    public function test_partial_state_recovery_never_claims_complete_scope_or_reuses_snapshot_values(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');$olt=$this->olt();$olt->last_telemetry_snapshot=['onu_list'=>[['port'=>'1/1/15','onu_id'=>'2','status'=>'Online','rx_power'=>-23]]];
        $r=$this->fixtureRunner([self::STATE.".$index.1"=>'3'],[self::STATE.".$index.2"=>'4',self::RX.".$index.1.1"=>'2500'],false);
        $b=Probe::readStateRxTables($olt);$this->assertSame('4',$b['states'][self::STATE.".$index.2"]);
        $this->assertFalse($b['_acquisition']['complete']);$this->assertArrayNotHasKey(self::RX.".$index.2.1",$b['rx']);
        $this->assertLessThanOrEqual(5,$r->calls[0]['budget']);
    }
    public function test_no_online_state_does_not_send_point_queries(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');$r=$this->fixtureRunner([self::STATE.".$index.1"=>'4']);
        $b=Probe::readStateRxTables($this->olt());$this->assertSame([],$r->calls[0]['requests']);$this->assertTrue($b['_acquisition']['complete']);
    }
    public function test_identity_retry_queries_only_failed_pon_and_keeps_original_deadline(): void
    {
        $index=Identity::ifIndexFromPort('1/1/15');
        $r=new class($index) extends SnmpWalkRunner {
            public array $calls=[];
            public function __construct(private int $index){}
            public function walkQueued(OltDevice $olt,array $requests,float $budget=35): array
            {
                $this->calls[]=compact('requests','budget');$tables=[];$reports=[];
                foreach($requests as $key=>$oids) {
                    $fail=count($this->calls)===1 && str_starts_with($oids[0],Identity::SECONDARY.'.');
                    $tables[$key]=str_starts_with($oids[0],Identity::PRIMARY.'.')?[Identity::PRIMARY.'.'.$this->index.'.1'=>'TEST00000001']:[];
                    $reports[$key]=['complete'=>!$fail,'reason'=>$fail?'snmp_timeout':null];
                }
                return ['tables'=>$tables,'reports'=>$reports,'duration_ms'=>0,'started_at'=>Sample::timestamp(),'parameters'=>[]];
            }
        };
        app()->instance(SnmpWalkRunner::class,$r);
        $b=Probe::readIdentityTables($this->olt(),[self::STATE.".$index.1"=>'3'],true);
        $this->assertTrue($b['_complete']);$this->assertCount(2,$r->calls);$this->assertCount(1,$r->calls[1]['requests']);
        $this->assertSame([Identity::SECONDARY.".$index"],reset($r->calls[1]['requests']));
        $this->assertLessThanOrEqual(35,$r->calls[1]['budget']);
    }
}
