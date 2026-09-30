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
        // 1. Indexing Audit Logs (300k+ rows)
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('created_at', 'audit_logs_created_at_index');
            $table->index('action', 'audit_logs_action_index');
            $table->index('module', 'audit_logs_module_index');
        });

        // 2. Indexing System Notifications (30k+ rows)
        Schema::table('system_notifications', function (Blueprint $table) {
            $table->index('created_at', 'system_notifications_created_at_index');
            $table->index('read_at', 'system_notifications_read_at_index');
            $table->index('is_read', 'system_notifications_is_read_index');
            $table->index('type', 'system_notifications_type_index');
            $table->index('user_id', 'system_notifications_user_id_index');
        });

        // 3. Indexing Ont Registrations Foreign Keys & Mac
        Schema::table('ont_registrations', function (Blueprint $table) {
            $table->index('customer_service_id', 'ont_registrations_customer_service_id_index');
            $table->index('olt_port_id', 'ont_registrations_olt_port_id_index');
            $table->index('onu_mac', 'ont_registrations_onu_mac_index');
            $table->index('rx_power', 'ont_registrations_rx_power_index');
        });

        // 4. Indexing Customer Services Foreign Keys
        Schema::table('customer_services', function (Blueprint $table) {
            $table->index('customer_id', 'customer_services_customer_id_index');
            $table->index('service_package_id', 'customer_services_service_package_id_index');
        });

        // 5. Indexing Network Ports Foreign Keys
        Schema::table('network_ports', function (Blueprint $table) {
            $table->index('customer_service_id', 'network_ports_customer_service_id_index');
            $table->index('connected_to_port_id', 'network_ports_connected_to_port_id_index');
        });

        // 6. Indexing Network Nodes Foreign Keys & OLT References
        Schema::table('network_nodes', function (Blueprint $table) {
            $table->index('olt_device_id', 'network_nodes_olt_device_id_index');
            $table->index('parent_node_id', 'network_nodes_parent_node_id_index');
            $table->index('olt_port_ref', 'network_nodes_olt_port_ref_index');
        });

        // 7. Indexing Tickets
        Schema::table('tickets', function (Blueprint $table) {
            $table->index('status', 'tickets_status_index');
            $table->index('priority', 'tickets_priority_index');
            $table->index('created_at', 'tickets_created_at_index');
            $table->index('customer_id', 'tickets_customer_id_index');
            $table->index('network_node_id', 'tickets_network_node_id_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_created_at_index');
            $table->dropIndex('audit_logs_action_index');
            $table->dropIndex('audit_logs_module_index');
        });

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->dropIndex('system_notifications_created_at_index');
            $table->dropIndex('system_notifications_read_at_index');
            $table->dropIndex('system_notifications_is_read_index');
            $table->dropIndex('system_notifications_type_index');
            $table->dropIndex('system_notifications_user_id_index');
        });

        Schema::table('ont_registrations', function (Blueprint $table) {
            $table->dropIndex('ont_registrations_customer_service_id_index');
            $table->dropIndex('ont_registrations_olt_port_id_index');
            $table->dropIndex('ont_registrations_onu_mac_index');
            $table->dropIndex('ont_registrations_rx_power_index');
        });

        Schema::table('customer_services', function (Blueprint $table) {
            $table->dropIndex('customer_services_customer_id_index');
            $table->dropIndex('customer_services_service_package_id_index');
        });

        Schema::table('network_ports', function (Blueprint $table) {
            $table->dropIndex('network_ports_customer_service_id_index');
            $table->dropIndex('network_ports_connected_to_port_id_index');
        });

        Schema::table('network_nodes', function (Blueprint $table) {
            $table->dropIndex('network_nodes_olt_device_id_index');
            $table->dropIndex('network_nodes_parent_node_id_index');
            $table->dropIndex('network_nodes_olt_port_ref_index');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_status_index');
            $table->dropIndex('tickets_priority_index');
            $table->dropIndex('tickets_created_at_index');
            $table->dropIndex('tickets_customer_id_index');
            $table->dropIndex('tickets_network_node_id_index');
        });
    }
};
