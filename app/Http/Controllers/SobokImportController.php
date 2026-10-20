<?php

namespace App\Http\Controllers;

use App\Http\Controllers\CustomerController;
use App\Models\Customer;
use App\Models\CustomerService;
use App\Models\NetworkNode;
use App\Models\NetworkPort;
use App\Models\OntRegistration;
use App\Models\ServicePackage;
use App\Models\AuditLog;
use App\Services\SobokScraperService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SobokImportController extends Controller
{
    protected SobokScraperService $scraperService;

    public function __construct(SobokScraperService $scraperService)
    {
        $this->scraperService = $scraperService;
    }

    /**
     * Scrape live customer data from Sobok
     */
    public function scrape(Request $request)
    {
        $username = $request->input('username', 'jasen');
        $password = $request->input('password', 'jasen2401');

        try {
            $result = $this->scraperService->scrape($username, $password);

            return response()->json([
                'status'  => 'success',
                'message' => "Berhasil menarik {$result['stats']['total_records']} data pelanggan dari Sobok.",
                'stats'   => $result['stats'],
                'source_meta'=>$result['source_meta']??[],
                'data'    => $result['records'],
            ]);
        } catch (\Exception $e) {
            Log::error("Sobok Scrape Error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Import a single customer record verified by user
     */
    public function importSingle(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'customer_number' => 'required|string|max:50',
            'address'         => 'nullable|string',
            'phone'           => 'nullable|string|max:50',
            'email'           => 'nullable|email|max:255',
            'odp_id'          => 'nullable|integer|exists:network_nodes,id',
            'onu_serial'      => 'nullable|string|max:100',
            'rx_power'        => 'nullable|numeric',
            'interface'       => 'nullable|string',
        ]);

        $validated += $request->validate([
            'mode'=>'sometimes|in:create,fill_missing',
            'expected_version'=>'required_if:mode,fill_missing|nullable|string|size:64',
        ]);
        $result=app(\App\Services\CustomerIntakeService::class)->save($validated);
        return response()->json(['status'=>'success','message'=>$result['updated']?'Data kosong berhasil dilengkapi. Data yang sudah terisi dipertahankan.':'Pelanggan berhasil ditambahkan.','data'=>$result['customer'],'updated'=>$result['updated']]);
    }

    /**
     * Batch import multiple verified records
     */
    public function importBatch(Request $request)
    {
        $records = $request->input('records', []);
        if (empty($records) || !is_array($records)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Tidak ada data pelanggan yang dipilih untuk diimpor.',
            ], 400);
        }

        $imported = 0;
        $failed = 0;
        $errors = [];

        foreach ($records as $item) {
            try {
                $subRequest = new Request($item);
                $response = $this->importSingle($subRequest);
                if ($response->getStatusCode() === 200) {
                    $imported++;
                } else {
                    $failed++;
                    $content = json_decode($response->getContent(), true);
                    $errors[] = ($item['name'] ?? 'Pelanggan') . ': ' . ($content['message'] ?? 'Error');
                }
            } catch (\Exception $e) {
                $failed++;
                $errors[] = ($item['name'] ?? 'Pelanggan') . ': ' . $e->getMessage();
            }
        }

        return response()->json([
            'status'   => 'success',
            'message'  => "Berhasil mengimpor {$imported} pelanggan." . ($failed > 0 ? " ({$failed} gagal)" : ""),
            'imported' => $imported,
            'failed'   => $failed,
            'errors'   => $errors,
        ]);
    }

    /**
     * Sinkronisasi Status Layanan Pelanggan (OPEN vs BLOKIR) dari Sobok secara langsung
     */
    public function syncServiceStatus(Request $request)
    {
        $username = $request->input('username', 'jasen');
        $password = $request->input('password', 'jasen2401');

        try {
            $result = $this->scraperService->syncServiceStatuses($username, $password);
            CustomerController::clearCustomerCache();

            return response()->json([
                'status'  => 'success',
                'message' => "Berhasil menyinkronkan status layanan dari Sobok via {$result['domain_used']}: {$result['open_count']} Open, {$result['blocked_count']} Terblokir.",
                'data'    => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error("Sobok Status Sync Error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyinkronkan status layanan Sobok: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Ambil metadata status sinkronisasi Sobok terakhir
     */
    public function getSyncMeta()
    {
        $meta = \Illuminate\Support\Facades\Cache::get('sobok_service_status_meta');
        if (!$meta) {
            $lastSync = CustomerService::whereNotNull('sobok_sync_at')->max('sobok_sync_at');
            $open = CustomerService::where('sobok_service_status', 'OPEN')->count();
            $blocked = CustomerService::where('sobok_service_status', 'BLOKIR')->count();

            $meta = [
                'status'          => 'ready',
                'domain_used'     => 'sobok.cinoxmedianet.id',
                'open_count'      => $open,
                'blocked_count'   => $blocked,
                'synced_at'       => $lastSync,
                'synced_at_human' => $lastSync ? \Carbon\Carbon::parse($lastSync)->diffForHumans() : 'Belum pernah',
            ];
        }

        return response()->json([
            'status' => 'success',
            'data'   => $meta,
        ]);
    }
}

