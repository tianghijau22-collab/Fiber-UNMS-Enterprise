<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create default admin user
        User::firstOrCreate(
            ['email' => 'admin@fiber-unms.id'],
            [
                'name' => 'Administrator',
                'username' => 'admin',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role' => 'admin',
            ]
        );

        // Seed all master data tables
        $this->call([
            MasterDataSeeder::class,
            CrmSeeder::class,
            NetworkInfrastructureSeeder::class,
            ServiceConfigSeeder::class,
            FiberUnmsSeeder::class,
        ]);
    }
}
