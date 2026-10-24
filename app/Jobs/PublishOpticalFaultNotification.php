<?php

namespace App\Jobs;

use App\Services\OpticalOutbox;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class PublishOpticalFaultNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(public array $event) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // Compatibility for queued jobs from the preceding release: persisted outbox rows own sending.
        app(OpticalOutbox::class)->dispatchDue();
    }

    public static function message(array $event): array
    {
        $escape = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $c = $event['context'];
        $recovery = in_array($event['transition'], ['recovery', 'recovered'], true);
        $name = $escape($c['name']);
        $at = $escape($event['sampled_at']);
        if ($c['kind'] === 'source') {
            return [$recovery ? "PEMULIHAN SUMBER TELEMETRI: {$name}" : "SUMBER TELEMETRI TIDAK TERSEDIA: {$name}",
                "<b>Sumber:</b> {$name}\n<b>Observasi:</b> {$at}\n".($recovery ? 'Sumber kembali merespons. Kondisi optik pelanggan diperiksa terpisah.' : 'Pembacaan sumber tidak tersedia. Data tersimpan bukan bukti kabel putus.'),
                $recovery ? 'SOURCE_RECOVERY' : 'SOURCE_UNAVAILABLE'];
        }
        if ($c['kind'] === 'segment') {
            $fault = $c['fault'];

            return [$recovery ? "PEMULIHAN SINYAL SEGMEN: {$name}" : "INDIKASI GANGGUAN SEGMEN: {$name}",
                "<b>Segmen:</b> {$name}\n<b>Observasi:</b> {$at}\n<b>ODP terkait:</b> ".$fault['affected_odps']."\n".
                ($recovery ? 'Seluruh pelanggan terkait kembali memiliki nilai Rx valid. Penyebab dan tindakan perbaikan perlu konfirmasi lapangan.'
                    : 'Sinyal terakhir masih tersedia pada ujung sebelumnya; seluruh pelanggan pada cabang berikutnya N/A. Periksa kabel, sambungan, splitter dan catu daya ONU. Lokasi merupakan perkiraan segmen, bukan titik pasti kabel putus.'),
                $recovery ? 'OPTICAL_SEGMENT_RECOVERY' : 'OPTICAL_SEGMENT_INDICATION'];
        }
        $e = $c['evidence'];
        $lines = [];
        foreach ($event['clients'] as $client) {
            $v = $client['telemetry'];
            $rx = $v['rx_available'] ? number_format((float) $v['rx_power'], 2, '.', '').' dBm' : 'N/A';
            $lines[] = $escape($client['customer_number']).' <b>'.$escape($client['name']).'</b> · SN '.$escape($client['serial']).' · '.$rx;
        }

        return [$recovery ? "PEMULIHAN GANGGUAN MASSAL: {$name}" : "ALARM GANGGUAN MASSAL: {$name} (SELURUH Rx N/A)",
            "<b>ODP:</b> {$name}\n<b>Pelanggan:</b> ".$e['total']."\n<b>Observasi:</b> {$at}\n".
            ($recovery ? 'Seluruh pelanggan kembali memiliki Rx valid.' : 'Seluruh pelanggan memiliki observasi baru tanpa nilai Rx. Penyebab perlu pemeriksaan lapangan.')."\n\n".implode("\n", $lines),
            $recovery ? 'MASS_RECOVERY' : 'MASS_OUTAGE'];
    }
}
