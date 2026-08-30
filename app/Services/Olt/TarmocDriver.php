<?php

namespace App\Services\Olt;

class TarmocDriver implements OltDeviceDriverInterface {
    public function getDeviceInfo(): array {
        return [
            'vendor' => 'Tarmoc',
            'model' => 'TMC-OLT-EP8',
            'firmware' => 'v2.8.5',
            'uptime' => '30 days',
            'cpu_usage' => 19,
            'ram_usage' => 38,
            'temperature' => 39,
            'cards' => [
                ['slot' => 1, 'type' => 'EPON 8-Port', 'ports' => 8, 'status' => 'Online']
            ]
        ];
    }

    public function getPonPorts(): array {
        $ports = [];
        for ($port = 1; $port <= 8; $port++) {
            $ports[] = [
                'port_id' => "epon_0/{$port}",
                'slot' => 1,
                'port' => $port,
                'status' => 'Up',
                'tx_power_dbm' => 4.0,
                'registered_onus' => 40,
                'online_onus' => 39,
                'los_onus' => 1,
            ];
        }
        return $ports;
    }

    public function getOnuList(): array {
        return [
            [
                'onu_id' => 'TMC-EPON-801',
                'port' => 'epon_0/1',
                'customer_name' => 'Warnet Gaming 99',
                'serial_number' => 'TMCE88001122',
                'status' => 'Online',
                'rx_power' => -17.90,
                'tx_power' => 2.40,
                'distance_meters' => 610,
                'ip_address' => '10.10.60.10',
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
        return [];
    }

    public function authorizeOnu(string $serialNumber, string $profileId): bool {
        return true;
    }

    public function getOnuOpticalPower(string $serialNumber): array {
        return [
            'serial_number' => $serialNumber,
            'rx_power_dbm' => -17.90,
            'tx_power_dbm' => 2.40,
            'olt_rx_power_dbm' => -17.50,
            'voltage_v' => 3.30,
            'bias_current_ma' => 13.9,
            'temperature_c' => 38.5,
            'status' => 'Normal',
        ];
    }
}
