<?php

namespace App\Services\Olt;

use App\Models\{CustomerService,OltDevice,OntRegistration};
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Customer registration exists independently of ODP assignment. This index never writes topology. */
class OltCustomerRegistrationIndex
{
    public Collection $registrations;
    private array $presence = [];
    private array $hardwareOwners = [];
    private array $nodes;
    private array $inferred = [];

    public function __construct(private ?OltDevice $device, array $physicalRows)
    {
        $this->nodes = DB::table('network_nodes')->get(['id','parent_node_id','olt_device_id','deleted_at'])->keyBy('id')->all();
        $this->registrations = OntRegistration::with(['customerService.customer','customerService.networkPort.node','customerService.servicePackage','oltPort.node'])
            ->whereNotNull('customer_service_id')->whereHas('customerService.customer')->get();
        foreach ($this->registrations as $ont) {
            foreach ($this->keys($ont,true) as $key) $this->presence[$key]['r:'.$ont->id] = $ont;
        }
        foreach (CustomerService::with('customer','networkPort.node')->whereHas('customer')->whereDoesntHave('ontRegistration')->whereNotNull('onu_serial')->get() as $service) {
            $key = strtoupper(trim((string)$service->onu_serial));
            if ($key !== '') $this->presence[$key]['s:'.$service->id] = $service;
        }
        foreach (OltDevice::where('status','active')->where('connection_mode','live')->get() as $olt) {
            $rows = ZteOnuIdentityMap::snapshotRows($olt->last_telemetry_snapshot ?? []);
            if ($device && (int)$olt->id === (int)$device->id) $rows = array_merge($rows,$physicalRows);
            foreach (ZteOnuIdentityMap::groups($rows) as $sn=>$locations) foreach ($locations as $row) {
                $at = OnuTelemetrySample::epoch($row['identity_observed_at'] ?? null);
                if ($at !== null && $at >= microtime(true)-600 && $at <= microtime(true)+5) $this->hardwareOwners[$sn][(int)$olt->id] = true;
            }
        }
    }

    private function keys(OntRegistration $ont, bool $all=false): array
    {
        return array_values(array_unique(array_filter(array_map(fn($v)=>strtoupper(trim((string)$v)),[
            $ont->onu_serial ?: $ont->customerService?->onu_serial,
            $ont->onu_mac,
            $all ? $ont->customerService?->onu_serial : null,
        ]))));
    }

    public function owners(OntRegistration $ont): array
    {
        return array_values(array_unique(array_filter([
            OnuTelemetryWriter::ownerId($ont->customerService?->networkPort?->node_id,$this->nodes),
            OnuTelemetryWriter::ownerId($ont->oltPort?->node_id,$this->nodes),
        ],fn($id)=>$id!==null)));
    }

    public function scoped(): Collection
    {
        if (!$this->device) return $this->registrations;
        $id=(int)$this->device->id;
        return $this->registrations->filter(function($ont)use($id){
            $owners=$this->owners($ont);
            if ($owners) return in_array($id,$owners,true);
            $hardware=[];
            foreach ($this->keys($ont) as $key) foreach ($this->hardwareOwners[$key] ?? [] as $owner=>$_) $hardware[$owner]=true;
            if (count($hardware)!==1 || !isset($hardware[$id])) return false;
            $this->inferred[$ont->id]=true;
            return true;
        })->values();
    }

    public function known(string $serial, string $mac=''): bool
    {
        return isset($this->presence[strtoupper(trim($serial))]) || ($mac!=='' && isset($this->presence[strtoupper(trim($mac))]));
    }

    public function inferred(OntRegistration $ont): bool { return isset($this->inferred[$ont->id]); }

    /** Known customer data with unresolved/conflicting ownership belongs in review, never in new registration. */
    public function reviews(array $physicalRows, Collection $scoped): array
    {
        $included = $scoped->keyBy('id'); $result=[];
        foreach ($physicalRows as $row) {
            $sn=strtoupper(trim((string)($row['serial_number'] ?? '')));
            $matches=$this->presence[$sn] ?? [];
            $mac=strtoupper(trim((string)($row['mac_address'] ?? $row['onu_mac'] ?? '')));
            if($mac!=='')$matches+=($this->presence[$mac] ?? []);
            foreach ($matches as $key=>$record) {
                $isOnt=$record instanceof OntRegistration;
                if ($isOnt && isset($included[$record->id])) continue;
                $service=$isOnt ? $record->customerService : $record;
                $owners=$isOnt ? $this->owners($record) : [];
                $reason=!$isOnt ? 'SN sudah ada pada layanan pelanggan, tetapi registrasi ONU belum lengkap.'
                    : ($owners ? 'SN sudah terdaftar pada pelanggan dengan hubungan OLT lain. Periksa hubungan ODP/OLT; tidak perlu registrasi pelanggan baru.'
                        : 'SN sudah terdaftar di Customers, tetapi lokasi OLT belum dapat dipastikan dari identitas perangkat terbaru.');
                $result[$key]=[
                    'id'=>$isOnt ? $record->id : 'service:'.$record->id,
                    'customer_id'=>$service?->customer_id,'customer_name'=>$service?->customer?->name,
                    'customer_number'=>$service?->customer?->customer_number,'service_id'=>$service?->id,
                    'onu_serial'=>$sn,'onu_mac'=>$isOnt ? $record->onu_mac : null,
                    'odp_name'=>$service?->networkPort?->node?->name ?: 'Tanpa ODP',
                    'odp_port'=>$service?->networkPort?->port_number ?? '—',
                    'olt_port'=>$row['port'] ?? $row['detected_port'] ?? null,
                    'registered_at'=>$isOnt ? $record->registered_at?->format('d M Y H:i') : null,
                    'issue_code'=>$owners ? 'registered_other_olt' : 'registration_scope_unverified',
                    'orphan_reason'=>$reason,'can_delete'=>false,'absence_verified'=>false,
                ];
            }
        }
        return array_values($result);
    }
}
