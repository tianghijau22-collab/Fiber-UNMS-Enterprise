<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            // Warna core fiber yang digunakan di ODP (misal: "Merah", "Hijau, Biru")
            $table->text('core_color')->nullable()->after('core_power');
        });
    }

    public function down(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            $table->dropColumn('core_color');
        });
    }
};

