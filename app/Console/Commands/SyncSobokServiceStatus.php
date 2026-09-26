<?php

namespace App\Console\Commands;

use App\Services\SobokScraperService;
use Illuminate\Console\Command;

class SyncSobokServiceStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sobok:sync-status {--username=jasen} {--password=jasen2401}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sinkronisasi status layanan pelanggan (OPEN vs BLOKIR) dari sistem Sobok';

    /**
     * Execute the console command.
     */
    public function handle(SobokScraperService $service): int
    {
        $this->info('Memulai sinkronisasi status layanan dari Sobok...');

        $username = $this->option('username') ?: 'jasen';
        $password = $this->option('password') ?: 'jasen2401';

        try {
            $startTime = microtime(true);
            $result = $service->syncServiceStatuses($username, $password);
            $duration = round(microtime(true) - $startTime, 2);

            $this->info("Sinkronisasi Selesai dalam {$duration} detik!");
            $this->table(
                ['Parameter', 'Nilai'],
                [
                    ['Domain Digunakan', $result['domain_used']],
                    ['Total Data Sobok', $result['total_sobok']],
                    ['Total Pelanggan UNMS', $result['total_unms']],
                    ['Berhasil Dicocokkan', $result['matched']],
                    ['Layanan OPEN (Aktif)', $result['open_count']],
                    ['Layanan BLOKIR (Isolir)', $result['blocked_count']],
                    ['Tidak Terhubung / Belum Terdata', $result['unmatched']],
                    ['Waktu Sinkron', $result['synced_at']],
                ]
            );

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("Gagal melakukan sinkronisasi Sobok: " . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
