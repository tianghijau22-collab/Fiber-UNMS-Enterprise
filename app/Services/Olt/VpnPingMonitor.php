<?php

namespace App\Services\Olt;

use Illuminate\Support\Facades\Cache;
use Symfony\Component\Process\Process;

/** ICMP measurements to the discovered VPN peer, independent of OLT/SNMP health. */
class VpnPingMonitor
{
    public const SAMPLE_TTL = 12;

    protected function ping(string $peer,string $interface): ?string
    {
        try {
            $p=new Process(['ping','-n','-I',$interface,'-c','2','-i','0.2','-W','1','-w','2',$peer],base_path(),['LC_ALL'=>'C','LANG'=>'C']);
            $p->setTimeout(3);$p->run();
            // Exit 1 still contains a valid packet-loss report; command errors are not measurements.
            return in_array($p->getExitCode(),[0,1],true) ? $p->getOutput():null;
        } catch(\Throwable) {return null;}
    }

    public static function parse(?string $raw,string $at): array
    {
        $out=['ping_status'=>'UNKNOWN','ping_checked_at'=>$at,'peer_latency_ms'=>null,'jitter_ms'=>null,
            'packet_loss_pct'=>null,'packets_sent'=>null,'packets_received'=>null,'latency_source'=>'icmp_peer',
            'quality'=>'UNKNOWN','quality_color'=>'amber','quality_text'=>'Pengukuran ping peer VPN belum tersedia'];
        if(!is_string($raw) || !preg_match('/(\d+) packets transmitted,\s*(\d+) (?:packets )?received/',$raw,$m))return $out;
        $sent=(int)$m[1];$received=(int)$m[2];
        if($sent<1 || $sent>2 || $received>$sent)return $out;
        $out['packets_sent']=$sent;$out['packets_received']=$received;
        $out['packet_loss_pct']=round(100*($sent-$received)/$sent,1);
        if($received===0)return array_replace($out,['ping_status'=>'NO_RESPONSE','quality'=>'NO_RESPONSE','quality_color'=>'rose',
            'quality_text'=>'Ping peer VPN tidak merespons; status interface dinilai terpisah']);
        if(!preg_match('/(?:rtt|round-trip) min\/avg\/max\/(?:mdev|stddev) = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/',$raw,$m))return $out;
        [$min,$avg,$max,$variation]=array_map('floatval',array_slice($m,1));
        if(!is_finite($avg) || $min<0 || $min>$avg || $avg>$max || $variation<0)return $out;
        $out['ping_status']='RESPONDING';$out['peer_latency_ms']=round($avg,2);$out['jitter_ms']=round($variation,2);
        $out['quality']=$out['packet_loss_pct']>5 ? 'DEGRADED':($avg<30 ? 'OPTIMAL':($avg<=60 ? 'GOOD':($avg<=120 ? 'MODERATE':'DEGRADED')));
        $out['quality_color']=$out['quality']==='DEGRADED' ? 'rose':($out['quality']==='MODERATE' ? 'amber':'emerald');
        $out['quality_text']=$out['packet_loss_pct']>0 ? 'Ping peer VPN merespons dengan kehilangan paket':'Ping peer VPN merespons';
        return $out;
    }

    public function sample(array $network): array
    {
        $empty=self::parse(null,OnuTelemetrySample::timestamp());$empty['ping_checked_at']=null;
        $peer=$network['peer_ip'] ?? null;$interface=$network['interface'] ?? null;
        if(($network['status'] ?? '')!=='AVAILABLE' || !is_string($peer) || !filter_var($peer,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)
            || !is_string($interface) || !preg_match('/^[A-Za-z0-9_.:@-]{1,32}$/D',$interface)
            || OltHealthMonitor::routeStatus($peer,$network)!=='AVAILABLE') {
            return array_replace($network,$empty,['ping_status'=>($network['status'] ?? '')==='DISCONNECTED' ? 'PATH_UNAVAILABLE':'UNKNOWN',
                'quality_text'=>$network['quality_text'] ?? $empty['quality_text']]);
        }
        $key='server_mon_vpn_ping_v1_'.hash('sha256',json_encode([$interface,$network['interface_index'] ?? null,$network['local_ip'] ?? null,$peer]));
        $cached=Cache::get($key);
        if(is_array($cached) && ($age=OltHealthMonitor::age($cached['ping_checked_at'] ?? null))!==null && $age<=self::SAMPLE_TTL)return array_replace($network,$cached);
        $result=Cache::lock($key.'_lock',4)->get(function()use($peer,$interface,$key){
            $raw=$this->ping($peer,$interface);$value=self::parse($raw,OnuTelemetrySample::timestamp());
            Cache::put($key,$value,self::SAMPLE_TTL);return $value;
        });
        return array_replace($network,is_array($result) ? $result:array_replace($empty,['ping_status'=>'MEASURING','quality_text'=>'Pengukuran ping peer VPN sedang berlangsung']));
    }
}
