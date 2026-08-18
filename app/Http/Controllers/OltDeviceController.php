<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use App\Models\OltDevice;
use App\Models\NetworkNode;
use App\Models\AuditLog;
use App\Services\Olt\ConnectionManager;

class OltDeviceController extends Controller
{
    // ─── GET /api/olts ───────────────────────────────────────────────────────
    public function index()
    {
        $olts = OltDevice::orderBy('created_at')->get();
        $allNodes = NetworkNode::with(['parent.oltDevice', 'oltDevice'])->whereIn('node_type', ['POP', 'ODC', 'ODP'])->get();

        $data = $olts->map(function ($olt) use ($allNodes) {
            $oltId = $olt->id;

            $oltNodes = $allNodes->filter(function ($n) use ($oltId) {
                if ($n->olt_device_id == $oltId) return true;
                if ($n->oltDevice && $n->oltDevice->id == $oltId) return true;
                if ($n->parent && $n->parent->olt_device_id == $oltId) return true;
                if ($n->parent && $n->parent->oltDevice && $n->parent->oltDevice->id == $oltId) return true;
                if ($n->parent && $n->parent->parent && $n->parent->parent->olt_device_id == $oltId) return true;
                return false;
            });

            $popCount = $oltNodes->where('node_type', 'POP')->count();
            if ($popCount === 0) {
                $popCount = 1;
            }

            $odcCount = $oltNodes->where('node_type', 'ODC')->count();
            $odpCount = $oltNodes->where('node_type', 'ODP')->count();

            $oltArray = $olt->toArray();
            $oltArray['pop_count'] = $popCount;
            $oltArray['odc_count'] = $odcCount;
            $oltArray['odp_count'] = $odpCount;

            return $oltArray;
        });

        return response()->json([
            'status'        => 'success',
            'capabilities'  => ConnectionManager::getSystemCapabilities(),
            'data'          => $data,
        ]);
    }

    // ─── POST /api/olts ──────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'code'         => 'required|string|unique:olt_devices,code',
            'vendor'       => 'required|string',
            'model'        => 'required|string',
            'location'     => 'required|string',
            'ip_address'   => 'required|ip',
            'total_ports'  => 'required|integer|min:1',
            // Deployment
            'deployment_mode' => 'nullable|in:direct,vpn,probe',
            // SNMP v2c
            'snmp_version'        => 'nullable|in:v2c,v3',
            'snmp_community_type' => 'nullable|in:public,custom',
            'snmp_community'      => 'nullable|string',
            // SNMP v3
            'snmp_v3_username'     => 'nullable|string',
            'snmp_v3_auth_protocol' => 'nullable|in:MD5,SHA',
            'snmp_v3_auth_password' => 'nullable|string',
            'snmp_v3_priv_protocol' => 'nullable|in:DES,AES',
            'snmp_v3_priv_password' => 'nullable|string',
            'snmp_port'    => 'nullable|integer',
            // CLI
            'cli_protocol' => 'nullable|in:telnet,ssh',
            'cli_username' => 'nullable|string',
            'cli_password' => 'nullable|string',
            'cli_port'     => 'nullable|integer',
            // Probe
            'probe_agent_url'   => 'nullable|url',
            'probe_agent_token' => 'nullable|string',
        ]);

        $device = OltDevice::create([
            'name'         => $validated['name'],
            'code'         => strtoupper($validated['code']),
            'vendor'       => $validated['vendor'],
            'model'        => $validated['model'],
            'vendor_key'   => strtolower(str_replace(' ', '-', $validated['vendor'])),
            'location'     => $validated['location'],
            'ip_address'   => $validated['ip_address'],
            'total_ports'  => $validated['total_ports'],
            'deployment_mode'      => $validated['deployment_mode'] ?? 'direct',
            'snmp_version'         => $validated['snmp_version'] ?? 'v2c',
            'snmp_community_type'  => $validated['snmp_community_type'] ?? 'public',
            'snmp_community_string' => isset($validated['snmp_community'])
                ? $validated['snmp_community'] : null,
            'snmp_v3_username'     => $validated['snmp_v3_username'] ?? null,
            'snmp_v3_auth_protocol' => $validated['snmp_v3_auth_protocol'] ?? 'SHA',
            'snmp_v3_auth_password' => isset($validated['snmp_v3_auth_password'])
                ? Crypt::encryptString($validated['snmp_v3_auth_password']) : null,
            'snmp_v3_priv_protocol' => $validated['snmp_v3_priv_protocol'] ?? 'AES',
            'snmp_v3_priv_password' => isset($validated['snmp_v3_priv_password'])
                ? Crypt::encryptString($validated['snmp_v3_priv_password']) : null,
            'snmp_port'    => $validated['snmp_port'] ?? 161,
            'cli_protocol' => $validated['cli_protocol'] ?? 'telnet',
            'cli_username' => $validated['cli_username'] ?? null,
            'cli_password' => isset($validated['cli_password'])
                ? $validated['cli_password'] : null,
            'cli_port'     => $validated['cli_port'] ?? 23,
            'probe_agent_url'   => $validated['probe_agent_url'] ?? null,
            'probe_agent_token' => $validated['probe_agent_token'] ?? null,
            'status'            => 'active',
            'connection_mode'   => 'simulation',
        ]);

        AuditLog::record(
            'CREATE',
            'OLT Management',
            "Menambahkan perangkat OLT baru {$device->name} ({$device->code}) - IP: {$device->ip_address}",
            null,
            $device->toArray()
        );

        return response()->json([
            'status'  => 'success',
            'message' => "Perangkat OLT {$device->name} berhasil ditambahkan!",
            'data'    => $device,
        ], 201);
    }

    // ─── GET /api/olts/{id} ──────────────────────────────────────────────────
    public function show($id)
    {
        $device = OltDevice::findOrFail($id);
        return response()->json(['status' => 'success', 'data' => $device]);
    }

    // ─── POST /api/olts/{id}/test-connection ─────────────────────────────────
    public function testConnection($id)
    {
        $device = OltDevice::findOrFail($id);
        $result = ConnectionManager::testDevice($device);

        // Persist connection mode result
        $device->update([
            'connection_mode'    => $result['connection_mode'],
            'last_connected_at'  => now(),
            'last_ping_ms'       => $result['ping']['latency_ms'] ?? null,
        ]);

        AuditLog::record(
            'TEST',
            'OLT Management',
            "Uji koneksi ke OLT {$device->name} ({$device->code}) - Mode: {$result['connection_mode']}, Ping: " . ($result['ping']['latency_ms'] ?? 0) . "ms",
            null,
            [
                'olt_name'        => $device->name,
                'code'            => $device->code,
                'ip_address'      => $device->ip_address,
                'connection_mode' => $result['connection_mode'],
                'ping_latency_ms' => $result['ping']['latency_ms'] ?? null,
                'snmp_reachable'  => $result['snmp']['reachable'] ?? false,
            ]
        );

        return response()->json([
            'status' => 'success',
            'data'   => $result,
        ]);
    }

    // ─── POST /api/olts/{id}/disconnect ─────────────────────────────────────
    public function disconnect($id)
    {
        $device = OltDevice::findOrFail($id);

        $device->update([
            'connection_mode' => 'simulation',
        ]);

        AuditLog::record(
            'UPDATE',
            'OLT Management',
            "Memutuskan koneksi live SNMP ke OLT {$device->name} ({$device->code}) beralih ke mode simulasi",
            ['connection_mode' => 'live'],
            ['connection_mode' => 'simulation']
        );

        return response()->json([
            'status'  => 'success',
            'message' => "Koneksi SNMP ke OLT {$device->name} berhasil dihentikan.",
            'data'    => $device->fresh(),
        ]);
    }

    // ─── PUT /api/olts/{id}/connection-config ────────────────────────────────
    public function saveConnectionConfig(Request $request, $id)
    {
        $device = OltDevice::findOrFail($id);

        $validated = $request->validate([
            'deployment_mode'      => 'required|in:direct,vpn,probe',
            'snmp_version'         => 'required|in:v2c,v3',
            'snmp_community_type'  => 'nullable|in:public,custom',
            'snmp_community'       => 'nullable|string',
            'snmp_v3_username'     => 'nullable|string',
            'snmp_v3_auth_protocol' => 'nullable|in:MD5,SHA',
            'snmp_v3_auth_password' => 'nullable|string',
            'snmp_v3_priv_protocol' => 'nullable|in:DES,AES',
            'snmp_v3_priv_password' => 'nullable|string',
            'snmp_port'            => 'nullable|integer',
            'snmp_timeout'         => 'nullable|integer',
            'cli_protocol'         => 'nullable|in:telnet,ssh',
            'cli_username'         => 'nullable|string',
            'cli_password'         => 'nullable|string',
            'cli_port'             => 'nullable|integer',
            'probe_agent_url'      => 'nullable|url',
            'probe_agent_token'    => 'nullable|string',
        ]);

        $updateData = [
            'deployment_mode'      => $validated['deployment_mode'],
            'snmp_version'         => $validated['snmp_version'],
            'snmp_community_type'  => $validated['snmp_community_type'] ?? 'public',
            'snmp_port'            => $validated['snmp_port'] ?? 161,
            'snmp_timeout'         => $validated['snmp_timeout'] ?? 5,
            'cli_protocol'         => $validated['cli_protocol'] ?? 'telnet',
            'cli_username'         => $validated['cli_username'] ?? null,
            'cli_port'             => $validated['cli_port'] ?? 23,
            'probe_agent_url'      => $validated['probe_agent_url'] ?? null,
        ];

        // v2c custom community
        if (!empty($validated['snmp_community'])) {
            $updateData['snmp_community_string'] = $validated['snmp_community'];
        }

        // v3 fields
        if ($validated['snmp_version'] === 'v3') {
            $updateData['snmp_v3_username']     = $validated['snmp_v3_username'] ?? null;
            $updateData['snmp_v3_auth_protocol'] = $validated['snmp_v3_auth_protocol'] ?? 'SHA';
            $updateData['snmp_v3_priv_protocol'] = $validated['snmp_v3_priv_protocol'] ?? 'AES';
            if (!empty($validated['snmp_v3_auth_password'])) {
                $updateData['snmp_v3_auth_password'] = Crypt::encryptString($validated['snmp_v3_auth_password']);
            }
            if (!empty($validated['snmp_v3_priv_password'])) {
                $updateData['snmp_v3_priv_password'] = Crypt::encryptString($validated['snmp_v3_priv_password']);
            }
        }

        if (!empty($validated['cli_password'])) {
            $updateData['cli_password'] = $validated['cli_password'];
        }

        if (!empty($validated['probe_agent_token'])) {
            $updateData['probe_agent_token'] = Crypt::encryptString($validated['probe_agent_token']);
        }

        $oldConfig = [
            'deployment_mode' => $device->deployment_mode,
            'snmp_version'    => $device->snmp_version,
            'snmp_port'       => $device->snmp_port,
            'cli_protocol'    => $device->cli_protocol,
        ];

        $device->update($updateData);

        AuditLog::record(
            'UPDATE',
            'OLT Management',
            "Perbarui konfigurasi koneksi SNMP/CLI OLT {$device->name} ({$device->code})",
            $oldConfig,
            [
                'deployment_mode' => $updateData['deployment_mode'],
                'snmp_version'    => $updateData['snmp_version'],
                'snmp_port'       => $updateData['snmp_port'],
                'cli_protocol'    => $updateData['cli_protocol'],
            ]
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Konfigurasi koneksi berhasil disimpan.',
            'data'    => $device->fresh(),
        ]);
    }

    // ─── PUT /api/olts/{id} ──────────────────────────────────────────────────
    public function update(Request $request, $id)
    {
        $device = OltDevice::findOrFail($id);

        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'code'         => 'required|string|unique:olt_devices,code,' . $id,
            'vendor'       => 'required|string',
            'model'        => 'required|string',
            'location'     => 'required|string',
            'ip_address'   => 'required|ip',
            'total_ports'  => 'required|integer|min:1',
            'deployment_mode' => 'nullable|in:direct,vpn,probe',
            'snmp_version'        => 'nullable|in:v2c,v3',
            'snmp_community_type' => 'nullable|in:public,custom',
        ]);

        $oldValues = [
            'name'        => $device->name,
            'code'        => $device->code,
            'ip_address'  => $device->ip_address,
            'location'    => $device->location,
            'total_ports' => $device->total_ports,
        ];

        $device->update([
            'name'         => $validated['name'],
            'code'         => strtoupper($validated['code']),
            'vendor'       => $validated['vendor'],
            'model'        => $validated['model'],
            'vendor_key'   => strtolower(str_replace(' ', '-', $validated['vendor'])),
            'location'     => $validated['location'],
            'ip_address'   => $validated['ip_address'],
            'total_ports'  => $validated['total_ports'],
            'deployment_mode'     => $validated['deployment_mode'] ?? $device->deployment_mode,
            'snmp_version'        => $validated['snmp_version'] ?? $device->snmp_version,
            'snmp_community_type' => $validated['snmp_community_type'] ?? $device->snmp_community_type,
        ]);

        AuditLog::record(
            'UPDATE',
            'OLT Management',
            "Perbarui data perangkat OLT {$device->name} ({$device->code})",
            $oldValues,
            $validated
        );

        return response()->json([
            'status'  => 'success',
            'message' => "Perangkat OLT {$device->name} berhasil diperbarui!",
            'data'    => $device->fresh(),
        ]);
    }

    // ─── DELETE /api/olts/{id} ───────────────────────────────────────────────
    public function destroy($id)
    {
        $device = OltDevice::findOrFail($id);
        $name = $device->name;
        $device->delete();

        return response()->json([
            'status'  => 'success',
            'message' => "Perangkat {$name} berhasil dihapus.",
        ]);
    }

    // ─── Default Seeded OLTs ─────────────────────────────────────────────────
    private function defaultOlts(): array
    {
        return [
            ['name' => 'OLT ZTE C300 Kota Solok', 'code' => 'OLT-SLK-01',
             'vendor' => 'ZTE', 'model' => 'ZXAN C300', 'vendor_key' => 'zte-c300',
             'location' => 'Kota Solok (POP Solok Central)', 'ip_address' => '10.10.20.1',
             'total_ports' => 16, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
            ['name' => 'OLT ZTE C300 Bukittinggi', 'code' => 'OLT-BKT-01',
             'vendor' => 'ZTE', 'model' => 'ZXAN C300', 'vendor_key' => 'zte-c300',
             'location' => 'Bukittinggi (POP Jam Gadang)', 'ip_address' => '10.10.30.1',
             'total_ports' => 16, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
            ['name' => 'OLT ZTE C320 Padang Main', 'code' => 'OLT-PDG-01',
             'vendor' => 'ZTE', 'model' => 'ZXAN C320', 'vendor_key' => 'zte-c320',
             'location' => 'Kota Padang (POP Central Khatib)', 'ip_address' => '10.10.40.1',
             'total_ports' => 8, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
            ['name' => 'OLT Hioso Payakumbuh', 'code' => 'OLT-PYK-01',
             'vendor' => 'Hioso', 'model' => 'HA7302CS', 'vendor_key' => 'hioso',
             'location' => 'Payakumbuh (POP Koto Nan IV)', 'ip_address' => '10.10.50.1',
             'total_ports' => 2, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
            ['name' => 'OLT HSGQ Pariaman Hub', 'code' => 'OLT-PRM-01',
             'vendor' => 'HSGQ', 'model' => 'G004 4-Port', 'vendor_key' => 'hsgq',
             'location' => 'Pariaman (POP Pantai Gandoriah)', 'ip_address' => '10.10.60.1',
             'total_ports' => 4, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
            ['name' => 'OLT Tarmoc Pesisir Selatan', 'code' => 'OLT-PSS-01',
             'vendor' => 'Tarmoc', 'model' => 'TMC-EP8', 'vendor_key' => 'tarmoc',
             'location' => 'Painan Pesisir Selatan', 'ip_address' => '10.10.70.1',
             'total_ports' => 8, 'deployment_mode' => 'direct', 'snmp_version' => 'v2c',
             'snmp_community_type' => 'public', 'status' => 'active', 'connection_mode' => 'simulation'],
        ];
    }
}
