<?php

namespace App\Services;

use App\Models\Ticket;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TicketCreationService
{
    public function create(array $attributes, int $actorId, ?string $requestKey = null): array
    {
        $incidentId = $attributes['monitoring_incident_id'] ?? null;
        $scope = $incidentId ? 'incident:'.$incidentId : 'user:'.$actorId.':'.($requestKey ?: Str::uuid());
        $key = hash('sha256', 'ticket-create:'.$scope);
        $canonical = $attributes;
        // Generated timeline timestamps and display names cannot change the meaning of a retried request.
        unset($canonical['timeline_logs'], $canonical['ticket_number'], $canonical['resolved_at']);
        ksort($canonical);
        $hash = $incidentId ? hash('sha256', 'incident-ticket:'.$incidentId) : hash('sha256', json_encode($canonical, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($attributes, $key, $hash, $incidentId) {
            DB::table('ticket_idempotency_requests')->insertOrIgnore(['key_hash' => $key, 'payload_hash' => $hash, 'created_at' => now()]);
            $request = DB::table('ticket_idempotency_requests')->where('key_hash', $key)->lockForUpdate()->first();
            abort_if($request->payload_hash !== $hash, 409, 'Identitas permintaan sudah dipakai untuk isi tiket yang berbeda.');
            if ($request->ticket_id !== null) {
                return ['ticket' => Ticket::findOrFail($request->ticket_id), 'created' => false];
            }
            // A committed request whose ticket was explicitly deleted is a tombstone, not permission to recreate it.
            if (DB::table('ticket_idempotency_requests')->where('key_hash', $key)->whereNotNull('completed_at')->exists()) {
                abort(410, 'Tiket untuk permintaan ini sudah dihapus.');
            }
            if ($incidentId) {
                $incident = DB::table('monitoring_incidents')->where('id', $incidentId)->lockForUpdate()->first();
                abort_unless($incident, 404);
                $existing = Ticket::where('monitoring_incident_id', $incidentId)->first();
                if ($existing) {
                    DB::table('ticket_idempotency_requests')->where('key_hash', $key)->update(['ticket_id' => $existing->id, 'completed_at' => now()]);

                    return ['ticket' => $existing, 'created' => false];
                }
            }
            $year = (int) now()->format('Y');
            DB::table('ticket_sequences')->insertOrIgnore(['year' => $year, 'value' => 0]);
            $sequence = DB::table('ticket_sequences')->where('year', $year)->lockForUpdate()->first();
            $next = (int) $sequence->value;
            if ($next === 0) {
                foreach (DB::table('tickets')->where('ticket_number', 'like', 'TICK-'.$year.'-%')->pluck('ticket_number') as $number) {
                    if (preg_match('/^TICK-'.$year.'-(\d+)$/D', $number, $m)) {
                        $next = max($next, (int) $m[1]);
                    }
                }
            }
            do {
                $number = sprintf('TICK-%d-%04d', $year, ++$next);
            } while (Ticket::where('ticket_number', $number)->exists());
            DB::table('ticket_sequences')->where('year', $year)->update(['value' => $next]);
            $ticket = Ticket::create([...$attributes, 'ticket_number' => $number]);
            DB::table('ticket_idempotency_requests')->where('key_hash', $key)->update(['ticket_id' => $ticket->id, 'completed_at' => now()]);

            return ['ticket' => $ticket, 'created' => true];
        }, 3);
    }
}
