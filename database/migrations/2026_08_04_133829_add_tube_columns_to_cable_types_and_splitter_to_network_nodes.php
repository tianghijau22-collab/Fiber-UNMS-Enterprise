<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Menambah kolom untuk mendukung topologi FTTH dengan splitter pasif:
     *
     * Konfigurasi A: 1:2 (POP) → 1:8 (ODC) → 1:8 (ODP) = 128 client / port OLT
     * Konfigurasi B: 1:4 (ODC Induk) → 1:4 (ODC Anak) → 1:8 (ODP) = 128 client / port OLT
     *
     * Cable tube mapping:
     *  6 core  → 1 tube
     * 12 core  → 1 atau 2 tube
     * 24 core  → 2 atau 4 tube
     * 48 core  → 4 atau 8 tube
     */
    public function up(): void
    {
        // 1. Tambah tube_count & cores_per_tube ke cable_types
        Schema::table('cable_types', function (Blueprint $table) {
            $table->integer('tube_count')->default(1)->after('core_capacity')
                  ->comment('Jumlah tube dalam kabel, misal 6core=1tube, 48core=4atau8tube');
            $table->integer('cores_per_tube')->nullable()->after('tube_count')
                  ->comment('Jumlah core per tube (otomatis = core_capacity / tube_count)');
        });

        // 2. Tambah kolom splitter & topologi ke network_nodes
        Schema::table('network_nodes', function (Blueprint $table) {
            // Splitter yang dipasang di node ini
            $table->foreignId('splitter_type_id')
                  ->nullable()
                  ->after('parent_node_id')
                  ->constrained('splitter_types')
                  ->nullOnDelete()
                  ->comment('Splitter pasif yang terpasang di node ini (PLC 1:2, 1:4, 1:8, dll)');

            // Posisi splitter dalam kaskade (Level 1=OLT→POP, Level 2=ODC, Level 3=ODP)
            $table->tinyInteger('splitter_cascade_level')->default(0)->after('splitter_type_id')
                  ->comment('Level kaskade splitter: 0=tidak ada, 1=POP/ODC Induk, 2=ODC Anak, 3=ODP');

            // Referensi port OLT/SFP yang melayani subtree ini
            $table->string('olt_port_ref', 50)->nullable()->after('splitter_cascade_level')
                  ->comment('Referensi port OLT yang melayani subtree ini, misal: gpon-olt_1/1/1');
        });

        // 3. Tambah customer_service_id ke network_ports
        //    Agar setiap port ODP bisa di-link ke pelanggan yang tersambung
        Schema::table('network_ports', function (Blueprint $table) {
            $table->foreignId('customer_service_id')
                  ->nullable()
                  ->after('connected_to_port_id')
                  ->constrained('customer_services')
                  ->nullOnDelete()
                  ->comment('Pelanggan/layanan yang menggunakan port ini');

            $table->string('customer_name_cache', 150)->nullable()->after('customer_service_id')
                  ->comment('Cache nama pelanggan untuk query cepat tanpa JOIN');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('network_ports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_service_id');
            $table->dropColumn('customer_name_cache');
        });

        Schema::table('network_nodes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('splitter_type_id');
            $table->dropColumn(['splitter_cascade_level', 'olt_port_ref']);
        });

        Schema::table('cable_types', function (Blueprint $table) {
            $table->dropColumn(['tube_count', 'cores_per_tube']);
        });
    }
};
