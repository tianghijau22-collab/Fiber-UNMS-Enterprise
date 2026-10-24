<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class OpticalDeliveryTransport
{
    public function destinations(): array
    {
        $enabled = in_array(SystemSetting::get('telegram_enabled', env('TELEGRAM_ENABLED', 'false')), ['true', true, '1'], true);

        return ['telegram_enabled' => $enabled, 'telegram_token_present' => ! empty(SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'))),
            'telegram_recipients' => $enabled ? TelegramService::getActiveChatIdsForTopic('NOC') : [],
            'fcm_configured' => is_file(storage_path('app/firebase-service-account.json')) || count(glob(storage_path('app/*firebase*.json')) ?: []) > 0];
    }

    public function send(object $delivery): array
    {
        $p = json_decode($delivery->payload, true, 512, JSON_THROW_ON_ERROR);
        if ($delivery->channel === 'web') {
            DB::table('system_notifications')->insertOrIgnore(['monitoring_event_id' => $delivery->event_id,
                'user_id' => null, 'type' => $p['type'], 'title' => $p['title'], 'body' => $p['body'], 'url' => $p['url'],
                'icon' => 'STORED_OPTICAL_EVIDENCE', 'is_read' => false, 'created_at' => now(), 'updated_at' => now()]);

            return ['status' => 'sent', 'reference' => (string) DB::table('system_notifications')->where('monitoring_event_id', $delivery->event_id)->value('id')];
        }
        if ($delivery->channel === 'fcm') {
            if (! $this->destinations()['fcm_configured']) {
                return ['status' => 'skipped', 'reason' => 'fcm_not_configured'];
            }
            $result = FcmService::sendTopicNotification('fona_global_alerts', $p['title'], strip_tags($p['body']), $p['type'], $p['url']);

            return ! empty($result['success']) ? ['status' => 'sent', 'reference' => (string) ($result['response']['name'] ?? '')]
                : ['status' => 'uncertain', 'reason' => 'fcm_delivery_unconfirmed'];
        }
        if ($delivery->channel !== 'telegram') {
            return ['status' => 'failed', 'reason' => 'unsupported_channel'];
        }
        if (! in_array(SystemSetting::get('telegram_enabled', env('TELEGRAM_ENABLED', 'false')), ['true', true, '1'], true)) {
            return ['status' => 'skipped', 'reason' => 'telegram_disabled'];
        }
        $token = SystemSetting::get('telegram_bot_token', env('TELEGRAM_BOT_TOKEN'));
        if (empty($token)) {
            return ['status' => 'retry', 'reason' => 'telegram_not_configured', 'delay' => 300];
        }
        try {
            $chat = Crypt::decryptString($delivery->recipient);
            $response = Http::connectTimeout(3)->timeout(8)->post('https://api.telegram.org/bot'.$token.'/sendMessage', [
                'chat_id' => $chat, 'text' => $p['text'], 'disable_web_page_preview' => true,
            ]);
            $json = $response->json();
            if ($response->successful() && ($json['ok'] ?? false) === true && isset($json['result']['message_id'])) {
                return ['status' => 'sent', 'http_status' => $response->status(), 'reference' => (string) $json['result']['message_id']];
            }
            $code = (int) ($json['error_code'] ?? $response->status());
            if ($code === 429) {
                return ['status' => 'retry', 'reason' => 'provider_rate_limited', 'http_status' => $response->status(), 'delay' => max(10, min(3600, (int) ($json['parameters']['retry_after'] ?? 60)))];
            }
            if (($json['ok'] ?? null) === false) {
                if ($code >= 500) {
                    return ['status' => 'retry', 'reason' => 'provider_rejected_temporarily', 'http_status' => $response->status()];
                }

                return ['status' => 'failed', 'reason' => 'provider_rejected', 'http_status' => $response->status()];
            }

            return ['status' => 'uncertain', 'reason' => 'provider_acknowledgement_missing', 'http_status' => $response->status()];
        } catch (ConnectionException) {
            // A timeout can occur after the provider accepted the message. Never silently resend it.
            return ['status' => 'uncertain', 'reason' => 'transport_acknowledgement_missing'];
        }
    }
}
