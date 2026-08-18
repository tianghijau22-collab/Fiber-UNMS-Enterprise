<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\NetworkNode;
use App\Models\Customer;
use App\Models\NetworkPort;

class FiberUnmsSeeder extends Seeder
{
    public function run()
    {
        // 1. Seed Network Nodes
        $olt = NetworkNode::create([
            'name' => 'OLT Central Manggarai',
            'code' => 'OLT-MGR-01',
            'node_type' => 'OLT',
            'model' => 'Huawei MA5800-X7',
            'status' => 'active',
            'latitude' => -6.2088,
            'longitude' => 106.8456,
            'address' => 'Gedung NOC Central, Jl. Manggarai No. 12',
            'total_ports' => 16,
            'used_ports' => 4,
            'notes' => 'Primary OLT Core Router'
        ]);

        $odc1 = NetworkNode::create([
            'name' => 'ODC Perumahan Asri A',
            'code' => 'ODC-MGR-01',
            'node_type' => 'ODC',
            'model' => 'Outdoor Cabinet 288 Core',
            'status' => 'active',
            'latitude' => -6.2110,
            'longitude' => 106.8480,
            'address' => 'Jl. Asri Raya Blok A',
            'parent_node_id' => $olt->id,
            'total_ports' => 288,
            'used_ports' => 64,
            'notes' => 'ODC Feeder Area A'
        ]);

        $odp1 = NetworkNode::create([
            'name' => 'ODP Asri RT 01',
            'code' => 'ODP-MGR-01',
            'node_type' => 'ODP',
            'model' => 'ODP Pole 1:8',
            'status' => 'active',
            'latitude' => -6.2125,
            'longitude' => 106.8495,
            'address' => 'Tiang No. 04 Jl. Asri RT 01',
            'parent_node_id' => $odc1->id,
            'total_ports' => 8,
            'used_ports' => 6,
            'notes' => 'Splitter 1:8 Installed'
        ]);

        $odp2 = NetworkNode::create([
            'name' => 'ODP Asri RT 02',
            'code' => 'ODP-MGR-02',
            'node_type' => 'ODP',
            'model' => 'ODP Pole 1:8',
            'status' => 'active',
            'latitude' => -6.2138,
            'longitude' => 106.8510,
            'address' => 'Tiang No. 12 Jl. Asri RT 02',
            'parent_node_id' => $odc1->id,
            'total_ports' => 8,
            'used_ports' => 4,
            'notes' => 'Splitter 1:8 Installed'
        ]);

        $odp3 = NetworkNode::create([
            'name' => 'ODP Melati RT 05',
            'code' => 'ODP-MGR-04',
            'node_type' => 'ODP',
            'model' => 'ODP Aerial 1:16',
            'status' => 'maintenance',
            'latitude' => -6.2150,
            'longitude' => 106.8530,
            'address' => 'Pertigaan Melati Indah',
            'parent_node_id' => $odc1->id,
            'total_ports' => 16,
            'used_ports' => 12,
            'notes' => 'Under investigation for High Loss'
        ]);

        // 2. Seed Customers
        Customer::create([
            'customer_number' => 'CUST-2026-001',
            'name' => 'Budi Santoso',
            'phone' => '081234567890',
            'email' => 'budi.santoso@example.com',
            'address' => 'Perumahan Asri Blok A No. 10',
            'latitude' => -6.2128,
            'longitude' => 106.8498,
            'nik' => '3171012345670001',
            'status' => 'active'
        ]);

        Customer::create([
            'customer_number' => 'CUST-2026-002',
            'name' => 'Siti Rahma',
            'phone' => '082198765432',
            'email' => 'siti.rahma@example.com',
            'address' => 'Perumahan Asri Blok B No. 05',
            'latitude' => -6.2140,
            'longitude' => 106.8512,
            'nik' => '3171012345670002',
            'status' => 'active'
        ]);

        Customer::create([
            'customer_number' => 'CUST-2026-003',
            'name' => 'PT Maju Bersama',
            'phone' => '0215551234',
            'email' => 'info@majubersama.co.id',
            'address' => 'Ruko Melati Indah No. 1',
            'latitude' => -6.2152,
            'longitude' => 106.8533,
            'nik' => '3171012345670003',
            'status' => 'active'
        ]);
    }
}
