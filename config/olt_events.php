<?php

return [
    // Explicit production configuration is required before deploying this guard.
    'bind_address' => env('OLT_ALARM_BIND_ADDRESS', '127.0.0.1'),
    'trusted_relays' => json_decode((string) env('OLT_ALARM_TRUSTED_RELAYS', '{}'), true),
];
