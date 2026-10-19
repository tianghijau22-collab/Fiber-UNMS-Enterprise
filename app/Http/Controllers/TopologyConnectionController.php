<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\NetworkCable;
use App\Models\NetworkNode;
use App\Services\TopologyConnectionGeometry;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TopologyConnectionController extends Controller
{
    public function __construct(private TopologyConnectionGeometry $geometry) {}

    private function checkWrite(Request $request): void
    {
        abort_unless($request->user(),401);
        abort_unless(in_array($request->user()->role,['Super Administrator','Operator Jaringan'],true),403,'Peran ini hanya dapat melihat hubungan.');
    }

    public function prepare(Request $request)
    {
        $v=$request->validate(['candidate_id'=>'required|string|max:160','tolerance'=>'required|integer|min:1|max:100',
            'a_lat'=>'required|numeric|between:-90,90','a_lng'=>'required|numeric|between:-180,180','b_lat'=>'required|numeric|between:-90,90','b_lng'=>'required|numeric|between:-180,180']);
        $data=$this->geometry->prepare($v['candidate_id'],(int)$v['tolerance']);
        foreach (['a','b'] as $side) abort_if($this->geometry->meters($data[$side]['point'],['lat'=>(float)$v[$side.'_lat'],'lng'=>(float)$v[$side.'_lng']])>0.05,409,'Koordinat pratinjau telah berubah. Muat ulang data sebelum memvalidasi.');
        $data['olts']=DB::table('olt_devices')->select('id','name','status')->orderBy('name')->get();
        return response()->json(['data'=>$data]);
    }

    public function index(Request $request)
    {
        $v=$request->validate(['state'=>'nullable|in:verified,revoked,all','page'=>'nullable|integer|min:1']);
        $query=DB::table('topology_connections');
        if (($v['state']??'verified')!=='all') $query->where('state',$v['state']??'verified');
        $page=$query->orderByDesc('id')->paginate(20);
        $definitions=$page->getCollection()->map(fn($r)=>json_decode($r->definition,true,512,JSON_THROW_ON_ERROR));
        $tokens=['cables'=>[], 'nodes'=>[]];
        foreach ($definitions as $d) foreach (['cables','nodes'] as $type) $tokens[$type]=array_unique(array_merge($tokens[$type],array_keys($d['source_tokens'][$type]??[])));
        $versions=['cables'=>NetworkCable::whereIn('id',$tokens['cables'])->get()->mapWithKeys(fn($m)=>[$m->id=>$this->geometry->version($m->getAttributes())])->all(),
            'nodes'=>NetworkNode::whereIn('id',$tokens['nodes'])->get()->mapWithKeys(fn($m)=>[$m->id=>$this->geometry->version($m->getAttributes())])->all()];
        $page->setCollection($page->getCollection()->map(function($row)use($versions){
            $row->definition=json_decode($row->definition,true,512,JSON_THROW_ON_ERROR);$current=true;
            foreach ($row->definition['source_tokens'] as $type=>$items) foreach ($items as $id=>$hash) if (($versions[$type][$id]??null)!==$hash) $current=false;
            $row->source_current=$current;$row->created_at=\Illuminate\Support\Carbon::parse($row->created_at,config('app.timezone'))->toIso8601String();unset($row->active_key,$row->source_version);return $row;
        }));
        return response()->json($page);
    }

    public function history(int $connection)
    {
        abort_unless(DB::table('topology_connections')->where('id',$connection)->exists(),404);
        $rows=DB::table('topology_connection_events')->where('connection_id',$connection)->orderBy('id')->get();
        foreach ($rows as $row) {$row->definition=json_decode($row->definition,true,512,JSON_THROW_ON_ERROR);$row->created_at=\Illuminate\Support\Carbon::parse($row->created_at,config('app.timezone'))->toIso8601String();}
        return response()->json(['data'=>$rows]);
    }

    private function pon(string $value): string
    {
        $value=preg_replace('/^gpon-(?:olt|onu)_/i','',trim($value));
        if (!preg_match('/^\d{1,3}\/\d{1,3}\/\d{1,3}$/',$value)) throw ValidationException::withMessages(['pon'=>'Masukkan satu port PON, misalnya 1/3/1.']);
        return implode('/',array_map('intval',explode('/',$value)));
    }

    public function store(Request $request)
    {
        $this->checkWrite($request);
        if (is_string($request->input('note'))) $request->merge(['note'=>trim($request->input('note'))]);
        $v=$request->validate(['candidate_id'=>'required|string|max:160','tolerance'=>'required|integer|min:1|max:100',
            'source_version'=>'required|string|size:64','junction_node_id'=>'required|integer|min:1','junction_version'=>'required|string|size:64',
            'direction'=>'required|in:a_to_b,b_to_a','connection_type'=>'required|in:splice,splitter,termination',
            'olt_device_id'=>'required|integer|exists:olt_devices,id','pon'=>'required|string|max:50',
            'core_a'=>'nullable|integer|min:1','core_b'=>'nullable|integer|min:1','note'=>'required|string|min:5|max:2000','confirmed'=>'required|accepted']);
        $v['pon']=$this->pon($v['pon']);
        try {
            $id=DB::transaction(function()use($request,$v){
                $p=$this->geometry->prepare($v['candidate_id'],(int)$v['tolerance'],true);
                abort_unless(hash_equals($p['source_version'],$v['source_version']),409,'Data sumber berubah sejak formulir dibuka. Batalkan formulir lalu validasi ulang.');
                abort_unless(in_array((int)$v['junction_node_id'],array_column($p['junction_nodes'],'id'),true),422,'Pilih node sambung yang tersedia di sekitar kedua titik. Buat node fisiknya dahulu bila belum ada.');
                $node=$this->geometry->node((int)$v['junction_node_id'],true);
                abort_unless(hash_equals($this->geometry->version($node->getAttributes()),$v['junction_version']),409,'Node sambung telah berubah. Buka ulang formulir.');
                if ($node->olt_device_id && (int)$node->olt_device_id!==(int)$v['olt_device_id']) throw ValidationException::withMessages(['olt_device_id'=>'OLT berbeda dari referensi tersimpan node sambung. Periksa data node terlebih dahulu.']);
                $refs=[];
                foreach (explode(',',(string)$node->olt_port_ref) as $ref) {
                    try { if(trim($ref)!=='') $refs[]=$this->pon($ref); } catch (ValidationException) { /* Unusable legacy references cannot assert a PON. */ }
                }
                if ($refs && !in_array($v['pon'],$refs,true)) throw ValidationException::withMessages(['pon'=>'PON berbeda dari referensi tersimpan node sambung. Periksa data node terlebih dahulu.']);
                if (!$p['node_id'] && $v['connection_type']==='termination') throw ValidationException::withMessages(['connection_type'=>'Hubungan antarkabel harus berupa sambungan atau percabangan splitter.']);
                $complete=true;
                foreach (['a','b'] as $side) {
                    $core=$v['core_'.$side]??null;
                    if ($p[$side]['kind']==='node' && $core!==null) throw ValidationException::withMessages(['core_'.$side=>'Sisi node tidak memiliki nomor core kabel.']);
                    if ($p[$side]['kind']==='cable') {
                        $cable=collect($p['cables'])->firstWhere('id',$p[$side]['cable_id']);
                        if ($core!==null && (int)$core>$cable['core_count_total']) throw ValidationException::withMessages(['core_'.$side=>'Nomor core melebihi kapasitas kabel.']);
                        if ($core===null) $complete=false;
                        $p[$side]['core']=$core===null?null:(int)$core;
                    }
                }
                $p['source_tokens']['nodes'][$node->id]=$this->geometry->version($node->getAttributes());
                $definition=['candidate_id'=>$p['candidate_id'],'kind'=>$p['kind'],'title'=>$p['title'],'a'=>$p['a'],'b'=>$p['b'],
                    'junction'=>array_intersect_key($this->geometry->nodeOption($node),array_flip(['id','name','code','node_type','point'])),
                    'direction'=>$v['direction'],'connection_type'=>$v['connection_type'],'olt_device_id'=>(int)$v['olt_device_id'],
                    'olt_name'=>DB::table('olt_devices')->where('id',$v['olt_device_id'])->value('name'),'pon'=>$v['pon'],'note'=>trim($v['note']),
                    'core_details_complete'=>$complete,'fault_detection_enabled'=>false,'tolerance_meters'=>$p['tolerance_meters'],
                    'distance_meters'=>$p['distance_meters'],'source_tokens'=>$p['source_tokens']];
                $key=$this->geometry->version([$p['candidate_id'],$node->id,(int)$v['olt_device_id'],$v['pon'],$p['a']['core']??null,$p['b']['core']??null]);
                abort_if(DB::table('topology_connections')->where('active_key',$key)->exists(),409,'Hubungan dengan core dan PON ini sudah tersimpan. Periksa daftar; batalkan hubungan lama jika perlu koreksi.');
                $now=now();$user=$request->user();
                $id=DB::table('topology_connections')->insertGetId(['active_key'=>$key,'candidate_id'=>$p['candidate_id'],'state'=>'verified','revision'=>1,
                    'definition'=>json_encode($definition,JSON_THROW_ON_ERROR),'source_version'=>$p['source_version'],'created_by'=>$user->id,'created_by_name'=>$user->name,'created_at'=>$now,'updated_at'=>$now]);
                $this->event($request,$id,'verified',1,trim($v['note']),$definition);
                return $id;
            },3);
        } catch(QueryException $e) {
            if ($e->getCode()==='23505' || ($e->getCode()==='23000' && str_contains($e->getMessage(),'UNIQUE constraint'))) abort(409,'Hubungan ini telah disimpan oleh proses lain. Segarkan daftar.');
            throw $e;
        }
        return response()->json(['status'=>'success','id'=>$id,'message'=>'Hubungan tervalidasi tersimpan. Belum digunakan oleh deteksi gangguan.'],201);
    }

    private function event(Request $request,int $id,string $action,int $revision,string $reason,array $definition): void
    {
        $user=$request->user();
        DB::table('topology_connection_events')->insert(['connection_id'=>$id,'action'=>$action,'revision'=>$revision,'actor_id'=>$user->id,'actor_name'=>$user->name,
            'reason'=>$reason,'definition'=>json_encode($definition,JSON_THROW_ON_ERROR),'created_at'=>now()]);
        // Local transactional audit only; no external notification side effect.
        AuditLog::create(['user_id'=>$user->id,'user_name'=>$user->name,'user_role'=>$user->role,'action'=>strtoupper($action),'module'=>'Topologi Tervalidasi',
            'description'=>"Hubungan #{$id}: {$reason}",'ip_address'=>$request->ip(),'user_agent'=>$request->userAgent(),'new_values'=>['connection_id'=>$id,'revision'=>$revision,'state'=>$action]]);
    }

    public function revoke(Request $request,int $connection)
    {
        $this->checkWrite($request);
        if (is_string($request->input('reason'))) $request->merge(['reason'=>trim($request->input('reason'))]);
        $v=$request->validate(['expected_revision'=>'required|integer|min:1','reason'=>'required|string|min:5|max:2000']);
        DB::transaction(function()use($request,$connection,$v){
            $row=DB::table('topology_connections')->where('id',$connection)->lockForUpdate()->first();abort_unless($row,404);
            abort_unless($row->state==='verified' && $row->revision===(int)$v['expected_revision'],409,'Hubungan sudah berubah/dibatalkan. Segarkan daftar.');
            DB::table('topology_connections')->where('id',$connection)->update(['active_key'=>null,'state'=>'revoked','revision'=>$row->revision+1,'revoked_at'=>now(),'updated_at'=>now()]);
            $this->event($request,$connection,'revoked',$row->revision+1,trim($v['reason']),json_decode($row->definition,true,512,JSON_THROW_ON_ERROR));
        },3);
        return response()->json(['status'=>'success','message'=>'Hubungan dibatalkan; riwayat tetap tersedia.']);
    }
}
