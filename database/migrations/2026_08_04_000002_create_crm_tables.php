<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Enums\CustomerStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Customers (Data Pelanggan Utama)
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('customer_number', 30)->unique()->comment('Nomor pelanggan unik, misal: CUST-2026-00001');
            $table->string('name');
            $table->string('nik', 20)->nullable()->unique()->comment('Nomor Induk Kependudukan');
            $table->string('phone', 30);
            $table->string('email')->nullable();
            $table->text('address');
            $table->foreignId('province_id')->nullable()->constrained('provinces')->nullOnDelete();
            $table->foreignId('regency_id')->nullable()->constrained('regencies')->nullOnDelete();
            $table->foreignId('district_id')->nullable()->constrained('districts')->nullOnDelete();
            $table->foreignId('village_id')->nullable()->constrained('villages')->nullOnDelete();
            $table->string('postal_code', 10)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('status', 30)->default(CustomerStatus::PROSPECT->value);
            $table->string('customer_type', 20)->default('residential')->comment('residential, business, government');
            $table->string('id_card_photo')->nullable()->comment('Path foto KTP');
            $table->string('house_photo')->nullable()->comment('Path foto rumah/lokasi');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('customer_type');
            $table->index('phone');
        });

        // 2. Service Surveys (Survei Lokasi)
        Schema::create('service_surveys', function (Blueprint $table) {
            $table->id();
            $table->string('survey_number', 30)->unique()->comment('Nomor survei, misal: SRV-2026-00001');
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('surveyor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('scheduled_at')->nullable()->comment('Jadwal survei');
            $table->dateTime('completed_at')->nullable()->comment('Waktu survei selesai');
            $table->string('status', 20)->default('scheduled')->comment('scheduled, in_progress, completed, cancelled');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('location_notes')->nullable()->comment('Catatan kondisi lokasi');
            $table->boolean('is_feasible')->nullable()->comment('Apakah lokasi layak dipasang');
            $table->text('feasibility_notes')->nullable()->comment('Alasan kelayakan atau tidak');
            $table->integer('estimated_cable_meters')->nullable()->comment('Estimasi panjang kabel yang dibutuhkan');
            $table->text('obstacles')->nullable()->comment('Hambatan atau tantangan pemasangan');
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('scheduled_at');
        });

        // 3. Customer Services (Layanan Aktif Pelanggan / Subscription)
        Schema::create('customer_services', function (Blueprint $table) {
            $table->id();
            $table->string('service_number', 30)->unique()->comment('Nomor layanan, misal: SVC-2026-00001');
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages');
            $table->string('status', 30)->default('active')->comment('active, suspended, isolated, terminated');
            $table->date('installation_date')->nullable();
            $table->date('activated_at')->nullable();
            $table->date('terminated_at')->nullable();
            $table->string('onu_serial', 50)->nullable()->comment('Serial number ONU/ONT pelanggan');
            $table->string('onu_mac', 20)->nullable()->comment('MAC address ONU/ONT');
            $table->string('pppoe_username', 100)->nullable()->comment('Username PPPoE');
            $table->string('pppoe_password', 100)->nullable()->comment('Password PPPoE');
            $table->string('ip_address', 45)->nullable()->comment('IP statis jika ada');
            $table->text('installation_notes')->nullable();
            $table->foreignId('installed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('onu_serial');
            $table->index('pppoe_username');
        });

        // 4. Customer Contacts (Kontak Tambahan)
        Schema::create('customer_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('name');
            $table->string('relation', 50)->comment('spouse, parent, colleague, etc.');
            $table->string('phone', 30);
            $table->string('email')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        // 5. Customer Notes (Log Catatan Pelanggan)
        Schema::create('customer_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->text('note');
            $table->string('note_type', 30)->default('general')->comment('general, complaint, billing, technical');
            $table->timestamps();

            $table->index('note_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_notes');
        Schema::dropIfExists('customer_contacts');
        Schema::dropIfExists('customer_services');
        Schema::dropIfExists('service_surveys');
        Schema::dropIfExists('customers');
    }
};
