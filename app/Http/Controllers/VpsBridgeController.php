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
            'vps_ip'             => 'required|string',
            'vpn_protocol'       => 'required|in:l2tp,wireguard,sstp',
            'vpn_user'           => 'required|string',
            'vpn_password'       => 'required|string',
            'vpn_secret'         => 'nullable|string',
            'olt_ip'             => 'required|string',
            'olt_port_interface' => 'nullable|string',
            'wan_interface'      => 'nullable|string',
            'lan_interface'      => 'nullable|string',
            'router_model'       => 'nullable|string',
            'vlan_id'            => 'nullable|integer|min:1|max:4094',
            'pppoe_pool'         => 'nullable|string',
            'pppoe_gateway'      => 'nullable|string',
            'pppoe_user'         => 'nullable|string',
            'pppoe_password'     => 'nullable|string',
            'pppoe_rate'         => 'nullable|string',
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
        $vlanId = $validated['vlan_id'] ?? 100;
        $pppoePool = $validated['pppoe_pool'] ?: '10.10.100.2-10.10.100.254';
        $pppoeGateway = $validated['pppoe_gateway'] ?: '10.10.100.1';
        $pppoeUser = $validated['pppoe_user'] ?: 'client_demo';
        $pppoePass = $validated['pppoe_password'] ?: 'client123';
        $pppoeRate = $validated['pppoe_rate'] ?: '10M/10M';

        // Calculate router OLT gateway IP
        $oltParts = explode('.', $oltIp);
        $oltPrefix = "{$oltParts[0]}.{$oltParts[1]}.{$oltParts[2]}";
        $routerOltIp = "{$oltPrefix}.2/24";
        $oltSubnet = "{$oltPrefix}.0/24";

        // Generate MikroTik RouterOS script
        $rscLines = [];
        $rscLines[] = "# =============================================================";
        $rscLines[] = "# FIBER-UNMS ENTERPRISE - SETUP LENGKAP MIKROTIK ROUTER & OLT";
        $rscLines[] = "# Model Target: {$validated['router_model']} | Generated: " . date('Y-m-d H:i:s');
        $rscLines[] = "# =============================================================";
        $rscLines[] = "";
        $rscLines[] = "# --- 1. JALUR INTERNET WAN (Sumber Internet dari Modem ISP) ---";
        $rscLines[] = "/ip dhcp-client add interface={$wanIf} disabled=no comment=\"WAN Internet ISP\"";
        $rscLines[] = "";
        $rscLines[] = "# --- 2. IP GATEWAY MANAJEMEN MENUJU OLT ({$oltIp}) ---";
        $rscLines[] = "/ip address add address={$routerOltIp} interface={$oltIf} comment=\"Gateway Menuju OLT ({$oltIp})\"";
        $rscLines[] = "";
        $rscLines[] = "# --- 3. JALUR LAN LAPTOP / PC TEKNISI (PORT {$lanIf}) ---";
        $rscLines[] = "/ip address add address=192.168.88.1/24 interface={$lanIf} comment=\"LAN Teknisi / Laptop\"";
        $rscLines[] = "/ip pool add name=pool-teknisi ranges=192.168.88.10-192.168.88.100";
        $rscLines[] = "/ip dhcp-server add name=dhcp-teknisi interface={$lanIf} address-pool=pool-teknisi disabled=no";
        $rscLines[] = "/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1";
        $rscLines[] = "";
        $rscLines[] = "# --- 4. VLAN {$vlanId} TRAFFIC INTERNET PELANGGAN (MENEMBUS OLT {$oltIf}) ---";
        $rscLines[] = "/interface vlan add name=vlan{$vlanId}-internet vlan-id={$vlanId} interface={$oltIf} comment=\"VLAN Internet Modem Client\"";
        $rscLines[] = "";
        $rscLines[] = "# --- 5. PPPoE SERVER DI ATAS VLAN {$vlanId} ---";
        $rscLines[] = "/ip pool add name=pool-pppoe ranges={$pppoePool}";
        $rscLines[] = "/ppp profile add name=profile-pppoe-{$pppoeRate} local-address={$pppoeGateway} remote-address=pool-pppoe rate-limit=\"{$pppoeRate}\" dns-server=8.8.8.8,1.1.1.1 comment=\"Profile Kecepatan {$pppoeRate}\"";
        $rscLines[] = "/interface pppoe-server server add service-name=pppoe-unms interface=vlan{$vlanId}-internet default-profile=profile-pppoe-{$pppoeRate} one-session-per-host=yes authentication=pap,chap,mschap1,mschap2 disabled=no";
        $rscLines[] = "";
        $rscLines[] = "# --- 6. AKUN PPPoE SAMPLE PELANGGAN PERTAMA ---";
        $rscLines[] = "/ppp secret add name=\"{$pppoeUser}\" password=\"{$pppoePass}\" service=pppoe profile=profile-pppoe-{$pppoeRate} comment=\"Akun Demo Modem Client\"";
        $rscLines[] = "";
        $rscLines[] = "# --- 7. NAT INTERNET MASQUERADE (SHARING INTERNET) ---";
        $rscLines[] = "/ip firewall nat add chain=srcnat out-interface={$wanIf} action=masquerade comment=\"NAT Internet Masquerade\"";
        $rscLines[] = "";
        $rscLines[] = "# --- 8. SERVICE API MIKROTIK (PORT 8728 TELEMETRI UNMS) ---";
        $rscLines[] = "/ip service set api port=8728 disabled=no";
        $rscLines[] = "/user group add name=unms-group policy=api,read,test,winbox";
        $rscLines[] = "/user add name=unms_api group=unms-group password=\"{$pass}\" comment=\"UNMS Telemetry API User\"";
        $rscLines[] = "";

        if ($protocol === 'l2tp') {
            $rscLines[] = "# --- 9. KONEKSI TEROWONGAN VPN L2TP/IPsec KE VPS CLOUD ({$vpsIp}) ---";
            $rscLines[] = "/interface l2tp-client add name=\"vpn-unms-vps\" connect-to={$vpsIp} user=\"{$user}\" password=\"{$pass}\" ipsec-secret=\"{$secret}\" use-ipsec=yes disabled=no comment=\"Tunnel UNMS Cloud\"";
        } elseif ($protocol === 'sstp') {
            $rscLines[] = "# --- 9. KONEKSI TEROWONGAN VPN SSTP (PORT 443) KE VPS CLOUD ({$vpsIp}) ---";
            $rscLines[] = "/interface sstp-client add name=\"vpn-unms-vps\" connect-to={$vpsIp}:443 user=\"{$user}\" password=\"{$pass}\" verify-server-certificate=no disabled=no comment=\"Tunnel UNMS Cloud\"";
        } else {
            $rscLines[] = "# --- 9. KONEKSI TEROWONGAN WIREGUARD KE VPS CLOUD ({$vpsIp}) ---";
            $rscLines[] = "/interface wireguard add name=wg-unms listen-port=13231 comment=\"WireGuard UNMS\"";
            $rscLines[] = "/ip address add address=10.254.0.2/24 interface=wg-unms";
            $rscLines[] = "/interface wireguard peers add interface=wg-unms endpoint-address={$vpsIp} endpoint-port=51820 allowed-address=10.254.0.0/24 persistent-keepalive=25s public-key=\"VPS_PUBLIC_KEY_HERE\"";
        }

        $mikrotikScript = implode("\n", $rscLines);

        // Generate VPS Linux commands
        $vpsLines = [];
        $vpsLines[] = "# Jalankan di Terminal SSH VPS ({$vpsIp}):";
        $vpsLines[] = "";
        $vpsLines[] = "# 1. Install & Aktifkan L2TP / VPN Server Otomatis (Sudah Aktif di VPS):";
        $vpsLines[] = "systemctl status xl2tpd strongswan-starter";
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
                    'vlan_id'      => $vlanId,
                    'pppoe_user'   => $pppoeUser,
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
