<?php

namespace App\Enums;

enum CustomerStatus: string
{
    case DRAFT = 'draft';
    case PROSPECT = 'prospect';
    case SURVEY = 'survey';
    case INSTALLATION = 'installation';
    case ACTIVE = 'active';
    case SUSPENDED = 'suspended';
    case ISOLATED = 'isolated';
    case TERMINATED = 'terminated';

    public function label(): string
    {
        return match($this) {
            self::DRAFT => 'Draft',
            self::PROSPECT => 'Prospek',
            self::SURVEY => 'Survei',
            self::INSTALLATION => 'Instalasi',
            self::ACTIVE => 'Aktif',
            self::SUSPENDED => 'Ditangguhkan',
            self::ISOLATED => 'Isolir',
            self::TERMINATED => 'Berhenti (Terminated)',
        };
    }
}
