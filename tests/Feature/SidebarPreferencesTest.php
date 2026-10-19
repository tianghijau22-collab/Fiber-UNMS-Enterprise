<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\SystemSetting;
use App\Services\ApiAccessPolicy;
use App\Services\SidebarPreferences;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SidebarPreferencesTest extends TestCase
{
    private User $admin;
    protected function setUp(): void
    {
        parent::setUp();$this->assertSame('sqlite',config('database.default'));$this->assertSame(':memory:',config('database.connections.sqlite.database'));
        Http::fake();Http::preventStrayRequests();
        foreach(['0001_01_01_000000_create_users_table.php','2026_08_09_153751_create_audit_logs_table.php','2026_08_14_000002_create_system_settings_table.php'] as $migration)(require database_path('migrations/'.$migration))->up();
        Schema::table('users',function(Blueprint $t){$t->string('role');$t->string('status')->default('Active');});
        $this->admin=User::create(['name'=>'Admin Test','email'=>'sidebar@example.test','password'=>'test-password','role'=>'Super Administrator','status'=>'Active']);$this->actingAs($this->admin);
    }
    private function snapshot(): array { return $this->getJson('/api/rbac/permissions')->assertOk()->json(); }
    private function payload(): array { $s=$this->snapshot();return ['permissions'=>$s['data'],'sidebar'=>$s['sidebar'],'expected_version'=>$s['settings_version']]; }

    public function test_catalog_and_defaults_cover_all_sidebar_routes_without_fullscreen_duplicate(): void
    {
        $s=$this->snapshot();$paths=array_values(array_diff(array_keys(\App\Http\Controllers\UserController::getDefaultRoutePermissions()),['/gis-map/fullscreen']));$catalog=app(SidebarPreferences::class)->catalog();
        $this->assertSame([],array_values(array_diff($paths,$catalog)));$this->assertCount(count($paths)+1,$catalog);$this->assertSame('@olt-regions',$s['sidebar']['order'][0]);$this->assertSame([],$s['sidebar']['super_admin_hidden']);$this->assertSame(64,strlen($s['settings_version']));
    }
    public function test_order_and_admin_visibility_persist_without_changing_rbac_or_full_access(): void
    {
        SystemSetting::set('rbac_route_permissions',json_encode(['/customers'=>['Customer Service']]));$before=SystemSetting::get('rbac_route_permissions');$p=$this->payload();
        $p['sidebar']['order']=array_reverse($p['sidebar']['order']);$p['sidebar']['super_admin_hidden']=['/users','/olt-management','@olt-regions'];
        $this->postJson('/api/rbac/permissions',$p)->assertOk()->assertJsonPath('sidebar.super_admin_hidden.0','/users');
        $this->assertSame($before,SystemSetting::get('rbac_route_permissions'));
        $saved=$this->snapshot();$this->assertSame($p['sidebar'],$saved['sidebar']);$this->assertContains('Super Administrator',$saved['data']['/users']);
        $r=Request::create('/api/olts','GET');$r->setRouteResolver(fn()=>Route::getRoutes()->match($r));$this->assertTrue(app(ApiAccessPolicy::class)->allows($this->admin,$r));Http::assertNothingSent();
        $this->assertDatabaseCount('audit_logs',1);
    }
    public function test_stale_save_and_reset_are_rejected_without_overwriting_current_configuration(): void
    {
        $old=$this->payload();$new=$old;$new['sidebar']['super_admin_hidden']=['/dashboard'];$this->postJson('/api/rbac/permissions',$new)->assertOk();
        $this->postJson('/api/rbac/permissions',$old)->assertConflict();$this->postJson('/api/rbac/permissions/reset',['expected_version'=>$old['expected_version']])->assertConflict();
        $this->assertSame(['/dashboard'],$this->snapshot()['sidebar']['super_admin_hidden']);$this->assertDatabaseCount('audit_logs',1);
    }
    public function test_unknown_duplicate_missing_menu_ids_and_missing_version_are_rejected(): void
    {
        $base=$this->payload();$bad=$base;$bad['sidebar']['order'][0]='/unknown';$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();
        $bad=$base;$bad['sidebar']['order'][0]=$bad['sidebar']['order'][1];$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();
        $bad=$base;array_pop($bad['sidebar']['order']);$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();
        $bad=$base;$bad['sidebar']['super_admin_hidden']=['/unknown'];$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();
        $bad=$base;unset($bad['expected_version']);$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();
        $bad=$base;unset($bad['sidebar']['super_admin_hidden']);$this->postJson('/api/rbac/permissions',$bad)->assertUnprocessable();$this->assertDatabaseCount('audit_logs',0);
    }
    public function test_other_roles_can_read_preferences_but_cannot_save_or_reset(): void
    {
        $p=$this->payload();$this->admin->forceFill(['role'=>'Operator Jaringan'])->save();$this->snapshot();
        $this->postJson('/api/rbac/permissions',$p)->assertForbidden();$this->postJson('/api/rbac/permissions/reset')->assertForbidden();
        auth()->forgetGuards();$this->getJson('/api/rbac/permissions')->assertUnauthorized();$this->assertNull(SystemSetting::get(SidebarPreferences::KEY));
    }
    public function test_reset_permissions_preserves_saved_order_and_visibility(): void
    {
        $p=$this->payload();$p['sidebar']['super_admin_hidden']=['/dashboard'];$p['sidebar']['order']=array_reverse($p['sidebar']['order']);
        $this->postJson('/api/rbac/permissions',$p)->assertOk();$s=$this->snapshot();
        $this->postJson('/api/rbac/permissions/reset',['expected_version'=>$s['settings_version']])->assertOk()->assertJsonPath('sidebar',$p['sidebar']);
    }
    public function test_legacy_permission_save_still_keeps_super_admin_access_and_sidebar_preferences(): void
    {
        $p=$this->payload();$p['sidebar']['super_admin_hidden']=['/dashboard'];$this->postJson('/api/rbac/permissions',$p)->assertOk();
        $this->postJson('/api/rbac/permissions',['permissions'=>['/customers'=>['Customer Service']]])->assertOk()->assertJsonPath('sidebar.super_admin_hidden.0','/dashboard')->assertJsonPath('data./customers',['Super Administrator','Customer Service']);
    }
    public function test_audit_failure_rolls_back_both_preferences_and_permissions(): void
    {
        $p=$this->payload();$p['sidebar']['super_admin_hidden']=['/dashboard'];$p['permissions']['/customers']=[];Schema::drop('audit_logs');
        $this->postJson('/api/rbac/permissions',$p)->assertStatus(500);$this->assertNull(SystemSetting::get(SidebarPreferences::KEY));$this->assertNull(SystemSetting::get('rbac_route_permissions'));
    }
    public function test_corrupt_or_outdated_sidebar_data_falls_back_without_affecting_permissions(): void
    {
        SystemSetting::set(SidebarPreferences::KEY,'bad JSON');$this->assertSame(app(SidebarPreferences::class)->defaults(),$this->snapshot()['sidebar']);
        SystemSetting::set(SidebarPreferences::KEY,json_encode(['order'=>['/customers','/removed','/customers'],'super_admin_hidden'=>['/removed','/dashboard']]));
        $s=$this->snapshot();$this->assertSame('/customers',$s['sidebar']['order'][0]);$this->assertCount(count(app(SidebarPreferences::class)->catalog()),$s['sidebar']['order']);$this->assertSame(['/dashboard'],$s['sidebar']['super_admin_hidden']);
    }
}
