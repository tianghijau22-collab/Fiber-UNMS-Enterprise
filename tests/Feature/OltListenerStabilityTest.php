<?php

namespace Tests\Feature;

use App\Console\Commands\ListenOltEvents;
use App\Services\Olt\OdpTopologyCache;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Console\OutputStyle;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

class OltListenerStabilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake();
        Http::preventStrayRequests();
        // Use the framework's real serialization path, with the production class restriction.
        Cache::swap(new Repository(new ArrayStore(true, false)));
        Schema::create('olt_devices', function (Blueprint $table) {
            $table->id(); $table->string('name');
        });
        Schema::create('network_nodes', function (Blueprint $table) {
            $table->id(); $table->string('name'); $table->string('code');
            $table->integer('parent_node_id')->nullable(); $table->integer('olt_device_id')->nullable();
            $table->string('olt_port_ref')->nullable();
        });
        Schema::create('customers', function (Blueprint $table) {
            $table->id(); $table->string('name'); $table->string('customer_number')->nullable();
        });
        Schema::create('customer_services', function (Blueprint $table) {
            $table->id(); $table->integer('customer_id');
        });
        Schema::create('network_ports', function (Blueprint $table) {
            $table->id(); $table->integer('node_id'); $table->integer('customer_service_id');
        });
        Schema::create('ont_registrations', function (Blueprint $table) {
            $table->id(); $table->integer('customer_service_id');
            $table->string('onu_serial')->nullable(); $table->string('onu_mac')->nullable();
            $table->string('status'); $table->float('rx_power')->nullable();
        });
        DB::table('olt_devices')->insert(['id' => 1, 'name' => 'OLT fixture']);
        DB::table('network_nodes')->insert([
            ['id' => 1, 'name' => 'ODC fixture', 'code' => 'ODC-T', 'parent_node_id' => null, 'olt_device_id' => 1, 'olt_port_ref' => null],
            ['id' => 2, 'name' => 'ODP fixture', 'code' => 'ODP-T', 'parent_node_id' => 1, 'olt_device_id' => 1, 'olt_port_ref' => '1/1/15'],
        ]);
        foreach ([1, 2] as $id) {
            DB::table('customers')->insert(['id' => $id, 'name' => 'Customer fixture '.$id, 'customer_number' => 'TEST-'.$id]);
            DB::table('customer_services')->insert(['id' => $id, 'customer_id' => $id]);
            DB::table('network_ports')->insert(['id' => $id, 'node_id' => 2, 'customer_service_id' => $id]);
            DB::table('ont_registrations')->insert(['id' => $id, 'customer_service_id' => $id, 'onu_serial' => 'TEST0000000'.$id, 'onu_mac' => null, 'status' => 'active', 'rx_power' => $id === 1 ? null : -25.09]);
        }
    }

    public function test_legacy_incomplete_objects_are_reproduced_and_not_reused(): void
    {
        Cache::put('odp_onus_topology_2', [(object) ['odc_name' => 'old object']], 30);
        $this->assertInstanceOf(\__PHP_Incomplete_Class::class, Cache::get('odp_onus_topology_2')[0]);
        $rows = app(OdpTopologyCache::class)->get(2);
        $this->assertCount(2, $rows);
        $this->assertSame('ODC fixture', $rows[0]['odc_name']);
        $this->assertIsArray(Cache::get('odp_onus_topology_v2_2')[0]);
        // The release does not clear unrelated/legacy keys or enable class deserialization.
        $this->assertInstanceOf(\__PHP_Incomplete_Class::class, Cache::get('odp_onus_topology_2')[0]);
        $this->assertFalse(config('cache.serializable_classes'));
    }

    public function test_warm_serialized_cache_avoids_queries_and_preserves_null_power(): void
    {
        $cold = app(OdpTopologyCache::class)->get(2);
        DB::enableQueryLog(); DB::flushQueryLog();
        $warm = app(OdpTopologyCache::class)->get(2);
        $this->assertSame($cold->all(), $warm->all());
        $this->assertSame([], DB::getQueryLog());
        $this->assertNull($warm[0]['rx_power']);
        $this->assertNull($warm[0]['onu_mac']);
        $this->assertEquals(-25.09, $warm[1]['rx_power']);
        $this->assertSame(['TEST00000001', 'TEST00000002'], $warm->pluck('onu_serial')->all());
    }

    public function test_invalid_and_cross_odp_payloads_rebuild_from_the_database(): void
    {
        $cache = app(OdpTopologyCache::class);
        $good = $cache->get(2)->all();
        $wrongOdp = $good; $wrongOdp[0]['odp_id'] = 999;
        $missingField = $good; unset($missingField[0]['odc_name']);
        $nested = $good; $nested[0]['odc_name'] = ['unexpected'];
        foreach ([false, 'bad payload', [(object) $good[0]], $wrongOdp, $missingField, $nested] as $bad) {
            Cache::put('odp_onus_topology_v2_2', $bad, 30);
            $this->assertSame($good, $cache->get(2)->all());
        }
    }

    public function test_expired_cache_reloads_and_an_empty_odp_is_cached(): void
    {
        $cache = app(OdpTopologyCache::class);
        $cache->get(2);
        DB::table('customers')->where('id', 1)->update(['name' => 'Updated fixture']);
        $this->assertSame('Customer fixture 1', $cache->get(2)[0]['customer_name']);
        $this->travel(31)->seconds();
        $this->assertSame('Updated fixture', $cache->get(2)[0]['customer_name']);
        $this->assertTrue($cache->get(999)->isEmpty());
        DB::enableQueryLog(); DB::flushQueryLog();
        $this->assertTrue($cache->get(999)->isEmpty());
        $this->assertSame([], DB::getQueryLog());
        $this->travelBack();
    }

    private function listener(): ListenerStabilityHarness
    {
        $listener = new ListenerStabilityHarness;
        $listener->setOutput(new OutputStyle(new ArrayInput([]), new BufferedOutput));
        return $listener;
    }

    public function test_a_packet_error_is_logged_and_the_next_packet_is_processed(): void
    {
        Log::shouldReceive('error')->once()->with('ListenOltEvents packet error', \Mockery::on(fn ($context) => $context['exception_class'] === \RuntimeException::class && $context['source_type'] === 'TRAP'));
        $listener = $this->listener();
        $listener->receive('throw', '192.0.2.1', 'TRAP');
        $listener->receive('valid', '192.0.2.1', 'SYSLOG');
        $this->assertSame(['throw', 'valid'], $listener->received);
    }

    public function test_logger_and_console_failure_do_not_stop_subsequent_packets(): void
    {
        Log::shouldReceive('error')->once()->andThrow(new \RuntimeException('logger unavailable'));
        $listener = $this->listener(); $listener->consoleUnavailable = true;
        $listener->receive('throw', '192.0.2.1', 'TRAP');
        $listener->receive('valid', '192.0.2.1', 'TRAP');
        $this->assertSame(['throw', 'valid'], $listener->received);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function test_mass_loss_and_recovery_consume_warm_arrays_without_object_access(): void
    {
        $fast = \Mockery::mock('alias:App\\Services\\Olt\\FastOpticalProbeService');
        $states = [
            'TEST00000001' => ['is_online' => false, 'rx_power' => -40.0],
            'TEST00000002' => ['is_online' => false, 'rx_power' => -40.0],
        ];
        $fast->shouldReceive('probeOdpStatus')->once()->with(2, null, 'gpon-olt_1/1/15')->andReturn(['success' => true, 'is_odp_down' => true, 'down_count' => 2, 'onu_states' => $states]);
        $fast->shouldReceive('instantBulkDbSync')->once()->with('inactive', null, 2, -40.0, []);
        $fast->shouldReceive('probeOdpStatus')->once()->with(2, null, 'gpon-olt_1/1/15', true)->andReturn(['success' => true, 'online_count' => 2, 'onu_states' => array_map(fn () => ['is_online' => true, 'rx_power' => -25.09], $states)]);
        $fast->shouldReceive('instantBulkDbSync')->once()->with('active', null, 2);
        $notifications = \Mockery::mock('alias:App\\Models\\AppNotification');
        $notifications->shouldReceive('notifyAll')->once()->withArgs(fn ($title, $body, $type) => $type === 'MASS_OUTAGE' && str_contains($body, 'Customer fixture 1'));
        $notifications->shouldReceive('notifyAll')->once()->withArgs(fn ($title, $body, $type) => $type === 'MASS_RECOVERY' && str_contains($body, 'Customer fixture 2'));
        app(OdpTopologyCache::class)->get(2);
        $listener = $this->listener();
        $listener->correlate(true, false);
        $this->assertTrue(Cache::has('notif_mass_down_2'));
        $listener->correlate(false, true);
        $this->assertFalse(Cache::has('notif_mass_down_2'));
        Http::assertNothingSent();
        $this->assertDatabaseCount('ont_registrations', 2);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function test_incomplete_probe_cannot_use_stale_database_to_raise_or_clear_mass_alarm(): void
    {
        $fast = \Mockery::mock('alias:App\\Services\\Olt\\FastOpticalProbeService');
        $fast->shouldReceive('probeOdpStatus')->twice()->andReturn(['success'=>false,'complete'=>false,'unknown_count'=>1,'online_count'=>1,'is_odp_down'=>false]);
        $fast->shouldNotReceive('instantBulkDbSync');
        $notifications=\Mockery::mock('alias:App\\Models\\AppNotification');$notifications->shouldNotReceive('notifyAll');
        app(OdpTopologyCache::class)->get(2);
        $listener=$this->listener();
        DB::table('ont_registrations')->update(['status'=>'inactive','rx_power'=>-40]);
        $listener->correlate(true,false);
        $this->assertFalse(Cache::has('notif_mass_down_2'));
        Cache::put('notif_mass_down_2',true,600);
        DB::table('ont_registrations')->update(['status'=>'active','rx_power'=>-25]);
        $listener->correlate(false,true);
        $this->assertTrue(Cache::has('notif_mass_down_2'));
        Http::assertNothingSent();
    }
}

class ListenerStabilityHarness extends ListenOltEvents
{
    public array $received = [];
    public bool $consoleUnavailable = false;

    public function receive(string $raw, string $ip, string $source): void
    {
        $this->processPacketSafely($raw, $ip, $source);
    }

    protected function processIncomingPacket(string $rawMsg, string $fromIp, string $sourceType)
    {
        $this->received[] = $rawMsg;
        if ($rawMsg === 'throw') throw new \RuntimeException('simulated packet failure');
    }

    public function error($string, $verbosity = null)
    {
        if ($this->consoleUnavailable) throw new \RuntimeException('console unavailable');
        parent::error($string, $verbosity);
    }

    public function correlate(bool $loss, bool $recovery): void
    {
        $this->handleOdpMassCorrelator(2, 'ODP fixture', 'gpon-olt_1/1/15', null, $loss, $recovery);
    }
}
