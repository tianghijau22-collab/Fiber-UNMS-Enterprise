<?php

namespace App\Enums;

enum DeviceStatus: string
{
    case ONLINE = 'online';
    case OFFLINE = 'offline';
    case WARNING = 'warning';
    case CRITICAL = 'critical';
    case MAINTENANCE = 'maintenance';
    case DAMAGED = 'damaged';
    case INACTIVE = 'inactive';

    public function label(): string
    {
        return match($this) {
            self::ONLINE => 'Online / Normal',
            self::OFFLINE => 'Offline',
            self::WARNING => 'Peringatan (Warning)',
            self::CRITICAL => 'Kritis (Critical)',
            self::MAINTENANCE => 'Perawatan (Maintenance)',
            self::DAMAGED => 'Rusak',
            self::INACTIVE => 'Nonaktif',
        };
    }
}
