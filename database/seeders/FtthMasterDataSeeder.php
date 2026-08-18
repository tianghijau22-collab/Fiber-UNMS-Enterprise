<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeder untuk data master splitter pasif dan tipe kabel fiber optik
 * sesuai standar FTTH Indonesia.
 *
 * KONFIGURASI SPLITTER PASIF UMUM:
 *
 * Konfigurasi A  →  1:2 (POP) → 1:8 (ODC) → 1:8 (ODP)
 *   = 2 × 8 × 8 = 128 client per port OLT/SFP
 *   = 16 ODP dengan interface PON yang sama
 *
 * Konfigurasi B  →  1:4 (ODC Induk) → 1:4 (ODC Anak) → 1:8 (ODP)
 *   = 4 × 4 × 8 = 128 client per port OLT/SFP
 *
 * TUBE & CORE MAPPING:
 *   6  core → 1 tube  (6 core/tube)
 *   12 core → 1 tube  (12 core/tube)  ATAU  2 tube (6 core/tube)
 *   24 core → 2 tube  (12 core/tube)  ATAU  4 tube (6 core/tube)
 *   48 core → 4 tube  (12 core/tube)  ATAU  8 tube (6 core/tube)
 */
class FtthMasterDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedSplitterTypes();
        $this->seedCableTypes();
    }

    private function seedSplitterTypes(): void
    {
        DB::table('network_splitters')->delete(); // hapus dependent dulu
        DB::table('splitter_types')->delete();

        $splitters = [
            // ─── Splitter Level 1 (POP / ODC Induk) ─────────────────────────
            [
                'name'         => 'PLC 1:2',
                'ratio'        => '1:2',
                'input_ports'  => 1,
                'output_ports' => 2,
                'loss_db'      => 3.40,
                'description'  => 'Level 1 — Dipasang di POP pada konfigurasi A (1:2→1:8→1:8). '
                                 . 'Membagi 1 core OLT menjadi 2 output ke 2 ODC.',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'name'         => 'PLC 1:4',
                'ratio'        => '1:4',
                'input_ports'  => 1,
                'output_ports' => 4,
                'loss_db'      => 6.90,
                'description'  => 'Level 1/2 — Dipasang di ODC Induk pada konfigurasi B (1:4→1:4→1:8). '
                                 . 'Membagi 1 core OLT menjadi 4 output ke 4 ODC Anak.',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],

            // ─── Splitter Level 2 (ODC / ODC Anak) ──────────────────────────
            [
                'name'         => 'PLC 1:8',
                'ratio'        => '1:8',
                'input_ports'  => 1,
                'output_ports' => 8,
                'loss_db'      => 10.30,
                'description'  => 'Level 2 — Dipasang di ODC pada konfigurasi A (1:2→1:8→1:8). '
                                 . 'Juga dipakai di ODC Anak pada konfigurasi B (1:4→1:4→1:8). '
                                 . 'Membagi ke 8 ODP.',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],

            // ─── Splitter Level 3 (ODP — last mile ke pelanggan) ─────────────
            [
                'name'         => 'PLC 1:8 ODP',
                'ratio'        => '1:8',
                'input_ports'  => 1,
                'output_ports' => 8,
                'loss_db'      => 10.30,
                'description'  => 'Level 3 — Dipasang di dalam ODP (last mile). '
                                 . 'Digunakan di kedua konfigurasi A & B. '
                                 . 'Membagi ke max 8 pelanggan (port drop ke ONT).',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'name'         => 'PLC 1:4 ODP',
                'ratio'        => '1:4',
                'input_ports'  => 1,
                'output_ports' => 4,
                'loss_db'      => 6.90,
                'description'  => 'Level 3 — ODP kapasitas kecil 4 port, digunakan di lokasi '
                                 . 'dengan kepadatan pelanggan rendah.',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],

            // ─── Splitter ekstra (cadangan / ekspansi) ───────────────────────
            [
                'name'         => 'PLC 1:16',
                'ratio'        => '1:16',
                'input_ports'  => 1,
                'output_ports' => 16,
                'loss_db'      => 13.50,
                'description'  => 'Splitter 1:16 — Umumnya dipasang di ODC besar '
                                 . 'menggantikan dua tingkat split (ODC+ODP dalam satu titik).',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'name'         => 'PLC 1:32',
                'ratio'        => '1:32',
                'input_ports'  => 1,
                'output_ports' => 32,
                'loss_db'      => 16.70,
                'description'  => 'Splitter 1:32 — Kapasitas besar, digunakan di gedung/apartemen '
                                 . 'dengan banyak unit.',
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
        ];

        DB::table('splitter_types')->insert($splitters);
        $this->command->info('  ✓ ' . count($splitters) . ' splitter types di-seed.');
    }

    private function seedCableTypes(): void
    {
        DB::table('network_cable_cores')->delete();
        DB::table('network_cables')->delete();
        DB::table('cable_types')->delete();

        $cables = [
            // ─── 6 Core ──────────────────────────────────────────────────────
            [
                'name'              => 'FTTH Drop Cable 6 Core Aerial',
                'core_capacity'     => 6,
                'tube_count'        => 1,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel feeder 6 core 1 tube — Aerial/udara. '
                                     . 'Digunakan untuk distribusi ODP→ODC jarak pendek.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Drop Cable 6 Core Underground',
                'core_capacity'     => 6,
                'tube_count'        => 1,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Underground',
                'description'       => 'Kabel 6 core 1 tube — Underground/galian. '
                                     . 'Armored, cocok untuk persilangan jalan.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],

            // ─── 12 Core ─────────────────────────────────────────────────────
            [
                'name'              => 'FTTH Cable 12 Core 1 Tube Aerial',
                'core_capacity'     => 12,
                'tube_count'        => 1,
                'cores_per_tube'    => 12,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel distribusi 12 core 1 tube — Aerial. '
                                     . 'Digunakan untuk jalur ODC→ODP.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Cable 12 Core 2 Tube Aerial',
                'core_capacity'     => 12,
                'tube_count'        => 2,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel distribusi 12 core 2 tube — Aerial. '
                                     . 'Setiap tube berisi 6 core.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Cable 12 Core 2 Tube Underground',
                'core_capacity'     => 12,
                'tube_count'        => 2,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Underground',
                'description'       => 'Kabel 12 core 2 tube — Underground/galian.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],

            // ─── 24 Core ─────────────────────────────────────────────────────
            [
                'name'              => 'FTTH Cable 24 Core 2 Tube Aerial',
                'core_capacity'     => 24,
                'tube_count'        => 2,
                'cores_per_tube'    => 12,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel feeder 24 core 2 tube — Aerial. '
                                     . 'Digunakan untuk jalur utama POP→ODC.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Cable 24 Core 4 Tube Aerial',
                'core_capacity'     => 24,
                'tube_count'        => 4,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel distribusi 24 core 4 tube — Aerial. '
                                     . 'Setiap tube berisi 6 core.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Cable 24 Core 4 Tube Underground',
                'core_capacity'     => 24,
                'tube_count'        => 4,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Underground',
                'description'       => 'Kabel 24 core 4 tube — Underground/duct.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],

            // ─── 48 Core ─────────────────────────────────────────────────────
            [
                'name'              => 'FTTH Backbone 48 Core 4 Tube Aerial',
                'core_capacity'     => 48,
                'tube_count'        => 4,
                'cores_per_tube'    => 12,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel backbone 48 core 4 tube — Aerial. '
                                     . 'Jalur utama OLT→POP atau antar POP.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Backbone 48 Core 8 Tube Aerial',
                'core_capacity'     => 48,
                'tube_count'        => 8,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Aerial',
                'description'       => 'Kabel backbone 48 core 8 tube — Aerial. '
                                     . 'Setiap tube berisi 6 core.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Backbone 48 Core 4 Tube Underground',
                'core_capacity'     => 48,
                'tube_count'        => 4,
                'cores_per_tube'    => 12,
                'jacket_color'      => 'Black',
                'installation_type' => 'Underground',
                'description'       => 'Kabel backbone 48 core 4 tube — Underground/duct. '
                                     . 'Armored, untuk jalur utama.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
            [
                'name'              => 'FTTH Backbone 48 Core 8 Tube Underground',
                'core_capacity'     => 48,
                'tube_count'        => 8,
                'cores_per_tube'    => 6,
                'jacket_color'      => 'Black',
                'installation_type' => 'Underground',
                'description'       => 'Kabel backbone 48 core 8 tube — Underground. '
                                     . 'Kapasitas besar untuk area padat.',
                'created_at'        => now(),
                'updated_at'        => now(),
            ],
        ];

        DB::table('cable_types')->insert($cables);
        $this->command->info('  ✓ ' . count($cables) . ' cable types di-seed.');
    }
}
