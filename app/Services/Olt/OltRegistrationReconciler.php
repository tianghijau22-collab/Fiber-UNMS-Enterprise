<?php
namespace App\Services\Olt;

use App\Models\OltDevice;
use Illuminate\Support\Facades\Cache;

/** Absence needs a recent complete serial-table inventory. Rx N/A is not absence. */
class OltRegistrationReconciler
{
    private array $inventory=[];
    private array $duplicateCounts=[];
    private array $meta;
    private bool $zte;
    private ?int $deviceId;
    private ?array $otherOwners=null;
    public function __construct(?OltDevice $device,private array $groups,iterable $registrations)
    {
        $this->deviceId=$device?(int)$device->id:null;
        $this->zte=$device && str_contains(strtolower((string)($device->vendor_key?:$device->vendor)),'zte');
        $cache=$device?Cache::get(ZteOnuIdentityMap::cacheKey((int)$device->id)):null;
        $health=$device?Cache::get(ZteOnuIdentityMap::cacheKey((int)$device->id).'_refresh_health'):null;
        $entries=ZteOnuIdentityMap::cachedEntries($cache);
        $verified=$device && $device->status==='active' && $entries!==[] && is_array($health) && ($health['accepted']??false)===true && ($health['complete']??false)===true && ($health['attempted_at']??null)===($cache['observed_at']??null);
        $this->inventory=array_fill_keys(array_values($entries),true);
        $this->meta=['absence_verified'=>(bool)$verified,'inventory_observed_at'=>$cache['observed_at']??null,'inventory_entries'=>count($entries),'message'=>$verified?'Dibandingkan dengan inventaris serial lengkap tersimpan.':'Inventaris belum lengkap atau sudah usang. Data yang tidak cocok belum dapat dinyatakan hilang dari OLT.'];
        foreach($registrations as $r){$sn=strtoupper(trim((string)$r->onu_serial));if($sn!=='')$this->duplicateCounts[$sn]=($this->duplicateCounts[$sn]??0)+1;}
    }
    public function coverage(): array{return $this->meta;}
    public function issue(object $registration,bool $matched): ?array
    {
        if($registration instanceof \App\Models\OntRegistration){
            $serviceOwner=OnuTelemetryView::ownerId($registration->customerService?->networkPort?->node);
            $registrationOwner=OnuTelemetryView::ownerId($registration->oltPort?->node);
            if($serviceOwner!==null&&$registrationOwner!==null&&$serviceOwner!==$registrationOwner)return $this->result('topology_owner_conflict','Hubungan layanan dan registrasi menunjuk OLT yang berbeda; periksa topologi sebelum memindahkan data.');
        }
        $sn=strtoupper(trim((string)$registration->onu_serial));$mac=strtoupper(trim((string)$registration->onu_mac));
        if($sn===''||preg_match('/^0+$/',$sn)||($this->zte&&!preg_match('/^[A-Z0-9]{4}[0-9A-F]{8}$/D',$sn)))return $this->result('invalid_serial','SN kosong atau tidak valid; perlu pemeriksaan data pelanggan.');
        if(($this->duplicateCounts[$sn]??0)>1)return $this->result('duplicate_customer_serial','SN dipakai beberapa layanan pelanggan; periksa pelanggan lama dan baru.');
        if(count($this->groups[$sn]??[])>1&&!$matched)return $this->result('ambiguous_identity','SN terdeteksi di beberapa lokasi OLT; lokasi belum dapat dipastikan.');
        // A row physically present in the serial inventory is never classified as missing.
        if(isset($this->inventory[$sn])||($mac!==''&&isset($this->inventory[$mac])))return null;
        $inventoryAt=OnuTelemetrySample::epoch($this->meta['inventory_observed_at']);
        $recentPositive=false;
        foreach($this->groups[$sn]??[] as $row){$at=OnuTelemetrySample::epoch($row['identity_observed_at']??null);if($at!==null&&$at>=microtime(true)-600&&$at<=microtime(true)+5&&($inventoryAt===null||$at>=$inventoryAt))$recentPositive=true;}
        if($matched&&($recentPositive||!$this->meta['absence_verified']))return null;
        $others=$this->otherOwners()[$sn]??[];
        if($others)return $this->result('different_olt','SN terdeteksi pada OLT lain ('.implode(', ',$others).'); periksa hubungan OLT/ODP. Data tidak dibersihkan dari sini.');
        return $this->meta['absence_verified']?$this->result('missing_in_inventory','SN tidak ditemukan pada inventaris OLT lengkap terbaru. Penyebab atau status berlangganan perlu diverifikasi.',true):$this->result('inventory_unverified','Belum dapat dicocokkan; kelengkapan atau kebaruan inventaris OLT belum terverifikasi.');
    }
    private function otherOwners(): array
    {
        if($this->otherOwners!==null)return $this->otherOwners;
        $this->otherOwners=[];if($this->deviceId===null)return [];
        foreach(OltDevice::where('status','active')->where('connection_mode','live')->where('id','!=',$this->deviceId)->get(['id','name','last_telemetry_snapshot']) as $device){
            foreach(ZteOnuIdentityMap::groups(ZteOnuIdentityMap::snapshotRows($device->last_telemetry_snapshot??[])) as $sn=>$locations)foreach($locations as $row){
                $at=OnuTelemetrySample::epoch($row['identity_observed_at']??null);
                if($at!==null&&$at>=microtime(true)-600&&$at<=microtime(true)+5)$this->otherOwners[$sn][$device->id]=$device->name;
            }
        }
        return $this->otherOwners;
    }
    private function result(string $code,string $reason,bool $verified=false): array
    {return ['issue_code'=>$code,'orphan_reason'=>$reason,'absence_verified'=>$verified,'inventory_observed_at'=>$this->meta['inventory_observed_at'],'can_delete'=>$verified];}
}
