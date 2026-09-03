<?php

namespace App\Services;

use App\Models\NetworkNode;
use App\Models\NetworkCable;
use App\Models\OltDevice;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;
use XMLReader;
use SimpleXMLElement;

class KmlImportService
{
    /**
     * Parse KML/KMZ and return preview payload + cache token
     */
    public function preview(UploadedFile $file): array
    {
        $tempPath = $file->getRealPath();
        $ext = strtolower($file->getClientOriginalExtension());

        $kmlContentPath = $tempPath;
        $extractedDir = null;

        if ($ext === 'kmz') {
            $zip = new ZipArchive();
            if ($zip->open($tempPath) === true) {
                $extractedDir = sys_get_temp_dir() . '/kml_' . Str::random(10);
                mkdir($extractedDir, 0777, true);
                $zip->extractTo($extractedDir);
                $zip->close();

                // Find doc.kml or any .kml file
                $files = glob($extractedDir . '/*.kml');
                if (!empty($files)) {
                    $kmlContentPath = $files[0];
                } else {
                    $subFiles = glob($extractedDir . '/*/*.kml');
                    if (!empty($subFiles)) {
                        $kmlContentPath = $subFiles[0];
                    }
                }
            }
        }

        $parsed = $this->parseKmlFile($kmlContentPath);

        // Clean extracted temp files if any
        if ($extractedDir && is_dir($extractedDir)) {
            $this->deleteDirectory($extractedDir);
        }

        // Store parsed data temporarily in storage/app/kml_imports
        $token = Str::uuid()->toString();
        Storage::disk('local')->put("kml_imports/{$token}.json", json_encode($parsed));

        // Available OLTs in system
        $availableOlts = OltDevice::select('id', 'name', 'ip_address')->get()->toArray();

        return [
            'token' => $token,
            'summary' => [
                'total_nodes' => count($parsed['nodes']),
                'total_cables' => count($parsed['cables']),
                'odp_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'ODP')),
                'odc_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'ODC')),
                'pop_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'POP')),
                'jb_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'JOINT_CLOSURE')),
                'pole_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'POLE')),
                'olt_breakdown' => [
                    'guguak_02' => count(array_filter($parsed['nodes'], fn($n) => $n['olt_key'] === '02')),
                    'singkarak_05' => count(array_filter($parsed['nodes'], fn($n) => $n['olt_key'] === '05')),
                    'solok_kota' => count(array_filter($parsed['nodes'], fn($n) => $n['olt_key'] === 'default')),
                ],
                'parent_detected_count' => count(array_filter($parsed['nodes'], fn($n) => !empty($n['power_from_raw']))),
            ],
            'sample_nodes' => array_slice($parsed['nodes'], 0, 25),
            'sample_cables' => array_slice($parsed['cables'], 0, 15),
            'available_olts' => $availableOlts,
        ];
    }

    /**
     * Execute Import using stored preview token
     */
    public function execute(string $token, array $options = []): array
    {
        $path = "kml_imports/{$token}.json";
        if (!Storage::disk('local')->exists($path)) {
            throw new \Exception("Sesi import KML sudah kadaluarsa. Silakan upload ulang file KML.");
        }

        $parsed = json_decode(Storage::disk('local')->get($path), true);
        if (!$parsed || empty($parsed['nodes'])) {
            throw new \Exception("Data KML tidak valid atau kosong.");
        }

        // 1. Resolve OLT mappings
        $allOlts = OltDevice::all();
        $oltSolok = $allOlts->first(fn($o) => stripos($o->name, 'SOLOK') !== false) ?? $allOlts->first();
        $oltGuguak = $allOlts->first(fn($o) => stripos($o->name, 'GUGUAK') !== false);
        $oltSingkarak = $allOlts->first(fn($o) => stripos($o->name, 'SINGKARAK') !== false);

        // Allow user override OLT mapping from options
        $oltMap = [
            'default' => $options['olt_solok_id'] ?? ($oltSolok?->id),
            '02'      => $options['olt_guguak_id'] ?? ($oltGuguak?->id ?? $oltSolok?->id),
            '05'      => $options['olt_singkarak_id'] ?? ($oltSingkarak?->id ?? $oltSolok?->id),
        ];

        $autoLinkProximity = $options['auto_link_nearest'] ?? true;

        $stats = [
            'nodes_created' => 0,
            'nodes_updated' => 0,
            'cables_created' => 0,
            'cables_updated' => 0,
            'parents_linked' => 0,
        ];

        DB::beginTransaction();
        try {
            // Stage 1: Insert or Update POP & BTS Nodes
            $popMap = [];
            foreach ($parsed['nodes'] as &$nodeData) {
                if ($nodeData['node_type'] === 'POP') {
                    $oltId = $oltMap[$nodeData['olt_key']] ?? null;
                    $node = $this->upsertNode($nodeData, $oltId, null, $stats);
                    $popMap[strtolower(trim($node->name))] = $node->id;
                    $nodeData['db_id'] = $node->id;
                }
            }
            unset($nodeData);

            // Stage 2: Insert or Update ODC Nodes
            $odcMap = [];
            foreach ($parsed['nodes'] as &$nodeData) {
                if ($nodeData['node_type'] === 'ODC') {
                    $oltId = $oltMap[$nodeData['olt_key']] ?? null;

                    // Try link to POP if specified in power_from
                    $parentId = null;
                    if (!empty($nodeData['power_from_raw'])) {
                        $target = strtolower(trim($nodeData['power_from_raw']));
                        foreach ($popMap as $popName => $popId) {
                            if (str_contains($target, $popName) || str_contains($popName, $target)) {
                                $parentId = $popId;
                                break;
                            }
                        }
                    }

                    $node = $this->upsertNode($nodeData, $oltId, $parentId, $stats);
                    $odcMap[$nodeData['olt_key']][strtolower(trim($node->name))] = $node;
                    $nodeData['db_id'] = $node->id;
                }
            }
            unset($nodeData);

            // Stage 3: Insert or Update ODP, Joint Box, Pole Nodes
            foreach ($parsed['nodes'] as &$nodeData) {
                if (!in_array($nodeData['node_type'], ['POP', 'ODC'])) {
                    $oltId = $oltMap[$nodeData['olt_key']] ?? null;
                    $parentId = null;

                    // A. Resolve Parent ODC by POWER FROM
                    if (!empty($nodeData['power_from_raw'])) {
                        $pRaw = strtolower(trim($nodeData['power_from_raw']));
                        $candidates = $odcMap[$nodeData['olt_key']] ?? [];
                        
                        // Extract numbers from power from (e.g. "odc 4", "-02 ODC 4" -> 4)
                        preg_match('/(?:odc\s*|dari\s*)?([0-9]+)/i', $pRaw, $numMatch);
                        $targetNum = $numMatch[1] ?? null;

                        foreach ($candidates as $candName => $candNode) {
                            if (str_contains($pRaw, $candName)) {
                                $parentId = $candNode->id;
                                break;
                            }
                            if ($targetNum && preg_match('/(?:odc\s*)0*' . $targetNum . '(?:\b|-|\s|$)/i', $candName)) {
                                $parentId = $candNode->id;
                                break;
                            }
                        }
                    }

                    // B. Fallback: Spatial Proximity (Nearest ODC within same OLT cluster)
                    if (!$parentId && $autoLinkProximity && $nodeData['node_type'] === 'ODP' && !empty($nodeData['lat'])) {
                        $candidates = $odcMap[$nodeData['olt_key']] ?? [];
                        $minDist = 9999999;
                        $closestOdc = null;

                        foreach ($candidates as $candNode) {
                            if ($candNode->latitude && $candNode->longitude) {
                                $dist = $this->haversineMeters(
                                    $nodeData['lat'], $nodeData['lng'],
                                    $candNode->latitude, $candNode->longitude
                                );
                                if ($dist < $minDist && $dist <= 3000) { // Within 3km
                                    $minDist = $dist;
                                    $closestOdc = $candNode;
                                }
                            }
                        }

                        if ($closestOdc) {
                            $parentId = $closestOdc->id;
                        }
                    }

                    if ($parentId) {
                        $stats['parents_linked']++;
                    }

                    $node = $this->upsertNode($nodeData, $oltId, $parentId, $stats);
                    $nodeData['db_id'] = $node->id;
                }
            }
            unset($nodeData);

            // Stage 4: Insert or Update Cables (LineStrings)
            foreach ($parsed['cables'] as $cableData) {
                $slug = Str::slug($cableData['name'] ?: 'cable');
                $hash = substr(md5(json_encode($cableData['coordinates'])), 0, 6);
                $code = 'CBL-' . substr($slug, 0, 28) . '-' . $hash;
                
                $cable = NetworkCable::withTrashed()->where('code', $code)->first();
                $isNew = false;
                if (!$cable) {
                    $cable = new NetworkCable();
                    $cable->code = $code;
                    $isNew = true;
                }

                $cable->name = $cableData['name'];
                $cable->route_coordinates = $cableData['coordinates'];
                $cable->cable_color = $cableData['color'];
                $cable->length_meters = $cableData['length_meters'];
                $cable->core_count_total = $cableData['core_count'];
                $cable->core_count_used = 0;
                $cable->installation_type = $cableData['installation_type'];
                $cable->route_description = $cableData['desc'];
                $cable->status = 'active';
                $cable->notes = $cableData['desc'];
                $cable->save();

                if ($isNew) {
                    $stats['cables_created']++;
                } else {
                    $stats['cables_updated']++;
                }
            }

            DB::commit();

            // Remove temp cache file
            Storage::disk('local')->delete($path);

            return [
                'success' => true,
                'message' => "Import KML berhasil! {$stats['nodes_created']} node baru dibuat, {$stats['nodes_updated']} node diperbarui, {$stats['parents_linked']} ODP terhubung ke ODC induk, dan {$stats['cables_created']} kabel ditambahkan.",
                'stats' => $stats,
            ];

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('KML Import Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            throw new \Exception("Gagal melakukan import KML: " . $e->getMessage());
        }
    }

    /**
     * Upsert a NetworkNode record
     */
    protected function upsertNode(array $data, ?int $oltId, ?int $parentId, array &$stats): NetworkNode
    {
        // Generate consistent code based on node type and name
        $cleanName = trim($data['name']);
        $code = Str::slug($data['node_type'] . '-' . $cleanName);
        if (strlen($code) > 38) {
            $code = substr($code, 0, 32) . '-' . substr(md5($cleanName), 0, 5);
        }

        $node = NetworkNode::withTrashed()->where('name', $cleanName)->first();
        if (!$node) {
            $node = NetworkNode::withTrashed()->where('code', $code)->first();
        }

        $isNew = false;
        if (!$node) {
            $node = new NetworkNode();
            $node->code = $code;
            $isNew = true;
        }

        $node->name = $cleanName;
        $node->node_type = $data['node_type'];
        $node->latitude = $data['lat'];
        $node->longitude = $data['lng'];
        $node->status = $data['status'] ?? 'active';
        $node->notes = $data['full_desc'] ?? null;
        $node->core_color = $data['core_color'] ?? null;
        $node->tube_info = $data['tube_info'] ?? null;

        if (!empty($data['olt_port_ref'])) {
            $node->olt_port_ref = $data['olt_port_ref'];
        }

        if ($oltId) {
            $node->olt_device_id = $oltId;
        }

        if ($parentId) {
            $node->parent_node_id = $parentId;
        }

        if ($node->node_type === 'ODP' && empty($node->total_ports)) {
            $node->total_ports = 8;
        } elseif ($node->node_type === 'ODC' && empty($node->total_ports)) {
            $node->total_ports = 48;
        }

        $node->save();

        if ($isNew) {
            $stats['nodes_created']++;
        } else {
            $stats['nodes_updated']++;
        }

        return $node;
    }

    /**
     * Internal KML File Parser using XMLReader & Style Resolver
     */
    protected function parseKmlFile(string $filepath): array
    {
        if (!file_exists($filepath)) {
            throw new \Exception("File KML tidak ditemukan di server.");
        }

        // 1. First Pass: Extract Styles & LineColors
        $styles = $this->extractStyles($filepath);

        // 2. Second Pass: Extract Placemarks
        $reader = new XMLReader();
        if (!$reader->open($filepath)) {
            throw new \Exception("Gagal membaca struktur XML KML.");
        }

        $nodes = [];
        $cables = [];
        $currentFolder = '';

        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT) {
                if ($reader->localName === 'Folder') {
                    // Update folder context if available
                }

                if ($reader->localName === 'Placemark') {
                    $xml = $reader->readOuterXml();
                    $pNode = new SimpleXMLElement($xml);

                    $name = trim((string)$pNode->name);
                    $desc = trim((string)$pNode->description);
                    $styleUrl = ltrim((string)$pNode->styleUrl, '#');
                    $cleanDesc = trim(strip_tags($desc));

                    // Point (Node)
                    if (isset($pNode->Point->coordinates)) {
                        $coordStr = trim((string)$pNode->Point->coordinates);
                        $parts = explode(',', $coordStr);
                        $lng = isset($parts[0]) ? (float)$parts[0] : null;
                        $lat = isset($parts[1]) ? (float)$parts[1] : null;

                        if ($lat && $lng) {
                            $nodeType = $this->determineNodeType($name);
                            $oltKey = $this->determineOltKey($name);
                            $parsedNote = $this->parseNoteDetails($cleanDesc);

                            $nodes[] = [
                                'name' => $name,
                                'node_type' => $nodeType,
                                'lat' => $lat,
                                'lng' => $lng,
                                'olt_key' => $oltKey,
                                'power_from_raw' => $parsedNote['power_from'],
                                'tube_info' => $parsedNote['tube_info'],
                                'core_color' => $parsedNote['core_color'],
                                'olt_port_ref' => $parsedNote['olt_port_ref'],
                                'full_desc' => $cleanDesc,
                                'status' => 'active',
                            ];
                        }
                    }

                    // LineString (Cable)
                    elseif (isset($pNode->LineString->coordinates)) {
                        $coordStr = trim((string)$pNode->LineString->coordinates);
                        $coords = $this->parseCoordinatesLine($coordStr);

                        if (count($coords) >= 2) {
                            $color = $styles[$styleUrl] ?? '#2563eb';
                            $lengthMeters = $this->calculateTotalDistance($coords);
                            $coreCount = $this->determineCoreCount($name, $cleanDesc);

                            $cables[] = [
                                'name' => $name ?: 'Kabel FO Distribusi',
                                'coordinates' => $coords,
                                'color' => $color,
                                'length_meters' => $lengthMeters,
                                'core_count' => $coreCount,
                                'installation_type' => 'Aerial',
                                'desc' => $cleanDesc,
                            ];
                        }
                    }
                }
            }
        }

        $reader->close();

        return [
            'nodes' => $nodes,
            'cables' => $cables,
        ];
    }

    /**
     * Extract line styles and convert AABBGGRR hex to #RRGGBB
     */
    protected function extractStyles(string $filepath): array
    {
        $reader = new XMLReader();
        if (!$reader->open($filepath)) return [];

        $styles = [];
        $styleMapLinks = [];

        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT) {
                if ($reader->localName === 'Style' || $reader->localName === 'CascadingStyle') {
                    $id = $reader->getAttribute('kml:id') ?? $reader->getAttribute('id');
                    if ($id) {
                        $xml = new SimpleXMLElement($reader->readOuterXml());
                        $lineColor = (string)($xml->Style->LineStyle->color ?? $xml->LineStyle->color ?? '');
                        if ($lineColor && strlen($lineColor) === 8) {
                            // AABBGGRR -> #RRGGBB
                            $rr = substr($lineColor, 6, 2);
                            $gg = substr($lineColor, 4, 2);
                            $bb = substr($lineColor, 2, 2);
                            $styles[$id] = "#{$rr}{$gg}{$bb}";
                        }
                    }
                } elseif ($reader->localName === 'StyleMap') {
                    $id = $reader->getAttribute('kml:id') ?? $reader->getAttribute('id');
                    if ($id) {
                        $xml = new SimpleXMLElement($reader->readOuterXml());
                        foreach ($xml->Pair as $pair) {
                            if ((string)$pair->key === 'normal') {
                                $styleMapLinks[$id] = ltrim((string)$pair->styleUrl, '#');
                            }
                        }
                    }
                }
            }
        }
        $reader->close();

        // Resolve StyleMaps
        foreach ($styleMapLinks as $mapId => $targetStyleId) {
            if (isset($styles[$targetStyleId])) {
                $styles[$mapId] = $styles[$targetStyleId];
            }
        }

        return $styles;
    }

    /**
     * Determine node type from name
     */
    protected function determineNodeType(string $name): string
    {
        $uName = strtoupper($name);
        if (str_starts_with($uName, 'ODP')) return 'ODP';
        if (str_starts_with($uName, 'ODC')) return 'ODC';
        if (str_starts_with($uName, 'BTS') || str_starts_with($uName, 'POP') || str_starts_with($uName, 'HEADEND')) return 'POP';
        if (str_starts_with($uName, 'JB') || str_contains($uName, 'CLOSURE')) return 'JOINT_CLOSURE';
        if (str_starts_with($uName, 'TIANG') || str_starts_with($uName, 'TB') || str_starts_with($uName, 'CROSING')) return 'POLE';
        
        if (str_contains($uName, 'ODP')) return 'ODP';
        if (str_contains($uName, 'ODC')) return 'ODC';
        if (str_contains($uName, 'BTS')) return 'POP';

        return 'POLE';
    }

    /**
     * Determine OLT key from node name suffix
     */
    protected function determineOltKey(string $name): string
    {
        if (preg_match('/-02(\b|\s|$)/i', $name)) {
            return '02'; // OLTC320-CINOX-GUGUAK
        }
        if (preg_match('/-05(\b|\s|$)/i', $name)) {
            return '05'; // OLTC320-CINOX-SINGKARAK
        }
        return 'default'; // OLT ZTE C300 KOTA SOLOK
    }

    /**
     * Parse Note details: POWER FROM, TUBE, CORE, INTERFACE
     */
    protected function parseNoteDetails(string $desc): array
    {
        $powerFrom = null;
        $tubeInfo = null;
        $coreColor = null;
        $oltPortRef = null;

        if (preg_match('/(?:POWER\s*(?:FROM|DARI)|SUMBER(?:\s*DARI)?|DARI)\s*[:=]?\s*([^\r\n,]+)/i', $desc, $m)) {
            $powerFrom = trim($m[1]);
        }

        if (preg_match('/TUBE\s*[:=]?\s*([a-zA-Z0-9]+)/i', $desc, $m)) {
            $tubeInfo = 'TUBE ' . strtoupper(trim($m[1]));
        }

        if (preg_match('/CORE\s*[:=]?\s*([a-zA-Z0-9]+)/i', $desc, $m)) {
            $coreColor = strtoupper(trim($m[1]));
        }

        if (preg_match('/(?:interface|pon|port)\s*([0-9]+\/[0-9]+\/[0-9]+|[0-9]+\/[0-9]+)/i', $desc, $m)) {
            $oltPortRef = trim($m[1]);
        }

        return [
            'power_from' => $powerFrom,
            'tube_info' => $tubeInfo,
            'core_color' => $coreColor,
            'olt_port_ref' => $oltPortRef,
        ];
    }

    /**
     * Parse coordinate string into [[lat, lng], ...]
     */
    protected function parseCoordinatesLine(string $coordStr): array
    {
        $rawPoints = preg_split('/[\s\r\n]+/', trim($coordStr));
        $coords = [];

        foreach ($rawPoints as $pt) {
            $parts = explode(',', $pt);
            if (count($parts) >= 2) {
                $lng = (float)$parts[0];
                $lat = (float)$parts[1];
                if ($lat != 0 && $lng != 0) {
                    $coords[] = [$lat, $lng];
                }
            }
        }

        return $coords;
    }

    /**
     * Determine core count from cable name and desc
     */
    protected function determineCoreCount(string $name, string $desc): int
    {
        $text = strtoupper($name . ' ' . $desc);
        if (preg_match('/([0-9]+)\s*CORE/i', $text, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/ADSS\s*([0-9]+)/i', $text, $m)) {
            return (int)$m[1];
        }
        if (str_contains($text, '12C') || str_contains($text, '12 C')) return 12;
        if (str_contains($text, '24C') || str_contains($text, '24 C')) return 24;
        if (str_contains($text, '6C') || str_contains($text, '6 C')) return 6;

        return 6;
    }

    /**
     * Calculate total distance of polyline in meters
     */
    protected function calculateTotalDistance(array $coords): float
    {
        $total = 0;
        for ($i = 0; $i < count($coords) - 1; $i++) {
            $total += $this->haversineMeters($coords[$i][0], $coords[$i][1], $coords[$i + 1][0], $coords[$i + 1][1]);
        }
        return round($total, 2);
    }

    /**
     * Haversine formula in meters
     */
    protected function haversineMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $R * $c;
    }

    /**
     * Recursive delete directory
     */
    protected function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            (is_dir("$dir/$file")) ? $this->deleteDirectory("$dir/$file") : unlink("$dir/$file");
        }
        rmdir($dir);
    }
}
