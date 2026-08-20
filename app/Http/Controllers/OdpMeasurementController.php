<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\NetworkNode;
use App\Models\OdpMeasurement;
use App\Services\TelegramService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class OdpMeasurementController extends Controller
{
    /**
     * GET /api/odp-checks
     * Daftar histori pengukuran redaman ODP dengan filter
     */
    public function index(Request $request)
    {
        $query = OdpMeasurement::query()->with(['odpNode', 'technician']);

        // Filter pencarian teks
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('odp_code', 'ilike', "%{$search}%")
                  ->orWhere('odp_name', 'ilike', "%{$search}%")
                  ->orWhere('technician_name', 'ilike', "%{$search}%")
                  ->orWhere('notes', 'ilike', "%{$search}%")
                  ->orWhere('address_location', 'ilike', "%{$search}%");
            });
        }

        // Filter status redaman
        if ($request->filled('status') && in_array($request->status, ['good', 'warning', 'critical'])) {
            $query->where('power_status', $request->status);
        }

        // Filter ODP Node
        if ($request->filled('odp_node_id')) {
            $query->where('odp_node_id', $request->odp_node_id);
        }

        // Filter tanggal
        if ($request->filled('period')) {
            $now = Carbon::now();
            match ($request->period) {
                'today'      => $query->whereDate('created_at', $now->toDateString()),
                'yesterday'  => $query->whereDate('created_at', $now->copy()->subDay()->toDateString()),
                'this_week'  => $query->whereBetween('created_at', [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()]),
                'this_month' => $query->whereMonth('created_at', $now->month)->whereYear('created_at', $now->year),
                default      => null,
            };
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                Carbon::parse($request->start_date)->startOfDay(),
                Carbon::parse($request->end_date)->endOfDay()
            ]);
        }

        $perPage = min((int) ($request->per_page ?? 15), 100);
        $measurements = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $measurements,
        ]);
    }

    /**
     * GET /api/odp-checks/stats
     * Statistik ringkasan pengukuran redaman ODP
     */
    public function stats()
    {
        $today = Carbon::today();
        
        $totalAll = OdpMeasurement::count();
        $totalToday = OdpMeasurement::whereDate('created_at', $today)->count();
        
        $goodCount = OdpMeasurement::where('power_status', 'good')->count();
        $warningCount = OdpMeasurement::where('power_status', 'warning')->count();
        $criticalCount = OdpMeasurement::where('power_status', 'critical')->count();

        $latestChecks = OdpMeasurement::latest()->take(5)->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'total_all'      => $totalAll,
                'total_today'    => $totalToday,
                'good_count'     => $goodCount,
                'warning_count'  => $warningCount,
                'critical_count' => $criticalCount,
                'latest'         => $latestChecks,
            ],
        ]);
    }

    /**
     * GET /api/odp-checks/odp-options
     * Pilihan ODP untuk dropdown pencarian saat input lapangan
     */
    public function odpOptions(Request $request)
    {
        $query = NetworkNode::where('node_type', 'ODP')->orderBy('code', 'asc');

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('code', 'ilike', "%{$s}%")
                  ->orWhere('name', 'ilike', "%{$s}%")
                  ->orWhere('address', 'ilike', "%{$s}%");
            });
        }

        $odps = $query->take(50)->get(['id', 'code', 'name', 'latitude', 'longitude', 'address', 'total_ports', 'used_ports']);

        return response()->json([
            'success' => true,
            'data'    => $odps,
        ]);
    }

    /**
     * POST /api/odp-checks
     * Simpan hasil pengukuran redaman ODP dari lapangan
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'odp_code'              => 'required|string|max:100',
            'odp_name'              => 'nullable|string|max:255',
            'odp_node_id'           => 'nullable|integer|exists:network_nodes,id',
            'power_measurement_dbm' => 'required|numeric|between:-50,10',
            'port_number'           => 'required|string|max:50',
            'odp_condition'         => 'required|string|max:100',
            'latitude'              => 'nullable|numeric|between:-90,90',
            'longitude'             => 'nullable|numeric|between:-180,180',
            'address_location'      => 'nullable|string',
            'notes'                 => 'nullable|string',
            'forward_telegram'      => 'nullable|boolean',
            'technician_name'       => 'nullable|string|max:100',
        ]);

        $user = Auth::user();
        $dbm = (float) $validated['power_measurement_dbm'];

        // Tentukan power status secara otomatis berdasarkan batas standar GPON/EPON
        $powerStatus = 'good';
        if ($dbm < -27.00 || $dbm > -10.00) {
            $powerStatus = 'critical'; // Redaman terlalu loss (> -27 dBm) atau terlalu tinggi
        } elseif ($dbm < -24.00) {
            $powerStatus = 'warning'; // -24.01 s.d -27.00 dBm
        } else {
            $powerStatus = 'good'; // -10.00 s.d -24.00 dBm (Standar Ideal)
        }

        // Simpan foto ODP & OPM jika ada
        $odpPhotoPath = $this->saveImagePayload($request, 'odp_photo', 'odp_phys');
        $opmPhotoPath = $this->saveImagePayload($request, 'opm_photo', 'odp_opm');

        // Jika ODP node ID ada, lengkapi koordinat jika user tidak mengirimkan
        if (!empty($validated['odp_node_id']) && (empty($validated['latitude']) || empty($validated['longitude']))) {
            $node = NetworkNode::find($validated['odp_node_id']);
            if ($node) {
                $validated['latitude'] = $validated['latitude'] ?? $node->latitude;
                $validated['longitude'] = $validated['longitude'] ?? $node->longitude;
                $validated['odp_name'] = $validated['odp_name'] ?? $node->name;
            }
        }

        $measurement = OdpMeasurement::create([
            'odp_node_id'           => $validated['odp_node_id'] ?? null,
            'odp_code'              => trim($validated['odp_code']),
            'odp_name'              => $validated['odp_name'] ?? null,
            'technician_id'         => $user ? $user->id : null,
            'technician_name'       => $validated['technician_name'] ?? ($user ? $user->name : 'Teknisi Lapangan'),
            'power_measurement_dbm' => $dbm,
            'power_status'          => $powerStatus,
            'port_number'           => $validated['port_number'],
            'odp_condition'         => $validated['odp_condition'],
            'latitude'              => $validated['latitude'] ?? null,
            'longitude'             => $validated['longitude'] ?? null,
            'address_location'      => $validated['address_location'] ?? null,
            'notes'                 => $validated['notes'] ?? null,
            'odp_photo_path'        => $odpPhotoPath,
            'opm_photo_path'        => $opmPhotoPath,
            'forwarded_to_telegram' => false,
        ]);

        // Audit Log
        AuditLog::record(
            'CREATE',
            'Pengecekan ODP',
            "Pengukuran redaman ODP {$measurement->odp_code} Port {$measurement->port_number}: {$measurement->power_measurement_dbm} dBm ({$measurement->power_status})",
            null,
            $measurement->toArray()
        );

        // Jika diminta langsung forward ke Telegram
        $telegramResult = null;
        if (!empty($request->forward_telegram)) {
            $telegramResult = TelegramService::sendOdpCheckReport($measurement);
            if (!empty($telegramResult['success'])) {
                $measurement->update([
                    'forwarded_to_telegram' => true,
                    'telegram_sent_at'      => now(),
                ]);
            }
        }

        return response()->json([
            'success'         => true,
            'message'         => "Data pengukuran ODP '{$measurement->odp_code}' berhasil disimpan.",
            'data'            => $measurement->fresh(['odpNode', 'technician']),
            'telegram_result' => $telegramResult,
        ], 201);
    }

    /**
     * POST /api/odp-checks/{id}/forward-telegram
     * Meneruskan laporan pengukuran ke Telegram
     */
    public function forwardTelegram(int $id)
    {
        $measurement = OdpMeasurement::with(['odpNode', 'technician'])->findOrFail($id);

        $result = TelegramService::sendOdpCheckReport($measurement);

        if (!empty($result['success'])) {
            $measurement->update([
                'forwarded_to_telegram' => true,
                'telegram_sent_at'      => now(),
            ]);

            AuditLog::record(
                'UPDATE',
                'Pengecekan ODP',
                "Forward laporan ODP {$measurement->odp_code} ke Telegram oleh " . (Auth::user()?->name ?? 'System'),
                ['forwarded_to_telegram' => false],
                ['forwarded_to_telegram' => true]
            );

            return response()->json([
                'success' => true,
                'message' => "Laporan pengukuran ODP '{$measurement->odp_code}' berhasil diteruskan ke Telegram.",
                'data'    => $measurement,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Gagal meneruskan ke Telegram: ' . ($result['message'] ?? 'Periksa konfigurasi bot & channel Telegram.'),
        ], 422);
    }

    /**
     * DELETE /api/odp-checks/{id}
     * Hapus data pengukuran
     */
    public function destroy(int $id)
    {
        $measurement = OdpMeasurement::findOrFail($id);
        $code = $measurement->odp_code;

        $measurement->delete();

        AuditLog::record(
            'DELETE',
            'Pengecekan ODP',
            "Menghapus data pengukuran ODP {$code}",
            $measurement->toArray(),
            null
        );

        return response()->json([
            'success' => true,
            'message' => "Data pengukuran ODP '{$code}' berhasil dihapus.",
        ]);
    }

    /**
     * Helper simpan gambar dari file upload atau base64 data URI
     */
    private function saveImagePayload(Request $request, string $fieldKey, string $prefix): ?string
    {
        $dir = public_path('uploads/odp_checks');
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0775, true, true);
        }

        // 1. Dari Multipart File Upload
        if ($request->hasFile($fieldKey)) {
            $file = $request->file($fieldKey);
            $ext = $file->getClientOriginalExtension() ?: 'jpg';
            $filename = $prefix . '_' . time() . '_' . Str::random(8) . '.' . $ext;
            $file->move($dir, $filename);
            return 'uploads/odp_checks/' . $filename;
        }

        // 2. Dari Base64 Canvas Data URL
        if ($request->filled($fieldKey)) {
            $dataUrl = $request->input($fieldKey);
            if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $matches)) {
                $ext = strtolower($matches[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                $data = substr($dataUrl, strpos($dataUrl, ',') + 1);
                $decoded = base64_decode($data);
                if ($decoded !== false) {
                    $filename = $prefix . '_' . time() . '_' . Str::random(8) . '.' . $ext;
                    File::put($dir . '/' . $filename, $decoded);
                    return 'uploads/odp_checks/' . $filename;
                }
            }
        }

        return null;
    }
}
