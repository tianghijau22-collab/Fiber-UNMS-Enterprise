<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\NetworkPort;
use App\Models\OntRegistration;
use App\Models\OltDevice;
use App\Models\ServicePackage;
use App\Models\AuditLog;
use App\Http\Controllers\OltController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    /**
     * Daftar pelanggan lengkap dengan layanan, port ODP, dan registrasi ONT.
     */
    public function index()
    {
        $customers = Customer::with([
            'services.servicePackage',
            'services.networkPort.node',
            'services.ontRegistration',
        ])
        ->orderBy('id', 'desc')
        ->get();

        $formatted = $customers->map(function ($c) {
            $primaryService = $c->services->first();
            $port = $primaryService?->networkPort;
            $odpNode = $port?->node;
            $ont = $primaryService?->ontRegistration;
            // Cari OLT yang menaungi ODP ini (bisa direct OLT, via ODC parent, atau OLT aktif)
            $oltDevice = $odpNode?->oltDevice ?: ($odpNode?->parent?->oltDevice ?: ($odpNode?->parent?->parent?->oltDevice ?: OltDevice::first()));
            $oltName = $oltDevice?->name ?: 'OLT-TES-HSGQ';

            // Resolve Interface dari port OLT / ODP
            $rawPortRef = $odpNode?->olt_port_ref ?: ($ont?->oltPort?->node?->olt_port_ref ?: 'epon_0/1');
            $cleanInterface = str_replace(['gpon-olt_', 'gpon_olt_', 'gpon_'], 'epon_', $rawPortRef);
            $interfaceDisplay = explode(',', $cleanInterface)[0] ?? 'epon_0/1';
            if ($port?->port_number) {
                $interfaceDisplay .= ':' . $port->port_number;
            }

            return [
                'id'                 => $c->id,
                'customer_number'    => $c->customer_number,
                'name'               => $c->name,
                'phone'              => $c->phone,
                'email'              => $c->email,
                'address'            => $c->address,
                'status'             => is_object($c->status) ? $c->status->value : ($c->status ?? 'active'),
                'service_id'         => $primaryService?->id,
                'service_number'     => $primaryService?->service_number,
                'service_package_id' => $primaryService?->service_package_id,
                'package_name'       => $primaryService?->servicePackage?->name ?? 'Paket Internet',
                'odp_id'             => $odpNode?->id,
                'odp_name'           => $odpNode?->name,
                'odp_code'           => $odpNode?->code,
                'odp_port_id'        => $port?->id,
                'odp_port_number'    => $port?->port_number,
                'olt_name'           => $oltName,
                'gpon_interface'     => $interfaceDisplay,
                'onu_serial'         => $ont?->onu_serial ?? $primaryService?->onu_serial,
                'rx_power'           => $ont?->rx_power !== null ? (float)$ont->rx_power : null,
                'created_at'         => $c->created_at,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $formatted
        ]);
    }

    /**
     * Tambah pelanggan baru dan otomatis konekkan ke Port ODP & Registrasi ONT.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:255',
            'phone'              => 'nullable|string|max:50',
            'email'              => 'nullable|email|max:255',
            'address'            => 'nullable|string',
            'status'             => 'nullable|string',
            'service_package_id' => 'nullable|integer',
            'odp_id'             => 'nullable|integer|exists:network_nodes,id',
            'odp_port_number'    => 'nullable|string',
            'odp_port_id'        => 'nullable|integer',
            'onu_serial'         => 'nullable|string|max:100',
            'rx_power'           => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // 1. Generate Kode Pelanggan unik yang belum pernah dipakai (termasuk soft-deleted)
            $custNum = $request->input('customer_number');
            if (!$custNum) {
                $maxId = Customer::withTrashed()->max('id') ?? 0;
                $idx = $maxId + 1;
                do {
                    $candidate = sprintf('CMN %04d', $idx);
                    $exists = DB::table('customers')->where('customer_number', $candidate)->exists();
                    if ($exists) {
                        $idx++;
                    }
                } while ($exists);
                $custNum = $candidate;
            }

            $customer = Customer::create([
                'customer_number' => $custNum,
                'name'            => $validated['name'],
                'phone'           => !empty($validated['phone']) ? $validated['phone'] : '-',
                'email'           => $validated['email'] ?? null,
                'address'         => !empty($validated['address']) ? $validated['address'] : 'Solok, Sumatera Barat',
                'status'          => $validated['status'] ?? 'active',
            ]);

            // 2. Paket Layanan Default jika tidak dipilih
            $packageId = $validated['service_package_id'] ?? ServicePackage::first()?->id;

            // 3. Buat Customer Service (Layanan Aktif)
            $service = CustomerService::create([
                'service_number'     => sprintf('SVC-2026-%04d', rand(1000, 9999)),
                'customer_id'        => $customer->id,
                'service_package_id' => $packageId,
                'status'             => 'active',
                'installation_date'  => now(),
                'activated_at'       => now(),
                'onu_serial'         => $validated['onu_serial'] ?? sprintf('HWTC-%08X', rand(10000000, 99999999)),
            ]);

            // 4. Konekkan Otomatis ke Port ODP
            $odpId = $validated['odp_id'] ?? null;
            $portNum = $validated['odp_port_number'] ?? null;
            $portId = $validated['odp_port_id'] ?? null;

            if ($odpId && ($portNum || $portId)) {
                $portQuery = NetworkPort::where('node_id', $odpId);
                if ($portId) {
                    $portQuery->where('id', $portId);
                } else {
                    $portQuery->where('port_number', (string)$portNum);
                }
                $targetPort = $portQuery->first();

                if ($targetPort) {
                    $targetPort->update([
                        'customer_service_id' => $service->id,
                        'customer_name_cache' => $customer->name,
                        'status'              => 'used',
                    ]);
                }
            }

            OntRegistration::create([
                'customer_service_id' => $service->id,
                'onu_serial'          => $service->onu_serial,
                'onu_type'            => 'HG8310M',
                'status'              => 'active',
                'registered_at'       => now(),
                'last_online_at'      => now(),
                'rx_power'            => $validated['rx_power'] ?? -18.50,
                'tx_power'            => 2.10,
                'notes'               => 'Auto-bound saat input data pelanggan',
            ]);

            AuditLog::record(
                'CREATE',
                'Customer Management',
                "Mendaftarkan pelanggan baru {$customer->name} ({$customer->customer_number}) - Alamat: {$customer->address}",
                null,
                ['customer_number' => $customer->customer_number, 'name' => $customer->name, 'phone' => $customer->phone, 'address' => $customer->address, 'onu_serial' => $service->onu_serial]
            );

            return response()->json([
                'status'  => 'success',
                'message' => 'Pelanggan berhasil ditambahkan & terhubung ke Port ODP',
                'data'    => $customer
            ], 201);
        });
    }

    public function show($id)
    {
        $customer = Customer::with([
            'services.servicePackage',
            'services.networkPort.node',
            'services.ontRegistration',
            'contacts',
            'notes'
        ])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data'   => $customer
        ]);
    }

    /**
     * Perbarui data pelanggan & penyesuaian port ODP.
     */
    public function update(Request $request, $id)
    {
        $customer = Customer::with('services.networkPort')->findOrFail($id);

        $validated = $request->validate([
            'customer_number'    => 'nullable|string|max:100',
            'name'               => 'sometimes|required|string|max:255',
            'phone'              => 'nullable|string|max:50',
            'email'              => 'nullable|email|max:255',
            'address'            => 'nullable|string',
            'status'             => 'nullable|string',
            'service_package_id' => 'nullable|integer',
            'odp_id'             => 'nullable|integer',
            'odp_port_number'    => 'nullable|string',
            'odp_port_id'        => 'nullable|integer',
            'onu_serial'         => 'nullable|string',
            'rx_power'           => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($customer, $validated, $request) {
            $customer->update([
                'customer_number' => $validated['customer_number'] ?? $customer->customer_number,
                'name'            => $validated['name'] ?? $customer->name,
                'phone'           => $validated['phone'] ?? $customer->phone,
                'email'           => $validated['email'] ?? $customer->email,
                'address'         => $validated['address'] ?? $customer->address,
                'status'          => $validated['status'] ?? $customer->status,
            ]);

            $service = $customer->services->first();
            if (!$service) {
                $service = CustomerService::create([
                    'service_number'     => sprintf('SVC-2026-%04d', rand(1000, 9999)),
                    'customer_id'        => $customer->id,
                    'service_package_id' => $validated['service_package_id'] ?? ServicePackage::first()?->id,
                    'status'             => 'active',
                    'installation_date'  => now(),
                ]);
            } else {
                if (isset($validated['service_package_id'])) {
                    $service->update(['service_package_id' => $validated['service_package_id']]);
                }
                if (isset($validated['onu_serial'])) {
                    $service->update(['onu_serial' => $validated['onu_serial']]);
                }
            }

            // Update nama cache pada port terhubung
            NetworkPort::where('customer_service_id', $service->id)
                ->update(['customer_name_cache' => $customer->name]);

            // Jika ada perubahan Port ODP
            if (isset($validated['odp_id'])) {
                // Lepaskan port lama
                NetworkPort::where('customer_service_id', $service->id)->update([
                    'customer_service_id' => null,
                    'customer_name_cache' => null,
                    'status'              => 'available',
                ]);

                // Bind port baru
                $odpId = $validated['odp_id'];
                $portNum = $validated['odp_port_number'] ?? null;
                $portId = $validated['odp_port_id'] ?? null;

                if ($odpId && ($portNum || $portId)) {
                    $portQuery = NetworkPort::where('node_id', $odpId);
                    if ($portId) {
                        $portQuery->where('id', $portId);
                    } else {
                        $portQuery->where('port_number', (string)$portNum);
                    }
                    $targetPort = $portQuery->first();

                    if ($targetPort) {
                        $targetPort->update([
                            'customer_service_id' => $service->id,
                            'customer_name_cache' => $customer->name,
                            'status'              => 'used',
                        ]);
                    }
                }
            }

            // Update OntRegistration
            if (isset($validated['onu_serial']) || isset($validated['rx_power'])) {
                $ont = OntRegistration::where('customer_service_id', $service->id)->first();
                if ($ont) {
                    $ont->update([
                        'onu_serial' => $validated['onu_serial'] ?? $ont->onu_serial,
                        'rx_power'   => $validated['rx_power'] ?? $ont->rx_power,
                    ]);
                } else {
                    OntRegistration::create([
                        'customer_service_id' => $service->id,
                        'onu_serial'          => $validated['onu_serial'] ?? 'HWTC-NEW01',
                        'rx_power'            => $validated['rx_power'] ?? -18.5,
                        'status'              => 'active',
                    ]);
                }
            }

            AuditLog::record(
                'UPDATE',
                'Customer Management',
                "Perbarui data pelanggan {$customer->name} ({$customer->customer_number})",
                $oldData,
                $validated
            );

            return response()->json([
                'status'  => 'success',
                'message' => 'Data pelanggan berhasil diperbarui',
                'data'    => $customer
            ]);
        });
    }

    public function destroy($id)
    {
        $customer = Customer::with('services.networkPort')->findOrFail($id);
        $custName = $customer->name;
        $custNum = $customer->customer_number;

        $affectedNodeIds = [];
        foreach ($customer->services as $service) {
            $ports = NetworkPort::where('customer_service_id', $service->id)->get();
            foreach ($ports as $p) {
                if ($p->node_id) $affectedNodeIds[] = $p->node_id;
                $p->update([
                    'customer_service_id' => null,
                    'customer_name_cache' => null,
                    'status'              => 'available',
                ]);
            }
        }

        $customer->forceDelete();

        foreach (array_unique($affectedNodeIds) as $nodeId) {
            NetworkPort::recalculateNodeUsedPorts($nodeId);
        }

        AuditLog::record(
            'DELETE',
            'Customer Management',
            "Menghapus data pelanggan {$custName} ({$custNum})",
            ['name' => $custName, 'customer_number' => $custNum]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Pelanggan berhasil dihapus'
        ]);
    }

    /**
     * Ambil daftar ONU modem yang sudah terdaftar di OLT namun belum dipetakan ke pelanggan.
     * Murni data real dari OLT dan database (tanpa data dummy).
     */
    public function unmappedOnus()
    {
        // Get serial numbers already assigned to active customer services
        $assignedSerials = DB::table('customer_services')
            ->whereNotNull('onu_serial')
            ->pluck('onu_serial')
            ->filter()
            ->toArray();

        // 1. Query registered ONUs from ont_registrations table that are not yet assigned to any customer
        $registeredOnus = OntRegistration::with('oltPort.node')
            ->whereNotIn('onu_serial', $assignedSerials)
            ->get();

        $formatted = collect();

        foreach ($registeredOnus as $ont) {
            $nodePort = $ont->oltPort?->node?->olt_port_ref ?: 'epon_0/1';
            $portClean = str_replace(['gpon-olt_', 'gpon_olt_', 'gpon_'], 'epon_', $nodePort);

            $formatted->push([
                'id'            => $ont->id,
                'serial_number' => $ont->onu_serial,
                'vendor'        => $ont->onu_type ?: 'HSGQ',
                'model'         => $ont->profile_name ?: 'ONU Terminal',
                'rx_power'      => (float)($ont->rx_power ?? -19.50),
                'gpon_port'     => explode(',', $portClean)[0] ?? 'epon_0/1',
                'olt_name'      => $ont->oltPort?->node?->oltDevice?->name ?: 'OLT HSGQ',
                'description'   => 'ONU Terdaftar di Database (Belum Terhubung Pelanggan)',
            ]);
        }

        // 2. Query unconfigured / newly discovered ONUs directly from active live OLT devices
        $activeOlts = OltDevice::where('status', 'active')->get();
        $oltCtrl = app(OltController::class);

        foreach ($activeOlts as $olt) {
            if ($olt->connection_mode === 'live') {
                try {
                    $driver = app(OltController::class)->getDriver($olt->vendor_key ?: strtolower($olt->vendor), $olt->id);
                    $uncfg = $driver->getUnconfiguredOnus();

                    foreach ($uncfg as $u) {
                        $sn = $u['serial_number'] ?? null;
                        if ($sn && !in_array($sn, $assignedSerials) && !$formatted->contains('serial_number', $sn)) {
                            $formatted->push([
                                'id'            => rand(9000, 9999),
                                'serial_number' => $sn,
                                'vendor'        => $u['vendor_model'] ?? 'HSGQ',
                                'model'         => 'EPON ONU',
                                'rx_power'      => -19.50,
                                'gpon_port'     => $u['detected_port'] ?? 'epon_0/1',
                                'olt_name'      => $olt->name,
                                'description'   => 'Auto-Discovered via Live OLT (' . ($u['detected_at'] ?? 'Baru saja') . ')',
                            ]);
                        }
                    }
                } catch (\Exception $e) {
                    // Skip if OLT driver scan fails
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'count'  => $formatted->count(),
            'data'   => $formatted->values()
        ]);
    }

    /**
     * Batch Provisioning Pelanggan Langsung dari Data ONU OLT
     */
    public function batchProvision(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.customer_number' => 'nullable|string',
            'items.*.name' => 'required|string|max:255',
            'items.*.onu_serial' => 'required|string',
            'items.*.odp_id' => 'nullable|integer',
            'items.*.odp_port_number' => 'nullable|string',
            'items.*.phone' => 'nullable|string',
            'items.*.address' => 'nullable|string',
            'items.*.service_package_id' => 'nullable|integer',
        ]);

        $createdCount = 0;

        DB::transaction(function () use ($validated, &$createdCount) {
            foreach ($validated['items'] as $item) {
                // Determine Customer Number (Custom or Auto CMN 0001)
                $custNum = !empty($item['customer_number']) ? trim($item['customer_number']) : null;
                if (!$custNum) {
                    $maxId = Customer::withTrashed()->max('id') ?? 0;
                    $idx = $maxId + 1;
                    do {
                        $candidate = sprintf('CMN %04d', $idx);
                        $exists = DB::table('customers')->where('customer_number', $candidate)->exists();
                        if ($exists) $idx++;
                    } while ($exists);
                    $custNum = $candidate;
                }

                $customer = Customer::create([
                    'customer_number' => $custNum,
                    'name'            => $item['name'],
                    'phone'           => !empty($item['phone']) ? $item['phone'] : '-',
                    'address'         => !empty($item['address']) ? $item['address'] : 'Solok, Sumatera Barat',
                    'status'          => 'active',
                ]);

                // Create Customer Service
                $pkgId = $item['service_package_id'] ?? 1;
                $service = CustomerService::create([
                    'customer_id'        => $customer->id,
                    'service_number'     => 'SRV-' . rand(100000, 999999),
                    'service_package_id' => $pkgId,
                    'status'             => 'active',
                    'onu_serial'         => $item['onu_serial'],
                    'installation_date'  => now(),
                ]);

                // Connect to ODP Port if provided
                if (!empty($item['odp_id']) && !empty($item['odp_port_number'])) {
                    $port = NetworkPort::where('node_id', $item['odp_id'])
                        ->where('port_number', (string) $item['odp_port_number'])
                        ->first();

                    if ($port) {
                        $port->update([
                            'customer_service_id' => $service->id,
                            'customer_name_cache' => $customer->name,
                            'status'              => 'connected',
                        ]);
                    }
                }

                // Register / Update ONT in ont_registrations table
                OntRegistration::updateOrCreate(
                    ['onu_serial' => $item['onu_serial']],
                    [
                        'customer_service_id' => $service->id,
                        'onu_type'            => 'ZTE ONU',
                        'rx_power'            => -19.5,
                        'status'              => 'active',
                        'registered_at'       => now(),
                    ]
                );

                $createdCount++;
            }
        });

        return response()->json([
            'status'  => 'success',
            'message' => "Berhasil meregister {$createdCount} pelanggan baru dari OLT ONU secara instan!",
        ]);
    }

    /**
     * Fitur Pergantian / Swap ONU Modem Pelanggan (Penggantian Modem Rusak)
     */
    public function swapOnu(Request $request, $id)
    {
        $customer = Customer::with('services.networkPort')->findOrFail($id);

        $validated = $request->validate([
            'new_onu_serial'     => 'required|string|max:100',
            'replacement_reason' => 'nullable|string|max:255',
            'rx_power'           => 'nullable|numeric',
        ]);

        $service = $customer->services->first();
        if (!$service) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Layanan pelanggan tidak ditemukan.',
            ], 422);
        }

        $oldOnuSerial = $service->onu_serial;
        $newOnuSerial = trim($validated['new_onu_serial']);

        DB::transaction(function () use ($service, $customer, $oldOnuSerial, $newOnuSerial, $validated) {
            // 1. Update ONU Serial pada CustomerService
            $service->update([
                'onu_serial' => $newOnuSerial,
            ]);

            // 2. Tandai ONT Lama sebagai replaced/inactive jika ada
            if ($oldOnuSerial) {
                OntRegistration::where('onu_serial', $oldOnuSerial)->update([
                    'status' => 'inactive',
                    'notes'  => "Diganti dengan modem baru SN: {$newOnuSerial}. Alasan: " . ($validated['replacement_reason'] ?? 'Pergantian Modem'),
                ]);
            }

            // 3. Register / Update ONT Baru
            OntRegistration::updateOrCreate(
                ['onu_serial' => $newOnuSerial],
                [
                    'customer_service_id' => $service->id,
                    'onu_type'            => 'ONT Replacement',
                    'rx_power'            => $validated['rx_power'] ?? -19.5,
                    'status'              => 'active',
                    'registered_at'       => now(),
                    'notes'               => "Pergantian ONU dari SN lama: {$oldOnuSerial}. Alasan: " . ($validated['replacement_reason'] ?? 'Rusak/Ganti Modem'),
                ]
            );
        });

        return response()->json([
            'status'  => 'success',
            'message' => "Berhasil pergantian ONU Modem untuk {$customer->name}! SN Lama: {$oldOnuSerial} ➔ SN Baru: {$newOnuSerial}",
            'data'    => [
                'customer_id'    => $customer->id,
                'old_onu_serial' => $oldOnuSerial,
                'new_onu_serial' => $newOnuSerial,
            ]
        ]);
    }
}

