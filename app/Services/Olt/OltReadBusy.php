<?php
namespace App\Services\Olt;

/** Local read contention is neither a hardware outage nor a successful measurement. */
class OltReadBusy extends \RuntimeException
{
    public function __construct(public readonly string $reason='olt_busy')
    {
        parent::__construct($reason==='olt_busy'
            ? 'OLT sedang dibaca oleh proses lain. Coba lagi setelah pembacaan selesai.'
            : 'Pengaturan antrean pembacaan OLT belum tersedia. Coba lagi beberapa saat.');
    }

    public function render($request)
    {
        return response()->json(['status'=>'busy','reason'=>$this->reason,'message'=>$this->getMessage()],
            $this->reason==='olt_busy' ? 423:503,['Retry-After'=>'2']);
    }

    public function report(): bool { return false; }
}
