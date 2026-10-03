<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\OltDevice;
use App\Services\Olt\ZteC300Driver;

$olt = OltDevice::first();
echo "OLT: {$olt->name} ({$olt->ip_address})" . PHP_EOL;

$driver = new ZteC300Driver($olt);
$portName = '1/6/16';

echo "=== QUERYING ZTE C300 LIVE ONUs on {$portName} ===" . PHP_EOL;
$onus = $driver->getOnuList($portName);
echo "Total ONUs found by driver on {$portName}: " . count($onus) . PHP_EOL;
foreach ($onus as $o) {
    echo "ONU ID: {$o['onu_id']}, SN: {$o['serial_number']}, Status: {$o['status']}, Rx: {$o['rx_power']}" . PHP_EOL;
}
