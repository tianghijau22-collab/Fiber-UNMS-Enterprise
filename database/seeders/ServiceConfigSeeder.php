<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PppoeProfile;
use App\Models\VlanAssignment;
use App\Models\ServiceQuota;
use App\Models\BillingInvoice;
use App\Models\BillingPayment;
use App\Models\CustomerService;
use App\Models\ServicePackage;

class ServiceConfigSeeder extends Seeder
{
    public function run(): void
    {
        // Use an existing service package (HOME_20) for PPPoE profile
        $package = ServicePackage::where('code', 'HOME_20')->first();
        if (! $package) {
            return;
        }

        // 1. PPPoE profile
        $profile = PppoeProfile::create([
            'name'               => 'Home 20Mbps',
            'service_package_id' => $package->id,
            'max_rate_kbps'      => 20480,
            'burst_kbps'         => 25600,
            'access_type'        => 'static',
            'description'        => 'PPPoE profile for 20 Mbps residential package',
        ]);

        // 2. Pick an active customer service (created by CRM seeder)
        $svc = CustomerService::where('status', 'active')->first();
        if (! $svc) {
            return;
        }

        // VLAN assignment for this service
        VlanAssignment::create([
            'customer_service_id' => $svc->id,
            'vlan_id'             => 100,
            'description'         => 'VLAN untuk paket HOME_20',
        ]);

        // Service quota (optional but demonstrate)
        ServiceQuota::create([
            'customer_service_id' => $svc->id,
            'bandwidth_limit_kbps'=> 20480,
            'data_cap_gb'         => null,
        ]);

        // 3. Billing invoice for the month
        $invoice = BillingInvoice::create([
            'customer_service_id' => $svc->id,
            'invoice_number'      => 'INV-2023-00001',
            'amount'              => 250_000.00,
            'billing_period_start'=> now()->subMonth()->startOfMonth()->toDateString(),
            'billing_period_end'  => now()->subMonth()->endOfMonth()->toDateString(),
            'due_date'            => now()->addDays(10)->toDateString(),
            'status'              => 'issued',
        ]);

        // 4. Payment record (assuming paid quickly)
        BillingPayment::create([
            'billing_invoice_id' => $invoice->id,
            'payment_date'       => now()->toDateString(),
            'amount'             => $invoice->amount,
            'payment_method'     => 'bank_transfer',
            'notes'              => 'Pembayaran via transfer bank BCA',
        ]);
    }
}
