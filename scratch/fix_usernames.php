<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = App\Models\User::all();
foreach ($users as $user) {
    if (empty($user->username)) {
        $parts = explode('@', $user->email);
        $user->username = strtolower($parts[0]);
        $user->save();
        echo "Fixed User #{$user->id}: {$user->name} -> username: '{$user->username}'\n";
    } else {
        echo "User #{$user->id}: {$user->name} -> existing username: '{$user->username}'\n";
    }
}
