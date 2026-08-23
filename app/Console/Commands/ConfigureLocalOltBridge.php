<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\OltDevice;

class ConfigureLocalOltBridge extends Command
{
    protected $signature = 'olt:configure-local-bridge';
    protected $description = 'Configures the local OLT to connect to the office OLT via VPS bridge (103.89.6.125:16100)';

    public function handle()
    {
        $device = OltDevice::first();
        if (!$device) {
            $device = new OltDevice();
            $device->name = 'OLT-TES-HSGQ';
            $device->code = 'OLT-TES-HSGQ';
        }

        $device->vendor = 'HSGQ';
        $device->vendor_key = 'hsgq';
        $device->model = 'HSGQ-E04 (4-Port EPON)';
        $device->location = 'AULA KANTOR';
        $device->ip_address = '103.89.6.125';
        $device->snmp_port = 16100;
        $device->snmp_version = 'v2c';
        $device->snmp_community_type = 'public';
        $device->total_ports = 4;
        $device->deployment_mode = 'vpn';
        $device->connection_mode = 'live';
        $device->status = 'active';
        $device->last_connected_at = now();
        $device->save();

        $this->info("Local OLT configured to connect via VPS bridge: {$device->ip_address}:{$device->snmp_port} (Live Mode)");
        return 0;
    }
}
