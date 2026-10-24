<?php

namespace App\Jobs;

use App\Services\OpticalFaultLocalizationService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Coalesce trap bursts without blocking the UDP listener or adding device reads. */
class EvaluateStoredOpticalFaults implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 2;
    public int $timeout = 20;
    public int $uniqueFor = 30;
    public function uniqueId(): string { return 'fona-stored-optical-evaluation'; }
    public function handle(): void { OpticalFaultLocalizationService::runDiagnostic(); }
}
