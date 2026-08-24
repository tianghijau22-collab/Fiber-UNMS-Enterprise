<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\OltDevice;
use App\Http\Controllers\OltController;
use Illuminate\Support\Facades\Log;

class PollOltTelemetry extends Command
{
    protected $signature = 'olt:poll-telemetry {--device= : Specific OLT Device ID to poll}';
    protected $description = 'Polls live telemetry from active OLTs via SNMP and stores snapshot in database';

    public function handle(OltController $oltCtrl)
    {
        $deviceId = $this->option('device');
        $query = OltDevice::where('status', 'active');
        if ($deviceId) {
            $query->where('id', (int)$deviceId);
        }

        $devices = $query->get();
        if ($devices->isEmpty()) {
            $this->info('No active OLT devices found for telemetry polling.');
            return 0;
        }

        foreach ($devices as $device) {
            $this->info("Polling OLT: {$device->name} ({$device->ip_address}:{$device->snmp_port}) Mode: {$device->connection_mode}...");

            try {
                $driver = $oltCtrl->getDriver($device->vendor_key ?: strtolower($device->vendor), $device->id);

                $deviceInfo = $driver->getDeviceInfo();
                $ponPorts   = $driver->getPonPorts();
                $onuList    = $driver->getOnuList();
                $uncfg      = $driver->getUnconfiguredOnus();

                $snapshot = [
                    'device_info'       => $deviceInfo,
                    'pon_ports'         => $ponPorts,
                    'onu_list'          => $onuList,
                    'unconfigured_onus' => $uncfg,
                    'polled_at'         => now()->toIso8601String(),
                ];

                $device->update([
                    'last_telemetry_snapshot' => $snapshot,
                    'last_connected_at'       => now(),
                ]);

                // Sync live optical data directly to OntRegistration records in database
                foreach ($onuList as $onuData) {
                    $sn = $onuData['serial_number'] ?? null;
                    if ($sn) {
                        \App\Models\OntRegistration::where('onu_serial', $sn)
                            ->orWhere('onu_mac', $sn)
                            ->update([
                                'rx_power' => $onuData['rx_power'] ?? null,
                                'tx_power' => $onuData['tx_power'] ?? null,
                                'status'   => ($onuData['status'] === 'Online') ? 'active' : 'inactive',
                            ]);
                    }
                }

                // Clear web API fast cache so all frontend users get the latest DB snapshot immediately
                $cacheKey = "olt_hardware_api_{$device->vendor_key}_{$device->id}";
                \Illuminate\Support\Facades\Cache::forget($cacheKey);

                $this->info("Successfully updated database telemetry snapshot for {$device->name}.");
            } catch (\Exception $e) {
                $this->error("Failed to poll OLT {$device->name}: " . $e->getMessage());
                Log::warning("OLT Telemetry Polling failed for {$device->name}: " . $e->getMessage());
            }
        }

        return 0;
    }
}
