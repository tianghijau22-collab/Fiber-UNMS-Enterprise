<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\AuditLog;
use App\Models\OltDevice;
use App\Services\Olt\SnmpConnector;

class VpsBridgeController extends Controller
{
    /**
     * Auto-detect environment, client IP, and VPS server parameters.
     */
    public function detectEnvironment(Request $request)
    {
        $clientIp = $request->header('X-Forwarded-For') 
            ? explode(',', $request->header('X-Forwarded-For'))[0] 
            : $request->ip();

        $serverIp = $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname());
        if ($serverIp === '127.0.0.1' || str_starts_with($serverIp, '10.') || str_starts_with($serverIp, '192.168.')) {
            // Attempt to get public IP or fallback to server hostname/current host
            $host = $request->getHost();
            if (filter_var($host, FILTER_VALIDATE_IP)) {
                $serverIp = $host;
            } else {
                $serverIp = '103.89.6.125'; // Default deployment VPS IP
            }
        }

        $snmpLoaded = extension_loaded('snmp');
        $olts = OltDevice::all(['id', 'name', 'code', 'vendor', 'ip_address', 'connection_mode']);

        return response()->json([
            'status' => 'success',
            'data' => [
                'client_ip'          => trim($clientIp),
                'server_ip'          => $serverIp,
                'server_hostname'    => gethostname(),
                'server_os'          => PHP_OS_FAMILY,
                'php_version'        => PHP_VERSION,
                'snmp_available'     => $snmpLoaded,
                'default_olt_ip'     => '192.168.100.1',
                'default_router_ip'  => '192.168.100.2',
                'default_vpn_subnet' => '10.254.0.0/24',
                'vps_tunnel_ip'      => '10.254.0.1',
                'mikrotik_tunnel_ip' => '10.254.0.2',
                'detected_olts'      => $olts,
            ]
        ]);
    }

    /**
     * Generate customized Router & VPS deployment scripts.
     */
    public function generateScript(Request $request)
    {
        $validated = $request->validate([
            'vps_ip'           => 'required|string',
            'vpn_protocol'     => 'required|in:l2tp,wireguard,sstp',
            'vpn_user'         => 'required|string',
            'vpn_password'     => 'required|string',
            'vpn_secret'       => 'nullable|string',
            'olt_ip'           => 'required|string',
            'olt_port_interface' => 'nullable|string',
            'wan_interface'    => 'nullable|string',
            'lan_interface'    => 'nullable|string',
            'router_model'     => 'nullable|string', // 'hap_lite', 'generic_v6', 'generic_v7'
        ]);

        $vpsIp = $validated['vps_ip'];
        $protocol = $validated['vpn_protocol'];
        $user = $validated['vpn_user'];
        $pass = $validated['vpn_password'];
        $secret = $validated['vpn_secret'] ?: 'unmssecret2026';
        $oltIp = $validated['olt_ip'];
        $oltIf = $validated['olt_port_interface'] ?: 'ether2';
        $wanIf = $validated['wan_interface'] ?: 'ether1';
        $lanIf = $validated['lan_interface'] ?: 'ether3';

        // Calculate router OLT gateway IP
        $oltParts = explode('.', $oltIp);
        $oltPrefix = "{$oltParts[0]}.{$oltParts[1]}.{$oltParts[2]}";
        $routerOltIp = "{$oltPrefix}.2/24";
        $oltSubnet = "{$oltPrefix}.0/24";

        // Generate MikroTik RouterOS script
        $rscLines = [];
        $rscLines[] = "# =============================================================";
        $rscLines[] = "# UNMS Enterprise - MikroTik Router & OLT Bridge Script";
        $rscLines[] = "# Target: {$validated['router_model']} | Generated: " . date('Y-m-d H:i:s');
        $rscLines[] = "# =============================================================";
        $rscLines[] = "";
        $rscLines[] = "# 1. Konfigurasi Port WAN (Internet Masuk dari ISP)";
        $rscLines[] = "/ip dhcp-client add interface={$wanIf} disabled=no comment=\"Jalur Internet WAN ISP\"";
        $rscLines[] = "";
        $rscLines[] = "# 2. Konfigurasi IP Gateway ke OLT & Laptop LAN";
        $rscLines[] = "/ip address add address={$routerOltIp} interface={$oltIf} comment=\"Gateway Menuju OLT ({$oltIp})\"";
        $rscLines[] = "/ip address add address=192.168.88.1/24 interface={$lanIf} comment=\"Jalur LAN Laptop/PC Kantor\"";
        $rscLines[] = "";
        $rscLines[] = "# 3. Konfigurasi DHCP Server untuk Laptop & Modem Pelanggan";
        $rscLines[] = "/ip pool add name=pool-laptop ranges=192.168.88.10-192.168.88.100";
        $rscLines[] = "/ip dhcp-server add name=dhcp-laptop interface={$lanIf} address-pool=pool-laptop disabled=no";
        $rscLines[] = "/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1";
        $rscLines[] = "";
        $rscLines[] = "/ip pool add name=pool-olt-onu ranges={$oltPrefix}.50-{$oltPrefix}.200";
        $rscLines[] = "/ip dhcp-server add name=dhcp-olt interface={$oltIf} address-pool=pool-olt-onu disabled=no";
        $rscLines[] = "/ip dhcp-server network add address={$oltSubnet} gateway={$oltPrefix}.2 dns-server=8.8.8.8,1.1.1.1";
        $rscLines[] = "";
        $rscLines[] = "# 4. NAT Masquerade (Akses Internet Keluar)";
        $rscLines[] = "/ip firewall nat add chain=srcnat out-interface={$wanIf} action=masquerade comment=\"NAT Internet Sharing\"";
        $rscLines[] = "";

        if ($protocol === 'l2tp') {
            $rscLines[] = "# 5. Koneksi VPN Tunnel L2TP/IPsec ke VPS Cloud ({$vpsIp})";
            $rscLines[] = "/interface l2tp-client add name=\"vpn-unms-vps\" connect-to={$vpsIp} user=\"{$user}\" password=\"{$pass}\" ipsec-secret=\"{$secret}\" use-ipsec=yes disabled=no comment=\"Tunnel UNMS Cloud\"";
        } elseif ($protocol === 'sstp') {
            $rscLines[] = "# 5. Koneksi VPN Tunnel SSTP (Port TCP 443) ke VPS Cloud ({$vpsIp})";
            $rscLines[] = "/interface sstp-client add name=\"vpn-unms-vps\" connect-to={$vpsIp}:443 user=\"{$user}\" password=\"{$pass}\" verify-server-certificate=no disabled=no comment=\"Tunnel UNMS Cloud\"";
        } else {
            $rscLines[] = "# 5. Koneksi WireGuard Tunnel ke VPS Cloud ({$vpsIp})";
            $rscLines[] = "/interface wireguard add name=wg-unms listen-port=13231 comment=\"WireGuard UNMS\"";
            $rscLines[] = "/ip address add address=10.254.0.2/24 interface=wg-unms";
            $rscLines[] = "/interface wireguard peers add interface=wg-unms endpoint-address={$vpsIp} endpoint-port=51820 allowed-address=10.254.0.0/24 persistent-keepalive=25s public-key=\"VPS_PUBLIC_KEY_HERE\"";
        }

        $mikrotikScript = implode("\n", $rscLines);

        // Generate VPS Linux commands
        $vpsLines = [];
        $vpsLines[] = "# Jalankan di Terminal SSH VPS ({$vpsIp}):";
        $vpsLines[] = "";
        $vpsLines[] = "# 1. Install & Aktifkan L2TP / VPN Server Otomatis";
        $vpsLines[] = "wget https://get.vpnsetup.net -O vpn.sh && sudo bash vpn.sh --auto";
        $vpsLines[] = "";
        $vpsLines[] = "# 2. Tambahkan Rute agar VPS bisa menjangkau IP OLT ({$oltIp}) lewat VPN MikroTik:";
        $vpsLines[] = "sudo ip route add {$oltSubnet} via 10.254.0.2";
        $vpsLines[] = "";
        $vpsLines[] = "# 3. Uji Ping & Query SNMP dari VPS ke OLT:";
        $vpsLines[] = "ping -c 3 {$oltIp}";
        $vpsLines[] = "snmpwalk -v 2c -c public {$oltIp} 1.3.6.1.2.1.1.1.0";

        $vpsScript = implode("\n", $vpsLines);

        return response()->json([
            'status' => 'success',
            'data' => [
                'mikrotik_script' => $mikrotikScript,
                'vps_script'      => $vpsScript,
                'summary' => [
                    'vps_ip'       => $vpsIp,
                    'protocol'     => strtoupper($protocol),
                    'router_model' => $validated['router_model'] ?: 'MikroTik hAP lite',
                    'olt_target'   => $oltIp,
                    'wan_port'     => $wanIf,
                    'olt_port'     => $oltIf,
                    'lan_port'     => $lanIf,
                ]
            ]
        ]);
    }

    /**
     * Live Ping & SNMP test from VPS to MikroTik Tunnel or OLT IP.
     */
    public function testBridgeConnection(Request $request)
    {
        $targetIp = $request->input('target_ip', '192.168.100.1');
        $community = $request->input('community', 'public');
        $snmpVersion = $request->input('snmp_version', 'v2c');

        $connector = new SnmpConnector(
            ip: $targetIp,
            snmpVersion: $snmpVersion,
            community: $community,
            timeout: 2,
            retries: 0
        );

        $pingMs = $connector->pingTest();
        $snmpTest = $connector->snmpTest();

        return response()->json([
            'status' => 'success',
            'data' => [
                'target_ip'       => $targetIp,
                'ping_success'    => $pingMs >= 0,
                'latency_ms'      => $pingMs >= 0 ? $pingMs : null,
                'snmp_success'    => $snmpTest['success'] ?? false,
                'snmp_detail'     => $snmpTest,
                'timestamp'       => now()->toIso8601String(),
            ]
        ]);
    }
}
