import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/* ── Clean SVG Icons ── */
const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconTerminal = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconNetwork = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IconServer = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

export default function VpnMikrotikBridgeModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('company_l2tp'); // 'company_l2tp' | 'mikrotik_script' | 'local_lan'
  const [copiedKey, setCopiedKey] = useState(null);

  // ── Form State: VPN L2TP Perusahaan (VPS -> VPN Kantor) ──
  const [vpsVpnForm, setVpsVpnForm] = useState({
    serverIp: 'vpn.perusahaan-anda.com',
    ipsecSecret: 'RahasiaIPsec123',
    username: 'karyawan_noc',
    password: 'PasswordVPN123',
    oltSubnet: '192.168.1.0/24',
    oltIpSample: '192.168.1.100',
  });

  // ── Form State: Generator Script MikroTik (MikroTik -> VPS) ──
  const [mikrotikForm, setMikrotikForm] = useState({
    vpsPublicIp: window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost' ? window.location.hostname : '103.89.6.125',
    vpnUser: 'unms_client',
    vpnPassword: 'unmspassword2026',
    ipsecSecret: 'unmssecret2026',
    oltLocalSubnet: '192.168.100.0/24',
    oltIpSample: '192.168.100.1',
  });

  // ── Form State: Server Lokal Kantor (Direct LAN On-Premise) ──
  const [localLanForm, setLocalLanForm] = useState({
    serverIp: '192.168.1.50/24',
    gatewayIp: '192.168.1.1',
    interfaceName: 'eth0',
    vlanId: '100',
    oltIpSample: '192.168.1.100',
  });

  if (!isOpen) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // ── Script Generator: VPS L2TP Linux ──
  const linuxInstallCmd = `sudo apt update && sudo apt install -y strongswan xl2tpd libstrongswan-standard-plugins libstrongswan-extra-plugins`;

  const ipsecConfContent = `config setup
    charondebug="ike 1, knl 1, cfg 0"
    uniqueids=yes

conn vpn-perusahaan
    authby=secret
    pfs=no
    auto=add
    keyexchange=ikev1
    type=transport
    left=%defaultroute
    leftprotoport=17/1701
    right=${vpsVpnForm.serverIp}
    rightprotoport=17/1701`;

  const ipsecSecretsContent = `: PSK "${vpsVpnForm.ipsecSecret}"`;

  const xl2tpdConfContent = `[lac vpn-perusahaan]
lns = ${vpsVpnForm.serverIp}
ppp debug = yes
pppoptfile = /etc/ppp/options.l2tpd.client
length bit = yes`;

  const pppOptionsContent = `ipcp-accept-local
ipcp-accept-remote
refuse-eap
require-mschap-v2
noccp
noauth
idle 1800
mtu 1410
mru 1410
defaultroute
usepeerdns
debug
connect-delay 5000
name ${vpsVpnForm.username}
password ${vpsVpnForm.password}`;

  const linuxConnectCmd = `# 1. Restart service IPsec & XL2TPD
sudo ipsec restart
sudo service xl2tpd restart
sleep 2

# 2. Jalankan koneksi VPN
sudo ipsec up vpn-perusahaan
echo "c vpn-perusahaan" | sudo tee /var/run/xl2tpd/l2tp-control

# 3. Tambahkan routing ke Subnet OLT melalui interface ppp0
sudo ip route add ${vpsVpnForm.oltSubnet} dev ppp0

# 4. Tes koneksi ke OLT lokal
ping -c 4 ${vpsVpnForm.oltIpSample}`;

  // ── Script Generator: MikroTik RouterOS ──
  const mikrotikL2tpScript = `# 1. Buat L2TP Client Interface ke VPS Fiber-UNMS
/interface l2tp-client
add name="l2tp-to-vps-unms" connect-to="${mikrotikForm.vpsPublicIp}" \\
    user="${mikrotikForm.vpnUser}" password="${mikrotikForm.vpnPassword}" \\
    use-ipsec=yes ipsec-secret="${mikrotikForm.ipsecSecret}" \\
    disabled=no comment="VPN Bridge to Cloud UNMS"`;

  const mikrotikRouteScript = `# 2. Rule Firewall & NAT Masquerade agar VPS bisa menjangkau IP OLT
/ip firewall nat
add chain=srcnat out-interface=l2tp-to-vps-unms action=masquerade \\
    comment="Masquerade VPN UNMS"

/ip firewall filter
add chain=forward in-interface=l2tp-to-vps-unms dst-address=${mikrotikForm.oltLocalSubnet} \\
    action=accept comment="Allow UNMS to Local OLT"`;

  const mikrotikSchedulerScript = `# 3. Script Watchdog Auto-Reconnect & Scheduler (Jalankan Tiap 2 Menit)
/system script
add name="watchdog-unms-vpn" source={
    :if ([/interface l2tp-client get [find name="l2tp-to-vps-unms"] running] = false) do={
        /interface l2tp-client disable [find name="l2tp-to-vps-unms"]
        :delay 2s
        /interface l2tp-client enable [find name="l2tp-to-vps-unms"]
        :log info "UNMS VPN Watchdog: Reconnecting L2TP Tunnel..."
    }
}

/system scheduler
add name="schedule-unms-watchdog" interval=2m on-event="watchdog-unms-vpn" start-time=startup comment="UNMS Auto-Reconnect"`;

  // ── Script Generator: Server Lokal On-Premise (Direct LAN) ──
  const netplanContent = `# Konfigurasi IP Statis Server Lokal Linux (/etc/netplan/01-netcfg.yaml)
network:
  version: 2
  renderer: networkd
  ethernets:
    ${localLanForm.interfaceName}:
      dhcp4: no
      addresses:
        - ${localLanForm.serverIp}
      routes:
        - to: default
          via: ${localLanForm.gatewayIp}
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]`;

  const vlanNetplanContent = `# Tambahan Konfigurasi VLAN Management OLT jika terpisah (/etc/netplan/01-netcfg.yaml)
  vlans:
    vlan${localLanForm.vlanId}:
      id: ${localLanForm.vlanId}
      link: ${localLanForm.interfaceName}
      addresses: [${localLanForm.serverIp}]`;

  const localTestCmd = `# 1. Terapkan konfigurasi jaringan server lokal
sudo netplan apply

# 2. Uji ping langsung ke OLT lokal
ping -c 4 ${localLanForm.oltIpSample}

# 3. Uji SNMP OLT dari server lokal (pastikan snmp package terpasang: sudo apt install snmp)
snmpwalk -v2c -c public ${localLanForm.oltIpSample} 1.3.6.1.2.1.1.1.0`;

  const fc = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium";
  const lc = "block text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1";

  return createPortal(
    <div className="fixed inset-0 z-[999999] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
              <IconNetwork />
              <span>Panduan Integrasi Jaringan OLT (VPN &amp; Server Lokal)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pilihan metode koneksi: VPN Perusahaan, Tunnel MikroTik, atau Server Lokal On-Premise
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 pt-3 gap-2 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('company_l2tp')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'company_l2tp'
                ? 'bg-white dark:bg-slate-900 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 border-l border-r border-slate-200 dark:border-slate-800'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <IconTerminal />
            <span>Opsi 1: VPN L2TP Perusahaan di VPS (Rekomendasi)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mikrotik_script')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'mikrotik_script'
                ? 'bg-white dark:bg-slate-900 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 border-l border-r border-slate-200 dark:border-slate-800'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <IconNetwork />
            <span>Opsi 2: Script Router MikroTik (Tunnel ke VPS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local_lan')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'local_lan'
                ? 'bg-white dark:bg-slate-900 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 border-l border-r border-slate-200 dark:border-slate-800'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <IconServer />
            <span>Opsi 3: Server Lokal Kantor (Direct LAN On-Premise)</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-900 dark:text-slate-100">
          
          {activeTab === 'company_l2tp' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-slate-950 dark:text-white">
                  Cara Kerja VPN L2TP Perusahaan di VPS:
                </p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  VPS Anda akan bertindak sebagai <strong>L2TP Client</strong> menggunakan akun VPN karyawan dari perusahaan Anda. Begitu terhubung, VPS langsung berada di jaringan kantor dan dapat melakukan <strong>SNMP, Telnet, SSH, dan Ping</strong> ke seluruh IP lokal OLT (tanpa perlu menyentuh konfigurasi router kantor).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div>
                  <label className={lc}>Server VPN Kantor (IP / Domain)</label>
                  <input type="text" value={vpsVpnForm.serverIp} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, serverIp: e.target.value })} className={fc} />
                </div>
                <div>
                  <label className={lc}>IPsec Pre-Shared Key (Secret)</label>
                  <input type="text" value={vpsVpnForm.ipsecSecret} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, ipsecSecret: e.target.value })} className={fc} />
                </div>
                <div>
                  <label className={lc}>Username Akun VPN Anda</label>
                  <input type="text" value={vpsVpnForm.username} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, username: e.target.value })} className={fc} />
                </div>
                <div>
                  <label className={lc}>Password Akun VPN Anda</label>
                  <input type="password" value={vpsVpnForm.password} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, password: e.target.value })} className={fc} />
                </div>
                <div>
                  <label className={lc}>Subnet Lokal OLT Kantor</label>
                  <input type="text" value={vpsVpnForm.oltSubnet} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, oltSubnet: e.target.value })} className={fc} />
                </div>
                <div>
                  <label className={lc}>Contoh IP OLT untuk Uji Ping</label>
                  <input type="text" value={vpsVpnForm.oltIpSample} onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, oltIpSample: e.target.value })} className={fc} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Langkah 1: Install Paket Strongswan &amp; XL2TPD di VPS Ubuntu/Debian</span>
                    <button type="button" onClick={() => handleCopy(linuxInstallCmd, 'linux_install')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'linux_install' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'linux_install' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400">{linuxInstallCmd}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Langkah 2: Konfigurasi File /etc/ipsec.conf &amp; /etc/ipsec.secrets</span>
                    <button type="button" onClick={() => handleCopy(ipsecConfContent, 'ipsec_conf')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'ipsec_conf' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'ipsec_conf' ? 'Tersalin' : 'Salin Konfigurasi'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{`# Salin ke file: /etc/ipsec.conf\n${ipsecConfContent}\n\n# Salin ke file: /etc/ipsec.secrets\n${ipsecSecretsContent}`}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Langkah 3: Konfigurasi /etc/xl2tpd/xl2tpd.conf &amp; /etc/ppp/options.l2tpd.client</span>
                    <button type="button" onClick={() => handleCopy(pppOptionsContent, 'ppp_opt')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'ppp_opt' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'ppp_opt' ? 'Tersalin' : 'Salin Konfigurasi'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{`# Salin ke file: /etc/xl2tpd/xl2tpd.conf\n${xl2tpdConfContent}\n\n# Salin ke file: /etc/ppp/options.l2tpd.client\n${pppOptionsContent}`}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Langkah 4: Perintah Start Koneksi &amp; Uji Ping ke OLT Lokal</span>
                    <button type="button" onClick={() => handleCopy(linuxConnectCmd, 'linux_connect')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'linux_connect' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'linux_connect' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400">{linuxConnectCmd}</pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mikrotik_script' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-slate-950 dark:text-white">Cara Kerja Tunnel MikroTik ke VPS:</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">Router MikroTik di kantor/POP Anda akan melakukan <strong>dial out VPN Client</strong> ke IP Publik VPS Anda. Script di bawah sudah dilengkapi <strong>Watchdog Scheduler</strong> yang otomatis memeriksa koneksi tiap 2 menit dan melakukan reconnect jika jaringan internet kantor sempat terputus atau modem di-restart.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div><label className={lc}>IP Publik VPS Fiber-UNMS</label><input type="text" value={mikrotikForm.vpsPublicIp} onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpsPublicIp: e.target.value })} className={fc} /></div>
                <div><label className={lc}>Username VPN Client</label><input type="text" value={mikrotikForm.vpnUser} onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpnUser: e.target.value })} className={fc} /></div>
                <div><label className={lc}>Password VPN Client</label><input type="text" value={mikrotikForm.vpnPassword} onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpnPassword: e.target.value })} className={fc} /></div>
                <div><label className={lc}>IPsec Pre-Shared Secret</label><input type="text" value={mikrotikForm.ipsecSecret} onChange={(e) => setMikrotikForm({ ...mikrotikForm, ipsecSecret: e.target.value })} className={fc} /></div>
                <div><label className={lc}>Subnet Lokal OLT di MikroTik</label><input type="text" value={mikrotikForm.oltLocalSubnet} onChange={(e) => setMikrotikForm({ ...mikrotikForm, oltLocalSubnet: e.target.value })} className={fc} /></div>
                <div><label className={lc}>IP OLT untuk Uji Coba</label><input type="text" value={mikrotikForm.oltIpSample} onChange={(e) => setMikrotikForm({ ...mikrotikForm, oltIpSample: e.target.value })} className={fc} /></div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Script 1: Konfigurasi L2TP Client &amp; Routing di RouterOS MikroTik</span>
                    <button type="button" onClick={() => handleCopy(mikrotikScript, 'mikrotik_client')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'mikrotik_client' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'mikrotik_client' ? 'Tersalin' : 'Salin Script MikroTik'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{mikrotikScript}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Script 2: Watchdog Auto-Reconnect Scheduler di MikroTik (Anti-Mati)</span>
                    <button type="button" onClick={() => handleCopy(mikrotikWatchdogScript, 'mikrotik_watchdog')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'mikrotik_watchdog' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'mikrotik_watchdog' ? 'Tersalin' : 'Salin Watchdog Script'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{mikrotikWatchdogScript}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Script 3: Setup VPN Server di Linux VPS (Jalankan Sekali di Terminal VPS)</span>
                    <button type="button" onClick={() => handleCopy(vpsServerSetupScript, 'vps_server')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'vps_server' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'vps_server' ? 'Tersalin' : 'Salin Setup Server'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400">{vpsServerSetupScript}</pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'local_lan' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-slate-950 dark:text-white">Cara Kerja Server Lokal On-Premise (Satu Jaringan LAN):</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">Jika aplikasi Fiber-UNMS di-install langsung pada server/PC yang berada di kantor/ruang server POP Anda (On-Premise), Anda tidak memerlukan VPN. Server terhubung langsung ke switch/port manajemen OLT secara lokal.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div><label className={lc}>IP Address Server UNMS</label><input type="text" value={localLanForm.serverIp} onChange={(e) => setLocalLanForm({ ...localLanForm, serverIp: e.target.value })} className={fc} /></div>
                <div><label className={lc}>Gateway Jaringan OLT</label><input type="text" value={localLanForm.gatewayIp} onChange={(e) => setLocalLanForm({ ...localLanForm, gatewayIp: e.target.value })} className={fc} /></div>
                <div><label className={lc}>Interface Fisik Server</label><input type="text" value={localLanForm.interfaceName} onChange={(e) => setLocalLanForm({ ...localLanForm, interfaceName: e.target.value })} className={fc} /></div>
                <div><label className={lc}>VLAN ID Manajemen (Jika Ada)</label><input type="text" value={localLanForm.vlanId} onChange={(e) => setLocalLanForm({ ...localLanForm, vlanId: e.target.value })} className={fc} /></div>
                <div><label className={lc}>IP OLT untuk Uji Coba</label><input type="text" value={localLanForm.oltIpSample} onChange={(e) => setLocalLanForm({ ...localLanForm, oltIpSample: e.target.value })} className={fc} /></div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Opsi A: Konfigurasi IP Statis Langsung (Satu Subnet dengan OLT)</span>
                    <button type="button" onClick={() => handleCopy(netplanContent, 'lan_static')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'lan_static' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'lan_static' ? 'Tersalin' : 'Salin Perintah Netplan'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{netplanContent}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Opsi B: Konfigurasi Sub-Interface VLAN Manajemen (802.1Q)</span>
                    <button type="button" onClick={() => handleCopy(vlanNetplanContent, 'lan_vlan')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'lan_vlan' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'lan_vlan' ? 'Tersalin' : 'Salin VLAN Netplan'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-slate-800 dark:text-slate-200">{vlanNetplanContent}</pre>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950 dark:text-white">Langkah Verifikasi: Tes Ping &amp; SNMP Walk ke OLT</span>
                    <button type="button" onClick={() => handleCopy(localTestCmd, 'lan_verify')} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                      {copiedKey === 'lan_verify' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'lan_verify' ? 'Tersalin' : 'Salin Uji Coba'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400">{localTestCmd}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sistem mendukung multi-mode: VPN L2TP, MikroTik Site-to-Site, maupun Server Lokal LAN.</span>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer">Tutup Panduan</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
