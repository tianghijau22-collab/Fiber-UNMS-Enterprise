<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\NetworkNode;
use App\Models\NetworkPort;

// Clean up orphaned customer port bindings on ODP nodes
$odpNodeIds = NetworkNode::where('node_type', 'ODP')->pluck('id');

$orphanedPorts = NetworkPort::whereIn('node_id', $odpNodeIds)
    ->where(function ($q) {
        $q->whereNull('customer_service_id')
          ->orWhereNotIn('customer_service_id', DB::table('customer_services')->pluck('id'));
    })
    ->get();

echo "Found " . $orphanedPorts->count() . " orphaned ODP ports. Cleaning up...\n";

foreach ($orphanedPorts as $port) {
    echo "  Resetting Port #{$port->port_number} (ID: {$port->id}, Node: {$port->node_id}, Old Cache: '{$port->customer_name_cache}') -> available\n";
    $port->update([
        'customer_service_id' => null,
        'customer_name_cache' => null,
        'status'              => 'available',
    ]);
}

// Recalculate used_ports for all ODP nodes
foreach ($odpNodeIds as $nodeId) {
    $usedCount = NetworkPort::where('node_id', $nodeId)
        ->where(function ($q) {
            $q->whereNotNull('customer_service_id')
              ->orWhere(function ($q2) {
                  $q2->where('status', 'used')
                     ->whereNotNull('destination_label')
                     ->where('destination_label', '!=', '');
              });
        })
        ->count();

    NetworkNode::where('id', $nodeId)->update(['used_ports' => $usedCount]);
    $node = NetworkNode::find($nodeId);
    echo "ODP '{$node->name}' updated: used_ports = {$node->used_ports} / {$node->total_ports}\n";
}

echo "Cleanup complete!\n";
