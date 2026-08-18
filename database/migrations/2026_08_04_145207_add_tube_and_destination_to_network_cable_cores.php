<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Menambah detail Tube, Warna Core (TIA-598-A), Peruntukan Core (ODC, BTS, Corporate),
     * dan Label Cassette / ODF Rack pada tabel network_cable_cores.
     */
    public function up(): void
    {
        Schema::table('network_cable_cores', function (Blueprint $table) {
            $table->integer('tube_number')->default(1)->after('core_number')
                  ->comment('Nomor urut tube (1..8)');
            $table->string('tube_color', 30)->nullable()->after('tube_number')
                  ->comment('Warna tube: Biru, Oranye, Hijau, Cokelat, Abu-abu, Putih, Merah, Hitam, Kuning, Ungu, Pink, Toska');
            $table->string('destination_type', 40)->default('UNASSIGNED')->after('status')
                  ->comment('Peruntukan core: ODC, BTS, CORPORATE, LEASED_FIBER, BACKBONE, RESERVED, UNASSIGNED');
            $table->string('destination_name', 200)->nullable()->after('destination_type')
                  ->comment('Nama peruntukan spesifik, misal: ODC Perum Asri A - Port 1, BTS Telkomsel Tower #12, Corporate Bank Mandiri');
            $table->foreignId('destination_node_id')->nullable()->after('destination_name')
                  ->constrained('network_nodes')->nullOnDelete()
                  ->comment('ID node ODC/POP tujuan jika tersambung ke node jaringan');
            $table->string('odf_cassette_label', 100)->nullable()->after('destination_node_id')
                  ->comment('Posisi kaset ODF di POP, misal: ODF-Rack 01 / Tray 2 / Slot 04');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('network_cable_cores', function (Blueprint $table) {
            $table->dropConstrainedForeignId('destination_node_id');
            $table->dropColumn([
                'tube_number',
                'tube_color',
                'destination_type',
                'destination_name',
                'odf_cassette_label',
            ]);
        });
    }
};
