<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\Process\Process;

/** Read-only monitoring. A running process never establishes device or data health. */
class OltHealthMonitor
{
    public const CONNECTION_MAX_AGE = 180;

    public static function cachedArray(string $key): array
    {
        $value=Cache::get($key,[]);return is_array($value) ? $value:[];
    }

    protected function command(array $args): ?string
    {
        try {
            $p = new Process($args,base_path()); $p->setTimeout(2); $p->run();
            return $p->isSuccessful() ? $p->getOutput() : null;
        } catch (\Throwable) { return null; }
    }

    public function network(): array
    {
        $addresses = json_decode($this->command(['ip','-j','address','show']) ?? '', true);
        $routes = json_decode($this->command(['ip','-j','route','show']) ?? '', true);
        return self::networkEvidence($addresses, $routes, config('olt_events.bind_address'));
    }

    public static function networkEvidence(?array $addresses, ?array $routes, mixed $bind): array
    {
        $base = ['status'=>'UNKNOWN','interface'=>null,'interface_index'=>null,'local_ip'=>null,'peer_ip'=>null,
            'checked_at'=>OnuTelemetrySample::timestamp(),'routes'=>$routes ?? [],'all_interfaces'=>[],
            'peer_latency_ms'=>null,'packet_loss_pct'=>null,'jitter_ms'=>null,
            'quality'=>'UNKNOWN','quality_color'=>'amber','quality_text'=>'Jalur VPN belum dapat diperiksa'];
        if ($addresses === null || $routes === null || !is_string($bind) || !filter_var($bind,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)) return $base;
        foreach ($addresses as $link) {
            foreach ($link['addr_info'] ?? [] as $addr) {
                if (($addr['local'] ?? null) !== $bind) continue;
                $up = in_array('UP',$link['flags'] ?? [],true);
                return array_replace($base,['status'=>$up ? 'AVAILABLE':'DISCONNECTED',
                    'interface'=>$link['ifname'] ?? null,'interface_index'=>$link['ifindex'] ?? null,'local_ip'=>$bind,'peer_ip'=>$addr['address'] ?? null,
                    'all_interfaces'=>[['name'=>$link['ifname'] ?? null,'local_ip'=>$bind,'peer_ip'=>$addr['address'] ?? null]],
                    'quality'=>$up ? 'UNVERIFIED':'DOWN','quality_color'=>$up ? 'amber':'rose',
                    'quality_text'=>$up ? 'Interface tersedia; respons OLT diperiksa terpisah':'Interface VPN tidak aktif']);
            }
        }
        return array_replace($base,['status'=>'DISCONNECTED','quality'=>'DOWN','quality_color'=>'rose','quality_text'=>'Interface VPN tidak ditemukan']);
    }

    public static function routeStatus(string $ip, array $network): string
    {
        if (!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)) return 'UNKNOWN';
        if (($network['status'] ?? 'UNKNOWN') === 'UNKNOWN') return 'UNKNOWN';
        $private = filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE) === false;
        if ($private && ($network['status'] ?? '') === 'DISCONNECTED') return 'UNAVAILABLE';
        $best = null; $bits = -1;
        foreach ($network['routes'] ?? [] as $r) {
            $dst = $r['dst'] ?? 'default';
            [$prefix,$length] = $dst === 'default' ? ['0.0.0.0',0] : array_pad(explode('/',$dst,2),2,32);
            $length = (int)$length;
            if (!filter_var($prefix,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4) || $length<0 || $length>32) continue;
            $mask = $length === 0 ? 0 : (0xffffffff << (32-$length)) & 0xffffffff;
            if ((ip2long($ip)&$mask) === (ip2long($prefix)&$mask) && $length>$bits) { $best=$r; $bits=$length; }
        }
        if (!$best || in_array($best['type'] ?? '',['blackhole','unreachable','prohibit'],true)) return 'UNAVAILABLE';
        if ($private && ($best['dev'] ?? null) !== ($network['interface'] ?? null)) return 'UNAVAILABLE';
        return 'AVAILABLE';
    }

    public function service(string $unit): array
    {
        // Fixed callers only; no shell interpolation, sudo, or state changes.
        if (!in_array($unit,['fiber-telemetry-daemon.service','fiber-event-listener.service'],true)) throw new \InvalidArgumentException('Unknown monitoring service');
        $raw=$this->command(['systemctl','show',$unit,'--property=ActiveState,SubState,MainPID,NRestarts']);
        $values=[];
        foreach(explode("\n",$raw ?? '') as $line) if(str_contains($line,'=')) {[$k,$v]=explode('=',$line,2);$values[$k]=$v;}
        $state=$values['ActiveState'] ?? null;
        return ['status'=>$state===null ? 'UNKNOWN':($state==='active' && (int)($values['MainPID'] ?? 0)>0 ? 'RUNNING':'STOPPED'),
            'active_state'=>$state,'sub_state'=>$values['SubState'] ?? null,'pid'=>isset($values['MainPID']) ? (int)$values['MainPID']:null,
            'checked_at'=>OnuTelemetrySample::timestamp()];
    }

    public static function age(mixed $at, ?float $now=null): ?int
    {
        $time=OnuTelemetrySample::epoch($at);$now ??= (float)now()->format('U.u');
        return $time===null || $time>$now+5 ? null : max(0,(int)floor($now-$time));
    }

    public static function data(array $snapshot, ?float $now=null,bool $zte=true): array
    {
        $now ??= (float)now()->format('U.u');
        $out=['total'=>0,'fresh_samples'=>0,'stale_samples'=>0,'missing_samples'=>0,'unknown_state'=>0,'rx_missing_online'=>0,
            'identity_unresolved'=>0,'oldest_sample_at'=>null,'latest_sample_at'=>null];$times=[];
        $rows=array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []);
        $identities=$zte ? ZteOnuIdentityMap::uniqueRows($rows):[];
        foreach($rows as $row) {
            if(!is_array($row))continue;$out['total']++;
            // Never reinterpret a snapshot completion time as a new per-ONU measurement.
            $at=$row['sample_observed_at'] ?? null;$age=self::age($at,$now);
            if($age===null)$out['missing_samples']++;
            elseif($age>OnuTelemetryView::MAX_SAMPLE_AGE)$out['stale_samples']++;
            else $out['fresh_samples']++;
            if($age!==null)$times[$at]=OnuTelemetrySample::epoch($at);
            $online=$row['is_online'] ?? null;
            if(!is_bool($online))$out['unknown_state']++;
            if($online===true && ($row['rx_available'] ?? false)!==true)$out['rx_missing_online']++;
            $identity=$identities[strtoupper(trim((string)($row['serial_number'] ?? '')))] ?? null;
            $identityAge=self::age($row['identity_observed_at'] ?? null,$now);
            if($zte ? (!$identity || $identityAge===null || $identityAge>600)
                : (($row['_source'] ?? null)!=='live_snmp'))$out['identity_unresolved']++;
        }
        if($times){asort($times);$out['oldest_sample_at']=array_key_first($times);$out['latest_sample_at']=array_key_last($times);}
        $out['status']=$out['total']===0 || $out['missing_samples']===$out['total'] ? 'UNAVAILABLE'
            : ($out['fresh_samples']===$out['total'] ? 'FRESH':($out['fresh_samples']>0 ? 'PARTIAL':'STALE'));
        $out['complete']=$out['total']>0 && $out['missing_samples']===0 && $out['unknown_state']===0 && $out['identity_unresolved']===0 && $out['rx_missing_online']===0;
        return $out;
    }

    public static function device(OltDevice $device,array $network,array $attempt,?float $now=null): array
    {
        $now ??= (float)now()->format('U.u');$route=self::routeStatus((string)$device->ip_address,$network);
        if($device->connection_mode!=='live')$route='NOT_REQUIRED';
        $probe=$attempt['connection'] ?? []; $age=self::age($probe['checked_at'] ?? null,$now);
        $connection=$route==='UNAVAILABLE' ? 'PATH_UNAVAILABLE'
            : ($age===null || $age>self::CONNECTION_MAX_AGE ? 'UNKNOWN':($probe['status'] ?? 'UNKNOWN'));
        if($device->connection_mode!=='live')$connection='NOT_LIVE';
        $phase=$attempt['phase'] ?? 'UNOBSERVED';
        $result=$phase==='READING' ? 'IN_PROGRESS':($attempt['result'] ?? 'UNKNOWN');
        if($route==='UNAVAILABLE')$result='FAILED';
        elseif(self::age($attempt['finished_at'] ?? null,$now)>self::CONNECTION_MAX_AGE)$result='STALE';
        if($device->connection_mode!=='live')$result='NOT_LIVE';
        $snapshot=$device->last_telemetry_snapshot ?? [];
        return ['device_id'=>$device->id,'device_name'=>$device->name,'ip'=>$device->ip_address,'vendor'=>$device->vendor,
            'total_ports'=>count($snapshot['pon_ports'] ?? []),
            'active_ports'=>count(array_filter($snapshot['pon_ports'] ?? [],fn($p)=>($p['status'] ?? '')==='Up')),
            'db_registered_total'=>count($snapshot['onu_list'] ?? []),'db_unregistered_total'=>count($snapshot['unconfigured_onus'] ?? []),
            'status'=>$result,'connection'=>['status'=>$connection,'checked_at'=>$probe['checked_at'] ?? null,'age_seconds'=>$age,
                'latency_ms'=>$connection==='RESPONDING' ? ($probe['latency_ms'] ?? null):null,'route_status'=>$route,'reason'=>$route==='UNAVAILABLE' ? 'vpn_or_route_missing':($probe['reason'] ?? null)],
            'poll'=>array_intersect_key($attempt,array_flip(['attempt_id','phase','mode','started_at','finished_at','duration_ms','result','reason','rows_read','known_states','rx_available','scope','return_code','walk_reports'])),
            'data_health'=>self::data($snapshot,$now,str_contains(strtolower((string)($device->vendor_key ?: $device->vendor)),'zte')),
            'querying_status'=>$phase==='READING' ? 'SYNCING':$result,
            'query_elapsed_seconds'=>$phase==='READING' ? self::age($attempt['started_at'] ?? null,$now):null];
    }

    public function overview(): array
    {
        $network=$this->network();$reports=[];
        foreach(OltDevice::where('status','active')->get() as $d)$reports[]=self::device($d,$network,self::cachedArray('olt_poll_health_v1_'.$d->id));
        $vpn=app(VpnPingMonitor::class)->sample($network);
        $vpn['routes']=array_values(array_map(fn($r)=>$r['dst'] ?? 'default',array_filter($network['routes'],fn($r)=>($r['dev'] ?? null)===($network['interface'] ?? null))));
        $vpn['olt_targets']=array_map(fn($r)=>['id'=>$r['device_id'],'name'=>$r['device_name'],'ip'=>$r['ip'],'vendor'=>$r['vendor'],
            'status'=>$r['connection']['status'],'latency_ms'=>$r['connection']['latency_ms'],'checked_at'=>$r['connection']['checked_at']],$reports);
        return ['checked_at'=>OnuTelemetrySample::timestamp(),'vpn'=>$vpn,
            'poller_service'=>$this->service('fiber-telemetry-daemon.service'),'listener_service'=>$this->service('fiber-event-listener.service'),
            'devices'=>$reports];
    }
}
