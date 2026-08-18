<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. PPPoE Profiles – konfigurasi profil layanan pada OLT
        Schema::create('pppoe_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->integer('max_rate_kbps')->comment('Kecepatan maksimum dalam Kbps');
            $table->integer('burst_kbps')->nullable();
            $table->string('access_type', 20)->default('static')->comment('static atau dynamic');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 2. VLAN Assignments – menempelkan VLAN ke layanan pelanggan
        Schema::create('vlan_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_id')->constrained('customer_services')->cascadeOnDelete();
            $table->unsignedInteger('vlan_id')->comment('ID VLAN pada OLT');
            $table->string('description')->nullable();
            $table->timestamps();

            $table->unique(['customer_service_id', 'vlan_id']);
        });

        // 3. Service Quotas – batas bandwidth / data per layanan
        Schema::create('service_quotas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_id')->constrained('customer_services')->cascadeOnDelete();
            $table->integer('bandwidth_limit_kbps')->nullable();
            $table->bigInteger('data_cap_gb')->nullable();
            $table->timestamps();
        });

        // 4. Billing Invoices – tagihan bulanan per layanan
        Schema::create('billing_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_id')->constrained('customer_services')->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->decimal('amount', 12, 2);
            $table->date('billing_period_start');
            $table->date('billing_period_end');
            $table->date('due_date');
            $table->enum('status', ['draft', 'issued', 'paid', 'overdue', 'canceled'])->default('draft');
            $table->timestamps();
        });

        // 5. Billing Payments – catatan pembayaran per invoice
        Schema::create('billing_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('billing_invoice_id')->constrained('billing_invoices')->cascadeOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method'); // cash, bank_transfer, ewallet, dll.
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('billing_payments');
        Schema::dropIfExists('billing_invoices');
        Schema::dropIfExists('service_quotas');
        Schema::dropIfExists('vlan_assignments');
        Schema::dropIfExists('pppoe_profiles');
    }
};
