<?php

namespace App\Http\Controllers;

use App\Models\BtsSite;
use App\Models\NetworkNode;
use App\Services\MikrotikSfpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BtsSiteController extends Controller
{
    /**
     * Auto seed initial BTS sample data from user reference image if table is empty
     */
    private function autoSeedIfEmpty()
    {
        if (BtsSite::count() === 0) {
            $samples = [
                [
                    'name'                => 'BTS SMK 3',
                    'link_segment'        => 'LINK -VIA KP JAWA(SMK3)',
                    'code'                => 'BTS-SMK3-01',
                    'measurement_date'    => '2025-01-06',
                    'sfp_sm_link_length'  => '10Km',
                    'sfp_vendor'          => 'WTD',
                    'tx_power'            => -2.264,
                    'rx_power'            => -9.570,
                    'cable_length_km'     => 5.17,
                    'tube_number'         => 1,
                    'tube_color'          => 'Biru (Blue)',
                    'core_number'         => 1,
                    'core_color'          => 'Biru (Blue)',
                    'latitude'            => -0.792514,
                    'longitude'           => 100.658231,
                    'address'             => 'SMK Negeri 3 Kota Solok, Jl. Ki Hajar Dewantara',
                    'mikrotik_ip'         => '10.20.10.1',
                    'sfp_port_name'       => 'sfp-sfpplus1',
                ],
                [
                    'name'                => 'BTS SMK 3 (SW-FO-KP JAWA 01)',
                    'link_segment'        => 'SW -FO- KP JAWA 01',
                    'code'                => 'BTS-SMK3-02',
                    'measurement_date'    => '2025-05-27',
                    'sfp_sm_link_length'  => '20Km',
                    'sfp_vendor'          => 'HISENSE',
                    'tx_power'            => -3.147,
                    'rx_power'            => -6.734,
                    'cable_length_km'     => 5.17,
                    'tube_number'         => 1,
                    'tube_color'          => 'Biru (Blue)',
                    'core_number'         => 2,
                    'core_color'          => 'Orange',
                    'latitude'            => -0.793110,
                    'longitude'           => 100.659100,
                    'address'             => 'Switch Hub FO Kampung Jawa, Kota Solok',
                    'mikrotik_ip'         => '10.20.10.2',
                    'sfp_port_name'       => 'sfp-sfpplus2',
                ],
                [
                    'name'                => 'BTS PRUMNAS KOBAR',
                    'link_segment'        => 'BACKBONE FEEDER PRUMNAS',
                    'code'                => 'BTS-KOBAR-01',
                    'measurement_date'    => '2025-01-06',
                    'sfp_sm_link_length'  => '20Km',
                    'sfp_vendor'          => 'HISENSE',
                    'tx_power'            => -2.873,
                    'rx_power'            => -11.056,
                    'cable_length_km'     => 8.38,
                    'tube_number'         => 2,
                    'tube_color'          => 'Orange',
                    'core_number'         => 3,
                    'core_color'          => 'Hijau (Green)',
                    'latitude'            => -0.804215,
                    'longitude'           => 100.641205,
                    'address'             => 'Perumahan Nasional Koto Baru, Solok',
                    'mikrotik_ip'         => '10.20.20.1',
                    'sfp_port_name'       => 'sfp-sfpplus1',
                ],
                [
                    'name'                => 'BTS SMPN 6 KOTA SOLOK',
                    'link_segment'        => 'TO-BTS-SMPN 6',
                    'code'                => 'BTS-SMP6-01',
                    'measurement_date'    => '2025-01-06',
                    'sfp_sm_link_length'  => '20Km',
                    'sfp_vendor'          => 'MIKROBITS',
                    'tx_power'            => -4.992,
                    'rx_power'            => -9.613,
                    'cable_length_km'     => 4.16,
                    'tube_number'         => 1,
                    'tube_color'          => 'Biru (Blue)',
                    'core_number'         => 4,
                    'core_color'          => 'Coklat (Brown)',
                    'latitude'            => -0.783400,
                    'longitude'           => 100.665120,
                    'address'             => 'SMPN 6 Kota Solok, Jl. Tembok Raya',
                    'mikrotik_ip'         => '10.20.30.1',
                    'sfp_port_name'       => 'sfp1',
                ],
                [
                    'name'                => 'BTS SD IT KOTA SOLOK',
                    'link_segment'        => 'FEEDER LINK SD IT',
                    'code'                => 'BTS-SDIT-01',
                    'measurement_date'    => '2025-01-06',
                    'sfp_sm_link_length'  => '10Km',
                    'sfp_vendor'          => 'TARMOC',
                    'tx_power'            => -6.022,
                    'rx_power'            => -11.719,
                    'cable_length_km'     => 3.10,
                    'tube_number'         => 1,
                    'tube_color'          => 'Biru (Blue)',
                    'core_number'         => 5,
                    'core_color'          => 'Abu-abu (Slate)',
                    'latitude'            => -0.778900,
                    'longitude'           => 100.648700,
                    'address'             => 'SD IT Kota Solok, Jl. Bypass',
                    'mikrotik_ip'         => '10.20.40.1',
                    'sfp_port_name'       => 'sfp1',
                ],
            ];

            foreach ($samples as $s) {
                $bts = BtsSite::create($s);
                $bts->syncToNetworkNode();
            }
        }
    }

    /**
     * Generator otomatis kode BTS jika tidak diinput manual
     */
    private function generateAutoCode(string $name): string
    {
        $clean = preg_replace('/^BTS\s+/i', '', trim($name));
        $words = preg_split('/[\s\-_]+/', $clean, -1, PREG_SPLIT_NO_EMPTY);
        
        $prefix = 'BTS';
        if (count($words) >= 2) {
            $abbr = strtoupper(substr($words[0], 0, 2) . substr($words[1], 0, 2));
            $prefix = "BTS-{$abbr}";
        } elseif (count($words) === 1 && strlen($words[0]) >= 3) {
            $abbr = strtoupper(substr($words[0], 0, 4));
            $prefix = "BTS-{$abbr}";
        }

        $existing = BtsSite::withTrashed()->where('code', 'LIKE', "{$prefix}-%")->count();
        $num = $existing + 1;

        return "{$prefix}-" . str_pad((string)$num, 2, '0', STR_PAD_LEFT);
    }

    public function index(Request $request)
    {
        $this->autoSeedIfEmpty();

        $query = BtsSite::query();

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                  ->orWhere('code', 'ilike', "%{$s}%")
                  ->orWhere('link_segment', 'ilike', "%{$s}%")
                  ->orWhere('sfp_vendor', 'ilike', "%{$s}%")
                  ->orWhere('address', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('vendor') && $request->vendor !== 'ALL') {
            $query->where('sfp_vendor', $request->vendor);
        }

        if ($request->filled('sm_length') && $request->sm_length !== 'ALL') {
            $query->where('sfp_sm_link_length', $request->sm_length);
        }

        if ($request->filled('status') && $request->status !== 'ALL') {
            if ($request->status === 'good') {
                $query->where('rx_power', '>=', -22.0);
            } elseif ($request->status === 'warning') {
                $query->whereBetween('rx_power', [-26.0, -22.01]);
            } elseif ($request->status === 'critical') {
                $query->where('rx_power', '<', -26.0);
            }
        }

        $sites = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data'    => $sites,
            'count'   => $sites->count(),
        ]);
    }

    public function stats()
    {
        $this->autoSeedIfEmpty();

        $total = BtsSite::count();
        $good = BtsSite::where('rx_power', '>=', -22.0)->count();
        $warning = BtsSite::whereBetween('rx_power', [-26.0, -22.01])->count();
        $critical = BtsSite::where('rx_power', '<', -26.0)->count();
        $avgRx = BtsSite::whereNotNull('rx_power')->avg('rx_power');

        return response()->json([
            'total_bts'     => $total,
            'good_count'    => $good,
            'warning_count' => $warning,
            'critical_count'=> $critical,
            'avg_rx_power'  => $avgRx ? round($avgRx, 2) : 0,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'                => 'required|string|max:255',
            'link_segment'        => 'nullable|string|max:255',
            'code'                => 'nullable|string|max:50|unique:bts_sites,code',
            'measurement_date'    => 'nullable|date',
            'sfp_sm_link_length'  => 'required|string|max:50',
            'sfp_vendor'          => 'required|string|max:100',
            'tx_power'            => 'nullable|numeric',
            'rx_power'            => 'nullable|numeric',
            'cable_length_km'     => 'nullable|numeric',
            'tube_number'         => 'required|integer|min:1|max:12',
            'tube_color'          => 'required|string|max:50',
            'core_number'         => 'required|integer|min:1|max:24',
            'core_color'          => 'required|string|max:50',
            'latitude'            => 'nullable|numeric|between:-90,90',
            'longitude'           => 'nullable|numeric|between:-180,180',
            'address'             => 'nullable|string',
            'mikrotik_ip'         => 'nullable|string|max:50',
            'sfp_port_name'       => 'nullable|string|max:50',
            'notes'               => 'nullable|string',
        ]);

        if (empty($validated['code'])) {
            $validated['code'] = $this->generateAutoCode($validated['name']);
        }

        if (empty($validated['measurement_date'])) {
            $validated['measurement_date'] = now()->toDateString();
        }

        $validated['created_by'] = auth()->id();

        $bts = BtsSite::create($validated);
        $bts->syncToNetworkNode();

        return response()->json([
            'success' => true,
            'message' => "Data BTS '{$bts->name}' berhasil disimpan.",
            'data'    => $bts,
        ], 201);
    }

    public function show($id)
    {
        $bts = BtsSite::findOrFail($id);
        return response()->json([
            'success' => true,
            'data'    => $bts,
        ]);
    }

    public function update(Request $request, $id)
    {
        $bts = BtsSite::findOrFail($id);

        $validated = $request->validate([
            'name'                => 'sometimes|required|string|max:255',
            'link_segment'        => 'nullable|string|max:255',
            'code'                => ['sometimes', 'required', 'string', 'max:50', Rule::unique('bts_sites', 'code')->ignore($bts->id)],
            'measurement_date'    => 'nullable|date',
            'sfp_sm_link_length'  => 'sometimes|required|string|max:50',
            'sfp_vendor'          => 'sometimes|required|string|max:100',
            'tx_power'            => 'nullable|numeric',
            'rx_power'            => 'nullable|numeric',
            'cable_length_km'     => 'nullable|numeric',
            'tube_number'         => 'sometimes|required|integer|min:1|max:12',
            'tube_color'          => 'sometimes|required|string|max:50',
            'core_number'         => 'sometimes|required|integer|min:1|max:24',
            'core_color'          => 'sometimes|required|string|max:50',
            'latitude'            => 'nullable|numeric|between:-90,90',
            'longitude'           => 'nullable|numeric|between:-180,180',
            'address'             => 'nullable|string',
            'mikrotik_ip'         => 'nullable|string|max:50',
            'sfp_port_name'       => 'nullable|string|max:50',
            'notes'               => 'nullable|string',
        ]);

        $bts->update($validated);
        $bts->syncToNetworkNode();

        return response()->json([
            'success' => true,
            'message' => "Data BTS '{$bts->name}' berhasil diperbarui.",
            'data'    => $bts,
        ]);
    }

    public function destroy($id)
    {
        $bts = BtsSite::findOrFail($id);
        $name = $bts->name;
        $code = $bts->code;

        // Also delete from network_nodes if needed
        NetworkNode::where('code', $code)->delete();
        $bts->delete();

        return response()->json([
            'success' => true,
            'message' => "Data BTS '{$name}' berhasil dihapus.",
        ]);
    }

    /**
     * Membaca daya optik (Rx Power & Tx Power) secara realtime dari MikroTik Router
     */
    public function readLivePower(Request $request, $id)
    {
        $bts = BtsSite::findOrFail($id);

        $ip = $request->input('mikrotik_ip', $bts->mikrotik_ip ?: '10.20.10.1');
        $port = $request->input('sfp_port_name', $bts->sfp_port_name ?: 'sfp-sfpplus1');

        $diag = MikrotikSfpService::readOpticalDiagnostics($ip, $port);

        if ($diag['success']) {
            $bts->update([
                'tx_power'          => $diag['tx_power'],
                'rx_power'          => $diag['rx_power'],
                'measurement_date'  => now()->toDateString(),
                'mikrotik_ip'       => $ip,
                'sfp_port_name'     => $port,
            ]);
            $bts->syncToNetworkNode();
        }

        return response()->json([
            'success' => true,
            'message' => "Diagnostik optik SFP {$bts->name} berhasil diperbarui secara realtime.",
            'data'    => $bts,
            'diag'    => $diag,
        ]);
    }
}
