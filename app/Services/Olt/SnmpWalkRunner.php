<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessTimedOutException;

/** Bounded subprocesses; returned reports never include command arguments or raw stderr. */
class SnmpWalkRunner
{
    /** Exact point reads, rolling four-worker queue; a slow job never holds a whole batch. */
    public function getQueued(OltDevice $olt,array $requests,float $budget=20): array
    {
        return OltReadLease::forDevice($olt,fn()=>$this->getQueuedUnlocked($olt,$requests,$budget));
    }

    private function getQueuedUnlocked(OltDevice $olt,array $requests,float $budget=20): array
    {
        return $this->requestQueued($olt,$requests,$budget,false);
    }

    public function walkQueued(OltDevice $olt,array $requests,float $budget=35): array
    {
        return OltReadLease::forDevice($olt,fn()=>$this->walkQueuedUnlocked($olt,$requests,$budget));
    }

    private function walkQueuedUnlocked(OltDevice $olt,array $requests,float $budget=35): array
    {
        return $this->requestQueued($olt,$requests,$budget,true);
    }

    private function requestQueued(OltDevice $olt,array $requests,float $budget,bool $walk): array
    {
        $started=OnuTelemetrySample::timestamp();$start=microtime(true);$budget=max(0.1,min(35,$budget));
        $valid=filter_var($olt->ip_address,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)
            && in_array(strtolower((string)($olt->snmp_version ?: 'v2c')),['v2','v2c'],true) && count($requests)<=512;
        $pending=[];$reports=[];$tables=[];$running=[];$buffers=[];$errors=[];$jobStart=[];$bytes=0;
        foreach($requests as $key=>$oids) {
            $tables[$key]=[];$reports[$key]=['complete'=>false,'reason'=>'unsupported_request','rows'=>0,'answered'=>0,'requested'=>is_array($oids)?count($oids):0,'started'=>false];
            if(!$valid || !is_array($oids) || !$oids || count($oids)>($walk?1:24))continue;
            if(count(array_filter($oids,fn($oid)=>is_string($oid) && preg_match('/^1(?:\.[0-9]+)+$/D',$oid)))!==count($oids))continue;
            $pending[$key]=array_values(array_unique($oids));$reports[$key]['requested']=count($pending[$key]);$reports[$key]['reason']='deadline';
        }
        $finish=function($key,$reason=null)use(&$running,&$buffers,&$errors,&$reports,&$tables,$requests,$walk){
            $p=$running[$key];$exit=$p->getExitCode();$allowed=array_fill_keys($requests[$key],true);$seen=[];$rows=[];$conflict=false;
            foreach(explode("\n",$buffers[$key]) as $line) {
                if(!preg_match('/^\s*\.?([0-9.]+)\s*=\s*(.+)$/',$line,$m) || !isset($allowed[$m[1]]))continue;
                $value=trim($m[2]);if(isset($seen[$m[1]]) && $seen[$m[1]]!==$value)$conflict=true;
                $seen[$m[1]]=$value;
                if(!preg_match('/No Such (?:Object|Instance)|No more variables|End of MIB/i',$value))$rows[$m[1]]=$value;
            }
            if($walk){$parsed=self::parse($buffers[$key],$requests[$key][0]);$rows=$parsed['rows'];$conflict=$parsed['conflict'];}
            $error=$conflict?'conflicting_oid_values':(preg_match('/timeout|No Response/i',$errors[$key])?'snmp_timeout':(preg_match('/error|failure|OID not increasing/i',$errors[$key])?'snmp_error':null));
            $reason=$reason ?? $error ?? ($exit!==0?'nonzero_exit':(!$walk && count($seen)!==count($allowed)?'missing_response':null));
            $tables[$key]=$conflict?[]:$rows;
            $reports[$key]=array_replace($reports[$key],['complete'=>$reason===null,'reason'=>$reason,'exit_code'=>$exit,'rows'=>count($tables[$key]),'answered'=>count($seen)]);
            unset($running[$key],$buffers[$key],$errors[$key]);
        };
        try {
            while($pending || $running) {
                while($pending && count($running)<4 && microtime(true)-$start<$budget && $bytes<8*1024*1024) {
                    $key=array_key_first($pending);$oids=$pending[$key];unset($pending[$key]);$buffers[$key]='';$errors[$key]='';
                    try {
                        $arguments=[$walk?'/usr/bin/snmpbulkwalk':'/usr/bin/snmpget','-v2c','-c',$olt->getEffectiveCommunity(),'-t','2','-r','1','-On'];
                        if($walk)$arguments[]='-Cr10';
                        $p=$this->process(array_merge($arguments,[$olt->ip_address.':'.($olt->snmp_port ?: 161)],$oids));
                        $p->setTimeout(null);
                        $p->start(function($type,$data)use($key,&$buffers,&$errors,&$bytes){
                            if($type===Process::OUT){$bytes+=strlen($data);$buffers[$key].=substr($data,0,max(0,65536-strlen($buffers[$key])));}
                            else $errors[$key]=substr($errors[$key].$data,0,4096);
                        });
                        $running[$key]=$p;$jobStart[$key]=microtime(true);$reports[$key]['started']=true;
                    } catch(\Throwable){$reports[$key]['reason']='process_start_failed';}
                }
                foreach(array_keys($running) as $key) {
                    $p=$running[$key];$reason=null;
                    try {
                        $alive=$p->isRunning();$p->clearOutput();$p->clearErrorOutput();
                        if($bytes>=8*1024*1024 || strlen($buffers[$key])>=65536)$reason='output_limit';
                        elseif(microtime(true)-$start>=$budget)$reason='deadline';
                        elseif(microtime(true)-$jobStart[$key]>=6)$reason='job_deadline';
                        if($reason!==null && $alive){$p->stop(0);$alive=false;}
                    } catch(\Throwable){$reason='process_read_failed';$p->stop(0);$alive=false;}
                    if(!$alive)$finish($key,$reason);
                }
                if(microtime(true)-$start>=$budget || $bytes>=8*1024*1024) {
                    foreach($pending as $key=>$unused)$reports[$key]['reason']=$bytes>=8*1024*1024?'output_limit':'deadline';
                    $pending=[];
                }
                if($pending || $running)usleep(10000);
            }
        } finally {foreach($running as $p)if($p->isRunning())$p->stop(0);}
        return ['tables'=>$tables,'reports'=>$reports,'started_at'=>$started,'finished_at'=>OnuTelemetrySample::timestamp(),
            'duration_ms'=>round((microtime(true)-$start)*1000,1),'parameters'=>['concurrency'=>4,'timeout'=>2,'retries'=>1,'job_budget'=>6,'budget'=>$budget]];
    }
    protected function process(array $arguments): Process
    {
        return new Process($arguments,base_path(),['LC_ALL'=>'C','LANG'=>'C']);
    }

    public static function parse(string $output,string $root): array
    {
        $rows=[];$conflict=false;
        foreach(explode("\n",$output) as $line) {
            if(!preg_match('/^\s*\.?([0-9.]+)\s*=\s*(.+)$/',$line,$m))continue;
            if(!str_starts_with($m[1],$root.'.') || preg_match('/No Such (?:Object|Instance)|No more variables|End of MIB/i',$m[2]))continue;
            if(isset($rows[$m[1]]) && $rows[$m[1]]!==trim($m[2]))$conflict=true;
            $rows[$m[1]]=trim($m[2]);
        }
        return ['rows'=>$conflict ? []:$rows,'conflict'=>$conflict];
    }

    public function walk(OltDevice $olt,array $oids,int $repetitions=10,float $timeout=5,int $retries=2,float $budget=35): array
    {
        return OltReadLease::forDevice($olt,fn()=>$this->walkUnlocked($olt,$oids,$repetitions,$timeout,$retries,$budget));
    }

    private function walkUnlocked(OltDevice $olt,array $oids,int $repetitions=10,float $timeout=5,int $retries=2,float $budget=35): array
    {
        $started=OnuTelemetrySample::timestamp();$start=microtime(true);$budget=max(0.1,min(45,$budget));
        $repetitions=max(1,min(10,$repetitions));$timeout=max(0.2,min(5.0,$timeout));$retries=max(0,min(2,$retries));
        $tables=[];$reports=[];$jobs=[];$buffers=[];$errors=[];$oversize=[];
        $valid=filter_var($olt->ip_address,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4)
            && in_array(strtolower((string)($olt->snmp_version ?: 'v2c')),['v2','v2c'],true) && count($oids)<=4;
        try {
            foreach($oids as $key=>$oid) {
                $tables[$key]=[];$buffers[$key]='';$errors[$key]='';$oversize[$key]=false;
                $reports[$key]=['complete'=>false,'reason'=>'unsupported_request','exit_code'=>null,'rows'=>0];
                if(!$valid || !is_string($oid) || !preg_match('/^1(?:\.[0-9]+)+$/D',$oid))continue;
                try {
                    $p=$this->process(['/usr/bin/snmpbulkwalk','-v2c','-c',$olt->getEffectiveCommunity(),
                        '-t',(string)$timeout,'-r',(string)$retries,'-Cr'.$repetitions,'-On',
                        $olt->ip_address.':'.($olt->snmp_port ?: 161),$oid]);
                    $p->setTimeout($budget);
                    $p->start(function($type,$data)use($key,&$buffers,&$errors,&$oversize){
                        if($type===Process::OUT) {
                            $remaining=4*1024*1024-strlen($buffers[$key]);
                            if(strlen($data)>$remaining)$oversize[$key]=true;
                            $buffers[$key].=substr($data,0,max(0,$remaining));
                        } else $errors[$key]=substr($errors[$key].$data,0,4096);
                    });
                    $jobs[$key]=$p;$reports[$key]['reason']=null;
                } catch(\Throwable) {$reports[$key]['reason']='process_start_failed';}
            }
            $running=$jobs;
            while($running) {
                foreach($running as $key=>$p) {
                    try {
                        $alive=$p->isRunning();$p->clearOutput();$p->clearErrorOutput();
                        if($oversize[$key]){$p->stop(0);$reports[$key]['reason']='output_limit';$alive=false;}
                        elseif(microtime(true)-$start>$budget){$p->stop(0);$reports[$key]['reason']='deadline';$alive=false;}
                        else $p->checkTimeout();
                    } catch(ProcessTimedOutException) {$reports[$key]['reason']='deadline';$alive=false;}
                    catch(\Throwable) {$reports[$key]['reason']='process_read_failed';$p->stop(0);$alive=false;}
                    if(!$alive)unset($running[$key]);
                }
                if($running)usleep(10000);
            }
            foreach($jobs as $key=>$p) {
                $parsed=self::parse($buffers[$key],$oids[$key]);$tables[$key]=$parsed['rows'];$exit=$p->getExitCode();
                $error=$parsed['conflict'] ? 'conflicting_oid_values'
                    : (preg_match('/OID not increasing/i',$errors[$key]) ? 'non_increasing_oid'
                    : (preg_match('/timeout|No Response/i',$errors[$key]) ? 'snmp_timeout'
                    : (preg_match('/error|failure/i',$errors[$key]) ? 'snmp_error':null)));
                $reports[$key]=array_replace($reports[$key],['exit_code'=>$exit,'rows'=>count($tables[$key]),
                    'complete'=>$reports[$key]['reason']===null && $exit===0 && $error===null,
                    'reason'=>$reports[$key]['reason'] ?? $error ?? ($exit!==0 ? 'nonzero_exit':null)]);
            }
        } finally {foreach($jobs as $p)if($p->isRunning())$p->stop(0);}
        return ['tables'=>$tables,'reports'=>$reports,'started_at'=>$started,'finished_at'=>OnuTelemetrySample::timestamp(),
            'duration_ms'=>round((microtime(true)-$start)*1000,1),'parameters'=>['repetitions'=>$repetitions,'timeout'=>$timeout,'retries'=>$retries,'budget'=>$budget]];
    }
}
