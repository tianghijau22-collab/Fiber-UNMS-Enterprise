<?php

namespace Tests\Feature;

use App\Http\Controllers\NetworkCableController;
use App\Models\NetworkCable;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CableRouteUpdateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake();
        Http::preventStrayRequests();
        (require database_path('migrations/0001_01_01_000000_create_users_table.php'))->up();
        (require database_path('migrations/2026_08_09_153751_create_audit_logs_table.php'))->up();
        Schema::create('network_cables', function (Blueprint $table) {
            $table->id(); $table->string('name'); $table->decimal('length_meters', 12, 2);
            $table->json('route_coordinates')->nullable(); $table->timestamps(); $table->softDeletes();
        });
        Route::put('/api/_test/cables/{networkCable}/route', [NetworkCableController::class, 'updateRoute'])
            ->middleware(\Illuminate\Routing\Middleware\SubstituteBindings::class);
        $user = User::create(['name'=>'Operator Test','email'=>'route-test@example.test','password'=>'test-password']);
        $this->actingAs($user->forceFill(['role'=>'Operator Jaringan']));
    }

    private function cable(): NetworkCable
    {
        return NetworkCable::create(['name'=>'Kabel Test','length_meters'=>500,'route_coordinates'=>[['lat'=>0,'lng'=>100,'name'=>'Tiang 1']]]);
    }

    public function test_clearing_all_waypoints_preserves_inventory_length(): void
    {
        $cable = $this->cable();
        $this->putJson('/api/_test/cables/'.$cable->id.'/route', ['route_coordinates'=>[], 'expected_updated_at'=>$cable->updated_at->toISOString()])->assertOk()->assertJsonPath('data.route_coordinates', []);
        $this->assertSame([], $cable->fresh()->route_coordinates);
        $this->assertSame('500.00', $cable->fresh()->length_meters);
    }

    public function test_explicit_estimate_updates_length_and_zero_coordinates_are_valid(): void
    {
        $cable = $this->cable();
        $this->putJson('/api/_test/cables/'.$cable->id.'/route', ['route_coordinates'=>[['lat'=>0,'lng'=>0]],'length_meters'=>750])->assertOk()->assertJsonPath('data.length_meters','750.00');
    }

    public function test_invalid_points_missing_array_and_zero_length_are_rejected_without_changes(): void
    {
        $cable = $this->cable()->fresh(); $before = $cable->getAttributes();
        foreach ([[], ['route_coordinates'=>[['lat'=>91,'lng'=>100]]], ['route_coordinates'=>[['lat'=>0]]], ['route_coordinates'=>[['lat'=>0,'lng'=>181]]], ['route_coordinates'=>[],'length_meters'=>0]] as $body) {
            $this->putJson('/api/_test/cables/'.$cable->id.'/route', $body)->assertUnprocessable();
            $this->assertEquals($before, $cable->fresh()->getAttributes());
        }
    }

    public function test_stale_version_cannot_overwrite_changes_from_cable_management(): void
    {
        $cable = $this->cable(); $oldVersion = $cable->updated_at->copy()->subMinute()->toISOString();
        $this->putJson('/api/_test/cables/'.$cable->id.'/route', ['route_coordinates'=>[], 'expected_updated_at'=>$oldVersion])->assertConflict();
        $this->assertCount(1, $cable->fresh()->route_coordinates);
        $this->assertSame('500.00', $cable->fresh()->length_meters);
    }

    public function test_read_only_role_and_anonymous_requests_cannot_write(): void
    {
        $cable = $this->cable();
        $this->actingAs((new User)->forceFill(['id'=>2,'role'=>'NOC Operator']));
        $this->putJson('/api/_test/cables/'.$cable->id.'/route', ['route_coordinates'=>[]])->assertForbidden();
        auth()->forgetGuards();
        $this->putJson('/api/_test/cables/'.$cable->id.'/route', ['route_coordinates'=>[]])->assertUnauthorized();
        $this->assertCount(1, $cable->fresh()->route_coordinates);
    }
}
