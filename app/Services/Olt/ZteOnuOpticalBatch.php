<?php

namespace App\Services\Olt;

/** Read-only optical requests using a full hardware tuple and serial confirmation. */
class ZteOnuOpticalBatch
{
    public static function read(array $serials, array $identityRows, callable $get): array
    {
        $identities = ZteOnuIdentityMap::uniqueRows($identityRows);
        $counts = array_count_values(array_map(fn($s) => strtoupper(trim((string)$s)), $serials));
        $requests = []; $mapping = [];
        foreach ($counts as $sn => $count) {
            if ($count !== 1 || !isset($identities[$sn])) continue;
            $row = $identities[$sn];
            $index = ZteOnuIdentityMap::ifIndexFromPort($row['port']);
            $id = $row['onu_id'];
            $oids = [
                'serial_primary' => ZteOnuIdentityMap::PRIMARY.".{$index}.{$id}",
                'serial_secondary' => ZteOnuIdentityMap::SECONDARY.".{$index}.{$id}",
                'state' => "1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.{$index}.{$id}",
                'rx' => "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.{$index}.{$id}.1",
            ];
            array_push($requests, ...array_values($oids));
            $mapping[$sn] = ['row' => $row, 'oids' => $oids];
        }
        $values = [];
        // Four related OIDs per ONU remain in one request; each batch contains three ONUs.
        foreach (array_chunk($requests, 12) as $chunk) {
            try { $response = $get($chunk); } catch (\Throwable) { continue; }
            if (!is_array($response)) continue;
            foreach ($response as $oid => $value) $values[ltrim(str_replace('iso.', '1.', (string)$oid), '.')] = $value;
        }
        $result = [];
        foreach ($mapping as $sn => $item) {
            $oids = $item['oids']; $confirmed = false; $conflict = false;
            foreach (['serial_primary', 'serial_secondary'] as $field) {
                $raw = $values[$oids[$field]] ?? null;
                $actual = is_string($raw) ? FastOpticalProbeService::parseZteSerialNumber($raw) : '';
                if (!preg_match('/^[A-Z0-9]{4}[0-9A-F]{8}$/D', $actual)) continue;
                if ($actual === $sn) $confirmed = true; else $conflict = true;
            }
            if (!$confirmed || $conflict) continue;
            $state = self::integer($values[$oids['state']] ?? null);
            // Transient/unknown states do not establish either Online or LOS.
            if (!in_array($state, [1, 3, 4, 5, 6], true)) continue;
            $rawRx = self::integer($values[$oids['rx']] ?? null);
            $rx = null;
            if ($state === 3 && $rawRx !== null && $rawRx > 0 && $rawRx < 65534) {
                $measured = round($rawRx * 0.002 - 30.0, 2);
                if ($measured >= -40.0 && $measured <= 10.0) $rx = $measured;
            }
            $result[$sn] = [
                'sn' => $sn, 'port' => $item['row']['port'], 'onu_id' => $item['row']['onu_id'],
                'state' => $state, 'is_online' => $state === 3,
                'rx_power' => $state !== 3 ? -40.0 : $rx,
                'rx_available' => $state === 3 && $rx !== null,
                'identity_verified' => true,
            ];
        }
        return $result;
    }

    private static function integer(mixed $value): ?int
    {
        if (is_int($value)) return $value;
        if (!is_string($value)) return null;
        $value = trim(preg_replace('/^INTEGER:\s*/', '', trim($value)));
        return preg_match('/^-?[0-9]+$/D', $value) ? (int)$value : null;
    }
}
