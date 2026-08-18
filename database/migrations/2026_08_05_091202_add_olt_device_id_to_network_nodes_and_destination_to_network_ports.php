<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            $table->foreignId('olt_device_id')
                  ->nullable()
                  ->after('parent_node_id')
                  ->constrained('olt_devices')
                  ->nullOnDelete()
                  ->comment('Perangkat OLT tempat node/ODC ini terhubung');
        });

        Schema::table('network_ports', function (Blueprint $table) {
            $table->string('destination_label', 255)
                  ->nullable()
                  ->after('customer_name_cache')
                  ->comment('Deskripsi peruntukan/target koneksi port (misal: Feeder Core 1, ODP-01, Corporate Link)');
        });
    }

    public function down(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            $table->dropForeign(['olt_device_id']);
            $table->dropColumn('olt_device_id');
        });

        Schema::table('network_ports', function (Blueprint $table) {
            $table->dropColumn('destination_label');
        });
    }
};
