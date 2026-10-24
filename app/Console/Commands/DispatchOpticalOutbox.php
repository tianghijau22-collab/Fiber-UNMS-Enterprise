<?php

namespace App\Console\Commands;

use App\Services\OpticalOutbox;
use Illuminate\Console\Command;

class DispatchOpticalOutbox extends Command
{
    protected $signature = 'fona:dispatch-optical-outbox {--limit=100}';

    protected $description = 'Recover due permanent optical deliveries without reading devices';

    public function handle(): int
    {
        $this->line(json_encode(['queued' => app(OpticalOutbox::class)->dispatchDue((int) $this->option('limit'))]));

        return self::SUCCESS;
    }
}
