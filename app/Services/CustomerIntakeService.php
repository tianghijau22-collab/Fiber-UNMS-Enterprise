<?php
namespace App\Services;

use App\Models\{Customer,CustomerService,OntRegistration,NetworkNode,NetworkPort,ServicePackage,AuditLog};
use App\Services\Olt\{OnuTelemetryView,OnuTelemetryWriter};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Administrative intake only. Hardware observations are never manufactured by imports. */
class CustomerIntakeService
{
    public static function numberKey(?string $value): string
    {
        $v=strtoupper(preg_replace('/\s+/u','',trim($value??'')));
        return preg_match('/^(?:CMN)?(\d+)$/D',$v,$m) ? 'CMN'.str_pad(ltrim($m[1],'0')?:'0',4,'0',STR_PAD_LEFT):$v;
    }
    public static function odpKey(?string $value): string
    {
        $v=strtoupper(preg_replace('/\s+/u','',trim($value??'')));
        if(preg_match('/^(?:ODP[-_]?)?([0-9]+(?:[-_][0-9]+)*)([A-Z]?)$/D',$v,$m))
            return implode('-',array_map(fn($n)=>(string)(int)$n,preg_split('/[-_]/',$m[1]))).($m[2]??'');
        return $v;
    }
    public static function blank(mixed $value): bool { return in_array(strtolower(trim((string)$value)),['','-','null','n/a'],true); }
    public static function version(Customer $customer): string
    {
        return hash('sha256',json_encode([$customer->getAttributes(),$customer->services->map(fn($s)=>[$s->getAttributes(),$s->ontRegistration?->getAttributes(),$s->networkPort?->getAttributes()])->all()],JSON_THROW_ON_ERROR));
    }
    public static function preview(Customer $customer,array $data): array
    {
        $changes=[];$conflicts=[];$services=$customer->services;
        if($services->count()>1)$conflicts[]='Pelanggan memiliki beberapa layanan; pilih layanan melalui halaman Customers.';
        $s=$services->first();$sn=strtoupper(trim($data['onu_serial']??''));
        foreach(['name'=>'nama','phone'=>'telepon','email'=>'email','address'=>'alamat'] as $key=>$label) {
            $empty=self::blank($customer->$key)||($key==='address'&&$customer->$key==='Solok, Sumatera Barat');
            if($empty&&!self::blank($data[$key]??null))$changes[]=$label;
        }
        if(!$s)$changes[]='layanan dan registrasi ONU';
        else {
            $existing=strtoupper(trim($s->ontRegistration?->onu_serial ?: $s->onu_serial ?: ''));
            if($sn!==''&&$existing!==''&&$existing!==$sn)$conflicts[]='SN sumber berbeda dari SN tersimpan; tidak diganti otomatis.';
            if(!$s->ontRegistration)$changes[]='registrasi ONU';
            elseif(self::blank($s->ontRegistration->onu_serial)&&$sn!=='')$changes[]='SN registrasi';
            if(self::blank($s->onu_serial)&&$sn!=='')$changes[]='SN layanan';
            if($s->networkPort && !empty($data['odp_id']) && (int)$s->networkPort->node_id!==(int)$data['odp_id'])$conflicts[]='ODP sumber berbeda dari ODP tersimpan; tidak dipindahkan otomatis.';
        }
        if(!$s?->networkPort&&!empty($data['odp_id']))$changes[]='hubungan port ODP';
        return ['allow_odp_assignment'=>!$s?->networkPort&&$conflicts===[],'repair_changes'=>$changes,'repair_conflicts'=>$conflicts,'can_repair'=>$changes!==[]&&$conflicts===[], 'repair_version'=>self::version($customer),'existing_customer_id'=>$customer->id];
    }
    public function save(array $data): array
    {
        $result=DB::transaction(function()use($data){
            // Serialize manual intake without taking a hardware/poller lock.
            DB::table('system_settings')->insertOrIgnore(['key'=>'customer_intake_lock','value'=>'1','created_at'=>now(),'updated_at'=>now()]);
            DB::table('system_settings')->where('key','customer_intake_lock')->lockForUpdate()->first();
            if(!empty($data['device_id']))abort_if(OntRegistration::whereRaw('UPPER(TRIM(onu_serial)) = ?',[strtoupper(trim($data['onu_serial']??''))])->whereHas('customerService.customer')->exists(),409,'SN sudah terhubung ke pelanggan. Muat ulang data sebelum mendaftarkan.');
            $key=self::numberKey($data['customer_number']??'');
            if($key===''||$key==='CMN-UNKNOWN')throw ValidationException::withMessages(['customer_number'=>'Nomor pelanggan wajib diisi dan harus dapat dibedakan.']);
            $matches=Customer::withTrashed()->get()->filter(fn($c)=>self::numberKey($c->customer_number)===$key);
            if($matches->count()>1)throw ValidationException::withMessages(['customer_number'=>'Beberapa ID pelanggan sama setelah normalisasi; periksa manual.']);
            $customer=$matches->first();$updating=$customer!==null;
            if($customer?->trashed())throw ValidationException::withMessages(['customer_number'=>'ID ini berada di arsip pelanggan; pulihkan atau periksa melalui Customers.']);
            if($updating){
                $customer->load('services.ontRegistration','services.networkPort');
                if(($data['mode']??'create')!=='fill_missing')throw ValidationException::withMessages(['customer_number'=>'ID pelanggan sudah ada. Gunakan Lengkapi Data Kosong pada pratinjau impor.']);
                abort_unless(isset($data['expected_version'])&&hash_equals(self::version($customer),$data['expected_version']),409,'Data pelanggan telah berubah. Tarik ulang pratinjau sebelum melengkapi data.');
                $plan=self::preview($customer,$data);
                if($plan['repair_conflicts'])throw ValidationException::withMessages(['customer_number'=>implode(' ',$plan['repair_conflicts'])]);
                $s=$customer->services->first();
                $fills=[];
                foreach(['name','phone','email','address'] as $field)if((self::blank($customer->$field)||($field==='address'&&$customer->$field==='Solok, Sumatera Barat'))&&!self::blank($data[$field]??null))$fills[$field]=$data[$field];
                if($fills)$customer->update($fills);
            }else{
                $number=str_starts_with($key,'CMN')&&ctype_digit(substr($key,3))?'CMN '.substr($key,3):trim($data['customer_number']);
                $customer=Customer::create(['customer_number'=>$number,'name'=>trim($data['name']),'phone'=>$data['phone']??'-','email'=>$data['email']??null,'address'=>$data['address']??'','status'=>'active']);$s=null;
            }
            $sn=strtoupper(trim($data['onu_serial']??($s?->onu_serial??'')));
            if(self::blank($sn))throw ValidationException::withMessages(['onu_serial'=>'SN ONU wajib tersedia; sistem tidak membuat SN pengganti.']);
            if(!$s)$s=CustomerService::create(['customer_id'=>$customer->id,'service_package_id'=>$data['service_package_id']??ServicePackage::first()?->id,'status'=>'active','installation_date'=>now(),'activated_at'=>now(),'onu_serial'=>$sn]);
            elseif(self::blank($s->onu_serial))$s->update(['onu_serial'=>$sn]);
            if($s->ontRegistration&&self::blank($s->ontRegistration->onu_serial))$s->ontRegistration->update(['onu_serial'=>$sn]);
            $odpId=$data['odp_id']??null;$port=$s->networkPort;
            if($odpId&&!$port){
                $node=NetworkNode::whereKey($odpId)->where('node_type','ODP')->first();
                if(!$node)throw ValidationException::withMessages(['odp_id'=>'Pilih node ODP yang masih aktif.']);
                $previousOwner=OnuTelemetryView::ownerId($s->ontRegistration?->oltPort?->node);
                if($previousOwner!==null&&OnuTelemetryView::ownerId($node)!==$previousOwner)throw ValidationException::withMessages(['odp_id'=>'Registrasi masih terhubung ke OLT lain; periksa perpindahan secara manual.']);
                if(!empty($data['device_id'])&&OnuTelemetryView::ownerId($node)!==(int)$data['device_id'])throw ValidationException::withMessages(['odp_id'=>'ODP tidak berada pada OLT yang dipilih.']);
                $query=NetworkPort::where('node_id',$odpId)->where('status','available')->whereNull('customer_service_id')->whereNull('connected_to_port_id')->where(fn($q)=>$q->whereNull('destination_label')->orWhere('destination_label',''))->where(fn($q)=>$q->whereNull('customer_name_cache')->orWhere('customer_name_cache',''));
                if(!empty($data['odp_port_id']))$query->whereKey($data['odp_port_id']);
                $port=$query->orderBy('port_number')->lockForUpdate()->first();
                if(!$port)throw ValidationException::withMessages(['odp_id'=>'Port ODP tidak tersedia atau sudah terisi. Pilih port lain; tidak ada data yang disimpan.']);
                $port->update(['customer_service_id'=>$s->id,'customer_name_cache'=>$customer->name,'status'=>'used']);
            }
            if(!$s->ontRegistration)OntRegistration::create(['customer_service_id'=>$s->id,'olt_port_id'=>$port?->id,'onu_serial'=>$sn,'onu_type'=>'HGU GPON/EPON','status'=>'pending','registered_at'=>now(),'last_online_at'=>null,'rx_power'=>null,'tx_power'=>null,'notes'=>!empty($data['device_id'])?'Registrasi pelanggan dari halaman OLT; menunggu pengamatan perangkat.':'Impor data pelanggan; redaman hanya dari pengamatan OLT.']);
            $user=auth()->user();AuditLog::create(['user_id'=>$user?->id,'user_name'=>$user?->name??'System','user_role'=>$user?->role??'System','action'=>$updating?'UPDATE':'IMPORT','module'=>'Customer Intake','description'=>$updating?'Melengkapi data pelanggan kosong yang divalidasi.':'Mendaftarkan pelanggan melalui pratinjau tervalidasi.','new_values'=>['customer_id'=>$customer->id,'service_id'=>$s->id,'source'=>empty($data['device_id'])?'sobok':'olt'],'ip_address'=>request()->ip()]);
            return ['customer'=>$customer,'updated'=>$updating];
        },3);
        OnuTelemetryWriter::invalidate();return $result;
    }
}
