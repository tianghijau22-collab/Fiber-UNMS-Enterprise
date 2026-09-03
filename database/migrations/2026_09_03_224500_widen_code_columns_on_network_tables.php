<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            $table->string('code', 100)->change();
        });

        Schema::table('network_nodes', function (Blueprint $table) {
            $table->string('code', 100)->change();
        });
    }

    public function down(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            $table->string('code', 40)->change();
        });

        Schema::table('network_nodes', function (Blueprint $table) {
            $table->string('code', 40)->change();
        });
    }
};
