<?php

namespace Tests\Feature;

use App\Models\NetworkCable;
use App\Models\NetworkNode;
use App\Models\User;
use App\Services\TopologyConnectionGeometry;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TopologyConnectionTest extends TestCase
{
    private User $operator;
    private string $candidate='cable-end:1:1:2:0';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Http::fake();Http::preventStrayRequests();
        foreach(['0001_01_01_000000_create_users_table.php','2026_08_09_153751_create_audit_logs_table.php','2026_08_14_000002_create_system_settings_table.php'] as $m)(require database_path('migrations/'.$m))->up();
        Schema::table('users',function(Blueprint $t){$t->string('role');$t->string('status')->default('Active');});
        Schema::create('olt_devices',function(Blueprint $t){$t->id();$t->string('name');$t->string('status');});
        Schema::create('network_nodes',function(Blueprint $t){$t->id();$t->string('name');$t->string('code')->nullable();$t->string('node_type');$t->decimal('latitude',10,7)->nullable();$t->decimal('longitude',10,7)->nullable();$t->integer('olt_device_id')->nullable();$t->string('olt_port_ref')->nullable();$t->timestamps();$t->softDeletes();});
        Schema::create('network_cables',function(Blueprint $t){$t->id();$t->string('name');$t->string('code')->nullable();$t->integer('from_node_id')->nullable();$t->integer('to_node_id')->nullable();$t->integer('core_count_total');$t->string('status');$t->json('route_coordinates')->nullable();$t->timestamps();$t->softDeletes();});
        (require database_path('migrations/2026_10_19_000001_create_topology_connections_tables.php'))->up();
        DB::table('olt_devices')->insert([['id'=>1,'name'=>'OLT Test','status'=>'active'],['id'=>2,'name'=>'OLT Other','status'=>'active']]);
        NetworkNode::create(['id'=>1,'name'=>'Closure Test','node_type'=>'CLOSURE','latitude'=>0,'longitude'=>100.001,'olt_device_id'=>1,'olt_port_ref'=>'gpon-olt_1/3/1']);
        NetworkCable::create(['id'=>1,'name'=>'Kabel A','core_count_total'=>12,'status'=>'active','route_coordinates'=>[[0,100],[0,100.001]]]);
        NetworkCable::create(['id'=>2,'name'=>'Kabel B','core_count_total'=>24,'status'=>'active','route_coordinates'=>[['lat'=>0,'lng'=>100.00102],['lat'=>0,'lng'=>100.002]]]);
        $this->operator=User::create(['name'=>'Operator Test','email'=>'topology@example.test','password'=>'test-pass','role'=>'Operator Jaringan','status'=>'Active']);$this->actingAs($this->operator);
    }

    private function prepared(?string $id=null): array {return app(TopologyConnectionGeometry::class)->prepare($id??$this->candidate,10);}
    private function payload(array $patch=[]): array
    {
        $p=$this->prepared();return array_replace(['candidate_id'=>$this->candidate,'tolerance'=>10,'source_version'=>$p['source_version'],'junction_node_id'=>1,'junction_version'=>$p['junction_nodes'][0]['version'],
            'direction'=>'a_to_b','connection_type'=>'splice','olt_device_id'=>1,'pon'=>'1/3/1','core_a'=>1,'core_b'=>2,'note'=>'Diperiksa pada closure sesuai lapangan.','confirmed'=>true],$patch);
    }

    public function test_store_is_atomic_audited_and_does_not_modify_inventory_or_contact_olt(): void
    {
        $before=NetworkCable::orderBy('id')->get()->toJson();$nodes=NetworkNode::get()->toJson();
        $this->postJson('/api/topology-connections',$this->payload())->assertCreated();
        $this->assertDatabaseCount('topology_connections',1);$this->assertDatabaseCount('topology_connection_events',1);$this->assertDatabaseCount('audit_logs',1);
        $d=json_decode(DB::table('topology_connections')->value('definition'),true);$this->assertTrue($d['core_details_complete']);$this->assertFalse($d['fault_detection_enabled']);$this->assertSame(2,$d['b']['core']);
        $this->assertSame($before,NetworkCable::orderBy('id')->get()->toJson());$this->assertSame($nodes,NetworkNode::get()->toJson());Http::assertNothingSent();
    }

    public function test_prepare_checks_the_actual_preview_coordinates_and_exposes_only_minimal_olt_fields(): void
    {
        $p=$this->prepared();$q=['candidate_id'=>$this->candidate,'tolerance'=>10,'a_lat'=>$p['a']['point']['lat'],'a_lng'=>$p['a']['point']['lng'],'b_lat'=>$p['b']['point']['lat'],'b_lng'=>$p['b']['point']['lng']];
        $this->getJson('/api/topology-connections/prepare?'.http_build_query($q))->assertOk()->assertJsonPath('data.olts.0.name','OLT Other');
        $q['a_lat']=1;$this->getJson('/api/topology-connections/prepare?'.http_build_query($q))->assertConflict();
        $this->assertDatabaseCount('topology_connections',0);Http::assertNothingSent();
    }

    public function test_duplicate_and_opposite_direction_of_same_connection_are_rejected(): void
    {
        $body=$this->payload();$this->postJson('/api/topology-connections',$body)->assertCreated();
        $this->postJson('/api/topology-connections',$body)->assertConflict();
        $this->postJson('/api/topology-connections',array_replace($body,['direction'=>'b_to_a']))->assertConflict();
        $this->assertDatabaseCount('topology_connections',1);$this->assertDatabaseCount('topology_connection_events',1);
    }

    public function test_changed_route_or_junction_cannot_be_saved_from_a_stale_form(): void
    {
        $body=$this->payload();NetworkCable::find(1)->update(['name'=>'New label']);
        $this->postJson('/api/topology-connections',$body)->assertConflict();
        $body=$this->payload();NetworkNode::find(1)->update(['name'=>'Closure updated']);
        $this->postJson('/api/topology-connections',$body)->assertConflict();$this->assertDatabaseCount('topology_connections',0);
    }

    public function test_invalid_core_pon_olt_and_unconfirmed_or_blank_validation_are_rejected(): void
    {
        foreach ([['core_a'=>13],['core_b'=>25],['pon'=>'1/4/1'],['pon'=>'1/3/1:7'],['olt_device_id'=>2],['confirmed'=>false],['direction'=>'unknown'],['note'=>'      '],['junction_node_id'=>999],['connection_type'=>'termination']] as $patch) $this->postJson('/api/topology-connections',$this->payload($patch))->assertUnprocessable();
        $this->assertDatabaseCount('topology_connections',0);$this->assertDatabaseCount('topology_connection_events',0);
    }

    public function test_missing_cores_are_explicitly_incomplete_and_not_ready_for_fault_detection(): void
    {
        $this->postJson('/api/topology-connections',$this->payload(['core_a'=>null,'core_b'=>null]))->assertCreated();
        $this->getJson('/api/topology-connections')->assertOk()->assertJsonPath('data.0.definition.core_details_complete',false)->assertJsonPath('data.0.definition.fault_detection_enabled',false)->assertJsonPath('data.0.source_current',true);
    }

    public function test_revocation_requires_revision_and_keeps_history_then_allows_new_validation(): void
    {
        $this->postJson('/api/topology-connections',$this->payload())->assertCreated();
        $this->postJson('/api/topology-connections/1/revoke',['expected_revision'=>2,'reason'=>'Koreksi hasil pemeriksaan'])->assertConflict();
        $this->postJson('/api/topology-connections/1/revoke',['expected_revision'=>1,'reason'=>'Koreksi hasil pemeriksaan'])->assertOk();
        $this->assertDatabaseHas('topology_connections',['id'=>1,'state'=>'revoked','revision'=>2,'active_key'=>null]);
        $this->postJson('/api/topology-connections/1/revoke',['expected_revision'=>1,'reason'=>'Koreksi hasil pemeriksaan'])->assertConflict();
        $this->getJson('/api/topology-connections/1/history')->assertOk()->assertJsonCount(2,'data')->assertJsonPath('data.1.action','revoked');
        $this->postJson('/api/topology-connections',$this->payload())->assertCreated();$this->assertDatabaseCount('topology_connections',2);
    }

    public function test_source_changes_are_flagged_and_deleted_cables_cannot_remain_current(): void
    {
        $this->postJson('/api/topology-connections',$this->payload())->assertCreated();
        NetworkCable::find(1)->delete();$this->getJson('/api/topology-connections')->assertOk()->assertJsonPath('data.0.source_current',false);
        $this->assertDatabaseCount('topology_connection_events',1);
    }

    public function test_anonymous_and_read_only_roles_cannot_store_or_revoke(): void
    {
        $body=$this->payload();$this->operator->forceFill(['role'=>'Teknisi Jointer'])->save();
        $this->postJson('/api/topology-connections',$body)->assertForbidden();$this->postJson('/api/topology-connections/1/revoke',['expected_revision'=>1,'reason'=>'Koreksi catatan'])->assertForbidden();
        auth()->forgetGuards();$this->postJson('/api/topology-connections',$body)->assertUnauthorized();$this->getJson('/api/topology-connections')->assertUnauthorized();
        $this->assertDatabaseCount('topology_connections',0);
    }

    public function test_permission_override_cannot_grant_non_operator_write_access(): void
    {
        $body=$this->payload();$this->operator->forceFill(['role'=>'NOC Operator'])->save();
        \App\Models\SystemSetting::set('rbac_route_permissions',json_encode(['/cable-routes'=>['NOC Operator']]));
        $this->getJson('/api/topology-connections')->assertOk();$this->postJson('/api/topology-connections',$body)->assertForbidden();
    }

    public function test_all_candidate_kinds_are_recomputed_and_midspan_has_route_position(): void
    {
        $this->assertSame('endpoint_node',$this->prepared('endpoint-node:1:1:1')['kind']);
        NetworkNode::find(1)->update(['longitude'=>100.0005]);
        $p=$this->prepared('node-route:1:1');$this->assertSame('node_route',$p['kind']);$this->assertEqualsWithDelta(55.6,$p['b']['position_meters'],0.2);
        NetworkCable::find(2)->update(['route_coordinates'=>[[0,100.0005],[0.001,100.0005]]]);
        $this->assertSame('cable_branch',$this->prepared('cable-branch:2:0:1')['kind']);
    }

    public function test_failed_audit_rolls_back_connection_and_event_together(): void
    {
        $body=$this->payload();Schema::drop('audit_logs');
        $this->postJson('/api/topology-connections',$body)->assertStatus(500);
        $this->assertDatabaseCount('topology_connections',0);$this->assertDatabaseCount('topology_connection_events',0);
    }

    public function test_invalid_route_and_moved_endpoint_are_not_accepted_even_with_forged_coordinates(): void
    {
        $body=$this->payload();NetworkCable::find(2)->update(['route_coordinates'=>[[0,101],[0,101.001]]]);
        $this->postJson('/api/topology-connections',$body)->assertConflict();
        NetworkCable::find(2)->update(['route_coordinates'=>[[0,100.00102],null,[0,100.002]]]);
        $this->postJson('/api/topology-connections',$body)->assertConflict();$this->assertDatabaseCount('topology_connections',0);
    }
}
