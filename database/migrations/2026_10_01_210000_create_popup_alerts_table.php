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
        Schema::create('popup_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->string('type')->default('info'); // info, warning, critical, maintenance, update
            $table->string('badge_text')->nullable(); // e.g. "Pemeliharaan Jaringan", "Pembaruan Sistem"
            $table->json('target_roles')->nullable(); // ['all'] or specific roles
            $table->boolean('is_active')->default(true);
            $table->boolean('show_once_per_user')->default(false);
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->string('action_button_text')->nullable();
            $table->string('action_button_url')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('created_by_name')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'type']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('popup_alerts');
    }
};
