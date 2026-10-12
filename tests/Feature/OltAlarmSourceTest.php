<?php

namespace Tests\Feature;

use App\Console\Commands\ListenOltEvents;
use App\Services\Olt\OltAlarmSourceResolver;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\Support\TrapFixture as Trap;
use Tests\TestCase;

class OltAlarmSourceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake(); Http::preventStrayRequests();
        config(['olt_events.trusted_relays' => ['198.51.100.1' => [1, 2, 3]]]);
        Schema::create('olt_devices', function (Blueprint $table) {
            $table->id(); $table->string('name'); $table->string('status'); $table->string('ip_address');
            $table->string('snmp_community'); $table->text('last_telemetry_snapshot')->nullable();
        });
        foreach ([1, 2, 3] as $id) {
            DB::table('olt_devices')->insert(['id' => $id, 'name' => 'Fixture '.$id, 'status' => 'active', 'ip_address' => '192.0.2.'.$id, 'snmp_community' => 'fixture-community', 'last_telemetry_snapshot' => json_encode(['onu_list' => [['serial_number' => 'TEST0000000'.$id, 'port' => 'gpon-olt_1/1/1', 'onu_id' => 1]]])]);
        }
    }

    private function resolve(string $packet, string $ip = '198.51.100.1', string $type = 'TRAP'): array
    {
        return app(OltAlarmSourceResolver::class)->resolve($packet, $ip, $type);
    }

    public function test_shared_relay_uses_unique_serial_not_shared_community_or_port(): void
    {
        foreach ([1, 2, 3] as $id) {
            $result = $this->resolve(Trap::v2('TEST0000000'.$id, null, 'fixture-community@eventId=1@eventLevel=cleared'));
            $this->assertTrue($result['accepted']); $this->assertSame($id, $result['olt']->id);
        }
        $this->assertSame('relay_device_identity_missing', $this->resolve(Trap::v2())['reason']);
        $this->assertSame('community_mismatch', $this->resolve(Trap::v2('TEST00000001', null, 'wrong'))['reason']);
        $this->assertSame('untrusted_source', $this->resolve(Trap::v2('TEST00000001'), '198.51.100.2')['reason']);
    }

    public function test_original_agent_must_agree_with_serial_and_relay_allowlist(): void
    {
        $this->assertSame(2, $this->resolve(Trap::v1('192.0.2.2'))['olt']->id);
        $this->assertSame('serial_identity_conflict', $this->resolve(Trap::v2('TEST00000001', '192.0.2.2'))['reason']);
        $this->assertSame('agent_identity_conflict', $this->resolve(Trap::v1('192.0.2.99'))['reason']);
        config(['olt_events.trusted_relays' => ['198.51.100.1' => [1]]]);
        $this->assertSame('serial_identity_conflict', $this->resolve(Trap::v2('TEST00000002'))['reason']);
        $this->assertSame('relay_device_identity_missing', $this->resolve(Trap::v2())['reason']);
    }

    public function test_missing_duplicated_and_inactive_inventory_fails_closed(): void
    {
        $this->assertSame('serial_not_in_inventory', $this->resolve(Trap::v2('TEST99999999'))['reason']);
        DB::table('olt_devices')->where('id', 2)->update(['last_telemetry_snapshot' => json_encode(['unconfigured_onus' => [['serial_number' => 'TEST00000001']]])]);
        $this->assertSame('ambiguous_serial_inventory', $this->resolve(Trap::v2('TEST00000001'))['reason']);
        DB::table('olt_devices')->where('id', 1)->update(['status' => 'inactive']);
        $this->assertSame(2, $this->resolve(Trap::v2('TEST00000001'))['olt']->id);
        config(['olt_events.trusted_relays' => null]);
        $this->assertSame('invalid_source_configuration', $this->resolve(Trap::v2())['reason']);
    }

    public function test_direct_sources_require_active_unique_ip_and_matching_identity(): void
    {
        $this->assertTrue($this->resolve(Trap::v2(), '192.0.2.1')['accepted']);
        $this->assertSame('serial_identity_conflict', $this->resolve(Trap::v2('TEST00000002'), '192.0.2.1')['reason']);
        $this->assertTrue($this->resolve('ONU 1/1/1:1 LOS TEST00000001', '192.0.2.1', 'SYSLOG')['accepted']);
        $this->assertSame('relay_syslog_identity_missing', $this->resolve('ONU 1/1/1:1 LOS TEST00000001', '198.51.100.1', 'SYSLOG')['reason']);
        $this->assertSame('malformed_or_unsupported_trap', $this->resolve('ONU 1/1/1:1 LOS TEST00000001')['reason']);
        DB::table('olt_devices')->where('id', 2)->update(['ip_address' => '192.0.2.1']);
        $this->assertSame('ambiguous_direct_source', $this->resolve(Trap::v2(), '192.0.2.1')['reason']);
    }

    public function test_rejected_packets_cannot_reach_customer_queries_or_business_writes(): void
    {
        DB::enableQueryLog(); DB::flushQueryLog();
        $listener = new AlarmSourceHarness;
        $listener->receive(Trap::v2('TEST00000001', null, 'fixture-community@eventId=1@eventLevel=critical'), '198.51.100.99');
        $this->assertSame('untrusted_source', Cache::get('olt_alarm_source_last_rejected')['reason']);
        $this->assertNull(Cache::get('olt_priority_ports_1'));
        foreach (DB::getQueryLog() as $query) {
            $this->assertStringContainsString('select', strtolower($query['query']));
            $this->assertStringNotContainsString('ont_registrations', $query['query']);
        }
        $last = Cache::get('olt_alarm_source_last_rejected');
        $this->assertArrayNotHasKey('community', $last); $this->assertArrayNotHasKey('serial_number', $last);
        $this->assertSame(1, Cache::get('olt_alarm_source_rejected_'.now()->toDateString()));
        Http::assertNothingSent();
    }

    public function test_a_non_actionable_accepted_packet_records_only_safe_source_metadata(): void
    {
        $listener = new AlarmSourceHarness;
        $listener->receive(Trap::v2('TEST00000002', null, 'fixture-community@eventId=1@eventLevel=minor'), '198.51.100.1');
        $last = Cache::get('olt_alarm_source_last_accepted');
        $this->assertSame(2, $last['olt_id']);
        $this->assertSame('trusted_relay_identity', $last['reason']);
        $this->assertArrayNotHasKey('community', $last);
        $this->assertArrayNotHasKey('serial_number', $last);
        $this->assertNull(Cache::get('olt_priority_ports_2'));
        Http::assertNothingSent();
    }

    public function test_listener_rejects_a_wildcard_or_invalid_bind_before_opening_sockets(): void
    {
        foreach (['0.0.0.0', 'invalid-host'] as $address) {
            config(['olt_events.bind_address' => $address]);
            $this->artisan('olt:listen-events')->assertExitCode(1);
        }
    }
}

class AlarmSourceHarness extends ListenOltEvents
{
    public function receive(string $packet, string $ip): void { $this->processIncomingPacket($packet, $ip, 'TRAP'); }
}
