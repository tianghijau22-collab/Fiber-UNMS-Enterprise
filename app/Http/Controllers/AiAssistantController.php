<?php

namespace App\Http\Controllers;

use App\Models\AiChatMessage;
use App\Models\AuditLog;
use App\Services\AiAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiAssistantController extends Controller
{
    protected AiAssistantService $aiService;

    public function __construct(AiAssistantService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Dapatkan riwayat percakapan privat khusus untuk user yang sedang login
     * GET /api/ai-assistant/history
     */
    public function getHistory(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $messages = AiChatMessage::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')->orderByDesc('id')
            ->take(100)
            ->get()->reverse()->values()
            ->map(function ($m) use ($user) {
                $visible = $this->aiService->historyMessageAllowed($m, $user);
                return [
                    'id'         => (string)$m->id,
                    'role'       => $m->role,
                    'content'    => $visible ? $this->aiService->redact($m->content) : 'Jawaban lama disembunyikan karena izin data tidak tersedia atau belum dapat diverifikasi.',
                    'tools_used' => $visible ? json_decode($this->aiService->redact(json_encode($m->tools_used ?? [], JSON_INVALID_UTF8_SUBSTITUTE)), true) : [],
                    'timestamp'  => $m->created_at->format('H:i'),
                ];
            });

        return response()->json([
            'status'   => 'success',
            'messages' => $messages,
        ]);
    }

    /**
     * Bersihkan riwayat percakapan privat milik user yang sedang login
     * DELETE /api/ai-assistant/history
     */
    public function clearHistory(Request $request)
    {
        $user = $request->user();
        abort_unless($user, 401);
        $lock = \Illuminate\Support\Facades\Cache::lock('fona_ai_user_'.$user->id, 90);
        if (!$lock->get()) return response()->json(['status' => 'busy', 'message' => 'Percakapan masih diproses. Tunggu selesai sebelum menghapus riwayat.'], 409);
        try { AiChatMessage::where('user_id', $user->id)->delete(); }
        finally { $lock->release(); }
        return response()->json(['status' => 'success', 'message' => 'Riwayat percakapan Anda berhasil dibersihkan.']);
    }

    /**
     * Kirim percakapan ke FONA AI Copilot
     * POST /api/ai-assistant/chat
     */
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'history' => 'nullable|array|max:6',
            'history.*' => 'array:role,content,parts',
            'history.*.role' => 'required|in:user,assistant,model',
            'history.*.content' => 'sometimes|string|max:12000',
            'history.*.parts' => 'sometimes|array|max:1',
            'history.*.parts.*' => 'array:text',
            'history.*.parts.*.text' => 'required|string|max:12000',
        ]);
        $user = $request->user();
        abort_unless($user, 401);
        $message = trim($validated['message']);
        abort_if($message === '', 422, 'Pesan tidak boleh kosong.');
        $cache = \Illuminate\Support\Facades\Cache::class;
        $userLock = $cache::lock('fona_ai_user_'.$user->id, 90);
        if (!$userLock->get()) return response()->json(['status' => 'busy', 'message' => 'Pesan Anda sebelumnya masih diproses.'], 409);
        $slot = null;
        try {
            for ($i = 0; $i < 3; $i++) {
                $candidate = $cache::lock('fona_ai_slot_'.$i, 90);
                if ($candidate->get()) { $slot = $candidate; break; }
            }
            if (!$slot) return response()->json(['status' => 'busy', 'message' => 'Asisten sedang melayani permintaan lain. Coba lagi sebentar.'], 429)->header('Retry-After', '10');
            // Client history is validated for compatibility, but server-owned history is authoritative.
            $past = AiChatMessage::where('user_id', $user->id)->orderByDesc('created_at')->orderByDesc('id')->limit(6)->get()->reverse()->values()
                ->filter(fn ($m) => $this->aiService->historyMessageAllowed($m, $user));
            $history = $past->map(fn ($m) => ['role' => $m->role, 'content' => $this->aiService->redact($m->content)])->values()->all();
            $contextTools = $past->flatMap(fn ($m) => $m->tools_used ?? [])->all();
            $userRecord = AiChatMessage::create(['user_id' => $user->id, 'role' => 'user', 'content' => $this->aiService->redact($message)]);
            try { $result = $this->aiService->chat($message, $history, $user); }
            catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('AI chat failed', ['exception_type' => get_class($e)]);
                $result = ['reply' => 'Asisten belum dapat memproses pesan ini. Coba lagi sebentar.', 'mode' => 'unavailable', 'provider_state' => 'unavailable', 'fallback_reason' => 'processing_failed'];
            }
            $reply = $this->aiService->redact($result['reply'] ?? 'Belum ada balasan.');
            $dependencies = collect(array_merge($contextTools, $result['tools_used'] ?? []))->unique(fn ($tool) => $tool['tool'] ?? '')->values()->all();
            $tools = json_decode($this->aiService->redact(json_encode($dependencies, JSON_INVALID_UTF8_SUBSTITUTE)), true);
            $assistantRecord = AiChatMessage::create(['user_id' => $user->id, 'role' => 'assistant', 'content' => $reply, 'tools_used' => $tools]);
            return response()->json([
                'status' => 'success', 'reply' => $reply, 'tools_used' => $tools, 'history' => [],
                'is_configured' => $result['is_configured'] ?? $this->aiService->isConfigured(),
                'mode' => $result['mode'] ?? 'unavailable', 'provider_state' => $result['provider_state'] ?? 'unknown',
                'fallback_reason' => $result['fallback_reason'] ?? null,
                'user_msg_id' => $userRecord->id, 'assistant_msg_id' => $assistantRecord->id,
            ]);
        } finally { $slot?->release(); $userLock->release(); }
    }

    /**
     * Dapatkan status konfigurasi AI Assistant
     * GET /api/ai-assistant/settings
     */
    public function getSettings(Request $request)
    {
        $provider = $this->aiService->getProvider();
        $isConfigured = $this->aiService->isConfigured();

        $maskKey = function (?string $key) {
            if (empty($key)) return null;
            $len = strlen($key);
            return $len > 8
                ? substr($key, 0, 6) . str_repeat('•', max(4, $len - 10)) . substr($key, -4)
                : '••••••••';
        };

        if ($request->user()?->role !== 'Super Administrator') return response()->json([
            'status' => 'success', 'provider' => $provider, 'is_configured' => $isConfigured, 'provider_state' => 'unverified', 'can_edit' => false,
        ]);
        $geminiKey = $this->aiService->getApiKey();
        $groqKey = $this->aiService->getGroqApiKey();
        $customKey = $this->aiService->getCustomApiKey();

        return response()->json([
            'status'            => 'success',
            'provider'          => $provider,
            'is_configured'     => $isConfigured,
            'gemini_masked_key' => $maskKey($geminiKey),
            'gemini_model'      => $this->aiService->getModel(),
            'groq_masked_key'   => $maskKey($groqKey),
            'groq_model'        => $this->aiService->getGroqModel(),
            'custom_base_url'   => $this->aiService->getCustomBaseUrl(),
            'custom_masked_key' => $maskKey($customKey),
            'custom_model'      => $this->aiService->getCustomModel(),
            // Backward compatibility
            'masked_key'        => $maskKey($provider === 'groq' ? $groqKey : ($provider === 'openai_custom' ? $customKey : $geminiKey)),
            'model'             => $provider === 'groq' ? $this->aiService->getGroqModel() : ($provider === 'openai_custom' ? $this->aiService->getCustomModel() : $this->aiService->getModel()),
            'provider_state'    => 'unverified',
            'can_edit'          => $request->user()?->role === 'Super Administrator',
        ]);
    }

    /**
     * Perbarui API Key dan Model AI Assistant
     * POST /api/ai-assistant/settings
     */
    public function updateSettings(Request $request)
    {
        $user = $request->user();
        if ($user?->role !== 'Super Administrator') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Hanya Super Administrator yang berhak mengubah konfigurasi API AI.',
            ], 403);
        }

        $validated = $request->validate([
            'provider'        => 'nullable|string|in:gemini,groq,openai_custom',
            // Gemini
            'api_key'         => 'nullable|string|max:255',
            'gemini_api_key'  => 'nullable|string|max:255',
            'model'           => 'nullable|string|max:50',
            'gemini_model'    => 'nullable|string|max:50',
            // Groq
            'groq_api_key'    => 'nullable|string|max:255',
            'groq_model'      => 'nullable|string|max:50',
            // Custom / 9Router
            'custom_base_url' => ['nullable', 'url:http,https', 'max:255', function ($attribute, $value, $fail) {
                $url = parse_url($value);
                if (!$url || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])) $fail('URL AI tidak boleh memuat kredensial, query, atau fragmen.');
                if (($url['scheme'] ?? '') === 'http' && !in_array($url['host'] ?? '', ['localhost', '127.0.0.1', '[::1]', '::1'], true)) $fail('Endpoint HTTP hanya diizinkan untuk layanan lokal. Gunakan HTTPS untuk server lain.');
            }],
            'custom_api_key'  => 'nullable|string|max:255',
            'custom_model'    => 'nullable|string|max:50',
        ]);

        $provider = $validated['provider'] ?? $this->aiService->getProvider();
        $settingsToSave = ['provider' => $provider];

        if ($provider === 'groq') {
            $groqKey = trim($validated['groq_api_key'] ?? '');
            $groqModel = trim($validated['groq_model'] ?? $this->aiService->getGroqModel());


            if (!empty($groqKey)) {
                // Verifikasi Kunci API Groq
                try {
                    $res = Http::withToken($groqKey)->connectTimeout(4)->timeout(10)->withoutRedirecting()->get('https://api.groq.com/openai/v1/models');
                    if (!$res->successful()) {
                        $err = $res->json()['error']['message'] ?? 'Kunci API Groq tidak valid atau ditolak.';
                        return response()->json([
                            'status'  => 'error',
                            'message' => 'Verifikasi Groq Cloud ditolak. Periksa kunci dan izin akun provider.',
                        ], 422);
                    }
                } catch (\Throwable $e) {
                    return response()->json([
                        'status'  => 'error',
                        'message' => 'Server Groq Cloud belum dapat dihubungi. Konfigurasi belum disimpan.',
                    ], 422);
                }
                $settingsToSave['groq_api_key'] = $groqKey;
            }
            if (!empty($groqModel)) {
                $settingsToSave['groq_model'] = $groqModel;
            }
        } elseif ($provider === 'openai_custom') {
            $customUrl = trim($validated['custom_base_url'] ?? '');
            $customKey = trim($validated['custom_api_key'] ?? '');
            $customModel = trim($validated['custom_model'] ?? $this->aiService->getCustomModel());

            if (!empty($customUrl)) {
                $settingsToSave['custom_base_url'] = $customUrl;
            }
            if ($customKey !== '') {
                $settingsToSave['custom_api_key'] = $customKey;
            }
            if (!empty($customModel)) {
                $settingsToSave['custom_model'] = $customModel;
            }
        } else {
            // Google Gemini
            $apiKey = trim($validated['gemini_api_key'] ?? ($validated['api_key'] ?? ''));
            $model = trim($validated['gemini_model'] ?? ($validated['model'] ?? $this->aiService->getModel()));


            if (!empty($apiKey)) {
                // Uji coba singkat kunci API ke endpoint Gemini models via HTTP Header (tanpa query param untuk keamanan)
                try {
                    $testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model);
                    $res = Http::withHeaders(['x-goog-api-key' => $apiKey])->connectTimeout(4)->timeout(10)->withoutRedirecting()->get($testUrl);
                    if (!$res->successful()) {
                        $err = $res->json()['error']['message'] ?? 'Kunci API tidak valid atau tidak memiliki izin akses.';
                        return response()->json([
                            'status'  => 'error',
                            'message' => 'Verifikasi Google Gemini ditolak. Periksa kunci, model, dan izin akun provider.',
                        ], 422);
                    }
                } catch (\Throwable $e) {
                    return response()->json([
                        'status'  => 'error',
                        'message' => 'Server Google Gemini belum dapat dihubungi. Konfigurasi belum disimpan.',
                    ], 422);
                }

                $settingsToSave['gemini_api_key'] = $apiKey;
            }
            if (!empty($model)) {
                $settingsToSave['gemini_model'] = $model;
            }
        }

        $this->aiService->saveSettings($settingsToSave);

        // Jangan pernah simpan API Key mentah ke dalam audit log
        $auditDetails = $settingsToSave;
        foreach (['gemini_api_key', 'groq_api_key', 'custom_api_key'] as $k) {
            if (isset($auditDetails[$k])) {
                $auditDetails[$k] = '[REDACTED]';
            }
        }

        AuditLog::record(
            'UPDATE',
            'Pengaturan Sistem',
            "Memperbarui konfigurasi FONA AI Copilot (Provider: {$provider})",
            null,
            $auditDetails
        );

        return response()->json([
            'status'   => 'success',
            'message'  => "Konfigurasi FONA AI Copilot ({$provider}) berhasil disimpan. Status koneksi diperiksa saat digunakan.",
            'provider' => $provider,
        ]);
    }
}
