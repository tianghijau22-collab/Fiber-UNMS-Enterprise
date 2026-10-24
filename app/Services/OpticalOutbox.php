<?php

namespace App\Services;

use App\Jobs\DeliverOpticalOutbox;
use App\Jobs\PublishOpticalFaultNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OpticalOutbox
{
    public function stage(int $eventId, array $event): void
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Outbox creation requires an event transaction');
        }
        [$title, $body, $type] = PublishOpticalFaultNotification::message($event);
        $payload = ['title' => $title, 'body' => $body, 'type' => $type, 'url' => '/gis-map'];
        $this->insert($eventId, 'web', 'broadcast', null, 0, $payload);
        $targets = app(OpticalDeliveryTransport::class)->destinations();
        $this->insert($eventId, 'fcm', 'global', null, 0, $payload, $targets['fcm_configured'] ? 'pending' : 'skipped', $targets['fcm_configured'] ? null : 'fcm_not_configured');
        if (! $targets['telegram_enabled'] || ! $targets['telegram_token_present'] || ! $targets['telegram_recipients']) {
            $this->insert($eventId, 'telegram', 'unconfigured', null, 0, $payload, 'skipped', 'telegram_destination_unavailable');

            return;
        }
        $text = html_entity_decode(strip_tags($title."\n\n".$body), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = 'Insiden FONA #'.$event['incident_id']."\n".$text;
        $chunks = [];
        while (mb_strlen($text) > 3500) {
            $chunks[] = mb_substr($text, 0, 3500);
            $text = mb_substr($text, 3500);
        }
        $chunks[] = $text;
        foreach (array_unique($targets['telegram_recipients']) as $chat) {
            foreach ($chunks as $part => $chunk) {
                $this->insert($eventId, 'telegram', hash('sha256', (string) $chat), Crypt::encryptString((string) $chat), $part, [...$payload, 'text' => $chunk]);
            }
        }
    }

    private function insert(int $event, string $channel, string $key, ?string $recipient, int $part, array $payload, string $status = 'pending', ?string $reason = null): void
    {
        DB::table('monitoring_deliveries')->insertOrIgnore(['event_id' => $event, 'channel' => $channel, 'recipient_key' => $key,
            'recipient' => $recipient, 'part_index' => $part, 'payload' => json_encode($payload), 'status' => $status, 'status_reason' => $reason,
            'attempts' => 0, 'available_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
    }

    public function dispatchDue(int $limit = 100): int
    {
        $this->expireLeases();
        $ids = DB::transaction(function () use ($limit) {
            $ids = DB::table('monitoring_deliveries')->whereIn('status', ['pending', 'retry'])
                ->where('available_at', '<=', now())->where(fn ($q) => $q->whereNull('queued_at')->orWhere('queued_at', '<=', now()->subSeconds(60)))
                ->orderBy('id')->limit(max(1, min(200, $limit)))->lockForUpdate()->pluck('id')->all();
            if ($ids) {
                DB::table('monitoring_deliveries')->whereIn('id', $ids)->update(['queued_at' => now(), 'updated_at' => now()]);
            }

            return $ids;
        }, 3);
        foreach ($ids as $id) {
            DeliverOpticalOutbox::dispatch((int) $id);
        }

        return count($ids);
    }

    public function process(int $id): void
    {
        $claim = DB::transaction(function () use ($id) {
            $row = DB::table('monitoring_deliveries')->where('id', $id)->lockForUpdate()->first();
            if (! $row || ! in_array($row->status, ['pending', 'retry'], true) || ($row->available_at && Carbon::parse($row->available_at)->isFuture())) {
                return null;
            }
            $event = DB::table('monitoring_events')->find($row->event_id);
            $incident = DB::table('monitoring_incidents')->find($event->incident_id);
            $gate = $this->gate($row, $event, $incident);
            if ($gate !== null) {
                DB::table('monitoring_deliveries')->where('id', $id)->update(['status' => $gate['status'], 'status_reason' => $gate['reason'],
                    'available_at' => now()->addSeconds(20), 'queued_at' => null, 'updated_at' => now()]);

                return null;
            }
            $token = (string) Str::uuid();
            DB::table('monitoring_deliveries')->where('id', $id)->update(['status' => 'processing', 'claim_token' => $token,
                'locked_until' => now()->addSeconds(90), 'attempts' => $row->attempts + 1, 'cycle_attempts' => $row->cycle_attempts + 1, 'updated_at' => now()]);
            $row->claim_token = $token;
            $row->attempts++;
            $row->cycle_attempts++;

            return $row;
        }, 3);
        if (! $claim) {
            return;
        }
        try {
            $result = app(OpticalDeliveryTransport::class)->send($claim);
        } catch (\Throwable) {
            $result = ['status' => $claim->channel === 'web' ? 'retry' : 'uncertain', 'reason' => 'delivery_exception'];
        }
        $status = in_array($result['status'] ?? null, ['sent', 'retry', 'failed', 'uncertain', 'skipped'], true) ? $result['status'] : 'uncertain';
        if ($status === 'retry' && $claim->cycle_attempts >= 10) {
            $status = 'failed';
        }
        $delay = max(10, min(3600, (int) ($result['delay'] ?? 10 * 2 ** min(8, $claim->cycle_attempts))));
        DB::table('monitoring_deliveries')->where('id', $id)->where('claim_token', $claim->claim_token)->where('status', 'processing')->update([
            'status' => $status, 'status_reason' => $result['reason'] ?? null, 'http_status' => $result['http_status'] ?? null,
            'response_reference' => isset($result['reference']) ? mb_substr($result['reference'], 0, 160) : null,
            'available_at' => now()->addSeconds($delay), 'locked_until' => null, 'claim_token' => null, 'queued_at' => null, 'updated_at' => now(),
        ]);
    }

    private function gate(object $row, object $event, object $incident): ?array
    {
        if ($row->channel === 'web') {
            return null;
        }
        if ($event->transition === 'outage') {
            if ($incident->status !== 'active') {
                return ['status' => 'cancelled', 'reason' => 'incident_no_longer_active'];
            }
            if ($incident->condition !== 'down') {
                return ['status' => 'retry', 'reason' => 'current_evidence_not_down'];
            }
        } elseif ($event->transition === 'recovered') {
            if (DB::table('monitoring_incidents')->where('open_scope_key', $incident->scope_key)->exists()) {
                return ['status' => 'cancelled', 'reason' => 'newer_episode_active'];
            }
            $prior = DB::table('monitoring_deliveries as d')->join('monitoring_events as e', 'e.id', '=', 'd.event_id')
                ->where('e.incident_id', $incident->id)->where('e.transition', 'outage')->where('d.channel', $row->channel)->where('d.recipient_key', $row->recipient_key);
            if ((clone $prior)->where('d.status', 'processing')->exists()) {
                return ['status' => 'retry', 'reason' => 'earlier_delivery_in_progress'];
            }
            if ((clone $prior)->where('d.status', 'uncertain')->exists()) {
                return ['status' => 'uncertain', 'reason' => 'earlier_delivery_unconfirmed'];
            }
            if (! (clone $prior)->where('d.status', 'sent')->exists()) {
                return ['status' => 'skipped', 'reason' => 'outage_not_delivered_to_destination'];
            }
        }
        // All preceding parts need confirmed delivery, including after an operator retry.
        if ($row->part_index > 0) {
            $prior = DB::table('monitoring_deliveries')->where('event_id', $row->event_id)->where('channel', $row->channel)
                ->where('recipient_key', $row->recipient_key)->where('part_index', '<', $row->part_index);
            if ((clone $prior)->whereIn('status', ['failed', 'uncertain', 'cancelled', 'skipped'])->exists()) {
                return ['status' => 'retry', 'reason' => 'earlier_part_unconfirmed'];
            }
            if ((clone $prior)->where('status', '!=', 'sent')->exists()) {
                return ['status' => 'retry', 'reason' => 'earlier_part_pending'];
            }
        }

        return null;
    }

    public function expireLeases(): void
    {
        foreach (['web', 'telegram', 'fcm'] as $channel) {
            DB::table('monitoring_deliveries')->where('status', 'processing')->where('channel', $channel)
                ->where('locked_until', '<=', now())->update(['status' => $channel === 'web' ? 'retry' : 'uncertain',
                    'status_reason' => 'worker_acknowledgement_missing', 'available_at' => now(), 'queued_at' => null, 'claim_token' => null, 'locked_until' => null, 'updated_at' => now()]);
        }
    }

    public function retry(int $id, bool $acknowledgeUncertain): void
    {
        DB::transaction(function () use ($id, $acknowledgeUncertain) {
            $row = DB::table('monitoring_deliveries')->where('id', $id)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless(in_array($row->status, ['failed', 'uncertain'], true), 409, 'Pengiriman ini tidak dapat dicoba ulang.');
            abort_if($row->status === 'uncertain' && ! $acknowledgeUncertain, 409, 'Konfirmasikan risiko pesan ganda untuk pengiriman yang hasilnya belum pasti.');
            DB::table('monitoring_deliveries')->where('id', $id)->update(['status' => 'retry', 'available_at' => now(), 'queued_at' => null,
                'cycle_attempts' => 0, 'status_reason' => 'operator_retry', 'updated_at' => now()]);
        });
    }
}
