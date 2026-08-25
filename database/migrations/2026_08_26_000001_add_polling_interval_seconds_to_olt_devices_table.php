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
        Schema::table('olt_devices', function (Blueprint $table) {
            if (!Schema::hasColumn('olt_devices', 'polling_interval_seconds')) {
                $table->unsignedInteger('polling_interval_seconds')->default(60)->after('connection_mode');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('olt_devices', function (Blueprint $table) {
            if (Schema::hasColumn('olt_devices', 'polling_interval_seconds')) {
                $table->dropColumn('polling_interval_seconds');
            }
        });
    }
};
