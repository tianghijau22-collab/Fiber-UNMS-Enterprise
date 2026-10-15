<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/** Serializes ZTE writes per OLT. The snapshot ledger and registration change commit together. */
class OnuTelemetryWriter
{
    public const CACHE_KEYS = ['customers_index_payload_v5','gis_map_data_payload_v2','gis_topology_hierarchy_all','dashboard_metrics_payload'];

    public static function supported(OltDevice $olt): bool
    {
        return $olt->connection_mode === 'live' && str_contains(strtolower((string)($olt->vendor_key ?: $olt->vendor)), 'zte');
    }

    public static function invalidate(): void
    {
        foreach (self::CACHE_KEYS as $key) Cache::forget($key);
    }

    private static function key(array $row): ?string
    {
        $sn = strtoupper(trim((string)($row['serial_number'] ?? $row['sn'] ?? '')));
        $index = ZteOnuIdentityMap::ifIndexFromPort((string)($row['port'] ?? ''));
        $rawId=$row['onu_id'] ?? null;
        $id=(is_int($rawId) || (is_string($rawId) && ctype_digit($rawId))) && (int)$rawId>0 && (int)$rawId<=65535 ? (int)$rawId : null;
        return $sn !== '' && $index !== null && $id !== null ? "$sn@$index:$id" : null;
    }

    /** Ownership follows explicit topology ancestors, never the first available device. */
    public static function ownerId(?int $nodeId, array $nodes): ?int
    {
        $seen=[];
        for ($depth=0; $nodeId && $depth<8; $depth++) {
            if (isset($seen[$nodeId]) || !isset($nodes[$nodeId])) return null;
            $seen[$nodeId]=true; $node=$nodes[$nodeId];
            if ($node->deleted_at !== null) return null;
            if ($node->olt_device_id) return (int)$node->olt_device_id;
            $nodeId=$node->parent_node_id ? (int)$node->parent_node_id : null;
        }
        return null;
    }

    public static function ownerNodeIds(int $oltId): array
    {
        $nodes=DB::table('network_nodes')->select('id','parent_node_id','olt_device_id','deleted_at')->get()->keyBy('id')->all();
        return array_values(array_filter(array_keys($nodes),fn($id)=>self::ownerId((int)$id,$nodes)===$oltId));
    }

    /** Read-only candidate lookup, shared by write planning and audit inspection. */
    public function registrationCandidates(array $serials): \Illuminate\Support\Collection
    {
        return empty($serials) ? collect() : DB::table('ont_registrations as r')
                ->join('customer_services as s','s.id','=','r.customer_service_id')
                ->join('customers as c','c.id','=','s.customer_id')
                ->leftJoin('network_ports as p','p.customer_service_id','=','s.id')
                ->leftJoin('network_ports as op','op.id','=','r.olt_port_id')
                ->whereNull('r.deleted_at')->whereNull('s.deleted_at')->whereNull('c.deleted_at')
                ->where(function($q)use($serials){$q->whereIn(DB::raw('UPPER(TRIM(r.onu_serial))'),$serials)->orWhereIn(DB::raw('UPPER(TRIM(r.onu_mac))'),$serials);})
                ->select('r.*','p.node_id as service_node_id','op.node_id as registration_node_id','c.name as customer_name')->get();
    }

    public static function hasAliasConflict(object $registration, array $identities): bool
    {
        $locations=[];
        foreach([$registration->onu_serial,$registration->onu_mac] as $value) {
            $sn=strtoupper(trim((string)$value));
            if(isset($identities[$sn]) && ($key=self::key($identities[$sn])))$locations[$key]=true;
        }
        return count($locations)>1;
    }

    public function applyPortLoss(OltDevice $olt,string $port,string $at,string $source='point'): array
    {
        $index=ZteOnuIdentityMap::ifIndexFromPort($port);$snapshot=$olt->last_telemetry_snapshot ?? [];
        $identities=ZteOnuIdentityMap::uniqueRows(array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []));
        $rows=[];
        foreach($identities as $row)if($index!==null && ZteOnuIdentityMap::ifIndexFromPort($row['port'])===$index) {
            $row=array_replace($row,['status'=>'Offline','is_online'=>false,'rx_power'=>null,'rx_available'=>false]);
            // This is a new port observation, independent of the old per-ONU sample timestamp.
            unset($row['telemetry_sample_version'],$row['sample_observed_at']);$rows[]=$row;
        }
        return $this->apply($olt,$rows,$at,$source);
    }

    public static function mergePortObservations(array $preserved, array $observed): array
    {
        $result=[];
        foreach($preserved as $row)if($key=self::key($row))$result[$key]=$row;
        foreach(ZteOnuIdentityMap::uniqueRows($observed) as $sn=>$row) {
            $at=OnuTelemetrySample::epoch($row['identity_observed_at'] ?? null);
            if($at===null || $at<microtime(true)-600 || $at>microtime(true)+5)continue;
            foreach($result as $key=>$old) {
                if(strtoupper(trim((string)($old['serial_number'] ?? '')))!==$sn)continue;
                $previousAt=OnuTelemetrySample::epoch($old['identity_observed_at'] ?? null);
                // New serial-table evidence can establish a move. Online status alone never wins a conflict.
                if($previousAt===null || $at>$previousAt)unset($result[$key]);
            }
            $result[self::key($row)]=$row;
        }
        return $result;
    }

    public function apply(OltDevice $olt, array $rows, string $at, string $source='poll', bool $alarms=false, array $suppressedPorts=[]): array
    {
        $time=OnuTelemetrySample::epoch($at); $now=microtime(true);
        $result=['accepted'=>0,'updated'=>0,'unknown'=>0,'rejected'=>count($rows),'ambiguous_registrations'=>0,'unmapped_registrations'=>0,'transitions'=>[]];
        if (!self::supported($olt) || !in_array($source,['poll','point','event'],true)
            || $time === null || $time>$now+5 || $time<$now-180 || !ZteOnuIdentityMap::uniqueRows($rows)) return $result;
        $result=DB::transaction(function() use($olt,$rows,$at,$time,$source,$result) {
            $locked=OltDevice::whereKey($olt->id)->lockForUpdate()->firstOrFail();
            if(!self::supported($locked) || $locked->status!=='active')return $result;
            $snapshot=$locked->getAttribute('last_telemetry_snapshot') ?? [];
            $inventory=array_merge($snapshot['onu_list'] ?? [],$snapshot['unconfigured_onus'] ?? []);
            $current=ZteOnuIdentityMap::uniqueRows($inventory);
            $incoming=ZteOnuIdentityMap::uniqueRows($rows);
            $nodes=DB::table('network_nodes')->select('id','parent_node_id','olt_device_id','deleted_at')->sharedLock()->get()->keyBy('id')->all();
            // Ownership cannot move while this batch applies. These locks exclude topology edits, not other readers.
            DB::table('network_ports')->select('id')->sharedLock()->get();
            $serials=array_keys($incoming);
            $registrations=$this->registrationCandidates($serials);
            $bySerial=[];$aliasConflicts=[];$catalog=array_replace($current,$incoming);
            foreach($registrations as $reg) {
                $owner=self::ownerId($reg->service_node_id ? (int)$reg->service_node_id : ($reg->registration_node_id ? (int)$reg->registration_node_id : null),$nodes);
                if($owner!==(int)$olt->id) continue;
                if(self::hasAliasConflict($reg,$catalog))$aliasConflicts[(int)$reg->id]=true;
                foreach(array_unique([strtoupper(trim((string)$reg->onu_serial)),strtoupper(trim((string)$reg->onu_mac))]) as $sn) {
                    if($sn !== '') $bySerial[$sn][(int)$reg->id]=$reg;
                }
            }
            $ledger=self::recentLedger($snapshot['_onu_write_ledger'] ?? []);
            foreach($incoming as $sn=>$row) {
                $key=self::key($row); $identityAt=OnuTelemetrySample::epoch($row['identity_observed_at'] ?? null);
                // A fresh poll may establish a new tuple; point/event writes must confirm current inventory.
                if(!$key || $identityAt === null || $identityAt<microtime(true)-600 || $identityAt>microtime(true)+5) continue;
                if($source!=='poll' && (!isset($current[$sn]) || self::key($current[$sn])!==$key)) continue;
                $sampleAt=$at;$sampleTime=$time;
                if(($row['telemetry_sample_version'] ?? null)===2) {
                    $rowTime=OnuTelemetrySample::epoch($row['sample_observed_at'] ?? null);
                    if($rowTime===null || $rowTime<microtime(true)-180 || $rowTime>microtime(true)+5)continue;
                    if($rowTime<$sampleTime){$sampleAt=$row['sample_observed_at'];$sampleTime=$rowTime;}
                }
                $previous=$ledger[$sn] ?? null;
                $previousTime=OnuTelemetrySample::epoch($previous['sample_observed_at'] ?? null);
                $rank=['poll'=>1,'point'=>2,'event'=>3];
                if($previousTime !== null && ($sampleTime<$previousTime || ($sampleTime===$previousTime && ($rank[$source] ?? 0)<=($rank[$previous['write_source'] ?? ''] ?? 0)))) continue;
                $sample=OnuTelemetrySample::normalize($row,$sampleAt);
                if($sample['is_online']===true)$sample['last_down_cause']=null;
                elseif($sample['is_online']===false) $sample['last_down_cause']=$source==='event'
                    ? ($row['last_down_cause'] ?? null) : ($previous['last_down_cause'] ?? null);
                $sample += ['write_source'=>$source,'write_tuple'=>$key,'serial_number'=>$sn,'port'=>$row['port'],'onu_id'=>(string)$row['onu_id'],
                    'identity_source'=>$row['identity_source'],'identity_observed_at'=>$row['identity_observed_at']];
                $ledger[$sn]=$sample;
                $result['accepted']++;$result['rejected']--;
                if($sample['is_online'] === null) {$result['unknown']++;continue;}
                $matches=$bySerial[$sn] ?? [];
                if(count($matches)!==1) {
                    if(count($matches)>1)$result['ambiguous_registrations']++;else $result['unmapped_registrations']++;
                    continue;
                }
                $reg=reset($matches);
                if(isset($aliasConflicts[(int)$reg->id])){$result['ambiguous_registrations']++;continue;}
                $newStatus=$sample['is_online'] ? 'active' : 'inactive';
                $values=['status'=>$newStatus,'rx_power'=>$sample['is_online'] ? $sample['rx_power'] : -40.0,'updated_at'=>now()];
                if($sample['is_online']) $values['last_online_at']=now();
                $changed=DB::table('ont_registrations')->where('id',$reg->id)->where('customer_service_id',$reg->customer_service_id)
                    ->where('onu_serial',$reg->onu_serial)->whereNull('deleted_at')->update($values);
                $result['updated']+=$changed;
                if($changed && $reg->status!==$newStatus) $result['transitions'][]=['olt_id'=>$olt->id,'registration_id'=>$reg->id,
                    'serial_number'=>$sn,'customer_name'=>$reg->customer_name,'port'=>$row['port'],'from'=>$reg->status,'to'=>$newStatus,'rx_power'=>$sample['rx_power']];
            }
            if($result['accepted']===0)return $result;
            $snapshot['_onu_write_ledger']=$ledger;
            $snapshot=self::overlay($snapshot,$ledger);
            $locked->setAttribute('last_telemetry_snapshot',$snapshot);$locked->save();
            DB::afterCommit(fn()=>self::invalidate());
            $olt->setRawAttributes($locked->getAttributes(),true);
            return $result;
        },3);
        if($alarms && $result['transitions']) DB::afterCommit(fn()=>$this->recordTransitions($result['transitions'],$suppressedPorts));
        return $result;
    }

    /** Called by OltDevice::update: stale full snapshots cannot erase newer per-ONU writes. */
    public function publish(OltDevice $olt, array $attributes): bool
    {
        return DB::transaction(function()use($olt,$attributes){
            $locked=OltDevice::whereKey($olt->id)->lockForUpdate()->firstOrFail();
            $current=$locked->getAttribute('last_telemetry_snapshot') ?? [];
            $incoming=$attributes['last_telemetry_snapshot'] ?? [];
            $ledger=self::recentLedger($current['_onu_write_ledger'] ?? []);
            // Never accept a ledger supplied by an old model instance or a topology/provisioning operation.
            $incoming['_onu_write_ledger']=$ledger;
            $currentBySerial=[];
            foreach(array_merge($current['onu_list'] ?? [],$current['unconfigured_onus'] ?? []) as $row) {
                $sn=strtoupper(trim((string)($row['serial_number'] ?? '')));
                if(isset($ledger[$sn]) && self::key($row)===$ledger[$sn]['write_tuple']) $currentBySerial[$sn]=$row;
            }
            $seen=[];
            foreach(['onu_list','unconfigured_onus'] as $list) {
                $existing=[];foreach($current[$list] ?? [] as $row)if($key=self::key($row))$existing[$key]=$row;
                $rows=$incoming[$list] ?? [];
                foreach($rows as &$row) {
                    $sn=strtoupper(trim((string)($row['serial_number'] ?? '')));$seen[$sn]=true;
                    if(isset($ledger[$sn],$currentBySerial[$sn]) && self::key($row)!==$ledger[$sn]['write_tuple']) $row=$currentBySerial[$sn];
                    if(($key=self::key($row)) && !isset($ledger[strtoupper(trim((string)($row['serial_number'] ?? '')))])) {
                        $old=$existing[$key] ?? null;
                        // An unmigrated writer cannot turn an inventory refresh into a fresh measurement.
                        $observed=$old['sample_observed_at'] ?? $current['polled_at'] ?? null;
                        $row=array_replace($row,OnuTelemetrySample::normalize($old ?? ['status'=>'Unknown'],$observed ?? ''));
                    }
                }
                unset($row);$incoming[$list]=$rows;
            }
            foreach(['onu_list','unconfigured_onus'] as $list) {
                foreach($current[$list] ?? [] as $row) {
                    $sn=strtoupper(trim((string)($row['serial_number'] ?? '')));
                    if(!isset($seen[$sn]) && isset($ledger[$sn]) && self::key($row)===$ledger[$sn]['write_tuple']
                        && OnuTelemetrySample::epoch($ledger[$sn]['sample_observed_at'])>=microtime(true)-180) {
                        $incoming[$list][]=$row;$seen[$sn]=true;
                    }
                }
            }
            $attributes['last_telemetry_snapshot']=self::overlay($incoming,$ledger);
            $locked->fill($attributes);$saved=$locked->save();
            $olt->setRawAttributes($locked->getAttributes(),true);
            DB::afterCommit(fn()=>self::invalidate());
            return $saved;
        },3);
    }

    private static function overlay(array $snapshot, array $ledger): array
    {
        foreach(['onu_list','unconfigured_onus'] as $list) {
            $rows=$snapshot[$list] ?? [];
            foreach($rows as &$row) {
                $sn=strtoupper(trim((string)($row['serial_number'] ?? '')));$sample=$ledger[$sn] ?? null;
                if($sample && self::key($row)===($sample['write_tuple'] ?? null)) $row=array_replace($row,$sample);
            }
            unset($row);$snapshot[$list]=$rows;
        }
        foreach($snapshot['pon_ports'] ?? [] as $key=>$port) {
            $index=ZteOnuIdentityMap::ifIndexFromPort((string)($port['port_id'] ?? ''));if($index===null)continue;
            $registered=array_filter($snapshot['onu_list'] ?? [],fn($r)=>ZteOnuIdentityMap::ifIndexFromPort((string)($r['port'] ?? ''))===$index);
            $unconfigured=array_filter($snapshot['unconfigured_onus'] ?? [],fn($r)=>ZteOnuIdentityMap::ifIndexFromPort((string)($r['port'] ?? $r['detected_port'] ?? ''))===$index);
            $all=array_merge($registered,$unconfigured);
            $online=count(array_filter($all,fn($r)=>in_array(strtolower($r['status'] ?? ''),['online','active','working'],true)));
            $down=count(array_filter($all,fn($r)=>in_array(strtolower($r['status'] ?? ''),['offline','inactive','los'],true)));
            $port['registered_onus']=count($registered);$port['unconfigured_onus']=count($unconfigured);$port['online_onus']=$online;
            $port['los_onus']=$down;$port['unknown_onus']=count($all)-$online-$down;
            $port['is_mass_outage']=$port['unknown_onus']===0 && count($all)>=3 && ($down===count($all) || (count($all)>=10 && $down/count($all)>=0.9 && $online<=3));
            $snapshot['pon_ports'][$key]=$port;
        }
        return $snapshot;
    }

    private static function recentLedger(array $ledger): array
    {
        // Older in-flight observations are already rejected at 180 seconds. Bound retained ordering metadata.
        return array_filter($ledger,fn($sample)=>is_array($sample)
            && ($at=OnuTelemetrySample::epoch($sample['sample_observed_at'] ?? null))!==null && $at>=microtime(true)-600);
    }

    private function recordTransitions(array $transitions, array $suppressedPorts): void
    {
        foreach($transitions as $change) {
            if(in_array($change['port'],$suppressedPorts,true)) continue;
            $key='onu_write_'.$change['olt_id'].'_'.$change['registration_id'];
            $history=Cache::get($key.'_flaps',[]);
            $flaps=array_values(array_filter(is_array($history) ? $history:[],fn($t)=>is_int($t) && $t<=time() && time()-$t<=900));$flaps[]=time();
            Cache::put($key.'_flaps',$flaps,1800);
            if(count($flaps)>=3) {
                Cache::put($key.'_suppressed',true,1800);
                if(!Cache::has($key.'_flapping_notified')) {
                    Cache::put($key.'_flapping_notified',true,1800);
                    \App\Models\AuditLog::record('ALARM_FLAPPING','Monitoring OLT',
                        $change['customer_name'].' ('.$change['serial_number'].') mengalami transisi berulang; notifikasi diredam 30 menit.',null,$change);
                }
            }
            if(Cache::has($key.'_suppressed') || Cache::has($key.'_'.$change['to'])) continue;
            Cache::put($key.'_'.$change['to'],true,600);
            $action=$change['to']==='active' ? 'ALARM_RECOVERY' : 'ALARM_SUDDEN_LOS';
            \App\Models\AuditLog::record($action,'Monitoring OLT',
                $change['customer_name'].' ('.$change['serial_number'].') '.$change['from'].' → '.$change['to'].' pada '.$change['port'],null,$change);
        }
    }
}
