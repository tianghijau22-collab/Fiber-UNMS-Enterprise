<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OpticalIncidentStore
{
    public const CHECKPOINT = 'optical-fault-evaluation';

    private array $active = [];

    public function transaction(callable $callback): mixed
    {
        $projection = null;
        $result = DB::transaction(function () use ($callback, &$projection) {
            // The database lock remains authoritative even if Redis is flushed or a cache lease expires.
            $seed = Cache::get(OpticalFaultLocalizationService::STATE_KEY, ['records' => [], 'evaluated_at' => 0]);
            if (! is_array($seed)) {
                $seed = [];
            }
            $seed['records'] = is_array($seed['records'] ?? null) ? $seed['records'] : [];
            foreach ($seed['records'] as &$record) {
                unset($record['pending_notification']);
            }
            unset($record);
            DB::table('monitoring_checkpoints')->insertOrIgnore(['name' => self::CHECKPOINT, 'payload' => json_encode($seed), 'updated_at' => now()]);
            $row = DB::table('monitoring_checkpoints')->where('name', self::CHECKPOINT)->lockForUpdate()->first();
            $state = json_decode($row->payload, true, 512, JSON_THROW_ON_ERROR);
            $this->active = DB::table('monitoring_incidents')->whereNotNull('open_scope_key')->get()->keyBy('scope_key')->all();
            $result = $callback($state);
            DB::table('monitoring_checkpoints')->where('name', self::CHECKPOINT)->update(['payload' => json_encode($state, JSON_THROW_ON_ERROR), 'updated_at' => now()]);
            $projection = $state;

            return $result;
        }, 3);
        // Redis is only a compatibility/display projection. Its failure cannot roll back a committed event.
        try {
            Cache::forever(OpticalFaultLocalizationService::STATE_KEY, $projection);
        } catch (\Throwable) {
        }

        return $result;
    }

    public function observe(string $key, ?array $previous, array &$record, ?string $at, array $clients, ?string $transition, bool $suppressed): void
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Incident observation requires a database transaction');
        }
        $incident = $this->active[$key] ?? null;
        if (! $incident && ! ($record['active'] ?? false)) {
            unset($record['pending_notification']);

            return;
        }
        $changed = $previous && ($record['members'] ?? null) !== ($previous['members'] ?? null);
        if ($incident && $changed) {
            $this->close($incident, 'superseded', $at, $record, false, $clients);
            $incident = null;
        }
        if (! $incident && ($record['active'] ?? false)) {
            $baseline = $transition !== 'outage';
            $id = DB::table('monitoring_incidents')->insertGetId([
                'episode' => (string) Str::uuid(), 'scope_key' => $key, 'open_scope_key' => $key,
                'kind' => $record['context']['kind'], 'name' => $record['context']['name'], 'status' => 'active',
                'condition' => $record['condition'], 'baseline' => $baseline, 'notify_enabled' => ! $baseline && ! $suppressed,
                'version' => 0, 'opened_at' => $this->date($at), 'last_observed_at' => $this->date($at),
                'context' => json_encode($record['context']), 'created_at' => now(), 'updated_at' => now(),
            ]);
            $incident = DB::table('monitoring_incidents')->find($id);
            $this->active[$key] = $incident;
            $this->event($incident, $baseline ? 'baseline' : 'outage', $at, $record, ! $baseline && ! $suppressed, $clients);
        } elseif ($incident && ! ($record['active'] ?? false)) {
            $this->close($incident, $transition === 'recovery' ? 'recovered' : 'superseded', $at, $record,
                $transition === 'recovery' && (bool) $incident->notify_enabled && ! $suppressed, $clients);
        } elseif ($incident) {
            $updates = ['condition' => $record['condition'], 'context' => json_encode($record['context']), 'updated_at' => now()];
            if ($at !== null && in_array($record['condition'], ['up', 'down', 'partial'], true)) {
                $updates['last_observed_at'] = $this->date($at);
            }
            DB::table('monitoring_incidents')->where('id', $incident->id)->update($updates);
        }
        unset($record['pending_notification']);
    }

    private function close(object $incident, string $status, ?string $at, array $record, bool $notify, array $clients): void
    {
        DB::table('monitoring_incidents')->where('id', $incident->id)->update([
            'open_scope_key' => null, 'status' => $status, 'condition' => $record['condition'],
            'closed_at' => $this->date($at) ?? now(), 'context' => json_encode($record['context']), 'updated_at' => now(),
        ]);
        $this->event($incident, $status, $at, $record, $notify, $clients);
        unset($this->active[$incident->scope_key]);
    }

    private function event(object $incident, string $transition, ?string $at, array $record, bool $notify, array $clients): void
    {
        $version = $incident->version + 1;
        $event = ['key' => $incident->scope_key, 'token' => (string) Str::uuid(), 'transition' => $transition,
            'context' => $record['context'], 'clients' => $clients, 'sampled_at' => $at, 'incident_id' => $incident->id];
        $id = DB::table('monitoring_events')->insertGetId(['event_key' => $event['token'], 'incident_id' => $incident->id,
            'version' => $version, 'transition' => $transition, 'sampled_at' => $this->date($at), 'payload' => json_encode($event), 'created_at' => now()]);
        DB::table('monitoring_incidents')->where('id', $incident->id)->update(['version' => $version]);
        $incident->version = $version;
        if ($notify) {
            app(OpticalOutbox::class)->stage($id, $event);
        }
    }

    private function date(?string $at): ?string
    {
        if (! $at) {
            return null;
        }
        try {
            return Carbon::parse($at)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s.u');
        } catch (\Throwable) {
            return null;
        }
    }
}
