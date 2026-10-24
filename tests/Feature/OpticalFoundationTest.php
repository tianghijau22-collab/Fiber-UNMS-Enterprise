<?php

namespace Tests\Feature;

use App\Jobs\PublishOpticalFaultNotification as Publish;
use App\Models\OltDevice;
use App\Services\GisOpticalFaultAnalyzer as Analyzer;
use App\Services\NetworkOpticalEvidence as Evidence;
use App\Services\OpticalFaultLocalizationService as Detector;
use App\Services\Olt\OnuTelemetrySample as Sample;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OpticalFoundationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake(); Http::preventStrayRequests(); Bus::fake([Publish::class]);
    }

    private function at(int $ago = 0): string { return date(DATE_ATOM, time() - $ago); }

    private function fixture(string $condition, int $age = 10, bool $segment = false): array
    {
        $at = $this->at($age);
        $view = ['olt_id'=>1, 'gpon_interface'=>'gpon-olt_1/1/1', 'identity_status'=>'resolved',
            'telemetry_freshness'=>'fresh', 'sampled_at'=>$at, 'is_online'=>true,
            'rx_available'=>$condition !== 'down', 'rx_power'=>$condition === 'down' ? null : -35.5];
        $e = Evidence::evidence([$view, $view], 2, [1=>['status'=>'available']]);
        if ($condition === 'unknown') $e = array_replace($e, ['state'=>'unknown', 'unverified_clients'=>2, 'signal_clients'=>0]);
        if ($condition === 'partial') $e = array_replace($e, ['signal_clients'=>1, 'no_rx_clients'=>1]);
        $nodes = [['id'=>1, 'name'=>'ODP <1>', 'code'=>'ODP-1', 'node_type'=>'ODP', 'status'=>'active',
            'latitude'=>0, 'longitude'=>100, 'best_rx_power'=>$view['rx_power'], 'optical_evidence'=>$e]];
        $observations = [1=>['evidence'=>$e, 'members'=>'members-1', 'clients'=>[]]];
        $cables = [];
        if ($segment) {
            $healthy = $nodes[0]; $healthy['id'] = 99; $healthy['name'] = 'ODP 99';
            $healthy['optical_evidence'] = Evidence::evidence([array_replace($view, ['rx_available'=>true, 'rx_power'=>-35.5])], 1, [1=>['status'=>'available']]);
            $nodes[] = $healthy;
            $observations[99] = ['evidence'=>$healthy['optical_evidence'], 'members'=>'members-99', 'clients'=>[]];
            $cables = [['id'=>7, 'from_node_id'=>99, 'to_node_id'=>1, 'status'=>'active', 'route_coordinates'=>null]];
        }
        return ['nodes'=>$nodes, 'observations'=>$observations, 'cables'=>$cables,
            'diagnostics'=>Analyzer::analyze($nodes, $cables), 'network_status'=>'AVAILABLE',
            'sources'=>[1=>['id'=>1, 'name'=>'OLT fixture', 'status'=>'available', 'reason'=>null, 'sampled_at'=>$at]]];
    }

    private function evaluate(array $data): array
    {
        $repository = \Mockery::mock(Evidence::class); $repository->shouldReceive('capture')->once()->andReturn($data);
        $this->app->instance(Evidence::class, $repository);
        $state = Cache::get(Detector::STATE_KEY, ['records'=>[]]); $state['evaluated_at'] = 0; Cache::forever(Detector::STATE_KEY, $state);
        return Detector::runDiagnostic();
    }

    private function dispatched(): array
    {
        return Bus::dispatched(Publish::class)->map(fn($item)=>$item->event)->all();
    }

    public function test_background_evaluation_consumes_stored_evidence_and_keeps_a_unique_burst_key(): void
    {
        $detector = \Mockery::mock(Detector::class);
        $detector->shouldReceive('evaluate')->once()->andReturn(['evaluation_status'=>'EVALUATED']);
        $this->app->instance(Detector::class, $detector);
        $job = new \App\Jobs\EvaluateStoredOpticalFaults;
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldBeUnique::class, $job);
        $job->handle(); $this->assertSame('fona-stored-optical-evaluation', $job->uniqueId());
        Http::assertNothingSent();
    }

    public function test_preview_does_not_write_state_dispatch_notifications_or_use_database(): void
    {
        $repository = \Mockery::mock(Evidence::class); $repository->shouldReceive('capture')->once()->andReturn($this->fixture('down'));
        $this->app->instance(Evidence::class, $repository);
        DB::enableQueryLog(); $before = Cache::get(Detector::STATE_KEY);
        $r = Detector::preview();
        $this->assertSame(1, $r['mass_outages_detected']); $this->assertSame($before, Cache::get(Detector::STATE_KEY));
        $this->assertSame([], DB::getQueryLog()); Bus::assertNothingDispatched(); Http::assertNothingSent();
    }

    public function test_repeated_data_cannot_raise_an_alarm_and_full_fresh_recovery_is_required(): void
    {
        $this->evaluate($this->fixture('up', 60));
        $this->evaluate($this->fixture('down', 50));
        $this->evaluate($this->fixture('down', 50)); Bus::assertNothingDispatched();
        $this->evaluate($this->fixture('down', 40)); Bus::assertDispatchedTimes(Publish::class, 1);
        $event = $this->dispatched()[0]; Detector::delivered($event);
        $this->evaluate($this->fixture('unknown', 30));
        $this->evaluate($this->fixture('partial', 25));
        $this->assertTrue(Cache::get(Detector::STATE_KEY)['records']['odp:1']['active']);
        $this->evaluate($this->fixture('up', 15));
        $this->evaluate($this->fixture('up', 5)); Bus::assertDispatchedTimes(Publish::class, 2);
        $this->assertSame('recovery', $this->dispatched()[1]['transition']);
        $this->assertFalse(Detector::deliveryCurrent($event)); Http::assertNothingSent();
    }

    public function test_deployment_baseline_does_not_rebroadcast_existing_outages(): void
    {
        $this->evaluate($this->fixture('down', 40));
        $this->evaluate($this->fixture('down', 30));
        $this->evaluate($this->fixture('up', 20));
        $this->evaluate($this->fixture('up', 10)); Bus::assertNothingDispatched();
    }

    public function test_segment_disappearance_and_topology_edits_cannot_announce_cable_recovery(): void
    {
        $this->evaluate($this->fixture('up', 70, true));
        // First eligible segment is a quiet baseline; a later complete recovery also stays quiet.
        $this->evaluate($this->fixture('down', 60, true));
        $this->evaluate($this->fixture('down', 50, true));
        $state = Cache::get(Detector::STATE_KEY);
        $this->assertTrue($state['records']['segment:cable-7']['active']);
        $state['records']['segment:cable-7']['notified'] = true;
        Cache::forever(Detector::STATE_KEY, $state);
        $unknown = $this->fixture('unknown', 40, true);
        $this->evaluate($unknown);
        $this->assertTrue(Cache::get(Detector::STATE_KEY)['records']['segment:cable-7']['active']);
        $edited = $this->fixture('up', 30, true); $edited['cables'][0]['to_node_id'] = 999;
        $this->evaluate($edited); $edited = $this->fixture('up', 20, true); $edited['cables'][0]['to_node_id'] = 999;
        $this->evaluate($edited);
        $this->assertTrue(Cache::get(Detector::STATE_KEY)['records']['segment:cable-7']['active']);
        $this->assertSame([], array_values(array_filter($this->dispatched(), fn($e)=>$e['context']['kind'] === 'segment' && $e['transition'] === 'recovery')));
    }

    public function test_a_new_segment_outage_after_a_healthy_baseline_can_notify_and_recover(): void
    {
        $this->evaluate($this->fixture('up', 70, true));
        $this->evaluate($this->fixture('down', 60, true));
        $this->evaluate($this->fixture('down', 50, true));
        $events = array_values(array_filter($this->dispatched(), fn($e)=>$e['context']['kind'] === 'segment'));
        $this->assertCount(1, $events); $this->assertSame('outage', $events[0]['transition']);
        Detector::delivered($events[0]);
        $this->evaluate($this->fixture('up', 35, true));
        $this->evaluate($this->fixture('up', 20, true));
        $events = array_values(array_filter($this->dispatched(), fn($e)=>$e['context']['kind'] === 'segment'));
        $this->assertCount(2, $events); $this->assertSame('recovery', $events[1]['transition']);
    }

    public function test_queued_alarm_for_a_removed_node_is_retired_without_false_recovery(): void
    {
        $this->evaluate($this->fixture('up', 60)); $this->evaluate($this->fixture('down', 45)); $this->evaluate($this->fixture('down', 30));
        $event = $this->dispatched()[0];
        $data = $this->fixture('up', 10); $data['nodes'] = []; $data['observations'] = [];
        $this->evaluate($data);
        $this->assertFalse(Detector::deliveryCurrent($event));
        Bus::assertDispatchedTimes(Publish::class, 1);
    }

    public function test_new_typed_notifications_are_accepted_without_broadening_individual_alerts(): void
    {
        Schema::create('system_notifications', function(Blueprint $t) {
            $t->id(); $t->integer('user_id')->nullable(); foreach (['type','title','body','url','icon','image_url'] as $f) $t->text($f)->nullable();
            $t->boolean('is_read')->default(false); $t->timestamps(); $t->softDeletes();
        });
        // Avoid any credential access or external push while exercising the real notification policy/database.
        Cache::put('firebase_fcm_access_token', '', 60);
        foreach (['OPTICAL_SEGMENT_INDICATION','OPTICAL_SEGMENT_RECOVERY','SOURCE_UNAVAILABLE','SOURCE_RECOVERY'] as $type) {
            $this->assertNotNull(\App\Models\AppNotification::notifyAll('Fixture '.$type, 'Fixture body', $type, null, null, false));
            $this->assertTrue(\App\Services\TelegramService::isMassOrCriticalNotification('Fixture', 'Fixture', $type));
        }
        $this->assertNull(\App\Models\AppNotification::notifyAll('Modem individual fixture', 'Fixture', 'INDIVIDUAL', null, null, false));
        $this->assertDatabaseCount('system_notifications', 4); Http::assertNothingSent();
    }

    public function test_source_outage_is_separate_and_never_claims_a_physical_cable_cut(): void
    {
        $this->evaluate($this->fixture('up', 60));
        foreach ([40, 25] as $age) {
            $data = $this->fixture('unknown', $age);
            $data['sources'][1] = array_replace($data['sources'][1], ['status'=>'unavailable', 'reason'=>'olt_not_responding']);
            $this->evaluate($data);
        }
        Bus::assertDispatchedTimes(Publish::class, 1);
        $event = $this->dispatched()[0]; $this->assertSame('source', $event['context']['kind']);
        [$title, $body, $type] = Publish::message($event);
        $this->assertSame('SOURCE_UNAVAILABLE', $type); $this->assertStringContainsString('bukan bukti kabel putus', $body);
        $this->assertTrue(\App\Services\TelegramService::isMassOrCriticalNotification($title, $body, $type));
    }

    public function test_stale_queued_notification_is_discarded_and_delivery_is_not_repeated(): void
    {
        $this->evaluate($this->fixture('up', 60)); $this->evaluate($this->fixture('down', 45)); $this->evaluate($this->fixture('down', 30));
        $event = $this->dispatched()[0];
        $job = new class($event) extends Publish {
            public int $calls = 0;
            protected function publish(string $title, string $body, string $type): bool { $this->calls++; return true; }
        };
        $job->handle(); $job->handle(); $this->assertSame(1, $job->calls);
        [$title, $body] = Publish::message($event);
        $this->assertStringContainsString('&lt;1&gt;', $title);
        $this->assertStringNotContainsString('-40.00', $body);
        $this->assertStringNotContainsString('-20.5', $body);
    }

    public function test_shared_evidence_rejects_missing_source_and_duplicate_customer_aliases(): void
    {
        $view = ['olt_id'=>1, 'gpon_interface'=>'gpon-olt_1/1/1', 'onu_id'=>1, 'identity_status'=>'resolved',
            'telemetry_freshness'=>'fresh', 'sampled_at'=>$this->at(), 'is_online'=>true, 'rx_available'=>false, 'rx_power'=>null];
        $this->assertSame('no_rx', Evidence::evidence([$view], 1, [1=>['status'=>'available']])['state']);
        $this->assertSame('unknown', Evidence::evidence([$view], 1, [1=>['status'=>'unavailable']])['state']);
        $this->assertSame('unknown', Evidence::evidence([$view], 1, [])['state']);
        $this->assertSame('unknown', Evidence::evidence([$view, $view], 2, [1=>['status'=>'available']])['state']);
        $weak = array_replace($view, ['rx_available'=>true, 'rx_power'=>-35.5]);
        $this->assertSame('signal', Evidence::evidence([$weak], 1, [1=>['status'=>'available']])['state']);
    }

    public function test_source_uses_cached_transport_observation_even_when_rx_is_partial(): void
    {
        $device = new OltDevice(['name'=>'Fixture', 'ip_address'=>'10.0.0.2', 'status'=>'active', 'connection_mode'=>'live']); $device->id = 1;
        $network = ['status'=>'AVAILABLE', 'interface'=>'ppp0', 'routes'=>[['dst'=>'10.0.0.0/8', 'dev'=>'ppp0']]];
        $attempt = ['result'=>'PARTIAL', 'connection'=>['status'=>'RESPONDING', 'checked_at'=>$this->at()]];
        $this->assertSame('available', Evidence::source($device, $network, $attempt)['status']);
        $attempt['connection']['checked_at'] = $this->at(181);
        $this->assertSame('unknown', Evidence::source($device, $network, $attempt)['status']);
        $network['status'] = 'DISCONNECTED';
        $this->assertSame('unavailable', Evidence::source($device, $network, $attempt)['status']);
    }

    public function test_repository_ignores_legacy_rx_and_soft_deleted_customers_without_writing_or_probing(): void
    {
        Schema::create('olt_devices', function(Blueprint $t) { $t->id(); foreach (['name','vendor_key','vendor','connection_mode','status','ip_address'] as $f) $t->string($f)->nullable(); $t->json('last_telemetry_snapshot')->nullable(); });
        Schema::create('network_nodes', function(Blueprint $t) { $t->id(); foreach (['name','code','node_type','status'] as $f) $t->string($f); foreach (['parent_node_id','olt_device_id'] as $f) $t->integer($f)->nullable(); $t->float('latitude')->nullable(); $t->float('longitude')->nullable(); $t->softDeletes(); });
        Schema::create('customers', function(Blueprint $t) { $t->id(); $t->string('name'); $t->string('customer_number'); $t->softDeletes(); });
        Schema::create('customer_services', function(Blueprint $t) { $t->id(); $t->integer('customer_id'); $t->softDeletes(); });
        Schema::create('network_ports', function(Blueprint $t) { $t->id(); $t->integer('node_id'); $t->integer('customer_service_id')->nullable(); $t->string('status'); $t->string('customer_name_cache')->nullable(); });
        Schema::create('ont_registrations', function(Blueprint $t) { $t->id(); $t->integer('customer_service_id'); $t->string('onu_serial'); $t->string('onu_mac')->nullable(); $t->string('status'); $t->float('rx_power')->nullable(); $t->softDeletes(); });
        Schema::create('network_cables', function(Blueprint $t) { $t->id(); $t->softDeletes(); });
        $rows = [];
        foreach ([1,2] as $id) {
            $rows[] = array_replace(['serial_number'=>'TEST0000000'.$id, 'port'=>'gpon-olt_1/1/1', 'onu_id'=>$id,
                'identity_source'=>Identity::SOURCE, 'identity_observed_at'=>$this->at()], Sample::fromZteState(3, 4000, $this->at()));
            DB::table('customers')->insert(['id'=>$id, 'name'=>'Customer '.$id, 'customer_number'=>'CM'.$id]);
            DB::table('customer_services')->insert(['id'=>$id, 'customer_id'=>$id]);
            DB::table('network_ports')->insert(['id'=>$id, 'node_id'=>1, 'customer_service_id'=>$id, 'status'=>'used']);
            DB::table('ont_registrations')->insert(['id'=>$id, 'customer_service_id'=>$id, 'onu_serial'=>'TEST0000000'.$id, 'status'=>'inactive', 'rx_power'=>-40]);
        }
        DB::table('network_nodes')->insert(['id'=>1, 'name'=>'ODP', 'code'=>'ODP', 'node_type'=>'ODP', 'status'=>'active', 'olt_device_id'=>1]);
        DB::table('olt_devices')->insert(['id'=>1, 'name'=>'OLT', 'vendor_key'=>'zte', 'status'=>'active', 'connection_mode'=>'live', 'ip_address'=>'10.0.0.2', 'last_telemetry_snapshot'=>json_encode(['onu_list'=>$rows])]);
        Cache::put('olt_poll_health_v1_1', ['connection'=>['status'=>'RESPONDING', 'checked_at'=>$this->at()]], 60);
        $repository = new class extends Evidence {
            protected function network(): array { return ['status'=>'AVAILABLE', 'interface'=>'ppp0', 'routes'=>[['dst'=>'10.0.0.0/8','dev'=>'ppp0']]]; }
        };
        DB::enableQueryLog(); DB::flushQueryLog();
        $capture = $repository->capture(); $this->assertSame('signal', $capture['observations'][1]['evidence']['state']);
        $this->assertSame(-22.0, $capture['observations'][1]['summary']['best_rx_power']);
        foreach (DB::getQueryLog() as $query) $this->assertMatchesRegularExpression('/^select /i', $query['query']);
        DB::table('customers')->where('id', 2)->update(['deleted_at'=>now()]);
        $capture = $repository->capture(); $this->assertCount(1, $capture['observations'][1]['clients']);
        $this->assertSame(1, $capture['observations'][1]['evidence']['unverified_clients']);
        $this->assertDatabaseHas('ont_registrations', ['id'=>1, 'rx_power'=>-40]); Http::assertNothingSent();
    }
}
