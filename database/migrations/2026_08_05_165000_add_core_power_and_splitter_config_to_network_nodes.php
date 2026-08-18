<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            if (!Schema::hasColumn('network_nodes', 'core_power')) {
                $table->text('core_power')->nullable()->after('notes')
                    ->comment('Power optic core pada ODC (misal: +2.5 dBm Core 1, +3.0 dBm Core 2)');
            }
            if (!Schema::hasColumn('network_nodes', 'splitter_config')) {
                $table->json('splitter_config')->nullable()->after('core_power')
                    ->comment('Konfigurasi modul splitter internal ODC (misal: ["1:4", "1:8"])');
            }
        });
    }

    public function down(): void
    {
        Schema::table('network_nodes', function (Blueprint $table) {
            if (Schema::hasColumn('network_nodes', 'core_power')) {
                $table->dropColumn('core_power');
            }
            if (Schema::hasColumn('network_nodes', 'splitter_config')) {
                $table->dropColumn('splitter_config');
            }
        });
    }
};
