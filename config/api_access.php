<?php

$networkReads = ['/network', '/gis-map', '/gis-map/fullscreen', '/core-matrix', '/cable-management', '/cable-routes', '/otdr-tracing', '/field-tech', '/odp-checks', '/bts-management', '/customers', '/tickets', '/olt-management'];
$operators = ['Super Administrator', 'Operator Jaringan'];
$admin = ['Super Administrator'];
$master = fn (array $pages, ?array $writePages = null) => ['pages' => $pages, 'write_pages' => $writePages ?? $pages, 'write_roles' => $operators];
$networkWrites = ['/network', '/gis-map', '/gis-map/fullscreen', '/core-matrix', '/cable-management', '/cable-routes'];

return [
    'controllers' => [
        'DashboardController' => ['pages' => ['/dashboard']],
        'CustomerController' => $master(['/customers']),
        'SobokImportController' => ['pages' => ['/customers'], 'roles' => $operators],
        'NetworkNodeController' => $master($networkReads, $networkWrites),
        'NetworkPortController' => $master($networkReads, $networkWrites),
        'NetworkSplitterController' => $master($networkReads, $networkWrites),
        'NetworkCableController' => $master($networkReads, $networkWrites),
        'NetworkCableCoreController' => $master($networkReads, $networkWrites),
        'OntRegistrationController' => $master(['/customers', '/olt-management', '/network']),
        'OltDeviceController' => $master(['/olt-management', '/network', '/customers', '/gis-map', '/field-tech', '/odp-checks', '/bts-management'], ['/olt-management']),
        'OltController' => $master(['/olt-management', '/network', '/field-tech', '/odp-checks', '/bts-management'], ['/olt-management']),
        'BtsSiteController' => $master(['/bts-management']),
        'TicketController' => ['pages' => ['/tickets', '/field-tech']],
        'OdpMeasurementController' => ['pages' => ['/odp-checks', '/field-tech']],
        'InventoryController' => ['pages' => ['/inventory']],
        'FaultTracingController' => ['pages' => ['/otdr-tracing', '/field-tech']],
        'LiveMonitorController' => ['roles' => $operators],
        'ServerMonitoringController' => ['pages' => ['/server-monitoring'], 'write_roles' => $operators],
        'TelemetryEventStreamController' => ['authenticated' => true, 'write_roles' => $operators],
        'VpsBridgeController' => ['roles' => $admin],
        'UserController' => ['roles' => $admin],
        'AuditLogController' => ['pages' => ['/audit-logs'], 'write_roles' => $admin],
        'DatabaseBackupController' => ['roles' => $admin],
        'AppTestingController' => ['roles' => $admin],
        'MobileSliderBannerController' => ['roles' => $admin],
        'PopupAlertController' => ['roles' => $admin],
        'KmlImportController' => ['pages' => ['/network', '/gis-map'], 'roles' => $operators],
        'AuthController' => ['authenticated' => true],
        'CallController' => ['authenticated' => true],
        'NotificationController' => ['roles' => $operators],
    ],
    'actions' => [
        'UserController@getRoutePermissions' => ['authenticated' => true],
        'AppTestingController@getDashboardBanner' => ['authenticated' => true],
        'MobileSliderBannerController@getActiveBanners' => ['authenticated' => true],
        'PopupAlertController@getActiveAlerts' => ['authenticated' => true],
        'BtsSiteController@readLivePower' => ['pages' => ['/bts-management']],
        'NotificationController@index' => ['authenticated' => true],
        'NotificationController@markAsRead' => ['authenticated' => true],
        'NotificationController@markAllAsRead' => ['authenticated' => true],
        'NotificationController@pushSubscribe' => ['authenticated' => true],
        'NotificationController@testPush' => ['authenticated' => true],
        'NotificationController@destroy' => ['authenticated' => true],
        'NotificationController@clearAll' => ['roles' => $admin],
        'NotificationController@getAlertFeed' => ['authenticated' => true],
        'NotificationController@broadcastMass' => ['pages' => ['/broadcast-notifications'], 'roles' => $operators],
        'NotificationController@getTelegramConfig' => ['roles' => $admin],
        'NotificationController@saveTelegramConfig' => ['roles' => $admin],
        'NotificationController@testTelegramConnection' => ['roles' => $admin],
    ],
    'uris' => [
        'api/service-packages' => ['authenticated' => true],
    ],
];
