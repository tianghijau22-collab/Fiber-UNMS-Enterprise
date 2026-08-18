<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            // Tube input (jumlah tube fiber yang masuk ke ODC)
            if (!Schema::hasColumn('network_nodes', 'tube_count')) {
                $table->unsignedTinyInteger('tube_count')->nullable()->after('core_power')
                    ->comment('Jumlah tube fiber yang masuk ke ODC (misal: 2, 4, 6)');
            }
            // Keterangan detail tube (warna, label, dll)
            if (!Schema::hasColumn('network_nodes', 'tube_info')) {
                $table->text('tube_info')->nullable()->after('tube_count')
                    ->comment('Detail info tube (misal: Tube 1 - Biru, Tube 2 - Orange)');
            }
            // Jumlah splitter per tipe (berapa buah splitter yang dipasang)
            if (!Schema::hasColumn('network_nodes', 'splitter_count')) {
                $table->unsignedTinyInteger('splitter_count')->nullable()->after('tube_info')
                    ->comment('Jumlah splitter yang terpasang dalam ODC ini');
            }
            // Tipe topologi ODC: tunggal | induk | anak
            if (!Schema::hasColumn('network_nodes', 'odc_topology_type')) {
                $table->string('odc_topology_type', 20)->nullable()->after('splitter_count')
                    ->comment('Jenis topologi ODC: tunggal | induk | anak');
            }
            // Fix olt_port_ref column length for multi-interface support
            if (Schema::hasColumn('network_nodes', 'olt_port_ref')) {
                // Change max length from 50 to 500 to support multi-interface
                $table->string('olt_port_ref', 500)->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            foreach (['tube_count', 'tube_info', 'splitter_count', 'odc_topology_type'] as $col) {
                if (Schema::hasColumn('network_nodes', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
