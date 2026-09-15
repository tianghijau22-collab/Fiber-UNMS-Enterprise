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
        Schema::table('ont_registrations', function (Blueprint $table) {
            $table->dropUnique(['onu_serial']);
            $table->index('onu_serial');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ont_registrations', function (Blueprint $table) {
            $table->dropIndex(['onu_serial']);
            $table->unique('onu_serial');
        });
    }
};
