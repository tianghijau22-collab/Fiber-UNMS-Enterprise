<?php

namespace App\Services\Olt;

class HiosoDriver implements OltDeviceDriverInterface {
    public function getDeviceInfo(): array {
        return [
            'vendor' => 'Hioso',
            'model' => 'HA7302CS',
            'firmware' => 'v4.0.2',
            'uptime' => '95 days',
            'cpu_usage' => 22,
            'ram_usage' => 40,
            'temperature' => 41,
            'cards' => [
                ['slot' => 1, 'type' => 'EPON 2-Port', 'ports' => 2, 'status' => 'Online']
            ]
        ];
    }

    public function getPonPorts(): array {
        return [
            ['port_id' => 'epon_0/1', 'slot' => 1, 'port' => 1, 'status' => 'Up', 'tx_power_dbm' => 3.8, 'registered_onus' => 45, 'online_onus' => 42, 'los_onus' => 3],
            ['port_id' => 'epon_0/2', 'slot' => 1, 'port' => 2, 'status' => 'Up', 'tx_power_dbm' => 3.7, 'registered_onus' => 38, 'online_onus' => 38, 'los_onus' => 0],
        ];
    }

    public function getOnuList(): array {
        return [
            [
                'onu_id' => 'HS-EPON-01',
                'port' => 'epon_0/1',
                'customer_name' => 'Toko Sembako Jaya',
                'serial_number' => 'HS7302001A',
                'status' => 'Online',
                'rx_power' => -22.40,
                'tx_power' => 1.80,
                'distance_meters' => 1420,
                'ip_address' => '10.10.40.12',
            ]
        ];
    }

    public function getOnuListByPort(string $portId): array {
        $cleanPortId = strtolower(trim($portId));
        $all = $this->getOnuList();
        return array_values(array_filter($all, function ($onu) use ($cleanPortId) {
            $p = strtolower($onu['port'] ?? '');
            return str_contains($p, $cleanPortId) || str_contains($cleanPortId, $p);
        }));
    }

    public function getUnconfiguredOnus(): array {
        return [
            [
                'serial_number' => 'HS7302999F',
                'port' => 'epon_0/1',
                'vendor' => 'Hioso',
                'model' => 'HA7200',
                'discovered_at' => now()->subMinutes(1)->toDateTimeString(),
            ]
        ];
    }

    public function authorizeOnu(string $serialNumber, string $profileId): bool {
        return true;
    }

    public function getOnuOpticalPower(string $serialNumber): array {
        return [
            'serial_number' => $serialNumber,
            'rx_power_dbm' => -22.40,
            'tx_power_dbm' => 1.80,
            'olt_rx_power_dbm' => -21.90,
            'voltage_v' => 3.25,
            'bias_current_ma' => 15.0,
            'temperature_c' => 43.0,
            'status' => 'Normal',
        ];
    }
}
