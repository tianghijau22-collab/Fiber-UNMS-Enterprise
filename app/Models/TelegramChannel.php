<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TelegramChannel extends Model
{
    use HasFactory;

    protected $table = 'telegram_channels';

    protected $fillable = [
        'name',
        'chat_id',
        'topics',
        'is_active',
        'description',
    ];

    protected $casts = [
        'topics'    => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Topik notifikasi yang didukung dalam sistem (Enterprise Professional Labels)
     */
    public const AVAILABLE_TOPICS = [
        'NOC' => [
            'label'       => 'NOC & Gangguan Jaringan',
            'description' => 'Alarm OLT Down, Fiber Cut, Redaman Optik Tinggi, LOS ONU',
            'color'       => 'rose',
        ],
        'TICKET' => [
            'label'       => 'Tiket & Penugasan Teknisi',
            'description' => 'Pembuatan Tiket Baru, Update Status, Penugasan Teknisi Jointer',
            'color'       => 'amber',
        ],
        'CUSTOMER' => [
            'label'       => 'Pelanggan & CRM',
            'description' => 'Registrasi Pelanggan Baru, Perubahan Paket, Swap ONU, Hapus Pelanggan',
            'color'       => 'emerald',
        ],
        'INFRASTRUCTURE' => [
            'label'       => 'Infrastruktur Jaringan',
            'description' => 'Manajemen Node ODC, ODP, POP, & Segmen Kabel Optik',
            'color'       => 'cyan',
        ],
        'OLT_MGMT' => [
            'label'       => 'Manajemen OLT',
            'description' => 'Pendaftaran OLT, Tes Koneksi SNMP/CLI, Otorisasi ONU, Port GPON',
            'color'       => 'indigo',
        ],
        'USER_MGMT' => [
            'label'       => 'Manajemen User & Akun',
            'description' => 'User Baru, Perubahan Hak Akses/Role, Reset Password, Audit Login',
            'color'       => 'violet',
        ],
        'BROADCAST' => [
            'label'       => 'Siaran Notifikasi Massal',
            'description' => 'Pengumuman Manual yang Dikirimkan Melalui Halaman Siaran Massal',
            'color'       => 'sky',
        ],
        'BILLING' => [
            'label'       => 'Billing & Keuangan',
            'description' => 'Status Tagihan, Pembayaran, dan Transaksi Layanan',
            'color'       => 'teal',
        ],
    ];
}
