<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\NetworkNodeController;
use App\Http\Controllers\NetworkPortController;
use App\Http\Controllers\NetworkSplitterController;
use App\Http\Controllers\NetworkCableController;
use App\Http\Controllers\NetworkCableCoreController;
use App\Http\Controllers\OntRegistrationController;

use App\Http\Controllers\OltController;
use App\Http\Controllers\OltDeviceController;
use App\Http\Controllers\FaultTracingController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\BtsSiteController;
use App\Http\Controllers\VpsBridgeController;
use App\Http\Controllers\LiveMonitorController;

/*
|--------------------------------------------------------------------------
| API Routes - Fiber-UNMS Enterprise
|--------------------------------------------------------------------------
*/

// Notification Center & Web Push
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
Route::post('/notifications/push-subscribe', [NotificationController::class, 'pushSubscribe']);
Route::post('/notifications/test-push', [NotificationController::class, 'testPush']);
Route::post('/notifications/broadcast', [NotificationController::class, 'broadcastMass']);
Route::delete('/notifications/clear-all', [NotificationController::class, 'clearAll']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
Route::get('/notifications/telegram-config', [NotificationController::class, 'getTelegramConfig']);
Route::post('/notifications/telegram-config', [NotificationController::class, 'saveTelegramConfig']);
Route::post('/notifications/telegram-test', [NotificationController::class, 'testTelegramConnection']);

// Multi-Channel Telegram Groups Management
Route::get('/notifications/channels', [NotificationController::class, 'getChannels']);
Route::post('/notifications/channels', [NotificationController::class, 'storeChannel']);
Route::put('/notifications/channels/{id}', [NotificationController::class, 'updateChannel']);
Route::delete('/notifications/channels/{id}', [NotificationController::class, 'deleteChannel']);
Route::post('/notifications/channels/{id}/test', [NotificationController::class, 'testChannel']);

// Dashboard Overview Metrics
Route::get('/dashboard/metrics', [DashboardController::class, 'index']);

// Multi-Device OLT Registry & Drivers
Route::get('/olts', [OltDeviceController::class, 'index']);
Route::get('/olt-devices', [OltDeviceController::class, 'index']);
Route::post('/olts', [OltDeviceController::class, 'store']);
Route::get('/olts/{id}', [OltDeviceController::class, 'show']);
Route::put('/olts/{id}', [OltDeviceController::class, 'update']);
Route::post('/olts/{id}/test-connection', [OltDeviceController::class, 'testConnection']);
Route::post('/olts/{id}/disconnect', [OltDeviceController::class, 'disconnect']);
Route::put('/olts/{id}/connection-config', [OltDeviceController::class, 'saveConnectionConfig']);
Route::post('/olts/{id}/snmp-diagnostic', [OltDeviceController::class, 'snmpDiagnostic']);
Route::delete('/olts/{id}', [OltDeviceController::class, 'destroy']);

Route::get('/olt/hardware', [OltController::class, 'index']);
Route::get('/olt/port-onus', [OltController::class, 'getPortOnus']);
Route::post('/olt/sync-port', [OltController::class, 'syncPort']);
Route::post('/olt/authorize-onu', [OltController::class, 'authorizeOnu']);
Route::get('/olt/optical-power/{serialNumber}', [OltController::class, 'opticalPower']);
Route::get('/olt/orphaned-onus', [OltController::class, 'getOrphanedOnus']);
Route::delete('/olt/orphaned-onus/{id}', [OltController::class, 'deleteOrphanedOnu']);
Route::post('/olt/orphaned-onus/bulk-delete', [OltController::class, 'bulkDeleteOrphanedOnus']);
Route::post('/olt/sync-external', [OltController::class, 'syncExternal']);
Route::post('/olt/import-1628-onus', [OltController::class, 'import1628Onus']);

// VPS & MikroTik/OLT Bridge Setup Wizard
Route::get('/vps-bridge/detect-environment', [VpsBridgeController::class, 'detectEnvironment']);
Route::post('/vps-bridge/generate-script', [VpsBridgeController::class, 'generateScript']);
Route::post('/vps-bridge/test-connection', [VpsBridgeController::class, 'testBridgeConnection']);

// Live Polling & Telemetry Monitoring (SNMP & MikroTik RouterOS API)
Route::get('/monitoring/router/live-metrics', [LiveMonitorController::class, 'getRouterMetrics']);
Route::get('/monitoring/olt/{id}/live-telemetry', [LiveMonitorController::class, 'getOltTelemetry']);
Route::post('/monitoring/ping-sweep', [LiveMonitorController::class, 'pingSweep']);

// OTDR Fault Tracing Engine
Route::get('/fault-tracing/cables', [FaultTracingController::class, 'cables']);
Route::get('/fault-tracing/nodes',  [FaultTracingController::class, 'nodes']);
Route::post('/fault-tracing/trace', [FaultTracingController::class, 'trace']);
Route::post('/fault-tracing/dispatch-telegram', [FaultTracingController::class, 'dispatchTelegram']);
Route::get('/fault-tracing/optical-diagnostics', [FaultTracingController::class, 'opticalDiagnostics']);

// Network Infrastructure Resources — Topologi Hierarki Fiber FTTH & Core Matrix
Route::get('network-nodes/stats',                        [NetworkNodeController::class, 'stats']);
Route::get('network-nodes/hierarchy',                    [NetworkNodeController::class, 'hierarchy']);
Route::get('network-nodes/splitter-types',               [NetworkNodeController::class, 'splitterTypes']);
Route::get('network-nodes/odc-list',                     [NetworkNodeController::class, 'odcList']);
Route::get('network-nodes/olt-topology',                 [NetworkNodeController::class, 'oltTopology']);
Route::get('network-nodes/{networkNode}/children',       [NetworkNodeController::class, 'childrenOf']);
Route::get('network-nodes/{networkNode}/port-detail',    [NetworkNodeController::class, 'portDetail']);
Route::get('network-nodes/{networkNode}/odc-ports',      [NetworkNodeController::class, 'odcPortDetail']);
Route::get('network-nodes/{networkNode}/pop-cables',     [NetworkCableController::class, 'popCables']);
Route::put('network-cable-cores/{networkCableCore}',     [NetworkCableController::class, 'updateCore']);
Route::put('network-cables/{networkCable}/route',            [NetworkCableController::class, 'updateRoute']);
Route::apiResource('network-nodes', NetworkNodeController::class);
Route::apiResource('network-ports', NetworkPortController::class);
Route::apiResource('network-splitters', NetworkSplitterController::class);
Route::apiResource('network-cables', NetworkCableController::class);
Route::apiResource('network-cable-cores', NetworkCableCoreController::class);
Route::apiResource('ont-registrations', OntRegistrationController::class);

// BTS Optical Management Routes
Route::get('bts-sites-stats', [BtsSiteController::class, 'stats']);
Route::post('bts-sites/{id}/read-live-power', [BtsSiteController::class, 'readLivePower']);
Route::apiResource('bts-sites', BtsSiteController::class);

// Operational & Management Modules
Route::get('service-packages', function () {
    return response()->json(['status' => 'success', 'data' => \App\Models\ServicePackage::where('is_active', true)->get()]);
});
Route::get('customers/unmapped-onus', [CustomerController::class, 'unmappedOnus']);
Route::post('customers/batch-provision', [CustomerController::class, 'batchProvision']);
Route::post('customers/{id}/swap-onu', [CustomerController::class, 'swapOnu']);
Route::apiResource('customers', CustomerController::class);
Route::get('tickets/reference-data', [TicketController::class, 'referenceData']);
Route::post('tickets/{id}/dispatch-telegram', [TicketController::class, 'dispatchTelegram']);
Route::post('tickets/{id}/add-progress', [TicketController::class, 'addProgress']);
Route::get('public/tickets/{ticketNumber}', [TicketController::class, 'publicTrack']);
Route::apiResource('tickets', TicketController::class);
Route::get('inventory', [InventoryController::class, 'index']);
Route::get('billing/invoices', [BillingController::class, 'index']);
Route::apiResource('users', UserController::class);
Route::get('audit-logs', [AuditLogController::class, 'index']);

// Authentication Routes
Route::post('auth/login', [AuthController::class, 'login']);
Route::post('auth/logout', [AuthController::class, 'logout']);
Route::get('auth/me', [AuthController::class, 'me']);
Route::put('auth/profile', [AuthController::class, 'updateProfile']);

// Real-Time WebRTC Voice Calling Routes
Route::get('calls/directory', [\App\Http\Controllers\CallController::class, 'directory']);
Route::get('calls/check-incoming', [\App\Http\Controllers\CallController::class, 'checkIncoming']);
Route::post('calls/initiate', [\App\Http\Controllers\CallController::class, 'initiate']);
Route::post('calls/{id}/answer', [\App\Http\Controllers\CallController::class, 'answer']);
Route::post('calls/{id}/ice-candidate', [\App\Http\Controllers\CallController::class, 'sendIceCandidate']);
Route::get('calls/{id}/poll', [\App\Http\Controllers\CallController::class, 'poll']);
Route::post('calls/{id}/end', [\App\Http\Controllers\CallController::class, 'endCall']);
Route::get('calls/history', [\App\Http\Controllers\CallController::class, 'history']);

// Database Backup & Restore Engine
Route::get('database/backups', [\App\Http\Controllers\DatabaseBackupController::class, 'index']);
Route::post('database/backups', [\App\Http\Controllers\DatabaseBackupController::class, 'store']);
Route::post('database/backups/upload', [\App\Http\Controllers\DatabaseBackupController::class, 'upload']);
Route::get('database/backups/{filename}/download', [\App\Http\Controllers\DatabaseBackupController::class, 'download']);
Route::post('database/backups/{filename}/restore', [\App\Http\Controllers\DatabaseBackupController::class, 'restore']);
Route::delete('database/backups/{filename}', [\App\Http\Controllers\DatabaseBackupController::class, 'destroy']);
Route::post('database/clear-operational-data', [\App\Http\Controllers\DatabaseBackupController::class, 'clearOperationalData']);

// Pengecekan Redaman ODP & OPM Lapangan
Route::get('odp-checks/stats', [\App\Http\Controllers\OdpMeasurementController::class, 'stats']);
Route::get('odp-checks/odp-options', [\App\Http\Controllers\OdpMeasurementController::class, 'odpOptions']);
Route::post('odp-checks/{id}/forward-telegram', [\App\Http\Controllers\OdpMeasurementController::class, 'forwardTelegram']);
Route::apiResource('odp-checks', \App\Http\Controllers\OdpMeasurementController::class)->only(['index', 'store', 'destroy']);

