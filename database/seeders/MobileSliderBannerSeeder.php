<?php

namespace Database\Seeders;

use App\Models\MobileSliderBanner;
use Illuminate\Database\Seeder;

class MobileSliderBannerSeeder extends Seeder
{
    public function run(): void
    {
        $banners = [
            [
                'title'       => 'Promo Pasang Baru Fiber Optic FONA',
                'subtitle'    => 'Nikmati koneksi internet ultra cepat & stabil hingga 1 Gbps dengan gratis biaya aktivasi bulan ini.',
                'image_url'   => 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
                'badge_text'  => 'PROMO BULAN INI',
                'action_type' => 'none',
                'action_url'  => null,
                'is_active'   => true,
                'sort_order'  => 1,
            ],
            [
                'title'       => 'Sistem Monitoring UNMS 24/7',
                'subtitle'    => 'Pemantauan real-time status redaman OLT, ODP, dan trap alert otomatis demi kepuasan pelanggan.',
                'image_url'   => 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
                'badge_text'  => 'NETWORK 24/7',
                'action_type' => 'screen',
                'action_url'  => 'gis_map',
                'is_active'   => true,
                'sort_order'  => 2,
            ],
            [
                'title'       => 'FONA Mobile Enterprise v2.5',
                'subtitle'    => 'Dukungan scan ONT instan, topologi peta kabel GIS interaktif, dan notifikasi gangguan langsung.',
                'image_url'   => 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
                'badge_text'  => 'PEMBARUAN SISTEM',
                'action_type' => 'none',
                'action_url'  => null,
                'is_active'   => true,
                'sort_order'  => 3,
            ],
        ];

        foreach ($banners as $b) {
            MobileSliderBanner::firstOrCreate(
                ['title' => $b['title']],
                $b
            );
        }
    }
}
