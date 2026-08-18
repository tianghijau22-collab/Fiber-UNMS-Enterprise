<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telegram_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('chat_id');
            $table->json('topics')->nullable(); // Array of topics: ['NOC', 'TICKET', 'CUSTOMER', 'INFRASTRUCTURE', 'OLT_MGMT', 'USER_MGMT', 'BROADCAST', 'BILLING']
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // Migrate existing telegram_chat_id if present
        $existingChatId = DB::table('system_settings')->where('key', 'telegram_chat_id')->value('value');
        if (!empty($existingChatId)) {
            DB::table('telegram_channels')->insert([
                'name'        => 'Grup Utama NOC & Sistem',
                'chat_id'     => $existingChatId,
                'topics'      => json_encode(['NOC', 'TICKET', 'CUSTOMER', 'INFRASTRUCTURE', 'OLT_MGMT', 'USER_MGMT', 'BROADCAST', 'BILLING']),
                'is_active'   => true,
                'description' => 'Channel default untuk seluruh notifikasi sistem UNMS',
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_channels');
    }
};
