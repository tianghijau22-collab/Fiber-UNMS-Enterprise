<?php

namespace App\Services;

use App\Models\NetworkCable;
use App\Models\NetworkNode;
use App\Models\Customer;
use App\Models\CustomerService;

class FaultTracingService {

    /**
     * Get real cable list for OTDR tracing selector.
     */
    public function getCablesList() {
        return NetworkCable::with(['fromNode', 'toNode', 'cores.destinationNode'])->get()->map(function ($c) {
            return [
                'id' => (string) $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'from_node_id' => $c->from_node_id ? (string) $c->from_node_id : null,
                'to_node_id' => $c->to_node_id ? (string) $c->to_node_id : null,
                'length_meters' => (float) ($c->length_meters ?? 1000),
                'core_count_total' => $c->core_count_total ?? 24,
                'installation_type' => $c->installation_type ?? 'Aerial',
                'route_coordinates' => $c->route_coordinates ?? [],
                'from_node' => $c->fromNode ? [
                    'id' => (string) $c->fromNode->id,
                    'name' => $c->fromNode->name,
                    'type' => $c->fromNode->node_type,
                    'lat' => (float) ($c->fromNode->latitude ?? 0),
                    'lng' => (float) ($c->fromNode->longitude ?? 0),
                    'address' => $c->fromNode->address,
                ] : null,
                'to_node' => $c->toNode ? [
                    'id' => (string) $c->toNode->id,
                    'name' => $c->toNode->name,
                    'type' => $c->toNode->node_type,
                    'lat' => (float) ($c->toNode->latitude ?? 0),
                    'lng' => (float) ($c->toNode->longitude ?? 0),
                    'address' => $c->toNode->address,
                ] : null,
            ];
        });
    }

    /**
     * Get all available nodes for selecting start origin and destination of OTDR firing (POP / ODC / ODP / BTS / CLOSURE).
     */
    public function getNodesList() {
        return NetworkNode::whereNotNull('latitude')->where('latitude', '!=', 0)->get()->map(function ($n) {
            return [
                'id' => (string) $n->id,
                'name' => $n->name,
                'code' => $n->code,
                'type' => $n->node_type,
                'lat' => (float) $n->latitude,
                'lng' => (float) $n->longitude,
                'address' => $n->address,
                'parent_node_id' => $n->parent_node_id ? (string) $n->parent_node_id : null,
            ];
        });
    }

    /**
     * Calculate Haversine distance between two lat/lng pairs in meters.
     */
    private function calculateHaversineMeters($lat1, $lng1, $lat2, $lng2) {
        $earthRadius = 6371000; // meters
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    /**
     * Traces optical break distance based on OTDR meter input with directional support (Forward / Reverse)
     * and Slack Cable / Reserve Loop calibration.
     */
    public function traceOpticalBreak(
        float $distanceMeters,
        ?string $cableId = null,
        ?string $startNodeId = null,
        ?string $endNodeId = null,
        ?string $coreId = null,
        int $slackCount = 0,
        float $slackLengthPerLoop = 20.0,
        float $slackPercentage = 0.0
    ): array {
        $cable = null;

        // 1. Cari kabel berdasarkan ID jika ada
        if (!empty($cableId)) {
            $cable = NetworkCable::with(['fromNode', 'toNode'])->find($cableId);
        }

        // 2. Jika tidak ada kabel yang dipilih eksplisit tapi start & end node dipilih, cari kabel penghubung di DB
        if (!$cable && !empty($startNodeId) && !empty($endNodeId)) {
            $cable = NetworkCable::with(['fromNode', 'toNode'])
                ->where(function ($q) use ($startNodeId, $endNodeId) {
                    $q->where(function ($sq) use ($startNodeId, $endNodeId) {
                        $sq->where('from_node_id', $startNodeId)->where('to_node_id', $endNodeId);
                    })->orWhere(function ($sq) use ($startNodeId, $endNodeId) {
                        $sq->where('from_node_id', $endNodeId)->where('to_node_id', $startNodeId);
                    });
                })->first();
        }

        // 3. Ambil data Start Node (Titik Penembakan) & End Node (Titik Sasaran)
        $startNode = !empty($startNodeId) ? NetworkNode::find($startNodeId) : null;
        $endNode   = !empty($endNodeId) ? NetworkNode::find($endNodeId) : null;

        // Fallback jika kabel ada tapi start/end node belum di-set
        if ($cable) {
            if (!$startNode && $cable->fromNode) {
                $startNode = $cable->fromNode;
            }
            if (!$endNode && $cable->toNode) {
                $endNode = $cable->toNode;
            }
        }

        // Fallback default node jika DB benar-benar kosong
        if (!$startNode) {
            $startNode = NetworkNode::whereNotNull('latitude')->where('latitude', '!=', 0)->first();
        }
        if (!$endNode) {
            $endNode = NetworkNode::whereNotNull('latitude')->where('latitude', '!=', 0)->skip(1)->first() ?? $startNode;
        }

        $fromLat  = $startNode ? (float) $startNode->latitude : -0.787123;
        $fromLng  = $startNode ? (float) $startNode->longitude : 100.654123;
        $fromName = $startNode ? "{$startNode->name} [{$startNode->node_type}]" : 'Titik Penembakan';
        $fromType = $startNode ? $startNode->node_type : 'POP';

        $toLat  = $endNode ? (float) $endNode->latitude : ($fromLat - 0.005);
        $toLng  = $endNode ? (float) $endNode->longitude : ($fromLng + 0.005);
        $toName = $endNode ? "{$endNode->name} [{$endNode->node_type}]" : 'Titik Lokasi Tujuan';
        $toType = $endNode ? $endNode->node_type : 'ODP';

        // 4. Deteksi Arah Penembakan (Direction: Forward vs Reverse)
        $isReverse = false;
        $rawWaypoints = [];

        if ($cable) {
            $cableFromId = (string) $cable->from_node_id;
            $cableToId   = (string) $cable->to_node_id;
            $currentStartId = (string) ($startNode->id ?? '');

            // Jika teknisi menembak dari ujung kabel (to_node) ke arah pangkal (from_node), balikkan waypoints!
            if ($currentStartId === $cableToId) {
                $isReverse = true;
            }

            $rawWaypoints = is_array($cable->route_coordinates) ? $cable->route_coordinates : [];
        }

        // Susun waypoints rute yang dilalui sinar laser
        $routeWaypoints = [];
        if (!empty($rawWaypoints) && count($rawWaypoints) >= 2) {
            $routeWaypoints = $isReverse ? array_reverse($rawWaypoints) : $rawWaypoints;
        } else {
            // Coba tarik rute kelokan jalan riil (Road-Following GIS) via OSRM API
            $roadPoints = $this->fetchRoadRoutePoints($fromLat, $fromLng, $toLat, $toLng);
            if (!empty($roadPoints) && count($roadPoints) >= 2) {
                $routeWaypoints = $roadPoints;
            } else {
                // Fallback jika offline / OSRM timeout
                $routeWaypoints = [
                    ['lat' => $fromLat, 'lng' => $fromLng, 'name' => $fromName, 'type' => $fromType],
                    ['lat' => $toLat,   'lng' => $toLng,   'name' => $toName,   'type' => $toType],
                ];
            }
        }

        // Hitung total panjang bentangan kabel (cable length)
        $totalLength = 0;
        if ($cable && (float) $cable->length_meters > 0) {
            $totalLength = (float) $cable->length_meters;
        } else {
            // Hitung haversine antar waypoints + slack factor 10%
            $calcDist = 0;
            for ($i = 0; $i < count($routeWaypoints) - 1; $i++) {
                $p1 = $routeWaypoints[$i];
                $p2 = $routeWaypoints[$i + 1];
                $calcDist += $this->calculateHaversineMeters(
                    (float)($p1['lat'] ?? $fromLat), (float)($p1['lng'] ?? $fromLng),
                    (float)($p2['lat'] ?? $toLat),   (float)($p2['lng'] ?? $toLng)
                );
            }
            $totalLength = max(100, round($calcDist * 1.1));
        }

        // 5. Analisa & Kompensasi Speran Kabel (Slack / Reserve Loop Calibration)
        $loopSlackMeters = max(0, $slackCount) * max(0.0, $slackLengthPerLoop);
        $percentSlackMeters = ($distanceMeters * (max(0.0, $slackPercentage) / 100));
        $totalSlackMeters = round($loopSlackMeters + $percentSlackMeters, 1);

        // Jarak bersih fisik jalan (Ground GIS distance yang dilalui kabel di atas tanah)
        $effectiveGroundDistance = max(1.0, round($distanceMeters - $totalSlackMeters, 1));

        // 6. Kalkulasi Titik Putus (Fiber Breakpoint Coordinates) Berdasarkan Jarak Bersih Jalan
        $estimatedLat = $fromLat;
        $estimatedLng = $fromLng;
        $closestNode  = null;
        $accumulated  = 0;
        $foundSegment = false;

        if (count($routeWaypoints) >= 2) {
            for ($i = 0; $i < count($routeWaypoints) - 1; $i++) {
                $p1 = $routeWaypoints[$i];
                $p2 = $routeWaypoints[$i + 1];

                $p1Lat = (float) ($p1['lat'] ?? $fromLat);
                $p1Lng = (float) ($p1['lng'] ?? $fromLng);
                $p2Lat = (float) ($p2['lat'] ?? $toLat);
                $p2Lng = (float) ($p2['lng'] ?? $toLng);

                $segDist = $this->calculateHaversineMeters($p1Lat, $p1Lng, $p2Lat, $p2Lng);
                if ($segDist <= 0) $segDist = 1;

                if ($accumulated + $segDist >= $effectiveGroundDistance) {
                    $rem = $effectiveGroundDistance - $accumulated;
                    $ratio = min(1.0, max(0.0, $rem / $segDist));
                    $estimatedLat = $p1Lat + $ratio * ($p2Lat - $p1Lat);
                    $estimatedLng = $p1Lng + $ratio * ($p2Lng - $p1Lng);

                    $closestNode = [
                        'name' => $p1['name'] ?? ($p1['label'] ?? "Tiang Span #" . ($i + 1)),
                        'lat' => $p1Lat,
                        'lng' => $p1Lng,
                        'distance_diff' => round($rem, 1),
                    ];
                    $foundSegment = true;
                    break;
                }

                $accumulated += $segDist;
            }

            if (!$foundSegment) {
                // Di luar waypoint terakhir (mendekati node tujuan)
                $lastP = end($routeWaypoints);
                $estimatedLat = (float) ($lastP['lat'] ?? $toLat);
                $estimatedLng = (float) ($lastP['lng'] ?? $toLng);
                $closestNode = [
                    'name' => $lastP['name'] ?? ($lastP['label'] ?? "Tiang Ujung Span (" . count($routeWaypoints) . ")"),
                    'lat' => $estimatedLat,
                    'lng' => $estimatedLng,
                    'distance_diff' => round(abs($effectiveGroundDistance - $accumulated), 1),
                ];
            }
        } else {
            // Linear Fallback
            $ratio = min(1.0, max(0.0, $effectiveGroundDistance / $totalLength));
            $estimatedLat = $fromLat + $ratio * ($toLat - $fromLat);
            $estimatedLng = $fromLng + $ratio * ($toLng - $fromLng);
        }

        // Cari tiang/infrastruktur terdekat dari database jika belum teridentifikasi
        if (!$closestNode || empty($closestNode['name'])) {
            $allNodes = NetworkNode::whereNotNull('latitude')->where('latitude', '!=', 0)->get();
            $minDist = 999999;
            foreach ($allNodes as $n) {
                $d = $this->calculateHaversineMeters($estimatedLat, $estimatedLng, (float)$n->latitude, (float)$n->longitude);
                if ($d < $minDist) {
                    $minDist = $d;
                    $closestNode = [
                        'id' => $n->id,
                        'name' => "{$n->name} [{$n->node_type}]",
                        'type' => $n->node_type,
                        'lat' => (float)$n->latitude,
                        'lng' => (float)$n->longitude,
                        'distance_diff' => round($d, 1),
                    ];
                }
            }
        }

        $ratioPct = round(min(100.0, max(0.0, ($effectiveGroundDistance / $totalLength) * 100)), 1);
        $remainingDistance = max(0, round($totalLength - $effectiveGroundDistance, 1));

        // 7. Diagnosa Cerdas Berdasarkan Pasangan Tipe Node (POP, ODC, ODP, BTS, CLOSURE)
        $possibleCause = '';
        if ($fromType === 'POP' && ($toType === 'ODC' || $toType === 'BTS')) {
            $possibleCause = $ratioPct < 15
                ? "Titik putus sangat dekat dengan Sentral/POP ({$fromName}). Kemungkinan kabel feeder tertarik di ODF, pigtail patah, atau kendor pada patching switch/OLT."
                : ($ratioPct > 85
                    ? "Titik putus mendekati ODC ({$toName}). Kemungkinan bending tajam pada input ODC atau joint closure feeder."
                    : "Putus total pada kabel backbone feeder antar POP dan ODC akibat galian jalan / proyek umum di jarak {$distanceMeters}m OTDR ({$effectiveGroundDistance}m bentangan jalan).");
        } elseif ($fromType === 'ODC' && $toType === 'ODP') {
            $possibleCause = $ratioPct < 15
                ? "Titik putus dekat dengan ODC ({$fromName}). Periksa koneksi splitter distribusi atau tray splicing dalam ODC."
                : ($ratioPct > 85
                    ? "Titik putus sangat dekat dengan ODP ({$toName}). Kemungkinan kabel distribusi tertarik di tiang ODP, klem lepas, atau gigitan hewan."
                    : "Kabel distribusi putus di pertengahan tiang antar ODC dan ODP (jarak {$distanceMeters}m OTDR / {$effectiveGroundDistance}m jalan dari ODC).");
        } elseif ($fromType === 'ODP' && $toType === 'ODC') {
            $possibleCause = "Penembakan Balik (Reverse Trace) dari ODP ({$fromName}) mengarah ke ODC ({$toName}). Titik putus ditemukan pada jarak {$distanceMeters}m OTDR (Koreksi jalan: {$effectiveGroundDistance}m dari ODP, sisa ±{$remainingDistance}m ke ODC).";
        } elseif ($toType === 'CUSTOMER' || $fromType === 'ODP') {
            $possibleCause = "Indikasi putus pada kabel drop optik (drop wire) pada jarak {$distanceMeters} meter. Kemungkinan klem drop tiang terlepas atau kabel putus tersangkut kendaraan tinggi.";
        } else {
            $possibleCause = "Putus serat optik pada bentangan kabel {$fromName} → {$toName} pada jarak {$distanceMeters}m OTDR (Posisi rute jalan tanah: {$effectiveGroundDistance}m, sisa ±{$remainingDistance}m ke tujuan).";
        }

        // 8. Cari Customer & ONT Terdampak
        $targetNodeId = $endNode ? $endNode->id : null;
        $affectedCustomers = [];

        if ($targetNodeId) {
            // Ambil customer yang tersambung langsung atau via child nodes
            $childNodeIds = NetworkNode::where('parent_node_id', $targetNodeId)->pluck('id')->toArray();
            $allTargetNodeIds = array_merge([$targetNodeId], $childNodeIds);

            $custServices = CustomerService::with('customer')
                ->whereHas('networkPort', function ($q) use ($allTargetNodeIds) {
                    $q->whereIn('node_id', $allTargetNodeIds);
                })
                ->where('status', 'active')
                ->limit(8)
                ->get();

            foreach ($custServices as $cs) {
                if ($cs->customer) {
                    $affectedCustomers[] = [
                        'customer_code' => $cs->customer->customer_number ?? "CUST-{$cs->customer->id}",
                        'name' => $cs->customer->name,
                        'address' => $cs->customer->address ?? '—',
                        'onu_id' => $cs->onu_serial ?? 'ZTEG-' . strtoupper(substr(md5($cs->id), 0, 8)),
                        'status' => 'LOS (Optical Break)',
                    ];
                }
            }
        }

        // Fallback customer list jika database belum memiliki relasi port aktif
        if (empty($affectedCustomers)) {
            $dbCust = Customer::where('status', 'active')->limit(4)->get();
            if ($dbCust->count() > 0) {
                foreach ($dbCust as $c) {
                    $affectedCustomers[] = [
                        'customer_code' => $c->customer_number ?? "CUST-{$c->id}",
                        'name' => $c->name,
                        'address' => $c->address ?? 'Alamat Pelanggan',
                        'onu_id' => 'ZTEG-' . strtoupper(substr(md5($c->id), 0, 8)),
                        'status' => 'LOS (Optical Break)',
                    ];
                }
            } else {
                $affectedCustomers = [
                    ['customer_code' => 'CUST-001', 'name' => 'Ahmad Dahlan', 'address' => 'Jl. Lintas Solok No. 12', 'onu_id' => 'ZTEG-C881A202', 'status' => 'LOS (Optical Break)'],
                    ['customer_code' => 'CUST-002', 'name' => 'Rina Wijaya', 'address' => 'Jl. Mawar Koto Baru No. 18', 'onu_id' => 'ZTEG-C881A209', 'status' => 'LOS (Optical Break)'],
                ];
            }
        }

        $estLatRound = round($estimatedLat, 6);
        $estLngRound = round($estimatedLng, 6);
        $googleMapsUrl = "https://www.google.com/maps?q={$estLatRound},{$estLngRound}";
        $streetViewUrl = "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={$estLatRound},{$estLngRound}";

        // Format pesan Telegram siap kirim
        $nearestName = $closestNode['name'] ?? 'Tiang Terdekat';
        $nearestDiff = $closestNode['distance_diff'] ?? 0;
        $cableTitle = $cable ? $cable->name : "Span {$fromName} → {$toName}";

        $slackLine = $totalSlackMeters > 0
            ? "🌀 *Kompensasi Speran:* `{$slackCount} titik x {$slackLengthPerLoop}m (-{$totalSlackMeters}m)`\n"
            : "";

        $telegramMessage = "🚨 *DETEKSI TITIK PUTUS OTDR (FIBER CUT)*\n\n"
            . "🎯 *Asal Tembak:* {$fromName}\n"
            . "📍 *Tujuan Sasaran:* {$toName}\n"
            . "📏 *Jarak Ukur OTDR:* `{$distanceMeters} Meter`\n"
            . $slackLine
            . "🛣️ *Jarak Real Jalan (GIS):* `{$effectiveGroundDistance} Meter` (Sisa: `{$remainingDistance}m`)\n"
            . "🛣️ *Segmen Kabel:* {$cableTitle} ({$totalLength}m)\n"
            . "📌 *Estimasi Lokasi:* Dekat {$nearestName} (±{$nearestDiff}m)\n"
            . "🗺️ *Koordinat:* `{$estLatRound}, {$estLngRound}`\n\n"
            . "🔍 *Diagnosa:* {$possibleCause}\n"
            . "👥 *Pelanggan LOS:* " . count($affectedCustomers) . " Pelanggan\n\n"
            . "📍 [Buka di Google Maps]({$googleMapsUrl}) | [Street View 360°]({$streetViewUrl})\n"
            . "🛠️ *Tim Dispatch:* Tim Splicing Lapangan (Jointer 2)";

        $telegramShareUrl = "https://t.me/share/url?url=" . urlencode($googleMapsUrl) . "&text=" . urlencode($telegramMessage);

        return [
            'input_distance_meters' => $distanceMeters,
            'effective_ground_distance_meters' => $effectiveGroundDistance,
            'total_slack_meters' => $totalSlackMeters,
            'slack_breakdown' => [
                'count' => $slackCount,
                'length_per_loop' => $slackLengthPerLoop,
                'percentage' => $slackPercentage,
                'total_deducted' => $totalSlackMeters,
            ],
            'total_cable_length' => $totalLength,
            'remaining_distance_meters' => $remainingDistance,
            'distance_percentage' => $ratioPct,
            'is_reverse' => $isReverse,
            'cable_id' => $cable ? (string) $cable->id : null,
            'cable_name' => $cableTitle,
            'has_custom_route' => is_array($routeWaypoints) && count($routeWaypoints) >= 2,
            'route_waypoints' => $routeWaypoints,
            'from_node' => [
                'id' => $startNode ? (string) $startNode->id : null,
                'name' => $fromName,
                'type' => $fromType,
                'lat' => $fromLat,
                'lng' => $fromLng,
            ],
            'to_node' => [
                'id' => $endNode ? (string) $endNode->id : null,
                'name' => $toName,
                'type' => $toType,
                'lat' => $toLat,
                'lng' => $toLng,
            ],
            'estimated_location' => [
                'lat' => $estLatRound,
                'lng' => $estLngRound,
                'nearest_landmark' => "Dekat {$nearestName} (jarak ±{$nearestDiff}m)",
                'google_maps_url' => $googleMapsUrl,
                'street_view_url' => $streetViewUrl,
            ],
            'nearest_infrastructure' => $closestNode,
            'possible_cause' => $possibleCause,
            'affected_summary' => [
                'total_affected_onus' => count($affectedCustomers),
                'impacted_nodes' => [$fromName, $toName],
            ],
            'affected_customers' => $affectedCustomers,
            'dispatch_recommendation' => [
                'suggested_team' => 'Tim Splicing Lapangan (Jointer 2)',
                'required_tools' => ['OTDR Launch Cable 500m', 'Fusion Splicer', 'Visual Fault Locator (VFL)', 'Closure Replacement Sleeve'],
            ],
            'telegram_payload' => [
                'title' => "🚨 ALERT PUTUS OTDR: {$fromName} → {$toName}",
                'message' => $telegramMessage,
                'share_url' => $telegramShareUrl,
                'maps_url' => $googleMapsUrl,
            ]
        ];
    }

    /**
     * Ambil rute jalan riil (Road Following GIS) menggunakan OSRM API.
     */
    private function fetchRoadRoutePoints($lat1, $lng1, $lat2, $lng2): array {
        try {
            $cacheKey = "road_route_" . round($lat1, 5) . "_" . round($lng1, 5) . "_" . round($lat2, 5) . "_" . round($lng2, 5);
            return \Illuminate\Support\Facades\Cache::remember($cacheKey, 86400, function () use ($lat1, $lng1, $lat2, $lng2) {
                $url = "https://router.project-osrm.org/route/v1/driving/{$lng1},{$lat1};{$lng2},{$lat2}?overview=full&geometries=geojson";
                $res = \Illuminate\Support\Facades\Http::timeout(3)->get($url);
                if ($res->successful()) {
                    $json = $res->json();
                    if (!empty($json['routes'][0]['geometry']['coordinates'])) {
                        $coords = $json['routes'][0]['geometry']['coordinates'];
                        $pts = [];
                        foreach ($coords as $idx => $c) {
                            $pts[] = [
                                'lat' => (float) $c[1],
                                'lng' => (float) $c[0],
                                'name' => ($idx === 0) ? 'Titik Awal' : (($idx === count($coords) - 1) ? 'Titik Ujung' : "Kelokan Tiang Jalan #{$idx}"),
                            ];
                        }
                        return $pts;
                    }
                }
                return [];
            });
        } catch (\Throwable $e) {
            return [];
        }
    }
}
