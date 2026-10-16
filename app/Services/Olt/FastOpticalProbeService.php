<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use SNMP;

/**
 * FastOpticalProbeService
 * 
 * Reads optical state and hardware SFP status through bounded SNMP requests.
 * ODP optical reads use each customer's verified PON/ONU tuple.
 */
class FastOpticalProbeService
{
    /**
     * Hitung ifIndex standar ZTE GPON dari string port (misal gpon-olt_1/4/1 atau 1/4/1)
     */
    public static function calculateIfIndex(string $standardPort): int
    {
        $clean = str_replace(['gpon-olt_', 'epon-olt_', 'gpon_', 'epon_'], '', strtolower(trim($standardPort)));
        $parts = explode('/', $clean);
        $slotNum = (int)($parts[1] ?? 1);
        $portNum = (int)($parts[2] ?? 1);

        return (0x10 << 24) | ($slotNum << 16) | ($portNum << 8);
    }

    /**
     * Dapatkan instance \SNMP native PHP dengan konfigurasi timeout cepat (~1.5s, 1 retry)
     */
    public static function getSnmpSession(?OltDevice $olt, int $timeoutMs = 1500, int $retries = 1): ?SNMP
    {
        if (!$olt || $olt->connection_mode !== 'live' || empty($olt->ip_address)) {
            return null;
        }

        if (!extension_loaded('snmp')) {
            return null;
        }

        try {
            $community = $olt->getEffectiveCommunity() ?: 'public';
            $port = $olt->snmp_port ?: 161;
            $timeoutMicro = $timeoutMs * 1000;

            $version = strtolower((string)($olt->snmp_version ?? 'v2c')) === 'v3' ? SNMP::VERSION_3 : SNMP::VERSION_2C;
            $target = "{$olt->ip_address}:{$port}";

            $session = new SNMP($version, $target, $community, $timeoutMicro, $retries);
            $session->oid_output_format = SNMP_OID_OUTPUT_NUMERIC;
            $session->quick_print = 1;
            $session->valueretrieval = SNMP_VALUE_PLAIN;

            return $session;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Tentukan parameter SNMP optimal secara dinamis berdasarkan kondisi latensi riil (Auto Failover / Fallback)
     */
    public static function getOptimalSnmpParameters(OltDevice $olt): array
    {
        $pingMs = (int)($olt->last_ping_ms ?? Cache::get("olt_ping_ms_{$olt->id}", 100));

        // 1. Kondisi Normal Direct Peering (Ping <= 45ms): Mode Ultra-Fast (MTU-Safe)
        if ($pingMs > 0 && $pingMs <= 45) {
            return [
                'mode'            => 'ULTRA_FAST_DIRECT',
                'max_repetitions' => 10,
                'timeout_sec'     => 5,
                'retries'         => 2,
            ];
        }

        // 2. Kondisi Jaringan Terkendala / Degraded (Ping 46 - 130ms): Mode Adaptif Failsafe (MTU-Safe)
        if ($pingMs > 45 && $pingMs <= 130) {
            return [
                'mode'            => 'ADAPTIVE_FAILSAFE_DEGRADED',
                'max_repetitions' => 8, // Payload UDP sangat kecil (<350 byte), 100% aman di dalam MTU tunnel L2TP/WireGuard tanpa fragmentasi
                'timeout_sec'     => 6,
                'retries'         => 2,
            ];
        }

        // 3. Kondisi Kritis (Ping > 130ms): Mode Recovery
        return [
            'mode'            => 'CRITICAL_RECOVERY',
            'max_repetitions' => 5,
            'timeout_sec'     => 8,
            'retries'         => 3,
        ];
    }

    public static function executeSnmpBulkWalk(OltDevice $olt,string $oid,?int $maxRepetitions=null,?int $timeoutSec=null,?int $retries=null): array
    {
        return self::executeParallelSnmpBulkWalk($olt,['walk'=>$oid],$maxRepetitions,$timeoutSec,$retries)['walk'] ?? [];
    }

    public static function executeParallelSnmpBulkWalk(OltDevice $olt,array $oids,?int $maxRepetitions=null,?int $timeoutSec=null,?int $retries=null): array
    {
        $batch=app(SnmpWalkRunner::class)->walk($olt,$oids,$maxRepetitions ?? 10,$timeoutSec ?? 5,$retries ?? 2);
        self::recordWalk($olt,$batch);return $batch['tables'];
    }

    private static function recordWalk(OltDevice $olt,array $batch): void
    {
        // Metadata only: never credentials, command lines, stderr or raw values.
        Cache::put('olt_walk_health_v1_'.$olt->id,array_diff_key($batch,['tables'=>true]),1800);
    }


    /** Interleave PON chunks and rotate the first PON across cycles. Topology is never identity evidence. */
    private static function pointQueue(OltDevice $olt,array $groups,string $purpose,float $budget,bool $walk=false): array
    {
        $started=microtime(true);
        ksort($groups,SORT_NUMERIC);$ports=array_keys($groups);$count=count($ports);$requests=[];
        if($count) {
            $key='olt_point_cursor_v1_'.$olt->id.'_'.$purpose;
            $offset=((int)Cache::get($key,0))%$count;Cache::put($key,($offset+1)%$count,3600);
            $ports=array_merge(array_slice($ports,$offset),array_slice($ports,0,$offset));
            $chunks=[];foreach($ports as $port)$chunks[$port]=array_chunk(array_values(array_unique($groups[$port])),$walk?1:24);
            do {
                $more=false;
                foreach($ports as $port)if($chunks[$port]){$requests['p'.$port.'_'.count($requests)]=array_shift($chunks[$port]);$more=true;}
            } while($more);
        }
        $runner=app(SnmpWalkRunner::class);
        $b=$walk?$runner->walkQueued($olt,$requests,$budget):$runner->getQueued($olt,$requests,$budget);
        $failed=[];foreach($b['reports'] as $key=>$report)if(($report['complete'] ?? false)!==true && isset($requests[$key]))$failed[$key]=$requests[$key];
        $left=$budget-(microtime(true)-$started);
        if($failed && $left>=0.2) {
            // One retry shares the original deadline; never retry successful PON chunks.
            $retry=$walk?$runner->walkQueued($olt,$failed,$left):$runner->getQueued($olt,$failed,$left);
            $b['initial_reports']=$b['reports'];
            foreach($retry['tables'] as $key=>$table)$b['tables'][$key]=array_replace($b['tables'][$key] ?? [],$table);
            $b['reports']=array_replace($b['reports'],$retry['reports']);
            $b['retry_reports']=$retry['reports'];
        }
        $rows=[];foreach($b['tables'] as $table)$rows=array_replace($rows,$table);
        $b['finished_at']=OnuTelemetrySample::timestamp();$b['duration_ms']=round((microtime(true)-$started)*1000,1);
        $b['rows']=$rows;$b['complete']=$requests!==[] && count($b['reports'])===count($requests)
            && count(array_filter($b['reports'],fn($r)=>($r['complete'] ?? false)!==true))===0;
        return $b;
    }

    /** Point identity reads are scoped by a complete, current hardware state table. */
    public static function readIdentityTables(OltDevice $olt,array $states=[],bool $scopeComplete=false): array
    {
        $stateRoot='1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';$groups=[];
        if($scopeComplete)foreach($states as $oid=>$unused) {
            if(preg_match('/^'.preg_quote($stateRoot,'/').'\.([0-9]+)\.([0-9]+)$/',$oid,$m)
                && ZteOnuIdentityMap::portFromIfIndex((int)$m[1])!==null && (int)$m[2]>0 && (int)$m[2]<=65535) {
                $groups[$m[1]][]=ZteOnuIdentityMap::PRIMARY.'.'.$m[1];
                $groups[$m[1]][]=ZteOnuIdentityMap::SECONDARY.'.'.$m[1];
            }
        }
        if($groups) {
            $b=self::pointQueue($olt,$groups,'identity',35,true);$rows=$b['rows'];unset($b['rows'],$b['tables']);
            $b['strategy']='pon_identity_walk';self::recordWalk($olt,$b);
            return ['sn1'=>array_filter($rows,fn($oid)=>str_starts_with($oid,ZteOnuIdentityMap::PRIMARY.'.'),ARRAY_FILTER_USE_KEY),
                'sn2'=>array_filter($rows,fn($oid)=>str_starts_with($oid,ZteOnuIdentityMap::SECONDARY.'.'),ARRAY_FILTER_USE_KEY),'_complete'=>$b['complete']];
        }
        // Incomplete state cannot establish a complete point-read identity scope.
        $b=app(SnmpWalkRunner::class)->walk($olt,['sn1'=>ZteOnuIdentityMap::PRIMARY,'sn2'=>ZteOnuIdentityMap::SECONDARY]);
        self::recordWalk($olt,$b);
        return $b['tables']+['_complete'=>count($b['reports'])===2 && count(array_filter($b['reports'],fn($r)=>$r['complete']))===2];
    }

    /** Large tables use every PON named by a complete, fresh hardware ifName walk. */
    public static function readStateTables(OltDevice $olt,?int $maxRepetitions=null,?int $timeoutSec=null): array
    {
        $root='1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';$ifName='1.3.6.1.2.1.31.1.1.1.1';
        $runner=app(SnmpWalkRunner::class);$started=OnuTelemetrySample::timestamp();$start=microtime(true);
        $snapshot=$olt->last_telemetry_snapshot ?? [];
        $known=array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []);
        $scope=null;
        if(count($known)>256) {
            $discovery=$runner->walk($olt,['interfaces'=>$ifName],10,1,1,4);
            $ports=[];$valid=($discovery['reports']['interfaces']['complete'] ?? false)===true;
            foreach($discovery['tables']['interfaces'] ?? [] as $oid=>$raw) {
                if(!preg_match('/^'.preg_quote($ifName,'/').'\.[0-9]+$/D',(string)$oid)){$valid=false;continue;}
                $name=trim((string)SnmpConnector::parseValue((string)$raw),"\" \t\r\n");
                if(stripos($name,'gpon')===false)continue;
                // ifName's own row index differs from the vendor ONU-table index on these OLTs.
                $index=ZteOnuIdentityMap::ifIndexFromPort($name);
                if($index===null || isset($ports[$index])){$valid=false;continue;}
                $ports[$index]=[$root.'.'.$index];
            }
            if(!$ports || count($ports)>128)$valid=false;
            foreach($known as $row) {
                $index=ZteOnuIdentityMap::ifIndexFromPort((string)($row['port'] ?? ''));
                if($index!==null && !isset($ports[$index]))$valid=false;
            }
            $scope=['source'=>'fresh_ifname','accepted'=>$valid,'ports'=>count($ports),
                'report'=>$discovery['reports']['interfaces'] ?? [],'duration_ms'=>$discovery['duration_ms']];
            if($valid) {
                $queued=self::pointQueue($olt,$ports,'state_discovery',max(0.1,35-(microtime(true)-$start)),true);
                $rows=$queued['rows'];unset($queued['rows'],$queued['tables']);
                return ['tables'=>['states'=>$rows],
                    'reports'=>['states'=>['complete'=>$queued['complete'],'reason'=>$queued['complete']?null:'incomplete_pon_walks','rows'=>count($rows)]],
                    'started_at'=>$started,'finished_at'=>OnuTelemetrySample::timestamp(),
                    'duration_ms'=>round((microtime(true)-$start)*1000,1),
                    'parameters'=>$queued['parameters'],'state_discovery'=>['strategy'=>'fresh_pon_state_walk','scope'=>$scope,'queue'=>$queued]];
            }
        }
        // A failed/ambiguous port scope cannot justify excluding any part of the root table.
        $batch=$runner->walk($olt,['states'=>$root],$maxRepetitions ?? 10,$timeoutSec ?? 5,2,max(0.1,35-(microtime(true)-$start)));
        if($scope)$batch['state_discovery']=['strategy'=>'root_fallback','scope'=>$scope];
        $batch['started_at']=$started;$batch['duration_ms']=round((microtime(true)-$start)*1000,1);
        return $batch;
    }

    public static function readStateRxTables(OltDevice $olt,?int $maxRepetitions=null,?int $timeoutSec=null): array
    {
        $state='1.3.6.1.4.1.3902.1012.3.50.11.2.1.4';$rx='1.3.6.1.4.1.3902.1012.3.50.12.1.1.10';
        $b=self::readStateTables($olt,$maxRepetitions,$timeoutSec);
        $states=$b['tables']['states'] ?? [];$stateComplete=($b['reports']['states']['complete'] ?? false)===true;
        $pointStart=microtime(true);$stateRecovery=null;
        if(!$stateComplete) {
            // Old tuples select requests only. Only newly returned hardware values may update a sample.
            $snapshot=$olt->last_telemetry_snapshot ?? [];$groups=[];
            foreach(array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []) as $row) {
                $index=ZteOnuIdentityMap::ifIndexFromPort((string)($row['port'] ?? ''));$id=(string)($row['onu_id'] ?? '');
                if($index!==null && ctype_digit($id) && (int)$id>0 && (int)$id<=65535 && !isset($states[$state.'.'.$index.'.'.(int)$id]))
                    $groups[$index][]=$state.'.'.$index.'.'.(int)$id;
            }
            if($groups) {
                $part=self::pointQueue($olt,$groups,'states',5);$states=array_replace($states,$part['rows']);
                unset($part['rows'],$part['tables']);$stateRecovery=$part;
            }
        }
        $groups=[];$online=0;
        foreach($states as $oid=>$value) {
            if(preg_match('/^'.preg_quote($state,'/').'\.([0-9]+)\.([0-9]+)$/',$oid,$m)
                && ZteOnuIdentityMap::portFromIfIndex((int)$m[1])!==null && (int)$m[2]>0 && (int)$m[2]<=65535
                && trim((string)SnmpConnector::parseValue((string)$value))==='3') {
                $groups[$m[1]][]=$rx.'.'.$m[1].'.'.$m[2].'.1';$online++;
            }
        }
        $point=self::pointQueue($olt,$groups,'rx',max(0.1,20-(microtime(true)-$pointStart)));
        $rxRows=$point['rows'];$missing=0;
        foreach($groups as $oids)foreach($oids as $oid)if(!array_key_exists($oid,$rxRows))$missing++;
        $b['tables']=['states'=>$states,'rx'=>$rxRows];
        $b['reports']['rx']=['complete'=>$online===0 || $point['complete'],'reason'=>$online===0 || $point['complete']?null:'incomplete_point_reads','rows'=>count($rxRows)];
        unset($point['rows'],$point['tables']);$b['point_reads']=$point;$b['state_recovery']=$stateRecovery;
        $b['strategy']='state_walk_exact_rx_get';
        $b['coverage']=['online_state_rows'=>$online,'missing_rx_before'=>$online,'missing_rx_after'=>$missing,'retried'=>false];
        $b['retry']=null;$b['finished_at']=OnuTelemetrySample::timestamp();
        $b['duration_ms']=round((microtime(true)-OnuTelemetrySample::epoch($b['started_at']))*1000,1);
        $b['complete']=$stateComplete && ($online===0 || $point['complete']) && $missing===0;
        self::recordWalk($olt,$b);
        return $b['tables']+['_acquisition'=>array_diff_key($b,['tables'=>true])];
    }

    /**
     * Parse raw SNMP serial number string from ZTE OLT to clean format (e.g. ZTEGC123456)
     */
    public static function parseZteSerialNumber(string $raw): string
    {
        // 1. Cek jika biner murni 8-byte (JANGAN di-trim karena byte terakhir bisa berupa 0x0A \n atau 0x20 spasi!)
        if (strlen($raw) === 8) {
            $fullHex = bin2hex($raw);
            $vendor = @hex2bin(substr($fullHex, 0, 8));
            if ($vendor && ctype_print($vendor)) {
                return strtoupper($vendor) . strtoupper(substr($fullHex, 8));
            }
            return strtoupper($fullHex);
        }

        $cleanRaw = trim($raw);
        $val = trim(str_replace(['"', 'INTEGER:', 'Hex-STRING:', 'STRING:'], '', $cleanRaw));
        $hex = str_replace(' ', '', $val);
        if (strlen($hex) >= 16 && ctype_xdigit($hex)) {
            $vendor = @hex2bin(substr($hex, 0, 8));
            if ($vendor && ctype_print($vendor)) {
                return strtoupper($vendor) . strtoupper(substr($hex, 8));
            }
            return strtoupper($hex);
        }
        if (str_starts_with($val, 'ZTEG') && strlen($val) === 12) {
            return strtoupper($val);
        }
        if (str_starts_with($val, 'ZTEG') && strlen($val) >= 8) {
            $vendor = substr($val, 0, 4);
            $serial = bin2hex(substr($val, 4));
            return strtoupper($vendor . $serial);
        }
        return strtoupper($val);
    }

    /**
     * 🚀 PILAR 1: Event-Driven Fast Probe ODP (~30-50 milidetik)
     * Menembakkan multi-OID SNMP GET serentak ke OLT untuk seluruh ONU pada ODP tersebut.
     * Mengambil STATUS OPERASIONAL dan REDAMAN OPTIK RIIL (DDM) langsung dari chip OLT.
     */
    public static function probeOdpStatus(
        int $odpId,
        ?OltDevice $olt = null,
        ?string $standardPort = null,
        bool $isRecovery = false
    ): array {
        $tStart = microtime(true);

        // ⏱️ GRACE PERIOD: Jika dipanggil saat pemulihan, beri jeda 1.5 detik agar DDM OLT selesai mengukur redaman
        if ($isRecovery) {
            usleep(1500000);
        }

        // 1. Ambil seluruh ONU terdaftar di ODP ini
        $onus = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->join('network_nodes as odp', 'odp.id', '=', 'network_ports.node_id')
            ->leftJoin('olt_devices', 'olt_devices.id', '=', 'odp.olt_device_id')
            ->where('odp.id', $odpId)
            ->whereNull('ont_registrations.deleted_at')
            ->whereNull('customer_services.deleted_at')
            ->whereNull('customers.deleted_at')
            ->select([
                'odp.id as odp_id',
                'odp.name as odp_name',
                'odp.olt_port_ref',
                'odp.olt_device_id',
                'olt_devices.ip_address as olt_ip',
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

        $totalOnus = $onus->count();
        if ($totalOnus < 2) {
            return [
                'success'     => false,
                'reason'      => 'Klien pada ODP kurang dari 2',
                'total'       => $totalOnus,
                'is_odp_down' => false,
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $first = $onus->first();
        $portRef = $standardPort ?: ($first->olt_port_ref ?? null);
        $oltId = OnuTelemetryView::ownerId(\App\Models\NetworkNode::find($odpId));
        $resolvedOlt = $oltId ? ($olt ?: OltDevice::find($oltId)) : null;

        if (!$resolvedOlt || $resolvedOlt->status !== 'active' || $resolvedOlt->connection_mode !== 'live' || ($oltId && (int)$resolvedOlt->id !== (int)$oltId)) {
            return [
                'success'     => false,
                'reason'      => 'Mapping OLT belum terverifikasi atau tidak sesuai ODP',
                'total'       => $totalOnus,
                'is_odp_down' => false,
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $sampleStartedAt = OnuTelemetrySample::timestamp();
        $readings = static::readVerifiedOdpOnus($resolvedOlt, $onus->all());
        $probedStates = []; $onlineCount = 0; $downCount = 0;
        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            if (!isset($readings[$sn])) continue;
            $reading = array_replace($readings[$sn],OnuTelemetrySample::normalize($readings[$sn],$sampleStartedAt));
            $reading['name'] = $onu->customer_name;
            $probedStates[$sn] = $reading;
            if ($reading['is_online']) $onlineCount++; else $downCount++;
        }
        $unknownCount = $totalOnus - count($probedStates);

        $pctDown = $totalOnus > 0 ? round(($downCount / $totalOnus) * 100.0, 1) : 0;
        
        // 🎯 POLA CERDAS ODP:
        // 1. 100% Total Loss (Seluruh pelanggan pada ODP down)
        // 2. Parsial Berat (>= 80% down DAN hanya 1 s/d 3 modem yang masih ON)
        $isOdpDown = $unknownCount === 0 && (($totalOnus >= 2 && $downCount === $totalOnus)
                  || ($totalOnus >= 4 && $pctDown >= 80.0 && $onlineCount <= 3));

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'      => $unknownCount === 0,
            'complete'     => $unknownCount === 0,
            'unknown_count' => $unknownCount,
            'odp_id'       => $odpId,
            'odp_name'     => $first->odp_name,
            'port'         => $portRef,
            'total_onus'   => $totalOnus,
            'down_count'   => $downCount,
            'online_count' => $onlineCount,
            'pct_down'     => $pctDown,
            'is_odp_down'  => $isOdpDown,
            'onu_states'   => $probedStates,
            'duration_ms'  => $durationMs,
        ];
    }

    /**
     * ⚡ PILAR 3: Hardware SFP Link Pulse (Single-Packet Multi-OID ifOperStatus ~34 milidetik)
     * Memeriksa seluruh modul SFP port PON pada OLT apakah link fisik UP (1) atau DOWN (2).
     */
    public static function probePortHardwareStatus(OltDevice $olt, ?array $knownPonPorts = null): array
    {
        $tStart = microtime(true);

        if (!$knownPonPorts) {
            $snapshot = $olt->last_telemetry_snapshot ?? [];
            $knownPonPorts = $snapshot['pon_ports'] ?? [];
        }

        // Jika snapshot kosong, coba cari dari database network_nodes atau ont_registrations
        if (empty($knownPonPorts)) {
            $dbPorts = DB::table('network_nodes')
                ->where('olt_device_id', $olt->id)
                ->whereNotNull('olt_port_ref')
                ->distinct()
                ->pluck('olt_port_ref')
                ->toArray();

            foreach ($dbPorts as $dp) {
                $knownPonPorts[] = ['port_id' => $dp];
            }
        }

        if (empty($knownPonPorts)) {
            return [
                'success'     => false,
                'reason'      => 'Tidak ada port PON yang terdaftar untuk OLT ini',
                'ports'       => [],
                'down_ports'  => [],
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $session = self::getSnmpSession($olt, 1500);
        if (!$session) {
            return [
                'success'     => false,
                'reason'      => 'Gagal membuka sesi SNMP ke OLT',
                'ports'       => [],
                'down_ports'  => [],
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $portIndexMap = [];
        $oidsToQuery = [];

        foreach ($knownPonPorts as $pItem) {
            $pId = is_array($pItem) ? ($pItem['port_id'] ?? '') : (string)$pItem;
            if (empty($pId)) continue;

            $ifIndex = ZteOnuIdentityMap::ifIndexFromPort($pId);
            if($ifIndex===null)continue;
            $oid = "1.3.6.1.2.1.2.2.1.8.{$ifIndex}";
            $oidsToQuery[] = $oid;
            $portIndexMap[$oid] = $pId;
        }

        $portStatuses = [];
        $downPorts = [];
        $upPorts = [];

        try {
            $raw = @$session->get($oidsToQuery);
            if (is_array($raw)) {
                $portStatuses=OnuTelemetrySample::interfaceReadings($raw,$portIndexMap);
                foreach($portStatuses as $port=>$reading) {
                    if($reading['is_up'])$upPorts[]=$port;else $downPorts[]=$port;
                }
            }
        } catch (\Throwable $e) {
            // Missing/invalid hardware state remains unknown.
        } finally {
            $session->close();
        }

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'     => !empty($portStatuses),
            'olt_id'      => $olt->id,
            'olt_name'    => $olt->name,
            'ports'       => $portStatuses,
            'down_ports'  => $downPorts,
            'up_ports'    => $upPorts,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * 🚀 PILAR 2: Fast Walk Status Operasional Seluruh ONU pada 1 Port PON (~1 - 2 detik)
     * Memverifikasi apakah suatu port PON mengalami gangguan massal atau telah pulih massal.
     */
    public static function readSerialObservations(OltDevice $olt, array $serials): array
    {
        $observedAt=OnuTelemetrySample::timestamp();
        $snapshot=$olt->last_telemetry_snapshot ?? [];
        $rows=array_values(ZteOnuIdentityMap::uniqueRows(array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? [])));
        $rows=array_filter($rows,fn($r)=>($at=OnuTelemetrySample::epoch($r['identity_observed_at'] ?? null))!==null && $at>=microtime(true)-600 && $at<=microtime(true)+5);
        if(!$rows || !$serials) return [];
        $session=self::getSnmpSession($olt,1800,0);if(!$session)return [];
        $deadline=microtime(true)+3.0;
        try {
            $readings=ZteOnuOpticalBatch::read($serials,$rows,function($oids)use($session,$deadline){
                return microtime(true)>$deadline ? [] : @$session->get($oids);
            });
            return array_map(fn($r)=>array_replace($r,OnuTelemetrySample::normalize($r,$observedAt)),$readings);
        } finally { $session->close(); }
    }

    public static function probePortOnusQuickState(OltDevice $olt, string $standardPort): array
    {
        $started=microtime(true);$at=OnuTelemetrySample::timestamp();
        $index=ZteOnuIdentityMap::ifIndexFromPort($standardPort);
        $snapshot=$olt->last_telemetry_snapshot ?? [];
        $identities=ZteOnuIdentityMap::uniqueRows(array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []));
        $expected=array_filter($identities,fn($r)=>$index!==null && ZteOnuIdentityMap::ifIndexFromPort($r['port'])===$index);
        $readings=$index===null ? [] : static::readSerialObservations($olt,array_keys($expected));
        $online=count(array_filter($readings,fn($r)=>$r['is_online']===true));
        $down=count(array_filter($readings,fn($r)=>$r['is_online']===false));
        $total=count($expected);$unknown=$total-count($readings);$complete=$total>0 && $unknown===0;
        $byId=[];foreach($readings as $r)$byId[$r['onu_id']]=$r;
        return ['success'=>$complete,'complete'=>$complete,'port'=>$standardPort,'ifIndex'=>$index,'observed_at'=>$at,
            'total_onus'=>$total,'online_count'=>$online,'down_count'=>$down,'unknown_count'=>$unknown,
            'pct_down'=>$total ? round($down/$total*100,1):0,'pct_online'=>$total ? round($online/$total*100,1):0,
            'is_mass_outage'=>$complete && (($total>=3 && $down===$total) || ($total>=10 && $down/$total>=0.9 && $online<=3)),
            'is_mass_recovery'=>$complete && ($total<=4 ? $online>=1 : $online/$total>=0.7),
            'onu_states'=>$byId,'onu_states_by_sn'=>$readings,'duration_ms'=>round((microtime(true)-$started)*1000,2)];
    }

    /** Legacy correlator hook: topology/aggregate inference is never permission to write ONU state. */
    public static function instantBulkDbSync(
        string $targetStatus, ?string $standardPort = null, ?int $odpId = null,
        ?float $rxPower = null, ?array $excludeSerials = null
    ): int {
        // Verified per-ONU poll, point and event producers call OnuTelemetryWriter directly.
        return 0;
    }


    /**
     * 🚀 ON-DEMAND LIVE OPTICAL PROBE FOR ODP
     * Mengambil nilai redaman optik riil (Rx Power) & status operasional secara langsung ke chip OLT
     * via Fast Multi-OID SNMP Query (~30-60 milidetik), dan mengupdate database secara instan.
     */
    public static function probeOdpLiveOptical(
        int $odpId,
        ?OltDevice $olt = null,
        ?string $standardPort = null
    ): array {
        $tStart = microtime(true);

        // 1. Ambil data ODP dan seluruh ONU/pelanggan yang terhubung
        $odpNode = \App\Models\NetworkNode::with(['splitterType', 'oltDevice', 'parent'])->find($odpId);
        if (!$odpNode) {
            return [
                'success'     => false,
                'reason'      => 'Node ODP tidak ditemukan',
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $onus = DB::table('ont_registrations')
            ->join('customer_services', 'customer_services.id', '=', 'ont_registrations.customer_service_id')
            ->join('customers', 'customers.id', '=', 'customer_services.customer_id')
            ->join('network_ports', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->where('network_ports.node_id', $odpId)
            ->whereNull('ont_registrations.deleted_at')
            ->whereNull('customer_services.deleted_at')
            ->whereNull('customers.deleted_at')
            ->select([
                'ont_registrations.id as ont_id',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'ont_registrations.status',
                'ont_registrations.rx_power',
                'customers.id as customer_id',
                'customers.name as customer_name',
                'network_ports.id as port_id',
                'network_ports.port_number',
            ])
            ->get();

        if ($onus->isEmpty()) {
            return [
                'success'      => true,
                'odp_id'       => $odpId,
                'odp_name'     => $odpNode->name,
                'total_onus'   => 0,
                'online_count' => 0,
                'down_count'   => 0,
                'message'      => 'Tidak ada pelanggan aktif pada port ODP ini',
                'duration_ms'  => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        // Resolve OLT ownership separately from each customer's physical PON.
        $mappedOltId = OnuTelemetryView::ownerId($odpNode);
        $resolvedOlt = $mappedOltId ? ($olt ?: OltDevice::find($mappedOltId)) : null;
        $portRef = $standardPort ?: ($odpNode->olt_port_ref ?: $odpNode->parent?->olt_port_ref);

        if (!$resolvedOlt || $resolvedOlt->status !== 'active' || $resolvedOlt->connection_mode !== 'live' || (int)$resolvedOlt->id !== (int)$mappedOltId) {
            return [
                'success'     => false,
                'reason'      => 'OLT tidak terhubung dalam mode Live atau tidak ditemukan',
                'odp_id'      => $odpId,
                'total_onus'  => $onus->count(),
                'duration_ms' => round((microtime(true) - $tStart) * 1000, 2),
            ];
        }

        $sampleStartedAt = OnuTelemetrySample::timestamp();
        $readings = static::readVerifiedOdpOnus($resolvedOlt, $onus->all());
        $inventory = ZteOnuIdentityMap::uniqueRows(array_merge($resolvedOlt->last_telemetry_snapshot['onu_list'] ?? [], $resolvedOlt->last_telemetry_snapshot['unconfigured_onus'] ?? []));
        $writeRows=[];
        foreach($readings as $sn=>$reading) if(isset($inventory[$sn])) $writeRows[]=array_replace($inventory[$sn],$reading,OnuTelemetrySample::normalize($reading,$sampleStartedAt));
        app(OnuTelemetryWriter::class)->apply($resolvedOlt,$writeRows,$sampleStartedAt,'point');
        $onlineCount = 0; $downCount = 0; $probedStates = [];
        foreach ($onus as $onu) {
            $sn = strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac)));
            if (!isset($readings[$sn])) continue;
            $reading = $readings[$sn];
            $reading['ont_id'] = $onu->ont_id; $reading['name'] = $onu->customer_name;
            $probedStates[$sn] = $reading;
            if ($reading['is_online']) $onlineCount++; else $downCount++;
        }
        $unknownCount = $onus->count() - count($probedStates);

        // Invalidate GIS caches
        Cache::forget('gis_map_data_payload_v2');
        Cache::forget('customers_index_payload_v5');
        Cache::forget('gis_topology_hierarchy_all');
        Cache::forget('dashboard_metrics_payload');

        $durationMs = round((microtime(true) - $tStart) * 1000, 2);

        return [
            'success'       => $unknownCount === 0,
            'complete'      => $unknownCount === 0,
            'unknown_count' => $unknownCount,
            'odp_id'        => $odpId,
            'odp_name'      => $odpNode->name,
            'olt_id'        => $resolvedOlt->id,
            'olt_name'      => $resolvedOlt->name,
            'port'          => $portRef,
            'total_onus'    => $onus->count(),
            'online_count'  => $onlineCount,
            'down_count'    => $downCount,
            'probed_states' => $probedStates,
            'duration_ms'   => $durationMs,
            'probed_at'     => now()->format('H:i:s'),
        ];
    }
    protected static function readVerifiedOdpOnus(OltDevice $olt, array $onus): array
    {
        if (!str_contains(strtolower((string)($olt->vendor_key ?: $olt->vendor)), 'zte')) return [];
        $snapshot = $olt->last_telemetry_snapshot ?? [];
        $identities = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
        $serials = array_map(fn($onu) => strtoupper(trim((string)($onu->onu_serial ?: $onu->onu_mac))), $onus);
        if (ZteOnuIdentityMap::uniqueRows($identities) === []) return [];
        $session = self::getSnmpSession($olt, 1800, 0);
        if (!$session) return [];
        try {
            return ZteOnuOpticalBatch::read($serials, $identities, fn($oids) => @$session->get($oids));
        } finally {
            $session->close();
        }
    }

}
