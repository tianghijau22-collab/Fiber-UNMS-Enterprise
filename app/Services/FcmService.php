<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    private static function getServiceAccountPath(): ?string
    {
        $primary = storage_path('app/firebase-service-account.json');
        if (file_exists($primary)) {
            return $primary;
        }

        $files = glob(storage_path('app/*firebase*.json'));
        if (!empty($files)) {
            return $files[0];
        }

        return null;
    }

    /**
     * Mendapatkan OAuth2 Access Token dari Google Service Account untuk FCM HTTP v1 API
     */
    public static function getAccessToken(): ?string
    {
        return Cache::remember('firebase_fcm_access_token', 3000, function () {
            $path = self::getServiceAccountPath();
            if (!$path || !file_exists($path)) {
                Log::warning("FCM: File service account firebase tidak ditemukan di {$path}");
                return null;
            }

            $serviceAccount = json_decode(file_get_contents($path), true);
            if (!$serviceAccount || empty($serviceAccount['private_key']) || empty($serviceAccount['client_email'])) {
                Log::error("FCM: Format file service account JSON tidak valid.");
                return null;
            }

            $now = time();
            $header = [
                'alg' => 'RS256',
                'typ' => 'JWT',
            ];

            $claim = [
                'iss'   => $serviceAccount['client_email'],
                'sub'   => $serviceAccount['client_email'],
                'aud'   => 'https://oauth2.googleapis.com/token',
                'iat'   => $now,
                'exp'   => $now + 3600,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            ];

            $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($header)));
            $base64Claim  = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($claim)));
            $signatureInput = $base64Header . '.' . $base64Claim;

            $signature = '';
            if (!openssl_sign($signatureInput, $signature, $serviceAccount['private_key'], OPENSSL_ALGO_SHA256)) {
                Log::error("FCM: Gagal menandatangani OpenSSL JWT assertion.");
                return null;
            }

            $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
            $jwt = $signatureInput . '.' . $base64Signature;

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]);

            if ($response->successful()) {
                return $response->json('access_token');
            }

            Log::error("FCM: Gagal meminta access token dari Google OAuth: " . $response->body());
            return null;
        });
    }

    /**
     * Mengambil Project ID dari Service Account JSON
     */
    public static function getProjectId(): ?string
    {
        $path = self::getServiceAccountPath();
        if (!$path || !file_exists($path)) return null;
        $data = json_decode(file_get_contents($path), true);
        return $data['project_id'] ?? null;
    }

    /**
     * Kirim Push Notification ke Seluruh Perangkat melalui Topik FCM Global
     */
    public static function sendTopicNotification(
        string $topic,
        string $title,
        string $body,
        string $type = 'BROADCAST',
        ?string $url = null,
        array $extraData = []
    ): array {
        $token = self::getAccessToken();
        $projectId = self::getProjectId();

        if (!$token || !$projectId) {
            return [
                'success' => false,
                'message' => 'Kredensial Firebase Service Account belum lengkap atau tidak valid.',
            ];
        }

        $cleanTopic = str_replace('/topics/', '', $topic);

        $payload = [
            'message' => [
                'topic' => $cleanTopic,
                'notification' => [
                    'title' => $title,
                    'body'  => $body,
                ],
                'data' => array_merge([
                    'title'        => $title,
                    'body'         => $body,
                    'type'         => $type,
                    'url'          => $url ?? '/dashboard',
                    'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                    'sent_time'    => now()->toIso8601String(),
                ], array_map('strval', $extraData)),
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => [
                        'channel_id'   => 'fona_custom_alerts_v1',
                        'sound'        => 'fona_alert',
                        'icon'         => '@mipmap/ic_launcher',
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                        'default_vibrate_timings' => true,
                    ],
                ],
            ],
        ];

        try {
            $response = Http::withToken($token)
                ->withHeaders(['Content-Type' => 'application/json; UTF-8'])
                ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", $payload);

            if ($response->successful()) {
                Log::info("FCM: Push notification berhasil disiarkan ke topik '{$cleanTopic}': {$title}");
                return [
                    'success'  => true,
                    'response' => $response->json(),
                ];
            }

            Log::error("FCM: Gagal mengirim pesan ke topik '{$cleanTopic}': " . $response->body());
            return [
                'success' => false,
                'error'   => $response->json() ?? $response->body(),
            ];
        } catch (\Exception $e) {
            Log::error("FCM Exception: " . $e->getMessage());
            return [
                'success' => false,
                'error'   => $e->getMessage(),
            ];
        }
    }

    /**
     * Kirim Push Notification ke Token Perangkat Spesifik
     */
    public static function sendToDevice(
        string $deviceToken,
        string $title,
        string $body,
        string $type = 'NOC',
        ?string $url = null,
        array $extraData = []
    ): array {
        $token = self::getAccessToken();
        $projectId = self::getProjectId();

        if (!$token || !$projectId) {
            return [
                'success' => false,
                'message' => 'Kredensial Firebase Service Account tidak ditemukan.',
            ];
        }

        $payload = [
            'message' => [
                'token' => $deviceToken,
                'notification' => [
                    'title' => $title,
                    'body'  => $body,
                ],
                'data' => array_merge([
                    'title'        => $title,
                    'body'         => $body,
                    'type'         => $type,
                    'url'          => $url ?? '/dashboard',
                    'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                    'sent_time'    => now()->toIso8601String(),
                ], array_map('strval', $extraData)),
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => [
                        'channel_id'   => 'fona_custom_alerts_v1',
                        'sound'        => 'fona_alert',
                        'icon'         => '@mipmap/ic_launcher',
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                    ],
                ],
            ],
        ];

        try {
            $response = Http::withToken($token)
                ->withHeaders(['Content-Type' => 'application/json; UTF-8'])
                ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", $payload);

            if ($response->successful()) {
                return ['success' => true, 'response' => $response->json()];
            }

            return ['success' => false, 'error' => $response->json() ?? $response->body()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
