<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\OltDevice;
use App\Services\Olt\FastOpticalProbeService;

$olt = OltDevice::first();
$session = FastOpticalProbeService::getSnmpSession($olt, 3000);
$ifIndex = FastOpticalProbeService::calculateIfIndex('1/6/16');

echo "=== RAW SNMP CHECK ON 1/6/16 (ifIndex: $ifIndex) ===" . PHP_EOL;

echo "1. Serial numbers on port 1/6/16:" . PHP_EOL;
$sns = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.3.$ifIndex");
foreach ($sns as $k => $v) {
    echo "  $k => $v (" . FastOpticalProbeService::parseZteSerialNumber($v) . ")" . PHP_EOL;
}

echo "2. Oper states on port 1/6/16 (1.3.6.1.4.1.3902.1012.3.50.11.2.1.4):" . PHP_EOL;
$states = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.11.2.1.4.$ifIndex");
foreach ($states as $k => $v) {
    echo "  $k => $v" . PHP_EOL;
}

echo "3. Rx powers on port 1/6/16 (1.3.6.1.4.1.3902.1012.3.50.12.1.1.10):" . PHP_EOL;
$rx = @$session->walk("1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.$ifIndex");
foreach ($rx as $k => $v) {
    $raw = (int)trim(str_replace(['INTEGER:', ' '], '', (string)$v));
    $dbm = ($raw > 0 && $raw < 65535) ? round(($raw * 0.002) - 30.0, 2) : 'INVALID/OFFLINE';
    echo "  $k => $v => $dbm dBm" . PHP_EOL;
}
