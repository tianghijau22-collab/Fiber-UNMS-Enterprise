<?php

namespace App\Services;

use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\OntRegistration;
use App\Models\AppNotification;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Log;

class OpticalFaultLocalizationService
{
    /**
     * Jalankan diagnosa komprehensif:
     * 1. Deteksi Klien Mati Massal per ODP / Interface PON
     * 2. Lokalisasi Titik Putus Jalur Berdasarkan Batas Redaman ODP Terakhir
     */
    public static function runDiagnostic(): array
    {
        $massOutages = static::detectMassClientDown();
        $boundaryBreaks = static::localizeOpticalBreakBoundaries();

        return [
            'timestamp'             => now()->format('Y-m-d H:i:s'),
            'mass_outages_detected' => count($massOutages),
            'mass_outages'          => $massOutages,
            'boundary_breaks_count' => count($boundaryBreaks),
            'boundary_breaks'       => $boundaryBreaks,
        ];
    }

    /**
     * 1. Deteksi Client Mati Massal pada ODP atau Port PON OLT
     */
    public static function detectMassClientDown(int $minThreshold = 3, float $downPercentageThreshold = 60.0): array
    {
        $alerts = [];
        $odps = NetworkNode::where('node_type', 'ODP')->with(['parent', 'oltDevice'])->get();

        foreach ($odps as $odp) {
            // Dapatkan seluruh ONU yang terhubung ke port ODP ini
            $onus = OntRegistration::whereHas('customerService.networkPort', function ($q) use ($odp) {
                $q->where('node_id', $odp->id);
            })->get();

            $totalOnus = $onus->count();
            if ($totalOnus < $minThreshold) {
                continue;
            }

            // Hitung ONU yang down / LOS / offline
            $downOnus = $onus->filter(function ($onu) {
                return $onu->status !== 'active' 
                    || $onu->rx_power === null 
                    || $onu->rx_power <= -30.0 
                    || ($onu->last_online_at && $onu->last_online_at->diffInMinutes(now()) > 10);
            });

            $downCount = $downOnus->count();
            $downPercentage = ($downCount / $totalOnus) * 100.0;

            if ($downCount >= $minThreshold && $downPercentage >= $downPercentageThreshold) {
                $odcName = $odp->parent ? $odp->parent->name : 'ODC Induk';
                $oltName = $odp->oltDevice ? $odp->oltDevice->name : 'OLT';
                $portRef = $odp->olt_port_ref ?: 'PON Port';

                $alertItem = [
                    'odp_id'          => $odp->id,
                    'odp_name'        => $odp->name,
                    'odp_code'        => $odp->code,
                    'odc_name'        => $odcName,
                    'olt_name'        => $oltName,
                    'olt_port_ref'    => $portRef,
                    'total_clients'   => $totalOnus,
                    'down_clients'    => $downCount,
                    'down_percentage' => round($downPercentage, 1),
                    'sample_onus'     => $downOnus->take(5)->pluck('onu_serial')->toArray(),
                ];

                $alerts[] = $alertItem;

                // Anti-spam key: hanya kirim sekali saat pertama kali terdeteksi (cooldown 12 jam)
                $massKey = "notif_mass_down_{$odp->id}";
                if (!\Illuminate\Support\Facades\Cache::has($massKey)) {
                    \Illuminate\Support\Facades\Cache::put($massKey, true, now()->addHours(12));

                    $cleanMassMsg = "<b>• Node ODP:</b> {$odp->name} ({$odp->code})\n" .
                                    "<b>• ODC Induk:</b> {$odcName}\n" .
                                    "<b>• Interface OLT:</b> {$portRef}\n" .
                                    "<b>• Klien Terdampak:</b> 🔴 {$downCount} dari {$totalOnus} Pelanggan ({$alertItem['down_percentage']}% LOS)\n\n" .
                                    "<i>Status: Seluruh pelanggan pada ODP ini terdeteksi mengalami pemutusan sinyal bersamaan.</i>";

                    AppNotification::notifyAll(
                        "🚨 ALARM GANGGUAN MASSAL: ODP {$odp->name}",
                        $cleanMassMsg,
                        'NOC',
                        '/network'
                    );
                }
            } else {
                // Jika sudah normal kembali, bersihkan key agar alarm bisa berbunyi lagi di masa depan
                \Illuminate\Support\Facades\Cache::forget("notif_mass_down_{$odp->id}");
            }
        }

        return $alerts;
    }

    /**
     * 2. Lokalisasi Titik Putus Jalur Distribusi Berdasarkan Batas Redaman:
     * Menemukan ODP terakhir yang memiliki sinyal optik normal dan ODP berikutnya yang redamannya hilang (LOS/Mati).
     */
    public static function localizeOpticalBreakBoundaries(): array
    {
        $detectedBreaks = [];
        $currentBreakKeys = [];

        // Ambil ODC sebagai pusat distribusi
        $odcs = NetworkNode::where('node_type', 'ODC')->with(['children'])->get();

        foreach ($odcs as $odc) {
            $childOdps = $odc->children()->where('node_type', 'ODP')->orderBy('id', 'asc')->get();
            if ($childOdps->count() < 2) {
                continue;
            }

            // Hitung status rata-rata redaman daya optik untuk tiap ODP
            $odpStatusList = [];
            foreach ($childOdps as $odp) {
                $onus = OntRegistration::whereHas('customerService.networkPort', function ($q) use ($odp) {
                    $q->where('node_id', $odp->id);
                })->get();

                $total = $onus->count();
                $onlineCount = $onus->where('status', 'active')->filter(function ($o) {
                    return $o->rx_power !== null && $o->rx_power > -28.0;
                })->count();

                $avgPower = $onus->where('rx_power', '!=', null)->avg('rx_power');

                $isAlive = $total === 0 
                    ? ($odp->status === 'active') // Jika belum ada client, gunakan status node
                    : ($onlineCount > 0);

                $odpStatusList[] = [
                    'odp'        => $odp,
                    'is_alive'   => $isAlive,
                    'avg_power'  => $avgPower ? round($avgPower, 2) : ($isAlive ? -20.5 : -40.0),
                    'total_onus' => $total,
                    'online_onus'=> $onlineCount,
                ];
            }

            // Cari batas (Boundary) transisi dari ODP Hidup ke ODP Mati berturut-turut
            for ($i = 0; $i < count($odpStatusList) - 1; $i++) {
                $current = $odpStatusList[$i];
                $next    = $odpStatusList[$i + 1];

                // Jika ODP saat ini MASIH ADA SINYAL (Alive), tetapi ODP berikutnya MATI TOTAL (Dead)
                if ($current['is_alive'] && !$next['is_alive']) {
                    // Hitung berapa ODP berikutnya yang ikut mati pada jalur ini
                    $affectedOdps = [];
                    $totalAffectedClients = 0;

                    for ($j = $i + 1; $j < count($odpStatusList); $j++) {
                        if (!$odpStatusList[$j]['is_alive']) {
                            $affectedOdps[] = $odpStatusList[$j]['odp']->name;
                            $totalAffectedClients += $odpStatusList[$j]['total_onus'];
                        } else {
                            break;
                        }
                    }

                    $lastHealthyOdp = $current['odp'];
                    $firstDeadOdp   = $next['odp'];

                    $breakKey = "break_{$odc->id}_{$lastHealthyOdp->id}_{$firstDeadOdp->id}";
                    $currentBreakKeys[] = $breakKey;

                    $breakInfo = [
                        'break_key'              => $breakKey,
                        'odc_id'                 => $odc->id,
                        'odc_name'               => $odc->name,
                        'last_healthy_odp_id'    => $lastHealthyOdp->id,
                        'last_healthy_odp'       => $lastHealthyOdp->name,
                        'last_healthy_power_dbm' => $current['avg_power'],
                        'first_dead_odp_id'      => $firstDeadOdp->id,
                        'first_dead_odp'         => $firstDeadOdp->name,
                        'estimated_break_sector' => "Antara {$lastHealthyOdp->name} dan {$firstDeadOdp->name}",
                        'affected_odp_list'      => $affectedOdps,
                        'affected_odp_count'     => count($affectedOdps),
                        'affected_client_count'  => $totalAffectedClients,
                        'last_healthy_coords'    => [$lastHealthyOdp->latitude, $lastHealthyOdp->longitude],
                        'first_dead_coords'      => [$firstDeadOdp->latitude, $firstDeadOdp->longitude],
                    ];

                    $detectedBreaks[] = $breakInfo;

                    // Siarkan Notifikasi Pintar Lokalisasi Jalur Putus (HANYA SEKALI, ANTI-SPAM)
                    $notifKey = "notif_cable_break_{$odc->id}_{$lastHealthyOdp->id}_{$firstDeadOdp->id}";
                    if (!\Illuminate\Support\Facades\Cache::has($notifKey)) {
                        \Illuminate\Support\Facades\Cache::put($notifKey, $breakInfo, now()->addHours(12));

                        $affectedNames = implode(', ', array_slice($affectedOdps, 0, 4));
                        if (count($affectedOdps) > 4) {
                            $affectedNames .= ' dkk.';
                        }

                        $cleanBreakMsg = "<b>• Jalur Distribusi:</b> ODC {$odc->name}\n" .
                                         "<b>• Batas Putus Kabel:</b> <b>{$lastHealthyOdp->name}</b> ➔ <b>{$firstDeadOdp->name}</b>\n" .
                                         "<b>• Titik Sinyal Terakhir:</b> {$lastHealthyOdp->name} (Rx: <code>{$current['avg_power']} dBm</code>)\n" .
                                         "<b>• Titik Hilang Sinyal:</b> {$firstDeadOdp->name} (🔴 LOS / Mati)\n" .
                                         "<b>• Estimasi Terdampak:</b> " . count($affectedOdps) . " ODP ({$affectedNames}) & {$totalAffectedClients} Pelanggan";

                        AppNotification::notifyAll(
                            "🚨 LOKALISASI PUTUS KABEL: {$lastHealthyOdp->name} ➔ {$firstDeadOdp->name}",
                            $cleanBreakMsg,
                            'NOC',
                            '/otdr-tracing'
                        );
                    }
                }
            }
        }

        // Cek Pemulihan: Jika break yang sebelumnya aktif sekarang sudah tersambung kembali
        $activeBreaksMap = \Illuminate\Support\Facades\Cache::get('active_cable_breaks_map', []);
        foreach ($activeBreaksMap as $oldKey => $oldBreak) {
            if (!in_array($oldKey, $currentBreakKeys)) {
                // Kabel telah pulih / disambung kembali
                $recoveryMsg = "<b>• Jalur Distribusi:</b> ODC {$oldBreak['odc_name']}\n" .
                               "<b>• Segmen:</b> {$oldBreak['last_healthy_odp']} ➔ {$oldBreak['first_dead_odp']}\n" .
                               "<b>• Status:</b> 🟢 NORMAL (Kabel Selesai Disambung)\n\n" .
                               "<i>Sinyal optik pada segmen ini telah kembali normal dan pelanggan telah terhubung kembali.</i>";

                AppNotification::notifyAll(
                    "🟢 PEMULIHAN KABEL OPTIK: {$oldBreak['last_healthy_odp']} ➔ {$oldBreak['first_dead_odp']}",
                    $recoveryMsg,
                    'NOC',
                    '/otdr-tracing'
                );

                \Illuminate\Support\Facades\Cache::forget("notif_cable_break_{$oldBreak['odc_id']}_{$oldBreak['last_healthy_odp_id']}_{$oldBreak['first_dead_odp_id']}");
            }
        }

        // Simpan snapshot break aktif terkini
        $newBreaksMap = [];
        foreach ($detectedBreaks as $db) {
            $newBreaksMap[$db['break_key']] = $db;
        }
        \Illuminate\Support\Facades\Cache::put('active_cable_breaks_map', $newBreaksMap, now()->addHours(24));

        return $detectedBreaks;
    }
}
