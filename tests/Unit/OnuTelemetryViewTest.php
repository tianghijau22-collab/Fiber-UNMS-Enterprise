<?php

namespace Tests\Unit;

use App\Models\OltDevice;
use App\Services\Olt\OnuTelemetryView as View;
use App\Services\Olt\ZteOnuIdentityMap as Identity;
use Tests\TestCase;

class OnuTelemetryViewTest extends TestCase
{
    private function row(string $port = '1/1/15', int $id = 1, array $overrides = []): array
    {
        $row=array_replace(['serial_number'=>'TEST00000001','port'=>$port,'onu_id'=>$id,
            'identity_source'=>Identity::SOURCE,'identity_observed_at'=>date(DATE_ATOM),
            'status'=>'Online','rx_power'=>-26.0], $overrides);
        return array_replace($row,\App\Services\Olt\OnuTelemetrySample::normalize($row,$row['sample_observed_at'] ?? date(DATE_ATOM)));
    }

    private function device(int $id, array $rows, ?string $at = null): OltDevice
    {
        return (new OltDevice)->forceFill(['id'=>$id,'name'=>'Fixture '.$id,'vendor_key'=>'zte-c320',
            'connection_mode'=>'live','status'=>'active','last_telemetry_snapshot'=>[
                'polled_at'=>$at ?? date(DATE_ATOM),'onu_list'=>$rows,'unconfigured_onus'=>[]]]);
    }

    public function test_same_serial_on_two_olts_never_crosses_the_explicit_owner(): void
    {
        $v=new View([$this->device(1,[$this->row('1/1/15')]),$this->device(2,[$this->row('1/1/16',2,['rx_power'=>-29.0])])]);
        foreach ([1=>'gpon-olt_1/1/15',2=>'gpon-olt_1/1/16'] as $id=>$port) {
            $out=$v->resolve($id,'TEST00000001');$this->assertSame($port,$out['gpon_interface']);$this->assertSame($id,$out['olt_id']);
        }
        $this->assertNull($v->resolve(null,'TEST00000001')['gpon_interface']);
        $this->assertNull($v->resolve(3,'TEST00000001')['is_online']);
    }

    public function test_legacy_or_ambiguous_rows_cannot_become_customer_hardware(): void
    {
        foreach ([[$this->row('1/1/15',1755,['identity_source'=>null])],[$this->row(),$this->row('1/1/16')]] as $rows) {
            $out=(new View([$this->device(1,$rows)]))->resolve(1,'TEST00000001');
            $this->assertSame('unresolved',$out['identity_status']);$this->assertNull($out['gpon_interface']);
            $this->assertNull($out['onu_id']);$this->assertNull($out['is_online']);$this->assertNull($out['rx_power']);
        }
    }

    public function test_stale_sample_and_missing_identity_observation_are_not_current_measurements(): void
    {
        $out=(new View([$this->device(1,[$this->row('1/1/15',1,['sample_observed_at'=>date(DATE_ATOM,time()-181)])],date(DATE_ATOM))]))->resolve(1,'TEST00000001');
        $this->assertSame('stale',$out['telemetry_freshness']);$this->assertNull($out['is_online']);$this->assertNull($out['rx_power']);
        $this->assertSame('gpon-olt_1/1/15',$out['gpon_interface']);
        $out=(new View([$this->device(1,[$this->row('1/1/15',1,['identity_observed_at'=>null])])]))->resolve(1,'TEST00000001');
        $this->assertSame('unresolved',$out['identity_status']);
    }

    public function test_working_without_rx_is_online_without_a_fake_power(): void
    {
        foreach ([null,0,'',-40,'not numeric'] as $rx) {
            $out=(new View([$this->device(1,[$this->row('1/1/15',1,['rx_power'=>$rx])])]))->resolve(1,'TEST00000001');
            $this->assertTrue($out['is_online']);$this->assertFalse($out['rx_available']);$this->assertNull($out['rx_power']);
        }
    }

    public function test_rx_cannot_override_status_and_weak_signal_does_not_itself_mean_offline(): void
    {
        $out=(new View([$this->device(1,[$this->row('1/1/15',1,['status'=>'Offline','rx_power'=>-20])])]))->resolve(1,'TEST00000001');
        $this->assertFalse($out['is_online']);$this->assertNull($out['rx_power']);
        $out=(new View([$this->device(1,[$this->row('1/1/1',1,['rx_power'=>-36])])]))->resolve(1,'TEST00000001');
        $this->assertTrue($out['is_online']);$this->assertSame(-36.0,$out['rx_power']);$this->assertSame('gpon-olt_1/1/1',$out['gpon_interface']);
    }

    public function test_point_reading_requires_the_same_full_tuple_and_confirmation(): void
    {
        $view=(new View([$this->device(1,[$this->row()])]))->resolve(1,'TEST00000001');
        $point=['identity_verified'=>true,'port'=>'1/1/16','onu_id'=>1,'is_online'=>false,'rx_power'=>-40];
        $this->assertSame($view,View::withPoint($view,$point,date(DATE_ATOM)));
        $point['port']='1/1/15';$point['identity_verified']=false;
        $this->assertSame($view,View::withPoint($view,$point,date(DATE_ATOM)));
        $point['identity_verified']=true;$out=View::withPoint($view,$point,date(DATE_ATOM));
        $this->assertSame('snmp_point',$out['telemetry_source']);$this->assertFalse($out['is_online']);$this->assertNull($out['rx_power']);
    }

    public function test_unknown_clients_never_make_a_total_loss_or_good_optical_summary(): void
    {
        $v=new View([$this->device(1,[$this->row('1/1/15',1,['status'=>'Offline'])])]);
        $out=View::summarize([$v->resolve(1,'TEST00000001'),$v->resolve(1,'TEST00000002')]);
        $this->assertFalse($out['is_loss_total']);$this->assertSame(1,$out['unknown_clients']);$this->assertSame('unknown',$out['signal_status']);
        $out=View::summarize([$v->resolve(1,'TEST00000002')]);$this->assertSame('unknown',$out['signal_status']);$this->assertFalse($out['is_loss_total']);
        $out=View::summarize([$v->resolve(1,'TEST00000001')]);$this->assertTrue($out['is_loss_total']);$this->assertSame([],$out['powers']);
    }

    public function test_resolving_many_customers_does_not_redecode_the_device_snapshot_per_customer(): void
    {
        $device=new class extends OltDevice {
            public int $snapshotReads=0;
            public function getAttribute($key) { if($key==='last_telemetry_snapshot')$this->snapshotReads++;return parent::getAttribute($key); }
        };
        $device->setRawAttributes($this->device(1,[$this->row()])->getAttributes());
        $v=new View([$device]);
        for($i=0;$i<2000;$i++)$v->resolve(1,'TEST00000001');
        $this->assertSame(1,$device->snapshotReads);
    }
    public function test_recent_snapshot_cannot_promote_legacy_rows_without_per_onu_observation(): void
    {
        $row=$this->row();unset($row['sample_observed_at'],$row['telemetry_sample_version']);
        $out=(new View([$this->device(1,[$row])]))->resolve(1,'TEST00000001');
        $this->assertSame('unavailable',$out['telemetry_freshness']);$this->assertNull($out['sampled_at']);$this->assertNull($out['is_online']);
    }
    public function test_recent_sample_does_not_promote_separately_old_state_or_optical_observation(): void
    {
        $row=$this->row();$row['rx_observed_at']=date(DATE_ATOM,time()-200);
        $out=(new View([$this->device(1,[$row])]))->resolve(1,'TEST00000001');$this->assertTrue($out['is_online']);$this->assertNull($out['rx_power']);
        $row['state_observed_at']=date(DATE_ATOM,time()-200);
        $out=(new View([$this->device(1,[$row])]))->resolve(1,'TEST00000001');$this->assertNull($out['is_online']);$this->assertNull($out['rx_power']);
    }

    public function test_customer_without_node_can_display_one_fresh_hardware_serial_without_changing_topology(): void
    {
        $v=new View([$this->device(1,[$this->row('1/6/11',1)])]);
        $out=$v->forNode(null,' test00000001 ');
        $this->assertSame(1,$out['olt_id']);$this->assertSame('gpon-olt_1/6/11',$out['gpon_interface']);$this->assertSame('1',$out['onu_id']);
        $this->assertSame(-26.0,$out['rx_power']);$this->assertSame('hardware_serial',$out['olt_resolution']);$this->assertSame('snapshot',$out['telemetry_source']);
        $this->assertSame($v->resolve(1,'TEST00000001')['sampled_at'],$out['sampled_at']);
        $this->assertNull($v->resolve(null,'TEST00000001')['olt_id']);
    }

    public function test_automatic_display_never_selects_between_two_olts_or_overrides_an_explicit_owner(): void
    {
        $v=new View([$this->device(1,[$this->row()]),$this->device(2,[$this->row('1/6/7',11,['rx_power'=>-21])])]);
        $out=$v->forNode(null,'TEST00000001');$this->assertNull($out['rx_power']);$this->assertSame('olt_identity_conflict',$out['telemetry_reason']);
        $node=(new \App\Models\NetworkNode)->forceFill(['olt_device_id'=>2]);
        $out=$v->forNode($node,'TEST00000001');$this->assertSame(2,$out['olt_id']);$this->assertSame(-21.0,$out['rx_power']);$this->assertArrayNotHasKey('olt_resolution',$out);
        $node->olt_device_id=3;$out=$v->forNode($node,'TEST00000001');$this->assertNull($out['rx_power']);$this->assertSame(3,$out['olt_id']);
    }

    public function test_unmapped_customers_do_not_promote_stale_or_legacy_samples_or_inactive_devices(): void
    {
        foreach(['sample_observed_at'=>date(DATE_ATOM,time()-181),'identity_observed_at'=>date(DATE_ATOM,time()-601),'identity_source'=>null] as $field=>$bad) {
            $v=new View([$this->device(1,[$this->row('1/6/7',11,[$field=>$bad])])]);$out=$v->forNode(null,'TEST00000001');
            $this->assertNull($out['rx_power']);$this->assertNull($out['olt_id']);$this->assertSame('unresolved',$out['identity_status']);
        }
        foreach(['status'=>'inactive','connection_mode'=>'demo'] as $field=>$value){
            $device=$this->device(1,[$this->row()]);$device->{$field}=$value;
            $this->assertNull((new View([$device]))->forNode(null,'TEST00000001')['olt_id']);
        }
    }

    public function test_unmapped_alias_conflicts_and_ambiguous_hardware_serials_remain_unresolved(): void
    {
        $v=new View([$this->device(1,[$this->row(),$this->row('1/6/7',11,['serial_number'=>'TEST00000002'])])]);
        $this->assertSame('identity_conflict',$v->forNode(null,'TEST00000001','TEST00000002')['telemetry_reason']);
        $v=new View([$this->device(1,[$this->row(),$this->row('1/6/7',11)])]);
        $this->assertNull($v->forNode(null,'TEST00000001')['rx_power']);
    }

    public function test_unmapped_display_keeps_missing_rx_and_duplicate_serial_policy_without_guessing_a_value(): void
    {
        $active=$this->row();$ghost=$this->row('1/6/7',11,['is_online'=>false,'rx_power'=>null]);
        $v=new View([$this->device(1,[$active,$ghost])]);$out=$v->forNode(null,'TEST00000001');
        $this->assertSame(-26.0,$out['rx_power']);$this->assertTrue($out['serial_duplicate']);$this->assertSame('hardware_serial',$out['olt_resolution']);
        $v=new View([$this->device(1,[$this->row('1/6/7',11,['rx_power'=>null])])]);$out=$v->forNode(null,'TEST00000001');
        $this->assertSame(1,$out['olt_id']);$this->assertNull($out['rx_power']);$this->assertFalse($out['rx_available']);$this->assertTrue($out['is_online']);
    }

    public function test_unmapped_discovery_reuses_the_request_index_without_queries_or_redecoding(): void
    {
        $device=new class extends OltDevice {public int $snapshotReads=0;public function getAttribute($key){if($key==='last_telemetry_snapshot')$this->snapshotReads++;return parent::getAttribute($key);}};
        $device->setRawAttributes($this->device(1,[$this->row()])->getAttributes());$v=new View([$device]);
        \Illuminate\Support\Facades\DB::enableQueryLog();\Illuminate\Support\Facades\DB::flushQueryLog();
        for($i=0;$i<1000;$i++)$v->forNode(null,'TEST00000001');
        $this->assertSame(1,$device->snapshotReads);$this->assertSame([],\Illuminate\Support\Facades\DB::getQueryLog());
    }

}
