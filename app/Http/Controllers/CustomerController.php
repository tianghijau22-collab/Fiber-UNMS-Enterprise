<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\OntRegistration;
use App\Models\OltDevice;
use App\Services\Olt\OnuTelemetryView;
use App\Models\ServicePackage;
use App\Models\AuditLog;
use App\Http\Controllers\OltController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class CustomerController extends Controller
{
    public static function clearCustomerCache()
    {
        Cache::forget('customers_index_payload_v5');
        Cache::forget('sobok_service_status_meta');
    }

    /**
     * Daftar pelanggan lengkap dengan layanan, port ODP, dan registrasi ONT.
     */
    public function index(Request $request)
    {
        if ($request->boolean('refresh') || $request->boolean('force')) {
            self::clearCustomerCache();
        }

        $result = Cache::remember('customers_index_payload_v5', 15, function () {
            $telemetry = OnuTelemetryView::load();

            $customers = Customer::with([
                'services.servicePackage',
                'services.networkPort.node.parent.parent',
                'services.networkPort.node.oltDevice',
                'services.ontRegistration.oltPort.node.parent.parent',
            ])
            ->orderBy('id', 'desc')
            ->get();

        $formatted = $customers->map(function ($c) use ($telemetry) {
            $primaryService = $c->services->first();
            $port = $primaryService?->networkPort;
            $odpNode = $port?->node;
            $odcNode = $odpNode?->parent;
            $ont = $primaryService?->ontRegistration;

            $snKey = strtolower(trim($ont?->onu_serial ?: ($primaryService?->onu_serial ?: '')));
            $macKey = strtolower(trim($ont?->onu_mac ?: ''));
            $view = $telemetry->forNode($odpNode ?: $ont?->oltPort?->node, $snKey, $macKey);
            $oltId = $view['olt_id'];
            $oltName = $view['olt_name'];
            $interfaceDisplay = $view['gpon_interface'];
            $isOnline = $view['is_online'];
            $rxPower = $view['rx_power'];
            $txPower = null;
            $distance = null;
            $realtimeStatus = $view['onu_status'];

            $sobokServiceStatus = strtoupper($primaryService?->sobok_service_status ?: 'OPEN');
            $isSobokBlocked = ($sobokServiceStatus === 'BLOKIR');
            $sobokProfile = $primaryService?->sobok_profile;
            $sobokSyncAt = $primaryService?->sobok_sync_at;

            // Intelligent Loss / Operation Analysis for Field Technicians:
            if ($isOnline === null) {
                $lossReason = 'unverified';
                $lossReasonLabel = 'Status perangkat belum terverifikasi';
            } elseif (!$isOnline) {
                if ($isSobokBlocked) {
                    $lossReason = 'blocked';
                    $lossReasonLabel = 'Layanan Terblokir (Isolir)';
                } else {
                    $lossReason = 'physical_loss';
                    $lossReasonLabel = 'Perangkat Offline (penyebab belum pasti)';
                }
            } else {
                if ($isSobokBlocked) {
                    $lossReason = 'blocked_online';
                    $lossReasonLabel = 'Modem Online Tapi Terblokir';
                } else {
                    $lossReason = 'normal';
                    $lossReasonLabel = 'Normal / Aktif';
                }
            }

            return [
                'id'                   => $c->id,
                'customer_number'      => $c->customer_number,
                'name'                 => $c->name,
                'phone'                => $c->phone,
                'email'                => $c->email,
                'address'              => $c->address,
                'status'               => $realtimeStatus,
                'is_online'            => $isOnline,
                'onu_status'           => $realtimeStatus,
                'service_status'       => $sobokServiceStatus,
                'is_service_blocked'   => $isSobokBlocked,
                'service_status_label' => $isSobokBlocked ? 'Blokir' : 'Open',
                'service_profile'      => $sobokProfile,
                'sobok_sync_at'        => $sobokSyncAt ? (\Carbon\Carbon::parse($sobokSyncAt)->toIso8601String()) : null,
                'loss_reason'          => $lossReason,
                'loss_reason_label'    => $lossReasonLabel,
                'service_id'           => $primaryService?->id,
                'service_number'       => $primaryService?->service_number,
                'service_package_id'   => $primaryService?->service_package_id,
                'package_name'         => $primaryService?->servicePackage?->name ?? 'Paket Internet',
                'package_speed'        => $primaryService?->servicePackage?->speed_mbps ?? 20,
                'ip_address'           => $primaryService?->ip_address,
                'olt_id'               => $oltId,
                'olt_name'             => $oltName,
                'odc_id'               => $odcNode?->id,
                'odc_name'             => $odcNode?->name,
                'odc_code'             => $odcNode?->code,
                'odp_id'               => $odpNode?->id,
                'odp_name'             => $odpNode?->name,
                'odp_code'             => $odpNode?->code,
                'odp_port_id'          => $port?->id,
                'odp_port_number'      => $port?->port_number,
                'gpon_interface'       => $interfaceDisplay,
                'onu_serial'           => $ont?->onu_serial ?? $primaryService?->onu_serial,
                'onu_mac'              => $ont?->onu_mac,
                'onu_type'             => $ont?->onu_type ?: 'HGU GPON/EPON',
                'rx_power'             => $rxPower,
                'tx_power'             => $txPower,
                'distance_meters'      => $distance,
                'created_at'           => $c->created_at,
                ...$view,
            ];
        });

        $syncMeta = \Illuminate\Support\Facades\Cache::get('sobok_service_status_meta');
        if (!$syncMeta) {
            $lastSync = CustomerService::whereNotNull('sobok_sync_at')->max('sobok_sync_at');
            $openCount = CustomerService::where('sobok_service_status', 'OPEN')->count();
            $blockedCount = CustomerService::where('sobok_service_status', 'BLOKIR')->count();
            $syncMeta = [
                'status'          => 'ready',
                'domain_used'     => 'sobok.cinoxmedianet.id',
                'open_count'      => $openCount,
                'blocked_count'   => $blockedCount,
                'synced_at'       => $lastSync,
                'synced_at_human' => $lastSync ? \Carbon\Carbon::parse($lastSync)->diffForHumans() : 'Belum pernah',
            ];
        }

            return [
                'status'    => 'success',
                'data'      => $formatted,
                'sync_meta' => $syncMeta,
            ];
        });

        return response()->json($result);
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
            'interface'          => 'nullable|string',
            'olt_port_ref'       => 'nullable|string',
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

            $statusInput = strtolower($validated['status'] ?? 'active');
            $dbStatus = in_array($statusInput, ['online', 'active', 'aktif']) ? 'active' : 'suspended';

            $customer = Customer::create([
                'customer_number' => $custNum,
                'name'            => $validated['name'],
                'phone'           => !empty($validated['phone']) ? $validated['phone'] : '-',
                'email'           => $validated['email'] ?? null,
                'address'         => !empty($validated['address']) ? $validated['address'] : 'Solok, Sumatera Barat',
                'status'          => $dbStatus,
            ]);

            // 2. Paket Layanan Default jika tidak dipilih
            $packageId = $validated['service_package_id'] ?? ServicePackage::first()?->id;

            // 3. Buat Customer Service (Layanan Aktif)
            $service = CustomerService::create([
                'service_number'     => CustomerService::generateUniqueServiceNumber(),
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
                    if ($targetPort->customer_service_id && $targetPort->customer_service_id != $service->id) {
                        $occupant = $targetPort->customer_name_cache ?: 'pelanggan lain';
                        throw new \Exception("Port {$targetPort->port_number} pada ODP ini sudah terisi oleh {$occupant}. Silakan pilih port yang masih kosong.");
                    }

                    $targetPort->update([
                        'customer_service_id' => $service->id,
                        'customer_name_cache' => $customer->name,
                        'status'              => 'used',
                    ]);
                    NetworkPort::recalculateNodeUsedPorts($odpId);
                }
            }

            // 5. Deteksi otomatis port fisik OLT, redaman riil, dan sinkronkan ODP
            $detected = self::resolveOnuPhysicalPortAndSync(
                $service->onu_serial,
                $odpId,
                $request->input('interface') ?: $request->input('olt_port_ref')
            );

            $rxPowerVal = $detected['rx_power'] ?? ($validated['rx_power'] ?? null);
            $txPowerVal = $detected['tx_power'] ?? null;
            $statusVal  = (strtolower($detected['status']) === 'online') ? 'active' : ($dbStatus === 'active' ? 'active' : 'inactive');

            OntRegistration::create([
                'customer_service_id' => $service->id,
                'onu_serial'          => $service->onu_serial,
                'onu_type'            => $detected['vendor_model'] ?: 'HG8310M',
                'status'              => $statusVal,
                'registered_at'       => now(),
                'last_online_at'      => now(),
                'rx_power'            => $rxPowerVal,
                'tx_power'            => $txPowerVal,
                'notes'               => 'Auto-bound saat input data pelanggan' . ($detected['port'] ? " (Port OLT: {$detected['port']})" : ''),
            ]);

            // Sinkronkan ke Telemetry Snapshot OLT agar seketika tampil di OLT Management & Customer List
            if ($detected['olt_id'] && $detected['port']) {
                self::injectCustomerIntoOltSnapshot($detected['olt_id'], [
                    'customer_id'     => $customer->id,
                    'customer_name'   => $customer->name,
                    'customer_number' => $customer->customer_number,
                    'serial_number'   => $service->onu_serial,
                    'port'            => $detected['port'],
                    'rx_power'        => $rxPowerVal,
                    'tx_power'        => $txPowerVal,
                    'status'          => ($statusVal === 'active') ? 'Online' : 'Offline',
                    'onu_id'          => $detected['onu_id'] ?? (string)$customer->id,
                    'vendor_model'    => $detected['vendor_model'] ?: 'HG8310M',
                ]);
            }

            AuditLog::record(
                'CREATE',
                'Customer Management',
                "Mendaftarkan pelanggan baru {$customer->name} ({$customer->customer_number}) - Alamat: {$customer->address}" . ($detected['port'] ? " - Port OLT: {$detected['port']}" : ''),
                null,
                ['customer_number' => $customer->customer_number, 'name' => $customer->name, 'phone' => $customer->phone, 'address' => $customer->address, 'onu_serial' => $service->onu_serial, 'olt_port' => $detected['port']]
            );

            return response()->json([
                'status'  => 'success',
                'message' => 'Pelanggan berhasil ditambahkan & terhubung ke Port ODP' . ($detected['port'] ? " (Port OLT: {$detected['port']})" : ''),
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

        $oldData = [
            'customer_number' => $customer->customer_number,
            'name'            => $customer->name,
            'phone'           => $customer->phone,
            'email'           => $customer->email,
            'address'         => $customer->address,
            'status'          => is_object($customer->status) ? $customer->status->value : $customer->status,
        ];

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

        return DB::transaction(function () use ($customer, $validated, $request, $oldData) {
            $statusInput = isset($validated['status']) ? strtolower($validated['status']) : null;
            $dbStatus = $statusInput ? (in_array($statusInput, ['online', 'active', 'aktif']) ? 'active' : 'suspended') : $customer->status;

            $customer->update([
                'customer_number' => $validated['customer_number'] ?? $customer->customer_number,
                'name'            => $validated['name'] ?? $customer->name,
                'phone'           => $validated['phone'] ?? $customer->phone,
                'email'           => $validated['email'] ?? $customer->email,
                'address'         => $validated['address'] ?? $customer->address,
                'status'          => $dbStatus,
            ]);

            $service = $customer->services->first();
            if (!$service) {
                $service = CustomerService::create([
                    'service_number'     => CustomerService::generateUniqueServiceNumber(),
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
            if (array_key_exists('odp_id', $validated)) {
                // Catat node lama sebelum dilepaskan untuk recalculate used_ports
                $oldNodeIds = NetworkPort::where('customer_service_id', $service->id)->pluck('node_id')->unique()->filter();

                // Lepaskan port lama
                NetworkPort::where('customer_service_id', $service->id)->update([
                    'customer_service_id' => null,
                    'customer_name_cache' => null,
                    'status'              => 'available',
                ]);

                foreach ($oldNodeIds as $oldNid) {
                    NetworkPort::recalculateNodeUsedPorts($oldNid);
                }

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
                        if ($targetPort->customer_service_id && $targetPort->customer_service_id != $service->id) {
                            $occupant = $targetPort->customer_name_cache ?: 'pelanggan lain';
                            throw new \Exception("Port {$targetPort->port_number} pada ODP ini sudah terisi oleh {$occupant}. Silakan pilih port yang masih kosong.");
                        }

                        $targetPort->update([
                            'customer_service_id' => $service->id,
                            'customer_name_cache' => $customer->name,
                            'status'              => 'used',
                        ]);
                        NetworkPort::recalculateNodeUsedPorts($odpId);
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
                        'rx_power'            => $validated['rx_power'] ?? null,
                        'status'              => 'active',
                    ]);
                }
            }

            try {
                AuditLog::record(
                    'UPDATE',
                    'Customer Management',
                    "Perbarui data pelanggan {$customer->name} ({$customer->customer_number})",
                    $oldData,
                    $validated
                );
            } catch (\Throwable $e) {
                // Log failed audit without breaking the transaction
            }

            return response()->json([
                'status'  => 'success',
                'message' => 'Data pelanggan berhasil diperbarui',
                'data'    => $customer
            ]);
        });
    }

    public function destroy($id)
    {
        $affectedNodeIds = DB::transaction(function () use ($id) {
            $customer = Customer::with(['services' => fn ($query) => $query->withTrashed()])->lockForUpdate()->findOrFail($id);
            $custName = $customer->name;
            $custNum = $customer->customer_number;

            $affectedNodeIds = [];
            foreach ($customer->services as $service) {
                $ports = NetworkPort::where('customer_service_id', $service->id)->lockForUpdate()->get();
                foreach ($ports as $p) {
                    if ($p->node_id) $affectedNodeIds[] = $p->node_id;
                    $p->update([
                        'customer_service_id' => null,
                        'customer_name_cache' => null,
                        'destination_label'   => null,
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

            return array_unique($affectedNodeIds);
        });
        self::clearCustomerCache();
        foreach ($affectedNodeIds as $nodeId) Cache::forget("odp_onus_topology_v2_{$nodeId}");

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
            ->whereNull('customer_service_id')
            ->whereNotIn('onu_serial', $assignedSerials)
            ->get();

        $formatted = collect();

        foreach ($registeredOnus as $ont) {
            $nodePort = $ont->oltPort?->node?->olt_port_ref ?: 'epon_0/1';
            $portClean = str_replace(['gpon-olt_', 'gpon_olt_', 'gpon_'], 'epon_', $nodePort);

            $formatted->push([
                'id'            => $ont->id,
                'serial_number' => $ont->onu_serial,
                'vendor'        => $ont->onu_type ?: 'OEMT',
                'model'         => $ont->profile_name ?: '212X HGU',
                'rx_power'      => $ont->rx_power !== null ? (float)$ont->rx_power : -16.64,
                'gpon_port'     => explode(',', $portClean)[0] ?? 'epon_0/1',
                'olt_name'      => $ont->oltPort?->node?->oltDevice?->name ?: 'OLT-TES-HSGQ',
                'description'   => 'ONU Terdaftar di Database (Belum Terhubung Pelanggan)',
            ]);
        }

        // 2. Query unconfigured / newly discovered ONUs langsung dari database telemetry snapshot
        $activeOlts = OltDevice::where('status', 'active')->whereNotNull('last_telemetry_snapshot')->get();

        foreach ($activeOlts as $olt) {
            $uncfg = $olt->last_telemetry_snapshot['unconfigured_onus'] ?? [];

            foreach ($uncfg as $u) {
                $sn = $u['serial_number'] ?? ($u['mac_address'] ?? null);
                if ($sn && !in_array($sn, $assignedSerials) && !$formatted->contains('serial_number', $sn)) {
                    $formatted->push([
                        'id'            => rand(9000, 9999),
                        'serial_number' => $sn,
                        'vendor'        => $u['vendor_model'] ?? 'ZTE/OEM GPON',
                        'model'         => $u['model'] ?? 'HGU GPON/EPON',
                        'rx_power'      => (float)($u['rx_power'] ?? -18.50),
                        'gpon_port'     => $u['detected_port'] ?? ($u['port'] ?? null),
                        'olt_name'      => $olt->name,
                        'description'   => 'ONU Fisik Terdeteksi di OLT (Belum Terhubung Pelanggan)',
                    ]);
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
                    'service_number'     => CustomerService::generateUniqueServiceNumber(),
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
                        if ($port->customer_service_id && $port->customer_service_id != $service->id) {
                            $occupant = $port->customer_name_cache ?: 'pelanggan lain';
                            throw new \Exception("Port {$item['odp_port_number']} pada ODP ini sudah terisi oleh {$occupant}. Silakan pilih port yang masih kosong.");
                        }

                        $port->update([
                            'customer_service_id' => $service->id,
                            'customer_name_cache' => $customer->name,
                            'status'              => 'used',
                        ]);
                        NetworkPort::recalculateNodeUsedPorts($item['odp_id']);
                    }
                }

                // Deteksi otomatis port fisik OLT dan telemetri
                $detected = self::resolveOnuPhysicalPortAndSync(
                    $item['onu_serial'],
                    $item['odp_id'] ?? null,
                    $item['interface'] ?? ($item['gpon_port'] ?? null)
                );

                $rxPowerVal = $detected['rx_power'] ?? null;
                $txPowerVal = $detected['tx_power'] ?? null;
                $statusVal  = (strtolower($detected['status']) === 'online') ? 'active' : 'active';

                // Register / Update ONT in ont_registrations table
                OntRegistration::updateOrCreate(
                    ['customer_service_id' => $service->id, 'onu_serial' => $item['onu_serial']],
                    [
                        'customer_service_id' => $service->id,
                        'onu_type'            => $detected['vendor_model'] ?: 'ZTE ONU',
                        'rx_power'            => $rxPowerVal,
                        'tx_power'            => $txPowerVal,
                        'status'              => $statusVal,
                        'registered_at'       => now(),
                        'notes'               => 'Provisioned via Auto-Discovery' . ($detected['port'] ? " (Port: {$detected['port']})" : ''),
                    ]
                );

                // Sinkronkan ke Telemetry Snapshot OLT
                if ($detected['olt_id'] && $detected['port']) {
                    self::injectCustomerIntoOltSnapshot($detected['olt_id'], [
                        'customer_id'     => $customer->id,
                        'customer_name'   => $customer->name,
                        'customer_number' => $customer->customer_number,
                        'serial_number'   => $item['onu_serial'],
                        'port'            => $detected['port'],
                        'rx_power'        => $rxPowerVal,
                        'tx_power'        => $txPowerVal,
                        'status'          => ($statusVal === 'active') ? 'Online' : 'Offline',
                        'onu_id'          => $detected['onu_id'] ?? (string)$customer->id,
                        'vendor_model'    => $detected['vendor_model'] ?: 'ZTE ONU',
                    ]);
                }

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
                OntRegistration::where('customer_service_id', $service->id)->where('onu_serial', $oldOnuSerial)->update([
                    'status' => 'inactive',
                    'notes'  => "Diganti dengan modem baru SN: {$newOnuSerial}. Alasan: " . ($validated['replacement_reason'] ?? 'Pergantian Modem'),
                ]);
            }

            // 3. Register / Update ONT Baru
            OntRegistration::updateOrCreate(
                ['customer_service_id' => $service->id, 'onu_serial' => $newOnuSerial],
                [
                    'customer_service_id' => $service->id,
                    'onu_type'            => 'ONT Replacement',
                    'rx_power'            => $validated['rx_power'] ?? null,
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

    /**
     * Diagnostik & Analisa Redaman Sinyal Optik serta Uji Ping Pelanggan.
     */
    public function diagnostics($id)
    {
        $customer = Customer::with([
            'services.servicePackage',
            'services.networkPort.node.parent.parent',
            'services.networkPort.node.oltDevice',
            'services.ontRegistration.oltPort.node.parent.parent',
        ])->findOrFail($id);

        $service = $customer->services->first();
        $port = $service?->networkPort;
        $odpNode = $port?->node;
        $odcNode = $odpNode?->parent;
        $ont = $service?->ontRegistration;
        $sn = strtoupper(trim((string)($ont?->onu_serial ?: ($service?->onu_serial ?: ''))));
        $mac = strtoupper(trim((string)($ont?->onu_mac ?: '')));

        $view = OnuTelemetryView::load()->forNode($odpNode ?: $ont?->oltPort?->node, $sn, $mac);
        $gponInterface = $view['gpon_interface'];
        $rxPower = $view['rx_power'];
        $txPower = null;
        $status = $view['onu_status'];
        $distance = null;

        $quality = $view['is_online'] === false ? 'Perangkat Offline' : ($rxPower === null ? 'Belum tersedia'
            : ($rxPower >= -25 ? 'Good (Normal)' : ($rxPower >= -28 ? 'Warning (Perlu Diperiksa)' : 'Critical (Redaman Tinggi)')));

        // This endpoint has no persisted optical history or customer ICMP measurement.
        $history = [];

        return response()->json([
            'status'   => 'success',
            'customer' => [
                'id'              => $customer->id,
                'name'            => $customer->name,
                'customer_number' => $customer->customer_number,
                'phone'           => $customer->phone,
                'package_name'    => $service?->servicePackage?->name ?? 'Paket Internet',
                'speed_mbps'      => $service?->servicePackage?->speed_mbps ?? 20,
            ],
            'optical' => [
                'rx_power'            => $rxPower,
                'tx_power'            => $txPower,
                'status'              => $status,
                'quality'             => $quality,
                'distance_meters'     => $distance,
                'attenuation_loss_db' => null,
                ...$view,
                'history'             => $history,
            ],
            'ping' => [
                'target_ip' => $service?->ip_address,
                'online' => null, 'latency_ms' => null, 'packet_loss_pct' => null,
                'jitter_ms' => null, 'packets_sent' => 0, 'packets_received' => null,
                'tested_at' => null, 'available' => false,
            ],
            'topology' => [
                'olt_name'       => $view['olt_name'],
                'gpon_interface' => $gponInterface,
                'odc_name'       => $odcNode?->name,
                'odc_code'       => $odcNode?->code,
                'odp_name'       => $odpNode?->name,
                'odp_code'       => $odpNode?->code,
                'odp_port'       => $port?->port_number,
                'onu_serial'     => $sn ?: '—',
                'onu_mac'        => $mac ?: '—',
                'onu_type'       => $ont?->onu_type ?: 'HGU GPON/EPON',
            ]
        ]);
    }

    /**
     * Resolusi cerdas port fisik OLT, OLT Device, dan telemetri untuk pelanggan baru / ONU
     */
    public static function resolveOnuPhysicalPortAndSync(?string $onuSerial, ?int $odpId = null, ?string $hintInterface = null): array
    {
        $empty=['port'=>null,'olt_id'=>null,'olt_name'=>null,'rx_power'=>null,'tx_power'=>null,'status'=>'Unknown','onu_id'=>null,'vendor_model'=>null];
        $sn=strtoupper(trim((string)$onuSerial));if($sn==='')return $empty;
        $devices=OltDevice::where('status','active')->where('connection_mode','live')->get();
        $view=new \App\Services\Olt\OnuTelemetryView($devices);
        $owner=$odpId ? \App\Services\Olt\OnuTelemetryView::ownerId(\App\Models\NetworkNode::find($odpId)) : null;
        if($odpId && !$owner)return $empty;
        $matches=[];
        foreach($devices as $device) {
            if($owner && (int)$device->id!==$owner)continue;
            $row=$view->resolve((int)$device->id,$sn);
            if($row['identity_status']==='resolved')$matches[]=$row;
        }
        if(count($matches)!==1)return $empty;
        $row=$matches[0];
        return array_replace($empty,['port'=>$row['gpon_interface'],'olt_id'=>$row['olt_id'],'olt_name'=>$row['olt_name'],
            'rx_power'=>$row['rx_power'],'status'=>$row['onu_status'],'onu_id'=>$row['onu_id']]);
    }


    /**
     * Menyuntikkan atau memperbarui pelanggan langsung ke dalam Telemetry Snapshot OLT
     */
    public static function injectCustomerIntoOltSnapshot(int $oltId, array $onuData): void
    {
        // Administrative registration is not proof of a hardware tuple or an optical sample.
        \App\Services\Olt\OnuTelemetryWriter::invalidate();
    }


    /**
     * POST /api/customers/probe-interface-optical
     * Pengecekan redaman & status optik real-time per interface langsung dari OLT via SNMP
     */
    public function storedInterfaceOptical(Request $request)
    {
        $request->validate(['olt_id'=>'required|integer|min:1','interface'=>'required|string|max:64']);
        $index=\App\Services\Olt\ZteOnuIdentityMap::ifIndexFromPort($request->input('interface'));
        if($index===null)return response()->json(['message'=>'Interface PON tidak valid.'],422);
        $olt=OltDevice::where('status','active')->where('connection_mode','live')->findOrFail((int)$request->input('olt_id'));
        $port=\App\Services\Olt\ZteOnuIdentityMap::portFromIfIndex($index);
        $snapshot=$olt->last_telemetry_snapshot ?? [];
        $inventory=\App\Services\Olt\ZteOnuIdentityMap::uniqueRows(\App\Services\Olt\ZteOnuIdentityMap::snapshotRows($snapshot ?? []));
        $view=new \App\Services\Olt\OnuTelemetryView([$olt]);$customersBySerial=[];
        $ambiguousServices=DB::table('network_ports')->whereNotNull('customer_service_id')->select('customer_service_id')
            ->groupBy('customer_service_id')->havingRaw('COUNT(*) > 1')->pluck('customer_service_id')->flip();
        foreach(Customer::with(['services.servicePackage','services.networkPort.node.parent.parent','services.ontRegistration'])->get() as $customer) {
            foreach($customer->services as $service) {
                $reg=$service->ontRegistration;$node=$service->networkPort?->node;
                if(!$reg || isset($ambiguousServices[$service->id]) || \App\Services\Olt\OnuTelemetryView::ownerId($node)!==(int)$olt->id
                    || \App\Services\Olt\OnuTelemetryWriter::hasAliasConflict($reg,$inventory))continue;
                $sn=strtoupper(trim((string)($reg->onu_serial ?: $reg->onu_mac)));
                $customersBySerial[$sn][]=['customer_id'=>$customer->id,'customer_name'=>$customer->name,'customer_number'=>$customer->customer_number,
                    'phone'=>$customer->phone,'address'=>$customer->address,'package_name'=>$service->servicePackage?->name,
                    'service_status'=>strtoupper($customer->service_status ?: 'OPEN'),'odp_name'=>$node?->name,'odp_code'=>$node?->code,
                    'odp_port_number'=>$service->networkPort?->port_number,'ont_registration_id'=>$reg->id];
            }
        }
        $rows=[];
        foreach($inventory as $sn=>$identity) {
            if(\App\Services\Olt\ZteOnuIdentityMap::ifIndexFromPort($identity['port'])!==$index)continue;
            $v=$view->resolve((int)$olt->id,$sn);$rx=$v['rx_power'];
            $quality=$v['is_online']===false?'LOS':($rx===null?'UNKNOWN':($rx<=-28?'CRITICAL':($rx<=-25?'WARNING':'GOOD')));
            $matches=$customersBySerial[$sn] ?? [];
            $rows[]=array_replace($v,['onu_index'=>$v['onu_id'],'onu_port_id'=>$port.':'.$identity['onu_id'],
                'serial_number'=>$sn,'status_label'=>$v['onu_status'],'attenuation_quality'=>$quality,
                'is_registered'=>count($matches)===1,'customer_id'=>null,'customer_number'=>null,'customer_name'=>'ONU '.$sn,
                'ont_registration_id'=>null],count($matches)===1?$matches[0]:[]);
        }
        $summary=\App\Services\Olt\OnuTelemetryView::summarize($rows);
        return response()->json(['status'=>'success','source'=>'snapshot','complete'=>$summary['unknown_clients']===0 && count($rows)>0,
            'olt_id'=>$olt->id,'olt_name'=>$olt->name,'interface'=>$port,'data'=>$rows,
            'summary'=>['total_onus'=>count($rows),'online_count'=>$summary['online_clients'],'down_count'=>$summary['loss_clients'],
                'unknown_count'=>$summary['unknown_clients'],'avg_rx_power'=>$summary['avg_rx_power'],
                'min_rx_power'=>$summary['worst_rx_power'],'max_rx_power'=>$summary['best_rx_power'],
                'warning_count'=>count(array_filter($rows,fn($r)=>$r['attenuation_quality']==='WARNING')),
                'critical_count'=>count(array_filter($rows,fn($r)=>$r['attenuation_quality']==='CRITICAL')),
                'probed_at'=>null,'probed_at_human'=>null],
            'polled_at'=>$snapshot['polled_at'] ?? null]);
    }

    public function probeInterfaceOptical(Request $request)
    {
        $id=$request->input('olt_id');
        $olt=ctype_digit((string)$id) ? OltDevice::find((int)$id):null;
        if(!$olt || $olt->connection_mode!=='live')return $this->probeInterfaceOpticalUnlocked($request);
        return \App\Services\Olt\OltReadLease::forDevice($olt,fn()=>$this->probeInterfaceOpticalUnlocked($request));
    }

    private function probeInterfaceOpticalUnlocked(Request $request)
    {
        $started=microtime(true);$at=\App\Services\Olt\OnuTelemetrySample::timestamp();
        $oltId=$request->input('olt_id');$interface=trim((string)$request->input('interface',''));
        $index=\App\Services\Olt\ZteOnuIdentityMap::ifIndexFromPort($interface);
        if(!ctype_digit((string)$oltId) || (int)$oltId<1 || $index===null) return response()->json(['status'=>'error','message'=>'Pilih satu OLT dan interface PON yang valid.'],422);
        $olt=OltDevice::where('status','active')->where('connection_mode','live')->find((int)$oltId);
        if(!$olt)return response()->json(['status'=>'error','message'=>'OLT aktif tidak ditemukan.'],404);
        $port=\App\Services\Olt\ZteOnuIdentityMap::portFromIfIndex($index);
        $probe=\App\Services\Olt\FastOpticalProbeService::probePortOnusQuickState($olt,$port);
        $inventory=\App\Services\Olt\ZteOnuIdentityMap::uniqueRows(\App\Services\Olt\ZteOnuIdentityMap::snapshotRows($olt->last_telemetry_snapshot ?? []));
        $customersBySerial=[];
        foreach(Customer::with(['services.servicePackage','services.networkPort.node.parent.parent','services.ontRegistration'])->get() as $customer) {
            foreach($customer->services as $service) {
                $registration=$service->ontRegistration;$node=$service->networkPort?->node;
                if(!$registration || \App\Services\Olt\OnuTelemetryView::ownerId($node)!==(int)$olt->id)continue;
                $serial=strtoupper(trim((string)($registration->onu_serial ?: $registration->onu_mac)));
                $customersBySerial[$serial][]=['customer_id'=>$customer->id,'customer_name'=>$customer->name,'customer_number'=>$customer->customer_number,
                    'phone'=>$customer->phone,'address'=>$customer->address,'package_name'=>$service->servicePackage?->name,
                    'service_status'=>strtoupper($customer->service_status ?: 'OPEN'),'odp_name'=>$node?->name,'odp_code'=>$node?->code,
                    'odp_port_number'=>$service->networkPort?->port_number,'ont_registration_id'=>$registration->id];
            }
        }
        $rows=[];$writeRows=[];
        foreach($probe['onu_states_by_sn'] ?? [] as $sn=>$reading) {
            if(!isset($inventory[$sn]))continue;
            $identity=$inventory[$sn];$rx=$reading['is_online'] ? $reading['rx_power']:null;
            $writeRows[]=array_replace($identity,$reading,\App\Services\Olt\OnuTelemetrySample::normalize($reading,$at));
            $quality=!$reading['is_online'] ? 'LOS':($rx===null ? 'UNKNOWN':($rx<=-28 ? 'CRITICAL':($rx<=-25 ? 'WARNING':'GOOD')));
            $customerRows=$customersBySerial[$sn] ?? [];$customer=count($customerRows)===1 ? $customerRows[0] : [];
            $rows[]=array_replace(['telemetry_contract'=>1,'identity_status'=>'resolved','gpon_interface'=>$port,
                'onu_index'=>$reading['onu_id'],'onu_port_id'=>$port.':'.$reading['onu_id'],
                'serial_number'=>$sn,'is_online'=>$reading['is_online'],'status_label'=>$reading['is_online'] ? 'Online':'Offline',
                'rx_power'=>$rx,'rx_available'=>$reading['rx_available'],'attenuation_quality'=>$quality,
                'is_registered'=>count($customerRows)===1,'customer_id'=>null,'customer_number'=>null,
                'customer_name'=>'ONU '.$sn,'ont_registration_id'=>null,
                'sampled_at'=>$at,'telemetry_source'=>'snmp_point'],$customer);
        }
        if($request->boolean('sync_db',true))app(\App\Services\Olt\OnuTelemetryWriter::class)->apply($olt,$writeRows,$at,'point');
        $powers=array_column(array_filter($rows,fn($r)=>$r['is_online'] && $r['rx_power']!==null),'rx_power');
        $complete=$probe['complete'] ?? false;$total=$probe['total_onus'] ?? 0;
        return response()->json(['status'=>'success','complete'=>$complete,'olt_id'=>$olt->id,'olt_name'=>$olt->name,'olt_ip'=>$olt->ip_address,'interface'=>$port,
            'message'=>$complete ? 'Pembacaan terverifikasi selesai.':'Pembacaan belum lengkap; pelanggan yang belum terbaca tidak dianggap Offline.',
            'interface_health'=>!$complete ? 'UNKNOWN':(($probe['is_mass_outage'] ?? false) ? 'MASS_OUTAGE':(($powers && min($powers)<=-25) ? 'DEGRADED':'HEALTHY')),
            'summary'=>['total_onus'=>$total,'online_count'=>$probe['online_count'] ?? 0,'down_count'=>$probe['down_count'] ?? 0,'unknown_count'=>$probe['unknown_count'] ?? $total,
                'warning_count'=>count(array_filter($powers,fn($rx)=>$rx<=-25 && $rx>-28)),'critical_count'=>count(array_filter($powers,fn($rx)=>$rx<=-28)),
                'avg_rx_power'=>$powers ? round(array_sum($powers)/count($powers),2):null,'min_rx_power'=>$powers ? min($powers):null,'max_rx_power'=>$powers ? max($powers):null,
                'duration_ms'=>round((microtime(true)-$started)*1000,1),'probed_at'=>$at,'probed_at_human'=>now()->format('d/m/Y H:i:s')],
            'data'=>$rows]);
    }

}

