<?php

namespace App\Http\Controllers;

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
        ]);

        try {
            $customerNumber = trim($validated['customer_number']);

            // Normalize customer number format: ensure CMN prefix is neat
            if (preg_match('/^CMN\s*(\d+)$/i', $customerNumber, $m)) {
                $customerNumber = sprintf('CMN %04d', (int)$m[1]);
            } elseif (preg_match('/^\d+$/', $customerNumber)) {
                $customerNumber = sprintf('CMN %04d', (int)$customerNumber);
            }

            // Check if customer_number already exists
            $existsNum = Customer::where('customer_number', $customerNumber)
                ->orWhere('customer_number', str_replace(' ', '', $customerNumber))
                ->first();

            if ($existsNum) {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Pelanggan dengan nomor {$customerNumber} sudah terdaftar di sistem ({$existsNum->name}).",
                ], 422);
            }

            // Check if ONU SN already exists on another customer (record note if shared/duplicate)
            $sn = !empty($validated['onu_serial']) ? trim($validated['onu_serial']) : null;
            $duplicateSnNote = null;
            if ($sn) {
                $existsOnt = OntRegistration::where('onu_serial', $sn)->first()
                    ?: CustomerService::where('onu_serial', $sn)->first();

                if ($existsOnt) {
                    $otherCust = $existsOnt instanceof OntRegistration
                        ? $existsOnt->customerService?->customer
                        : $existsOnt->customer;
                    $otherName = $otherCust ? "{$otherCust->name} ({$otherCust->customer_number})" : "Pelanggan lain";
                    $duplicateSnNote = "SN Kembar/Berbagi dengan {$otherName}";
                }
            } else {
                $sn = sprintf('HWTC-%08X', rand(10000000, 99999999));
            }

            $created = DB::transaction(function () use ($validated, $customerNumber, $sn, $duplicateSnNote) {
                // 1. Create Customer
                $customer = Customer::create([
                    'customer_number' => $customerNumber,
                    'name'            => $validated['name'],
                    'phone'           => !empty($validated['phone']) ? $validated['phone'] : '-',
                    'email'           => $validated['email'] ?? null,
                    'address'         => !empty($validated['address']) ? $validated['address'] : 'Solok, Sumatera Barat',
                    'status'          => 'active',
                ]);

                // 2. Resolve Service Package
                $package = ServicePackage::first();
                $packageId = $package ? $package->id : null;

                // 3. Create CustomerService
                $service = CustomerService::create([
                    'service_number'     => CustomerService::generateUniqueServiceNumber(),
                    'customer_id'        => $customer->id,
                    'service_package_id' => $packageId,
                    'status'             => 'active',
                    'installation_date'  => now(),
                    'activated_at'       => now(),
                    'onu_serial'         => $sn,
                ]);

                // 4. Bind to ODP Port if ODP node selected
                $odpId = $validated['odp_id'] ?? null;
                $boundPort = null;

                if ($odpId) {
                    // Find first available port on this ODP
                    $port = NetworkPort::where('node_id', $odpId)
                        ->where(function ($q) {
                            $q->where('status', 'available')
                              ->orWhereNull('customer_service_id');
                        })
                        ->whereNull('customer_service_id')
                        ->orderBy('port_number', 'asc')
                        ->first();

                    if ($port) {
                        $port->update([
                            'customer_service_id' => $service->id,
                            'customer_name_cache' => $customer->name,
                            'status'              => 'used',
                        ]);
                        NetworkPort::recalculateNodeUsedPorts($odpId);
                        $boundPort = $port->port_number;
                    }
                }

                // 5. Create OntRegistration
                $notes = 'Diimpor dari Sobok';
                if ($duplicateSnNote) {
                    $notes .= " ({$duplicateSnNote})";
                }

                OntRegistration::create([
                    'customer_service_id' => $service->id,
                    'onu_serial'          => $sn,
                    'onu_type'            => 'HGU GPON/EPON',
                    'status'              => 'active',
                    'registered_at'       => now(),
                    'last_online_at'      => now(),
                    'rx_power'            => $validated['rx_power'] ?? -19.50,
                    'tx_power'            => 2.10,
                    'notes'               => $notes,
                ]);

                AuditLog::record(
                    'IMPORT',
                    'Customer Management',
                    "Menambahkan pelanggan dari Sobok: {$customer->name} ({$customer->customer_number})" . ($boundPort ? " ke Port ODP {$boundPort}" : "") . ($duplicateSnNote ? " [{$duplicateSnNote}]" : ""),
                    null,
                    ['customer_id' => $customer->id, 'customer_number' => $customer->customer_number, 'onu_serial' => $sn]
                );

                return [
                    'customer'   => $customer,
                    'bound_port' => $boundPort,
                ];
            });

            $successMsg = "Pelanggan {$created['customer']->name} ({$created['customer']->customer_number}) berhasil ditambahkan ke sistem!" . ($created['bound_port'] ? " (Port ODP {$created['bound_port']})" : "");
            if ($duplicateSnNote) {
                $successMsg .= " ℹ️ Info: {$duplicateSnNote}";
            }

            return response()->json([
                'status'  => 'success',
                'message' => $successMsg,
                'data'    => $created['customer'],
            ]);
        } catch (\Exception $e) {
            Log::error("Sobok Import Single Error: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menambahkan pelanggan: ' . $e->getMessage(),
            ], 500);
        }
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
}
