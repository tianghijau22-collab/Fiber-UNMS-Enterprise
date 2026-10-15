<?php

namespace Tests\Unit;

use App\Services\Olt\SnmpConnector;
use App\Services\Olt\ZteC320Driver;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use Mockery;
use PHPUnit\Framework\TestCase;

class ZteDriverIdentityTest extends TestCase
{
    protected function tearDown(): void { Mockery::close(); parent::tearDown(); }

    public function test_per_port_driver_returns_real_onu_one_and_quarantines_contradictory_serial_tables(): void
    {
        $idx=Identity::ifIndexFromPort('1/1/16');
        $snmp=Mockery::mock(SnmpConnector::class);
        $snmp->shouldReceive('isReachable')->once()->andReturn(true);
        $tables=[
            Identity::PRIMARY.".$idx"=>[Identity::PRIMARY.".$idx.1"=>'TEST00000001',Identity::PRIMARY.".$idx.2"=>'TEST00000002'],
            Identity::SECONDARY.".$idx"=>[Identity::SECONDARY.".$idx.1"=>'TEST00000001',Identity::SECONDARY.".$idx.2"=>'TEST00000003'],
            "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$idx"=>["1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$idx.1"=>'3'],
            "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$idx"=>["1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$idx.1.1"=>'1500'],
        ];
        $snmp->shouldReceive('walk')->andReturnUsing(fn($oid)=>$tables[$oid]??[]);
        $rows=(new IdentityDriverHarness($snmp))->getOnuListByPort('1/1/16');
        $this->assertCount(1,$rows);
        $this->assertSame('1',$rows[0]['onu_id']);
        $this->assertSame('gpon-olt_1/1/16',$rows[0]['port']);
        $this->assertSame(Identity::SOURCE,$rows[0]['identity_source']);
        $this->assertSame('TEST00000001',$rows[0]['serial_number']);
    }

    public function test_malformed_port_cannot_fall_back_to_port_one_or_send_a_query(): void
    {
        $snmp=Mockery::mock(SnmpConnector::class);$snmp->shouldNotReceive('walk');$snmp->shouldNotReceive('isReachable');
        $driver=new IdentityDriverHarness($snmp);
        foreach(['','1/1','1/1/16:2','1/1/0','1/1/15,1/1/16'] as $port) $this->assertSame([],$driver->getOnuListByPort($port));
    }

    public function test_driver_does_not_infer_offline_from_missing_power_or_online_from_missing_state(): void
    {
        $idx=Identity::ifIndexFromPort('1/1/16');$snmp=Mockery::mock(SnmpConnector::class);
        $snmp->shouldReceive('isReachable')->once()->andReturn(true);
        $tables=[Identity::PRIMARY.".$idx"=>[Identity::PRIMARY.".$idx.1"=>'TEST00000001',Identity::PRIMARY.".$idx.2"=>'TEST00000002'],
            "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$idx"=>["1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$idx.1"=>'3']];
        $snmp->shouldReceive('walk')->andReturnUsing(fn($oid)=>$tables[$oid]??[]);
        $rows=(new IdentityDriverHarness($snmp))->getOnuListByPort('1/1/16');
        $this->assertTrue($rows[0]['is_online']);$this->assertNull($rows[0]['rx_power']);
        $this->assertNull($rows[1]['is_online']);$this->assertSame('Unknown',$rows[1]['status']);
    }
}

class IdentityDriverHarness extends ZteC320Driver
{
    public function __construct(SnmpConnector $snmp)
    {
        parent::__construct(isLive:false);
        $this->isLive=true;$this->snmp=$snmp;
    }
}
