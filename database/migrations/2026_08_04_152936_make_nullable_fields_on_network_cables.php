<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            // Drop existing foreign key then re-add as nullable
            $table->dropForeign(['to_node_id']);

            $table->unsignedBigInteger('to_node_id')
                  ->nullable()
                  ->change();

            $table->foreign('to_node_id')
                  ->references('id')
                  ->on('network_nodes')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            $table->dropForeign(['to_node_id']);
            $table->unsignedBigInteger('to_node_id')
                  ->nullable(false)
                  ->change();
            $table->foreign('to_node_id')
                  ->references('id')
                  ->on('network_nodes');
        });
    }
};
