<?php
namespace Tests\Feature;

use App\Models\{Customer,User,OltDevice};
use App\Services\CustomerIntakeService;
use App\Services\Olt\{ZteOnuIdentityMap as Identity,OnuTelemetrySample};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema,Http,Cache,Event};
use Tests\TestCase;

class CustomerIntakeTest extends TestCase
{
 protected function setUp(): void
 {
  parent::setUp();$this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));Http::fake();Http::preventStrayRequests();
  foreach(['0001_01_01_000000_create_users_table.php','2026_08_09_153751_create_audit_logs_table.php','2026_08_14_000002_create_system_settings_table.php'] as $m)(require database_path('migrations/'.$m))->up();
  Schema::table('users',function(Blueprint $t){$t->string('role');$t->string('status')->default('Active');});
  $this->actingAs(User::create(['name'=>'Admin fixture','email'=>'intake@example.test','password'=>'test-password','role'=>'Super Administrator','status'=>'Active']));
  Schema::create('customers',function(Blueprint $t){$t->id();$t->string('customer_number')->unique();$t->string('name');foreach(['phone','address','email'] as $f)$t->string($f)->nullable();$t->string('status');$t->timestamps();$t->softDeletes();});
  Schema::create('customer_services',function(Blueprint $t){$t->id();$t->string('service_number')->unique();$t->integer('customer_id');$t->integer('service_package_id')->nullable();$t->string('status');$t->string('onu_serial')->nullable();$t->date('installation_date')->nullable();$t->timestamp('activated_at')->nullable();$t->string('ip_address')->nullable();$t->timestamps();$t->softDeletes();});
  Schema::create('service_packages',function(Blueprint $t){$t->id();$t->timestamps();$t->softDeletes();});
  Schema::create('network_nodes',function(Blueprint $t){$t->id();$t->string('name');$t->string('code')->nullable();$t->string('node_type');$t->integer('parent_node_id')->nullable();$t->integer('splitter_type_id')->nullable();$t->integer('olt_device_id')->nullable();$t->string('olt_port_ref')->nullable();$t->integer('used_ports')->default(0);$t->integer('total_ports')->default(8);$t->timestamps();$t->softDeletes();});
  Schema::create('network_ports',function(Blueprint $t){$t->id();$t->integer('node_id');$t->integer('customer_service_id')->nullable();$t->integer('connected_to_port_id')->nullable();$t->string('port_number');foreach(['customer_name_cache','destination_label'] as $f)$t->string($f)->nullable();$t->string('status')->default('available');$t->timestamps();});
  Schema::create('ont_registrations',function(Blueprint $t){$t->id();$t->integer('customer_service_id');$t->integer('olt_port_id')->nullable();$t->string('onu_serial');$t->string('onu_mac')->nullable();$t->string('onu_type')->nullable();$t->string('status');$t->text('notes')->nullable();$t->float('rx_power')->nullable();$t->float('tx_power')->nullable();$t->timestamp('registered_at')->nullable();$t->timestamp('last_online_at')->nullable();$t->timestamps();$t->softDeletes();});
  Schema::create('olt_devices',function(Blueprint $t){$t->id();$t->string('name');$t->string('vendor_key');$t->string('connection_mode');$t->string('status');$t->json('last_telemetry_snapshot')->nullable();$t->timestamps();});
  DB::table('network_nodes')->insert(['id'=>1,'name'=>'ODP 69-02','node_type'=>'ODP','olt_device_id'=>1]);DB::table('network_ports')->insert(['id'=>1,'node_id'=>1,'port_number'=>'1']);
  $row=['serial_number'=>'TEST00000001','port'=>'gpon-olt_1/1/1','onu_id'=>'1','identity_source'=>Identity::SOURCE,'identity_observed_at'=>now()->toIso8601String(),...OnuTelemetrySample::normalize(['status'=>'Online','rx_power'=>-23.4],now()->toIso8601String())];
  DB::table('olt_devices')->insert(['id'=>1,'name'=>'OLT Fixture','vendor_key'=>'zte-c300','status'=>'active','connection_mode'=>'live','last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);
 }
 private function payload(): array{return ['customer_number'=>'77','name'=>'Fixture customer','address'=>'Fixture address','onu_serial'=>'TEST00000001','odp_id'=>1];}
 public function test_normalization_keeps_full_odp_identity_and_customer_number(): void
 { $this->assertSame('CMN0077',CustomerIntakeService::numberKey('CMN 77'));$this->assertSame('CMN0077',CustomerIntakeService::numberKey('0077'));$this->assertSame('69-2',CustomerIntakeService::odpKey('ODP0069-02'));$this->assertNotSame(CustomerIntakeService::odpKey('ODP 69'),CustomerIntakeService::odpKey('ODP 69-02')); }
 public function test_import_creates_administrative_registration_without_fabricated_telemetry(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload()+['rx_power'=>-19.5])->assertOk();$this->assertDatabaseHas('customers',['customer_number'=>'CMN 0077']);$this->assertDatabaseHas('ont_registrations',['onu_serial'=>'TEST00000001','rx_power'=>null,'tx_power'=>null,'last_online_at'=>null,'status'=>'pending']);$this->assertDatabaseHas('network_ports',['id'=>1,'customer_service_id'=>1]);Http::assertNothingSent();
 }
 public function test_repeat_and_equivalent_customer_ids_do_not_create_duplicates(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();$p=$this->payload();$p['customer_number']='CMN 0077';$this->postJson('/api/customers/sobok/import-single',$p)->assertUnprocessable();$this->assertDatabaseCount('customers',1);
 }
 public function test_full_odp_rolls_back_customer_service_and_audit(): void
 {
  DB::table('network_ports')->where('id',1)->update(['customer_name_cache'=>'Reserved']);$this->postJson('/api/customers/sobok/import-single',$this->payload())->assertUnprocessable();foreach(['customers','customer_services','ont_registrations','audit_logs'] as $table)$this->assertDatabaseCount($table,0);
 }
 public function test_fill_missing_preserves_name_and_sn_and_rejects_stale_version(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();DB::table('customers')->where('id',1)->update(['address'=>null]);$c=Customer::with('services.ontRegistration','services.networkPort')->find(1);$version=CustomerIntakeService::version($c);
  $p=$this->payload()+['mode'=>'fill_missing','expected_version'=>$version];$p['name']='Source renamed';$p['address']='Completed address';$this->postJson('/api/customers/sobok/import-single',$p)->assertOk();$this->assertDatabaseHas('customers',['id'=>1,'name'=>'Fixture customer','address'=>'Completed address']);$this->postJson('/api/customers/sobok/import-single',$p)->assertConflict();$this->assertDatabaseCount('customers',1);
 }
 public function test_conflicting_serial_is_not_overwritten(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();$c=Customer::with('services.ontRegistration','services.networkPort')->find(1);$p=$this->payload()+['mode'=>'fill_missing','expected_version'=>CustomerIntakeService::version($c)];$p['onu_serial']='TEST00000002';$this->postJson('/api/customers/sobok/import-single',$p)->assertUnprocessable();$this->assertDatabaseHas('ont_registrations',['onu_serial'=>'TEST00000001']);
 }
 public function test_direct_registration_uses_selected_olt_and_odp_and_detects_replay(): void
 {
  $p=$this->payload()+['device_id'=>1,'interface'=>'gpon-olt_1/1/1','onu_id'=>'1','odp_port_id'=>1];$this->postJson('/api/olt/register-customer',$p)->assertCreated();$this->postJson('/api/olt/register-customer',$p)->assertConflict();$this->getJson('/api/olt/customer-registration-options?device_id=1')->assertOk()->assertJsonCount(0,'data.0.ports');$this->assertDatabaseCount('customers',1);
 }
 public function test_direct_registration_rejects_wrong_tuple_stale_identity_and_foreign_odp(): void
 {
  $p=$this->payload()+['device_id'=>1,'interface'=>'gpon-olt_1/1/1','onu_id'=>'2','odp_port_id'=>1];$this->postJson('/api/olt/register-customer',$p)->assertConflict();$p['onu_id']='1';DB::table('network_nodes')->where('id',1)->update(['olt_device_id'=>2]);$this->postJson('/api/olt/register-customer',$p)->assertUnprocessable();$this->assertDatabaseCount('customers',0);
 }
 public function test_fresh_complete_inventory_distinguishes_missing_from_offline_na_and_duplicates(): void
 {
  $device=OltDevice::find(1);$reg=(object)['onu_serial'=>'TEST00000002','onu_mac'=>null];$map=['schema'=>3,'observed_at'=>now()->toIso8601String(),'entries'=>['268501248_1'=>'TEST00000001']];Cache::put(Identity::cacheKey(1),$map,600);Cache::put(Identity::cacheKey(1).'_refresh_health',['accepted'=>true,'complete'=>true,'attempted_at'=>$map['observed_at']],600);
  $r=new \App\Services\Olt\OltRegistrationReconciler($device,[],[$reg]);$this->assertSame('missing_in_inventory',$r->issue($reg,false)['issue_code']);$reg->onu_serial='TEST00000001';$this->assertNull($r->issue($reg,true));$r=new \App\Services\Olt\OltRegistrationReconciler($device,[],[$reg,$reg]);$this->assertSame('duplicate_customer_serial',$r->issue($reg,true)['issue_code']);$this->assertFalse($r->issue($reg,true)['can_delete']);Cache::forget(Identity::cacheKey(1).'_refresh_health');$reg->onu_serial='TEST00000002';$r=new \App\Services\Olt\OltRegistrationReconciler($device,[],[$reg]);$this->assertSame('inventory_unverified',$r->issue($reg,false)['issue_code']);
 }
 public function test_customer_only_role_cannot_register_or_remove_through_olt_actions(): void
 {
  auth()->user()->update(['role'=>'Customer Service']);$this->postJson('/api/olt/register-customer',$this->payload())->assertForbidden();$this->postJson('/api/olt/orphaned-onus/bulk-delete',['ids'=>[1],'device_id'=>1])->assertForbidden();
 }
 public function test_parser_maps_reordered_headers_and_keeps_compound_odp_and_reports_rejected_rows(): void
 {
  $s=new \App\Services\SobokScraperService();$parse=new \ReflectionMethod($s,'parseHtml');$rows=$parse->invoke($s,'<table><tr><th>Nama Pelanggan</th><th>Serial Number</th><th>ID Pelanggan</th><th>ODP</th></tr><tr><td>Contoh</td><td>TEST00000001</td><td>77</td><td>ODP0069-02</td></tr><tr><td>bad</td></tr></table>');$this->assertCount(1,$rows);$this->assertSame('77',$rows[0]['raw_id']);$this->assertSame('ODP0069-02',$rows[0]['raw_odp']);$meta=(new \ReflectionProperty($s,'parseMeta'))->getValue($s);$this->assertSame(1,$meta['rejected_rows']);
 }
 public function test_audit_failure_rolls_back_everything(): void
 {
  \App\Models\AuditLog::creating(fn()=>throw new \RuntimeException('Audit fixture failure'));
  $this->withoutExceptionHandling();try{app(CustomerIntakeService::class)->save($this->payload());$this->fail('Expected audit failure');}catch(\RuntimeException $e){$this->assertSame('Audit fixture failure',$e->getMessage());}finally{\App\Models\AuditLog::flushEventListeners();}
  foreach(['customers','customer_services','ont_registrations','audit_logs'] as $table)$this->assertDatabaseCount($table,0);$this->assertDatabaseHas('network_ports',['id'=>1,'customer_service_id'=>null]);
 }
 public function test_parser_does_not_silently_accept_login_page_or_unrelated_table(): void
 {
  $this->expectException(\RuntimeException::class);(new \ReflectionMethod(\App\Services\SobokScraperService::class,'parseHtml'))->invoke(new \App\Services\SobokScraperService(),'<table><tr><td>Login</td><td>Password</td></tr></table>');
 }
 public function test_import_preview_does_not_match_odp_69_to_69_02_and_detects_existing_numeric_id(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();
  $record=['raw_id'=>'CMN77','name'=>'Fixture customer','raw_odp'=>'ODP 69','address'=>'Different address','olt'=>'Fixture','onu_serial'=>'TEST00000001','interface'=>'1/1/1'];$result=(new \ReflectionMethod(\App\Services\SobokScraperService::class,'enrichAndMatchRecords'))->invoke(new \App\Services\SobokScraperService(),[$record]);$row=$result['records'][0];$this->assertTrue($row['already_exists']);$this->assertNull($row['matched_odp_id']);$this->assertSame('unmatched',$row['odp_match_status']);$this->assertDatabaseHas('customers',['name'=>'Fixture customer','address'=>'Fixture address']);
 }
 public function test_direct_registration_rejects_stale_identity_without_writing_snapshot_or_customers(): void
 {
  $snapshot=OltDevice::find(1)->last_telemetry_snapshot;$snapshot['onu_list'][0]['identity_observed_at']=now()->subMinutes(20)->toIso8601String();DB::table('olt_devices')->where('id',1)->update(['last_telemetry_snapshot'=>json_encode($snapshot)]);$p=$this->payload()+['device_id'=>1,'interface'=>'gpon-olt_1/1/1','onu_id'=>'1','odp_port_id'=>1];$this->postJson('/api/olt/register-customer',$p)->assertConflict();$this->assertDatabaseCount('customers',0);$this->assertSame($snapshot,OltDevice::find(1)->last_telemetry_snapshot);
 }
 public function test_missing_inventory_never_proves_absence_and_duplicate_cleanup_is_rejected(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();$this->deleteJson('/api/olt/orphaned-onus/1?device_id=1')->assertConflict();$this->assertDatabaseCount('ont_registrations',1);$this->assertDatabaseHas('customer_services',['id'=>1,'status'=>'active']);
 }
 public function test_complete_inventory_absence_overrides_old_preserved_snapshot_but_not_newer_positive_evidence(): void
 {
  $at=now()->toIso8601String();Cache::put(Identity::cacheKey(1),['schema'=>3,'observed_at'=>$at,'entries'=>['268501248_1'=>'TEST00000001']],600);Cache::put(Identity::cacheKey(1).'_refresh_health',['accepted'=>true,'complete'=>true,'attempted_at'=>$at],600);$reg=(object)['onu_serial'=>'TEST00000002','onu_mac'=>null];$groups=['TEST00000002'=>[['identity_observed_at'=>now()->subMinutes(20)->toIso8601String()]]];$r=new \App\Services\Olt\OltRegistrationReconciler(OltDevice::find(1),$groups,[$reg]);$this->assertSame('missing_in_inventory',$r->issue($reg,true)['issue_code']);$groups['TEST00000002'][0]['identity_observed_at']=$at;$r=new \App\Services\Olt\OltRegistrationReconciler(OltDevice::find(1),$groups,[$reg]);$this->assertNull($r->issue($reg,true));
 }

 public function test_unmapped_existing_customer_can_choose_odp_manually_without_replacing_data(): void
 {
  $p=$this->payload();$p['odp_id']=null;$this->postJson('/api/customers/sobok/import-single',$p)->assertOk();$c=Customer::with('services.ontRegistration','services.networkPort')->find(1);$plan=CustomerIntakeService::preview($c,$p);$this->assertTrue($plan['allow_odp_assignment']);$p+=['mode'=>'fill_missing','expected_version'=>$plan['repair_version']];$p['odp_id']=1;$this->postJson('/api/customers/sobok/import-single',$p)->assertOk();$this->assertDatabaseHas('network_ports',['id'=>1,'customer_service_id'=>1]);$this->assertDatabaseCount('customers',1);$this->assertDatabaseHas('ont_registrations',['id'=>1,'rx_power'=>null]);
 }
 public function test_archived_id_is_not_silently_recreated(): void
 {
  $this->postJson('/api/customers/sobok/import-single',$this->payload())->assertOk();Customer::find(1)->delete();$this->postJson('/api/customers/sobok/import-single',$this->payload())->assertUnprocessable();$this->assertSame(1,Customer::withTrashed()->count());
 }

 public function test_serial_on_another_olt_is_reviewed_instead_of_being_deleted_as_missing(): void
 {
  $at=now()->toIso8601String();$row=['serial_number'=>'TEST00000002','port'=>'gpon-olt_1/1/2','onu_id'=>'2','identity_source'=>Identity::SOURCE,'identity_observed_at'=>$at];DB::table('olt_devices')->insert(['id'=>2,'name'=>'Other fixture OLT','status'=>'active','connection_mode'=>'live','vendor_key'=>'zte-c300','last_telemetry_snapshot'=>json_encode(['onu_list'=>[$row]])]);Cache::put(Identity::cacheKey(1),['schema'=>3,'observed_at'=>$at,'entries'=>['268501248_1'=>'TEST00000001']],600);Cache::put(Identity::cacheKey(1).'_refresh_health',['accepted'=>true,'complete'=>true,'attempted_at'=>$at],600);$reg=(object)['onu_serial'=>'TEST00000002','onu_mac'=>null];$r=new \App\Services\Olt\OltRegistrationReconciler(OltDevice::find(1),[],[$reg]);$this->assertSame('different_olt',$r->issue($reg,false)['issue_code']);$this->assertFalse($r->issue($reg,false)['can_delete']);
 }

}
