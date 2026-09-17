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
    public static function detectMassClientDown(int $minThreshold = 2, float $downPercentageThreshold = 100.0): array
    {
        $alerts = [];

        // 🚀 OPTIMIZED: 1 single query untuk mengambil seluruh ONU yang terhubung ke ODP beserta relasinya
        $allOnus = \Illuminate\Support\Facades\DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->join('network_nodes as odp', 'odp.id', '=', 'network_ports.node_id')
            ->leftJoin('network_nodes as odc', 'odc.id', '=', 'odp.parent_node_id')
            ->leftJoin('olt_devices', 'olt_devices.id', '=', 'odp.olt_device_id')
            ->where('odp.node_type', 'ODP')
            ->select([
                'odp.id as odp_id',
                'odp.name as odp_name',
                'odp.code as odp_code',
                'odp.olt_port_ref',
                'odc.name as odc_name',
                'olt_devices.name as olt_name',
                'ont_registrations.id as ont_id',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'ont_registrations.status',
                'ont_registrations.rx_power',
                'customers.id as customer_id',
                'customers.customer_number',
                'customers.name as customer_name',
            ])
            ->get();

        $groupedByOdp = $allOnus->groupBy('odp_id');

        foreach ($groupedByOdp as $odpId => $onus) {
            $totalOnus = $onus->count();
            if ($totalOnus < $minThreshold) {
                continue;
            }

            $first = $onus->first();
            $odpName = $first->odp_name;
            $odpCode = $first->odp_code;
            $odcName = $first->odc_name ?: 'ODC Induk';
            $oltName = $first->olt_name ?: 'OLT';
            $portRef = $first->olt_port_ref ?: 'PON Port';
            $massKey = "notif_mass_down_{$odpId}";

            // Hitung ONU yang down / LOS / offline
            $downOnus = $onus->filter(function ($onu) {
                return $onu->status !== 'active' 
                    || $onu->rx_power === null 
                    || !is_numeric($onu->rx_power)
                    || (float)$onu->rx_power <= -32.0;
            });

            $downCount = $downOnus->count();

            // 🚨 Deteksi ODP Down:
            // 1. 100% seluruh pelanggan pada ODP tersebut LOS, ATAU
            // 2. Untuk ODP dengan >= 6 pelanggan: jika >= 85% pelanggan LOS (mengantisipasi jika ada 1 entri ghost di OLT)
            $isOdpDown = ($totalOnus >= $minThreshold && $downCount === $totalOnus)
                || ($totalOnus >= 6 && $downCount >= ($totalOnus - 1) && ($downCount / $totalOnus) >= 0.85);

            if ($isOdpDown) {
                $pctVal = round(($downCount / $totalOnus) * 100.0, 1);
                $alertItem = [
                    'odp_id'          => $odpId,
                    'odp_name'        => $odpName,
                    'odp_code'        => $odpCode,
                    'odc_name'        => $odcName,
                    'olt_name'        => $oltName,
                    'olt_port_ref'    => $portRef,
                    'total_clients'   => $totalOnus,
                    'down_clients'    => $downCount,
                    'down_percentage' => $pctVal,
                    'sample_onus'     => $downOnus->take(10)->pluck('onu_serial')->toArray(),
                ];

                $alerts[] = $alertItem;

                // Anti-spam key: hanya kirim sekali saat pertama kali terdeteksi (cooldown 12 jam)
                if (!\Illuminate\Support\Facades\Cache::has($massKey)) {
                    \Illuminate\Support\Facades\Cache::put($massKey, true, now()->addHours(12));

                    // 🛡️ HIERARCHY GUARD: Jika Interface OLT induk sedang dalam status Gangguan Massal Interface
                    // (misal SFP dicabut atau kabel feeder utama putus total),
                    // TAHAN notifikasi ODP individual ini agar grup NOC tidak dibanjiri puluhan alert ODP sekaligus!
                    $isParentInterfaceInMassOutage = false;
                    if (!empty($portRef)) {
                        $cleanP = strtolower(trim($portRef));
                        $allDevs = \App\Models\OltDevice::all(['id']);
                        foreach ($allDevs as $dev) {
                            if (\Illuminate\Support\Facades\Cache::has("interface_in_mass_outage_{$dev->id}_{$cleanP}") ||
                                \Illuminate\Support\Facades\Cache::has("interface_in_mass_outage_{$dev->id}_gpon-olt_{$cleanP}")) {
                                $isParentInterfaceInMassOutage = true;
                                break;
                            }
                        }
                    }

                    if (!$isParentInterfaceInMassOutage) {
                        $cleanOdpTitle = preg_match('/^odp/i', $odpName) ? $odpName : "ODP {$odpName}";

                        // Susun daftar seluruh pelanggan beserta ID Pelanggan dan nilai redamannya
                        $clientLines = [];
                        $idx = 1;
                        foreach ($onus as $onu) {
                            $cName = $onu->customer_name ?: "Pelanggan #{$onu->ont_id}";
                            $cId   = $onu->customer_number ?: ($onu->customer_id ? "ID-{$onu->customer_id}" : "ID-{$onu->ont_id}");
                            $sn    = $onu->onu_serial ?: ($onu->onu_mac ?: '—');
                            $isDown = ($onu->status !== 'active' || $onu->rx_power === null || !is_numeric($onu->rx_power) || (float)$onu->rx_power <= -32.0);
                            $badge = $isDown ? "🔴" : "🟢";
                            $rxStr = ($onu->rx_power !== null && is_numeric($onu->rx_power) && (float)$onu->rx_power > -35.0) ? "{$onu->rx_power} dBm" : "-40.00 dBm (LOS)";
                            $clientLines[] = "{$idx}. {$badge} [{$cId}] <b>{$cName}</b>\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                            $idx++;
                        }
                        $clientListText = implode("\n", $clientLines);

                        $cleanMassMsg = "<b>• Node ODP:</b> {$cleanOdpTitle}\n" .
                                        "<b>• ODC Induk:</b> {$odcName}\n" .
                                        "<b>• Interface OLT:</b> <code>{$portRef}</code>\n" .
                                        "<b>• Klien Terdampak:</b> 🔴 <b>{$downCount} dari {$totalOnus} Pelanggan ({$pctVal}% LOS)</b>\n\n" .
                                        "<b>Daftar Klien Terdampak:</b>\n" .
                                        "{$clientListText}\n\n" .
                                        "<i>Status: Pelanggan pada ODP ini terdeteksi mengalami pemutusan sinyal bersamaan.</i>";

                        AppNotification::notifyAll(
                            "🚨 ALARM GANGGUAN MASSAL: {$cleanOdpTitle}",
                            $cleanMassMsg,
                            'NOC',
                            '/network'
                        );
                    }
                    \Illuminate\Support\Facades\Cache::forget('dashboard_metrics_payload');
                }
            } else {
                // Jika sebelumnya ODP ini tercatat sedang gangguan massal dan sekarang telah pulih (downCount < totalOnus):
                if (\Illuminate\Support\Facades\Cache::has($massKey)) {
                    \Illuminate\Support\Facades\Cache::forget($massKey);
                    \Illuminate\Support\Facades\Cache::forget('dashboard_metrics_payload');

                    // Jika port induk sedang dalam pemulihan massal interface, jangan kirim per ODP agar tidak spam
                    $isParentInterfaceInMassOutage = false;
                    if (!empty($portRef)) {
                        $cleanP = strtolower(trim($portRef));
                        $allDevs = \App\Models\OltDevice::all(['id']);
                        foreach ($allDevs as $dev) {
                            if (\Illuminate\Support\Facades\Cache::has("interface_in_mass_outage_{$dev->id}_{$cleanP}") ||
                                \Illuminate\Support\Facades\Cache::has("interface_in_mass_outage_{$dev->id}_gpon-olt_{$cleanP}")) {
                                $isParentInterfaceInMassOutage = true;
                                break;
                            }
                        }
                    }

                    if (!$isParentInterfaceInMassOutage) {
                        $cleanOdpTitle = preg_match('/^odp/i', $odpName) ? $odpName : "ODP {$odpName}";

                        // Susun daftar seluruh pelanggan yang telah pulih beserta ID Pelanggan dan nilai redaman sehatnya
                        $clientRecoveryLines = [];
                        $recoveredCount = 0;
                        $idx = 1;
                        foreach ($onus as $onu) {
                            $cName = $onu->customer_name ?: "Pelanggan #{$onu->ont_id}";
                            $cId   = $onu->customer_number ?: ($onu->customer_id ? "ID-{$onu->customer_id}" : "ID-{$onu->ont_id}");
                            $sn    = $onu->onu_serial ?: ($onu->onu_mac ?: '—');
                            $isUp  = ($onu->status === 'active' && $onu->rx_power !== null && is_numeric($onu->rx_power) && (float)$onu->rx_power > -32.0);
                            if ($isUp) $recoveredCount++;
                            $badge = $isUp ? "🟢" : "🔴";
                            $rxStr = $isUp ? "{$onu->rx_power} dBm" : "-40.00 dBm (LOS)";
                            $clientRecoveryLines[] = "{$idx}. {$badge} [{$cId}] <b>{$cName}</b>\n   └ SN: <code>{$sn}</code> • <code>{$rxStr}</code>";
                            $idx++;
                        }
                        $recoveryDetailText = implode("\n", $clientRecoveryLines);

                        $cleanRecoveryMsg = "<b>• Node ODP:</b> {$cleanOdpTitle}\n" .
                                            "<b>• ODC Induk:</b> {$odcName}\n" .
                                            "<b>• Interface OLT:</b> <code>{$portRef}</code>\n" .
                                            "<b>• Status:</b> 🟢 <b>LAYANAN ODP PULIH NORMAL ({$recoveredCount}/{$totalOnus} Klien Online)</b>\n\n" .
                                            "<b>Daftar Pelanggan Pulih:</b>\n" .
                                            "{$recoveryDetailText}\n\n" .
                                            "<i>Koneksi optik pada splitter ODP {$cleanOdpTitle} telah kembali normal dan stabil.</i>";

                        AppNotification::notifyAll(
                            "🟢 PEMULIHAN GANGGUAN MASSAL: {$cleanOdpTitle}",
                            $cleanRecoveryMsg,
                            'NOC',
                            '/network'
                        );
                    }
                }
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
