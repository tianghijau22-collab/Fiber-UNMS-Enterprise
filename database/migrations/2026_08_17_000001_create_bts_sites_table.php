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
        Schema::create('bts_sites', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('link_segment')->nullable()->comment('Keterangan rute / link sub-segmen, misal: LINK -VIA KP JAWA(SMK3)');
            $table->string('code', 50)->unique()->comment('Kode site unik, misal: BTS-SMK3-01');
            $table->date('measurement_date')->nullable()->comment('Tanggal pengukuran redaman');
            $table->string('sfp_sm_link_length', 50)->default('20Km')->comment('Spesifikasi jarak optik SFP: 10Km, 20Km, 40Km, 80Km');
            $table->string('sfp_vendor', 100)->nullable()->comment('Vendor SFP: WTD, HISENSE, MIKROBITS, TARMOC, HUAWEI, MIKROTIK');
            $table->decimal('tx_power', 8, 3)->nullable()->comment('Daya pancar optik SFP (dBm), misal: -2.264');
            $table->decimal('rx_power', 8, 3)->nullable()->comment('Daya terima / redaman SFP (dBm), misal: -9.570');
            $table->decimal('cable_length_km', 8, 2)->nullable()->comment('Jarak tarikan kabel lurus dalam Km, misal: 5.17');
            $table->integer('tube_number')->default(1)->comment('Nomor Loose Tube (1-12)');
            $table->string('tube_color', 50)->default('Biru (Blue)')->comment('Warna Tube TIA-598');
            $table->integer('core_number')->default(1)->comment('Nomor Core (1-24)');
            $table->string('core_color', 50)->default('Biru (Blue)')->comment('Warna Core TIA-598');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('address')->nullable()->comment('Alamat atau lokasi fisik BTS');
            $table->string('mikrotik_ip', 50)->nullable()->comment('IP MikroTik Core Router');
            $table->string('sfp_port_name', 50)->nullable()->comment('Nama port SFP di MikroTik, misal: sfp-sfpplus1');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index('code');
            $table->index('sfp_vendor');
            $table->index('measurement_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bts_sites');
    }
};
