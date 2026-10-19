<?php

namespace Tests\Feature;

use App\Http\Middleware\AuthorizeApiAccess;
use App\Models\AuditLog;
use App\Models\AppNotification;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\VoiceCall;
use App\Services\ApiAccessPolicy;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class ApiAuthenticationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Refuse to run these destructive fixture operations on a real database.
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::fake();
        Http::preventStrayRequests();
        foreach ([
            '0001_01_01_000000_create_users_table.php',
            '2026_08_09_153751_create_audit_logs_table.php',
            '2026_08_14_000002_create_system_settings_table.php',
            '2026_08_14_000001_create_notifications_tables.php',
            '2026_08_16_000001_create_voice_calls_table.php',
            '2026_10_12_000001_create_personal_access_tokens_table.php',
        ] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique();
            $table->string('phone')->nullable();
            $table->string('role');
            $table->string('division');
            $table->string('status');
            $table->timestamp('last_login_at')->nullable();
        });
    }

    private function user(string $role = 'Super Administrator', string $status = 'Active'): User
    {
        $n = User::count() + 1;
        return User::create([
            'name' => 'Test User '.$n, 'username' => 'test'.$n,
            'email' => 'test'.$n.'@example.test', 'phone' => '081234000'.$n,
            'password' => 'secret123', 'role' => $role, 'division' => 'Test', 'status' => $status,
        ]);
    }

    private function freshClient(?string $token = null): static
    {
        Auth::forgetGuards();
        Auth::shouldUse('web');
        $this->flushHeaders();
        if ($token !== null) $this->withToken($token);
        return $this;
    }

    public function test_every_private_api_route_rejects_anonymous_requests_before_any_controller_runs(): void
    {
        $public = [
            'api/auth/login' => ['POST'],
            'api/public/tickets/{ticketNumber}' => ['GET', 'HEAD'],
            'api/app-testing/login-banner' => ['GET', 'HEAD'],
        ];
        $count = 0;
        foreach (Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/')) continue;
            if (isset($public[$route->uri()]) && !array_diff($route->methods(), $public[$route->uri()])) continue;
            $this->assertContains('auth:sanctum', $route->gatherMiddleware(), $route->uri());
            $this->assertContains(AuthorizeApiAccess::class, $route->gatherMiddleware(), $route->uri());
            $this->assertNotNull(app(ApiAccessPolicy::class)->ruleFor($route), $route->uri());
            $uri = '/'.preg_replace('/\{[^}]+\}/', '987654321', $route->uri());
            $this->freshClient()->json($route->methods()[0], $uri, [
                'user_id' => 1, 'user_role' => 'Super Administrator',
            ], ['X-User-Id' => '1', 'X-User-Role' => 'Super Administrator'])->assertUnauthorized();
            $count++;
        }
        $this->assertSame(214, $count);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_mobile_login_issues_a_hashed_expiring_token_and_me_ignores_forged_identity(): void
    {
        $user = $this->user('Customer Service');
        $other = $this->user();
        $login = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret123'])
            ->assertOk()->assertJsonPath('user.id', $user->id)->assertJsonMissingPath('user.password');
        $token = $login->json('token');
        $this->assertIsString($token);
        $stored = PersonalAccessToken::firstOrFail();
        $this->assertNotSame($token, $stored->token);
        $this->assertSame(hash('sha256', explode('|', $token, 2)[1]), $stored->token);
        $this->assertTrue($stored->expires_at->isFuture());
        $this->assertLessThanOrEqual(7 * 86400, now()->diffInSeconds($stored->expires_at));
        $this->freshClient($token)->getJson('/api/auth/me?user_id='.$other->id, ['X-User-Id' => $other->id])
            ->assertOk()->assertJsonPath('user.id', $user->id)->assertHeader('Cache-Control', 'no-store, private');
        $this->freshClient('session_'.md5('fake'))->getJson('/api/auth/me?user_id='.$other->id)->assertUnauthorized();
        $this->freshClient($token)->getJson('/api/users', ['X-User-Role' => 'Super Administrator'])->assertForbidden();
        $this->assertSame($user->id, AuditLog::where('action', 'LOGIN')->firstOrFail()->user_id);
    }

    public function test_wrong_password_and_blocked_accounts_never_receive_tokens(): void
    {
        $user = $this->user();
        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'wrong'])->assertUnauthorized();
        $user->update(['status' => 'Suspended']);
        $this->freshClient()->postJson('/api/auth/login', ['username' => $user->email, 'password' => 'secret123'])->assertForbidden();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_login_attempts_are_limited(): void
    {
        $user = $this->user();
        for ($i = 0; $i < 5; $i++) {
            $this->freshClient()->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'wrong'])->assertUnauthorized();
        }
        $this->freshClient()->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret123'])
            ->assertStatus(429)->assertHeader('Retry-After');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_logout_revokes_only_the_presented_token_and_ignores_user_id(): void
    {
        $user = $this->user();
        $other = $this->user();
        $token = $user->createToken('phone')->plainTextToken;
        $second = $user->createToken('second')->plainTextToken;
        $otherToken = $other->createToken('other')->plainTextToken;
        $this->freshClient($token)->postJson('/api/auth/logout', ['user_id' => $other->id])->assertOk();
        $this->freshClient($token)->getJson('/api/auth/me')->assertUnauthorized();
        $this->freshClient($second)->getJson('/api/auth/me')->assertOk();
        $this->freshClient($otherToken)->getJson('/api/auth/me')->assertJsonPath('user.id', $other->id);
    }

    public function test_expired_tokens_and_accounts_suspended_after_login_are_denied(): void
    {
        $user = $this->user();
        $expired = $user->createToken('expired', ['*'], now()->subSecond())->plainTextToken;
        $this->freshClient($expired)->getJson('/api/auth/me')->assertUnauthorized();
        $token = $user->createToken('valid')->plainTextToken;
        $user->update(['status' => 'Inactive']);
        $this->freshClient($token)->getJson('/api/auth/me')->assertForbidden()->assertJsonPath('code', 'ACCOUNT_INACTIVE');
    }

    public function test_profile_changes_only_the_owner_and_password_change_revokes_all_sessions(): void
    {
        $user = $this->user('Customer Service');
        $other = $this->user();
        $token = $user->createToken('first')->plainTextToken;
        $user->createToken('second');
        DB::table('sessions')->insert(['id' => 'old-session', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
        $this->freshClient($token)->putJson('/api/auth/profile', ['user_id' => $other->id, 'name' => 'Owner changed'])
            ->assertOk()->assertJsonPath('user.id', $user->id);
        $this->assertSame('Test User 2', $other->fresh()->name);
        $this->freshClient($token)->putJson('/api/auth/profile', ['password' => 'newSecret123'])
            ->assertUnprocessable()->assertJsonValidationErrors('old_password');
        $this->freshClient($token)->putJson('/api/auth/profile', ['password' => 'newSecret123', 'old_password' => 'wrong'])
            ->assertUnprocessable();
        $this->freshClient($token)->putJson('/api/auth/profile', ['password' => 'newSecret123', 'old_password' => 'secret123'])->assertOk();
        $this->assertTrue(Hash::check('newSecret123', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('sessions', ['id' => 'old-session']);
        $this->freshClient($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_admin_reset_revokes_target_tokens_and_sessions_and_audit_cannot_be_forged(): void
    {
        $admin = $this->user();
        $target = $this->user('Operator Jaringan');
        $token = $admin->createToken('admin')->plainTextToken;
        $targetToken = $target->createToken('phone')->plainTextToken;
        DB::table('sessions')->insert(['id' => 'target-session', 'user_id' => $target->id, 'payload' => '', 'last_activity' => time()]);
        $this->freshClient($token)->putJson('/api/users/'.$target->id, ['password' => 'replacement123'], [
            'X-User-Id' => $target->id, 'X-User-Name' => 'Imposter', 'X-User-Role' => 'Finance & Billing',
        ])->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => 'target-session']);
        $this->freshClient($targetToken)->getJson('/api/auth/me')->assertUnauthorized();
        $log = AuditLog::where('action', 'UPDATE')->firstOrFail();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame($admin->name, $log->user_name);
        $this->assertArrayNotHasKey('password', $log->new_values);
    }

    public function test_roles_allow_shared_reads_but_deny_master_writes_and_secret_configuration(): void
    {
        $policy = app(ApiAccessPolicy::class);
        $technician = $this->user('Teknisi Jointer');
        $cs = $this->user('Customer Service');
        $operator = $this->user('Operator Jaringan');
        $check = function ($user, $method, $uri) use ($policy) {
            $request = Request::create($uri, $method);
            $route = Route::getRoutes()->match($request);
            $request->setRouteResolver(fn () => $route);
            return $policy->allows($user, $request);
        };
        $this->assertTrue($check($technician, 'GET', '/api/network-nodes'));
        $this->assertTrue($check($cs, 'GET', '/api/network-nodes'));
        $this->assertFalse($check($technician, 'POST', '/api/network-nodes'));
        $this->assertFalse($check($cs, 'DELETE', '/api/customers/123'));
        $this->assertTrue($check($technician, 'POST', '/api/odp-checks'));
        $this->assertTrue($check($cs, 'POST', '/api/tickets'));
        $this->assertTrue($check($operator, 'POST', '/api/olt/authorize-onu'));
        $this->assertFalse($check($operator, 'GET', '/api/notifications/telegram-config'));
        $this->assertFalse($check($operator, 'DELETE', '/api/notifications/clear-all'));
        SystemSetting::set('rbac_route_permissions', json_encode(['/odp-checks' => [], '/field-tech' => []]));
        $this->assertFalse($check($technician, 'POST', '/api/odp-checks'));
        SystemSetting::set('rbac_route_permissions', '{invalid');
        $this->assertFalse($check($technician, 'GET', '/api/network-nodes'));
    }

    public function test_users_cannot_access_other_peoples_calls_or_personal_notifications(): void
    {
        $caller = $this->user('Teknisi Jointer');
        $receiver = $this->user('Customer Service');
        $stranger = $this->user();
        $call = VoiceCall::create(['caller_id' => $caller->id, 'receiver_id' => $receiver->id, 'status' => 'ringing', 'sdp_offer' => 'private']);
        $foreignToken = $stranger->createToken('foreign')->plainTextToken;
        $this->freshClient($foreignToken)->getJson('/api/calls/'.$call->id.'/poll')->assertForbidden();
        $this->freshClient($foreignToken)->postJson('/api/calls/'.$call->id.'/answer', ['sdp_answer' => 'hijack'])->assertForbidden();
        $this->freshClient($foreignToken)->postJson('/api/calls/'.$call->id.'/end')->assertForbidden();
        $this->freshClient($foreignToken)->postJson('/api/calls/'.$call->id.'/ice-candidate', ['candidate' => 'hijack', 'role' => 'caller'])->assertForbidden();
        $callerToken = $caller->createToken('caller')->plainTextToken;
        $this->freshClient($callerToken)->postJson('/api/calls/'.$call->id.'/answer', ['sdp_answer' => 'wrong'])->assertForbidden();
        $this->freshClient($callerToken)->postJson('/api/calls/'.$call->id.'/ice-candidate', ['candidate' => 'own', 'role' => 'receiver'])->assertOk();
        $this->assertSame(['own'], $call->fresh()->caller_ice);
        $this->assertEmpty($call->fresh()->receiver_ice);
        $this->freshClient($receiver->createToken('receiver')->plainTextToken)
            ->postJson('/api/calls/'.$call->id.'/answer', ['sdp_answer' => 'valid'])->assertOk();
        $notification = AppNotification::create(['user_id' => $receiver->id, 'title' => 'Private', 'body' => 'Private']);
        $this->freshClient($foreignToken)->deleteJson('/api/notifications/'.$notification->id)->assertNotFound();
        $this->assertDatabaseHas('system_notifications', ['id' => $notification->id, 'deleted_at' => null]);
    }

    public function test_browser_login_requires_csrf_and_uses_session_without_exposing_a_bearer_token(): void
    {
        $this->app->bind(ValidateCsrfToken::class, EnforcedCsrfForTest::class);
        $user = $this->user();
        $credentials = ['username' => $user->username, 'password' => 'secret123'];
        $this->withHeader('Origin', 'http://localhost')->postJson('/api/auth/login', $credentials)->assertStatus(419);
        $this->withSession(['_token' => 'csrf-test'])->withHeaders(['Origin' => 'http://localhost', 'X-CSRF-TOKEN' => 'csrf-test'])
            ->postJson('/api/auth/login', $credentials)->assertOk()->assertJsonPath('token', null);
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertSame($user->id, session(Auth::guard('web')->getName()));
        $this->assertNotEmpty(session('password_hash_web'));
        $this->getJson('/api/auth/me')->assertJsonPath('user.id', $user->id);
        $this->withHeader('X-CSRF-TOKEN', session()->token())->postJson('/api/auth/logout')->assertOk();
        $this->assertGuest('web');
    }

    public function test_csrf_endpoint_provides_secure_cookie_flags_and_browser_password_change_invalidates_database_session(): void
    {
        config(['session.driver' => 'database', 'session.secure' => true]);
        $this->app->bind(ValidateCsrfToken::class, EnforcedCsrfForTest::class);
        $csrf = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $sessionCookie = $csrf->getCookie(config('session.cookie'), false);
        $xsrfCookie = $csrf->getCookie('XSRF-TOKEN', false);
        $this->assertNotNull($sessionCookie);
        $this->assertTrue($sessionCookie->isHttpOnly());
        $this->assertTrue($sessionCookie->isSecure());
        $this->assertFalse($xsrfCookie->isHttpOnly());
        $this->assertSame('lax', $sessionCookie->getSameSite());
        $user = $this->user();
        $this->withUnencryptedCookie(config('session.cookie'), $sessionCookie->getValue())
            ->withHeaders(['Origin' => 'http://localhost', 'X-XSRF-TOKEN' => $xsrfCookie->getValue()])
            ->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'secret123'])
            ->assertOk()->assertJsonPath('token', null);
        $this->assertDatabaseHas('sessions', ['user_id' => $user->id]);
        $this->withHeader('X-CSRF-TOKEN', session()->token())->putJson('/api/auth/profile', [
            'password' => 'updated123', 'old_password' => 'secret123',
        ])->assertOk();
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);
        $this->assertGuest('web');
        $this->assertTrue(Hash::check('updated123', $user->fresh()->password));
    }
}

class EnforcedCsrfForTest extends ValidateCsrfToken
{
    protected function runningUnitTests() { return false; }
}
