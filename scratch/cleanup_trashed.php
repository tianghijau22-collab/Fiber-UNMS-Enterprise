<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$deletedCount = DB::table('customers')->whereNotNull('deleted_at')->delete();
echo "Permanently cleaned {$deletedCount} soft-deleted customer rows!\n";
