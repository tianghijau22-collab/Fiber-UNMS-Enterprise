<?php

namespace App\Enums;

enum TicketPriority: string
{
    case LOW = 'low';
    case MEDIUM = 'medium';
    case HIGH = 'high';
    case CRITICAL = 'critical';

    public function label(): string
    {
        return match($this) {
            self::LOW => 'Rendah (Low)',
            self::MEDIUM => 'Sedang (Medium)',
            self::HIGH => 'Tinggi (High)',
            self::CRITICAL => 'Darurat (Critical)',
        };
    }
}
