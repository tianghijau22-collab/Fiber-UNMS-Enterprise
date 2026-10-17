<?php
namespace App\Services\Olt;

use App\Models\OltDevice;

/**
 * Single-host, process-owned read lease. Cache eviction cannot remove a live lease.
 * Nested synchronous calls reuse the same target lease; unrelated processes never do.
 */
final class OltReadLease
{
    private static array $held=[];
    private bool $released=false;
    private function __construct(private string $key,private int $pid) {}

    public static function acquire(string $ip,int $port=161): self
    {
        if(!filter_var($ip,FILTER_VALIDATE_IP) || $port<1 || $port>65535)throw new OltReadBusy('read_coordination_unavailable');
        $key=hash('sha256',inet_pton($ip).':'.$port);$pid=getmypid();
        if(isset(self::$held[$key]) && self::$held[$key]['pid']===$pid) {
            self::$held[$key]['depth']++;return new self($key,$pid);
        }
        $dir=storage_path('framework/olt-read-locks');$path=$dir.'/'.$key.'.lock';
        if(is_link($dir) || (!is_dir($dir) && !@mkdir($dir,02770,true) && !is_dir($dir)) || is_link($path))
            throw new OltReadBusy('read_coordination_unavailable');
        $handle=@fopen($path,'c+b');
        if($handle===false)throw new OltReadBusy('read_coordination_unavailable');
        if(!@flock($handle,LOCK_EX|LOCK_NB,$wouldBlock)) {
            fclose($handle);throw new OltReadBusy($wouldBlock ? 'olt_busy':'read_coordination_unavailable');
        }
        // The web, poller and listener use different Unix accounts in production.
        // Deployment provisions a setgid directory and a shared application group.
        @chmod($path,0660);
        self::$held[$key]=['handle'=>$handle,'pid'=>$pid,'depth'=>1];
        return new self($key,$pid);
    }

    public static function forDevice(OltDevice $device,callable $read): mixed
    {
        return self::forTarget((string)$device->ip_address,(int)($device->snmp_port ?: 161),$read);
    }

    public static function forTarget(string $ip,int $port,callable $read): mixed
    {
        $lease=self::acquire($ip,$port);
        try { return $read(); } finally { $lease->release(); }
    }

    public function release(): void
    {
        if($this->released)return;$this->released=true;
        if(getmypid()!==$this->pid || !isset(self::$held[$this->key]) || self::$held[$this->key]['pid']!==$this->pid)return;
        if(--self::$held[$this->key]['depth']>0)return;
        $handle=self::$held[$this->key]['handle'];unset(self::$held[$this->key]);
        @flock($handle,LOCK_UN);fclose($handle);
        // Persistent lock files must never be unlinked while another process may hold their inode.
    }

    public function __destruct() { $this->release(); }
}
