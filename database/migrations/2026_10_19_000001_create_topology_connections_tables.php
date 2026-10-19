<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topology_connections', function (Blueprint $table) {
            $table->id();
            $table->char('active_key', 64)->nullable()->unique();
            $table->string('candidate_id', 160)->index();
            $table->string('state', 20)->default('verified')->index();
            $table->unsignedInteger('revision')->default(1);
            $table->json('definition');
            $table->char('source_version', 64);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('created_by_name');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
        Schema::create('topology_connection_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->constrained('topology_connections')->restrictOnDelete();
            $table->string('action', 20);
            $table->unsignedInteger('revision');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name');
            $table->text('reason');
            $table->json('definition');
            $table->timestamp('created_at');
            $table->index(['connection_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('topology_connection_events');
        Schema::dropIfExists('topology_connections');
    }
};
