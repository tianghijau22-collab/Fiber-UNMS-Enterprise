<?php

namespace Tests\Unit;

use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\ZteOnuOpticalBatch as Batch;
use PHPUnit\Framework\TestCase;

class ZteOnuOpticalBatchTest extends TestCase
{
    private function row(string $sn, string $port, int $id): array
    {
        return ['serial_number'=>$sn,'port'=>$port,'onu_id'=>$id,'identity_source'=>Identity::SOURCE];
    }

    private function values(array $row, mixed $rx, mixed $state=3, ?string $actual=null): array
    {
        $index=Identity::ifIndexFromPort($row['port']);$id=$row['onu_id'];$sn=$actual??$row['serial_number'];
        return [Identity::PRIMARY.".$index.$id"=>$sn,Identity::SECONDARY.".$index.$id"=>$sn,
            "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$index.$id"=>$state,
            "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$index.$id.1"=>$rx];
    }

    public function test_same_onu_id_on_two_pons_uses_distinct_oids_and_distinct_readings(): void
    {
        $a=$this->row('TEST00000001','1/1/15',1);$b=$this->row('TEST00000002','1/1/16',1);
        $values=$this->values($a,2526)+$this->values($b,1712);$requests=[];
        $out=Batch::read(['TEST00000001','TEST00000002'],[$a,$b],function($oids)use($values,&$requests){$requests[]=$oids;return array_intersect_key($values,array_flip($oids));});
        $this->assertCount(1,$requests);$this->assertCount(8,$requests[0]);
        $this->assertSame(-24.95,$out['TEST00000001']['rx_power']);$this->assertSame(-26.58,$out['TEST00000002']['rx_power']);
        $this->assertSame('gpon-olt_1/1/16',$out['TEST00000002']['port']);
    }

    public function test_missing_optics_never_carries_previous_customer_power_or_invents_loss(): void
    {
        $a=$this->row('TEST00000001','1/1/15',1);$b=$this->row('TEST00000002','1/1/16',1);
        foreach([null,'No Such Instance currently exists at this OID',65535,2147483647,0] as $bad){
            $values=$this->values($a,2500)+$this->values($b,$bad);
            $out=Batch::read(['TEST00000001','TEST00000002'],[$a,$b],fn($oids)=>$values);
            $this->assertSame(-25.0,$out['TEST00000001']['rx_power']);$this->assertNull($out['TEST00000002']['rx_power']);
            $this->assertTrue($out['TEST00000002']['is_online']);$this->assertFalse($out['TEST00000002']['rx_available']);
        }
    }

    public function test_reused_or_contradictory_serial_and_partial_or_transient_state_are_unknown(): void
    {
        $row=$this->row('TEST00000001','1/1/15',1);
        $this->assertSame([],Batch::read(['TEST00000001'],[$row],fn($oids)=>$this->values($row,2500,3,'TEST00000002')));
        $bad=$this->values($row,2500);$bad[Identity::SECONDARY.'.'.Identity::ifIndexFromPort('1/1/15').'.1']='TEST00000002';
        $this->assertSame([],Batch::read(['TEST00000001'],[$row],fn($oids)=>$bad));
        foreach([null,'No Such Instance',0,2,99] as $state)$this->assertSame([],Batch::read(['TEST00000001'],[$row],fn($oids)=>$this->values($row,2500,$state)));
        $this->assertSame([],Batch::read(['TEST00000001'],[$row],fn($oids)=>throw new \RuntimeException('fixture timeout')));
        $this->assertSame([],Batch::read(['TEST00000001','TEST00000001'],[$row],fn($oids)=>throw new \RuntimeException('Duplicate registration must not query')));
    }

    public function test_only_confirmed_non_working_states_produce_an_offline_result(): void
    {
        $row=$this->row('TEST00000001','1/1/15',1);
        foreach([1,4,5,6] as $state){
            $out=Batch::read(['TEST00000001'],[$row],fn($oids)=>$this->values($row,65535,$state));
            $this->assertFalse($out['TEST00000001']['is_online']);$this->assertSame(-40.0,$out['TEST00000001']['rx_power']);
            $this->assertFalse($out['TEST00000001']['rx_available']);
        }
    }

    public function test_duplicate_customer_requests_read_the_selected_physical_tuple_once(): void
    {
        $at=date(DATE_ATOM);$a=$this->row('TEST00000001','1/2/3',12);$b=$this->row('TEST00000001','1/4/7',2);
        $a+=['identity_observed_at'=>$at]+\App\Services\Olt\OnuTelemetrySample::fromZteState(3,3926,$at);
        $b+=['identity_observed_at'=>$at]+\App\Services\Olt\OnuTelemetrySample::fromZteState(65535,65535,$at);
        $calls=[];$out=Batch::read(['TEST00000001','TEST00000001'],[$a,$b],function($oids)use(&$calls,$a){$calls[]=$oids;return $this->values($a,3926);});
        $this->assertCount(1,$calls);$this->assertCount(4,$calls[0]);$this->assertSame(-22.15,$out['TEST00000001']['rx_power']);
        $this->assertSame('12',$out['TEST00000001']['onu_id']);
    }
}
