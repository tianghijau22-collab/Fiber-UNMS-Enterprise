<?php

namespace App\Enums;

enum WorkOrderType: string
{
    case SURVEY = 'survey';
    case INSTALLATION = 'installation';
    case TROUBLESHOOTING = 'troubleshooting';
    case MAINTENANCE = 'maintenance';
    case RELOCATION = 'relocation';
    case UPGRADE_DOWNGRADE = 'upgrade_downgrade';
    case DISMANTLE = 'dismantle';

    public function label(): string
    {
        return match($this) {
            self::SURVEY => 'Survei Lokasi',
            self::INSTALLATION => 'Pemasangan Baru (PSB)',
            self::TROUBLESHOOTING => 'Penanganan Gangguan',
            self::MAINTENANCE => 'Perawatan Jaringan',
            self::RELOCATION => 'Relokasi Layanan',
            self::UPGRADE_DOWNGRADE => 'Perubahan Paket',
            self::DISMANTLE => 'Pencabutan Layanan',
        };
    }
}
