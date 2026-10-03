<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\OltDevice;
use App\Services\Olt\FastOpticalProbeService;

$olt = OltDevice::first();
echo "OLT: {$olt->name} ({$olt->ip_address})" . PHP_EOL;

$res = FastOpticalProbeService::probePortOnusQuickState($olt, '1/6/16');
echo "=== PROBE PORT 1/6/16 RESULT ===" . PHP_EOL;
echo json_encode($res, JSON_PRETTY_PRINT) . PHP_EOL;
