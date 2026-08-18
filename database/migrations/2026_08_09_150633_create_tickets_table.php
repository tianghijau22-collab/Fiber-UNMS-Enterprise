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
        Schema::dropIfExists('tickets');

        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category')->default('Kabel Putus');
            $table->string('priority')->default('Normal');
            $table->string('status')->default('Open');
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('network_node_id')->nullable()->constrained('network_nodes')->nullOnDelete();
            $table->foreignId('network_cable_id')->nullable()->constrained('network_cables')->nullOnDelete();
            $table->string('technician_name')->nullable();
            $table->string('dispatch_team')->nullable();
            $table->string('initial_power_dbm')->nullable();
            $table->string('final_power_dbm')->nullable();
            $table->json('materials_used')->nullable();
            $table->json('timeline_logs')->nullable();
            $table->timestamp('sla_deadline')->nullable();
            $table->boolean('is_sla_breached')->default(false);
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
