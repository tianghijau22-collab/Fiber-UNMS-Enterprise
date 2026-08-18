<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Insert default Telegram Bot settings
        DB::table('system_settings')->insert([
            ['key' => 'telegram_enabled', 'value' => 'false', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'telegram_bot_token', 'value' => '', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'telegram_chat_id', 'value' => '', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
