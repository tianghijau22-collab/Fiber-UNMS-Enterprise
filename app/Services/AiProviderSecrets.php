<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;

class AiProviderSecrets
{
    public const PREFIX = 'fona-ai:v1:';
    public const KEYS = ['gemini_api_key', 'groq_api_key', 'custom_ai_api_key'];

    public static function read(string $name): ?string
    {
        $value = SystemSetting::get($name);
        if (!is_string($value) || trim($value) === '') return null;
        if (!str_starts_with($value, self::PREFIX)) return trim($value); // Existing settings remain readable during rollout.
        try { return Crypt::decryptString(substr($value, strlen(self::PREFIX))); }
        catch (\Throwable) { return null; }
    }

    public static function encode(string $value): string
    {
        return self::PREFIX.Crypt::encryptString(trim($value));
    }

    public static function write(string $name, string $value): void
    {
        if (!in_array($name, self::KEYS, true)) throw new \InvalidArgumentException('Unknown AI credential.');
        SystemSetting::set($name, trim($value) === '' ? '' : self::encode($value));
    }
}
