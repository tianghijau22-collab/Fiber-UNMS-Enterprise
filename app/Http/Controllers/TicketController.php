<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\Customer;
use App\Models\NetworkNode;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\AppNotification;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;

class TicketController extends Controller
{
    const CATEGORIES = [
        'Gangguan ODP',
        'Pemasangan ODP Baru',
        'Gangguan INTERFACE',
        'Gangguan BTS / CORPORATE',
        'Fiber Cut',
    ];

    /**
     * GET /api/tickets/reference-data
     * Memuat master data referensi (Node ODP/POP dan User Teknisi)
     */
    public function referenceData()
    {
        // 1. Ambil data user aktif untuk penugasan teknisi
        $technicians = User::select('id', 'name', 'username', 'role', 'division', 'phone')
            ->orderBy('name')
            ->get();

        // 2. Ambil data node infrastruktur (ODP, ODC, POP, BTS)
        $nodes = NetworkNode::select('id', 'name', 'code', 'node_type', 'latitude', 'longitude', 'address')
            ->orderBy('name')
            ->get();

        // 3. Ringkasan KPI
        $all = Ticket::all();
        $summary = [
            'total'       => $all->count(),
            'open'        => $all->where('status', 'Open')->count(),
            'in_progress' => $all->where('status', 'In Progress')->count(),
            'resolved'    => $all->where('status', 'Resolved')->count(),
            'closed'      => $all->where('status', 'Closed')->count(),
        ];

        return response()->json([
            'status'      => 'success',
            'categories'  => self::CATEGORIES,
            'technicians' => $technicians,
            'nodes'       => $nodes,
            'summary'     => $summary,
        ]);
    }

    public function index(Request $request)
    {
        $query = Ticket::with(['customer', 'networkNode']);

        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && $request->category !== 'ALL') {
            $query->where('category', $request->category);
        }

        if ($request->filled('technician') && $request->technician !== 'ALL') {
            $query->where('technician_name', 'like', "%{$request->technician}%");
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('ticket_number', 'like', "%{$s}%")
                  ->orWhere('title', 'like', "%{$s}%")
                  ->orWhere('technician_name', 'like', "%{$s}%")
                  ->orWhereHas('networkNode', function ($nq) use ($s) {
                      $nq->where('name', 'like', "%{$s}%")
                        ->orWhere('code', 'like', "%{$s}%");
                  });
            });
        }

        $tickets = $query->orderBy('created_at', 'desc')->get();

        $allTickets = Ticket::all();
        $summary = [
            'total'       => $allTickets->count(),
            'open'        => $allTickets->where('status', 'Open')->count(),
            'in_progress' => $allTickets->where('status', 'In Progress')->count(),
            'resolved'    => $allTickets->where('status', 'Resolved')->count(),
            'closed'      => $allTickets->where('status', 'Closed')->count(),
        ];

        return response()->json([
            'status'  => 'success',
            'data'    => $tickets,
            'summary' => $summary,
        ]);
    }

    public function store(Request $request)
    {
        $currentUser = auth()->user() ?? auth('sanctum')->user() ?? $request->user();
        $isOperatorOrAdmin = $currentUser && in_array($currentUser->role, ['Super Administrator', 'Operator Jaringan', 'NOC Operator']);

        $validated = $request->validate([
            'title'             => 'required|string|max:255',
            'description'       => 'nullable|string',
            'category'          => 'required|string',
            'status'            => 'required|string|in:Open,In Progress,Resolved,Closed',
            'network_node_id'   => 'nullable|exists:network_nodes,id',
            'technician_name'   => 'nullable|string|max:500',
            'technician_names'  => 'nullable|array',
            'created_by_name'   => 'nullable|string|max:255',
            'dispatch_telegram' => 'nullable|boolean',
        ]);

        // Support multi-tag technicians array
        if ($request->has('technician_names') && is_array($request->technician_names)) {
            $validated['technician_name'] = implode(', ', array_filter($request->technician_names));
        }
        unset($validated['technician_names']);

        // Default prioritas sistem
        $validated['priority'] = 'Normal';

        // Auto-generate ticket number
        $year = date('Y');
        $count = Ticket::whereYear('created_at', $year)->count() + 1;
        $validated['ticket_number'] = sprintf('TICK-%s-%04d', $year, $count);

        $creatorName = $currentUser?->name ?? $request->input('created_by_name') ?? 'Super Administrator';
        unset($validated['created_by_name']);

        $techTag = !empty($validated['technician_name']) ? " (Teknisi: {$validated['technician_name']})" : "";

        $validated['timeline_logs'] = [
            [
                'time'      => Carbon::now()->format('H:i (d M Y)'),
                'user'      => $creatorName,
                'action'    => "Tiket dibuat dengan status '{$validated['status']}'{$techTag}.",
                'comment'   => $validated['description'] ?? null,
                'photo_url' => null,
            ]
        ];

        if ($validated['status'] === 'Resolved' || $validated['status'] === 'Closed') {
            $validated['resolved_at'] = Carbon::now();
        }

        $dispatchTelegram = $request->boolean('dispatch_telegram', false);
        unset($validated['dispatch_telegram']);

        $ticket = Ticket::create($validated);

        AuditLog::record(
            'CREATE',
            'Ticketing & Work Order',
            "Membuat tiket jointer {$ticket->ticket_number}: {$ticket->title} (Kategori: {$ticket->category})",
            null,
            ['ticket_number' => $ticket->ticket_number, 'title' => $ticket->title, 'status' => $ticket->status, 'technician' => $ticket->technician_name]
        );

        AppNotification::notifyAll(
            "Tiket Jointer Baru #{$ticket->ticket_number}",
            "{$ticket->category}: {$ticket->title}" . ($ticket->technician_name ? " (Ditugaskan: {$ticket->technician_name})" : ""),
            'NOC',
            '/tickets'
        );

        if ($dispatchTelegram) {
            $this->sendTelegramNotification($ticket);
        }

        return response()->json([
            'status'  => 'success',
            'message' => "Tiket '{$ticket->ticket_number}' berhasil dibuat!",
            'data'    => $ticket->load(['networkNode']),
        ], 201);
    }

    public function update(Request $request, Ticket $ticket)
    {
        $currentUser = auth()->user();
        $isOperatorOrAdmin = $currentUser && in_array($currentUser->role, ['Super Administrator', 'Operator Jaringan', 'NOC Operator']);

        $validated = $request->validate([
            'title'             => 'sometimes|required|string|max:255',
            'description'       => 'nullable|string',
            'category'          => 'sometimes|required|string',
            'status'            => 'sometimes|required|string|in:Open,In Progress,Resolved,Closed',
            'network_node_id'   => 'nullable|exists:network_nodes,id',
            'technician_name'   => 'nullable|string|max:255',
            'log_note'          => 'nullable|string',
        ]);

        // Pembatasan RBAC: Hanya Super Administrator dan Operator yang berhak menutup (Closed) tiket
        if (isset($validated['status']) && $validated['status'] === 'Closed' && !$isOperatorOrAdmin) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Hanya Super Administrator dan Operator yang memiliki wewenang untuk menutup (Closed) tiket.',
            ], 403);
        }

        // Jika bukan superadmin / operator, cegah perubahan teknisi/title/kategori
        if (!$isOperatorOrAdmin) {
            unset($validated['technician_name']);
            unset($validated['title']);
            unset($validated['category']);
        }

        $logs = $ticket->timeline_logs ?? [];
        $userName = $currentUser?->name ?? 'Tim Teknis';
        $userRole = $currentUser?->role ?? 'Teknisi';
        $previousStatus = $ticket->status;

        if (!empty($request->log_note)) {
            $logs[] = [
                'time'      => Carbon::now()->format('H:i (d M Y)'),
                'user'      => $userName,
                'role'      => $userRole,
                'action'    => "Laporan Progres Kerja",
                'comment'   => $request->log_note,
                'photo_url' => null,
            ];
            $validated['timeline_logs'] = $logs;
        } else if (isset($validated['status']) && $validated['status'] !== $ticket->status) {
            $logs[] = [
                'time'      => Carbon::now()->format('H:i (d M Y)'),
                'user'      => $userName,
                'role'      => $userRole,
                'action'    => "Status tiket diubah dari '{$ticket->status}' menjadi '{$validated['status']}'.",
                'comment'   => null,
                'photo_url' => null,
            ];
            $validated['timeline_logs'] = $logs;
        }

        if (isset($validated['status']) && in_array($validated['status'], ['Resolved', 'Closed']) && !$ticket->resolved_at) {
            $validated['resolved_at'] = Carbon::now();
        }

        $ticket->update($validated);

        // Notifikasi Telegram otomatis saat tiket berstatus Resolved
        if (isset($validated['status']) && $validated['status'] === 'Resolved' && $previousStatus !== 'Resolved') {
            $this->sendResolvedTelegramNotification($ticket, $request->log_note, $userName);
            AppNotification::notifyAll(
                "Tiket #{$ticket->ticket_number} Telah Selesai (Resolved)",
                "{$ticket->category}: {$ticket->title} telah diselesaikan oleh {$userName}",
                'NOC',
                '/tickets'
            );
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Data tiket berhasil diperbarui!',
            'data'    => $ticket->fresh(['networkNode']),
        ]);
    }

    /**
     * POST /api/tickets/{id}/add-progress
     * Teknisi menambahkan update tindakan lapangan disertai upload foto bukti kerja
     */
    public function addProgress(Request $request, $id)
    {
        try {
            $ticket = Ticket::findOrFail($id);
            $currentUser = auth()->user();
            $isOperatorOrAdmin = $currentUser && in_array($currentUser->role, ['Super Administrator', 'Operator Jaringan', 'NOC Operator']);

            $request->validate([
                'comment'      => 'required|string|max:2000',
                'status'       => 'nullable|string|in:Open,In Progress,Resolved,Closed',
                'photo_base64' => 'nullable|string',
            ]);

            // Pembatasan RBAC: Hanya Super Administrator dan Operator yang berhak menutup (Closed) tiket
            if ($request->input('status') === 'Closed' && !$isOperatorOrAdmin) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Hanya Super Administrator dan Operator yang memiliki wewenang untuk menutup (Closed) tiket.',
                ], 403);
            }

            $photoUrl = null;

            // 1. Dukungan Base64 Upload (Bebas kendala izin folder temporary Windows)
            if ($request->filled('photo_base64')) {
                $base64Data = $request->input('photo_base64');
                $uploadDir = public_path('uploads/tickets');
                if (!File::isDirectory($uploadDir)) {
                    File::makeDirectory($uploadDir, 0777, true, true);
                }

                $ext = 'jpg';
                if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
                    $ext = strtolower($type[1]);
                    $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
                } else if (preg_match('/^data:video\/(\w+);base64,/', $base64Data, $type)) {
                    $ext = strtolower($type[1]);
                    $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
                }

                if ($ext === 'jpeg') $ext = 'jpg';
                $decodedData = base64_decode($base64Data);
                if ($decodedData !== false) {
                    $filename = 'ticket_' . $ticket->id . '_' . time() . '_' . uniqid() . '.' . $ext;
                    file_put_contents($uploadDir . DIRECTORY_SEPARATOR . $filename, $decodedData);
                    $photoUrl = '/uploads/tickets/' . $filename;
                }
            } else if ($request->hasFile('photo') && $request->file('photo')->isValid()) {
                $file = $request->file('photo');
                $uploadDir = public_path('uploads/tickets');
                if (!File::isDirectory($uploadDir)) {
                    File::makeDirectory($uploadDir, 0777, true, true);
                }
                $ext = $file->getClientOriginalExtension() ?: 'jpg';
                $filename = 'ticket_' . $ticket->id . '_' . time() . '_' . uniqid() . '.' . $ext;
                $file->move($uploadDir, $filename);
                $photoUrl = '/uploads/tickets/' . $filename;
            }

            $userName = $currentUser?->name ?? $request->input('technician_name', $ticket->technician_name ?: 'Teknisi Jointer');
            $userRole = $currentUser?->role ?? $request->input('technician_role', 'Teknisi Jointer');
            $previousStatus = $ticket->status;

            $logs = $ticket->timeline_logs ?? [];
            $actionTitle = $request->filled('status') && $request->status !== $ticket->status
                ? "Status diubah ke '{$request->status}' & Update Tindakan"
                : "Update Tindakan & Progres Lapangan";

            $logs[] = [
                'time'      => Carbon::now()->format('H:i (d M Y)'),
                'user'      => $userName,
                'role'      => $userRole,
                'action'    => $actionTitle,
                'comment'   => $request->input('comment'),
                'photo_url' => $photoUrl,
            ];

            $updateData = ['timeline_logs' => $logs];
            if ($request->filled('status')) {
                $updateData['status'] = $request->status;
                if (in_array($request->status, ['Resolved', 'Closed']) && !$ticket->resolved_at) {
                    $updateData['resolved_at'] = Carbon::now();
                }
            }

            $ticket->update($updateData);

            // Notifikasi Telegram otomatis saat tiket diubah ke Resolved oleh teknisi
            if ($request->input('status') === 'Resolved' && $previousStatus !== 'Resolved') {
                $this->sendResolvedTelegramNotification($ticket, $request->input('comment'), $userName);
                AppNotification::notifyAll(
                    "Tiket #{$ticket->ticket_number} Telah Selesai (Resolved)",
                    "{$ticket->category}: {$ticket->title} telah diselesaikan oleh {$userName}",
                    'NOC',
                    '/tickets'
                );
            }

            return response()->json([
                'status'  => 'success',
                'message' => 'Laporan tindakan dan bukti kerja berhasil ditambahkan!',
                'data'    => $ticket->fresh(['networkNode']),
            ]);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            return response()->json([
                'status'  => 'error',
                'message' => collect($ve->errors())->flatten()->first() ?: 'Validasi input tidak sesuai',
                'errors'  => $ve->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyimpan laporan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/public/tickets/{ticketNumber}
     * Pelacakan tiket terbuka untuk umum / tanpa login
     */
    public function publicTrack($ticketNumber)
    {
        $cleanNumber = trim($ticketNumber);
        $ticket = Ticket::with(['networkNode'])
            ->where('ticket_number', 'ilike', $cleanNumber)
            ->orWhere('id', is_numeric($cleanNumber) ? (int)$cleanNumber : 0)
            ->first();

        if (!$ticket) {
            return response()->json([
                'status'  => 'error',
                'message' => "Tiket dengan nomor '{$ticketNumber}' tidak ditemukan di sistem.",
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data'   => [
                'ticket_number'   => $ticket->ticket_number,
                'title'           => $ticket->title,
                'description'     => $ticket->description,
                'category'        => $ticket->category,
                'status'          => $ticket->status,
                'technician_name' => $ticket->technician_name ?: 'Tim Jointer / Dalam Penugasan',
                'location'        => $ticket->networkNode ? [
                    'name'      => $ticket->networkNode->name,
                    'code'      => $ticket->networkNode->code,
                    'node_type' => $ticket->networkNode->node_type,
                    'address'   => $ticket->networkNode->address,
                    'latitude'  => $ticket->networkNode->latitude,
                    'longitude' => $ticket->networkNode->longitude,
                ] : null,
                'created_at'      => $ticket->created_at->format('d M Y H:i'),
                'created_human'   => $ticket->created_at->diffForHumans(),
                'resolved_at'     => $ticket->resolved_at ? $ticket->resolved_at->format('d M Y H:i') : null,
                'timeline_logs'   => $ticket->timeline_logs ?? [],
            ],
        ]);
    }

    public function destroy(Ticket $ticket)
    {
        $deletedTicket = $ticket->only(['ticket_number', 'title', 'status']);
        $ticket->delete();

        AuditLog::record(
            'DELETE',
            'Ticketing & Work Order',
            "Menghapus tiket {$deletedTicket['ticket_number']} - {$deletedTicket['title']}",
            $deletedTicket,
            null
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Tiket berhasil dihapus!',
        ]);
    }

    /**
     * POST /api/tickets/{id}/dispatch-telegram
     */
    public function dispatchTelegram($id)
    {
        $ticket = Ticket::with(['networkNode'])->findOrFail($id);
        $sent = $this->sendTelegramNotification($ticket);

        return response()->json([
            'status'  => 'success',
            'message' => $sent ? 'Notifikasi tugas tiket berhasil disiarkan ke Telegram!' : 'Gagal mengirim Telegram (Periksa bot token / channel).',
            'sent'    => $sent,
        ]);
    }

    private function sendTelegramNotification(Ticket $ticket): bool
    {
        try {
            $nodeInfo = $ticket->networkNode ? "{$ticket->networkNode->name} ({$ticket->networkNode->code})" : 'Infrastruktur Jaringan / Umum';
            $techName = $ticket->technician_name ?: 'Belum Ditugaskan';
            $desc = $ticket->description ?: 'Tidak ada rincian kendala tambahan.';
            $trackUrl = "http://127.0.0.1:8000/track-ticket/{$ticket->ticket_number}";

            $title = "WORK ORDER JOINTER #{$ticket->ticket_number}";
            
            $body = "<b>INFORMASI PEKERJAAN</b>\n"
                . "• <b>Judul:</b> " . htmlspecialchars($ticket->title) . "\n"
                . "• <b>Kategori:</b> " . htmlspecialchars($ticket->category) . "\n"
                . "• <b>Titik Lokasi / Node:</b> " . htmlspecialchars($nodeInfo) . "\n"
                . "• <b>Tim Teknis Ditugaskan:</b> " . htmlspecialchars($techName) . "\n\n"
                . "<b>KENDALA / PERMASALAHAN</b>\n"
                . htmlspecialchars($desc) . "\n\n"
                . "<b>LINK PELACAKAN PUBLIK</b>\n"
                . "<code>{$trackUrl}</code>";

            $mapUrl = ($ticket->networkNode && $ticket->networkNode->latitude && $ticket->networkNode->longitude)
                ? "https://maps.google.com/?q={$ticket->networkNode->latitude},{$ticket->networkNode->longitude}"
                : $trackUrl;

            return TelegramService::send($title, $body, 'NOC', $mapUrl);
        } catch (\Throwable $e) {
            \Log::error('Dispatch telegram ticket failed: ' . $e->getMessage());
            return false;
        }
    }

    private function sendResolvedTelegramNotification(Ticket $ticket, ?string $resolutionComment = null, ?string $userName = null): bool
    {
        try {
            $nodeInfo = $ticket->networkNode ? "{$ticket->networkNode->name} ({$ticket->networkNode->code})" : 'Infrastruktur Jaringan / Umum';
            $techName = $ticket->technician_name ?: ($userName ?: 'Tim Teknis');
            $actionNotes = !empty($resolutionComment) ? $resolutionComment : ($ticket->description ?: 'Pekerjaan perbaikan telah diselesaikan oleh tim teknis lapangan.');
            $trackUrl = "http://127.0.0.1:8000/track-ticket/{$ticket->ticket_number}";

            $title = "LAPORAN PEKERJAAN SELESAI (RESOLVED) #{$ticket->ticket_number}";
            
            $body = "<b>INFORMASI TIKET SELESAI</b>\n"
                . "• <b>Judul:</b> " . htmlspecialchars($ticket->title) . "\n"
                . "• <b>Kategori:</b> " . htmlspecialchars($ticket->category) . "\n"
                . "• <b>Titik Lokasi / Node:</b> " . htmlspecialchars($nodeInfo) . "\n"
                . "• <b>Status:</b> Selesai Diperbaiki (Resolved)\n"
                . "• <b>Tim Teknis / Pelapor:</b> " . htmlspecialchars($techName) . "\n\n"
                . "<b>TINDAKAN PENYELESAIAN</b>\n"
                . htmlspecialchars($actionNotes) . "\n\n"
                . "<b>LINK PELACAKAN PUBLIK</b>\n"
                . "<code>{$trackUrl}</code>";

            $mapUrl = ($ticket->networkNode && $ticket->networkNode->latitude && $ticket->networkNode->longitude)
                ? "https://maps.google.com/?q={$ticket->networkNode->latitude},{$ticket->networkNode->longitude}"
                : $trackUrl;

            return TelegramService::send($title, $body, 'NOC', $mapUrl);
        } catch (\Throwable $e) {
            \Log::error('Dispatch telegram resolved ticket failed: ' . $e->getMessage());
            return false;
        }
    }
}
