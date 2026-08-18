<?php

return [

    /*
    |--------------------------------------------------------------------------
    | OLT Telemetry Sync Interval (Minutes)
    |--------------------------------------------------------------------------
    |
    | Menentukan jeda waktu sync otomatis telemetri dari OLT ke database.
    | Pengaturan ini menggunakan interval aman (4 - 7 menit) untuk mencegah
    | beban berlebih pada OLT produksi skala besar.
    |
    */

    'sync_interval_minutes' => (int) env('OLT_SYNC_INTERVAL_MINUTES', 5),

    'snmp' => [
        'timeout' => (int) env('OLT_SNMP_TIMEOUT', 5),
        'retries' => (int) env('OLT_SNMP_RETRIES', 1),
    ],

];
