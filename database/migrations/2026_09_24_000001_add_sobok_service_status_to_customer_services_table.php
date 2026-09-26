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
        Schema::table('customer_services', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_services', 'sobok_service_status')) {
                $table->string('sobok_service_status', 20)->default('OPEN')->after('status')->index();
            }
            if (!Schema::hasColumn('customer_services', 'sobok_profile')) {
                $table->string('sobok_profile', 50)->nullable()->after('sobok_service_status');
            }
            if (!Schema::hasColumn('customer_services', 'sobok_sync_at')) {
                $table->timestamp('sobok_sync_at')->nullable()->after('sobok_profile');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_services', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('customer_services', 'sobok_service_status')) $columns[] = 'sobok_service_status';
            if (Schema::hasColumn('customer_services', 'sobok_profile')) $columns[] = 'sobok_profile';
            if (Schema::hasColumn('customer_services', 'sobok_sync_at')) $columns[] = 'sobok_sync_at';
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
