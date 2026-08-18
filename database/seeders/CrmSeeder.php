<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\ServiceSurvey;
use App\Models\ServicePackage;
use App\Enums\CustomerStatus;

class CrmSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $package = ServicePackage::where('code', 'HOME_20')->first();

        // Sample customer 1 — Active
        $c1 = Customer::create([
            'customer_number' => 'CUST-2026-00001',
            'name'            => 'Budi Santoso',
            'nik'             => '3201010101800001',
            'phone'           => '0812-1234-5678',
            'email'           => 'budi.santoso@email.com',
            'address'         => 'Jl. Melati No. 10, RT 001/RW 002',
            'postal_code'     => '16911',
            'latitude'        => -6.9175,
            'longitude'       => 107.6191,
            'status'          => CustomerStatus::ACTIVE,
            'customer_type'   => 'residential',
        ]);

        ServiceSurvey::create([
            'survey_number'          => 'SRV-2026-00001',
            'customer_id'            => $c1->id,
            'status'                 => 'completed',
            'scheduled_at'           => now()->subDays(30),
            'completed_at'           => now()->subDays(28),
            'latitude'               => -6.9175,
            'longitude'              => 107.6191,
            'is_feasible'            => true,
            'estimated_cable_meters' => 45,
            'location_notes'         => 'Lokasi mudah dijangkau, tiang sudah tersedia 50m dari rumah.',
        ]);

        if ($package) {
            CustomerService::create([
                'service_number'     => 'SVC-2026-00001',
                'customer_id'        => $c1->id,
                'service_package_id' => $package->id,
                'status'             => 'active',
                'installation_date'  => now()->subDays(25)->toDateString(),
                'activated_at'       => now()->subDays(25)->toDateString(),
                'onu_serial'         => 'HW-ONT-00001234',
                'onu_mac'            => 'AA:BB:CC:DD:EE:01',
                'pppoe_username'     => 'cust001@fiber-unms',
                'pppoe_password'     => 'P@ssw0rd001',
                'ip_address'         => null,
            ]);
        }

        // Sample customer 2 — Prospect (survey belum dijadwalkan)
        Customer::create([
            'customer_number' => 'CUST-2026-00002',
            'name'            => 'Siti Rahayu',
            'phone'           => '0821-9876-5432',
            'email'           => 'siti.rahayu@email.com',
            'address'         => 'Jl. Anggrek No. 5, RT 003/RW 001',
            'postal_code'     => '16912',
            'latitude'        => -6.9200,
            'longitude'       => 107.6230,
            'status'          => CustomerStatus::PROSPECT,
            'customer_type'   => 'residential',
            'notes'           => 'Calon pelanggan dari referral. Minat paket Business.',
        ]);

        // Sample customer 3 — Suspended
        $c3 = Customer::create([
            'customer_number' => 'CUST-2026-00003',
            'name'            => 'PT Maju Bersama',
            'phone'           => '021-5678-9012',
            'email'           => 'info@majubersama.co.id',
            'address'         => 'Ruko Blok A No. 12, Kawasan Industri',
            'postal_code'     => '16913',
            'latitude'        => -6.9250,
            'longitude'       => 107.6280,
            'status'          => CustomerStatus::SUSPENDED,
            'customer_type'   => 'business',
        ]);

        $packageBiz = ServicePackage::where('code', 'BUS_100')->first();
        if ($packageBiz) {
            CustomerService::create([
                'service_number'     => 'SVC-2026-00002',
                'customer_id'        => $c3->id,
                'service_package_id' => $packageBiz->id,
                'status'             => 'suspended',
                'installation_date'  => now()->subDays(60)->toDateString(),
                'activated_at'       => now()->subDays(60)->toDateString(),
                'onu_serial'         => 'HW-ONT-00002345',
                'onu_mac'            => 'AA:BB:CC:DD:EE:02',
                'pppoe_username'     => 'biz003@fiber-unms',
                'pppoe_password'     => 'BizP@ss002',
            ]);
        }
    }
}
