<?php

namespace App\Http\Controllers;

use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\AuditLog;
use App\Models\OltDevice;
use App\Models\Customer;
use App\Http\Requests\StoreNetworkNodeRequest;
use App\Http\Requests\UpdateNetworkNodeRequest;
use App\Http\Resources\NetworkNodeResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class NetworkNodeController extends Controller
{
    private function checkCrudPermission()
    {
        $user = auth()->user();
        if ($user && in_array($user->role, ['Teknisi Jointer', 'Customer Service', 'Finance & Billing'])) {
            abort(response()->json([
                'message' => "Akses Ditolak: Peran {$user->role} hanya diizinkan melihat data infrastruktur (Read-Only) dan tidak dapat menambah, mengubah, atau menghapus node."
            ], 403));
        }
    }

    /**
     * Daftar node dengan filter tipe, status, dan pencarian.
     * Untuk topologi, gunakan endpoint /hierarchy.
     */
    public function index(Request $request)
    {
        $query = NetworkNode::with(['splitterType', 'children', 'parent.oltDevice', 'oltDevice']);

        $type = $request->input('node_type', $request->input('type'));
        if ($type && $type !== 'ALL') {
            $query->where('node_type', $type);
        }
        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                  ->orWhere('code', 'ilike', "%{$s}%")
                  ->orWhere('address', 'ilike', "%{$s}%");
            });
        }
        if ($request->filled('parent_id')) {
            $query->where('parent_node_id', $request->parent_id);
        }

        $perPage = min((int)$request->input('per_page', 100), 10000);
        $nodes = $query->orderBy('name')->paginate($perPage);
        return NetworkNodeResource::collection($nodes);
    }

    /**
     * Hirarki lengkap: POP → ODC → ODP dan POP → ODP/MS → ODP
     * Mendukung dua pola: standar (ODC) dan mini (ODP/MS langsung ke POP)
     */
    public function hierarchy()
    {
        // Level 1: POP (root — tidak punya parent)
        $pops = NetworkNode::with([
            'splitterType',
            'children' => function ($q) {
                // Load semua anak POP: ODC standar DAN ODP yang bertindak sebagai MS
                $q->with([
                    'splitterType',
                    'children' => function ($q2) {
                        // Anak dari ODC atau ODP/MS → semuanya adalah ODP akhir
                        $q2->with(['splitterType', 'ports.customerService.customer'])
                           ->where('node_type', 'ODP')
                           ->orderBy('name');
                    }
                ])
                ->whereIn('node_type', ['ODC', 'ODP'])  // ODC standar + ODP/MS
                ->orderBy('name');
            }
        ])
        ->whereIn('node_type', ['POP'])
        ->whereNull('parent_node_id')
        ->orderBy('name')
        ->get();

        return response()->json([
            'data' => $pops->map(fn($pop) => $this->formatNode($pop, true))
        ]);
    }

    /**
     * ODC anak dari suatu POP (panel tengah ketika klik POP)
     */
    public function childrenOf(NetworkNode $networkNode)
    {
        $children = NetworkNode::with(['splitterType', 'oltDevice', 'ports'])
            ->where('parent_node_id', $networkNode->id)
            ->orderBy('name')
            ->get();

        return NetworkNodeResource::collection($children);
    }

    /**
     * Daftar ODC + ODP/MS — bisa difilter by olt_device_id, parent_node_id (POP), dan search
     * ODP/MS adalah ODP yang berinduk langsung ke POP (berfungsi sebagai pengganti ODC skala kecil)
     * GET /api/network-nodes/odc-list?olt_id=1&pop_id=2&search=ODC-01
     */
    public function odcList(Request $request)
    {
        // Query 1: ODC standar
        $odcQuery = NetworkNode::with(['splitterType', 'oltDevice', 'parent'])
            ->where('node_type', 'ODC');

        // Query 2: ODP/MS — ODP yang parent-nya adalah POP
        $msQuery = NetworkNode::with(['splitterType', 'oltDevice', 'parent'])
            ->where('node_type', 'ODP')
            ->whereHas('parent', fn($q) => $q->where('node_type', 'POP'));

        // Terapkan filter yang sama ke kedua query
        foreach ([$odcQuery, $msQuery] as $q) {
            if ($request->filled('olt_id')) {
                $q->where('olt_device_id', $request->olt_id);
            }
            if ($request->filled('pop_id')) {
                $q->where('parent_node_id', $request->pop_id);
            }
            if ($request->filled('search')) {
                $s = $request->search;
                $q->where(function ($sq) use ($s) {
                    $sq->where('name', 'ilike', "%{$s}%")
                       ->orWhere('code', 'ilike', "%{$s}%")
                       ->orWhere('address', 'ilike', "%{$s}%")
                       ->orWhere('olt_port_ref', 'ilike', "%{$s}%");
                });
            }
        }

        $odcs = $odcQuery->orderBy('code')->get();
        $msNodes = $msQuery->orderBy('code')->get();

        // Gabungkan dan format
        $allNodes = $odcs->concat($msNodes);

        $mapNode = function ($node) {
            $autoData = $node->getAutoDetectedInterfaceAndOlt();
            $autoPort = $autoData['port_ref'];
            $effectivePortRef = $node->olt_port_ref ?: $autoPort;
            $isAuto = empty($node->olt_port_ref) && !empty($autoPort);
            $isMsNode = $node->node_type === 'ODP'; // ODP yang lolos filter = ODP/MS

            return [
                'id'                     => $node->id,
                'name'                   => $node->name,
                'code'                   => $node->code,
                'node_type'              => $node->node_type,
                'is_ms_node'             => $isMsNode,   // flag ODP/MS
                'model'                  => $node->model,
                'status'                 => $node->status,
                'address'                => $node->address,
                'latitude'               => $node->latitude,
                'longitude'              => $node->longitude,
                'province_id'            => $node->province_id,
                'regency_id'             => $node->regency_id,
                'district_id'            => $node->district_id,
                'village_id'             => $node->village_id,
                'total_ports'            => $node->total_ports,
                'used_ports'             => $node->used_ports,
                'core_power'             => $node->core_power,
                'core_color'             => $node->core_color,
                'splitter_config'        => $node->splitter_config,
                'tube_count'             => $node->tube_count,
                'tube_info'              => $node->tube_info,
                'splitter_count'         => $node->splitter_count,
                'odc_topology_type'      => $node->odc_topology_type,
                'olt_device_id'          => $node->olt_device_id ?: ($autoData['olt_device']['id'] ?? null),
                'olt_port_ref'           => $effectivePortRef,
                'stored_olt_port_ref'    => $node->olt_port_ref,
                'auto_detected_port_ref' => $autoPort,
                'is_auto_detected'       => $isAuto,
                'parent_node_id'         => $node->parent_node_id,
                'splitter_type_id'       => $node->splitter_type_id,
                'splitter_cascade_level' => $node->splitter_cascade_level,
                'splitter_type'          => $node->splitterType ? [
                    'id'           => $node->splitterType->id,
                    'name'         => $node->splitterType->name,
                    'ratio'        => $node->splitterType->ratio,
                    'output_ports' => $node->splitterType->output_ports,
                ] : null,
                'olt_device' => $node->oltDevice ? [
                    'id'   => $node->oltDevice->id,
                    'name' => $node->oltDevice->name,
                    'code' => $node->oltDevice->code,
                ] : ($autoData['olt_device'] ? [
                    'id'   => $autoData['olt_device']['id'],
                    'name' => $autoData['olt_device']['name'],
                    'code' => null,
                ] : null),
                'parent_node' => $node->parent ? [
                    'id'        => $node->parent->id,
                    'name'      => $node->parent->name,
                    'code'      => $node->parent->code,
                    'node_type' => $node->parent->node_type,
                ] : null,
                'odp_count' => NetworkNode::where('node_type', 'ODP')
                    ->where('parent_node_id', $node->id)->count(),
            ];
        };

        return response()->json([
            'data' => $allNodes->map($mapNode)->sortBy('code')->values()
        ]);
    }

    /**
     * Port detail untuk ODC node (visual grid port)
     * GET /api/network-nodes/{id}/odc-ports
     */
    public function odcPortDetail(NetworkNode $networkNode)
    {
        $ports = DB::table('network_ports')
            ->leftJoin('network_nodes as target', 'network_ports.connected_to_port_id', '=', 'target.id')
            ->where('network_ports.node_id', $networkNode->id)
            ->orderByRaw('CAST(network_ports.port_number AS integer) ASC NULLS LAST')
            ->select(
                'network_ports.id',
                'network_ports.port_number',
                'network_ports.port_type',
                'network_ports.status',
                'network_ports.notes',
                'network_ports.destination_label',
                'network_ports.customer_name_cache',
            )
            ->get();

        // Count children ODPs
        $odps = NetworkNode::with('splitterType')
            ->where('parent_node_id', $networkNode->id)
            ->where('node_type', 'ODP')
            ->orderBy('name')
            ->get();

        return response()->json([
            'node'  => new NetworkNodeResource($networkNode->load(['splitterType', 'oltDevice', 'parent'])),
            'ports' => $ports,
            'odps'  => $odps->map(fn($o) => [
                'id'          => $o->id,
                'name'        => $o->name,
                'code'        => $o->code,
                'status'      => $o->status,
                'address'     => $o->address,
                'total_ports' => $o->total_ports,
                'used_ports'  => $o->used_ports,
                'splitter_type' => $o->splitterType ? ['ratio' => $o->splitterType->ratio] : null,
            ]),
        ]);
    }

    /**
     * Topologi lengkap untuk OLT: list ODC + ODP yang terhubung ke OLT tertentu
     * GET /api/network-nodes/olt-topology?olt_id=1&olt_port_ref=gpon-olt_1/1/1
     */
    public function oltTopology(Request $request)
    {
        $query = NetworkNode::with(['splitterType', 'parent', 'oltDevice'])
            ->where('node_type', 'ODC');

        if ($request->filled('olt_id')) {
            $oltId = (int)$request->olt_id;
            $query->where(function ($q) use ($oltId) {
                $q->where('olt_device_id', $oltId)
                  ->orWhereHas('children', fn($cq) => $cq->where('olt_device_id', $oltId))
                  ->orWhereHas('parent', fn($pq) => $pq->where('olt_device_id', $oltId));
            });
        }

        if ($request->filled('olt_port_ref')) {
            $pref = str_replace(['gpon-olt_', 'epon-olt_', 'epon_'], '', $request->olt_port_ref);
            $query->where(function ($q) use ($request, $pref) {
                $q->where('olt_port_ref', 'ilike', "%{$request->olt_port_ref}%")
                  ->orWhere('olt_port_ref', 'ilike', "%{$pref}%");
            });
        }

        $odcs = $query->orderBy('code')->get();

        // 1. Build real-time optical power & status map from OLT snapshots
        $liveOnuMap = [];
        foreach (OltDevice::whereNotNull('last_telemetry_snapshot')->get() as $dev) {
            $snapOnus = array_merge(
                $dev->last_telemetry_snapshot['onu_list'] ?? [],
                $dev->last_telemetry_snapshot['unconfigured_onus'] ?? []
            );
            foreach ($snapOnus as $so) {
                $snKey = strtolower(trim($so['serial_number'] ?? ''));
                $macKey = strtolower(trim($so['mac_address'] ?? ($so['onu_mac'] ?? '')));
                if ($snKey) $liveOnuMap[$snKey] = $so;
                if ($macKey) $liveOnuMap[$macKey] = $so;
            }
        }

        // 2. Fetch customers and map by ODP node id
        $allCustomers = Customer::with(['services.networkPort', 'services.ontRegistration'])->get();
        $custByOdp = [];
        foreach ($allCustomers as $c) {
            $odpId = $c->odp_node_id ?: ($c->services->first()?->networkPort?->node_id);
            if (!$odpId) continue;

            $ont = $c->services->first()?->ontRegistration;
            $snKey = strtolower(trim($ont?->onu_serial ?: ($c->services->first()?->onu_serial ?: '')));
            $macKey = strtolower(trim($ont?->onu_mac ?: ''));
            $liveData = ($snKey && isset($liveOnuMap[$snKey])) ? $liveOnuMap[$snKey] : (($macKey && isset($liveOnuMap[$macKey])) ? $liveOnuMap[$macKey] : null);

            $isOnline = false;
            $rx = -40.00;
            if ($liveData) {
                $st = strtolower($liveData['status'] ?? '');
                $rawRx = $liveData['rx_power'] ?? null;
                $isOnline = ($st === 'online' || $st === 'active') && $rawRx !== null && is_numeric($rawRx) && (float)$rawRx > -38.0;
                $rx = $isOnline ? (float)$rawRx : -40.00;
            } elseif ($ont) {
                $st = strtolower($ont->status ?? '');
                $rawRx = $ont->rx_power;
                $isOnline = ($st === 'active' || $st === 'online') && $rawRx !== null && is_numeric($rawRx) && (float)$rawRx > -38.0;
                $rx = $isOnline ? (float)$rawRx : -40.00;
            }

            $custByOdp[$odpId][] = [
                'name'      => $c->name,
                'rx'        => $rx,
                'is_online' => $isOnline,
                'status'    => $isOnline ? 'Online' : 'Offline / LOS',
            ];
        }

        $result = $odcs->map(function ($odc) use ($custByOdp) {
            $autoData = $odc->getAutoDetectedInterfaceAndOlt();
            $autoPort = $autoData['port_ref'];
            $effectivePortRef = $odc->olt_port_ref ?: $autoPort;

            $odps = NetworkNode::with(['splitterType', 'oltDevice'])
                ->where('parent_node_id', $odc->id)
                ->where('node_type', 'ODP')
                ->orderBy('code')
                ->get();

            return [
                'id'                     => $odc->id,
                'name'                   => $odc->name,
                'code'                   => $odc->code,
                'status'                 => $odc->status,
                'address'                => $odc->address,
                'latitude'               => $odc->latitude,
                'longitude'              => $odc->longitude,
                'olt_port_ref'           => $effectivePortRef,
                'stored_olt_port_ref'    => $odc->olt_port_ref,
                'auto_detected_port_ref' => $autoPort,
                'is_auto_detected'       => empty($odc->olt_port_ref) && !empty($autoPort),
                'total_ports'            => $odc->total_ports,
                'used_ports'             => $odc->used_ports,
                'parent_node'            => $odc->parent ? ['name' => $odc->parent->name, 'code' => $odc->parent->code] : null,
                'odps'                   => $odps->map(function ($o) use ($effectivePortRef, $custByOdp) {
                    $odpAuto = $o->getAutoDetectedInterfaceAndOlt();
                    $odpPort = $o->olt_port_ref ?: ($odpAuto['port_ref'] ?: $effectivePortRef);

                    $custs = $custByOdp[$o->id] ?? [];
                    $custCount = count($custs);
                    $onlineCusts = count(array_filter($custs, fn($c) => $c['is_online']));
                    $validRx = array_filter(array_column(array_filter($custs, fn($c) => $c['is_online']), 'rx'), fn($r) => $r !== null && is_numeric($r));
                    
                    if ($custCount > 0) {
                        if ($onlineCusts > 0) {
                            $computedStatus = 'ONLINE';
                            $avgRx = count($validRx) > 0 ? number_format(array_sum($validRx) / count($validRx), 2, '.', '') : null;
                        } else {
                            $computedStatus = 'OFFLINE';
                            $avgRx = '-40.00';
                        }
                    } else {
                        $computedStatus = in_array(strtolower($o->status), ['active', 'online']) ? 'ONLINE' : 'OFFLINE';
                        $avgRx = null;
                    }

                    return [
                        'id'                     => $o->id,
                        'name'                   => $o->name,
                        'code'                   => $o->code,
                        'status'                 => $computedStatus,
                        'node_status'            => $o->status,
                        'has_customers'          => $custCount > 0,
                        'customer_count'         => $custCount,
                        'online_customer_count'  => $onlineCusts,
                        'avg_rx_power'           => $avgRx,
                        'address'                => $o->address,
                        'latitude'               => $o->latitude,
                        'longitude'              => $o->longitude,
                        'olt_port_ref'           => $odpPort,
                        'auto_detected_port_ref' => $odpAuto['port_ref'],
                        'is_auto_detected'       => empty($o->olt_port_ref) && !empty($odpAuto['port_ref']),
                        'total_ports'            => $o->total_ports,
                        'used_ports'             => $o->used_ports,
                        'splitter'               => $o->splitterType?->ratio,
                    ];
                }),
            ];
        });

        return response()->json(['data' => $result]);
    }

    /**
     * Detail ODP: port grid + data pelanggan per port + auto-detect interface OLT + stats redaman (optical power)
     */
    public function portDetail(NetworkNode $networkNode)
    {
        $this->syncPhysicalPorts($networkNode);
        NetworkPort::recalculateNodeUsedPorts($networkNode->id);
        $node = $networkNode->load(['splitterType', 'oltDevice', 'parent']);

        // Ambil semua port pada ODP ini, join ke customer_services, customers, service_packages, dan ont_registrations
        $ports = DB::table('network_ports')
            ->leftJoin('customer_services', 'network_ports.customer_service_id', '=', 'customer_services.id')
            ->leftJoin('customers', 'customer_services.customer_id', '=', 'customers.id')
            ->leftJoin('service_packages', 'customer_services.service_package_id', '=', 'service_packages.id')
            ->leftJoin('ont_registrations', 'ont_registrations.customer_service_id', '=', 'customer_services.id')
            ->leftJoin('network_ports as olt_ports', 'ont_registrations.olt_port_id', '=', 'olt_ports.id')
            ->where('network_ports.node_id', $networkNode->id)
            ->orderByRaw('CAST(network_ports.port_number AS integer) ASC NULLS LAST')
            ->select(
                'network_ports.id',
                'network_ports.port_number',
                'network_ports.port_type',
                'network_ports.status',
                'network_ports.customer_service_id',
                'network_ports.customer_name_cache',
                'network_ports.notes',
                'customers.id as customer_id',
                'customers.customer_number',
                'customers.name as customer_name',
                'customers.phone as customer_phone',
                'customer_services.id as service_id',
                'customer_services.service_number',
                'customer_services.status as service_status',
                'service_packages.name as package_name',
                'ont_registrations.onu_serial',
                'ont_registrations.onu_mac',
                'ont_registrations.onu_type',
                'ont_registrations.rx_power',
                'ont_registrations.tx_power',
                'ont_registrations.status as ont_status',
                'ont_registrations.last_online_at',
                'olt_ports.port_number as olt_port_name'
            )
            ->get();

        // 1. Auto-detect Interface OLT & Device
        $autoData = $networkNode->getAutoDetectedInterfaceAndOlt();
        $autoOltPortRef = $networkNode->olt_port_ref ?: $autoData['port_ref'];
        if (empty($autoOltPortRef) && $networkNode->parent) {
            $autoOltPortRef = $networkNode->parent->olt_port_ref;
        }

        $displayOltRef = $autoOltPortRef ? collect(explode(',', $autoOltPortRef))->map(function ($s) {
            $trimmed = trim($s);
            if (!$trimmed) return '';
            if (str_starts_with($trimmed, 'epon')) return $trimmed;
            $clean = preg_replace('/^(gpon[-_]olt_)/i', '', $trimmed);
            return "gpon-olt_$clean";
        })->filter()->join(', ') : '—';

        // 2. Hitung statistik redaman (optical power) dari pelanggan yang terkoneksi
        $connectedPorts = $ports->filter(fn($p) => !empty($p->customer_id) || !empty($p->customer_service_id) || $p->status === 'used' || !empty($p->customer_name_cache) || !empty($p->destination_label));
        $validRxPowers = $ports->pluck('rx_power')->filter(fn($val) => $val !== null && is_numeric($val))->map(fn($v) => (float) $v);

        $avgRx = $validRxPowers->isNotEmpty() ? round($validRxPowers->avg(), 2) : null;
        $minRx = $validRxPowers->isNotEmpty() ? round($validRxPowers->min(), 2) : null;
        $maxRx = $validRxPowers->isNotEmpty() ? round($validRxPowers->max(), 2) : null;

        // Tentukan status kesehatan optik ODP
        // Good: -8 dBm s/d -25 dBm
        // Warning: -25.01 dBm s/d -28 dBm (Redaman tinggi)
        // Critical: < -28 dBm atau ada ONT Offline/LOS
        $signalStatus = 'no_customer';
        if ($validRxPowers->isNotEmpty()) {
            if ($minRx !== null && $minRx < -28.0) {
                $signalStatus = 'critical';
            } elseif ($minRx !== null && $minRx < -25.0) {
                $signalStatus = 'warning';
            } else {
                $signalStatus = 'good';
            }
        } elseif ($connectedPorts->isNotEmpty()) {
            $signalStatus = 'unknown';
        }

        return response()->json([
            'node'              => new NetworkNodeResource($node),
            'ports'             => $ports,
            'auto_olt_port_ref' => $autoOltPortRef ?: null,
            'display_olt_ref'   => $displayOltRef,
            'attenuation'       => [
                'connected_count' => $connectedPorts->count(),
                'avg_rx_power'    => $avgRx,
                'min_rx_power'    => $minRx,
                'max_rx_power'    => $maxRx,
                'signal_status'   => $signalStatus,
            ]
        ]);
    }

    /**
     * Daftar tipe splitter pasif (PLC 1:2, 1:4, 1:8, dll)
     */
    public function splitterTypes()
    {
        return response()->json(DB::table('splitter_types')->orderBy('output_ports')->get());
    }

    /**
     * Statistik ringkasan (untuk summary cards atas)
     */
    public function stats()
    {
        $all = NetworkNode::whereIn('node_type', ['POP', 'ODC', 'ODP'])->get();
        return response()->json([
            'total'       => $all->count(),
            'by_type'     => $all->groupBy('node_type')->map->count(),
            'by_status'   => $all->groupBy('status')->map->count(),
            'total_ports' => $all->sum('total_ports'),
            'used_ports'  => $all->sum('used_ports'),
        ]);
    }

    public function store(StoreNetworkNodeRequest $request)
    {
        $this->checkCrudPermission();

        $node = NetworkNode::create($request->validated());
        $node->load('splitterType');

        // Auto-inherit OLT device & interface from parent if omitted
        if ($node->parent_node_id && (!$node->olt_device_id || !$node->olt_port_ref)) {
            $parent = NetworkNode::find($node->parent_node_id);
            if ($parent) {
                if (!$node->olt_device_id && $parent->olt_device_id) {
                    $node->olt_device_id = $parent->olt_device_id;
                }
                if (!$node->olt_port_ref && $parent->olt_port_ref) {
                    $node->olt_port_ref = $parent->olt_port_ref;
                }
                $node->save();
            }
        }

        // Auto-generate ports jika total_ports > 0
        if ($node->total_ports > 0) {
            $ports = [];
            for ($i = 1; $i <= $node->total_ports; $i++) {
                $ports[] = [
                    'node_id'     => $node->id,
                    'port_number' => (string) $i,
                    'port_type'   => $node->node_type === 'ODP' ? 'SC_APC' : 'PON',
                    'status'      => 'available',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ];
            }
            DB::table('network_ports')->insert($ports);
        }

        AuditLog::record(
            'CREATE',
            'Infrastruktur Jaringan',
            "Membuat node {$node->node_type} baru: {$node->name} ({$node->code})",
            null,
            $node->toArray()
        );

        return new NetworkNodeResource($node);
    }

    public function show(NetworkNode $networkNode)
    {
        return new NetworkNodeResource($networkNode->load('splitterType'));
    }

    public function update(UpdateNetworkNodeRequest $request, NetworkNode $networkNode)
    {
        $this->checkCrudPermission();

        $oldData = $networkNode->only(array_keys($request->validated()));

        $networkNode->update($request->validated());

        // Auto-inherit OLT device & interface from parent if omitted
        if ($networkNode->parent_node_id && (!$networkNode->olt_device_id || !$networkNode->olt_port_ref)) {
            $parent = NetworkNode::find($networkNode->parent_node_id);
            if ($parent) {
                if (!$networkNode->olt_device_id && $parent->olt_device_id) {
                    $networkNode->olt_device_id = $parent->olt_device_id;
                }
                if (!$networkNode->olt_port_ref && $parent->olt_port_ref) {
                    $networkNode->olt_port_ref = $parent->olt_port_ref;
                }
                $networkNode->save();
            }
        }

        $this->syncPhysicalPorts($networkNode);
        NetworkPort::recalculateNodeUsedPorts($networkNode->id);

        AuditLog::record(
            'UPDATE',
            'Infrastruktur Jaringan',
            "Perbarui node {$networkNode->node_type}: {$networkNode->name} ({$networkNode->code})",
            $oldData,
            $request->validated()
        );

        return new NetworkNodeResource($networkNode->load('splitterType'));
    }

    private function syncPhysicalPorts(NetworkNode $node)
    {
        if ($node->total_ports <= 0) return;

        $existingPorts = DB::table('network_ports')
            ->where('node_id', $node->id)
            ->get();

        $existingPortNumbers = $existingPorts->pluck('port_number')->map(fn($v) => (int)$v)->toArray();

        $newPorts = [];
        for ($i = 1; $i <= $node->total_ports; $i++) {
            if (!in_array($i, $existingPortNumbers)) {
                $newPorts[] = [
                    'node_id'     => $node->id,
                    'port_number' => (string) $i,
                    'port_type'   => $node->node_type === 'ODP' ? 'SC_APC' : 'PON',
                    'status'      => 'available',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ];
            }
        }

        if (!empty($newPorts)) {
            DB::table('network_ports')->insert($newPorts);
        }

        // Hapus port berlebih jika total_ports dikurangi dan port tersebut masih available/kosong
        $excessIds = $existingPorts->filter(function ($p) use ($node) {
            $num = (int) $p->port_number;
            return $num > $node->total_ports
                && $p->status === 'available'
                && empty($p->customer_service_id)
                && empty($p->customer_name_cache);
        })->pluck('id');

        if ($excessIds->isNotEmpty()) {
            DB::table('network_ports')->whereIn('id', $excessIds)->delete();
        }
    }

    public function destroy(NetworkNode $networkNode)
    {
        $this->checkCrudPermission();
        $type = $networkNode->node_type;
        $name = $networkNode->name;
        $code = $networkNode->code;

        // Bebaskan kode unik agar bisa digunakan kembali setelah data dihapus.
        // Tambahkan suffix timestamp pada kode agar tidak memblokir pembuatan node baru
        // dengan kode yang sama (walau row ini masih tersimpan sebagai soft-delete).
        $networkNode->code = $networkNode->code . '_deleted_' . $networkNode->id . '_' . time();
        $networkNode->save();

        $networkNode->delete();

        AuditLog::record(
            'DELETE',
            'Infrastruktur Jaringan',
            "Menghapus node {$type}: {$name} ({$code})",
            ['name' => $name, 'code' => $code, 'type' => $type]
        );

        return response(null, Response::HTTP_NO_CONTENT);
    }

    private function formatNode($node, bool $includeChildren = false): array
    {
        $autoData = $node->getAutoDetectedInterfaceAndOlt();
        $autoPort = $autoData['port_ref'];
        $effectivePortRef = $node->olt_port_ref ?: $autoPort;
        $isAuto = empty($node->olt_port_ref) && !empty($autoPort);

        $data = [
            'id'                    => $node->id,
            'name'                  => $node->name,
            'code'                  => $node->code,
            'node_type'             => $node->node_type,
            'status'                => $node->status,
            'model'                 => $node->model,
            'address'               => $node->address,
            'latitude'              => $node->latitude,
            'longitude'             => $node->longitude,
            'province_id'           => $node->province_id,
            'regency_id'            => $node->regency_id,
            'district_id'           => $node->district_id,
            'village_id'            => $node->village_id,
            'total_ports'           => $node->total_ports,
            'used_ports'            => $node->used_ports,
            'splitter_cascade_level'=> $node->splitter_cascade_level,
            'olt_port_ref'          => $effectivePortRef,
            'stored_olt_port_ref'   => $node->olt_port_ref,
            'auto_detected_port_ref'=> $autoPort,
            'is_auto_detected'      => $isAuto,
            'parent_node_id'        => $node->parent_node_id,
            'core_power'            => $node->core_power,
            'core_color'            => $node->core_color,
            'tube_info'             => $node->tube_info,
            'tube_count'            => $node->tube_count,
            'splitter_count'        => $node->splitter_count,
            'splitter_config'       => $node->splitter_config,
            'odc_topology_type'     => $node->odc_topology_type,
            // ODP/MS: ODP yang berinduk langsung ke POP (setara dengan ODC skala kecil)
            'is_ms_node'            => $node->node_type === 'ODP'
                && $node->parent
                && $node->parent->node_type === 'POP',
            'parent_node'           => $node->parent ? [
                'id'        => $node->parent->id,
                'name'      => $node->parent->name,
                'code'      => $node->parent->code,
                'node_type' => $node->parent->node_type,
                'olt_device' => $node->parent->oltDevice ? [
                    'id'   => $node->parent->oltDevice->id,
                    'name' => $node->parent->oltDevice->name,
                    'code' => $node->parent->oltDevice->code,
                ] : null,
            ] : null,
            'olt_device'            => $node->oltDevice ? [
                'id'   => $node->oltDevice->id,
                'name' => $node->oltDevice->name,
                'code' => $node->oltDevice->code,
            ] : ($node->parent?->oltDevice ? [
                'id'   => $node->parent->oltDevice->id,
                'name' => $node->parent->oltDevice->name,
                'code' => $node->parent->oltDevice->code,
            ] : ($autoData['olt_device'] ? [
                'id'   => $autoData['olt_device']['id'],
                'name' => $autoData['olt_device']['name'],
                'code' => null,
            ] : null)),
            'splitter_type'         => $node->splitterType ? [
                'id'           => $node->splitterType->id,
                'name'         => $node->splitterType->name,
                'ratio'        => $node->splitterType->ratio,
                'output_ports' => $node->splitterType->output_ports,
                'loss_db'      => $node->splitterType->loss_db,
            ] : null,
            'children_count' => $node->children?->count() ?? 0,
        ];

        if ($includeChildren && $node->children) {
            $data['children'] = $node->children->map(
                fn($child) => $this->formatNode($child, true)
            )->values();
        }

        return $data;
    }
}
