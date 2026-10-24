<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Services\OpticalOutbox;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonitoringIncidentController extends Controller
{
    public function index(Request $request)
    {
        $input = $request->validate(['status' => 'nullable|in:active,recovered,superseded', 'kind' => 'nullable|in:odp,source,segment', 'per_page' => 'nullable|integer|min:1|max:100']);
        $q = DB::table('monitoring_incidents')->select('id', 'episode', 'scope_key', 'kind', 'name', 'status', 'condition', 'baseline', 'version', 'opened_at', 'closed_at', 'last_observed_at');
        foreach (['status', 'kind'] as $field) {
            if (! empty($input[$field])) {
                $q->where($field, $input[$field]);
            }
        }

        return response()->json(['status' => 'success', 'data' => $q->orderByDesc('id')->paginate($input['per_page'] ?? 25),
            'delivery_summary' => DB::table('monitoring_deliveries')->selectRaw('channel,status,count(*) as total')->groupBy('channel', 'status')->get()]);
    }

    public function show(int $incident)
    {
        $row = DB::table('monitoring_incidents')->find($incident);
        abort_unless($row, 404);
        unset($row->open_scope_key);
        $row->context = json_decode($row->context, true);

        return response()->json(['status' => 'success', 'data' => $row,
            'events' => DB::table('monitoring_events')->where('incident_id', $incident)->orderBy('version')->get(['id', 'version', 'transition', 'sampled_at', 'created_at']),
            'deliveries' => DB::table('monitoring_deliveries as d')->join('monitoring_events as e', 'e.id', '=', 'd.event_id')->where('e.incident_id', $incident)
                ->orderBy('d.id')->get(['d.id', 'd.event_id', 'd.channel', 'd.part_index', 'd.status', 'd.attempts', 'd.status_reason', 'd.available_at', 'd.updated_at']),
            'ticket' => DB::table('tickets')->where('monitoring_incident_id', $incident)->first(['id', 'ticket_number', 'status'])]);
    }

    public function retry(Request $request, int $delivery)
    {
        $input = $request->validate(['acknowledge_duplicate_risk' => 'nullable|boolean']);
        DB::transaction(function () use ($delivery, $input) {
            $before = DB::table('monitoring_deliveries')->where('id', $delivery)->lockForUpdate()->first(['status', 'attempts']);
            app(OpticalOutbox::class)->retry($delivery, (bool) ($input['acknowledge_duplicate_risk'] ?? false));
            AuditLog::record('NOC_ALERT', 'Fault Localization Engine', 'Operator meminta pengiriman ulang notifikasi insiden.',
                $before ? (array) $before : null, ['delivery_id' => $delivery, 'acknowledge_duplicate_risk' => (bool) ($input['acknowledge_duplicate_risk'] ?? false)]);
        });
        app(OpticalOutbox::class)->dispatchDue();

        return response()->json(['status' => 'success', 'message' => 'Pengiriman dijadwalkan ulang.']);
    }

    public function createTicket(Request $request, int $incident)
    {
        $row = DB::table('monitoring_incidents')->find($incident);
        abort_unless($row, 404);
        $request->merge(['monitoring_incident_id' => $incident, 'title' => 'Insiden #'.$incident.': '.mb_substr($row->name, 0, 210),
            'description' => 'Pemeriksaan insiden FONA #'.$incident.'. Status bukti: '.$row->condition.'. Waktu observasi: '.$row->last_observed_at.'. Penyebab fisik memerlukan validasi lapangan.',
            'category' => $row->kind === 'source' ? 'Gangguan INTERFACE' : ($row->kind === 'segment' ? 'Fiber Cut' : 'Gangguan ODP'),
            'status' => 'Open', 'dispatch_telegram' => false]);

        return app(TicketController::class)->store($request);
    }
}
