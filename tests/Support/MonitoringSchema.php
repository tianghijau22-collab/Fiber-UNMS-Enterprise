<?php
namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

trait MonitoringSchema
{
    private function monitoringSchema(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('tickets', function (Blueprint $t) {
            $t->id(); $t->string('ticket_number')->unique(); $t->string('title'); $t->text('description')->nullable();
            $t->string('category'); $t->string('priority')->default('Normal'); $t->string('status')->default('Open');
            $t->integer('network_node_id')->nullable(); $t->string('technician_name')->nullable();
            $t->json('timeline_logs')->nullable(); $t->timestamp('resolved_at')->nullable(); $t->timestamps();
        });
        Schema::create('system_notifications', function (Blueprint $t) {
            $t->id(); $t->integer('user_id')->nullable();
            foreach (['type','title','body','url','icon','image_url'] as $f) $t->text($f)->nullable();
            $t->boolean('is_read')->default(false); $t->timestamps(); $t->softDeletes();
        });
        (require database_path('migrations/2026_10_24_000001_create_monitoring_incidents_and_outbox.php'))->up();
    }
}
