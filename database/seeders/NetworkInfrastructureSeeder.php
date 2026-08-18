<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\NetworkSplitter;
use App\Models\NetworkCable;
use App\Models\NetworkCableCore;
use App\Models\OntRegistration;
use App\Models\Brand;
use App\Models\DeviceType;
use App\Models\SplitterType;
use App\Models\CableType;
use App\Models\CustomerService;

class NetworkInfrastructureSeeder extends Seeder
{
    public function run(): void
    {
        $huawei   = Brand::where('slug', 'huawei')->first();
        $olt_type = DeviceType::where('code', 'OLT')->first();
        $ont_type = DeviceType::where('code', 'ONT')->first();

        // ── 1. OLT (Optical Line Terminal) ─────────────────────────────────────
        $olt = NetworkNode::create([
            'name'           => 'OLT Jakarta Selatan 01',
            'code'           => 'OLT-JKS-01',
            'node_type'      => 'OLT',
            'device_type_id' => $olt_type?->id,
            'brand_id'       => $huawei?->id,
            'model'          => 'Huawei MA5800-X7',
            'serial_number'  => 'SN-OLT-2026-001',
            'status'         => 'active',
            'latitude'       => -6.2607,
            'longitude'      => 106.8130,
            'address'        => 'Gedung NOC, Jl. Gatot Subroto No. 1, Jakarta Selatan',
            'total_ports'    => 16,
            'used_ports'     => 2,
            'installed_at'   => now()->subYear()->toDateString(),
            'notes'          => 'OLT utama area Jakarta Selatan, kapasitas 16 port PON',
        ]);

        // Port-port PON pada OLT
        $oltPorts = [];
        for ($i = 1; $i <= 4; $i++) {
            $oltPorts[$i] = NetworkPort::create([
                'node_id'     => $olt->id,
                'port_number' => "PON-0/0/{$i}",
                'port_type'   => 'PON',
                'status'      => $i <= 2 ? 'used' : 'available',
            ]);
        }

        // ── 2. ODC (Optical Distribution Cabinet) ──────────────────────────────
        $odc = NetworkNode::create([
            'name'           => 'ODC Area Kebayoran Baru A',
            'code'           => 'ODC-KBY-A01',
            'node_type'      => 'ODC',
            'status'         => 'active',
            'latitude'       => -6.2440,
            'longitude'      => 106.7985,
            'address'        => 'Tiang depan Pasar Kebayoran Lama',
            'parent_node_id' => $olt->id,
            'total_ports'    => 144,
            'used_ports'     => 12,
            'installed_at'   => now()->subMonths(10)->toDateString(),
        ]);

        // Splitter 1:8 di dalam ODC
        $splitter8 = SplitterType::where('ratio', '1:8')->first();
        if ($splitter8) {
            NetworkSplitter::create([
                'node_id'          => $odc->id,
                'splitter_type_id' => $splitter8->id,
                'slot_position'    => 'Tray-1',
                'status'           => 'active',
                'installed_at'     => now()->subMonths(10)->toDateString(),
            ]);
        }

        // ── 3. ODP (Optical Distribution Point) ────────────────────────────────
        $odp = NetworkNode::create([
            'name'           => 'ODP Blok Melati 01',
            'code'           => 'ODP-KBY-A01-01',
            'node_type'      => 'ODP',
            'status'         => 'active',
            'latitude'       => -6.2460,
            'longitude'      => 106.8010,
            'address'        => 'Tiang No. 12, Jl. Melati',
            'parent_node_id' => $odc->id,
            'total_ports'    => 8,
            'used_ports'     => 2,
            'installed_at'   => now()->subMonths(8)->toDateString(),
        ]);

        // Splitter 1:4 di dalam ODP
        $splitter4 = SplitterType::where('ratio', '1:4')->first();
        if ($splitter4) {
            NetworkSplitter::create([
                'node_id'          => $odp->id,
                'splitter_type_id' => $splitter4->id,
                'slot_position'    => 'Slot-A',
                'status'           => 'active',
                'installed_at'     => now()->subMonths(8)->toDateString(),
            ]);
        }

        // ── 4. Kabel OLT → ODC ─────────────────────────────────────────────────
        $cableType = CableType::where('core_capacity', 48)->first()
            ?? CableType::first();

        $cableOltOdc = NetworkCable::create([
            'name'              => 'Kabel Feeder OLT-JKS-01 ke ODC-KBY-A01',
            'code'              => 'CAB-OLT01-ODC-A01',
            'cable_type_id'     => $cableType?->id ?? 1,
            'from_node_id'      => $olt->id,
            'to_node_id'        => $odc->id,
            'length_meters'     => 850.00,
            'core_count_total'  => 48,
            'core_count_used'   => 8,
            'installation_type' => 'Underground',
            'route_description' => 'Bawah tanah melalui Jl. Gatot Subroto – Jl. Kebayoran',
            'status'            => 'active',
            'installed_at'      => now()->subMonths(10)->toDateString(),
        ]);

        // Core-core kabel feeder
        $colors = ['Biru', 'Orange', 'Hijau', 'Coklat', 'Abu', 'Putih', 'Merah', 'Hitam'];
        for ($i = 1; $i <= 8; $i++) {
            NetworkCableCore::create([
                'cable_id'    => $cableOltOdc->id,
                'core_number' => $i,
                'color'       => $colors[$i - 1] ?? "Core-{$i}",
                'status'      => $i <= 2 ? 'used' : 'available',
            ]);
        }

        // ── 5. Kabel ODC → ODP ─────────────────────────────────────────────────
        $cableType12 = CableType::where('core_capacity', 12)->first()
            ?? CableType::first();

        $cableOdcOdp = NetworkCable::create([
            'name'              => 'Kabel Distribusi ODC-A01 ke ODP-A01-01',
            'code'              => 'CAB-ODC-A01-ODP01',
            'cable_type_id'     => $cableType12?->id ?? 1,
            'from_node_id'      => $odc->id,
            'to_node_id'        => $odp->id,
            'length_meters'     => 120.00,
            'core_count_total'  => 12,
            'core_count_used'   => 2,
            'installation_type' => 'Aerial',
            'route_description' => 'Kabel udara sepanjang Jl. Melati',
            'status'            => 'active',
            'installed_at'      => now()->subMonths(8)->toDateString(),
        ]);

        for ($i = 1; $i <= 4; $i++) {
            NetworkCableCore::create([
                'cable_id'    => $cableOdcOdp->id,
                'core_number' => $i,
                'color'       => $colors[$i - 1] ?? "Core-{$i}",
                'status'      => $i <= 2 ? 'used' : 'available',
            ]);
        }

        // ── 6. ONT Registration untuk pelanggan aktif ───────────────────────────
        $svc = CustomerService::where('status', 'active')->first();
        if ($svc && $oltPorts[1]) {
            OntRegistration::create([
                'customer_service_id' => $svc->id,
                'olt_port_id'         => $oltPorts[1]->id,
                'onu_serial'          => $svc->onu_serial ?? 'HW-ONT-00001234',
                'onu_mac'             => $svc->onu_mac   ?? 'AA:BB:CC:DD:EE:01',
                'onu_type'            => 'HG8310M',
                'profile_name'        => 'HOME_20MBPS',
                'vlan_id'             => '100',
                'status'              => 'active',
                'registered_at'       => now()->subDays(25),
                'last_online_at'      => now()->subMinutes(2),
                'rx_power'            => -18.50,
                'tx_power'            => 2.30,
                'notes'               => 'ONT pelanggan Budi Santoso, sinyal normal.',
            ]);
        }
    }
}
