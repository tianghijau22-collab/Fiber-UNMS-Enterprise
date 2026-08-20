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
        Schema::create('odp_measurements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('odp_node_id')->nullable()->index();
            $table->string('odp_code')->index();
            $table->string('odp_name')->nullable();
            $table->unsignedBigInteger('technician_id')->nullable()->index();
            $table->string('technician_name')->nullable();
            $table->decimal('power_measurement_dbm', 5, 2);
            $table->string('power_status', 20)->default('good')->index(); // 'good', 'warning', 'critical'
            $table->string('port_number', 50)->default('Port 1');
            $table->string('odp_condition', 100)->default('Normal & Bersih');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('address_location')->nullable();
            $table->text('notes')->nullable();
            $table->string('odp_photo_path')->nullable();
            $table->string('opm_photo_path')->nullable();
            $table->boolean('forwarded_to_telegram')->default(false)->index();
            $table->timestamp('telegram_sent_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('odp_node_id')->references('id')->on('network_nodes')->onDelete('set null');
            $table->foreign('technician_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('odp_measurements');
    }
};
