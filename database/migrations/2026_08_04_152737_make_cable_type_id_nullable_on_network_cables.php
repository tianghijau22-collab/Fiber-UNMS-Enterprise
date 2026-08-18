<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            // Drop existing foreign key constraint first
            $table->dropForeign(['cable_type_id']);

            // Re-add as nullable with foreign key
            $table->foreignId('cable_type_id')
                  ->nullable()
                  ->change()
                  ->constrained('cable_types')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            $table->dropForeign(['cable_type_id']);
            $table->foreignId('cable_type_id')
                  ->nullable(false)
                  ->change()
                  ->constrained('cable_types');
        });
    }
};
