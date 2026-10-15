<?php

namespace Tests\Unit;

use App\Services\Olt\OnuTelemetrySample as Sample;
use PHPUnit\Framework\TestCase;

class OnuTelemetrySampleTest extends TestCase
{
    public function test_missing_and_transient_state_are_unknown_even_after_many_attempts(): void
    {
        foreach([null,0,2,7,'3'] as $state) {
            $sample=Sample::fromZteState($state,2526,'2026-10-13T00:00:00+00:00');
            $this->assertNull($sample['is_online']);$this->assertNull($sample['rx_power']);
        }
    }

    public function test_working_state_is_independent_of_missing_or_invalid_power(): void
    {
        foreach([null,0,65535,2147483647] as $raw) {
            $sample=Sample::fromZteState(3,$raw,'2026-10-13T00:00:00+00:00');
            $this->assertTrue($sample['is_online']);$this->assertNull($sample['rx_power']);$this->assertFalse($sample['rx_available']);
        }
        $this->assertSame(-24.95,Sample::fromZteState(3,2526,'now')['rx_power']);
    }

    public function test_offline_state_never_uses_an_optical_number_as_recovery(): void
    {
        foreach([1,4,5,6] as $state) {
            $sample=Sample::fromZteState($state,2526,'now');$this->assertFalse($sample['is_online']);$this->assertNull($sample['rx_power']);
        }
    }

    public function test_interface_response_must_be_explicit_up_or_down(): void
    {
        $this->assertTrue(Sample::interfaceIsUp('INTEGER: 1'));$this->assertFalse(Sample::interfaceIsUp(2));
        foreach([null,'No Such Instance',0,3,4,5,6,7,'broken'] as $value)$this->assertNull(Sample::interfaceIsUp($value));
    }

    public function test_other_oid_with_same_suffix_and_missing_instance_cannot_establish_port_loss(): void
    {
        $requested=['1.3.6.1.2.1.2.2.1.8.268504832'=>'1/1/15','1.3.6.1.2.1.2.2.1.8.268505088'=>'1/1/16'];
        $rows=Sample::interfaceReadings(['1.3.6.1.4.1.999.268504832'=>'2','1.3.6.1.2.1.2.2.1.8.268504832'=>'No Such Instance',
            'iso.3.6.1.2.1.2.2.1.8.268505088'=>'1'],$requested);
        $this->assertArrayNotHasKey('1/1/15',$rows);$this->assertTrue($rows['1/1/16']['is_up']);
    }
}
