<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('olt_devices', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // "OLT ZTE C300 Kota Solok"
            $table->string('code')->unique();                // "OLT-SLK-01"
            $table->string('vendor');                        // ZTE, Hioso, HSGQ, Tarmoc
            $table->string('model');                         // ZXAN C300, HA7302CS, etc.
            $table->string('vendor_key');                    // zte-c300, hioso, etc.
            $table->string('location');                      // "Kota Solok (POP Solok Central)"
            $table->string('ip_address');                    // Management IP OLT
            $table->integer('total_ports')->default(4);

            // ─── Deployment / Connection Mode ─────────────────────────
            // direct = internal ISP langsung, vpn = via VPN, probe = NMS Probe Agent
            $table->enum('deployment_mode', ['direct', 'vpn', 'probe'])->default('direct');

            // ─── SNMP Configuration ───────────────────────────────────
            $table->enum('snmp_version', ['v2c', 'v3'])->default('v2c');
            // v2c fields
            $table->enum('snmp_community_type', ['public', 'custom'])->default('public');
            $table->string('snmp_community_string')->nullable(); // encrypted custom community
            // v3 fields
            $table->string('snmp_v3_username')->nullable();
            $table->string('snmp_v3_auth_protocol')->nullable();   // MD5, SHA
            $table->string('snmp_v3_auth_password')->nullable();   // encrypted
            $table->string('snmp_v3_priv_protocol')->nullable();   // DES, AES
            $table->string('snmp_v3_priv_password')->nullable();   // encrypted
            $table->integer('snmp_port')->default(161);
            $table->integer('snmp_timeout')->default(5);           // seconds
            $table->integer('snmp_retries')->default(2);

            // ─── CLI Configuration (Telnet/SSH) ───────────────────────
            $table->enum('cli_protocol', ['telnet', 'ssh'])->default('telnet');
            $table->string('cli_username')->nullable();
            $table->string('cli_password')->nullable();            // encrypted
            $table->integer('cli_port')->default(23);

            // ─── Probe Agent (for external/cloud deployment) ──────────
            $table->string('probe_agent_url')->nullable();         // https://probe.isp.com:8080
            $table->string('probe_agent_token')->nullable();       // encrypted API token

            // ─── Status & Telemetry Cache ─────────────────────────────
            $table->enum('status', ['active', 'inactive', 'maintenance'])->default('active');
            $table->enum('connection_mode', ['live', 'simulation'])->default('simulation');
            $table->timestamp('last_connected_at')->nullable();
            $table->integer('last_ping_ms')->nullable();
            $table->json('last_telemetry_snapshot')->nullable();   // cache of last known state

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('olt_devices');
    }
};
