<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\NetworkNode;
use App\Models\NetworkCable;
use App\Models\NetworkPort;
use App\Models\OltDevice;
use App\Models\Ticket;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
        Carbon::setLocale('id');

        $totalOlts = OltDevice::count();
        $totalPop  = NetworkNode::where('node_type', 'POP')->count();
        $totalOdc  = NetworkNode::where('node_type', 'ODC')->count();
        $totalOdp  = NetworkNode::where('node_type', 'ODP')->count();

        $totalCores = (int) NetworkCable::sum('core_count_total');
        $usedCores  = (int) NetworkCable::sum('core_count_used');
        $coreUtilization = $totalCores > 0 ? round(($usedCores / $totalCores) * 100) : 0;

        $activeTickets = Ticket::whereNotIn('status', ['Resolved', 'Closed'])->count();
        $criticalTickets = Ticket::where('priority', 'Critical')->whereNotIn('status', ['Resolved', 'Closed'])->count();
        $inProgressTickets = Ticket::where('status', 'In Progress')->count();

        // Optical Power Distribution from real DB entries (ont_registrations & NetworkNode)
        $goodSignal = 0;
        $modSignal = 0;
        $warnSignal = 0;
        $losSignal = 0;
        $totalPowerSum = 0;
        $powerCount = 0;

        // 1. Check active and inactive ont_registrations
        $onts = \Illuminate\Support\Facades\DB::table('ont_registrations')->get();
        foreach ($onts as $ont) {
            $isOnline = ($ont->status === 'active' && $ont->rx_power !== null && (float)$ont->rx_power > -35.0);
            if (!$isOnline) {
                $losSignal++;
                continue;
            }

            $p = (float) $ont->rx_power;
            $totalPowerSum += $p;
            $powerCount++;

            if ($p >= -24.0) {
                $goodSignal++;
            } elseif ($p >= -27.0) {
                $modSignal++;
            } else {
                $warnSignal++;
            }
        }

        // 2. Check ODP & ODC node core_power if numeric
        $nodePowers = NetworkNode::whereIn('node_type', ['ODP', 'ODC'])
            ->whereNotNull('core_power')
            ->pluck('core_power');

        foreach ($nodePowers as $cp) {
            if (!is_numeric($cp)) continue;
            $p = (float) $cp;
            $totalPowerSum += $p;
            $powerCount++;

            if ($p >= -22.0) {
                $goodSignal++;
            } elseif ($p >= -26.0) {
                $modSignal++;
            } elseif ($p >= -30.0) {
                $warnSignal++;
            } else {
                $losSignal++;
            }
        }

        $avgPower = $powerCount > 0 ? round($totalPowerSum / $powerCount, 1) : null;

        // Real-Time Network Disturbance & Incident Feed (POP - ODC - ODP - OLT - CLIENT)
        $recentAlerts = [];

        // 1. Network disturbance tickets
        $rawTickets = Ticket::with(['networkNode.oltDevice'])->latest()->take(5)->get();
        foreach ($rawTickets as $t) {
            $sev = strtolower($t->priority) === 'critical' ? 'critical' : (strtolower($t->priority) === 'high' ? 'warning' : 'info');
            $recentAlerts[] = [
                'id'          => 'ticket_' . $t->id,
                'severity'    => $sev,
                'title'       => $t->ticket_number . ': ' . $t->title,
                'description' => $t->description ?? 'Penanganan gangguan pada node infrastruktur jaringan.',
                'node'        => $t->networkNode?->name ?? 'Node Jaringan',
                'time'        => $t->created_at ? $t->created_at->diffForHumans() : 'Baru saja',
                'olt'         => $t->networkNode?->oltDevice?->name ?? 'OLT Region',
            ];
        }

        // 2. Problematic Network Nodes (POP, ODC, ODP)
        $problemNodes = NetworkNode::with('oltDevice')
            ->whereIn('node_type', ['POP', 'ODC', 'ODP'])
            ->whereIn('status', ['offline', 'degraded', 'maintenance'])
            ->latest()
            ->take(5)
            ->get();

        foreach ($problemNodes as $node) {
            $sev = $node->status === 'offline' ? 'critical' : 'warning';
            $recentAlerts[] = [
                'id'          => 'node_' . $node->id,
                'severity'    => $sev,
                'title'       => "Status Node {$node->node_type}: {$node->name} ({$node->status})",
                'description' => "Node {$node->node_type} {$node->name} terdeteksi berkendala dengan status {$node->status}.",
                'node'        => "{$node->node_type} {$node->code}",
                'time'        => $node->updated_at ? $node->updated_at->diffForHumans() : 'Baru saja',
                'olt'         => $node->oltDevice?->name ?? 'OLT Region',
            ];
        }

        // 3. Offline or Degraded OLT Devices
        $problemOlts = OltDevice::whereIn('status', ['offline', 'degraded'])
            ->latest()
            ->take(3)
            ->get();

        foreach ($problemOlts as $olt) {
            $recentAlerts[] = [
                'id'          => 'olt_' . $olt->id,
                'severity'    => 'critical',
                'title'       => "Perangkat OLT Offline: {$olt->name}",
                'description' => "Perangkat {$olt->name} (IP: {$olt->ip_address}) terputus dari jaringan SNMP telemetry.",
                'node'        => $olt->code,
                'time'        => $olt->updated_at ? $olt->updated_at->diffForHumans() : 'Baru saja',
                'olt'         => $olt->name,
            ];
        }

        $totalTickets = Ticket::count();
        $resolvedTickets = Ticket::whereIn('status', ['Resolved', 'Closed'])->count();
        $inProgressTickets = Ticket::where('status', 'In Progress')->count();

        // Customer stats breakdown
        $activeCustomers = Customer::where('status', 'active')->count();
        $candidateCustomers = Customer::whereIn('status', ['prospect', 'survey', 'installation', 'draft'])->count();
        $suspendedCustomers = Customer::where('status', 'suspended')->count();
        $isolatedCustomers = Customer::where('status', 'isolated')->count();
        $terminatedCustomers = Customer::where('status', 'terminated')->count();

        // Breakdown: Tickets by Technician (Open vs Closed)
        $techStatsRaw = Ticket::select('technician_name', 'status', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
            ->whereNotNull('technician_name')
            ->where('technician_name', '!=', '')
            ->groupBy('technician_name', 'status')
            ->get();

        $techMap = [];
        foreach ($techStatsRaw as $row) {
            $name = $row->technician_name;
            if (!isset($techMap[$name])) {
                $techMap[$name] = ['technician' => $name, 'open' => 0, 'closed' => 0];
            }
            if (in_array($row->status, ['Resolved', 'Closed'])) {
                $techMap[$name]['closed'] += $row->count;
            } else {
                $techMap[$name]['open'] += $row->count;
            }
        }
        $ticketsByTechnician = array_values($techMap);

        // Breakdown: Tickets by Category
        $ticketsByCategory = Ticket::select('category', \Illuminate\Support\Facades\DB::raw('count(*) as count'))
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->groupBy('category')
            ->orderByDesc('count')
            ->get()
            ->map(function ($row) {
                return [
                    'category' => $row->category,
                    'count'    => $row->count,
                ];
            });

        // Real-Time Technician Recent Activity Feed from AuditLog
        $auditLogs = AuditLog::latest()->take(5)->get();
        $recentActivities = $auditLogs->map(function ($log) {
            return [
                'id'     => $log->id,
                'user'   => $log->user_name . ' (' . ($log->user_role ?? 'User') . ')',
                'action' => $log->action . ' — ' . $log->module,
                'node'   => $log->description,
                'time'   => $log->created_at ? $log->created_at->diffForHumans() : 'Baru saja',
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => [
                'overview' => [
                    'total_olts'          => $totalOlts,
                    'total_pop'           => $totalPop,
                    'total_odc'           => $totalOdc,
                    'total_odp'           => $totalOdp,
                    'total_cores'         => $totalCores,
                    'used_cores'          => $usedCores,
                    'core_utilization'    => $coreUtilization,
                    'active_tickets'      => $activeTickets,
                    'critical_tickets'    => $criticalTickets,
                    'in_progress_tickets' => $inProgressTickets,
                    'total_tickets'       => $totalTickets,
                    'resolved_tickets'    => $resolvedTickets,
                    'active_customers'    => $activeCustomers,
                    'candidate_customers' => $candidateCustomers,
                    'suspended_customers' => $suspendedCustomers,
                    'isolated_customers'  => $isolatedCustomers,
                    'terminated_customers'=> $terminatedCustomers,
                ],
                'tickets_by_technician' => $ticketsByTechnician,
                'tickets_by_category'   => $ticketsByCategory,
                'rx_power' => [
                    'good'      => $goodSignal,
                    'moderate'  => $modSignal,
                    'warning'   => $warnSignal,
                    'los'       => $losSignal,
                    'avg_power' => $avgPower,
                ],
                'recent_alerts'     => $recentAlerts,
                'recent_activities' => $recentActivities,
            ]
        ]);
    }
}
