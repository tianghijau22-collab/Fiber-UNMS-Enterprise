<?php

namespace App\Console\Commands;

use App\Services\AiProviderSecrets;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class EncryptAiSecrets extends Command
{
    protected $signature = 'ai:encrypt-secrets {--dry-run : Report eligible settings without changing them}';
    protected $description = 'Encrypt existing AI credentials without changing their values.';

    public function handle(): int
    {
        $count = DB::transaction(function () {
            $count = 0;
            foreach (DB::table('system_settings')->whereIn('key', AiProviderSecrets::KEYS)->lockForUpdate()->get() as $row) {
                if ($row->value === '' || str_starts_with($row->value, AiProviderSecrets::PREFIX)) continue;
                $count++;
                if (!$this->option('dry-run')) DB::table('system_settings')->where('id', $row->id)->update(['value' => AiProviderSecrets::encode($row->value)]);
            }
            return $count;
        });
        $this->line(json_encode(['eligible' => $count, 'changed' => $this->option('dry-run') ? 0 : $count]));
        return self::SUCCESS;
    }
}
