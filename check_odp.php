<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\NetworkNode;
use App\Services\Olt\FastOpticalProbeService;

echo "=== CHECKING ODP 363 PORTS ===" . PHP_EOL;
$ports = DB::table('network_ports')
    ->join('network_nodes', 'network_ports.node_id', '=', 'network_nodes.id')
    ->leftJoin('customer_services', 'network_ports.customer_service_id', '=', 'customer_services.id')
    ->leftJoin('customers', 'customer_services.customer_id', '=', 'customers.id')
    ->leftJoin('ont_registrations', 'ont_registrations.customer_service_id', '=', 'customer_services.id')
    ->where('network_nodes.name', 'like', '%363%')
    ->select(
        'network_nodes.id as node_id',
        'network_nodes.name as odp_name',
        'network_ports.port_number',
        'customers.name as cust_name',
        'ont_registrations.onu_serial',
        'ont_registrations.status as ont_status',
        'ont_registrations.rx_power',
        'ont_registrations.updated_at'
    )
    ->get();

echo json_encode($ports, JSON_PRETTY_PRINT) . PHP_EOL;

echo "=== PROBING ODP 363 LIVE OPTICAL ===" . PHP_EOL;
if ($ports->isNotEmpty()) {
    $nodeId = $ports[0]->node_id;
    $res = FastOpticalProbeService::probeOdpLiveOptical($nodeId);
    echo json_encode($res, JSON_PRETTY_PRINT) . PHP_EOL;
}

echo "=== CHECKING LIVE TELEMETRY CACHE FOR SERIALS ===" . PHP_EOL;
$liveMap = NetworkNode::getLiveOnuTelemetryMap();
foreach ($ports as $p) {
    $sn = strtolower(trim($p->onu_serial ?? ''));
    if ($sn) {
        echo "SN {$p->onu_serial}: " . json_encode($liveMap[$sn] ?? 'NOT IN LIVE CACHE') . PHP_EOL;
    }
}
