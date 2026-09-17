<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Models\OltDevice;

class TelemetryEventStreamController extends Controller
{
    /**
     * Get recent real-time optical & telemetry events (SNMP Traps & Syslog).
     * Designed for high-frequency low-overhead polling (e.g. every 3-5 seconds).
     */
    public function getLiveEvents(Request $request)
    {
        $since = $request->query('since'); // ISO8601 string or null
        $events = Cache::get('telemetry_live_events', []);

        // Filter events newer than 'since' if provided
        if ($since) {
            $sinceTime = strtotime($since);
            if ($sinceTime !== false) {
                $events = array_values(array_filter($events, function ($ev) use ($sinceTime) {
                    $evTime = strtotime($ev['timestamp'] ?? '');
                    return $evTime !== false && $evTime > $sinceTime;
                }));
            }
        } else {
            // Default return last 15 events
            $events = array_slice($events, 0, 15);
        }

        // Summary counts
        $totalLossCount = DB::table('ont_registrations')
            ->where('status', 'inactive')
            ->where('rx_power', '<=', -38.0)
            ->count();

        return response()->json([
            'status' => 'success',
            'data'   => [
                'events'           => $events,
                'total_loss_count' => $totalLossCount,
                'server_time'      => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Clear or purge event history queue (Admin utility)
     */
    public function clearLiveEvents()
    {
        Cache::forget('telemetry_live_events');
        return response()->json([
            'status'  => 'success',
            'message' => 'Telemetry live events queue has been cleared.',
        ]);
    }
}
