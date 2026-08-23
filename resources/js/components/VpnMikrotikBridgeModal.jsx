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

  const fc = "w-full px-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs text-black dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-medium";
  const lc = "block text-[11px] font-bold text-black dark:text-white uppercase tracking-wider mb-1";

  return createPortal(
    <div className="fixed inset-0 z-[999999] overflow-y-auto bg-black/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-4xl bg-white dark:bg-black rounded-3xl shadow-2xl border border-slate-200 dark:border-neutral-800 flex flex-col my-auto max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-white dark:bg-black px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
              <IconNetwork />
              <span>Panduan Integrasi Jaringan OLT (VPN &amp; Server Lokal)</span>
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              Pilihan metode koneksi: VPN Perusahaan, Tunnel MikroTik, atau Server Lokal On-Premise
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 px-6 pt-3 gap-2 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('company_l2tp')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t-2 flex items-center gap-2 shrink-0 ${
              activeTab === 'company_l2tp'
                ? 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white border-l border-r border-slate-200 dark:border-neutral-800'
                : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
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
                ? 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white border-l border-r border-slate-200 dark:border-neutral-800'
                : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
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
                ? 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white border-l border-r border-slate-200 dark:border-neutral-800'
                : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <IconServer />
            <span>Opsi 3: Server Lokal Kantor (Direct LAN On-Premise)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-black dark:text-white">
          
          {/* TAB 1: VPN L2TP PERUSAHAAN DI VPS */}
          {activeTab === 'company_l2tp' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-black dark:text-white">
                  Cara Kerja VPN L2TP Perusahaan di VPS:
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  VPS Anda akan bertindak sebagai <strong>L2TP Client</strong> menggunakan akun VPN karyawan dari perusahaan Anda. Begitu terhubung, VPS langsung berada di jaringan kantor dan dapat melakukan <strong>SNMP, Telnet, SSH, dan Ping</strong> ke seluruh IP lokal OLT (tanpa perlu menyentuh konfigurasi router kantor).
                </p>
              </div>

              {/* Parameter Form Helper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl">
                <div>
                  <label className={lc}>Server VPN Kantor (IP / Domain)</label>
                  <input
                    type="text"
                    value={vpsVpnForm.serverIp}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, serverIp: e.target.value })}
                    placeholder="vpn.kantor.com / 103.x.x.x"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>IPsec Pre-Shared Key (Secret)</label>
                  <input
                    type="text"
                    value={vpsVpnForm.ipsecSecret}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, ipsecSecret: e.target.value })}
                    placeholder="Secret IPsec"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Username Akun VPN Anda</label>
                  <input
                    type="text"
                    value={vpsVpnForm.username}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, username: e.target.value })}
                    placeholder="username"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Password Akun VPN Anda</label>
                  <input
                    type="password"
                    value={vpsVpnForm.password}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, password: e.target.value })}
                    placeholder="password"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Subnet Lokal OLT Kantor</label>
                  <input
                    type="text"
                    value={vpsVpnForm.oltSubnet}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, oltSubnet: e.target.value })}
                    placeholder="192.168.1.0/24"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Contoh IP OLT untuk Uji Ping</label>
                  <input
                    type="text"
                    value={vpsVpnForm.oltIpSample}
                    onChange={(e) => setVpsVpnForm({ ...vpsVpnForm, oltIpSample: e.target.value })}
                    placeholder="192.168.1.100"
                    className={fc}
                  />
                </div>
              </div>

              {/* Step by step code blocks */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 1: Install Paket Strongswan &amp; XL2TPD di VPS Ubuntu/Debian
                    </span>
                    <button
                      onClick={() => handleCopy(linuxInstallCmd, 'linux_install')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'linux_install' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'linux_install' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {linuxInstallCmd}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 2: Konfigurasi File /etc/ipsec.conf &amp; /etc/ipsec.secrets
                    </span>
                    <button
                      onClick={() => handleCopy(ipsecConfContent, 'ipsec_conf')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ipsec_conf' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'ipsec_conf' ? 'Tersalin' : 'Salin Konfigurasi'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {`# Salin ke file: /etc/ipsec.conf\n${ipsecConfContent}\n\n# Salin ke file: /etc/ipsec.secrets\n${ipsecSecretsContent}`}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 3: Konfigurasi /etc/xl2tpd/xl2tpd.conf &amp; /etc/ppp/options.l2tpd.client
                    </span>
                    <button
                      onClick={() => handleCopy(pppOptionsContent, 'ppp_opt')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'ppp_opt' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'ppp_opt' ? 'Tersalin' : 'Salin Konfigurasi'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {`# Salin ke file: /etc/xl2tpd/xl2tpd.conf\n${xl2tpdConfContent}\n\n# Salin ke file: /etc/ppp/options.l2tpd.client\n${pppOptionsContent}`}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 4: Perintah Start Koneksi &amp; Uji Ping ke OLT Lokal
                    </span>
                    <button
                      onClick={() => handleCopy(linuxConnectCmd, 'linux_connect')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'linux_connect' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'linux_connect' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {linuxConnectCmd}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCRIPT MIKROTIK (MIKROTIK -> VPS) */}
          {activeTab === 'mikrotik_script' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-black dark:text-white">
                  Cara Kerja Tunnel MikroTik ke VPS:
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Router MikroTik di kantor/POP Anda akan melakukan <strong>dial out VPN Client</strong> ke IP Publik VPS Anda. Script di bawah sudah dilengkapi <strong>Watchdog Scheduler</strong> yang otomatis memeriksa koneksi tiap 2 menit dan melakukan reconnect jika jaringan internet kantor sempat terputus atau modem di-restart.
                </p>
              </div>

              {/* Parameter Form Helper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl">
                <div>
                  <label className={lc}>IP Publik VPS Fiber-UNMS</label>
                  <input
                    type="text"
                    value={mikrotikForm.vpsPublicIp}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpsPublicIp: e.target.value })}
                    placeholder="103.x.x.x"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Username Tunnel VPN</label>
                  <input
                    type="text"
                    value={mikrotikForm.vpnUser}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpnUser: e.target.value })}
                    placeholder="unms_mikrotik"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Password Tunnel VPN</label>
                  <input
                    type="password"
                    value={mikrotikForm.vpnPassword}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, vpnPassword: e.target.value })}
                    placeholder="password"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>IPsec Secret (Preshared Key)</label>
                  <input
                    type="text"
                    value={mikrotikForm.ipsecSecret}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, ipsecSecret: e.target.value })}
                    placeholder="Secret IPsec"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Subnet Lokal OLT di MikroTik</label>
                  <input
                    type="text"
                    value={mikrotikForm.oltLocalSubnet}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, oltLocalSubnet: e.target.value })}
                    placeholder="192.168.10.0/24"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Contoh IP OLT</label>
                  <input
                    type="text"
                    value={mikrotikForm.oltIpSample}
                    onChange={(e) => setMikrotikForm({ ...mikrotikForm, oltIpSample: e.target.value })}
                    placeholder="192.168.10.2"
                    className={fc}
                  />
                </div>
              </div>

              {/* Script Blocks */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Script 1: Setup Interface L2TP Client di Terminal MikroTik
                    </span>
                    <button
                      onClick={() => handleCopy(mikrotikL2tpScript, 'mk_l2tp')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'mk_l2tp' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'mk_l2tp' ? 'Tersalin' : 'Salin Script'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {mikrotikL2tpScript}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Script 2: Rule Firewall &amp; NAT Masquerade ke OLT
                    </span>
                    <button
                      onClick={() => handleCopy(mikrotikRouteScript, 'mk_route')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'mk_route' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'mk_route' ? 'Tersalin' : 'Salin Script'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {mikrotikRouteScript}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Script 3: Auto-Reconnect Watchdog &amp; Scheduler Otomatis (Tiap 2 Menit)
                    </span>
                    <button
                      onClick={() => handleCopy(mikrotikSchedulerScript, 'mk_sched')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'mk_sched' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'mk_sched' ? 'Tersalin' : 'Salin Script'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {mikrotikSchedulerScript}
                  </pre>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SERVER LOKAL KANTOR (DIRECT LAN ON-PREMISE) */}
          {activeTab === 'local_lan' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl space-y-1">
                <p className="font-bold text-sm text-black dark:text-white">
                  Koneksi Server Lokal (On-Premise LAN):
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Jika aplikasi <strong>Fiber-UNMS dideploy langsung di server fisik / Proxmox VM di jaringan kantor</strong>, Anda <strong>TIDAK MEMERLUKAN VPN atau NAT sama sekali</strong>. Server dan OLT sudah berada dalam satu jaringan LAN atau Management VLAN yang sama.
                </p>
              </div>

              {/* Parameter Form Helper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl">
                <div>
                  <label className={lc}>IP Address Server Lokal (CIDR)</label>
                  <input
                    type="text"
                    value={localLanForm.serverIp}
                    onChange={(e) => setLocalLanForm({ ...localLanForm, serverIp: e.target.value })}
                    placeholder="192.168.1.50/24"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Gateway Router / Switch</label>
                  <input
                    type="text"
                    value={localLanForm.gatewayIp}
                    onChange={(e) => setLocalLanForm({ ...localLanForm, gatewayIp: e.target.value })}
                    placeholder="192.168.1.1"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Nama Interface Fisik Server</label>
                  <input
                    type="text"
                    value={localLanForm.interfaceName}
                    onChange={(e) => setLocalLanForm({ ...localLanForm, interfaceName: e.target.value })}
                    placeholder="eth0 / ens18 / enp3s0"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>VLAN ID Management OLT (Opsional)</label>
                  <input
                    type="text"
                    value={localLanForm.vlanId}
                    onChange={(e) => setLocalLanForm({ ...localLanForm, vlanId: e.target.value })}
                    placeholder="100"
                    className={fc}
                  />
                </div>

                <div>
                  <label className={lc}>Contoh IP OLT untuk Uji Coba</label>
                  <input
                    type="text"
                    value={localLanForm.oltIpSample}
                    onChange={(e) => setLocalLanForm({ ...localLanForm, oltIpSample: e.target.value })}
                    placeholder="192.168.1.100"
                    className={fc}
                  />
                </div>
              </div>

              {/* Step by step Local LAN */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 1: Konfigurasi IP Statis Netplan Server Linux (/etc/netplan/01-netcfg.yaml)
                    </span>
                    <button
                      onClick={() => handleCopy(netplanContent, 'netplan_conf')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'netplan_conf' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'netplan_conf' ? 'Tersalin' : 'Salin File'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {netplanContent}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 2 (Opsional): Konfigurasi Sub-Interface VLAN jika OLT di VLAN Terpisah
                    </span>
                    <button
                      onClick={() => handleCopy(vlanNetplanContent, 'vlan_netplan')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'vlan_netplan' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'vlan_netplan' ? 'Tersalin' : 'Salin File'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {vlanNetplanContent}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black dark:text-white">
                      Langkah 3: Perintah Terapkan Jaringan &amp; Uji Ping / SNMP Langsung ke OLT
                    </span>
                    <button
                      onClick={() => handleCopy(localTestCmd, 'local_test')}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'local_test' ? <IconCheck /> : <IconCopy />}
                      <span>{copiedKey === 'local_test' ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 rounded-xl font-mono text-[11px] overflow-x-auto text-black dark:text-white">
                    {localTestCmd}
                  </pre>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl text-xs space-y-1">
                <p className="font-bold text-black dark:text-white">
                  Pengaturan di Form OLT Fiber-UNMS:
                </p>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Pada form Tambah/Edit OLT, pilih <strong>Mode Deployment: Direct LAN (Satu Jaringan)</strong> dan masukkan IP OLT yang ingin dihubungkan.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-neutral-500 font-medium">
            Sistem mendukung multi-mode: VPN L2TP, MikroTik Site-to-Site, maupun Server Lokal LAN.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black font-bold text-xs transition-all cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
