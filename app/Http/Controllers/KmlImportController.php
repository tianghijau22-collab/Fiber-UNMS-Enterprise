<?php

namespace App\Http\Controllers;

use App\Services\KmlImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KmlImportController extends Controller
{
    protected KmlImportService $kmlService;

    public function __construct(KmlImportService $kmlService)
    {
        $this->kmlService = $kmlService;
    }

    /**
     * Upload and preview KML/KMZ content
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:61440', // Max 60MB
        ]);

        try {
            $result = $this->kmlService->preview($request->file('file'));
            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('KML Preview Failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal membaca file KML/KMZ: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Execute stored KML import into database
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        try {
            $options = $request->except('token');
            $result = $this->kmlService->execute($request->input('token'), $options);
            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error('KML Execution Failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengimpor ke database: ' . $e->getMessage(),
            ], 500);
        }
    }
}
