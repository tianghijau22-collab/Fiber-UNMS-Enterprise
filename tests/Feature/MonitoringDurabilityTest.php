<?php
namespace Tests\Feature;

use App\Services\OpticalIncidentStore as Store;
use App\Services\OpticalOutbox as Outbox;
use App\Services\OpticalDeliveryTransport as Transport;
use App\Services\TicketCreationService;
use App\Models\SystemSetting;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema, Cache, Bus, Http, Crypt};
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class MonitoringDurabilityTest extends TestCase
{
    use \Tests\Support\MonitoringSchema;

    protected function setUp(): void
    {
        parent::setUp(); $this->monitoringSchema();
        Bus::fake(); Http::fake(); Http::preventStrayRequests();
        Schema::create('system_settings', function(Blueprint $t) { $t->id(); $t->string('key'); $t->text('value')->nullable(); $t->timestamps(); });
        SystemSetting::set('telegram_enabled', 'true'); SystemSetting::set('telegram_bot_token', 'TEST-NOT-REAL');
    }

    private function transport(array $responses = [], array $recipients = ['first','second']): object
    {
        $transport = new class($responses, $recipients) extends Transport {
            public array $calls = [];
            public function __construct(public array $responses, public array $recipients) {}
            public function destinations(): array { return ['telegram_enabled'=>true,'telegram_token_present'=>true,'telegram_recipients'=>$this->recipients,'fcm_configured'=>false]; }
            public function send(object $row): array { $this->calls[] = $row->id; return array_shift($this->responses) ?? ['status'=>'sent','reference'=>'test']; }
        };
        $this->app->instance(Transport::class, $transport); return $transport;
    }

    private function record(bool $active = true, string $condition = 'down', string $members = 'same'): array
    {
        return ['active'=>$active,'condition'=>$condition,'members'=>$members,'context'=>['kind'=>'source','name'=>'Test source','reason'=>'test']];
    }

    private function observe(?array $previous, array $record, ?string $transition): void
    {
        $store = app(Store::class);
        $store->transaction(function(array &$state) use ($store, $previous, &$record, $transition) {
            $store->observe('source:test', $previous, $record, now()->toIso8601String(), [], $transition, false);
            $state['records']['source:test'] = $record;
        });
    }

    private function outage(): int
    {
        $this->observe($this->record(false, 'up'), $this->record(), 'outage');
        return DB::table('monitoring_incidents')->value('id');
    }

    public function test_checkpoint_event_and_destinations_commit_atomically_or_not_at_all(): void
    {
        $t = \Mockery::mock(Transport::class); $t->shouldReceive('destinations')->andThrow(new \RuntimeException('fixture failure'));
        $this->app->instance(Transport::class, $t);
        try { $this->outage(); $this->fail('Expected rollback'); } catch (\RuntimeException $e) { $this->assertSame('fixture failure', $e->getMessage()); }
        foreach (['monitoring_checkpoints','monitoring_incidents','monitoring_events','monitoring_deliveries'] as $table) $this->assertDatabaseCount($table, 0);
        $this->assertNull(Cache::get(\App\Services\OpticalFaultLocalizationService::STATE_KEY));
    }

    public function test_cache_loss_and_new_process_keep_the_same_episode_and_event(): void
    {
        $this->transport(); $id = $this->outage(); Cache::flush();
        $this->app->forgetInstance(Store::class);
        $this->observe($this->record(), $this->record(), null);
        $this->assertDatabaseCount('monitoring_incidents', 1); $this->assertDatabaseCount('monitoring_events', 1);
        $this->assertSame($id, DB::table('monitoring_incidents')->value('id'));
        $this->assertTrue(Cache::get(\App\Services\OpticalFaultLocalizationService::STATE_KEY)['records']['source:test']['active']);
    }

    public function test_successful_destination_is_never_resent_when_other_destination_retries(): void
    {
        $transport = $this->transport([['status'=>'sent','reference'=>'123'], ['status'=>'retry','delay'=>60], ['status'=>'sent','reference'=>'456']]);
        $this->outage(); $rows = DB::table('monitoring_deliveries')->where('channel','telegram')->orderBy('id')->get();
        $box = app(Outbox::class); $box->process($rows[0]->id); $box->process($rows[0]->id); $box->process($rows[1]->id);
        $this->assertSame('retry', DB::table('monitoring_deliveries')->find($rows[1]->id)->status);
        DB::table('monitoring_deliveries')->where('id', $rows[1]->id)->update(['available_at'=>now()->subSecond()]);
        $box->process($rows[1]->id); $box->process($rows[0]->id);
        $this->assertSame([$rows[0]->id,$rows[1]->id,$rows[1]->id], $transport->calls);
        $this->assertSame(1, DB::table('monitoring_deliveries')->find($rows[0]->id)->attempts);
        $this->assertNotSame('first', $rows[0]->recipient); $this->assertSame('first', Crypt::decryptString($rows[0]->recipient));
    }

    public function test_expired_worker_lease_requires_review_for_external_send_but_web_is_recoverable(): void
    {
        $t = $this->transport(); $this->outage();
        DB::table('monitoring_deliveries')->whereIn('channel',['web','telegram'])->update(['status'=>'processing','locked_until'=>now()->subSecond()]);
        $box = app(Outbox::class); $box->expireLeases();
        $this->assertSame('retry', DB::table('monitoring_deliveries')->where('channel','web')->value('status'));
        $row = DB::table('monitoring_deliveries')->where('channel','telegram')->first();
        $box->process($row->id); $this->assertSame([], $t->calls);
        try { $box->retry($row->id, false); $this->fail('Expected duplicate risk acknowledgement'); } catch(HttpException $e) { $this->assertSame(409, $e->getStatusCode()); }
        DB::table('monitoring_deliveries')->where('id', $row->id)->update(['attempts'=>4]);
        $box->retry($row->id, true); $box->process($row->id);
        $this->assertSame(5, DB::table('monitoring_deliveries')->find($row->id)->attempts);
    }

    public function test_recovery_only_reaches_destinations_with_confirmed_outage_and_stale_outage_is_cancelled(): void
    {
        $t = $this->transport(); $id = $this->outage(); $box = app(Outbox::class);
        $rows = DB::table('monitoring_deliveries')->where('channel','telegram')->orderBy('id')->get(); $box->process($rows[0]->id);
        $this->observe($this->record(), $this->record(false,'up'), 'recovery');
        $box->process($rows[1]->id);
        $this->assertSame('cancelled', DB::table('monitoring_deliveries')->find($rows[1]->id)->status);
        $recoveries = DB::table('monitoring_deliveries as d')->join('monitoring_events as e','e.id','=','d.event_id')->where('e.transition','recovered')->where('d.channel','telegram')->orderBy('d.id')->get(['d.*']);
        foreach ($recoveries as $r) $box->process($r->id);
        $this->assertSame('sent', DB::table('monitoring_deliveries')->find($recoveries[0]->id)->status);
        $this->assertSame('skipped', DB::table('monitoring_deliveries')->find($recoveries[1]->id)->status);
        $event = json_decode(DB::table('monitoring_events')->where('transition','recovered')->value('payload'),true);
        $this->assertSame('SOURCE_RECOVERY', \App\Jobs\PublishOpticalFaultNotification::message($event)[2]);
        $this->assertDatabaseHas('monitoring_incidents', ['id'=>$id,'status'=>'recovered']);
    }

    public function test_uncertain_outage_holds_recovery_and_unconfirmed_first_part_holds_later_part(): void
    {
        $t = $this->transport(); $this->outage(); $box = app(Outbox::class);
        $r = DB::table('monitoring_deliveries')->where('channel','telegram')->first();
        DB::table('monitoring_deliveries')->where('id',$r->id)->update(['status'=>'uncertain']);
        $part = (array) $r; unset($part['id']); $part['part_index']=1;
        $later = DB::table('monitoring_deliveries')->insertGetId($part); $box->process($later);
        $this->assertSame('earlier_part_unconfirmed', DB::table('monitoring_deliveries')->find($later)->status_reason);
        $this->observe($this->record(),$this->record(false,'up'),'recovery');
        $recovery = DB::table('monitoring_deliveries')->where('event_id','>', $r->event_id)->where('recipient_key',$r->recipient_key)->first();
        $box->process($recovery->id); $this->assertSame([], $t->calls);
        $this->assertSame('uncertain', DB::table('monitoring_deliveries')->find($recovery->id)->status);
    }

    public function test_unknown_source_cannot_close_incident_and_membership_change_is_not_recovery(): void
    {
        $t = $this->transport(); $this->outage();
        $this->observe($this->record(), $this->record(true,'unknown'), null);
        $r = DB::table('monitoring_deliveries')->where('channel','telegram')->first(); app(Outbox::class)->process($r->id);
        $this->assertSame([], $t->calls);
        $this->assertDatabaseHas('monitoring_incidents', ['status'=>'active','condition'=>'unknown']);
        $this->observe($this->record(true,'unknown'), $this->record(true,'down','changed'), null);
        $this->assertDatabaseHas('monitoring_incidents', ['status'=>'superseded']);
        $this->assertDatabaseHas('monitoring_incidents', ['status'=>'active','baseline'=>true]);
        $this->assertSame(0, DB::table('monitoring_events')->where('transition','recovered')->count());
    }

    public function test_web_insert_is_idempotent_even_after_worker_acknowledgement_loss(): void
    {
        $this->transport(); $this->outage(); $this->app->forgetInstance(Transport::class);
        $r = DB::table('monitoring_deliveries')->where('channel','web')->first();
        $real = app(Transport::class); $real->send($r); $real->send($r);
        $this->assertDatabaseCount('system_notifications',1); Http::assertNothingSent();
    }

    public function test_transport_requires_provider_acknowledgement_and_classifies_safe_rejections(): void
    {
        $r = (object) ['channel'=>'telegram','recipient'=>Crypt::encryptString('fixture'),'payload'=>json_encode(['text'=>'fixture'])];
        $transport = new Transport;
        foreach ([
            [['ok'=>true,'result'=>['message_id'=>55]],200,'sent'],
            [['ok'=>false,'error_code'=>429,'parameters'=>['retry_after'=>90]],429,'retry'],
            [['ok'=>false,'error_code'=>500],500,'retry'],
            [['ok'=>false,'error_code'=>400],400,'failed'],
            [[],200,'uncertain'], [[],502,'uncertain'],
        ] as [$body,$status,$expected]) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::fake(['*'=>Http::response($body,$status)]); Http::preventStrayRequests();
            $this->assertSame($expected, $transport->send($r)['status']);
        }
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(['*'=>Http::failedConnection()]); Http::preventStrayRequests();
        $this->assertSame('uncertain', $transport->send($r)['status']);
    }

    private function ticket(array $extra = []): array { return [...['title'=>'Test','description'=>'fixture','category'=>'Fiber Cut','status'=>'Open'], ...$extra]; }

    public function test_ticket_retries_return_same_ticket_and_changed_body_conflicts(): void
    {
        $svc = app(TicketCreationService::class);
        $first = $svc->create($this->ticket(),1,'stable-key');
        $retry = $svc->create($this->ticket(),1,'stable-key');
        $this->assertTrue($first['created']); $this->assertFalse($retry['created']); $this->assertSame($first['ticket']->id,$retry['ticket']->id);
        $svc->create($this->ticket(),2,'stable-key'); $this->assertDatabaseCount('tickets',2);
        try { $svc->create($this->ticket(['title'=>'Changed']),1,'stable-key'); $this->fail('Expected conflict'); } catch(HttpException $e) { $this->assertSame(409,$e->getStatusCode()); }
    }

    public function test_deleted_ticket_is_a_tombstone_and_numbers_are_not_reused(): void
    {
        $svc = app(TicketCreationService::class); $old = $svc->create($this->ticket(),1,'stable-key')['ticket']; $number = $old->ticket_number; $old->delete();
        try { $svc->create($this->ticket(),1,'stable-key'); $this->fail('Expected tombstone'); } catch(HttpException $e) { $this->assertSame(410,$e->getStatusCode()); }
        $this->assertNotSame($number, $svc->create($this->ticket(),1,'new-key')['ticket']->ticket_number);
    }

    public function test_server_generated_resolution_timestamp_does_not_change_retry_identity(): void
    {
        $svc = app(TicketCreationService::class);
        $a = $svc->create($this->ticket(['status'=>'Resolved','resolved_at'=>now()]),1,'resolved-key');
        $b = $svc->create($this->ticket(['status'=>'Resolved','resolved_at'=>now()->addMinute()]),1,'resolved-key');
        $this->assertSame($a['ticket']->id,$b['ticket']->id); $this->assertFalse($b['created']);
    }

    public function test_same_incident_can_only_create_one_ticket_across_operators(): void
    {
        $this->transport(); $id = $this->outage(); $svc = app(TicketCreationService::class);
        $a = $svc->create($this->ticket(['monitoring_incident_id'=>$id]),1,'operator-a');
        $b = $svc->create($this->ticket(['monitoring_incident_id'=>$id]),2,'operator-b');
        $this->assertSame($a['ticket']->id,$b['ticket']->id); $this->assertFalse($b['created']); $this->assertDatabaseCount('tickets',1);
    }

    private function user(string $role): \App\Models\User
    {
        if (!Schema::hasTable('users')) {
            (require database_path('migrations/0001_01_01_000000_create_users_table.php'))->up();
            Schema::table('users', function(Blueprint $t) { $t->string('username'); $t->string('role'); $t->string('division')->default('Test'); $t->string('status')->default('Active'); });
            (require database_path('migrations/2026_08_09_153751_create_audit_logs_table.php'))->up();
            Schema::create('network_nodes', function(Blueprint $t) { $t->id(); $t->softDeletes(); });
        }
        $n = DB::table('users')->count()+1;
        return \App\Models\User::create(['name'=>'Test '.$n,'username'=>'test'.$n,'email'=>'test'.$n.'@example.test','password'=>'testing-password','role'=>$role,'status'=>'Active']);
    }

    public function test_incident_api_hides_delivery_secrets_and_blocks_technician_writes(): void
    {
        $this->transport(); $id = $this->outage(); $admin = $this->user('Super Administrator');
        $response = $this->actingAs($admin)->getJson('/api/monitoring/incidents/'.$id)->assertOk();
        $d = $response->json('deliveries.0');
        foreach (['recipient','recipient_key','payload','claim_token'] as $secret) $this->assertArrayNotHasKey($secret, $d);
        $delivery = DB::table('monitoring_deliveries')->where('channel','telegram')->value('id');
        $tech = $this->user('Teknisi Jointer');
        $this->actingAs($tech)->postJson('/api/monitoring/deliveries/'.$delivery.'/retry',['acknowledge_duplicate_risk'=>true])->assertForbidden();
        $this->postJson('/api/monitoring/incidents/'.$id.'/ticket')->assertForbidden();
        $this->assertDatabaseCount('tickets',0); Http::assertNothingSent();
    }

    public function test_authorized_retry_is_audited_and_ticket_api_replays_without_second_side_effect(): void
    {
        $this->transport(); $id = $this->outage(); $admin = $this->user('Super Administrator');
        SystemSetting::set('telegram_enabled','false');
        $delivery = DB::table('monitoring_deliveries')->where('channel','telegram')->value('id');
        DB::table('monitoring_deliveries')->where('id',$delivery)->update(['status'=>'uncertain','attempts'=>2]);
        $this->actingAs($admin)->postJson('/api/monitoring/deliveries/'.$delivery.'/retry')->assertStatus(409);
        $this->postJson('/api/monitoring/deliveries/'.$delivery.'/retry',['acknowledge_duplicate_risk'=>true])->assertOk();
        $audit = DB::table('audit_logs')->first(); $this->assertSame(2,json_decode($audit->old_values,true)['attempts']);
        $first = $this->postJson('/api/monitoring/incidents/'.$id.'/ticket')->assertCreated();
        $second = $this->postJson('/api/monitoring/incidents/'.$id.'/ticket')->assertOk()->assertJsonPath('replayed',true);
        $this->assertSame($first->json('data.id'),$second->json('data.id'));
        $this->assertDatabaseCount('tickets',1); $this->assertDatabaseCount('audit_logs',2); Http::assertNothingSent();
    }
}
