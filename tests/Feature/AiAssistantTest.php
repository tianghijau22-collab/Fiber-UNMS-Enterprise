<?php

namespace Tests\Feature;

use App\Http\Controllers\AiAssistantController;
use App\Models\{AiChatMessage, OltDevice, SystemSetting, User};
use App\Services\{AiAssistantAccess, AiAssistantData, AiAssistantService, AiProviderSecrets};
use App\Services\Olt\{OnuTelemetrySample, ZteOnuIdentityMap};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Cache, DB, Http, Schema};
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        config(['app.key' => 'base64:'.base64_encode(str_repeat('k', 32))]);
        Http::preventStrayRequests();
        Schema::create('users', function (Blueprint $t) { $t->id(); $t->string('name'); $t->string('email')->nullable(); $t->string('password')->nullable(); $t->string('role'); $t->string('status'); $t->timestamps(); });
        Schema::create('system_settings', function (Blueprint $t) { $t->id(); $t->string('key')->unique(); $t->text('value'); $t->timestamps(); });
        Schema::create('customers', function (Blueprint $t) { $t->id(); $t->string('name'); $t->string('customer_number'); $t->string('phone')->nullable(); $t->string('address')->nullable(); $t->string('status'); $t->softDeletes(); });
        Schema::create('service_packages', function (Blueprint $t) { $t->id(); $t->string('name'); });
        Schema::create('customer_services', function (Blueprint $t) { $t->id(); $t->integer('customer_id'); $t->integer('service_package_id')->nullable(); $t->string('service_number'); $t->string('onu_serial'); $t->string('pppoe_username')->nullable(); $t->string('status'); $t->softDeletes(); });
        Schema::create('network_nodes', function (Blueprint $t) { $t->id(); $t->string('name'); $t->string('code'); $t->string('node_type'); $t->string('status'); $t->integer('parent_node_id')->nullable(); $t->integer('olt_device_id')->nullable(); $t->string('olt_port_ref')->nullable(); $t->integer('total_ports')->default(8); $t->integer('used_ports')->default(0); $t->softDeletes(); });
        Schema::create('network_ports', function (Blueprint $t) { $t->id(); $t->integer('node_id'); $t->integer('customer_service_id')->nullable(); $t->integer('port_number'); $t->string('status'); $t->string('customer_name_cache')->nullable(); });
        Schema::create('ont_registrations', function (Blueprint $t) { $t->id(); $t->integer('customer_service_id'); $t->integer('olt_port_id')->nullable(); $t->string('onu_serial'); $t->string('onu_mac')->nullable(); $t->string('status'); $t->float('rx_power')->nullable(); $t->timestamp('last_online_at')->nullable(); $t->softDeletes(); });
        Schema::create('olt_devices', function (Blueprint $t) { $t->id(); $t->string('name'); $t->string('vendor_key'); $t->string('connection_mode'); $t->string('status'); $t->json('last_telemetry_snapshot')->nullable(); $t->timestamps(); });
        Schema::create('tickets', function (Blueprint $t) { $t->id(); $t->string('ticket_number'); $t->string('title'); $t->string('status'); $t->string('priority')->nullable(); $t->string('category')->nullable(); $t->integer('customer_id')->nullable(); $t->integer('network_node_id')->nullable(); $t->string('technician_name')->nullable(); $t->timestamps(); });
        (require database_path('migrations/2026_10_22_000001_create_ai_chat_messages_table.php'))->up();
        DB::table('users')->insert([
            ['id' => 1, 'name' => 'Admin Fixture', 'role' => 'Super Administrator', 'status' => 'Active'],
            ['id' => 2, 'name' => 'Finance Fixture', 'role' => 'Finance & Billing', 'status' => 'Active'],
            ['id' => 3, 'name' => 'Inactive Fixture', 'role' => 'Super Administrator', 'status' => 'Inactive'],
        ]);
        DB::table('network_nodes')->insert(['id' => 1, 'name' => 'ODP Contoh', 'code' => 'ODP-1', 'node_type' => 'ODP', 'status' => 'active', 'olt_device_id' => 1]);
        $rows = [];
        foreach ([1, 2, 3] as $id) {
            DB::table('customers')->insert(['id' => $id, 'name' => 'Pelanggan '.$id, 'customer_number' => 'CUST-'.$id, 'phone' => 'PRIVATE_PHONE', 'address' => 'PRIVATE_ADDRESS', 'status' => 'active']);
            DB::table('customer_services')->insert(['id' => $id, 'customer_id' => $id, 'service_number' => 'SVC-'.$id, 'onu_serial' => 'TEST0000000'.$id, 'pppoe_username' => 'PRIVATE_PPPOE', 'status' => 'active']);
            DB::table('network_ports')->insert(['id' => $id, 'node_id' => 1, 'customer_service_id' => $id, 'port_number' => $id, 'status' => 'used']);
            DB::table('ont_registrations')->insert(['id' => $id, 'customer_service_id' => $id, 'onu_serial' => 'TEST0000000'.$id, 'status' => $id === 2 ? 'inactive' : 'active', 'rx_power' => $id === 2 ? -40 : -20, 'last_online_at' => '2020-01-01 00:00:00']);
            $at = $id === 3 ? now()->subHour()->toIso8601String() : now()->toIso8601String();
            $rows[] = ['_source' => 'live_snmp', 'identity_source' => ZteOnuIdentityMap::SOURCE, 'identity_observed_at' => now()->toIso8601String(), 'port' => 'gpon-olt_1/1/1', 'onu_id' => (string)$id, 'serial_number' => 'TEST0000000'.$id,
                ...OnuTelemetrySample::normalize(['status' => $id === 2 ? 'Offline' : 'Online', 'rx_power' => $id === 2 ? null : -22], $at)];
        }
        DB::table('olt_devices')->insert(['id' => 1, 'name' => 'OLT Fixture', 'vendor_key' => 'zte-c300', 'connection_mode' => 'live', 'status' => 'active', 'last_telemetry_snapshot' => json_encode(['onu_list' => $rows])]);
        DB::table('tickets')->insert([
            ['id' => 1, 'ticket_number' => 'TK-1', 'title' => 'Fixture 1', 'status' => 'Open', 'created_at' => now()],
            ['id' => 2, 'ticket_number' => 'TK-2', 'title' => 'Fixture 2', 'status' => 'In Progress', 'created_at' => now()],
            ['id' => 3, 'ticket_number' => 'TK-3', 'title' => 'Fixture 3', 'status' => 'Resolved', 'created_at' => now()],
        ]);
    }

    private function admin(): User { return User::findOrFail(1); }
    private function service(): AiAssistantService { return new AiAssistantService; }
    private function closedPermissions(): void
    {
        $map = [];
        foreach (\App\Http\Controllers\UserController::getDefaultRoutePermissions() as $page => $_) $map[$page] = [];
        SystemSetting::set('rbac_route_permissions', json_encode($map));
    }

    public function test_data_tools_and_offline_router_inherit_denied_permissions(): void
    {
        $this->closedPermissions(); $s = $this->service(); $user = User::find(2);
        foreach (['search_customer', 'check_optical_power', 'search_network_node', 'list_critical_attenuations', 'list_maintenance_nodes', 'get_network_summary', 'get_recent_tickets'] as $tool) {
            $this->assertSame('forbidden', $s->executeTool($tool, ['query' => 'Pelanggan'], $user)['status']);
        }
        $answer = $s->handleOfflineQuery('Halo, ringkasan jaringan', $user);
        $this->assertStringContainsString('izin', $answer['reply']);
        $this->assertSame('forbidden', $s->executeTool('get_network_summary', [], null)['status']);
        $this->assertSame('forbidden', $s->executeTool('get_network_summary', [], User::find(3))['status']);
        Http::assertNothingSent();
    }

    public function test_preflight_rejects_forbidden_intent_without_cloud_request(): void
    {
        $this->closedPermissions();
        $r = $this->service()->chat('cari pelanggan Pelanggan 1', [], User::find(2));
        $this->assertSame('forbidden', $r['fallback_reason']); Http::assertNothingSent();
    }

    public function test_snapshot_power_is_never_replaced_by_legacy_registration_values(): void
    {
        $s = $this->service();
        $online = $s->toolCheckOpticalPower('SVC-1'); $offline = $s->toolCheckOpticalPower('SVC-2'); $stale = $s->toolCheckOpticalPower('SVC-3');
        $this->assertSame('-22.00 dBm', $online['rx_power']); $this->assertNotSame($online['last_online_at'], $online['sampled_at']);
        foreach ([$offline, $stale] as $r) { $this->assertSame('N/A', $r['rx_power']); $this->assertNull($r['rx_power_dbm']); $this->assertSame('Offline', $r['ont_status']); }
        $this->assertSame('stale', $stale['telemetry_freshness']);
        $this->assertArrayNotHasKey('customer_phone', $online);
        Http::assertNothingSent();
    }

    public function test_customer_and_node_tools_use_the_same_power_and_omit_private_contact_details(): void
    {
        $s = $this->service(); $customers = $s->toolSearchCustomer('Pelanggan'); $nodes = $s->toolSearchNetworkNode('ODP Contoh');
        $this->assertCount(3, $customers['data']); $this->assertSame('N/A', $customers['data'][1]['rx_power']);
        $this->assertStringNotContainsString('PRIVATE_', json_encode($customers));
        $this->assertSame('N/A', $nodes['data'][0]['connected_customers'][1]['rx_power']);
        $this->assertSame(3, $nodes['data'][0]['used_ports']);
    }

    public function test_summary_and_critical_counts_include_missing_rx_without_claiming_all_clear(): void
    {
        DB::enableQueryLog(); DB::flushQueryLog(); $s = $this->service();
        $summary = $s->toolGetNetworkSummary(); $critical = $s->toolListCriticalAttenuations();
        $this->assertSame(3, $summary['ont_total']); $this->assertSame(1, $summary['ont_online']);
        $this->assertSame(1, $summary['ont_los']); $this->assertSame(1, $summary['ont_offline']);
        $this->assertSame(1, $summary['ont_unverified']); $this->assertSame(2, $summary['open_tickets']);
        $this->assertSame(2, $critical['total_detected']); $this->assertSame('N/A', $critical['critical_list'][0]['rx_power']);
        $this->assertStringNotContainsString('Seluruh sambungan', json_encode($critical));
        $writes = array_filter(DB::getQueryLog(), fn ($q) => preg_match('/^\s*(update|insert|delete)\b/i', $q['query']));
        $this->assertSame([], array_values($writes));
    }

    public function test_ticket_filters_match_existing_status_values(): void
    {
        $this->assertSame('TK-1', $this->service()->toolGetRecentTickets('open')['tickets'][0]['ticket_number']);
        $this->assertSame('TK-3', $this->service()->toolGetRecentTickets('resolved')['tickets'][0]['ticket_number']);
    }

    public function test_ambiguous_serial_requires_explicit_service_selection(): void
    {
        DB::table('ont_registrations')->where('id', 2)->update(['onu_serial' => 'TEST00000001']);
        DB::table('customer_services')->where('id', 2)->update(['onu_serial' => 'TEST00000001']);
        $r = $this->service()->toolCheckOpticalPower('TEST00000001');
        $this->assertSame('ambiguous', $r['status']); $this->assertCount(2, $r['candidates']);
        $this->assertSame('success', $this->service()->toolCheckOpticalPower('SVC-1')['status']);
    }

    public function test_tool_arguments_are_bounded_before_queries(): void
    {
        foreach ([['limit' => -1], ['limit' => 100000], ['threshold_dbm' => 50]] as $args) $this->assertSame('invalid_arguments', $this->service()->executeTool('list_critical_attenuations', $args, $this->admin())['status']);
        $this->assertSame('invalid_arguments', $this->service()->executeTool('search_customer', ['query' => ' '], $this->admin())['status']);
    }

    public function test_groq_accepts_both_history_formats_and_never_forwards_client_system_roles(): void
    {
        Http::fake(['*' => Http::response(['choices' => [['message' => ['role' => 'assistant', 'content' => 'Jawaban contoh']]]])]);
        $history = [['role' => 'system', 'content' => 'UNTRUSTED_SYSTEM'], ['role' => 'user', 'parts' => [['text' => 'Konteks sebelumnya']]], ['role' => 'assistant', 'content' => 'Balasan sebelumnya']];
        $r = $this->service()->chatOpenAiCompatible('https://mock.example.test/v1', 'fake-key', 'fixture', 'lanjut', $history, $this->admin());
        $this->assertSame('cloud', $r['mode']);
        Http::assertSent(fn ($q) => count($q['messages']) === 4 && str_contains(json_encode($q['messages']), 'Konteks sebelumnya') && !str_contains(json_encode($q['messages']), 'UNTRUSTED_SYSTEM'));
        $this->assertSame([], $r['history']);
    }

    public function test_unauthorized_tool_requested_by_provider_returns_only_a_permission_error(): void
    {
        $this->closedPermissions();
        Http::fake(['*' => Http::sequence()->push(['choices' => [['message' => ['role' => 'assistant', 'tool_calls' => [['id' => 'call1', 'type' => 'function', 'function' => ['name' => 'search_customer', 'arguments' => '{"query":"Pelanggan"}']]]]]]])->push(['choices' => [['message' => ['role' => 'assistant', 'content' => 'Akses dibatasi']]]])]);
        $r = $this->service()->chatOpenAiCompatible('https://mock.example.test/v1', 'fake-key', 'fixture', 'jelaskan', [], User::find(2));
        $this->assertSame('cloud', $r['mode']);
        Http::assertSent(fn ($q) => isset($q['messages'][3]) && $q['messages'][3]['role'] === 'tool' && str_contains($q['messages'][3]['content'], 'forbidden') && !str_contains($q['messages'][3]['content'], 'PRIVATE_'));
        Http::assertSent(fn ($q) => !isset($q['tools']));
    }

    public function test_gemini_empty_arguments_and_multiple_responses_keep_wire_objects_separate(): void
    {
        SystemSetting::set('gemini_api_key', 'FAKE_GEMINI_KEY');
        Http::fake(['*' => Http::sequence()->push(json_decode('{"candidates":[{"content":{"parts":[{"functionCall":{"id":"one","name":"get_network_summary","args":{}},"thoughtSignature":"fixture"},{"functionCall":{"id":"two","name":"get_recent_tickets","args":{}}}]}}]}', true))->push(['candidates' => [['content' => ['parts' => [['text' => 'Ringkasan contoh']]]]]])]);
        $r = $this->service()->chatGemini('ringkasan jaringan', [], $this->admin());
        $this->assertSame('cloud', $r['mode']); $this->assertCount(2, $r['tools_used']);
        Http::assertSent(fn ($q) => isset($q['contents'][2]) && $q['contents'][1]['parts'][0]['functionCall']['args'] instanceof \stdClass && count($q['contents'][2]['parts']) === 2 && $q['contents'][1]['parts'][0]['thoughtSignature'] === 'fixture');
    }

    public function test_rate_limit_falls_back_with_truthful_state_and_shared_cooldown(): void
    {
        Http::fake(['*' => Http::response(['error' => ['message' => 'quota']], 429)]);
        $s = $this->service();
        $first = $s->chatOpenAiCompatible('https://mock.example.test/v1', 'fake-key', 'fixture', 'Halo, ringkasan jaringan', [], $this->admin());
        $second = $s->chatOpenAiCompatible('https://mock.example.test/v1', 'fake-key', 'fixture', 'ringkasan jaringan', [], $this->admin());
        $this->assertSame('local_fallback', $first['mode']); $this->assertSame('degraded', $first['provider_state']);
        $this->assertSame('rate_limited', $first['fallback_reason']); $this->assertSame('provider_cooldown', $second['fallback_reason']);
        $this->assertStringContainsString('ONU: 3', $first['reply']); Http::assertSentCount(1);
    }

    public function test_no_implicit_global_model_change_on_provider_error(): void
    {
        SystemSetting::set('groq_model', 'chosen-model'); Http::fake(['*' => Http::response([], 404)]);
        $this->service()->chatOpenAiCompatible('https://mock.example.test/v1', 'fake-key', 'chosen-model', 'halo', [], $this->admin());
        $this->assertSame('chosen-model', SystemSetting::get('groq_model'));
    }

    public function test_history_returns_latest_hundred_in_order_and_is_user_scoped(): void
    {
        for ($i = 1; $i <= 110; $i++) AiChatMessage::create(['user_id' => 1, 'role' => 'user', 'content' => 'message-'.$i]);
        AiChatMessage::create(['user_id' => 2, 'role' => 'user', 'content' => 'PRIVATE_OTHER_USER']);
        $r = $this->actingAs($this->admin())->getJson('/api/ai-assistant/history')->assertOk();
        $this->assertCount(100, $r['messages']); $this->assertSame('message-11', $r['messages'][0]['content']); $this->assertSame('message-110', $r['messages'][99]['content']);
        $this->assertStringNotContainsString('PRIVATE_OTHER_USER', $r->getContent());
    }

    public function test_chat_uses_only_server_owned_history_and_does_not_return_tool_payloads(): void
    {
        AiChatMessage::create(['user_id' => 1, 'role' => 'user', 'content' => 'SERVER_HISTORY']);
        AiChatMessage::create(['user_id' => 2, 'role' => 'user', 'content' => 'OTHER_USER_HISTORY']);
        $capture = new AiHistoryCapture; $this->app->instance(AiAssistantService::class, $capture);
        $r = $this->actingAs($this->admin())->postJson('/api/ai-assistant/chat', ['message' => 'lanjut', 'history' => [['role' => 'user', 'content' => 'CLIENT_FORGED_HISTORY']]])->assertOk();
        $this->assertSame([['role' => 'user', 'content' => 'SERVER_HISTORY']], $capture->history); $this->assertSame([], $r['history']);
        $this->assertSame(3, AiChatMessage::where('user_id', 1)->count());
    }

    public function test_history_rejects_system_roles_and_unbounded_arrays(): void
    {
        $this->actingAs($this->admin())->postJson('/api/ai-assistant/chat', ['message' => 'tes', 'history' => [['role' => 'system', 'content' => 'fake']]])->assertUnprocessable();
        $this->postJson('/api/ai-assistant/chat', ['message' => 'tes', 'history' => array_fill(0, 7, ['role' => 'user', 'content' => 'fake'])])->assertUnprocessable();
        $this->assertSame(0, AiChatMessage::count());
    }

    public function test_clear_cannot_race_an_inflight_chat_and_never_deletes_another_user(): void
    {
        AiChatMessage::create(['user_id' => 1, 'role' => 'user', 'content' => 'A']); AiChatMessage::create(['user_id' => 2, 'role' => 'user', 'content' => 'B']);
        $lock = Cache::lock('fona_ai_user_1', 90); $this->assertTrue($lock->get());
        $this->actingAs($this->admin())->deleteJson('/api/ai-assistant/history')->assertConflict();
        $this->assertSame(2, AiChatMessage::count()); $lock->release();
        $this->deleteJson('/api/ai-assistant/history')->assertOk(); $this->assertSame(2, AiChatMessage::first()->user_id);
    }

    public function test_global_concurrency_limit_releases_user_lock_without_saving_messages(): void
    {
        $locks = [];
        for ($i = 0; $i < 3; $i++) { $locks[] = $l = Cache::lock('fona_ai_slot_'.$i, 90); $this->assertTrue($l->get()); }
        $this->actingAs($this->admin())->postJson('/api/ai-assistant/chat', ['message' => 'tes'])->assertStatus(429);
        $this->assertSame(0, AiChatMessage::count()); $l = Cache::lock('fona_ai_user_1', 90); $this->assertTrue($l->get()); $l->release();
        foreach ($locks as $lock) $lock->release();
    }

    public function test_per_user_rate_limit_is_applied(): void
    {
        $this->app->instance(AiAssistantService::class, new AiHistoryCapture);
        $this->actingAs($this->admin());
        for ($i = 0; $i < 12; $i++) $this->postJson('/api/ai-assistant/chat', ['message' => 'tes'])->assertOk();
        $this->postJson('/api/ai-assistant/chat', ['message' => 'tes'])->assertStatus(429);
    }

    public function test_secrets_are_encrypted_and_redacted_in_history_and_replies(): void
    {
        $fake = 'custom_fixture_secret_123456'; AiProviderSecrets::write('custom_ai_api_key', $fake);
        $this->assertNotSame($fake, SystemSetting::get('custom_ai_api_key')); $this->assertSame($fake, AiProviderSecrets::read('custom_ai_api_key'));
        $this->assertSame('[REDACTED_KEY]', $this->service()->redact($fake));
        $this->assertSame('[REDACTED_KEY]', AiAssistantService::sanitizeSecret('sk-proj-'.str_repeat('FAKE', 12)));
        AiChatMessage::create(['user_id' => 1, 'role' => 'assistant', 'content' => $fake]);
        $r = $this->actingAs($this->admin())->getJson('/api/ai-assistant/history')->assertOk(); $this->assertStringNotContainsString($fake, $r->getContent());
    }

    public function test_legacy_restricted_answers_are_not_displayed_or_used_as_model_context(): void
    {
        $this->closedPermissions();
        AiChatMessage::create(['user_id' => 2, 'role' => 'assistant', 'content' => 'PRIVATE_CUSTOMER_RESULT', 'tools_used' => [['tool' => 'search_customer', 'args' => ['query' => 'x']]]]);
        AiChatMessage::create(['user_id' => 2, 'role' => 'assistant', 'content' => 'PRIVATE_LEGACY_CONTEXT']);
        $capture = new AiHistoryCapture; $this->app->instance(AiAssistantService::class, $capture);
        $r = $this->actingAs(User::find(2))->getJson('/api/ai-assistant/history')->assertOk();
        $this->assertStringNotContainsString('PRIVATE_', $r->getContent());
        $this->postJson('/api/ai-assistant/chat', ['message' => 'lanjut'])->assertOk();
        $this->assertSame([], $capture->history);
        $this->assertSame('PRIVATE_CUSTOMER_RESULT', AiChatMessage::first()->content);
    }

    public function test_direct_lookup_uses_authorized_stored_data_without_cloud_or_quota(): void
    {
        $r = $this->service()->chat('Halo, cek redaman SVC-2', [], $this->admin());
        $this->assertSame('local', $r['mode']); $this->assertStringContainsString('N/A', $r['reply']);
        $this->assertStringContainsString('Waktu sampel:', $r['reply']); Http::assertNothingSent();
    }

    public function test_legacy_key_encryption_is_idempotent_and_preserves_other_settings(): void
    {
        SystemSetting::set('groq_api_key', 'legacy_fixture_secret'); SystemSetting::set('unrelated_setting', 'same');
        $this->artisan('ai:encrypt-secrets')->assertSuccessful(); $first = SystemSetting::get('groq_api_key');
        $this->assertStringStartsWith(AiProviderSecrets::PREFIX, $first); $this->assertSame('legacy_fixture_secret', AiProviderSecrets::read('groq_api_key'));
        $this->artisan('ai:encrypt-secrets')->assertSuccessful(); $this->assertSame($first, SystemSetting::get('groq_api_key')); $this->assertSame('same', SystemSetting::get('unrelated_setting'));
    }

    public function test_non_admin_cannot_read_configuration_details_or_update_settings(): void
    {
        $r = $this->actingAs(User::find(2))->getJson('/api/ai-assistant/settings')->assertOk();
        $this->assertArrayNotHasKey('custom_base_url', $r->json()); $this->assertArrayNotHasKey('groq_masked_key', $r->json());
        $this->postJson('/api/ai-assistant/settings', ['provider' => 'groq'])->assertForbidden();
    }
}

class AiHistoryCapture extends AiAssistantService
{
    public array $history = [];
    public function chat(string $userMessage, array $conversationHistory = [], ?User $user = null): array
    {
        $this->history = $conversationHistory;
        return ['reply' => 'Balasan fixture', 'mode' => 'cloud', 'provider_state' => 'available', 'is_configured' => true, 'history' => [['role' => 'tool', 'content' => 'PRIVATE_INTERNAL_PAYLOAD']]];
    }
}
