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
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('Super Administrator')->after('password');
            $table->string('division')->default('Network Operation Center')->after('role');
            $table->string('phone')->nullable()->after('division');
            $table->string('status')->default('Active')->after('phone');
            $table->timestamp('last_login_at')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'division', 'phone', 'status', 'last_login_at']);
        });
    }
};
