<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\NetworkNode;
use App\Models\OntRegistration;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class SobokScraperService
{
    /**
     * Daftar domain Sobok yang didukung (Utama & Cadangan / Failover)
     */
    protected array $domains = [
        'sobok.cinoxmedianet.id', // Domain Utama
        'sobok.cinoxmedia.net',    // Domain Cadangan (Fallback)
    ];

    protected ?string $lastUsedDomain = null;

    /**
     * Dapatkan domain aktif yang terakhir berhasil digunakan
     */
    public function getLastUsedDomain(): ?string
    {
        return $this->lastUsedDomain;
    }

    /**
     * Scrape and parse customer data from Sobok (konfig.php)
     */
    public function scrape(string $username = 'jasen', string $password = 'jasen2401'): array
    {
        return $this->executeWithFailover(function (string $domain) use ($username, $password) {
            $tempCookieFile = tempnam(sys_get_temp_dir(), 'sobok_cookie_');

            try {
                // 1. Authenticate / Login to Sobok
                $loginSuccess = $this->authenticate($domain, $username, $password, $tempCookieFile);
                if (!$loginSuccess) {
                    throw new \Exception("Gagal login ke sistem Sobok di {$domain}.");
                }

                // 2. Fetch all customers from konfig.php using keyword = '%'
                $html = $this->fetchKonfigHtml($domain, $tempCookieFile);
                if (empty($html)) {
                    throw new \Exception("Gagal mengambil data dari halaman konfig.php Sobok di {$domain}.");
                }

                // 3. Parse HTML table
                $parsedRecords = $this->parseHtml($html);

                // 4. Enrich & Match with Fiber-UNMS Database
                $enriched = $this->enrichAndMatchRecords($parsedRecords);
                $enriched['domain_used'] = $domain;

                return $enriched;
            } finally {
                if (file_exists($tempCookieFile)) {
                    @unlink($tempCookieFile);
                }
            }
        });
    }

    /**
     * Sinkronisasi Status Layanan Pelanggan (OPEN vs BLOKIR) dari Sobok (daftar_pelanggan.php)
     */
    public function syncServiceStatuses(string $username = 'jasen', string $password = 'jasen2401'): array
    {
        return $this->executeWithFailover(function (string $domain) use ($username, $password) {
            $tempCookieFile = tempnam(sys_get_temp_dir(), 'sobok_dp_cookie_');

            try {
                // 1. Login ke Sobok
                $loginSuccess = $this->authenticate($domain, $username, $password, $tempCookieFile);
                if (!$loginSuccess) {
                    throw new \Exception("Gagal login ke sistem Sobok di {$domain}.");
                }

                // 2. Ambil HTML daftar_pelanggan.php (POST keyword=%)
                $html = $this->fetchDaftarPelangganHtml($domain, $tempCookieFile);
                if (empty($html)) {
                    throw new \Exception("Gagal mengambil data dari halaman daftar_pelanggan.php Sobok di {$domain}.");
                }

                // 3. Parse tabel daftar_pelanggan
                $parsedSobok = $this->parseDaftarPelangganHtml($html);
                if (empty($parsedSobok)) {
                    throw new \Exception("Tidak ada baris data yang ditemukan pada daftar_pelanggan.php Sobok.");
                }

                // 4. Bangun Indeks Pencarian Sobok
                $lookupMap = [];
                foreach ($parsedSobok as $row) {
                    $u = strtoupper(str_replace(' ', '', $row['username']));
                    $n = strtoupper(trim(preg_replace('/\s+/', ' ', $row['name'])));
                    $cleanName = strtoupper(trim(preg_replace('/\([^\)]+\)/', '', $row['name'])));

                    if ($u) {
                        $lookupMap['user:' . $u] = $row;
                        if (preg_match('/^CMN0*(\d+)$/i', $u, $m)) {
                            $lookupMap['cmn_num:' . (int)$m[1]] = $row;
                        }
                    }

                    if ($n) {
                        $lookupMap['name:' . $n] = $row;
                    }
                    if ($cleanName && $cleanName !== $n) {
                        $lookupMap['name:' . $cleanName] = $row;
                    }
                }

                // 5. Muat seluruh customer UNMS beserta layanannya
                $customers = Customer::with('services')->get();

                $now = now();
                $matchedCount = 0;
                $openCount = 0;
                $blockedCount = 0;
                $unmatchedCount = 0;

                $serviceUpdates = [];
                $customerStatusUpdates = [];

                foreach ($customers as $c) {
                    $cNum = strtoupper(str_replace(' ', '', trim($c->customer_number ?? '')));
                    $cName = strtoupper(trim(preg_replace('/\s+/', ' ', $c->name ?? '')));
                    $primaryService = $c->services->first();
                    $pppoeUser = $primaryService?->pppoe_username ? strtoupper(str_replace(' ', '', $primaryService->pppoe_username)) : '';

                    $match = null;
                    if ($cNum && isset($lookupMap['user:' . $cNum])) {
                        $match = $lookupMap['user:' . $cNum];
                    } elseif ($pppoeUser && isset($lookupMap['user:' . $pppoeUser])) {
                        $match = $lookupMap['user:' . $pppoeUser];
                    } elseif (preg_match('/^CMN0*(\d+)$/i', $cNum, $m) && isset($lookupMap['cmn_num:' . (int)$m[1]])) {
                        $match = $lookupMap['cmn_num:' . (int)$m[1]];
                    } elseif ($cName && isset($lookupMap['name:' . $cName])) {
                        $match = $lookupMap['name:' . $cName];
                    }

                    if ($match) {
                        $matchedCount++;
                        $isBlocked = $match['status'] === 'BLOKIR';
                        if ($isBlocked) {
                            $blockedCount++;
                        } else {
                            $openCount++;
                        }

                        $canonicalServiceStatus = $isBlocked ? 'BLOKIR' : 'OPEN';
                        $crmStatus = $isBlocked ? 'isolated' : 'active';

                        if ($primaryService) {
                            $hasServiceChanged = ($primaryService->sobok_service_status !== $canonicalServiceStatus)
                                || ($primaryService->status !== $crmStatus)
                                || (!empty($match['profile']) && $primaryService->sobok_profile !== $match['profile']);

                            if ($hasServiceChanged) {
                                $serviceUpdates[] = [
                                    'id'                   => $primaryService->id,
                                    'sobok_service_status' => $canonicalServiceStatus,
                                    'sobok_profile'        => $match['profile'] ?: $primaryService->sobok_profile,
                                    'sobok_sync_at'        => $now,
                                    'status'               => $crmStatus,
                                ];
                            }
                        }

                        if ($c->status !== $crmStatus) {
                            $customerStatusUpdates[] = [
                                'id'     => $c->id,
                                'status' => $crmStatus,
                            ];
                        }
                    } else {
                        $unmatchedCount++;
                    }
                }

                // 6. Jalankan Bulk Update HANYA jika ada data yang berubah (Ultra-Lightweight)
                if (!empty($serviceUpdates) || !empty($customerStatusUpdates)) {
                    DB::transaction(function () use ($serviceUpdates, $customerStatusUpdates) {
                        foreach ($serviceUpdates as $up) {
                            CustomerService::where('id', $up['id'])->update([
                                'sobok_service_status' => $up['sobok_service_status'],
                                'sobok_profile'        => $up['sobok_profile'],
                                'sobok_sync_at'        => $up['sobok_sync_at'],
                                'status'               => $up['status'],
                            ]);
                        }

                        foreach ($customerStatusUpdates as $up) {
                            Customer::where('id', $up['id'])->update([
                                'status' => $up['status'],
                            ]);
                        }
                    });
                }

                $summary = [
                    'status'             => 'success',
                    'domain_used'        => $domain,
                    'total_sobok'        => count($parsedSobok),
                    'total_unms'         => $customers->count(),
                    'matched'            => $matchedCount,
                    'open_count'         => $openCount,
                    'blocked_count'      => $blockedCount,
                    'unmatched'          => $unmatchedCount,
                    'synced_at'          => $now->toIso8601String(),
                    'synced_at_human'    => $now->diffForHumans(),
                ];

                Cache::forever('sobok_service_status_meta', $summary);

                Log::info("Sobok Service Status Synced successfully via {$domain}: {$matchedCount} matched ({$openCount} Open, {$blockedCount} Blokir)");

                return $summary;
            } finally {
                if (file_exists($tempCookieFile)) {
                    @unlink($tempCookieFile);
                }
            }
        });
    }

    /**
     * Eksekusi pemanggilan Sobok dengan toleransi kegagalan dan failover otomatis
     */
    protected function executeWithFailover(callable $callback)
    {
        $lastException = null;

        foreach ($this->domains as $domain) {
            try {
                $result = $callback($domain);
                $this->lastUsedDomain = $domain;
                return $result;
            } catch (\Throwable $e) {
                $lastException = $e;
                Log::warning("Sobok Access Error on {$domain}: {$e->getMessage()}. Mencoba domain cadangan...");
            }
        }

        throw new \Exception("Gagal menghubungi seluruh server Sobok (Domain: " . implode(', ', $this->domains) . "). Error: " . $lastException?->getMessage());
    }

    /**
     * Authenticate session via cURL
     */
    protected function authenticate(string $domain, string $username, string $password, string $cookieFile): bool
    {
        $url = "https://{$domain}/index.php";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'username' => $username,
                'password' => $password,
                'login'    => 'LOGIN',
            ]),
            CURLOPT_COOKIEJAR      => $cookieFile,
            CURLOPT_COOKIEFILE     => $cookieFile,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode >= 200 && $httpCode < 400 && !empty($response);
    }

    /**
     * Fetch HTML page with all customer records (POST keyword=%)
     */
    protected function fetchKonfigHtml(string $domain, string $cookieFile): string
    {
        $url = "https://{$domain}/halaman_viewer/konfig.php";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'keyword' => '%',
                'cari'    => 'Searching',
            ]),
            CURLOPT_COOKIEFILE     => $cookieFile,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        return $response ?: '';
    }

    /**
     * Fetch HTML daftar_pelanggan.php (POST keyword=%)
     */
    protected function fetchDaftarPelangganHtml(string $domain, string $cookieFile): string
    {
        $url = "https://{$domain}/halaman_viewer/daftar_pelanggan.php";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'keyword' => '%',
                'cari'    => 'Searching',
            ]),
            CURLOPT_COOKIEFILE     => $cookieFile,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        return $response ?: '';
    }

    /**
     * Parse HTML DOM daftar_pelanggan.php ke dalam array terstruktur
     */
    protected function parseDaftarPelangganHtml(string $html): array
    {
        $records = [];
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML($html);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $rows = $xpath->query('//table//tr');

        if (!$rows || $rows->length === 0) {
            return [];
        }

        foreach ($rows as $tr) {
            $tds = $xpath->query('.//td', $tr);
            if ($tds->length >= 3) {
                $name     = trim($tds->item(0)->textContent ?? '');
                $username = trim($tds->item(1)->textContent ?? '');
                $status   = strtoupper(trim($tds->item(2)->textContent ?? ''));
                $types    = $tds->length > 3 ? trim($tds->item(3)->textContent ?? '') : '';
                $profile  = $tds->length > 4 ? trim($tds->item(4)->textContent ?? '') : '';

                if (empty($name) && empty($username)) {
                    continue;
                }

                $records[] = [
                    'name'     => $name,
                    'username' => $username,
                    'status'   => $status === 'BLOKIR' ? 'BLOKIR' : 'OPEN',
                    'type'     => $types,
                    'profile'  => $profile,
                ];
            }
        }

        return $records;
    }

    /**
     * Parse HTML DOM into structured customer array (konfig.php)
     */
    protected function parseHtml(string $html): array
    {
        $records = [];
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML($html);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $rows = $xpath->query('//table//tr');

        if (!$rows || $rows->length === 0) {
            return [];
        }

        foreach ($rows as $tr) {
            $tds = $xpath->query('.//td', $tr);
            if ($tds->length < 8) {
                continue;
            }

            $rawId       = trim($tds->item(0)->textContent ?? '');
            $name        = trim($tds->item(1)->textContent ?? '');
            $odp         = trim($tds->item(2)->textContent ?? '');
            $address     = trim($tds->item(3)->textContent ?? '');
            $olt         = trim($tds->item(4)->textContent ?? '');
            $sn          = trim($tds->item(5)->textContent ?? '');
            $interface   = trim($tds->item(6)->textContent ?? '');
            $portOnu     = trim($tds->item(7)->textContent ?? '');
            $vlanId      = $tds->length > 8 ? trim($tds->item(8)->textContent ?? '') : '';
            $redaman     = $tds->length > 9 ? trim($tds->item(9)->textContent ?? '') : '';

            // Clean redaman value e.g. "-19.50 dBm" -> -19.50
            $rxPower = null;
            if (preg_match('/-?\d+(\.\d+)?/', $redaman, $rm)) {
                $rxPower = (float) $rm[0];
            }

            if (empty($name) && empty($sn) && empty($rawId)) {
                continue;
            }

            $records[] = [
                'raw_id'      => $rawId,
                'name'        => $name,
                'raw_odp'     => $odp,
                'address'     => $address,
                'olt'         => $olt,
                'onu_serial'  => $sn,
                'interface'   => $interface,
                'port_onu'    => $portOnu,
                'vlan_id'     => $vlanId,
                'redaman'     => $redaman,
                'rx_power'    => $rxPower,
            ];
        }

        return $records;
    }

    /**
     * Enrich records with normalization, ODP matching, and UNMS duplication check
     */
    protected function enrichAndMatchRecords(array $records): array
    {
        // 1. Preload UNMS customer numbers & ONU serial numbers for ultra-fast lookup
        $existingCustomerNumbers = Customer::pluck('customer_number')
            ->map(fn($num) => strtoupper(str_replace(' ', '', trim($num))))
            ->flip()
            ->all();

        $existingSnCustomerMap = [];
        $servicesWithSn = CustomerService::whereNotNull('onu_serial')
            ->with('customer:id,name,customer_number')
            ->get();
        foreach ($servicesWithSn as $srv) {
            $snClean = strtoupper(trim($srv->onu_serial));
            if ($snClean && $srv->customer) {
                $existingSnCustomerMap[$snClean] = $srv->customer->name . ' (' . $srv->customer->customer_number . ')';
            }
        }

        // 2. Preload ODP nodes from UNMS
        $odpNodes = NetworkNode::where('node_type', 'ODP')
            ->select('id', 'name', 'code', 'total_ports', 'used_ports')
            ->get();

        // Index ODP nodes by extracted digits and exact uppercase names
        $odpMapByNum = [];
        $odpMapByName = [];
        foreach ($odpNodes as $node) {
            $nameClean = strtoupper(str_replace([' ', '-', '_'], '', $node->name));
            $codeClean = strtoupper(str_replace([' ', '-', '_'], '', $node->code ?? ''));
            $odpMapByName[$nameClean] = $node;
            if ($codeClean) {
                $odpMapByName[$codeClean] = $node;
            }

            if (preg_match('/(\d+)/', $node->name, $nm)) {
                $odpMapByNum[(int)$nm[1]] = $node;
            } elseif ($node->code && preg_match('/(\d+)/', $node->code, $nm)) {
                $odpMapByNum[(int)$nm[1]] = $node;
            }
        }

        // 3. Preload all live ONUs detected across OLT devices (from telemetry snapshots)
        $oltOnuMap = [];
        $oltDevices = \App\Models\OltDevice::whereNotNull('last_telemetry_snapshot')->get();
        foreach ($oltDevices as $dev) {
            $snap = $dev->last_telemetry_snapshot ?? [];
            $onus = array_merge($snap['onu_list'] ?? [], $snap['unconfigured_onus'] ?? []);
            foreach ($onus as $so) {
                $snKey = strtoupper(trim($so['serial_number'] ?? ''));
                if ($snKey) {
                    $oltOnuMap[$snKey] = [
                        'olt_id'         => $dev->id,
                        'olt_name'       => $dev->name,
                        'port'           => $so['port'] ?? ($so['interface'] ?? ($so['detected_port'] ?? null)),
                        'status'         => $so['status'] ?? ($so['onu_status'] ?? 'Online'),
                        'rx_power'       => $so['rx_power'] ?? null,
                        'tx_power'       => $so['tx_power'] ?? null,
                        'distance'       => $so['distance_meters'] ?? null,
                        'vendor'         => $so['vendor'] ?? null,
                        'model'          => $so['model'] ?? null,
                    ];
                }
            }
        }

        $stats = [
            'total_records'             => count($records),
            'valid_cmn_count'           => 0,
            'needs_normalization_count' => 0,
            'no_odp_count'              => 0,
            'has_odp_count'             => 0,
            'already_exists_count'      => 0,
            'new_records_count'         => 0,
            'registered_in_olt_count'   => 0,
            'not_in_olt_count'          => 0,
        ];

        $enrichedRecords = [];

        foreach ($records as $index => $row) {
            $rawId = $row['raw_id'];
            $cleanRawId = strtoupper(trim($rawId));

            // Determine ID Normalization
            // Valid CMN formats: "CMN 0001", "CMN0001", "CMN9806"
            $normalizedId = $cleanRawId;
            $needsNormalization = false;

            if (preg_match('/^CMN\s*(\d+)$/i', $cleanRawId, $m)) {
                $num = (int)$m[1];
                $normalizedId = sprintf('CMN%04d', $num);
                $stats['valid_cmn_count']++;
            } elseif (preg_match('/^\d+$/', $cleanRawId)) {
                // Pure numeric ID like "8061" or "77"
                $num = (int)$cleanRawId;
                $normalizedId = sprintf('CMN%04d', $num);
                $needsNormalization = true;
                $stats['needs_normalization_count']++;
            } else {
                // Non-standard text or empty
                if (empty($cleanRawId)) {
                    $normalizedId = 'CMN-UNKNOWN';
                    $needsNormalization = true;
                    $stats['needs_normalization_count']++;
                } else {
                    $stats['valid_cmn_count']++;
                }
            }

            // ODP Analysis & Matching
            $rawOdp = trim($row['raw_odp']);
            $hasOdp = !empty($rawOdp) && $rawOdp !== '-' && strtolower($rawOdp) !== 'null';
            $matchedOdp = null;

            if ($hasOdp) {
                $stats['has_odp_count']++;
                $cleanOdpStr = strtoupper(str_replace([' ', '-', '_'], '', $rawOdp));

                if (isset($odpMapByName[$cleanOdpStr])) {
                    $matchedOdp = $odpMapByName[$cleanOdpStr];
                } elseif (preg_match('/(\d+)/', $rawOdp, $odpNumMatch)) {
                    $targetNum = (int)$odpNumMatch[1];
                    if (isset($odpMapByNum[$targetNum])) {
                        $matchedOdp = $odpMapByNum[$targetNum];
                    }
                }
            } else {
                $stats['no_odp_count']++;
            }

            // UNMS Check (Existing in UNMS?)
            $lookupId1 = strtoupper(str_replace(' ', '', $normalizedId));
            $lookupId2 = strtoupper(str_replace(' ', '', $cleanRawId));
            $lookupSn  = strtoupper(trim($row['onu_serial']));

            $existsById = isset($existingCustomerNumbers[$lookupId1]) || isset($existingCustomerNumbers[$lookupId2]);
            $alreadyExists = $existsById;

            $isDuplicateSn = !$existsById && !empty($lookupSn) && isset($existingSnCustomerMap[$lookupSn]);
            $duplicateWith = $isDuplicateSn ? $existingSnCustomerMap[$lookupSn] : null;

            if ($alreadyExists) {
                $stats['already_exists_count']++;
            } else {
                $stats['new_records_count']++;
            }

            // OLT Validation (Is Modem SN registered on physical OLT?)
            $cleanSn = strtoupper(trim($row['onu_serial'] ?? ''));
            $isRegisteredInOlt = !empty($cleanSn) && isset($oltOnuMap[$cleanSn]);
            $oltDetails = $isRegisteredInOlt ? $oltOnuMap[$cleanSn] : null;

            if ($isRegisteredInOlt) {
                $stats['registered_in_olt_count']++;
            } else {
                $stats['not_in_olt_count']++;
            }

            $enrichedRecords[] = array_merge($row, [
                'id'                     => $index + 1,
                'normalized_id'          => $normalizedId,
                'needs_normalization'    => $needsNormalization,
                'has_odp'                => $hasOdp,
                'matched_odp_id'         => $matchedOdp?->id,
                'matched_odp_name'       => $matchedOdp?->name,
                'matched_odp_code'       => $matchedOdp?->code,
                'already_exists'         => $alreadyExists,
                'exists_by'              => $existsById ? 'ID Pelanggan' : null,
                'is_duplicate_sn'        => $isDuplicateSn,
                'duplicate_with'         => $duplicateWith,
                'import_status'          => $alreadyExists ? 'already_exists' : 'pending',
                'is_registered_in_olt'   => $isRegisteredInOlt,
                'olt_details'            => $oltDetails,
            ]);
        }

        return [
            'stats'   => $stats,
            'records' => $enrichedRecords,
        ];
    }
}
