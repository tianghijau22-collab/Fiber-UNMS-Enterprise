<?php

namespace App\Console\Commands;

use App\Services\OpticalFaultLocalizationService;
use Illuminate\Console\Command;

class DiagnoseOpticalNetwork extends Command
{
    protected $signature = 'fona:diagnose-optical {--dry-run : Read stored evidence without changing alarm state or sending notifications}';
    protected $description = 'Evaluate stored optical evidence shared by GIS and automatic alarms';

    public function handle(): int
    {
        $result = $this->option('dry-run') ? OpticalFaultLocalizationService::preview() : OpticalFaultLocalizationService::runDiagnostic();
        $this->line(json_encode(['status'=>$result['evaluation_status'], 'all_na_odps'=>$result['mass_outages_detected'],
            'candidate_segments'=>$result['boundary_breaks_count'], 'notifications'=>$result['notifications_sent'] ?? 0], JSON_UNESCAPED_UNICODE));
        return self::SUCCESS;
    }
}
