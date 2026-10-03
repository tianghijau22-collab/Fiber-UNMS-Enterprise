<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\OltDevice;
use App\Console\Commands\PollOltTelemetry;
use App\Http\Controllers\OltController;

echo "=== CLEANING UP LEGACY -21.50 IN ont_registrations ===" . PHP_EOL;
$count = DB::table('ont_registrations')->where('rx_power', -21.50)->update(['rx_power' => null]);
echo "Updated $count rows in ont_registrations." . PHP_EOL;

echo "=== RE-POLLING TELEMETRY ON OLT 1 ===" . PHP_EOL;
$olt = OltDevice::first();
if ($olt) {
    $ctrl = app(OltController::class);
    $cmd = new PollOltTelemetry();
    $cmd->pollSlotParallelTelemetry($olt->id, $ctrl);
}
echo "=== DONE ===" . PHP_EOL;
