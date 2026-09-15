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
    public function preview(UploadedFile $file, string $target = 'all'): array
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

        // Store parsed data temporarily in storage/app/private/kml_imports
        $token = Str::uuid()->toString();
        $targetDir = storage_path('app/private/kml_imports');
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0775, true);
        }

        $encodedData = json_encode($parsed);
        $written = Storage::disk('local')->put("kml_imports/{$token}.json", $encodedData);
        if (!$written) {
            // Direct write fallback
            $fallbackFile = $targetDir . DIRECTORY_SEPARATOR . "{$token}.json";
            @file_put_contents($fallbackFile, $encodedData);
            if (!file_exists($fallbackFile)) {
                throw new \Exception("Gagal menyimpan file cache sesi import KML. Pastikan direktori storage/app memiliki izin tulis.");
            }
        }

        // Clean up old import sessions (> 2 hours)
        $oldFiles = glob($targetDir . DIRECTORY_SEPARATOR . '*.json');
        if (!empty($oldFiles)) {
            $now = time();
            foreach ($oldFiles as $of) {
                if ($now - filemtime($of) > 7200) {
                    @unlink($of);
                }
            }
        }

        // Available OLTs in system
        $availableOlts = OltDevice::select('id', 'name', 'ip_address')->get()->toArray();

        // Count totals
        $allNodesCount = count($parsed['nodes']);
        $cablesCount = count($parsed['cables']);

        return [
            'token' => $token,
            'import_target' => $target,
            'summary' => [
                'total_nodes' => $allNodesCount,
                'total_cables' => $cablesCount,
                'odp_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'ODP')),
                'odc_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'ODC')),
                'pop_count' => count(array_filter($parsed['nodes'], fn($n) => $n['node_type'] === 'POP')),
            ],
            'sample_nodes' => array_slice($parsed['nodes'], 0, 30),
            'sample_cables' => array_slice($parsed['cables'], 0, 20),
            'available_olts' => $availableOlts,
        ];
    }

    /**
     * Execute Import using stored preview token with target filter and simplified logic
     */
    public function execute(string $token, array $options = []): array
    {
        $path = "kml_imports/{$token}.json";
        $content = null;

        if (Storage::disk('local')->exists($path)) {
            $content = Storage::disk('local')->get($path);
        } else {
            // Fallback checking direct disk locations
            $fallbackPaths = [
                storage_path("app/private/kml_imports/{$token}.json"),
                storage_path("app/kml_imports/{$token}.json"),
            ];
            foreach ($fallbackPaths as $fp) {
                if (file_exists($fp)) {
                    $content = @file_get_contents($fp);
                    break;
                }
            }
        }

        if (!$content) {
            throw new \Exception("Sesi import KML sudah kadaluarsa atau file cache tidak ditemukan. Silakan upload ulang file KML.");
        }

        $parsed = json_decode($content, true);
        if (!$parsed) {
            throw new \Exception("Data KML tidak valid atau kosong.");
        }

        // Target: 'all' | 'odp' | 'odc' | 'cable'
        $target = $options['import_target'] ?? 'all';
        $targetOltId = !empty($options['target_olt_id']) ? (int) $options['target_olt_id'] : null;
        $defaultParentId = !empty($options['default_parent_id']) ? (int) $options['default_parent_id'] : null;

        $stats = [
            'nodes_created' => 0,
            'nodes_updated' => 0,
            'cables_created' => 0,
            'cables_updated' => 0,
        ];

        DB::beginTransaction();
        try {
            // ── 1. IMPORT ODP SAJA ──────────────────────────────────────────
            if ($target === 'odp') {
                foreach ($parsed['nodes'] as $nodeData) {
                    // Paksa semua point menjadi ODP
                    $nodeData['node_type'] = 'ODP';
                    $this->upsertNode($nodeData, $targetOltId, $defaultParentId, $stats);
                }
            }
            // ── 2. IMPORT ODC SAJA ──────────────────────────────────────────
            elseif ($target === 'odc') {
                foreach ($parsed['nodes'] as $nodeData) {
                    // Paksa semua point menjadi ODC
                    $nodeData['node_type'] = 'ODC';
                    $this->upsertNode($nodeData, $targetOltId, null, $stats);
                }
            }
            // ── 3. IMPORT KABEL SAJA ────────────────────────────────────────
            elseif ($target === 'cable') {
                $this->importCablesList($parsed['cables'], $stats);
            }
            // ── 4. IMPORT SEMUA DATA (ODP, ODC, POP, KABEL) ─────────────────
            else {
                foreach ($parsed['nodes'] as $nodeData) {
                    $this->upsertNode($nodeData, $targetOltId, null, $stats);
                }
                $this->importCablesList($parsed['cables'], $stats);
            }

            DB::commit();

            // Remove temp cache file
            Storage::disk('local')->delete($path);

            $msgParts = [];
            if ($stats['nodes_created'] > 0 || $stats['nodes_updated'] > 0) {
                $msgParts[] = "{$stats['nodes_created']} node baru dibuat" . ($stats['nodes_updated'] > 0 ? ", {$stats['nodes_updated']} diperbarui" : "");
            }
            if ($stats['cables_created'] > 0 || $stats['cables_updated'] > 0) {
                $msgParts[] = "{$stats['cables_created']} kabel baru dibuat" . ($stats['cables_updated'] > 0 ? ", {$stats['cables_updated']} diperbarui" : "");
            }
            $detailMsg = !empty($msgParts) ? implode(' dan ', $msgParts) : 'Tidak ada data baru yang diproses';

            return [
                'success' => true,
                'message' => "Import KML berhasil! {$detailMsg}. Anda dapat mengedit relasi node induk atau spesifikasi kabel sewaktu-waktu.",
                'stats' => $stats,
            ];

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('KML Import Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            throw new \Exception("Gagal melakukan import KML: " . $e->getMessage());
        }
    }

    /**
     * Helper to import LineString cables and auto-generate core records
     */
    protected function importCablesList(array $cables, array &$stats): void
    {
        foreach ($cables as $cableData) {
            $slug = Str::slug($cableData['name'] ?: 'cable');
            $hash = substr(md5(json_encode($cableData['coordinates'])), 0, 6);
            $code = 'CBL-' . substr($slug, 0, 26) . '-' . $hash;

            $cable = NetworkCable::where('code', $code)->first();
            $wasTrashed = false;
            if (!$cable) {
                $cable = NetworkCable::onlyTrashed()->where('code', $code)->first();
                if (!$cable) {
                    $cable = NetworkCable::onlyTrashed()->where('code', 'LIKE', $code . '_deleted_%')->first();
                }
                if ($cable) {
                    $cable->restore();
                    $wasTrashed = true;
                }
            }

            $isNew = false;
            if (!$cable) {
                $cable = new NetworkCable();
                $isNew = true;
            } elseif ($cable->trashed()) {
                $cable->restore();
                $wasTrashed = true;
            }

            $cable->code = $code;
            $cable->deleted_at = null;

            $coreCount = (int) ($cableData['core_count'] ?: 24);
            $cable->name = $cableData['name'] ?: 'Bentangan Kabel Fiber';
            $cable->route_coordinates = $cableData['coordinates'];
            $cable->cable_color = $cableData['color'] ?: '#2563eb';
            $cable->length_meters = (float) $cableData['length_meters'];
            $cable->core_count_total = $coreCount;
            $cable->core_count_used = $cable->core_count_used ?? 0;
            $cable->installation_type = $cableData['installation_type'] ?? 'Aerial';
            $cable->route_description = $cableData['desc'] ?? null;
            $cable->status = 'active';
            $cable->notes = $cableData['desc'] ?? null;
            $cable->save();

            // Generate Cores if new or if cores missing
            $existingCoresCount = DB::table('network_cable_cores')->where('cable_id', $cable->id)->count();
            if ($isNew || $wasTrashed || $existingCoresCount === 0) {
                if ($existingCoresCount === 0) {
                    $this->generateDefaultCoresForCable($cable);
                }
                $stats['cables_created']++;
            } else {
                $stats['cables_updated']++;
            }
        }
    }

    /**
     * Generate standard TIA-598-A cores for imported cable
     */
    protected function generateDefaultCoresForCable(NetworkCable $cable): void
    {
        $fiberColors = [
            1 => 'Biru', 2 => 'Oranye', 3 => 'Hijau', 4 => 'Cokelat',
            5 => 'Abu-abu', 6 => 'Putih', 7 => 'Merah', 8 => 'Hitam',
            9 => 'Kuning', 10 => 'Ungu', 11 => 'Pink', 12 => 'Toska'
        ];

        $totalCores = $cable->core_count_total ?: 24;
        $tubeCount = ($totalCores >= 48) ? 4 : 2;
        $coresPerTube = (int) ceil($totalCores / $tubeCount);

        $coresData = [];
        for ($c = 1; $c <= $totalCores; $c++) {
            $tubeNumber = (int) ceil($c / $coresPerTube);
            $tubeColor = $fiberColors[(($tubeNumber - 1) % 12) + 1] ?? 'Biru';

            $coreInTubeIndex = (($c - 1) % $coresPerTube) + 1;
            $coreColor = $fiberColors[(($coreInTubeIndex - 1) % 12) + 1] ?? 'Biru';

            $coresData[] = [
                'cable_id' => $cable->id,
                'core_number' => $c,
                'tube_number' => $tubeNumber,
                'tube_color' => $tubeColor,
                'color' => $coreColor,
                'status' => 'available',
                'destination_type' => 'UNASSIGNED',
                'destination_name' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (!empty($coresData)) {
            DB::table('network_cable_cores')->insert($coresData);
        }
    }

    /**
     * Upsert a NetworkNode record
     */
    protected function upsertNode(array $data, ?int $oltId, ?int $parentId, array &$stats): NetworkNode
    {
        // Generate consistent code based on node type and name
        $cleanName = trim($data['name']);
        $cleanName = preg_replace('/\s+/', ' ', $cleanName);
        if (preg_match('/^OD\s+\d+/i', $cleanName)) {
            $cleanName = preg_replace('/^OD\s+/i', 'ODP ', $cleanName);
        }
        if (preg_match('/^ODP\s*[I|l](\d+)/i', $cleanName)) {
            $cleanName = preg_replace('/^ODP\s*[I|l](\d+)/i', 'ODP 1$1', $cleanName);
        }
        $cleanName = preg_replace('/^(ODP|ODC|POP)[-_]?(\d+)/i', '$1 $2', $cleanName);
        $code = Str::slug($data['node_type'] . '-' . $cleanName);
        if (strlen($code) > 38) {
            $code = substr($code, 0, 32) . '-' . substr(md5($cleanName), 0, 5);
        }

        // 1. Search active first, then search trashed (in case previously deleted)
        $node = NetworkNode::where('name', $cleanName)->first();
        if (!$node) {
            $node = NetworkNode::where('code', $code)->first();
        }

        $wasTrashed = false;
        if (!$node) {
            $node = NetworkNode::onlyTrashed()->where('name', $cleanName)->first();
            if (!$node) {
                $node = NetworkNode::onlyTrashed()->where('code', $code)->first();
            }
            if (!$node) {
                $node = NetworkNode::onlyTrashed()->where('code', 'LIKE', $code . '_deleted_%')->first();
            }
            if ($node) {
                $node->restore();
                $wasTrashed = true;
            }
        }

        $isNew = false;
        if (!$node) {
            $node = new NetworkNode();
            $isNew = true;
        } elseif ($node->trashed()) {
            $node->restore();
            $wasTrashed = true;
        }

        // Always ensure clean code & active status
        $node->code = $code;
        $node->deleted_at = null;
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

        // Ensure physical ports exist
        $this->ensurePhysicalPorts($node);

        if ($isNew || $wasTrashed) {
            $stats['nodes_created']++;
        } else {
            $stats['nodes_updated']++;
        }

        return $node;
    }

    /**
     * Ensure physical ports exist for an imported node
     */
    protected function ensurePhysicalPorts(NetworkNode $node): void
    {
        if ($node->total_ports <= 0) return;

        $existingCount = DB::table('network_ports')->where('node_id', $node->id)->count();
        if ($existingCount >= $node->total_ports) return;

        $existingPorts = DB::table('network_ports')
            ->where('node_id', $node->id)
            ->pluck('port_number')
            ->map(fn($v) => (int)$v)
            ->toArray();

        $newPorts = [];
        for ($i = 1; $i <= $node->total_ports; $i++) {
            if (!in_array($i, $existingPorts)) {
                $newPorts[] = [
                    'node_id'     => $node->id,
                    'port_number' => (string) $i,
                    'port_type'   => $node->node_type === 'ODP' ? 'SC_APC' : 'PON',
                    'status'      => 'available',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ];
            }
        }

        if (!empty($newPorts)) {
            DB::table('network_ports')->insert($newPorts);
        }
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
                    $name = preg_replace('/\s+/', ' ', $name);
                    if (preg_match('/^OD\s+\d+/i', $name)) {
                        $name = preg_replace('/^OD\s+/i', 'ODP ', $name);
                    }
                    if (preg_match('/^ODP\s*[I|l](\d+)/i', $name)) {
                        $name = preg_replace('/^ODP\s*[I|l](\d+)/i', 'ODP 1$1', $name);
                    }
                    $name = preg_replace('/^(ODP|ODC|POP)[-_]?(\d+)/i', '$1 $2', $name);
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
