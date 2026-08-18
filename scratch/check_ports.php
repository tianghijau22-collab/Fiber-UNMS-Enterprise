<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$odps = \App\Models\NetworkNode::where('node_type', 'ODP')->get();
foreach ($odps as $odp) {
    echo "ODP ID: {$odp->id} | Name: {$odp->name} | total_ports: {$odp->total_ports} | used_ports in DB: {$odp->used_ports}\n";
    $ports = \App\Models\NetworkPort::where('node_id', $odp->id)->get();
    foreach ($ports as $p) {
        echo "  Port #{$p->port_number} (ID: {$p->id}) | status: {$p->status} | customer_service_id: {$p->customer_service_id} | customer_name_cache: {$p->customer_name_cache} | destination_label: {$p->destination_label}\n";
    }
}

echo "\nCustomers Count: " . \App\Models\Customer::count() . "\n";
echo "CustomerServices Count: " . \App\Models\CustomerService::count() . "\n";
