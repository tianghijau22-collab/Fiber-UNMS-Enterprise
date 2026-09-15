<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\NetworkNode;
use App\Models\OntRegistration;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Log;

class SobokScraperService
{
    protected string $baseUrl = 'https://sobok.cinoxmedia.net';
    protected string $loginUrl = 'https://sobok.cinoxmedia.net/index.php';
    protected string $konfigUrl = 'https://sobok.cinoxmedia.net/halaman_viewer/konfig.php';

    /**
     * Scrape and parse customer data from Sobok
     */
    public function scrape(string $username = 'jasen', string $password = 'jasen2401'): array
    {
        $tempCookieFile = tempnam(sys_get_temp_dir(), 'sobok_cookie_');

        try {
            // 1. Authenticate / Login to Sobok
            $loginSuccess = $this->authenticate($username, $password, $tempCookieFile);
            if (!$loginSuccess) {
                throw new \Exception("Gagal login ke sistem Sobok. Periksa username dan password.");
            }

            // 2. Fetch all customers from konfig.php using keyword = '%'
            $html = $this->fetchKonfigHtml($tempCookieFile);
            if (empty($html)) {
                throw new \Exception("Gagal mengambil data dari halaman konfig.php Sobok.");
            }

            // 3. Parse HTML table
            $parsedRecords = $this->parseHtml($html);

            // 4. Enrich & Match with Fiber-UNMS Database
            $enriched = $this->enrichAndMatchRecords($parsedRecords);

            return $enriched;
        } finally {
            if (file_exists($tempCookieFile)) {
                @unlink($tempCookieFile);
            }
        }
    }

    /**
     * Authenticate session via cURL
     */
    protected function authenticate(string $username, string $password, string $cookieFile): bool
    {
        $ch = curl_init($this->loginUrl);
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
            CURLOPT_TIMEOUT        => 30,
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
    protected function fetchKonfigHtml(string $cookieFile): string
    {
        $ch = curl_init($this->konfigUrl);
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
     * Parse HTML DOM into structured customer array
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
