<?php

namespace App\Services\Olt;

use App\Models\OltDevice;

/** Read-only, selected-device optical diagnosis. Neither topology nor Rx proves ONU state. */
class OnuOpticalDiagnostic
{
    public function read(OltDevice $device,string $serial,?string $hintPort=null,?int $hintId=null): array
    {
        $view=(new OnuTelemetryView([$device]))->resolve((int)$device->id,$serial);
        $empty=array_replace($view,['gpon_interface'=>null,'onu_id'=>null,'identity_status'=>'unresolved',
            'is_online'=>null,'onu_status'=>'Unknown','rx_power'=>null,'rx_available'=>false,
            'telemetry_source'=>null,'sampled_at'=>null,'sample_age_seconds'=>null,'telemetry_freshness'=>'unavailable']);
        $base=['serial_number'=>$serial,'identity_observed_at'=>null,'tx_power_dbm'=>null,'olt_rx_power_dbm'=>null,'voltage_v'=>null,
            'bias_current_ma'=>null,'temperature_c'=>null,'distance_meters'=>null];
        $finish=static function(array $v,string $status,string $reason,?string $started=null)use($base): array {
            return array_replace($base,$v,['status'=>$v['onu_status'],'port'=>$v['gpon_interface'],
                'rx_power_dbm'=>$v['rx_power'],'_source'=>$v['telemetry_source'] ?? 'unavailable',
                'probe_status'=>$status,'probe_reason'=>$reason,'probe_started_at'=>$started]);
        };
        if($device->status!=='active' || !OnuTelemetryWriter::supported($device)
            || !in_array(strtolower((string)($device->snmp_version ?: 'v2c')),['v2','v2c'],true))
            return $finish($empty,'unavailable','unsupported_device');

        $snapshot=$device->last_telemetry_snapshot ?? [];
        $rows=array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []);
        $unique=ZteOnuIdentityMap::uniqueRows($rows);$candidate=$unique[$serial] ?? null;
        $hasHardwareRows=count(array_filter($rows,fn($r)=>is_array($r) && ($r['identity_source'] ?? null)===ZteOnuIdentityMap::SOURCE
            && strtoupper(trim((string)($r['serial_number'] ?? '')))===$serial))>0;
        if(!$candidate && $hasHardwareRows)return $finish($empty,'conflict','identity_conflict');
        $index=$candidate ? ZteOnuIdentityMap::ifIndexFromPort($candidate['port']):null;
        $id=$candidate ? (int)$candidate['onu_id']:null;
        $hintIndex=$hintPort!==null ? ZteOnuIdentityMap::ifIndexFromPort($hintPort):null;
        if($hintPort!==null || $hintId!==null) {
            // Older clients send only a port; the ID must come from the same hardware tuple.
            if($candidate && $hintIndex===$index && $hintId===null)$hintId=$id;
            if($hintIndex===null || $hintId===null || $hintId<1 || $hintId>65535)return $finish($empty,'conflict','invalid_tuple');
            if($candidate && ($index!==$hintIndex || $id!==$hintId))return $finish($empty,'conflict','tuple_mismatch');
            $index=$hintIndex;$id=$hintId;
        }
        if($index===null || $id===null)return $finish($empty,'unavailable','identity_unresolved');

        $oids=['sn1'=>ZteOnuIdentityMap::PRIMARY.".$index.$id",'sn2'=>ZteOnuIdentityMap::SECONDARY.".$index.$id",
            'state'=>"1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$index.$id",'rx'=>"1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$index.$id.1"];
        $at=OnuTelemetrySample::timestamp();
        try {$batch=app(SnmpWalkRunner::class)->getQueued($device,['onu'=>array_values($oids)],6);}
        catch(OltReadBusy $e){$batch=['coordination_reason'=>$e->reason];}
        catch(\Throwable){$batch=[];}
        if(($batch['reports']['onu']['complete'] ?? false)!==true) {
            // Stored data keep their own time and freshness; a failed probe cannot refresh them.
            $fallback=$view['identity_status']==='resolved' && $view['gpon_interface']===ZteOnuIdentityMap::portFromIfIndex($index)
                && (int)$view['onu_id']===$id ? $view:$empty;
            $fallback['identity_observed_at']=$fallback['identity_status']==='resolved' ? ($candidate['identity_observed_at'] ?? null):null;
            return $finish($fallback,isset($batch['coordination_reason'])?'busy':'partial',$batch['coordination_reason'] ?? 'point_incomplete',$at);
        }
        $values=$batch['tables']['onu'] ?? [];$confirmed=false;
        foreach(['sn1','sn2'] as $field) {
            $raw=$values[$oids[$field]] ?? null;
            $actual=is_string($raw) ? FastOpticalProbeService::parseZteSerialNumber($raw):'';
            if(!preg_match('/^[A-Z0-9]{4}[0-9A-F]{8}$/D',$actual))continue;
            if($actual!==$serial)return $finish($empty,'conflict','identity_mismatch',$at);
            $confirmed=true;
        }
        if(!$confirmed)return $finish($empty,'unavailable','identity_unconfirmed',$at);
        $integer=static function($value): ?int {
            if(is_int($value))return $value;
            if(!is_string($value))return null;
            $value=SnmpConnector::parseValue($value);return preg_match('/^-?[0-9]+$/D',$value)?(int)$value:null;
        };
        $sample=OnuTelemetrySample::fromZteState($integer($values[$oids['state']] ?? null),$integer($values[$oids['rx']] ?? null),$at);
        $reason=$sample['is_online']===null?'state_unavailable':($sample['is_online'] && !$sample['rx_available']?'rx_unavailable':'observed');
        $current=array_replace($empty,['identity_status'=>'resolved','identity_observed_at'=>$at,'gpon_interface'=>ZteOnuIdentityMap::portFromIfIndex($index),
            'onu_id'=>(string)$id,'is_online'=>$sample['is_online'],'onu_status'=>$sample['status'],'rx_power'=>$sample['rx_power'],
            'rx_available'=>$sample['rx_available'],'sampled_at'=>$at,'sample_age_seconds'=>0,'telemetry_source'=>'snmp_point',
            'telemetry_freshness'=>'fresh','telemetry_reason'=>$reason==='observed'?null:$reason,
            'state_observed_at'=>$sample['state_observed_at'],'rx_observed_at'=>$sample['rx_observed_at']]);
        return $finish($current,$reason==='observed'?'success':'partial',$reason,$at);
    }
}
