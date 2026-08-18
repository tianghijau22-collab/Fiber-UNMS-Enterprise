<?php

namespace App\Enums;

enum TicketStatus: string
{
    case OPEN = 'open';
    case ASSIGNED = 'assigned';
    case IN_PROGRESS = 'in_progress';
    case PENDING_VENDOR = 'pending_vendor';
    case RESOLVED = 'resolved';
    case CLOSED = 'closed';
    case CANCELLED = 'cancelled';

    public function label(): string
    {
        return match($this) {
            self::OPEN => 'Terbuka (Open)',
            self::ASSIGNED => 'Ditugaskan (Assigned)',
            self::IN_PROGRESS => 'Sedang Diproses',
            self::PENDING_VENDOR => 'Menunggu Vendor',
            self::RESOLVED => 'Selesai (Resolved)',
            self::CLOSED => 'Ditutup (Closed)',
            self::CANCELLED => 'Dibatalkan',
        };
    }
}
