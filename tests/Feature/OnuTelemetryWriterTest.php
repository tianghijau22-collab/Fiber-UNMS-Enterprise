<?php

namespace Tests\Feature;

use App\Models\OltDevice;
use App\Services\Olt\OnuTelemetrySample as Sample;
use App\Services\Olt\OnuTelemetryWriter as Writer;
use App\Services\Olt\OnuTelemetryView;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use App\Services\Olt\FastOpticalProbeService as Probe;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OnuTelemetryWriterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite',config('database.default'));
        $this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Http::fake();Http::preventStrayRequests();
        Schema::create('olt_devices',function(Blueprint $t){$t->id();$t->string('name');$t->string('vendor_key');$t->string('connection_mode');$t->string('status');$t->json('last_telemetry_snapshot')->nullable();$t->timestamps();});
        Schema::create('customers',function(Blueprint $t){$t->id();$t->string('name');$t->string('customer_number')->nullable();$t->string('phone')->nullable();$t->softDeletes();});
        Schema::create('customer_services',function(Blueprint $t){$t->id();$t->integer('customer_id');$t->softDeletes();});
        Schema::create('network_nodes',function(Blueprint $t){$t->id();$t->string('name')->nullable();$t->string('code')->nullable();$t->string('olt_port_ref')->nullable();$t->integer('parent_node_id')->nullable();$t->integer('olt_device_id')->nullable();$t->softDeletes();});
        Schema::create('network_ports',function(Blueprint $t){$t->id();$t->integer('node_id');$t->integer('port_number')->nullable();$t->integer('customer_service_id')->nullable();});
        Schema::create('ont_registrations',function(Blueprint $t){$t->id();$t->integer('customer_service_id');$t->integer('olt_port_id')->nullable();$t->string('onu_serial');$t->string('onu_mac')->nullable();$t->string('onu_type')->nullable();$t->string('notes')->nullable();$t->timestamp('registered_at')->nullable();$t->string('status');$t->float('rx_power')->nullable();$t->float('tx_power')->nullable();$t->timestamp('last_online_at')->nullable();$t->timestamps();$t->softDeletes();});
        Schema::create('audit_logs',function(Blueprint $t){$t->id();$t->integer('user_id')->nullable();foreach(['user_name','user_role','action','module','description','ip_address','user_agent'] as $column)$t->text($column)->nullable();$t->json('old_values')->nullable();$t->json('new_values')->nullable();$t->timestamps();});
        foreach([1,2] as $id) {
            DB::table('olt_devices')->insert(['id'=>$id,'name'=>'Fixture OLT '.$id,'vendor_key'=>'zte-c320','connection_mode'=>'live','status'=>'active',
                'last_telemetry_snapshot'=>json_encode(['onu_list'=>[$this->row(1)],'unconfigured_onus'=>[],'polled_at'=>$this->at(30)])]);
            DB::table('network_nodes')->insert(['id'=>$id,'olt_device_id'=>$id]);
            $this->registration($id,$id,1);
        }
    }

    private function at(int $seconds=0): string { return now()->subSeconds($seconds)->format('Y-m-d\TH:i:s.uP'); }
    private function row(int $id,string $port='1/1/15',?bool $online=true,?float $rx=-25): array
    {
        return ['serial_number'=>'TEST'.str_pad((string)$id,8,'0',STR_PAD_LEFT),'port'=>$port,'onu_id'=>(string)$id,
            'identity_source'=>Identity::SOURCE,'identity_observed_at'=>$this->at(),
            'status'=>$online===null ? 'Unknown':($online ? 'Online':'Offline'),'is_online'=>$online,'rx_power'=>$rx];
    }
    private function registration(int $id,int $node,int $serial): void
    {
        DB::table('customers')->insert(['id'=>$id,'name'=>'Fixture '.$id]);
        DB::table('customer_services')->insert(['id'=>$id,'customer_id'=>$id]);
        DB::table('network_ports')->insert(['id'=>$id,'node_id'=>$node,'customer_service_id'=>$id]);
        DB::table('ont_registrations')->insert(['id'=>$id,'customer_service_id'=>$id,'onu_serial'=>$this->row($serial)['serial_number'],'status'=>'active','rx_power'=>-25]);
    }
    private function write(array $rows,int $ago=0,string $source='poll',int $olt=1): array
    { return app(Writer::class)->apply(OltDevice::findOrFail($olt),$rows,$this->at($ago),$source); }
    private function registrationStatus(int $id): string { return DB::table('ont_registrations')->where('id',$id)->value('status'); }
    private function snapshot(): array { return OltDevice::findOrFail(1)->last_telemetry_snapshot; }

    public function test_same_serial_on_another_olt_is_never_updated(): void
    {
        $result=$this->write([$this->row(1,'1/1/15',false)]);
        $this->assertSame(1,$result['updated']);$this->assertSame('inactive',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(2));
    }

    public function test_inherited_owner_and_different_pon_are_handled_independently(): void
    {
        DB::table('network_nodes')->insert(['id'=>3,'parent_node_id'=>1]);
        DB::table('network_ports')->where('id',1)->update(['node_id'=>3]);
        $this->registration(3,3,3);
        $r=$this->write([$this->row(3,'1/1/16',false)]);
        $this->assertSame(1,$r['updated']);$this->assertSame('inactive',$this->registrationStatus(3));$this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_duplicate_registration_within_owner_has_no_arbitrary_winner(): void
    {
        $this->registration(3,1,1);
        $r=$this->write([$this->row(1,'1/1/15',false)]);
        $this->assertSame(0,$r['updated']);$this->assertSame('active',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(3));
    }

    public function test_deleted_customer_or_registration_is_not_written(): void
    {
        DB::table('customers')->where('id',1)->update(['deleted_at'=>now()]);
        $this->assertSame(0,$this->write([$this->row(1,'1/1/15',false)])['updated']);
        $this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_unknown_observation_cannot_mark_a_registration_offline(): void
    {
        $r=$this->write([$this->row(1,'1/1/15',null,null)]);
        $this->assertSame(1,$r['unknown']);$this->assertSame(0,$r['updated']);$this->assertSame('active',$this->registrationStatus(1));
        $this->assertNull($this->snapshot()['onu_list'][0]['is_online']);
    }

    public function test_working_without_power_stays_online_and_power_stays_null(): void
    {
        DB::table('ont_registrations')->where('id',1)->update(['status'=>'inactive']);
        $r=$this->write([$this->row(1,'1/1/15',true,null)]);
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame(1,$r['updated']);
        $this->assertNull(DB::table('ont_registrations')->where('id',1)->value('rx_power'));
        $this->assertNull($this->snapshot()['onu_list'][0]['rx_power']);
    }

    public function test_point_with_wrong_tuple_or_legacy_identity_is_rejected(): void
    {
        $this->assertSame(0,$this->write([$this->row(1,'1/1/16',false)],0,'point')['accepted']);
        $row=$this->row(1);unset($row['identity_source']);
        $this->assertSame(0,$this->write([$row])['accepted']);$this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_older_poll_and_stale_full_snapshot_cannot_overwrite_a_newer_event(): void
    {
        $stale=OltDevice::findOrFail(1);$old=$stale->last_telemetry_snapshot;
        $this->write([$this->row(1,'1/1/15',false)],10,'event');
        $this->assertSame(0,$this->write([$this->row(1)],20)['accepted']);
        $old['polled_at']=$this->at();$stale->update(['last_telemetry_snapshot'=>$old]);
        $this->assertSame('inactive',$this->registrationStatus(1));$this->assertFalse($this->snapshot()['onu_list'][0]['is_online']);
        $this->assertEqualsWithDelta(Sample::epoch($this->at(10)),Sample::epoch($this->snapshot()['onu_list'][0]['sample_observed_at']),1);
    }

    public function test_older_result_is_rejected_per_onu_without_rejecting_another_onu(): void
    {
        $this->registration(3,1,3);
        $this->write([$this->row(1,'1/1/15',false)],5);
        $r=$this->write([$this->row(1),$this->row(3,'1/1/16',false)],10);
        $this->assertSame(1,$r['accepted']);$this->assertSame('inactive',$this->registrationStatus(1));$this->assertSame('inactive',$this->registrationStatus(3));
    }

    public function test_invalid_or_old_observation_and_expired_identity_cannot_write(): void
    {
        foreach(['not-a-date',$this->at(181),$this->at(-20)] as $at) $this->assertSame(0,app(Writer::class)->apply(OltDevice::findOrFail(1),[$this->row(1)],$at)['accepted']);
        $row=$this->row(1);$row['identity_observed_at']=$this->at(601);
        $this->assertSame(0,$this->write([$row])['accepted']);
    }

    public function test_duplicate_batch_is_idempotent_and_does_not_repeat_transitions(): void
    {
        $olt=OltDevice::findOrFail(1);$at=$this->at();$row=$this->row(1,'1/1/15',false);
        $one=app(Writer::class)->apply($olt,[$row],$at);$two=app(Writer::class)->apply($olt,[$row],$at);
        $this->assertCount(1,$one['transitions']);$this->assertSame(0,$two['accepted']);$this->assertSame([],$two['transitions']);
    }

    public function test_transaction_failure_rolls_back_registration_and_snapshot_together(): void
    {
        $this->registration(3,1,3);$before=$this->snapshot();
        foreach(Writer::CACHE_KEYS as $key)Cache::put($key,'unchanged',100);
        DB::statement("CREATE TRIGGER refuse_fixture BEFORE UPDATE ON ont_registrations WHEN NEW.id = 3 BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END");
        try {$this->write([$this->row(1,'1/1/15',false),$this->row(3,'1/1/16',false)]);$this->fail('Expected write failure');}
        catch(\Illuminate\Database\QueryException $exception){$this->assertStringContainsString('fixture rollback',$exception->getMessage());}
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame($before,$this->snapshot());
        foreach(Writer::CACHE_KEYS as $key)$this->assertSame('unchanged',Cache::get($key));
    }

    public function test_success_invalidates_actual_response_keys_and_preserves_sessions(): void
    {
        foreach(Writer::CACHE_KEYS as $key)Cache::put($key,'old',100);
        Cache::put('session_fixture','keep',100);$this->write([$this->row(1)]);
        foreach(Writer::CACHE_KEYS as $key)$this->assertFalse(Cache::has($key));
        $this->assertSame('keep',Cache::get('session_fixture'));
    }

    public function test_unknown_legacy_mass_sync_cannot_update_mixed_pon_customers(): void
    {
        $this->assertSame(0,Probe::instantBulkDbSync('inactive','1/1/15'));
        $this->assertSame(0,Probe::instantBulkDbSync('active',null,1));
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(2));
    }

    public function test_provisioning_does_not_invent_a_hardware_snapshot(): void
    {
        $before=$this->snapshot();
        \App\Http\Controllers\CustomerController::injectCustomerIntoOltSnapshot(1,['serial_number'=>'TEST00000009','rx_power'=>-19.5]);
        $this->assertSame($before,$this->snapshot());
    }

    public function test_snapshot_ledger_cannot_be_forged_by_an_older_model_instance(): void
    {
        $this->write([$this->row(1,'1/1/15',false)],10,'event');
        $olt=OltDevice::findOrFail(1);$candidate=$olt->last_telemetry_snapshot;
        $candidate['_onu_write_ledger']['TEST00000001']['is_online']=true;
        $candidate['_onu_write_ledger']['TEST00000001']['status']='Online';
        $candidate['onu_list'][0]['status']='Online';$candidate['onu_list'][0]['is_online']=true;
        $olt->update(['last_telemetry_snapshot'=>$candidate]);
        $this->assertFalse($this->snapshot()['onu_list'][0]['is_online']);
    }

    public function test_unchanged_inventory_refresh_does_not_refresh_measurement_time(): void
    {
        $olt=OltDevice::findOrFail(1);$old=$olt->last_telemetry_snapshot;
        $old['polled_at']=$this->at();$olt->update(['last_telemetry_snapshot'=>$old]);
        $sample=$this->snapshot()['onu_list'][0];
        $this->assertEqualsWithDelta(Sample::epoch($this->at(30)),Sample::epoch($sample['sample_observed_at']),1);
    }

    public function test_view_uses_per_onu_time_even_when_snapshot_completion_is_recent(): void
    {
        $row=array_replace($this->row(1),Sample::normalize($this->row(1),$this->at(200)));
        $olt=OltDevice::findOrFail(1);$olt->last_telemetry_snapshot=['onu_list'=>[$row],'polled_at'=>$this->at()];
        $view=(new OnuTelemetryView([$olt]))->resolve(1,'TEST00000001');
        $this->assertNull($view['is_online']);$this->assertSame('stale',$view['telemetry_freshness']);
    }

    public function test_conflicting_physical_locations_never_select_an_online_winner(): void
    {
        $r=$this->write([$this->row(1),$this->row(1,'1/1/16',false)]);
        $this->assertSame(0,$r['accepted']);$this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_driver_cache_cannot_be_relabelled_with_a_newer_batch_time(): void
    {
        $old=array_replace($this->row(1),Sample::normalize($this->row(1),$this->at(30)));
        $this->write([$this->row(1,'1/1/15',false)],10,'event');
        $this->assertSame(0,$this->write([$old])['accepted']);$this->assertSame('inactive',$this->registrationStatus(1));
    }

    public function test_equal_time_uses_deterministic_event_priority(): void
    {
        $at=$this->at();$olt=OltDevice::findOrFail(1);$writer=app(Writer::class);
        $this->assertSame(1,$writer->apply($olt,[$this->row(1)],$at,'poll')['accepted']);
        $this->assertSame(1,$writer->apply($olt,[$this->row(1,'1/1/15',false)],$at,'event')['accepted']);
        $this->assertSame(0,$writer->apply($olt,[$this->row(1)],$at,'point')['accepted']);
        $this->assertSame('inactive',$this->registrationStatus(1));
    }

    public function test_disconnected_olt_is_rechecked_under_the_write_lock(): void
    {
        $stale=OltDevice::findOrFail(1);DB::table('olt_devices')->where('id',1)->update(['connection_mode'=>'simulation']);
        $this->assertSame(0,app(Writer::class)->apply($stale,[$this->row(1,'1/1/15',false)],$this->at())['accepted']);
        $this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_snapshot_merge_preserves_a_newly_observed_onu_missing_from_an_old_model(): void
    {
        $old=OltDevice::findOrFail(1);$oldSnapshot=$old->last_telemetry_snapshot;
        $this->write([$this->row(3,'1/1/16')],10);
        $fresh=OltDevice::findOrFail(1);$snapshot=$fresh->last_telemetry_snapshot;$snapshot['onu_list'][]=$this->row(3,'1/1/16');
        $fresh->update(['last_telemetry_snapshot'=>$snapshot]);
        $old->update(['last_telemetry_snapshot'=>$oldSnapshot]);
        $this->assertCount(2,$this->snapshot()['onu_list']);
        $this->assertSame(['TEST00000001','TEST00000003'],array_column($this->snapshot()['onu_list'],'serial_number'));
    }

    public function test_unknown_rows_do_not_establish_total_los_in_port_counters(): void
    {
        $olt=OltDevice::findOrFail(1);$snapshot=$olt->last_telemetry_snapshot;
        $snapshot['pon_ports']=[['port_id'=>'gpon-olt_1/1/15']];
        $snapshot['onu_list']=[$this->row(1),$this->row(3),$this->row(4)];
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snapshot)]);
        $this->write([$this->row(1,'1/1/15',null,null),$this->row(3,'1/1/15',false),$this->row(4,'1/1/15',false)]);
        $port=$this->snapshot()['pon_ports'][0];
        $this->assertSame(1,$port['unknown_onus']);$this->assertSame(2,$port['los_onus']);$this->assertFalse($port['is_mass_outage']);
    }

    public function test_older_point_read_cannot_replace_a_newer_snapshot_in_the_response(): void
    {
        $row=array_replace($this->row(1),Sample::normalize($this->row(1),$this->at(5)));
        $olt=OltDevice::findOrFail(1);$olt->last_telemetry_snapshot=['onu_list'=>[$row],'polled_at'=>$this->at()];
        $view=(new OnuTelemetryView([$olt]))->resolve(1,'TEST00000001');
        $point=array_replace($row,['identity_verified'=>true,'is_online'=>false]);
        $this->assertSame($view,OnuTelemetryView::withPoint($view,$point,$this->at(20)));
    }

    public function test_resolver_requires_unique_olt_and_accepts_valid_port_one(): void
    {
        $controller=\App\Http\Controllers\CustomerController::class;
        $this->assertNull($controller::resolveOnuPhysicalPortAndSync('TEST00000001')['olt_id']);
        $snapshot=$this->snapshot();$snapshot['onu_list'][0]['port']='1/1/1';
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snapshot)]);
        $scoped=$controller::resolveOnuPhysicalPortAndSync('TEST00000001',1,'1/1/16');
        $this->assertSame(1,$scoped['olt_id']);$this->assertSame('gpon-olt_1/1/1',$scoped['port']);
    }

    public function test_controller_sync_uses_scoped_writer_and_preserves_working_without_rx(): void
    {
        DB::table('ont_registrations')->where('id',1)->update(['status'=>'inactive']);
        app(\App\Http\Controllers\OltController::class)->syncOntRegistrations(OltDevice::findOrFail(1),[$this->row(1,'1/1/15',true,null)]);
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(2));
        $this->assertNull(DB::table('ont_registrations')->where('id',1)->value('rx_power'));
    }

    public function test_interface_probe_requires_explicit_olt_and_does_not_invent_missing_rows(): void
    {
        $controller=app(\App\Http\Controllers\CustomerController::class);
        $bad=$controller->probeInterfaceOptical(\Illuminate\Http\Request::create('/probe','POST',['olt_id'=>'all','interface'=>'1/1/15']));
        $this->assertSame(422,$bad->getStatusCode());
        $out=$controller->probeInterfaceOptical(\Illuminate\Http\Request::create('/probe','POST',['olt_id'=>1,'interface'=>'1/1/15','sync_db'=>false]))->getData(true);
        $this->assertFalse($out['complete']);$this->assertSame(1,$out['summary']['unknown_count']);
        $this->assertSame([],$out['data']);$this->assertNull($out['summary']['avg_rx_power']);$this->assertSame('active',$this->registrationStatus(1));
    }

    public function test_interface_inventory_uses_hardware_pon_not_a_shared_odp_uplink(): void
    {
        $olt=OltDevice::findOrFail(1);$snapshot=$olt->last_telemetry_snapshot;$snapshot['onu_list'][]=$this->row(3,'1/1/16');
        $olt->last_telemetry_snapshot=$snapshot;
        $rows=(new WriterListenerHarness)->portInventory($olt,'1/1/15');
        $this->assertCount(1,$rows);$this->assertSame('TEST00000001',$rows[0]['sn']);
    }

    public function test_unknown_poller_sample_cannot_raise_a_mass_alarm(): void
    {
        $rows=[$this->row(1,'1/1/15',false),$this->row(3,'1/1/15',false),$this->row(4,'1/1/15',null,null)];
        (new WriterPollHarness)->correlate(OltDevice::findOrFail(1),$rows);
        $this->assertFalse(Cache::has('interface_in_mass_outage_1_1/1/15'));
    }

    public function test_serial_and_mac_pointing_to_different_onus_cannot_write_the_same_registration_twice(): void
    {
        DB::table('ont_registrations')->where('id',1)->update(['onu_mac'=>'TEST00000003']);
        $this->registration(3,1,3);
        $result=$this->write([$this->row(1,'1/1/15',false),$this->row(3,'1/1/16',false)]);
        $this->assertSame(0,$result['updated']);$this->assertSame(2,$result['ambiguous_registrations']);
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(3));
    }

    public function test_import_cannot_move_an_existing_registration_to_another_olt(): void
    {
        try {
            app(\App\Http\Controllers\OltController::class)->bindImportedRegistration(1,2,'TEST00000001');
            $this->fail('Import must not move a foreign registration');
        } catch(\Illuminate\Validation\ValidationException $exception) {
            $this->assertArrayHasKey('onu_serial',$exception->errors());
        }
        $this->assertNull(DB::table('ont_registrations')->where('id',1)->value('olt_port_id'));
        $this->assertSame('active',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(2));
    }

    public function test_import_creates_pending_binding_without_invented_measurements(): void
    {
        $this->assertTrue(app(\App\Http\Controllers\OltController::class)->bindImportedRegistration(1,1,'TEST00000009'));
        $registration=DB::table('ont_registrations')->where('onu_serial','TEST00000009')->first();
        $this->assertSame('pending',$registration->status);$this->assertNull($registration->rx_power);$this->assertNull($registration->tx_power);
        $this->assertNull($registration->last_online_at);$this->assertSame(1,$registration->customer_service_id);
    }

    public function test_verified_port_loss_updates_only_that_olt_and_hardware_pon(): void
    {
        $this->registration(3,1,3);$olt=OltDevice::findOrFail(1);$snapshot=$olt->last_telemetry_snapshot;
        $snapshot['onu_list']=[array_replace($this->row(1),Sample::normalize($this->row(1),$this->at(30))),$this->row(3,'1/1/16')];
        DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snapshot)]);
        $result=app(Writer::class)->applyPortLoss(OltDevice::findOrFail(1),'1/1/15',$this->at());
        $this->assertSame(1,$result['updated']);$this->assertSame('inactive',$this->registrationStatus(1));
        $this->assertSame('active',$this->registrationStatus(2));$this->assertSame('active',$this->registrationStatus(3));
        $this->assertLessThan(2,microtime(true)-Sample::epoch($this->snapshot()['_onu_write_ledger']['TEST00000001']['sample_observed_at']));
    }

    public function test_malformed_flap_cache_cannot_break_a_committed_transition(): void
    {
        Cache::put('onu_write_1_1_flaps','bad payload',100);
        $result=app(Writer::class)->apply(OltDevice::findOrFail(1),[$this->row(1,'1/1/15',false)],$this->at(),'poll',true);
        $this->assertSame(1,$result['updated']);$this->assertDatabaseCount('audit_logs',1);Http::assertNothingSent();
    }

    public function test_outer_transaction_rollback_does_not_leak_cache_or_alarm_side_effects(): void
    {
        Cache::put('customers_index_payload_v5','preserved',100);
        DB::beginTransaction();
        app(Writer::class)->apply(OltDevice::findOrFail(1),[$this->row(1,'1/1/15',false)],$this->at(),'poll',true);
        DB::rollBack();
        $this->assertSame('active',$this->registrationStatus(1));$this->assertDatabaseCount('audit_logs',0);
        $this->assertSame('preserved',Cache::get('customers_index_payload_v5'));$this->assertFalse(Cache::has('onu_write_1_1_inactive'));
    }

    public function test_real_event_handler_stamps_receipt_time_and_rejects_an_earlier_poll(): void
    {
        $this->write([$this->row(1)],30);
        $resolver=\Mockery::mock(\App\Services\Olt\OltAlarmSourceResolver::class);
        $resolver->shouldReceive('resolve')->once()->andReturn(['accepted'=>true,'reason'=>'fixture_verified',
            'olt'=>OltDevice::findOrFail(1),'serial_number'=>'TEST00000001']);
        $this->app->instance(\App\Services\Olt\OltAlarmSourceResolver::class,$resolver);
        $listener=new WriterEventHarness;
        $listener->setOutput(new \Illuminate\Console\OutputStyle(new \Symfony\Component\Console\Input\ArrayInput([]),new \Symfony\Component\Console\Output\BufferedOutput));
        $listener->receive('GPON-ALARM: ONU 1/1/15:1 Loss of Signal','192.0.2.99','syslog');
        $this->assertSame('inactive',$this->registrationStatus(1));
        $this->assertSame(0,$this->write([$this->row(1)],10)['accepted']);
        $this->assertSame('inactive',$this->registrationStatus(1));$this->assertSame('active',$this->registrationStatus(2));Http::assertNothingSent();
    }

    public function test_working_rows_without_rx_cannot_raise_a_mass_loss_from_an_old_aggregate_count(): void
    {
        $rows=[$this->row(1,'1/1/15',true,null),$this->row(3,'1/1/15',true,null),$this->row(4,'1/1/15',true,null)];
        (new WriterPollHarness)->correlate(OltDevice::findOrFail(1),$rows);
        $this->assertFalse(Cache::has('interface_in_mass_outage_1_1/1/15'));Http::assertNothingSent();
    }

    public function test_port_poll_replaces_an_old_location_only_with_newer_serial_table_evidence(): void
    {
        $old=$this->row(1);$old['identity_observed_at']=$this->at(30);
        $fresh=$this->row(1,'1/1/16',false);
        $rows=Writer::mergePortObservations([$old],[$fresh]);
        $this->assertCount(1,$rows);$this->assertSame('1/1/16',str_replace('gpon-olt_','',array_values($rows)[0]['port']));
        $conflict=$this->row(1,'1/1/16',true);$conflict['identity_observed_at']=$old['identity_observed_at'];
        $rows=Writer::mergePortObservations([$old],[$conflict]);
        $this->assertCount(2,$rows);$this->assertSame([],Identity::uniqueRows(array_values($rows)));
    }
}

class WriterListenerHarness extends \App\Console\Commands\ListenOltEvents
{
    public function portInventory(OltDevice $olt,string $port): array { return $this->getAllOnusOnInterface($olt,$port); }
}

class WriterPollHarness extends \App\Console\Commands\PollOltTelemetry
{
    public function correlate(OltDevice $olt,array $rows): void { $this->handleInterfaceMassOutagePollCheck($olt,'1/1/15',count($rows),0,$rows); }
}

class WriterEventHarness extends \App\Console\Commands\ListenOltEvents
{
    public function receive(string $raw,string $ip,string $type): void { $this->processIncomingPacket($raw,$ip,$type); }
    protected function handleInterfaceMassCorrelator(OltDevice $olt,string $standardPort,string $targetSn,string $targetName,?string $nodeName,string $eventType,bool $isLoss,?float $recoveredRxPower=null,?string $targetCustId=null): bool { return false; }
    protected function handleOdpMassCorrelator(int $odpId,string $odpName,?string $standardPort,?OltDevice $olt,bool $isAlarmLoss,bool $isAlarmRecovery): void {}
}
