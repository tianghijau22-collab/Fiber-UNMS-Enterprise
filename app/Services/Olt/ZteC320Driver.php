<?php

namespace App\Services\Olt;

class ZteC320Driver implements OltDeviceDriverInterface {
    public function getDeviceInfo(): array {
        return [
            'vendor' => 'ZTE',
            'model' => 'ZXAN C320',
            'firmware' => 'V2.1.0',
            'uptime' => '18 days, 6 hours',
            'cpu_usage' => 14,
            'ram_usage' => 35,
            'temperature' => 36,
            'cards' => [
                ['slot' => 1, 'type' => 'GTGO', 'ports' => 8, 'status' => 'Online'],
                ['slot' => 2, 'type' => 'SMXA', 'ports' => 2, 'status' => 'Control & Uplink'],
            ]
        ];
    }

    public function getPonPorts(): array {
        $ports = [];
        for ($port = 1; $port <= 8; $port++) {
            $ports[] = [
                'port_id' => "gpon-olt_1/1/{$port}",
                'slot' => 1,
                'port' => $port,
                'status' => 'Up',
                'tx_power_dbm' => 5.0,
                'registered_onus' => 32,
                'online_onus' => 30,
                'los_onus' => 2,
            ];
        }
        return $ports;
    }

    public function getOnuList(): array {
        return [
            [
                'onu_id' => 'ZTEG-D990011',
                'port' => 'gpon-olt_1/1/1',
                'customer_name' => 'Klinik Medika',
                'serial_number' => 'ZTEGD990011',
                'status' => 'Online',
                'rx_power' => -18.20,
                'tx_power' => 2.25,
                'distance_meters' => 520,
                'ip_address' => '10.10.30.5',
            ]
        ];
    }

    public function getUnconfiguredOnus(): array {
        return [];
    }

    public function authorizeOnu(string $serialNumber, string $profileId): bool {
        return true;
    }

    public function getOnuOpticalPower(string $serialNumber): array {
        return [
            'serial_number' => $serialNumber,
            'rx_power_dbm' => -18.20,
            'tx_power_dbm' => 2.25,
            'olt_rx_power_dbm' => -18.00,
            'voltage_v' => 3.30,
            'bias_current_ma' => 13.8,
            'temperature_c' => 39.0,
            'status' => 'Normal',
        ];
    }
}
