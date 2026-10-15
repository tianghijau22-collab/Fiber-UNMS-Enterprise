<?php

namespace App\Services\Olt;

/** Conservative observations: state determines availability; optical power never determines state. */
class OnuTelemetrySample
{
    public static function timestamp(): string
    {
        return now()->format('Y-m-d\TH:i:s.uP');
    }

    public static function epoch(mixed $at): ?float
    {
        if (!is_string($at) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D',$at)) return null;
        try { return (float)(new \DateTimeImmutable($at))->format('U.u'); }
        catch (\Throwable) { return null; }
    }

    public static function fromZteState(mixed $state, mixed $rawRx, string $at): array
    {
        $state = is_int($state) ? $state : null;
        $online = in_array($state, [1, 3, 4, 5, 6], true) ? $state === 3 : null;
        $rx = null;
        if ($online === true && is_int($rawRx) && $rawRx > 0 && $rawRx < 65534) {
            $measured = round($rawRx * 0.002 - 30.0, 2);
            if ($measured > -40 && $measured <= 10) $rx = $measured;
        }
        return ['status'=>$online === null ? 'Unknown' : ($online ? 'Online' : 'Offline'),
            'is_online'=>$online, 'rx_power'=>$rx, 'rx_available'=>$rx !== null,
            'sample_observed_at'=>$at, 'state_observed_at'=>$online === null ? null : $at,
            'rx_observed_at'=>$rx === null ? null : $at, 'telemetry_sample_version'=>2];
    }

    public static function interfaceIsUp(mixed $value): ?bool
    {
        if(is_string($value))$value=trim(preg_replace('/^INTEGER:\s*/','',trim($value)));
        if($value===1 || $value==='1')return true;
        if($value===2 || $value==='2')return false;
        return null;
    }

    public static function interfaceReadings(array $raw, array $requested): array
    {
        $result=[];
        foreach($raw as $oid=>$value) {
            $oid=ltrim(str_replace('iso.','1.',(string)$oid),'.');
            $port=$requested[$oid] ?? null;$up=self::interfaceIsUp($value);
            if($port && $up!==null)$result[$port]=['port'=>$port,'oper_val'=>$up ? 1:2,'is_up'=>$up,'status_str'=>$up ? 'UP':'DOWN'];
        }
        return $result;
    }

    /** Project an existing observation without inventing a time from snapshot completion. */
    public static function project(array $row): array
    {
        $at=$row['sample_observed_at'] ?? null;
        $valid=($row['telemetry_sample_version'] ?? null)===2 && self::epoch($at)!==null;
        $sample=self::normalize($valid ? $row:['status'=>'Unknown'],$valid ? $at:'');
        $sample['sample_observed_at']=$valid ? $at:null;
        foreach(['state_observed_at','rx_observed_at'] as $field) {
            $time=self::epoch($row[$field] ?? null);
            $sample[$field]=$valid && $time!==null && $time<=self::epoch($at)+5 ? $row[$field]:null;
        }
        if($sample['state_observed_at']===null) {
            $sample['status']='Unknown';$sample['is_online']=null;$sample['rx_power']=null;$sample['rx_available']=false;
        }
        if($sample['rx_observed_at']===null){$sample['rx_power']=null;$sample['rx_available']=false;}
        if($sample['is_online']===null)$sample['state_observed_at']=null;
        if(!$sample['rx_available'])$sample['rx_observed_at']=null;
        return $sample;
    }

    public static function normalize(array $row, string $at): array
    {
        $state = strtolower(trim((string)($row['status'] ?? '')));
        $online = array_key_exists('is_online', $row) ? $row['is_online']
            : (in_array($state, ['online','active','working'], true) ? true
                : (in_array($state, ['offline','inactive','los','dying_gasp'], true) ? false : null));
        if (!is_bool($online)) $online = null;
        $rx = $row['rx_power'] ?? null;
        $rx = is_numeric($rx) && is_finite((float)$rx) ? (float)$rx : null;
        if ($online !== true || $rx === null || $rx <= -40 || $rx > 10
            || ($row['rx_available'] ?? null) === false || ($rx === 0.0 && ($row['rx_available'] ?? null) !== true)) $rx = null;
        return ['status'=>$online === null ? 'Unknown' : ($online ? 'Online' : 'Offline'),
            'is_online'=>$online, 'rx_power'=>$rx, 'rx_available'=>$rx !== null,
            'sample_observed_at'=>$at, 'state_observed_at'=>$online === null ? null : $at,
            'rx_observed_at'=>$rx === null ? null : $at, 'telemetry_sample_version'=>2];
    }
}
