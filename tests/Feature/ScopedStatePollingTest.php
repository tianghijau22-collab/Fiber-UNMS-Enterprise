<?php
namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\FastOpticalProbeService as Probe;
use App\Services\Olt\SnmpWalkRunner;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\OnuTelemetrySample as Sample;
use Tests\TestCase;

class ScopedStatePollingTest extends TestCase
{
    private const ROOT='1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';
    private const NAMES='1.3.6.1.2.1.31.1.1.1.1';
    private function olt(): OltDevice
    {
        $olt=(new OltDevice)->forceFill(['id'=>61,'ip_address'=>'192.0.2.1','snmp_version'=>'v2c']);
        $olt->last_telemetry_snapshot=['onu_list'=>array_map(fn($i)=>['port'=>'gpon-olt_1/2/1','onu_id'=>(string)$i,'status'=>'Online'],range(1,257))];
        return $olt;
    }
    private function runner(array $names,bool $discoveryComplete=true,bool $queueComplete=true): SnmpWalkRunner
    {
        $runner=new class($names,$discoveryComplete,$queueComplete) extends SnmpWalkRunner {
            public array $walkCalls=[];public array $queueCalls=[];
            public function __construct(private array $names,private bool $discoveryComplete,private bool $queueComplete){}
            public function walk(OltDevice $olt,array $oids,int $repetitions=10,float $timeout=5,int $retries=2,float $budget=35): array
            {
                $this->walkCalls[]=compact('oids','budget');
                $key=array_key_first($oids);$rows=$key==='interfaces'?$this->names:[self::root().'.'.Identity::ifIndexFromPort('1/2/1').'.1'=>'INTEGER: 3'];
                return ['tables'=>[$key=>$rows],'reports'=>[$key=>['complete'=>$key==='interfaces'?$this->discoveryComplete:true,'rows'=>count($rows)]],
                    'started_at'=>Sample::timestamp(),'finished_at'=>Sample::timestamp(),'duration_ms'=>0,'parameters'=>[]];
            }
            private static function root(): string {return '1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';}
            public function walkQueued(OltDevice $olt,array $requests,float $budget=35): array
            {
                $this->queueCalls[]=compact('requests','budget');$tables=[];$reports=[];
                foreach($requests as $key=>$oids) {
                    // Port 2 contains a new ONU absent from the previous snapshot; port 3 is empty.
                    $empty=str_ends_with($oids[0],'.'.Identity::ifIndexFromPort('1/2/3'));
                    $tables[$key]=$empty?[]:[$oids[0].'.88'=>'INTEGER: 3'];
                    $reports[$key]=['complete'=>$this->queueComplete,'reason'=>$this->queueComplete?null:'snmp_timeout','rows'=>count($tables[$key]),'started'=>true];
                }
                return ['tables'=>$tables,'reports'=>$reports,'started_at'=>Sample::timestamp(),'duration_ms'=>0,'parameters'=>['concurrency'=>4]];
            }
        };
        app()->instance(SnmpWalkRunner::class,$runner);return $runner;
    }
    private function names(): array
    {
        return [self::NAMES.'.268435456'=>'STRING: "gpon_1/2/1"',self::NAMES.'.268435712'=>'STRING: "gpon_1/2/2"',self::NAMES.'.268435968'=>'STRING: "gpon_1/2/3"',self::NAMES.'.100'=>'STRING: "gei_1/3/1"'];
    }
    public function test_fresh_hardware_names_cover_new_and_empty_ports_using_vendor_tuple_indexes(): void
    {
        $r=$this->runner($this->names());$b=Probe::readStateTables($this->olt());
        $this->assertTrue($b['reports']['states']['complete']);$this->assertCount(1,$r->walkCalls);
        $requested=array_merge(...array_values($r->queueCalls[0]['requests']));
        $this->assertContains(self::ROOT.'.'.Identity::ifIndexFromPort('1/2/2'),$requested);
        $this->assertContains(self::ROOT.'.'.Identity::ifIndexFromPort('1/2/3'),$requested);
        $this->assertNotContains(self::ROOT.'.268435456',$requested);
        $this->assertArrayHasKey(self::ROOT.'.'.Identity::ifIndexFromPort('1/2/2').'.88',$b['tables']['states']);
        $this->assertLessThanOrEqual(35,$r->queueCalls[0]['budget']);$this->assertSame(3,$b['state_discovery']['scope']['ports']);
    }
    public function test_incomplete_discovery_falls_back_to_root_with_remaining_budget(): void
    {
        $r=$this->runner($this->names(),false);$b=Probe::readStateTables($this->olt());
        $this->assertSame([],$r->queueCalls);$this->assertCount(2,$r->walkCalls);
        $this->assertSame(['states'=>self::ROOT],$r->walkCalls[1]['oids']);
        $this->assertLessThanOrEqual(35,$r->walkCalls[1]['budget']);$this->assertSame('root_fallback',$b['state_discovery']['strategy']);
    }
    public function test_missing_known_port_duplicate_or_unrecognized_gpon_scope_cannot_exclude_root(): void
    {
        foreach([
            [self::NAMES.'.1'=>'STRING: "gpon_1/2/2"'],
            $this->names()+[self::NAMES.'.9'=>'STRING: "gpon-olt_1/2/1"'],
            $this->names()+[self::NAMES.'.9'=>'STRING: "gpon_unsupported"'],
            [],
        ] as $names) {
            $r=$this->runner($names);$b=Probe::readStateTables($this->olt());
            $this->assertSame([],$r->queueCalls);$this->assertSame('root_fallback',$b['state_discovery']['strategy']);
        }
    }
    public function test_failed_pon_walk_stays_partial_even_if_old_snapshot_says_online(): void
    {
        $r=$this->runner($this->names(),true,false);$b=Probe::readStateTables($this->olt());
        $this->assertFalse($b['reports']['states']['complete']);$this->assertSame('incomplete_pon_walks',$b['reports']['states']['reason']);
        $this->assertCount(2,$r->queueCalls);$this->assertArrayNotHasKey(self::ROOT.'.'.Identity::ifIndexFromPort('1/2/1').'.1',$b['tables']['states']);
    }
    public function test_small_or_first_run_tables_keep_root_discovery(): void
    {
        $r=$this->runner($this->names());$olt=$this->olt();$olt->last_telemetry_snapshot=[];
        $b=Probe::readStateTables($olt);$this->assertSame([['oids'=>['states'=>self::ROOT],'budget'=>$r->walkCalls[0]['budget']]],$r->walkCalls);
        $this->assertSame([],$r->queueCalls);$this->assertTrue($b['reports']['states']['complete']);
    }
}
