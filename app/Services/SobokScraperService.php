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
    protected array $parseMeta = [];

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
                $enriched['source_meta']=$this->parseMeta;

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
        $records=[];$dom=new DOMDocument();$previous=libxml_use_internal_errors(true);
        try{$dom->loadHTML('<?xml encoding="UTF-8">'.$html);libxml_clear_errors();}finally{libxml_use_internal_errors($previous);}
        $x=new DOMXPath($dom);$table=null;$columns=[];
        $aliases=['idpelanggan'=>'raw_id','namapelanggan'=>'name','odp'=>'raw_odp','daerah'=>'address','alamat'=>'address','olt'=>'olt','serialnumber'=>'onu_serial','sn'=>'onu_serial','interface'=>'interface','portonu'=>'port_onu','vlanid'=>'vlan_id','redaman'=>'redaman'];
        foreach($x->query('//table') as $candidate){
            $headers=$x->query('./thead/tr/th|./tr/th|./tbody/tr/th',$candidate);$map=[];
            foreach($headers as $i=>$h){$key=strtolower(preg_replace('/[^a-zA-Z0-9]/','',$h->textContent));if(isset($aliases[$key]))$map[$aliases[$key]]=$i;}
            if(isset($map['raw_id'],$map['name'],$map['onu_serial'])){$table=$candidate;$columns=$map;break;}
        }
        if(!$table)throw new \RuntimeException('Tabel pelanggan sumber tidak dikenali. Tidak ada data yang diimpor; periksa perubahan format atau sesi login sumber.');
        $rejected=0;$seen=[];$duplicates=0;
        foreach($x->query('./tbody/tr|./tr',$table) as $tr){
            $cells=$x->query('./td',$tr);if($cells->length===0)continue;
            if($cells->length<=max($columns)){$rejected++;continue;}
            $row=array_fill_keys(['raw_id','name','raw_odp','address','olt','onu_serial','interface','port_onu','vlan_id','redaman'],'');
            foreach($columns as $field=>$index)$row[$field]=trim(preg_replace('/\s+/u',' ',$cells->item($index)->textContent));
            if($row['raw_id']===''||$row['name']===''){$rejected++;continue;}
            $row['rx_power']=preg_match('/^\s*(-\d+(?:[.,]\d+)?)\s*(?:dBm)?\s*$/i',$row['redaman'],$m)?(float)str_replace(',','.',$m[1]):null;
            $key=hash('sha256',json_encode($row));if(isset($seen[$key])){$duplicates++;continue;}$seen[$key]=true;$records[]=$row;
        }
        $this->parseMeta=['source_data_rows'=>count($records)+$rejected+$duplicates,'parsed_records'=>count($records),'rejected_rows'=>$rejected,'identical_duplicates'=>$duplicates];
        if(!$records)throw new \RuntimeException('Sumber tidak mengembalikan data pelanggan yang dapat dibaca.');
        return $records;
    }

    /**
     * Enrich records with normalization, ODP matching, and UNMS duplication check
     */
    protected function enrichAndMatchRecords(array $records): array
    {
        // 1. Preload UNMS customer numbers & ONU serial numbers for ultra-fast lookup
        $existingCustomers=Customer::with('services.ontRegistration','services.networkPort')->get();
        $customersByNumber=$existingCustomers->groupBy(fn($c)=>CustomerIntakeService::numberKey($c->customer_number));

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

        $odpMapByName=[];
        foreach($odpNodes as $node)foreach(array_unique([CustomerIntakeService::odpKey($node->name),CustomerIntakeService::odpKey($node->code)]) as $key)if($key!=='')$odpMapByName[$key][$node->id]=$node;

        $telemetry=\App\Services\Olt\OnuTelemetryView::load();

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
                $normalizedId = CustomerIntakeService::numberKey($cleanRawId);
                $stats['valid_cmn_count']++;
            } elseif (preg_match('/^\d+$/', $cleanRawId)) {
                // Pure numeric ID like "8061" or "77"
                $num = (int)$cleanRawId;
                $normalizedId = CustomerIntakeService::numberKey($cleanRawId);
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
                $matches=$odpMapByName[CustomerIntakeService::odpKey($rawOdp)]??[];
                if(count($matches)===1)$matchedOdp=reset($matches);
            } else {
                $stats['no_odp_count']++;
            }

            // UNMS Check (Existing in UNMS?)
            $lookupSn  = strtoupper(trim($row['onu_serial']));

            $customerMatches=$customersByNumber->get(CustomerIntakeService::numberKey($rawId),collect());
            $existsById=$customerMatches->isNotEmpty();
            $repair=$customerMatches->count()===1?CustomerIntakeService::preview($customerMatches->first(),['onu_serial'=>$row['onu_serial'],'name'=>$row['name'],'address'=>$row['address'],'odp_id'=>$matchedOdp?->id]):['can_repair'=>false,'repair_changes'=>[],'repair_conflicts'=>$customerMatches->count()>1?['ID pelanggan ganda; periksa manual.']:[]];
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
            $isRegisteredInOlt=false;
            $resolved=$telemetry->resolveUnmapped($cleanSn);
            $isRegisteredInOlt=$resolved['identity_status']==='resolved';
            $oltDetails=$isRegisteredInOlt?array_replace($resolved,['port'=>$resolved['gpon_interface'],'status'=>$resolved['onu_status']]):null;

            if ($isRegisteredInOlt) {
                $stats['registered_in_olt_count']++;
            } else {
                $stats['not_in_olt_count']++;
            }

            $enrichedRecords[] = array_merge($row, [
                ...$repair,
                'odp_match_status'=>$matchedOdp?'matched':($hasOdp?'unmatched':'none'),
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
