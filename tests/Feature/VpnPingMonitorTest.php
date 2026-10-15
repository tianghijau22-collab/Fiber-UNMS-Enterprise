<?php

namespace Tests\Feature;

use App\Services\Olt\VpnPingMonitor as Ping;
use App\Services\Olt\OltHealthMonitor as Monitor;
use App\Services\Olt\OnuTelemetrySample as Sample;
use Tests\TestCase;

class VpnPingMonitorTest extends TestCase
{
    private function network(int $index=7): array
    {
        return Monitor::networkEvidence([['ifname'=>'ppp0','ifindex'=>$index,'flags'=>['UP'],
            'addr_info'=>[['local'=>'10.254.0.1','address'=>'10.254.0.2']]]],
            [['dst'=>'10.254.0.2','dev'=>'ppp0'],['dst'=>'10.11.0.0/16','dev'=>'ppp0']],'10.254.0.1');
    }
    private function pingOutput(int $received=2,string $avg='27.500'): string
    {
        return "2 packets transmitted, $received received, 0% packet loss, time 200ms\nrtt min/avg/max/mdev = 26.000/$avg/29.000/0.750 ms\n";
    }
    private function sampler(?string $output): Ping
    {
        return new class($output) extends Ping {
            public int $calls=0;
            public function __construct(private ?string $output){}
            protected function ping(string $peer,string $interface): ?string {$this->calls++;return $this->output;}
        };
    }
    public function test_actual_rtt_variation_and_packet_counts_are_extracted(): void
    {
        $r=Ping::parse($this->pingOutput(),Sample::timestamp());
        $this->assertSame('RESPONDING',$r['ping_status']);$this->assertSame(27.5,$r['peer_latency_ms']);
        $this->assertSame(0.75,$r['jitter_ms']);$this->assertSame(0.0,$r['packet_loss_pct']);
    }
    public function test_packet_loss_comes_from_actual_counts_not_a_rounded_or_conflicting_percent(): void
    {
        $r=Ping::parse($this->pingOutput(1),Sample::timestamp());
        $this->assertSame(50.0,$r['packet_loss_pct']);$this->assertSame('DEGRADED',$r['quality']);
        $this->assertSame(27.5,$r['peer_latency_ms']);
    }
    public function test_no_replies_reports_100_percent_loss_without_zero_latency(): void
    {
        $r=Ping::parse('2 packets transmitted, 0 received, 100% packet loss',Sample::timestamp());
        $this->assertSame('NO_RESPONSE',$r['ping_status']);$this->assertSame(100.0,$r['packet_loss_pct']);
        $this->assertNull($r['peer_latency_ms']);$this->assertNull($r['jitter_ms']);
    }
    public function test_missing_malformed_or_command_error_output_does_not_invent_measurements(): void
    {
        foreach([null,'ping: operation not permitted','3 packets transmitted, 9 received',"2 packets transmitted, 2 received\nrtt min/avg/max/mdev = 50/20/10/2 ms"] as $output){
            $r=Ping::parse($output,Sample::timestamp());$this->assertSame('UNKNOWN',$r['ping_status']);$this->assertNull($r['peer_latency_ms']);
        }
    }
    public function test_real_zero_rtt_is_a_valid_observation(): void
    {
        $r=Ping::parse("2 packets transmitted, 2 received\nrtt min/avg/max/mdev = 0/0/0/0 ms",Sample::timestamp());
        $this->assertSame('RESPONDING',$r['ping_status']);$this->assertSame(0.0,$r['peer_latency_ms']);
    }
    public function test_requests_share_a_cached_measurement_and_keep_its_original_time(): void
    {
        $s=$this->sampler($this->pingOutput());$a=$s->sample($this->network());$this->travel(5)->seconds();$b=$s->sample($this->network());
        $this->assertSame(1,$s->calls);$this->assertSame($a['ping_checked_at'],$b['ping_checked_at']);
        $this->assertSame('AVAILABLE',$b['status']);$this->assertSame('RESPONDING',$b['ping_status']);
        $this->travel(13)->seconds();$c=$s->sample($this->network());$this->assertSame(2,$s->calls);$this->assertNotSame($a['ping_checked_at'],$c['ping_checked_at']);
    }
    public function test_disconnected_vpn_hides_a_previous_good_cached_ping_and_does_not_probe(): void
    {
        $s=$this->sampler($this->pingOutput());$s->sample($this->network());
        $r=$s->sample(Monitor::networkEvidence([],[],'10.254.0.1'));
        $this->assertSame(1,$s->calls);$this->assertNull($r['peer_latency_ms']);$this->assertNull($r['packet_loss_pct']);
        $this->assertSame('DISCONNECTED',$r['status']);$this->assertSame('PATH_UNAVAILABLE',$r['ping_status']);
    }
    public function test_recreated_interface_or_different_peer_does_not_reuse_the_old_sample(): void
    {
        $s=$this->sampler($this->pingOutput());$s->sample($this->network(7));$s->sample($this->network(8));
        $n=$this->network(8);$n['peer_ip']='10.254.0.3';$n['routes'][]=['dst'=>'10.254.0.3','dev'=>'ppp0'];$s->sample($n);
        $this->assertSame(3,$s->calls);
    }
    public function test_missing_or_wrong_peer_route_is_unverified_without_a_default_target(): void
    {
        $s=$this->sampler($this->pingOutput());$n=$this->network();$n['peer_ip']=null;$this->assertNull($s->sample($n)['peer_latency_ms']);
        $n=$this->network();$n['routes']=[['dst'=>'default','dev'=>'eth0']];$r=$s->sample($n);
        $this->assertSame(0,$s->calls);$this->assertNull($r['peer_latency_ms']);
    }
    public function test_no_ping_response_does_not_reclassify_an_existing_interface_as_disconnected(): void
    {
        $s=$this->sampler('2 packets transmitted, 0 received, 100% packet loss');$r=$s->sample($this->network());
        $this->assertSame('AVAILABLE',$r['status']);$this->assertSame('NO_RESPONSE',$r['ping_status']);
    }
}
