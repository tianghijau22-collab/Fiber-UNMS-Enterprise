<?php

namespace App\Services;

use App\Models\{Customer, CustomerService, NetworkNode, OntRegistration, Ticket};
use App\Services\Olt\OnuTelemetryView;
use Illuminate\Database\Eloquent\Builder;

/** Read-only DTOs. Never use legacy registration Rx as a substitute for a missing sample. */
class AiAssistantData
{
    private ?OnuTelemetryView $view = null;

    private function view(): OnuTelemetryView { return $this->view ??= OnuTelemetryView::load(); }

    private function like(string $query): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower(trim($query))).'%';
    }

    private function match(Builder $query, array $fields, string $text): void
    {
        foreach ($fields as $field) $query->orWhereRaw('LOWER('.$field.') LIKE ? ESCAPE ?', [$this->like($text), '\\']);
    }

    private function services(string $text)
    {
        return CustomerService::with(['customer', 'networkPort.node.parent', 'ontRegistration.oltPort.node', 'servicePackage'])
            ->whereHas('customer')->where(function ($q) use ($text) {
                $this->match($q, ['onu_serial', 'service_number', 'pppoe_username'], $text);
                $q->orWhereHas('customer', fn ($c) => $c->where(fn ($p) => $this->match($p, ['name', 'customer_number', 'phone'], $text)))
                    ->orWhereHas('ontRegistration', fn ($o) => $o->where(fn ($p) => $this->match($p, ['onu_serial'], $text)));
            })->orderBy('id')->limit(11)->get()->each(function ($service) {
                if ($service->ontRegistration) $service->ontRegistration->setRelation('customerService', $service);
            });
    }

    public function optical(OntRegistration $ont): array
    {
        $service = $ont->customerService;
        $node = $service?->networkPort?->node ?: $ont->oltPort?->node;
        $sn = strtoupper(trim((string)($ont->onu_serial ?: $service?->onu_serial)));
        $v = $this->view()->forNode($node, $sn, $ont->onu_mac);
        $rx = $v['rx_available'] && $v['is_online'] === true ? $v['rx_power'] : null;
        $evaluation = $rx === null ? 'N/A — penyebab belum dapat dipastikan dari pembacaan ini.'
            : ($rx >= -19 ? 'Sangat Baik' : ($rx >= -23 ? 'Normal' : ($rx >= -27 ? 'Peringatan' : 'Kritis')));
        return [
            'customer_id' => $service?->customer_id, 'service_id' => $service?->id, 'ont_id' => $ont->id,
            'customer_name' => $service?->customer?->name ?? '—', 'customer_number' => $service?->customer?->customer_number ?? '—',
            'onu_serial' => $sn, 'ont_status' => $rx === null ? 'Offline' : 'Online',
            'hardware_status' => $v['onu_status'], 'hardware_online' => $v['is_online'], 'offline_by_rx' => $rx === null && $v['is_online'] !== false,
            'rx_power' => $rx === null ? 'N/A' : number_format($rx, 2, '.', '').' dBm', 'rx_power_dbm' => $rx,
            'rx_available' => $rx !== null, 'evaluation' => $evaluation,
            'odp_id' => $service?->networkPort?->node_id, 'odp_name' => $service?->networkPort?->node?->name ?? 'Tanpa ODP',
            'odp_port' => $service?->networkPort?->port_number ?? '—', 'upstream_odc' => $node?->parent?->name ?? '—',
            'gpon_interface' => $v['identity_status'] === 'resolved' ? ($v['gpon_interface'] ?? 'Belum terverifikasi') : 'Belum terverifikasi',
            'onu_id' => $v['onu_id'], 'olt_id' => $v['olt_id'], 'olt_name' => $v['olt_name'],
            'identity_status' => $v['identity_status'], 'sampled_at' => $v['sampled_at'],
            'telemetry_freshness' => $v['telemetry_freshness'], 'telemetry_reason' => $v['telemetry_reason'],
            'telemetry_source' => $v['telemetry_source'],
            'last_online_at' => $ont->last_online_at?->toIso8601String(),
        ];
    }

    public function searchCustomers(string $text): array
    {
        $services = $this->services($text);
        $rows = $services->take(10)->map(function ($s) {
            $optical = $s->ontRegistration ? $this->optical($s->ontRegistration) : [
                'rx_power' => 'N/A', 'ont_status' => 'Offline', 'identity_status' => 'unresolved',
                'telemetry_freshness' => 'unavailable', 'telemetry_reason' => 'registration_missing', 'sampled_at' => null,
            ];
            return array_merge($optical, [
                'id' => $s->customer_id, 'service_id' => $s->id, 'name' => $s->customer->name,
                'customer_number' => $s->customer->customer_number,
                'status' => $s->customer->status instanceof \BackedEnum ? $s->customer->status->value : (string)$s->customer->status,
                'package_name' => $s->servicePackage?->name ?? '—', 'service_number' => $s->service_number,
                // Personal contact details and PPPoE credentials are unnecessary for optical analysis.
            ]);
        })->values()->all();
        return ['status' => $rows ? 'success' : 'not_found', 'count' => count($rows), 'truncated' => $services->count() > 10, 'data' => $rows];
    }

    public function checkPower(string $text): array
    {
        $services = $this->services($text)->filter(fn ($s) => $s->ontRegistration)->values();
        if ($services->isEmpty()) return ['status' => 'not_found', 'message' => 'Perangkat atau layanan tidak ditemukan.'];
        if ($services->count() > 1) return ['status' => 'ambiguous', 'message' => 'Ada beberapa layanan yang cocok. Pilih nomor layanan atau nomor pelanggan yang dimaksud.',
            'candidates' => $services->take(10)->map(fn ($s) => ['service_id' => $s->id, 'service_number' => $s->service_number, 'customer_number' => $s->customer->customer_number, 'customer_name' => $s->customer->name, 'onu_serial' => $s->ontRegistration->onu_serial])->all()];
        return ['status' => 'success', ...$this->optical($services[0]->ontRegistration)];
    }

    public function searchNodes(string $text): array
    {
        $nodes = NetworkNode::with(['parent', 'oltDevice', 'ports.customerService.customer', 'ports.customerService.ontRegistration.oltPort.node', 'ports.customerService.networkPort.node'])
            ->where(fn ($q) => $this->match($q, ['name', 'code'], $text))->orderBy('id')->limit(4)->get();
        $rows = $nodes->map(function ($n) {
            $customers = [];
            foreach ($n->ports as $p) if ($p->customerService?->customer) {
                $s = $p->customerService;
                if ($s->ontRegistration) $s->ontRegistration->setRelation('customerService', $s);
                $customers[] = ['port' => $p->port_number, 'name' => $s->customer->name,
                    ...($s->ontRegistration ? $this->optical($s->ontRegistration) : ['rx_power' => 'N/A', 'ont_status' => 'Offline', 'telemetry_freshness' => 'unavailable'])];
            }
            $used = OnuTelemetryView::occupiedPortCount($n->ports);
            return ['id' => $n->id, 'name' => $n->name, 'code' => $n->code, 'type' => $n->node_type, 'status' => $n->status,
                'total_ports' => $n->ports->count(), 'used_ports' => $used, 'available_ports' => max(0, $n->ports->count() - $used),
                'parent_odc' => $n->parent?->name ?? '—', 'olt_device' => $n->oltDevice?->name ?? 'Belum terverifikasi',
                'olt_port_ref' => $n->olt_port_ref, 'connected_customers' => array_slice($customers, 0, 8), 'total_connected' => count($customers)];
        })->all();
        return ['status' => $rows ? 'success' : 'not_found', 'data' => $rows, 'count' => count($rows)];
    }

    private function registrations()
    {
        return OntRegistration::with(['customerService.customer', 'customerService.networkPort.node.parent', 'oltPort.node'])
            ->whereHas('customerService.customer')->orderBy('id')->get();
    }

    public function critical(float $threshold, int $limit): array
    {
        $affected = []; $unverified = 0; $observedOffline = 0;
        foreach ($this->registrations() as $ont) {
            $r = $this->optical($ont);
            if ($r['telemetry_freshness'] !== 'fresh' || $r['hardware_online'] === null) $unverified++;
            if ($r['hardware_online'] === false) $observedOffline++;
            if ($r['rx_power_dbm'] !== null && $r['rx_power_dbm'] > $threshold) continue;
            $r['severity'] = $r['rx_power_dbm'] === null ? 'N/A' : ($r['rx_power_dbm'] < -27 ? 'CRITICAL' : 'WARNING');
            $affected[] = $r;
        }
        usort($affected, fn ($a, $b) => (($a['rx_power_dbm'] ?? -100) <=> ($b['rx_power_dbm'] ?? -100)) ?: ($a['ont_id'] <=> $b['ont_id']));
        return ['status' => $affected ? 'success' : 'empty', 'threshold_used' => $threshold, 'total_detected' => count($affected),
            'unverified_count' => $unverified, 'observed_offline_count' => $observedOffline,
            'message' => $affected ? 'Termasuk Rx lemah dan N/A. Penyebab gangguan harus diperiksa; N/A bukan bukti titik kabel putus.' : 'Tidak ada hasil pada filter ini, berdasarkan sampel tersimpan yang tersedia.',
            'critical_list' => array_slice($affected, 0, $limit), 'generated_at' => now()->toIso8601String()];
    }

    public function maintenance(int $limit): array
    {
        $nodes = NetworkNode::with('parent', 'oltDevice')->where('status', 'maintenance')->orderBy('id')->limit($limit)->get();
        return ['status' => $nodes->isEmpty() ? 'empty' : 'success', 'total_node' => $nodes->count(),
            'message' => 'Hanya status pemeliharaan administratif; tidak membuktikan semua sambungan normal.',
            'nodes' => $nodes->map(fn ($n) => ['id' => $n->id, 'name' => $n->name, 'code' => $n->code, 'type' => $n->node_type, 'used_ports' => $n->used_ports, 'parent_odc' => $n->parent?->name, 'olt_device' => $n->oltDevice?->name])->all()];
    }

    public function summary(): array
    {
        $online = $down = $noRx = $unverified = 0;
        foreach ($this->registrations() as $ont) {
            $r = $this->optical($ont);
            if ($r['rx_available']) $online++; elseif ($r['hardware_online'] === false) $down++; else $noRx++;
            if ($r['telemetry_freshness'] !== 'fresh' || $r['hardware_online'] === null) $unverified++;
        }
        return ['status' => 'success', 'total_customers' => Customer::count(), 'active_customers' => Customer::where('status', 'active')->count(),
            'total_odp' => NetworkNode::where('node_type', 'ODP')->count(), 'total_odc' => NetworkNode::where('node_type', 'ODC')->count(),
            'nodes_maintenance' => NetworkNode::where('status', 'maintenance')->count(),
            'ont_total' => $online + $down + $noRx, 'ont_online' => $online, 'ont_los' => $down, 'ont_offline' => $noRx, 'ont_unverified' => $unverified,
            'open_tickets' => Ticket::whereIn('status', ['Open', 'In Progress'])->count(),
            'status_note' => 'Offline mengikuti tampilan N/A FONA. ont_los adalah perangkat terbaca offline, bukan kepastian LOS/kabel putus. ont_unverified merupakan bagian dari kategori tersebut, bukan tambahan total.',
            'generated_at' => now()->toIso8601String(), 'source' => 'stored_telemetry'];
    }

    public function tickets(string $status, int $limit): array
    {
        $query = Ticket::with('customer', 'networkNode')->orderByDesc('created_at')->orderByDesc('id');
        $map = ['open' => 'Open', 'in_progress' => 'In Progress', 'resolved' => 'Resolved', 'closed' => 'Closed'];
        if (isset($map[$status])) $query->where('status', $map[$status]);
        $tickets = $query->limit($limit)->get();
        return ['status' => $tickets->isEmpty() ? 'empty' : 'success', 'count' => $tickets->count(),
            'tickets' => $tickets->map(fn ($t) => ['id' => $t->id, 'ticket_number' => $t->ticket_number, 'title' => $t->title, 'category' => $t->category, 'priority' => $t->priority, 'status' => $t->status, 'customer_name' => $t->customer?->name, 'node_name' => $t->networkNode?->name, 'technician_name' => $t->technician_name, 'created_at' => $t->created_at?->toIso8601String()])->all()];
    }
}
