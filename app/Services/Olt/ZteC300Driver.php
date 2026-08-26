<?php

namespace App\Services\Olt;

/**
 * ZteC300Driver — Driver for ZTE ZXAN C300 Large Chassis OLT.
 *
 * Inherits all proven ZTE ZXROS GPON MIB query & decoding logic from ZteC320Driver,
 * with chassis card layout derived directly from detected interface ports.
 */
class ZteC300Driver extends ZteC320Driver
{
    public function getDeviceInfo(): array
    {
        $info = parent::getDeviceInfo();
        $info['model'] = 'ZXAN C300';
        if (isset($info['sys_name'])) {
            $info['sys_name'] = str_replace('C320', 'C300', $info['sys_name']);
        }
        $info['cards'] = $this->getChassisCards();
        return $info;
    }

    public function getChassisCards(): array
    {
        if ($this->snmp && $this->isLive) {
            $ifNames = $this->getIfNames();
            $detectedSlots = [];
            foreach ($ifNames as $name) {
                if (preg_match('/(?:gpon|epon)[_-](?:olt[_-])?(\d+)\/(\d+)/i', (string)$name, $m)) {
                    $slot = (int)$m[2];
                    $detectedSlots[$slot] = ($detectedSlots[$slot] ?? 0) + 1;
                }
            }

            if (!empty($detectedSlots)) {
                $cards = [];
                ksort($detectedSlots);
                foreach ($detectedSlots as $slot => $portCount) {
                    $cards[] = [
                        'slot'   => $slot,
                        'type'   => 'GTGH',
                        'ports'  => $portCount,
                        'status' => 'Online',
                    ];
                }
                // Tambahkan Control Board SCXN & Power Module
                $cards[] = ['slot' => 10, 'type' => 'SCXN', 'ports' => 4, 'status' => 'Control Board (Active)'];
                $cards[] = ['slot' => 11, 'type' => 'SCXN', 'ports' => 4, 'status' => 'Control Board (Standby)'];
                $cards[] = ['slot' => 19, 'type' => 'PRWG', 'ports' => 0, 'status' => 'Power Module'];
                return $cards;
            }
        }

        return [
            ['slot' => 2,  'type' => 'GTGH', 'ports' => 16, 'status' => 'Online'],
            ['slot' => 3,  'type' => 'GTGH', 'ports' => 16, 'status' => 'Online'],
            ['slot' => 4,  'type' => 'GTGH', 'ports' => 16, 'status' => 'Online'],
            ['slot' => 5,  'type' => 'GTGH', 'ports' => 16, 'status' => 'Online'],
            ['slot' => 6,  'type' => 'GTGH', 'ports' => 16, 'status' => 'Online'],
            ['slot' => 10, 'type' => 'SCXN', 'ports' => 4,  'status' => 'Control Board (Active)'],
            ['slot' => 11, 'type' => 'SCXN', 'ports' => 4,  'status' => 'Control Board (Standby)'],
            ['slot' => 19, 'type' => 'PRWG', 'ports' => 0,  'status' => 'Power Module'],
        ];
    }
}
