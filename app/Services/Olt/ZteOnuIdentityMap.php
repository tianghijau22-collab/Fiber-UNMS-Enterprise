<?php

namespace App\Services\Olt;

use Illuminate\Support\Facades\Cache;

/** Hardware identities for the ZTE GPON serial tables used by this deployment. */
class ZteOnuIdentityMap
{
    public const REFRESH_AFTER = 300;
    public const MAX_AGE = 600;
    public const PRIMARY = '1.3.6.1.4.1.3902.1012.3.50.11.2.1.3';
    public const SECONDARY = '1.3.6.1.4.1.3902.1012.3.28.1.1.5';
    public const SOURCE = 'snmp_serial_table_v2';

    public static function cacheKey(int $oltId): string
    {
        return "olt_bulk_sn_map_v2_{$oltId}";
    }

    public static function portFromIfIndex(int $index): ?string
    {
        if ($index < 0x10010100 || $index > 0x10FFFF00) return null;
        if (($index & 0xFF0000FF) !== 0x10000000) return null;
        $slot = ($index >> 16) & 0xFF;
        $port = ($index >> 8) & 0xFF;
        return $slot > 0 && $port > 0 ? "gpon-olt_1/{$slot}/{$port}" : null;
    }

    public static function ifIndexFromPort(string $port): ?int
    {
        if (!preg_match('~^(?:gpon[-_]olt_|gpon_)?1/([1-9][0-9]{0,2})/([1-9][0-9]{0,2})$~iD', trim($port), $m)) return null;
        if ((int)$m[1] > 255 || (int)$m[2] > 255) return null;
        return 0x10000000 | ((int)$m[1] << 16) | ((int)$m[2] << 8);
    }

    private static function validSerial(string $sn): bool
    {
        return preg_match('/^[A-Z0-9]{4}[0-9A-F]{8}$/D', $sn) === 1 && $sn !== '000000000000';
    }

    private static function validKey(string $key): bool
    {
        if (!preg_match('/^([1-9][0-9]{0,9})_([1-9][0-9]{0,4})$/D', $key, $m)) return false;
        return self::portFromIfIndex((int)$m[1]) !== null && (int)$m[2] <= 65535;
    }

    /** Contradictory tables or multiple hardware locations never use first/last wins. */
    public static function fromTables(array $primary, array $secondary): array
    {
        $candidates = [];
        foreach ([[self::PRIMARY, $primary], [self::SECONDARY, $secondary]] as [$base, $table]) {
            foreach ($table as $oid => $raw) {
                $oid = ltrim((string)$oid, '.');
                if (!str_starts_with($oid, $base.'.')) continue;
                $suffix = substr($oid, strlen($base) + 1);
                $key = str_replace('.', '_', $suffix);
                if (!self::validKey($key) || !is_string($raw)) continue;
                $sn = FastOpticalProbeService::parseZteSerialNumber($raw);
                if (self::validSerial($sn)) $candidates[$key][$sn] = true;
            }
        }
        $entries = []; $locations = [];
        foreach ($candidates as $key => $serials) {
            foreach ($serials as $sn => $_) $locations[$sn][$key] = true;
        }
        foreach ($candidates as $key => $serials) {
            if (count($serials) !== 1) continue;
            $sn = array_key_first($serials);
            if (count($locations[$sn]) === 1) $entries[$key] = $sn;
        }
        return $entries;
    }

    /** Versioned, scalar cache only; legacy snapshot-derived maps are not accepted. */
    public static function cachedEntries(mixed $cache): array
    {
        if (!is_array($cache) || ($cache['schema'] ?? null) !== 2 || !is_array($cache['entries'] ?? null)) return [];
        $time = is_string($cache['observed_at'] ?? null) ? strtotime($cache['observed_at']) : false;
        if ($time === false || $time > time() + 5 || $time < time() - self::MAX_AGE) return [];
        $seen = [];
        foreach ($cache['entries'] as $key => $sn) {
            if (!is_string($key) || !self::validKey($key) || !is_string($sn) || !self::validSerial($sn) || isset($seen[$sn])) return [];
            $seen[$sn] = true;
        }
        return $cache['entries'];
    }

    /** The reader returns only the two SNMP serial tables, never a topology snapshot. */
    public static function remember(int $oltId, int $stateCount, callable $readTables): array
    {
        $key = self::cacheKey($oltId);
        $cache = Cache::get($key);
        $entries = self::cachedEntries($cache);
        $age=is_array($cache) ? OltHealthMonitor::age($cache['observed_at'] ?? null):null;
        $usable=$entries!==[] && count($entries)>=max(1,$stateCount*0.8);
        if($usable && $age!==null && $age<self::REFRESH_AFTER)return $cache;
        $empty=['schema'=>2,'observed_at'=>null,'entries'=>[]];
        if(Cache::has($key.'_refresh_backoff'))return $usable ? $cache:$empty;
        $result=Cache::lock($key.'_refresh_lock',50)->get(function()use($key,$stateCount,$readTables,$cache,$usable,$empty){
            $latest=Cache::get($key);$latestEntries=self::cachedEntries($latest);
            if($latestEntries && count($latestEntries)>=max(1,$stateCount*0.8)
                && OltHealthMonitor::age($latest['observed_at'])<self::REFRESH_AFTER)return $latest;
            $at=OnuTelemetrySample::timestamp();
            try {$tables=$readTables();} catch(\Throwable) {$tables=[];}
            $new=self::fromTables($tables['sn1'] ?? [],$tables['sn2'] ?? []);
            $accepted=($tables['_complete'] ?? true)===true && $new!==[] && count($new)>=max(1,$stateCount*0.8);
            Cache::put($key.'_refresh_health',['attempted_at'=>$at,'finished_at'=>OnuTelemetrySample::timestamp(),
                'previous_age'=>is_array($cache) ? OltHealthMonitor::age($cache['observed_at'] ?? null,OnuTelemetrySample::epoch($at)):null,
                'previous_observed_at'=>is_array($cache) ? ($cache['observed_at'] ?? null):null,
                'accepted'=>$accepted,'entries'=>count($new),'complete'=>($tables['_complete'] ?? true)===true],1800);
            if($accepted) {
                $value=['schema'=>2,'observed_at'=>$at,'entries'=>$new];
                Cache::put($key,$value,self::MAX_AGE);Cache::forget($key.'_refresh_backoff');return $value;
            }
            Cache::put($key.'_refresh_backoff',true,30);
            // A failed refresh cannot extend or relabel the previous observation.
            return $usable && self::cachedEntries($cache)!==[] ? $cache:$empty;
        });
        return is_array($result) ? $result:($usable ? $cache:$empty);
    }

    /** Used when partitioning snapshots: topology records cannot establish ONU identity. */
    public static function uniqueRows(array $rows): array
    {
        $map = []; $locations = []; $serialsAtLocation = []; $blocked = [];
        foreach ($rows as $row) {
            if (!is_array($row) || ($row['identity_source'] ?? null) !== self::SOURCE) continue;
            $sn = strtoupper(trim((string)($row['serial_number'] ?? '')));
            $index = self::ifIndexFromPort((string)($row['port'] ?? $row['detected_port'] ?? ''));
            $id = $row['onu_id'] ?? $row['onu_index'] ?? null;
            if (!self::validSerial($sn) || $index === null || !ctype_digit((string)$id) || (int)$id < 1 || (int)$id > 65535) continue;
            $key = $index.'_'.(int)$id;
            if (isset($locations[$sn]) && $locations[$sn] !== $key) $blocked[$sn] = true;
            if (isset($serialsAtLocation[$key]) && $serialsAtLocation[$key] !== $sn) {
                $blocked[$sn] = true;
                $blocked[$serialsAtLocation[$key]] = true;
            }
            $serialsAtLocation[$key] = $sn;
            $locations[$sn] = $key;
            $row['port'] = self::portFromIfIndex($index);
            $row['onu_id'] = (string)(int)$id;
            $map[$sn] = $row;
        }
        return array_diff_key($map, $blocked);
    }
}
