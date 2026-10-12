<?php

namespace Tests\Unit;

use App\Services\Olt\SnmpTrapEnvelope;
use PHPUnit\Framework\TestCase;
use Tests\Support\TrapFixture as Trap;

class SnmpTrapEnvelopeTest extends TestCase
{
    public function test_v1_and_v2_extract_typed_identity(): void
    {
        $reader = new SnmpTrapEnvelope;
        $v1 = $reader->parse(Trap::v1('192.0.2.1'));
        $this->assertSame('v1', $v1['version']);
        $this->assertSame('192.0.2.1', $v1['agent_ip']);
        $v2 = $reader->parse(Trap::v2('SN: test00000001', '192.0.2.2'));
        $this->assertSame('v2c', $v2['version']);
        $this->assertSame('TEST00000001', $v2['serial_number']);
        $this->assertSame('192.0.2.2', $v2['agent_ip']);
        $this->assertSame('1.3.6.1.4.1.3902.1082.500.10.3.1.2', $v2['trap_oid']);
        $this->assertNull($reader->parse(Trap::v1('0.0.0.0'))['agent_ip']);
    }

    public function test_header_text_and_substrings_cannot_supply_customer_identity(): void
    {
        $reader = new SnmpTrapEnvelope;
        $this->assertNull($reader->parse(Trap::v2(null, null, 'TEST00000001@eventId=7'))['serial_number']);
        $this->assertNull($reader->parse(Trap::v2('prefixTEST00000001suffix'))['serial_number']);
        $this->assertSame('TEST00000001', $reader->parse(Trap::v2('TEST00000001 TEST00000001'))['serial_number']);
        $this->assertNull($reader->parse(Trap::v2('TEST00000001 TEST00000002')));
    }

    public function test_malformed_ambiguous_and_truncated_ber_is_rejected(): void
    {
        $reader = new SnmpTrapEnvelope;
        $packet = Trap::v2('TEST00000001');
        foreach ([0, 1, 2, 5, 12, strlen($packet) - 1] as $cut) $this->assertNull($reader->parse(substr($packet, 0, $cut)));
        foreach (['plain syslog', str_repeat('x', 4097), "\x30\x80\x00\x00", $packet.'extra', Trap::v2(null, null, '', []), Trap::v2(null, null, 'fixture-community', [Trap::binding('1.3.6.1.2.1.1.3.0', 67, "\x01")])] as $bad) {
            $this->assertNull($reader->parse($bad));
        }
        $badUptime = str_replace("\x43\x01\x01", "\x04\x01\x01", $packet);
        $this->assertNull($reader->parse($badUptime));
        $this->assertNull($reader->parse(Trap::v2(null, null, 'fixture-community', [Trap::binding('1.3.6.1.6.3.18.1.3.0', 4, '192.0.2.1')])));
    }
}
