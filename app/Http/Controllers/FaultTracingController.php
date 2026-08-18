<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\FaultTracingService;
use App\Services\TelegramService;
use App\Models\AuditLog;
use App\Models\AppNotification;

class FaultTracingController extends Controller {
    protected FaultTracingService $service;

    public function __construct(FaultTracingService $service) {
        $this->service = $service;
    }

    public function cables() {
        return response()->json([
            'status' => 'success',
            'data' => $this->service->getCablesList(),
        ]);
    }

    public function nodes() {
        return response()->json([
            'status' => 'success',
            'data' => $this->service->getNodesList(),
        ]);
    }

    public function trace(Request $request) {
        $request->validate([
            'distance_meters'       => 'required|numeric|min:0',
            'cable_id'              => 'nullable',
            'start_node_id'         => 'nullable',
            'end_node_id'           => 'nullable',
            'core_id'               => 'nullable',
            'slack_count'           => 'nullable|integer|min:0',
            'slack_length_per_loop' => 'nullable|numeric|min:0',
            'slack_percentage'      => 'nullable|numeric|min:0',
        ]);

        $cableId = $request->cable_id ?? $request->cable_segment_id;

        $result = $this->service->traceOpticalBreak(
            (float) $request->distance_meters,
            !empty($cableId) ? (string) $cableId : null,
            !empty($request->start_node_id) ? (string) $request->start_node_id : null,
            !empty($request->end_node_id) ? (string) $request->end_node_id : null,
            !empty($request->core_id) ? (string) $request->core_id : null,
            (int) ($request->slack_count ?? 0),
            (float) ($request->slack_length_per_loop ?? 20.0),
            (float) ($request->slack_percentage ?? 0.0)
        );

        $fromNodeName = $result['from_node']['name'] ?? 'Titik Awal';
        $toNodeName   = $result['to_node']['name'] ?? 'Titik Sasaran';
        $estLoc       = $result['estimated_location'] ?? null;
        $nearestNode  = $result['nearest_infrastructure']['name'] ?? 'Titik terdekat';

        AuditLog::record(
            'OTDR_TRACE',
            'OTDR Tracing',
            "Eksekusi penembakan OTDR dari {$fromNodeName} ke {$toNodeName} - Jarak: {$request->distance_meters}m (Dekat {$nearestNode})",
            null,
            [
                'distance_meters' => $request->distance_meters,
                'cable_id'        => $cableId,
                'start_node'      => $fromNodeName,
                'end_node'        => $toNodeName,
                'break_coords'    => $estLoc ? ['lat' => $estLoc['lat'], 'lng' => $estLoc['lng']] : null,
                'nearest_node'    => $nearestNode,
            ]
        );

        return response()->json($result);
    }

    public function dispatchTelegram(Request $request) {
        $request->validate([
            'title'     => 'nullable|string',
            'message'   => 'required|string',
            'latitude'  => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        $title   = $request->title ?: '🚨 DISPATCH TIM MAINTENANCE OTDR';
        $message = $request->message;
        $mapUrl  = ($request->latitude && $request->longitude)
            ? "https://maps.google.com/?q={$request->latitude},{$request->longitude}"
            : '/otdr-tracing';

        // 1. Notifikasi In-App untuk seluruh operator NOC & Admin
        AppNotification::notifyAll(
            $title,
            "Hasil penembakan OTDR disiarkan ke tim lapangan. Klik untuk melihat peta detail lokasi putus.",
            'NOC',
            '/otdr-tracing'
        );

        // 2. Broadcast ke Grup / Channel Telegram NOC
        $telegramSent = TelegramService::send(
            $title,
            $message,
            'NOC',
            $mapUrl
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Tiket maintenance & koordinat GIS berhasil disiarkan ke Telegram channel NOC!',
            'telegram_sent' => $telegramSent,
        ]);
    }

    public function opticalDiagnostics() {
        $diagnostics = \App\Services\OpticalFaultLocalizationService::runDiagnostic();
        return response()->json([
            'status' => 'success',
            'data'   => $diagnostics,
        ]);
    }
}
