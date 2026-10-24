<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitoring_checkpoints', function (Blueprint $t) {
            $t->string('name', 80)->primary();
            $t->json('payload');
            $t->timestamp('updated_at');
        });
        Schema::create('monitoring_incidents', function (Blueprint $t) {
            $t->id();
            $t->uuid('episode')->unique();
            $t->string('scope_key', 190)->index();
            $t->string('open_scope_key', 190)->nullable()->unique();
            $t->string('kind', 32);
            $t->string('name');
            $t->string('status', 24);
            $t->string('condition', 24);
            $t->boolean('baseline')->default(false);
            $t->boolean('notify_enabled')->default(false);
            $t->unsignedInteger('version')->default(0);
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('closed_at')->nullable();
            $t->timestamp('last_observed_at')->nullable();
            $t->json('context');
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });
        Schema::create('monitoring_events', function (Blueprint $t) {
            $t->id();
            $t->string('event_key', 64)->unique();
            $t->foreignId('incident_id')->constrained('monitoring_incidents')->restrictOnDelete();
            $t->unsignedInteger('version');
            $t->string('transition', 32);
            $t->timestamp('sampled_at')->nullable();
            $t->json('payload');
            $t->timestamp('created_at');
            $t->unique(['incident_id', 'version']);
        });
        Schema::create('monitoring_deliveries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('event_id')->constrained('monitoring_events')->restrictOnDelete();
            $t->string('channel', 20);
            $t->string('recipient_key', 64);
            $t->text('recipient')->nullable();
            $t->unsignedSmallInteger('part_index')->default(0);
            $t->json('payload');
            $t->string('status', 24)->default('pending');
            $t->unsignedInteger('attempts')->default(0);
            $t->unsignedInteger('cycle_attempts')->default(0);
            $t->timestamp('available_at')->nullable();
            $t->timestamp('queued_at')->nullable();
            $t->timestamp('locked_until')->nullable();
            $t->uuid('claim_token')->nullable();
            $t->string('status_reason', 80)->nullable();
            $t->unsignedSmallInteger('http_status')->nullable();
            $t->string('response_reference', 160)->nullable();
            $t->timestamps();
            $t->unique(['event_id', 'channel', 'recipient_key', 'part_index'], 'monitoring_delivery_destination_unique');
            $t->index(['status', 'available_at']);
            $t->index('locked_until');
        });
        Schema::create('ticket_sequences', function (Blueprint $t) {
            $t->unsignedInteger('year')->primary();
            $t->unsignedBigInteger('value')->default(0);
        });
        Schema::create('ticket_idempotency_requests', function (Blueprint $t) {
            $t->string('key_hash', 64)->primary();
            $t->string('payload_hash', 64);
            $t->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
            $t->timestamp('created_at');
            $t->timestamp('completed_at')->nullable();
        });
        Schema::table('tickets', function (Blueprint $t) {
            $t->foreignId('monitoring_incident_id')->nullable()->unique()->constrained('monitoring_incidents')->restrictOnDelete();
        });
        Schema::table('system_notifications', function (Blueprint $t) {
            $t->foreignId('monitoring_event_id')->nullable()->unique()->constrained('monitoring_events')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('system_notifications', fn (Blueprint $t) => $t->dropConstrainedForeignId('monitoring_event_id'));
        Schema::table('tickets', fn (Blueprint $t) => $t->dropConstrainedForeignId('monitoring_incident_id'));
        foreach (['ticket_idempotency_requests', 'ticket_sequences', 'monitoring_deliveries', 'monitoring_events', 'monitoring_incidents', 'monitoring_checkpoints'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
