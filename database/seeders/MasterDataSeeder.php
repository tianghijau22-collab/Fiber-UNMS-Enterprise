<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Division;
use App\Models\Designation;
use App\Models\Vendor;
use App\Models\Brand;
use App\Models\DeviceType;
use App\Models\CableType;
use App\Models\SplitterType;
use App\Models\ItemCategory;
use App\Models\ItemUnit;
use App\Models\ServicePackage;
use App\Models\Role;
use App\Models\Permission;

class MasterDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Divisions
        $divisions = [
            ['name' => 'Network Operations Center', 'code' => 'NOC', 'description' => ' pusat pengawasan jaringan'],
            ['name' => 'Field Technician', 'code' => 'TECH', 'description' => 'Tim teknisi lapangan'],
            ['name' => 'Customer Service', 'code' => 'CS', 'description' => 'Layanan pelanggan'],
            ['name' => 'Inventory', 'code' => 'INV', 'description' => 'Manajemen inventaris'],
            ['name' => 'Finance', 'code' => 'FIN', 'description' => 'Keuangan'],
            ['name' => 'Management', 'code' => 'MGT', 'description' => 'Manajemen perusahaan'],
        ];
        foreach ($divisions as $d) {
            Division::updateOrCreate(['code' => $d['code']], $d);
        }

        // Designations (Jabatan) per division example
        $designations = [
            ['division_code' => 'NOC', 'name' => 'NOC Manager', 'code' => 'NOC_MGR'],
            ['division_code' => 'TECH', 'name' => 'Field Engineer', 'code' => 'FIELD_ENG'],
            ['division_code' => 'CS', 'name' => 'Customer Support Rep', 'code' => 'CSR'],
        ];
        foreach ($designations as $des) {
            $division = Division::where('code', $des['division_code'])->first();
            if ($division) {
                $division->designations()->updateOrCreate(['code' => $des['code']], ['name' => $des['name']]);
            }
        }

        // Vendors
        $vendors = [
            ['name' => 'FiberMax', 'code' => 'FMAX', 'contact_person' => 'John Doe', 'phone' => '021-1234567', 'email' => 'contact@fibermax.co.id', 'is_active' => true],
            ['name' => 'OptiCable', 'code' => 'OPTC', 'contact_person' => 'Jane Smith', 'phone' => '021-7654321', 'email' => 'sales@opticable.com', 'is_active' => true],
        ];
        foreach ($vendors as $v) {
            Vendor::updateOrCreate(['code' => $v['code']], $v);
        }

        // Brands
        $brands = [
            ['name' => 'Huawei', 'slug' => 'huawei'],
            ['name' => 'Cisco', 'slug' => 'cisco'],
            ['name' => 'ZTE', 'slug' => 'zte'],
        ];
        foreach ($brands as $b) {
            Brand::updateOrCreate(['slug' => $b['slug']], $b);
        }

        // Device Types
        $deviceTypes = [
            ['name' => 'OLT', 'code' => 'OLT', 'category' => 'OLT', 'description' => 'Optical Line Terminal'],
            ['name' => 'ONT', 'code' => 'ONT', 'category' => 'ONT', 'description' => 'Optical Network Terminal'],
            ['name' => 'Router', 'code' => 'RTR', 'category' => 'ROUTER', 'description' => 'Customer router'],
            ['name' => 'Switch', 'code' => 'SW', 'category' => 'SWITCH', 'description' => 'Layer 2/3 switch'],
        ];
        foreach ($deviceTypes as $dt) {
            DeviceType::updateOrCreate(['code' => $dt['code']], $dt);
        }

        // Cable Types
        $cableTypes = [
            ['name' => 'ADSS 24 Core', 'core_capacity' => 24, 'jacket_color' => 'Black', 'installation_type' => 'Underground'],
            ['name' => 'ADSS 48 Core', 'core_capacity' => 48, 'jacket_color' => 'Black', 'installation_type' => 'Underground'],
            ['name' => 'Armored 12 Core', 'core_capacity' => 12, 'jacket_color' => 'Gray', 'installation_type' => 'Aerial'],
        ];
        foreach ($cableTypes as $ct) {
            CableType::updateOrCreate(['name' => $ct['name']], $ct);
        }

        // Splitter Types
        $splitters = [
            ['name' => 'PLC 1:2', 'ratio' => '1:2', 'input_ports' => 1, 'output_ports' => 2, 'loss_db' => 0.4],
            ['name' => 'PLC 1:4', 'ratio' => '1:4', 'input_ports' => 1, 'output_ports' => 4, 'loss_db' => 0.7],
            ['name' => 'PLC 1:8', 'ratio' => '1:8', 'input_ports' => 1, 'output_ports' => 8, 'loss_db' => 1.0],
        ];
        foreach ($splitters as $sp) {
            SplitterType::updateOrCreate(['ratio' => $sp['ratio']], $sp);
        }

        // Item Categories
        $categories = [
            ['name' => 'Fiber Optic Cable', 'code' => 'FO_CABLE'],
            ['name' => 'Splitter', 'code' => 'SPLITTER'],
            ['name' => 'Connector', 'code' => 'CONNECTOR'],
        ];
        foreach ($categories as $c) {
            ItemCategory::updateOrCreate(['code' => $c['code']], $c);
        }

        // Item Units
        $units = [
            ['name' => 'Piece', 'symbol' => 'pcs'],
            ['name' => 'Meter', 'symbol' => 'm'],
            ['name' => 'Roll', 'symbol' => 'rl'],
        ];
        foreach ($units as $u) {
            ItemUnit::updateOrCreate(['symbol' => $u['symbol']], $u);
        }

        // Service Packages (Internet)
        $packages = [
            ['name' => 'Home Basic 20Mbps', 'code' => 'HOME_20', 'speed_mbps' => 20, 'price' => 250000, 'is_active' => true],
            ['name' => 'Business Pro 100Mbps', 'code' => 'BUS_100', 'speed_mbps' => 100, 'price' => 900000, 'is_active' => true],
        ];
        foreach ($packages as $p) {
            ServicePackage::updateOrCreate(['code' => $p['code']], $p);
        }

        // Roles & Permissions (RBAC)
        $roles = [
            ['name' => 'Administrator', 'slug' => 'admin'],
            ['name' => 'Network Engineer', 'slug' => 'net_eng'],
            ['name' => 'Field Technician', 'slug' => 'tech'],
            ['name' => 'Customer Service', 'slug' => 'cs'],
        ];
        foreach ($roles as $r) {
            Role::updateOrCreate(['slug' => $r['slug']], $r);
        }

        $permissions = [
            ['name' => 'View Customers', 'slug' => 'view_customers', 'group' => 'customers'],
            ['name' => 'Edit Devices', 'slug' => 'edit_devices', 'group' => 'devices'],
            ['name' => 'Create Work Orders', 'slug' => 'create_workorders', 'group' => 'workorders'],
            ['name' => 'Assign Tickets', 'slug' => 'assign_tickets', 'group' => 'tickets'],
        ];
        foreach ($permissions as $p) {
            Permission::updateOrCreate(['slug' => $p['slug']], $p);
        }

        // Assign all permissions to admin role for demo purposes
        $adminRole = Role::where('slug', 'admin')->first();
        if ($adminRole) {
            $allPermissionIds = Permission::pluck('id')->toArray();
            $adminRole->permissions()->sync($allPermissionIds);
        }
    }
}
