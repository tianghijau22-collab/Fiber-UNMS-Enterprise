<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;

/** Observes attempts only. Never writes customer state or substitutes preserved inventory for a read. */
class OltPollingHealth
{
    private array $attempts=[];
    protected function probe(OltDevice $olt,array $network): array
    {
        $out=['status'=>'UNKNOWN','checked_at'=>OnuTelemetrySample::timestamp(),'latency_ms'=>null,'reason'=>null];
        if($olt->connection_mode!=='live')return array_replace($out,['status'=>'NOT_LIVE']);
        if(!filter_var($olt->ip_address,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4))return array_replace($out,['reason'=>'invalid_device_address']);
        if(OltHealthMonitor::routeStatus((string)$olt->ip_address,$network)==='UNAVAILABLE')return array_replace($out,['status'=>'PATH_UNAVAILABLE','reason'=>'vpn_or_route_missing']);
        $version=strtolower((string)($olt->snmp_version ?: 'v2c'));
        if(!in_array($version,['v1','v2','v2c'],true))return array_replace($out,['reason'=>'snmp_version_not_supported']);
        if(!class_exists(\SNMP::class))return array_replace($out,['reason'=>'snmp_extension_unavailable']);
        $session=null;$start=microtime(true);
        try {
            $session=new \SNMP($version==='v1' ? \SNMP::VERSION_1:\SNMP::VERSION_2C,$olt->ip_address.':'.($olt->snmp_port ?: 161),$olt->getEffectiveCommunity(),1200000,0);
            $reply=@$session->get('1.3.6.1.2.1.1.3.0');
            $out['status']=$reply===false ? 'NO_RESPONSE':'RESPONDING';$out['reason']=$reply===false ? 'snmp_no_response':null;
            if($reply!==false)$out['latency_ms']=round((microtime(true)-$start)*1000,1);
        } catch(\Throwable) {$out['status']='UNKNOWN';$out['reason']='snmp_probe_error';}
        finally {if($session)$session->close();}
        $out['checked_at']=OnuTelemetrySample::timestamp();return $out;
    }

    public function begin(OltDevice $olt,string $mode): void
    {
        $a=['attempt_id'=>bin2hex(random_bytes(12)),'phase'=>'READING','mode'=>$mode,'started_at'=>OnuTelemetrySample::timestamp(),
            'finished_at'=>null,'result'=>'UNKNOWN','reason'=>'read_in_progress','scope'=>$mode==='per_port' ? 'selected_ports':'device',
            'rows_read'=>null,'known_states'=>null,'rx_available'=>null,
            'expected_rows'=>count(ZteOnuIdentityMap::uniqueRows(array_merge(($olt->last_telemetry_snapshot ?? [])['onu_list'] ?? [],($olt->last_telemetry_snapshot ?? [])['unconfigured_onus'] ?? [])))];
        $a['connection']=$this->probe($olt,app(OltHealthMonitor::class)->network());
        $this->attempts[$olt->id]=$a;$this->save($olt->id,$a,true);
    }

    private function save(int $id,array $attempt,bool $begin=false): void
    {
        $key='olt_poll_health_v1_'.$id;
        Cache::lock('olt_poll_health_lock_'.$id,3)->block(1,function()use($key,$attempt,$begin){
            $current=OltHealthMonitor::cachedArray($key);
            if($begin || ($current['attempt_id'] ?? null)===$attempt['attempt_id'])Cache::put($key,$attempt,86400);
        });
    }

    public function read(int $id,array $rows,?int $rawStates,array $writer=[]): string
    {
        if(!isset($this->attempts[$id]))return 'UNKNOWN';
        $a=&$this->attempts[$id];$a['rows_read']=$rawStates ?? count($rows);
        $a['known_states']=count(array_filter($rows,fn($r)=>is_bool($r['is_online'] ?? null)));
        $a['rx_available']=count(array_filter($rows,fn($r)=>($r['is_online'] ?? null)===true && ($r['rx_available'] ?? false)===true));
        $online=count(array_filter($rows,fn($r)=>($r['is_online'] ?? null)===true));
        if($a['rows_read']===0){$a['result']='FAILED';$a['reason']='no_operational_observations';}
        elseif($a['known_states']<count($rows) || $a['rx_available']<$online || ($writer['rejected'] ?? 0)>0
            || $a['scope']==='selected_ports' || ($rawStates!==null && ($rawStates!==count($rows) || $rawStates<$a['expected_rows'])) || !$rows) {
            $a['result']='PARTIAL';$a['reason']='incomplete_observations';
        } else {$a['result']='SUCCESS';$a['reason']=null;}
        $this->save($id,$a);return $a['result'];
    }

    public function finish(OltDevice $olt,int $code): array
    {
        $a=$this->attempts[$olt->id];
        $a['connection']=$this->probe($olt,app(OltHealthMonitor::class)->network());
        $a['return_code']=$code;$a['phase']='FINISHED';$a['finished_at']=OnuTelemetrySample::timestamp();
        $a['duration_ms']=round(((float)now()->format('U.u')-OnuTelemetrySample::epoch($a['started_at']))*1000,1);
        if($code!==0){$a['result']='FAILED';$a['reason']='poll_execution_failed';}
        elseif($a['rows_read']===null){$a['result']='UNKNOWN';$a['reason']='read_not_observed';}
        if(in_array($a['connection']['status'],['PATH_UNAVAILABLE','NO_RESPONSE'],true)){$a['result']='FAILED';$a['reason']=$a['connection']['reason'];}
        if($a['result']==='SUCCESS' && $a['connection']['status']!=='RESPONDING'){$a['result']='PARTIAL';$a['reason']='connection_unverified';}
        $this->save($olt->id,$a);unset($this->attempts[$olt->id]);return $a;
    }
}
