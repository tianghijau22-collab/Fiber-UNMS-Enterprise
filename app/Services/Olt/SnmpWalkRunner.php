<?php

namespace App\Services\Olt;

use App\Models\OltDevice;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessTimedOutException;

/** Bounded subprocesses; returned reports never include command arguments or raw stderr. */
class SnmpWalkRunner
{
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
