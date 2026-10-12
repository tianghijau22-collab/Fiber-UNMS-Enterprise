<?php

use Laravel\Sanctum\Sanctum;

return [
    'stateful' => array_values(array_unique(array_filter(array_merge(
        explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', '')),
        [ltrim(Sanctum::currentRequestHost(), ',')],
    )))),
    'guard' => ['web'],
    'expiration' => 10080,
    'token_prefix' => 'fona_',
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
