<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            if (!Schema::hasColumn('network_cables', 'cable_color')) {
                $table->string('cable_color', 20)->nullable()->after('route_coordinates');
            }

            // Make from_node_id nullable to allow importing independent fiber route LineStrings
            $table->dropForeign(['from_node_id']);
            $table->unsignedBigInteger('from_node_id')->nullable()->change();
            $table->foreign('from_node_id')->references('id')->on('network_nodes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('network_cables', function (Blueprint $table) {
            if (Schema::hasColumn('network_cables', 'cable_color')) {
                $table->dropColumn('cable_color');
            }

            $table->dropForeign(['from_node_id']);
            $table->unsignedBigInteger('from_node_id')->nullable(false)->change();
            $table->foreign('from_node_id')->references('id')->on('network_nodes');
        });
    }
};
