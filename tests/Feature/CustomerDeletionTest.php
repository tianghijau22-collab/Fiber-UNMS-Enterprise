<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Cache, DB, Http, Schema};
use Tests\TestCase;

class CustomerDeletionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake(); Http::preventStrayRequests();
        foreach (['0001_01_01_000000_create_users_table.php', '2026_08_09_153751_create_audit_logs_table.php', '2026_08_14_000002_create_system_settings_table.php'] as $migration) (require database_path('migrations/'.$migration))->up();
        Schema::table('users', function (Blueprint $t) { $t->string('role'); $t->string('status')->default('Active'); });
        $this->actingAs(User::create(['name'=>'Admin fixture', 'email'=>'delete@example.test', 'password'=>'test-password', 'role'=>'Super Administrator', 'status'=>'Active']));
        Schema::create('customers', function (Blueprint $t) { $t->id(); $t->string('name'); $t->string('customer_number'); $t->timestamps(); $t->softDeletes(); });
        Schema::create('customer_services', function (Blueprint $t) { $t->id(); $t->foreignId('customer_id')->constrained()->cascadeOnDelete(); $t->string('onu_serial'); $t->timestamps(); $t->softDeletes(); });
        Schema::create('network_nodes', function (Blueprint $t) { $t->id(); $t->integer('used_ports')->default(0); $t->timestamps(); $t->softDeletes(); });
        Schema::create('network_ports', function (Blueprint $t) { $t->id(); $t->integer('node_id'); $t->foreignId('customer_service_id')->nullable()->constrained()->nullOnDelete(); $t->string('customer_name_cache')->nullable(); $t->string('destination_label')->nullable(); $t->string('status'); $t->timestamps(); });
        Schema::create('ont_registrations', function (Blueprint $t) { $t->id(); $t->foreignId('customer_service_id')->constrained()->cascadeOnDelete(); $t->string('onu_serial'); });
        DB::table('customers')->insert([['id'=>42, 'name'=>'Lama', 'customer_number'=>'OLD42'], ['id'=>73, 'name'=>'Baru', 'customer_number'=>'NEW73']]);
        DB::table('customer_services')->insert([['id'=>101, 'customer_id'=>42, 'onu_serial'=>'TEST00000001'], ['id'=>202, 'customer_id'=>73, 'onu_serial'=>'TEST00000001']]);
        DB::table('network_nodes')->insert(['id'=>9, 'used_ports'=>2]);
        DB::table('network_ports')->insert([['id'=>11, 'node_id'=>9, 'customer_service_id'=>101, 'customer_name_cache'=>'Lama', 'destination_label'=>'Lama', 'status'=>'used'], ['id'=>22, 'node_id'=>9, 'customer_service_id'=>202, 'customer_name_cache'=>'Baru', 'destination_label'=>'Baru', 'status'=>'used']]);
        DB::table('ont_registrations')->insert([['id'=>9001, 'customer_service_id'=>101, 'onu_serial'=>'TEST00000001'], ['id'=>9002, 'customer_service_id'=>202, 'onu_serial'=>'TEST00000001']]);
    }

    public function test_deleting_selected_customer_preserves_other_customer_with_same_serial_and_frees_only_its_port(): void
    {
        Cache::put('customers_index_payload_v5', ['old']); Cache::put('odp_onus_topology_v2_9', ['old']);
        $this->deleteJson('/api/customers/42')->assertOk()->assertJson(['status'=>'success']);
        $this->assertDatabaseMissing('customers', ['id'=>42]);
        $this->assertDatabaseHas('customers', ['id'=>73]);
        $this->assertDatabaseMissing('customer_services', ['id'=>101]);
        $this->assertDatabaseHas('customer_services', ['id'=>202]);
        $this->assertDatabaseMissing('ont_registrations', ['id'=>9001]);
        $this->assertDatabaseHas('ont_registrations', ['id'=>9002, 'onu_serial'=>'TEST00000001']);
        $this->assertDatabaseHas('network_ports', ['id'=>11, 'customer_service_id'=>null, 'customer_name_cache'=>null, 'destination_label'=>null, 'status'=>'available']);
        $this->assertDatabaseHas('network_ports', ['id'=>22, 'customer_service_id'=>202, 'status'=>'used']);
        $this->assertDatabaseHas('network_nodes', ['id'=>9, 'used_ports'=>1]);
        $this->assertDatabaseHas('audit_logs', ['action'=>'DELETE']);
        $this->assertNull(Cache::get('customers_index_payload_v5')); $this->assertNull(Cache::get('odp_onus_topology_v2_9'));
    }

    public function test_soft_deleted_services_also_release_their_ports(): void
    {
        DB::table('customer_services')->where('id',101)->update(['deleted_at'=>now()]);
        $this->deleteJson('/api/customers/42')->assertOk();
        $this->assertDatabaseHas('network_ports', ['id'=>11, 'customer_service_id'=>null, 'customer_name_cache'=>null, 'status'=>'available']);
        $this->assertDatabaseHas('customers', ['id'=>73]);
    }

    public function test_a_failure_rolls_back_customer_and_port_changes(): void
    {
        DB::statement("CREATE TRIGGER refuse_customer_delete BEFORE DELETE ON customers BEGIN SELECT RAISE(ABORT, 'fixture refusal'); END");
        $this->deleteJson('/api/customers/42')->assertStatus(500);
        $this->assertDatabaseHas('customers', ['id'=>42]);
        $this->assertDatabaseHas('network_ports', ['id'=>11, 'customer_service_id'=>101, 'customer_name_cache'=>'Lama', 'destination_label'=>'Lama', 'status'=>'used']);
        $this->assertDatabaseHas('network_nodes', ['id'=>9, 'used_ports'=>2]);
    }

    public function test_role_without_customer_write_access_cannot_delete(): void
    {
        $user=auth()->user(); $user->update(['role'=>'Customer Service']);
        $this->deleteJson('/api/customers/42')->assertForbidden();
        $this->assertDatabaseHas('customers', ['id'=>42]);
        $this->assertDatabaseHas('network_ports', ['id'=>11, 'customer_service_id'=>101]);
    }
}
