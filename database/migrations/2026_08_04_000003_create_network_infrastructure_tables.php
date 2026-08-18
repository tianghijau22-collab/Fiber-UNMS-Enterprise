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
        // 1. Network Nodes (OLT, POP, ODC, ODP, FAT, Joint Closure, dsb.)
        Schema::create('network_nodes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 40)->unique()->comment('Kode unik node, misal: OLT-JKT-01, ODC-A01');
            $table->string('node_type', 30)->comment('OLT, POP, ODC, ODP, FAT, JOINT_CLOSURE, POLE, DUCT_MANHOLE');
            $table->foreignId('device_type_id')->nullable()->constrained('device_types')->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('model', 100)->nullable()->comment('Model/tipe perangkat, misal: Huawei MA5800-X7');
            $table->string('serial_number', 100)->nullable();
            $table->string('status', 30)->default('active')->comment('active, inactive, maintenance, damaged');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('address')->nullable()->comment('Alamat atau deskripsi lokasi fisik');
            $table->foreignId('province_id')->nullable()->constrained('provinces')->nullOnDelete();
            $table->foreignId('regency_id')->nullable()->constrained('regencies')->nullOnDelete();
            $table->foreignId('district_id')->nullable()->constrained('districts')->nullOnDelete();
            $table->foreignId('village_id')->nullable()->constrained('villages')->nullOnDelete();
            // Hirarki: ODC induk dari ODP, ODP induk dari FAT, dst.
            $table->foreignId('parent_node_id')->nullable()->constrained('network_nodes')->nullOnDelete();
            $table->integer('total_ports')->default(0)->comment('Jumlah total port/core pada node');
            $table->integer('used_ports')->default(0)->comment('Jumlah port/core yang sudah terpakai');
            $table->date('installed_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('node_type');
            $table->index('status');
        });

        // 2. Network Ports (Port pada setiap node)
        Schema::create('network_ports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('node_id')->constrained('network_nodes')->cascadeOnDelete();
            $table->string('port_number', 20)->comment('Nomor/label port, misal: PON-1/0/1, Port-A-01');
            $table->string('port_type', 30)->default('PON')->comment('PON, SC_APC, SC_UPC, FC, E1, GE, SFP');
            $table->string('status', 20)->default('available')->comment('available, used, damaged, reserved');
            // Port ini terhubung ke port lain (patch cord)
            $table->foreignId('connected_to_port_id')->nullable()->constrained('network_ports')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['node_id', 'port_number']);
            $table->index('status');
        });

        // 3. Network Splitters (Splitter yang terpasang di node)
        Schema::create('network_splitters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('node_id')->constrained('network_nodes')->cascadeOnDelete();
            $table->foreignId('splitter_type_id')->constrained('splitter_types');
            $table->string('slot_position', 20)->nullable()->comment('Slot/posisi dalam rak, misal: Tray-1, Slot-A');
            $table->string('serial_number', 100)->nullable();
            $table->string('status', 20)->default('active')->comment('active, damaged, inactive');
            $table->date('installed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
        });

        // 4. Network Cables (Kabel fiber optik antar node)
        Schema::create('network_cables', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 40)->unique()->comment('Kode kabel, misal: CAB-OLT01-ODC-A01');
            $table->foreignId('cable_type_id')->constrained('cable_types');
            $table->foreignId('from_node_id')->constrained('network_nodes');
            $table->foreignId('to_node_id')->constrained('network_nodes');
            $table->decimal('length_meters', 10, 2)->comment('Panjang kabel dalam meter');
            $table->integer('core_count_total')->comment('Jumlah core total kabel');
            $table->integer('core_count_used')->default(0)->comment('Jumlah core yang sudah dipakai');
            $table->string('installation_type', 30)->default('Aerial')->comment('Aerial, Underground, Duct, Wall');
            $table->text('route_description')->nullable()->comment('Deskripsi jalur kabel');
            $table->string('status', 20)->default('active')->comment('active, damaged, inactive');
            $table->date('installed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
        });

        // 5. Network Cable Cores (Core individual dalam kabel)
        Schema::create('network_cable_cores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cable_id')->constrained('network_cables')->cascadeOnDelete();
            $table->integer('core_number')->comment('Nomor urut core, 1–144');
            $table->string('color', 30)->nullable()->comment('Warna kode core: biru, orange, hijau, dst.');
            $table->string('status', 20)->default('available')->comment('available, used, damaged, reserved');
            // Core ini dipakai oleh pelanggan mana (opsional)
            $table->foreignId('customer_service_id')->nullable()->constrained('customer_services')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['cable_id', 'core_number']);
            $table->index('status');
        });

        // 6. ONT/ONU Registrations (Pendaftaran ONT pelanggan ke port OLT)
        Schema::create('ont_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_service_id')->constrained('customer_services')->cascadeOnDelete();
            $table->foreignId('olt_port_id')->nullable()->constrained('network_ports')->nullOnDelete();
            $table->string('onu_serial', 50);
            $table->string('onu_mac', 20)->nullable();
            $table->string('onu_type', 50)->nullable()->comment('Model ONT, misal: HG8310M, EG8145V5');
            $table->string('profile_name', 100)->nullable()->comment('Nama profil layanan di OLT');
            $table->string('vlan_id', 10)->nullable();
            $table->string('status', 20)->default('active')->comment('active, inactive, blocked');
            $table->dateTime('registered_at')->nullable();
            $table->dateTime('last_online_at')->nullable();
            $table->decimal('rx_power', 6, 2)->nullable()->comment('Daya terima sinyal optik (dBm)');
            $table->decimal('tx_power', 6, 2)->nullable()->comment('Daya kirim sinyal optik (dBm)');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('onu_serial');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ont_registrations');
        Schema::dropIfExists('network_cable_cores');
        Schema::dropIfExists('network_cables');
        Schema::dropIfExists('network_splitters');
        Schema::dropIfExists('network_ports');
        Schema::dropIfExists('network_nodes');
    }
};
