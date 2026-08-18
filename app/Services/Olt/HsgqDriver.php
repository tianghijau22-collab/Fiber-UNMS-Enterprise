<?php

namespace App\Services\Olt;

class HsgqDriver implements OltDeviceDriverInterface {
    public function getDeviceInfo(): array {
        return [
            'vendor' => 'HSGQ',
            'model' => 'G004 4-Port GPON',
            'firmware' => 'v3.2.1-build88',
            'uptime' => '12 days',
            'cpu_usage' => 25,
            'ram_usage' => 48,
            'temperature' => 45,
            'cards' => [
                ['slot' => 1, 'type' => 'GPON 4-Port', 'ports' => 4, 'status' => 'Online']
            ]
        ];
    }

    public function getPonPorts(): array {
        return [
            ['port_id' => 'gpon_0/1', 'slot' => 1, 'port' => 1, 'status' => 'Up', 'tx_power_dbm' => 4.2, 'registered_onus' => 64, 'online_onus' => 60, 'los_onus' => 4],
            ['port_id' => 'gpon_0/2', 'slot' => 1, 'port' => 2, 'status' => 'Up', 'tx_power_dbm' => 4.1, 'registered_onus' => 52, 'online_onus' => 52, 'los_onus' => 0],
            ['port_id' => 'gpon_0/3', 'slot' => 1, 'port' => 3, 'status' => 'Up', 'tx_power_dbm' => 4.0, 'registered_onus' => 48, 'online_onus' => 45, 'los_onus' => 3],
            ['port_id' => 'gpon_0/4', 'slot' => 1, 'port' => 4, 'status' => 'Up', 'tx_power_dbm' => 4.2, 'registered_onus' => 30, 'online_onus' => 28, 'los_onus' => 2],
        ];
    }

    public function getOnuList(): array {
        return [
            [
                'onu_id' => 'HSGQ-GP-101',
                'port' => 'gpon_0/1',
                'customer_name' => 'Warkop Barokah',
                'serial_number' => 'HSGQ8811AA01',
                'status' => 'Online',
                'rx_power' => -20.80,
                'tx_power' => 2.05,
                'distance_meters' => 980,
                'ip_address' => '10.10.50.21',
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
            'rx_power_dbm' => -20.80,
            'tx_power_dbm' => 2.05,
            'olt_rx_power_dbm' => -20.10,
            'voltage_v' => 3.31,
            'bias_current_ma' => 14.5,
            'temperature_c' => 40.2,
            'status' => 'Normal',
        ];
    }
}
