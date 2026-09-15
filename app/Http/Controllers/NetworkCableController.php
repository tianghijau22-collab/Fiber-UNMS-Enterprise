<?php

namespace App\Http\Controllers;

use App\Models\NetworkCable;
use App\Models\NetworkCableCore;
use App\Models\NetworkNode;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class NetworkCableController extends Controller
{
    private function checkCrudPermission()
    {
        $user = auth()->user();
        if ($user && in_array($user->role, ['Teknisi Jointer', 'Customer Service', 'Finance & Billing'])) {
            abort(response()->json([
                'message' => "Akses Ditolak: Peran {$user->role} hanya diizinkan melihat data kabel (Read-Only) dan tidak dapat memodifikasi rute kabel."
            ], 403));
        }
    }

    /**
     * TIA-598-A Standard 12 Color Sequence
     */
    public const FIBER_COLORS = [
        1  => 'Biru',
        2  => 'Oranye',
        3  => 'Hijau',
        4  => 'Cokelat',
        5  => 'Abu-abu',
        6  => 'Putih',
        7  => 'Merah',
        8  => 'Hitam',
        9  => 'Kuning',
        10 => 'Ungu',
        11 => 'Pink',
        12 => 'Toska',
    ];

    public function index(Request $request)
    {
        $query = NetworkCable::with(['cableType', 'fromNode', 'toNode']);

        if ($request->filled('node_id')) {
            $nid = $request->node_id;
            $query->where(function ($q) use ($nid) {
                $q->where('from_node_id', $nid)->orWhere('to_node_id', $nid);
            });
        }

        if ($request->filled('from_node_id')) {
            $query->where('from_node_id', $request->from_node_id);
        }

        if ($request->filled('to_node_id')) {
            $query->where('to_node_id', $request->to_node_id);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('installation_type') && $request->installation_type !== 'all') {
            $query->where('installation_type', $request->installation_type);
        }

        if ($request->filled('q')) {
            $search = trim($request->q);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('code', 'ilike', "%{$search}%")
                  ->orWhere('route_description', 'ilike', "%{$search}%")
                  ->orWhere('notes', 'ilike', "%{$search}%");
            });
        }

        if ($request->boolean('with_cores')) {
            $query->with(['cores' => fn($q) => $q->orderBy('core_number')]);
        }

        $cables = $query->orderBy('name')->get();
        return response()->json(['data' => $cables]);
    }

    /**
     * Comprehensive Cable Network Statistics
     */
    public function stats()
    {
        $totalCables = NetworkCable::count();
        $totalLengthMeters = (float) NetworkCable::sum('length_meters');
        $totalCores = (int) NetworkCable::sum('core_count_total');
        $usedCores = (int) NetworkCable::sum('core_count_used');
        $usedPct = $totalCores > 0 ? round(($usedCores / $totalCores) * 100, 1) : 0;

        $byStatus = NetworkCable::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $byInstallation = NetworkCable::select('installation_type', DB::raw('count(*) as count'))
            ->groupBy('installation_type')
            ->pluck('count', 'installation_type')
            ->toArray();

        return response()->json([
            'total_cables' => $totalCables,
            'total_length_meters' => $totalLengthMeters,
            'total_length_km' => round($totalLengthMeters / 1000, 2),
            'total_cores' => $totalCores,
            'used_cores' => $usedCores,
            'available_cores' => max(0, $totalCores - $usedCores),
            'used_percentage' => $usedPct,
            'by_status' => [
                'active' => $byStatus['active'] ?? 0,
                'maintenance' => $byStatus['maintenance'] ?? 0,
                'damaged' => $byStatus['damaged'] ?? 0,
                'inactive' => $byStatus['inactive'] ?? 0,
            ],
            'by_installation' => [
                'Aerial' => $byInstallation['Aerial'] ?? 0,
                'Underground' => $byInstallation['Underground'] ?? 0,
                'Duct' => $byInstallation['Duct'] ?? 0,
                'Wall' => $byInstallation['Wall'] ?? 0,
            ],
        ]);
    }

    /**
     * Kabel dan detail matrix Tube & Core untuk POP tertentu
     */
    public function popCables(NetworkNode $networkNode)
    {
        $cables = NetworkCable::with([
            'cableType',
            'toNode',
            'fromNode',
            'cores' => function ($q) {
                $q->orderBy('core_number');
            }
        ])
        ->where(function ($q) use ($networkNode) {
            $q->where('from_node_id', $networkNode->id)
              ->orWhere('to_node_id', $networkNode->id);
        })
        ->orderBy('name')
        ->get();

        return response()->json([
            'pop_node' => [
                'id'          => $networkNode->id,
                'name'        => $networkNode->name,
                'code'        => $networkNode->code,
                'address'     => $networkNode->address,
                'total_ports' => $networkNode->total_ports,
                'used_ports'  => $networkNode->used_ports,
            ],
            'cables'   => $cables,
        ]);
    }

    /**
     * Simpan Kabel Baru yang terhubung ke POP/ODC
     * Auto-generate record network_cable_cores dengan standar TIA-598-A 12 Warna & Tube
     */
    public function store(Request $request)
    {
        $this->checkCrudPermission();

        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'code'              => 'required|string|max:100|unique:network_cables,code',
            'cable_type_id'     => 'nullable|exists:cable_types,id',
            'from_node_id'      => 'required|exists:network_nodes,id',
            'to_node_id'        => 'nullable|exists:network_nodes,id',
            'length_meters'     => 'required|numeric|min:1',
            'core_count_total'  => 'required|integer|in:6,12,24,48,96,144',
            'tube_count'        => 'required|integer|min:1|max:12',
            'installation_type' => 'required|string|in:Aerial,Underground,Duct,Wall',
            'route_description' => 'nullable|string|max:500',
            'notes'             => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $cable = NetworkCable::create([
                'name'              => $validated['name'],
                'code'              => strtoupper($validated['code']),
                'cable_type_id'     => $validated['cable_type_id'] ?? null,
                'from_node_id'      => $validated['from_node_id'],
                'to_node_id'        => $validated['to_node_id'] ?? null,
                'length_meters'     => $validated['length_meters'],
                'core_count_total'  => $validated['core_count_total'],
                'core_count_used'   => 0,
                'installation_type' => $validated['installation_type'],
                'route_description' => $validated['route_description'] ?? null,
                'status'            => 'active',
                'installed_at'      => now(),
                'notes'             => $validated['notes'] ?? null,
            ]);

            // Generate Cores
            $totalCores   = (int) $validated['core_count_total'];
            $tubeCount    = (int) $validated['tube_count'];
            $coresPerTube = (int) ceil($totalCores / $tubeCount);

            $coresData = [];
            for ($c = 1; $c <= $totalCores; $c++) {
                $tubeNumber = (int) ceil($c / $coresPerTube);
                $tubeColor  = self::FIBER_COLORS[(($tubeNumber - 1) % 12) + 1];
                
                $coreInTubeIndex = (($c - 1) % $coresPerTube) + 1;
                $coreColor       = self::FIBER_COLORS[(($coreInTubeIndex - 1) % 12) + 1];

                $coresData[] = [
                    'cable_id'         => $cable->id,
                    'core_number'      => $c,
                    'tube_number'      => $tubeNumber,
                    'tube_color'       => $tubeColor,
                    'color'            => $coreColor,
                    'status'           => 'available',
                    'destination_type' => 'UNASSIGNED',
                    'destination_name' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ];
            }

            DB::table('network_cable_cores')->insert($coresData);
            DB::commit();

            AuditLog::record(
                'CREATE',
                'Infrastruktur Kabel Optik',
                "Pendaftaran bentangan kabel baru {$cable->name} ({$cable->code}) kapasitas {$cable->core_count_total} core",
                null,
                ['name' => $cable->name, 'code' => $cable->code, 'cores' => $cable->core_count_total, 'length_m' => $cable->length_meters]
            );

            return response()->json([
                'message' => 'Kabel dan core matrix berhasil dibuat!',
                'data'    => $cable->load('cores'),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal membuat kabel: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update detail individual Core (Peruntukan, Status, ODF Cassette Label)
     */
    public function updateCore(Request $request, NetworkCableCore $networkCableCore)
    {
        $oldCore = $networkCableCore->only(['status', 'destination_type', 'destination_name', 'odf_cassette_label']);

        $validated = $request->validate([
            'status'              => 'required|string|in:available,used,damaged,reserved',
            'destination_type'    => 'required|string|in:ODC,BTS,CORPORATE,LEASED_FIBER,BACKBONE,RESERVED,UNASSIGNED',
            'destination_name'    => 'nullable|string|max:255',
            'destination_node_id' => 'nullable|exists:network_nodes,id',
            'odf_cassette_label'  => 'nullable|string|max:100',
            'notes'               => 'nullable|string',
        ]);

        $networkCableCore->update($validated);

        // Recalculate core_count_used on the parent cable
        $usedCount = DB::table('network_cable_cores')
            ->where('cable_id', $networkCableCore->cable_id)
            ->where('status', 'used')
            ->count();

        DB::table('network_cables')
            ->where('id', $networkCableCore->cable_id)
            ->update(['core_count_used' => $usedCount]);

        AuditLog::record(
            'UPDATE',
            'Infrastruktur Kabel Optik',
            "Pembaruan matrix Core #{$networkCableCore->core_number} (Tube {$networkCableCore->tube_number}): Status {$networkCableCore->status}, Destinasi {$networkCableCore->destination_type}",
            $oldCore,
            $networkCableCore->only(['status', 'destination_type', 'destination_name', 'odf_cassette_label'])
        );

        return response()->json([
            'message' => 'Detail core berhasil diperbarui!',
            'core'    => $networkCableCore,
        ]);
    }

    public function show(NetworkCable $networkCable)
    {
        return response()->json([
            'data' => $networkCable->load(['cableType', 'fromNode', 'toNode', 'cores'])
        ]);
    }

    public function update(Request $request, NetworkCable $networkCable)
    {
        $this->checkCrudPermission();

        $oldData = $networkCable->only(['name', 'from_node_id', 'to_node_id', 'length_meters', 'installation_type', 'status', 'route_description']);

        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'from_node_id'      => 'nullable|exists:network_nodes,id',
            'to_node_id'        => 'nullable|exists:network_nodes,id',
            'length_meters'     => 'required|numeric|min:1',
            'installation_type' => 'required|string|in:Aerial,Underground,Duct,Wall',
            'route_description' => 'nullable|string|max:500',
            'status'            => 'required|string|in:active,inactive,maintenance,damaged',
            'notes'             => 'nullable|string',
        ]);

        $networkCable->update($validated);

        AuditLog::record(
            'UPDATE',
            'Infrastruktur Kabel Optik',
            "Pembaruan data rute/spesifikasi kabel {$networkCable->name} ({$networkCable->code})",
            $oldData,
            $networkCable->only(['name', 'from_node_id', 'to_node_id', 'length_meters', 'installation_type', 'status', 'route_description'])
        );

        return response()->json([
            'message' => 'Data kabel berhasil diperbarui!',
            'data'    => $networkCable->fresh(),
        ]);
    }

    public function destroy(NetworkCable $networkCable)
    {
        $this->checkCrudPermission();

        $deletedInfo = $networkCable->only(['name', 'code', 'length_meters', 'installation_type', 'status']);
        $networkCable->delete();

        AuditLog::record(
            'DELETE',
            'Infrastruktur Kabel Optik',
            "Penghapusan data kabel optik {$deletedInfo['name']} ({$deletedInfo['code']})",
            $deletedInfo,
            null
        );

        return response(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Mass Delete All Cables & Associated Cores
     */
    public function deleteAll(Request $request)
    {
        $this->checkCrudPermission();

        $query = NetworkCable::query();
        if ($request->filled('installation_type') && $request->installation_type !== 'all') {
            $query->where('installation_type', $request->installation_type);
        }

        $cables = $query->get();
        $count = $cables->count();

        if ($count === 0) {
            return response()->json([
                'status'        => 'success',
                'message'       => "Tidak ada bentangan kabel yang ditemukan untuk dihapus.",
                'deleted_count' => 0,
            ]);
        }

        $cableIds = $cables->pluck('id')->toArray();

        DB::beginTransaction();
        try {
            // 1. Hapus seluruh core matrix yang terkait
            DB::table('network_cable_cores')->whereIn('cable_id', $cableIds)->delete();

            // 2. Ubah code kabel dengan suffix deleted dan hapus
            $now = time();
            foreach ($cables as $cable) {
                $cable->code = $cable->code . '_deleted_' . $cable->id . '_' . $now;
                $cable->save();
                $cable->delete();
            }

            DB::commit();

            AuditLog::record(
                'DELETE',
                'Infrastruktur Kabel Optik',
                "Menghapus massal seluruh bentangan kabel ({$count} kabel) beserta seluruh data core matrix-nya",
                null,
                ['deleted_count' => $count]
            );

            return response()->json([
                'status'        => 'success',
                'message'       => "Berhasil menghapus {$count} bentangan kabel beserta seluruh data core matrix-nya.",
                'deleted_count' => $count,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => "Gagal menghapus bentangan kabel: " . $e->getMessage(),
            ], 500);
        }
    }

    public function updateRoute(Request $request, NetworkCable $networkCable)
    {
        $this->checkCrudPermission();

        $request->validate([
            'route_coordinates' => 'required|array',
            'length_meters'     => 'nullable|numeric|min:0',
        ]);

        $networkCable->route_coordinates = $request->route_coordinates;
        if ($request->filled('length_meters')) {
            $networkCable->length_meters = (float) $request->length_meters;
        }
        $networkCable->save();

        AuditLog::record(
            'UPDATE',
            'Infrastruktur Kabel Optik',
            "Pembaruan koordinat rute GIS tiang kabel {$networkCable->name} (Total: " . count($networkCable->route_coordinates) . " titik)",
            null,
            ['length_meters' => $networkCable->length_meters, 'points_count' => count($networkCable->route_coordinates)]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Rute tiang kabel berhasil disimpan!',
            'data'    => $networkCable,
        ]);
    }
}
