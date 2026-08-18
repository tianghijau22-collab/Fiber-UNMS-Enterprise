<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$customers = DB::table('customers')->get(['id', 'customer_number', 'name', 'deleted_at']);
echo "Total rows in customers table (including deleted): " . $customers->count() . "\n";
foreach ($customers as $c) {
    echo "ID: {$c->id} | Number: {$c->customer_number} | Name: {$c->name} | Deleted: {$c->deleted_at}\n";
}
