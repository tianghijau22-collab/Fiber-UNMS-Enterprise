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
        Schema::table('popup_alerts', function (Blueprint $table) {
            if (!Schema::hasColumn('popup_alerts', 'image_url')) {
                $table->longText('image_url')->nullable()->after('message');
            } else {
                $table->longText('image_url')->nullable()->change();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('popup_alerts', function (Blueprint $table) {
            if (Schema::hasColumn('popup_alerts', 'image_url')) {
                $table->dropColumn('image_url');
            }
        });
    }
};
