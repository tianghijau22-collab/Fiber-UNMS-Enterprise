import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import RefreshButton from '../components/RefreshButton';

export default function NetworkBridgeSetup() {
  const { hasRole } = useAuth();

  // Environment detection state
  const [detecting, setDetecting] = useState(true);
  const [envData, setEnvData] = useState(null);

  // Wizard active step
  const [activeStep, setActiveStep] = useState(1);

  // Config Form State
  const [config, setConfig] = useState({
    routerModel: 'hap_lite',
    vpnProtocol: 'l2tp',
    vpsIp: '103.89.6.125',
    vpnUser: 'vpnuser',
    vpnPassword: 'vpnpassword2026',
    vpnSecret: 'unmssecret2026',
    oltIp: '192.168.100.1',
    wanInterface: 'ether1',
    oltInterface: 'ether2',
    lanInterface: 'ether3',
  });

  // Generated Script State
  const [generating, setGenerating] = useState(false);
  const [scripts, setScripts] = useState(null);
  const [copiedType, setCopiedType] = useState(null);

  // Live Test State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [routerApiResult, setRouterApiResult] = useState(null);
  const [testTargetType, setTestTargetType] = useState('olt'); // 'olt' or 'router'

  // Physical Checklist State
  const [checklist, setChecklist] = useState({
    wanPlugged: false,
    oltPlugged: false,
    lanPlugged: false,
    fiberPlugged: false,
  });

  // Auto-generate random secure credentials
  const generateRandomCredentials = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let p = '';
    let s = '';
    for (let i = 0; i < 10; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    setConfig(prev => ({
      ...prev,
      vpnUser: 'unms_client',
      vpnPassword: p,
      vpnSecret: s,
    }));
  };

  // Fetch Environment Detection from Server
  const fetchEnvironment = () => {
    setDetecting(true);
    fetch('/api/vps-bridge/detect-environment')
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          setEnvData(res.data);
          setConfig(prev => ({
            ...prev,
            vpsIp: res.data.server_ip || '103.89.6.125',
            oltIp: res.data.default_olt_ip || '192.168.100.1',
          }));
        }
        setDetecting(false);
      })
      .catch(() => setDetecting(false));
  };

  useEffect(() => {
    fetchEnvironment();
  }, []);

  // Generate Scripts when Config changes
  const handleGenerateScript = () => {
    setGenerating(true);
    fetch('/api/vps-bridge/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vps_ip: config.vpsIp,
        vpn_protocol: config.vpnProtocol,
        vpn_user: config.vpnUser,
        vpn_password: config.vpnPassword,
        vpn_secret: config.vpnSecret,
        olt_ip: config.oltIp,
        wan_interface: config.wanInterface,
        olt_port_interface: config.oltInterface,
        lan_interface: config.lanInterface,
        router_model: config.routerModel === 'hap_lite' ? 'MikroTik hAP lite (RB941-2nD)' : 'MikroTik RouterOS v6/v7',
      }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          setScripts(res.data);
        }
        setGenerating(false);
      })
      .catch(() => setGenerating(false));
  };

  useEffect(() => {
    handleGenerateScript();
  }, [config.vpsIp, config.vpnProtocol, config.vpnUser, config.vpnPassword, config.vpnSecret, config.oltIp, config.routerModel, config.wanInterface, config.oltInterface, config.lanInterface]);

  // Copy to clipboard helper
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Download .rsc file helper
  const downloadRscFile = () => {
    if (!scripts?.mikrotik_script) return;
    const blob = new Blob([scripts.mikrotik_script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mikrotik_unms_bridge_${config.routerModel}.rsc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Run live bridge connection test (SNMP OLT or Router API)
  const handleTestBridge = () => {
    setTesting(true);
    setTestResult(null);
    setRouterApiResult(null);

    if (testTargetType === 'router') {
      fetch(`/api/monitoring/router/live-metrics?ip=10.254.0.2&user=${encodeURIComponent(config.vpnUser || 'admin')}&password=${encodeURIComponent(config.vpnPassword || '')}`)
        .then(r => r.json())
        .then(res => {
          setRouterApiResult(res);
          setTesting(false);
        })
        .catch(() => {
          setRouterApiResult({ success: false, message: 'Gagal menghubungi RouterOS API' });
          setTesting(false);
        });
      return;
    }

    fetch('/api/vps-bridge/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_ip: config.oltIp,
        community: 'public',
        snmp_version: 'v2c',
      }),
    })
      .then(r => r.json())
      .then(res => {
        setTestResult(res.data);
        setTesting(false);
      })
      .catch(() => {
        setTestResult({ ping_success: false, snmp_success: false, error: 'Gagal menghubungi server VPS' });
        setTesting(false);
      });
  };

  const steps = [
    { num: 1, title: '1. Topologi & Kabel', desc: 'Port hAP lite & OLT HSGQ' },
    { num: 2, title: '2. Setup VPN di VPS', desc: 'Tunnel Server Cloud' },
    { num: 3, title: '3. Script MikroTik', desc: 'Generator 1-Klik Winbox' },
    { num: 4, title: '4. Setting OLT & SNMP', desc: 'Checklist Web GUI HSGQ' },
    { num: 5, title: '5. Uji Bridge Live', desc: 'Ping & SNMP Diagnostic' },
  ];

  const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all";
  const labelCls = "block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1";

  const isSuperAdmin = hasRole('Super Administrator');

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold mb-4 border border-rose-200 dark:border-rose-800">
          🔒
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Akses Terbatas</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
          Halaman <strong>Bridge Integrasi Router &amp; OLT ke VPS Cloud</strong> hanya dapat diakses oleh pengguna dengan hak akses <strong>Super Administrator</strong>.
        </p>
        <a
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-xs"
        >
          Kembali ke Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full font-sans transition-colors duration-200">

      {/* ── Top Header Banner ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Bridge Integrasi Router &amp; OLT ke VPS Cloud
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Konfigurasi terowongan VPN untuk menghubungkan perangkat fisik kantor ke server UNMS —
            </p>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              MikroTik hAP lite &amp; OLT HSGQ-E04
            </span>
            {envData && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${envData.snmp_available
                ? 'bg-emerald-50 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                : 'bg-rose-50 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                }`}>
                PHP SNMP: {envData.snmp_available ? 'Aktif' : 'Tidak Aktif'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={fetchEnvironment}
            disabled={detecting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span>{detecting ? '🔍 Mendeteksi...' : '🔄 Refresh Deteksi IP'}</span>
          </button>
          <a
            href="/olt-management"
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 border border-slate-700 dark:border-slate-300 shadow-xs"
          >
            <span>Buka OLT Management ➜</span>
          </a>
        </div>
      </div>

      {/* ── Auto-Detection Summary KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            🌐 IP Klien Anda (PC Kantor)
          </div>
          <div className="text-lg font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-2 truncate">
            {envData?.client_ip || 'Mendeteksi...'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Terdeteksi otomatis dari jaringan kantor Anda
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            ☁️ IP VPS Cloud UNMS
          </div>
          <div className="text-lg font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mt-2 truncate">
            {envData?.server_ip || config.vpsIp}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Target Endpoint Server VPN Tunnel
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            🏢 Target IP OLT Fisik
          </div>
          <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 truncate">
            {config.oltIp}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Default Pabrik HSGQ-E04 (Port NMS/Uplink)
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            📡 Model Router Uji Coba
          </div>
          <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-2 truncate">
            MikroTik hAP lite
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            RB941-2nD (Fast Ethernet 4-Port)
          </div>
        </div>
      </div>

      {/* ── Wizard Step Navigation Pills ────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-3 rounded-lg shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {steps.map(s => {
            const isActive = activeStep === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                className={`p-3 rounded-lg border text-left transition-all relative ${isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm font-bold'
                  : 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-neutral-700'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-indigo-200 dark:text-indigo-600' : 'text-slate-400'}`}>
                    Langkah {s.num}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </div>
                <div className="font-bold text-xs mt-1 truncate">{s.title}</div>
                <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'opacity-80' : 'text-slate-400'}`}>{s.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1: TOPOLOGI & PEMASANGAN KABEL FISIK
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 1 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🔌 Langkah 1: Skema Pemasangan Kabel Fisik (MikroTik hAP lite &amp; OLT HSGQ)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ikuti skema colok kabel LAN di bawah agar pembagian jalur internet dan manajemen OLT berjalan rapi.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* MikroTik hAP lite Box */}
            <div className="border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-neutral-900/50 rounded-lg p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#222222] pb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Router MikroTik hAP lite (RB941-2nD)</h3>
                  <p className="text-[11px] text-slate-500">4 Port Fast Ethernet 10/100</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                  ROUTER
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">Port 1 (Ether1):</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Kabel Sumber Internet (WAN ISP)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                    DHCP Client
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">Port 2 (Ether2):</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Kabel ke Uplink 1 OLT HSGQ</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">192.168.100.2</span>
                </div>

                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">Port 3 (Ether3):</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Kabel ke Laptop / PC Kantor</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">192.168.88.1</span>
                </div>

                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs opacity-60">
                  <div>
                    <span className="font-bold font-mono">Port 4 (Ether4):</span>
                    <span className="ml-2">Cadangan / Switch Tambahan</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">Optional</span>
                </div>
              </div>
            </div>

            {/* OLT HSGQ Box */}
            <div className="border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-neutral-900/50 rounded-lg p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-[#222222] pb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">OLT HSGQ-E04 (4-Port EPON)</h3>
                  <p className="text-[11px] text-slate-500">Default IP: 192.168.100.1</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  OLT
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Port Uplink 1:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Terhubung ke Port 2 MikroTik</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                    Data Internet
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Port PON 1:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Modul SFP EPON &amp; Kabel Fiber ke ONU</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                    Optik Fiber
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Port NMS / MGMT:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 ml-2">Port Web GUI OLT (192.168.100.1)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">Web GUI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist Verification */}
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-neutral-900 border border-indigo-200 dark:border-neutral-800 space-y-2.5">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
              Checklist Kesiapan Fisik:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={checklist.wanPlugged} onChange={e => setChecklist({ ...checklist, wanPlugged: e.target.checked })} className="rounded text-indigo-600" />
                <span>Kabel Internet WAN sudah dicolok ke <strong>Port 1 MikroTik</strong></span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={checklist.oltPlugged} onChange={e => setChecklist({ ...checklist, oltPlugged: e.target.checked })} className="rounded text-indigo-600" />
                <span>Kabel dari <strong>Port 2 MikroTik</strong> sudah dicolok ke <strong>Uplink 1 OLT</strong></span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={checklist.lanPlugged} onChange={e => setChecklist({ ...checklist, lanPlugged: e.target.checked })} className="rounded text-indigo-600" />
                <span>Kabel dari <strong>Port 3 MikroTik</strong> sudah dicolok ke <strong>Laptop/PC</strong></span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={checklist.fiberPlugged} onChange={e => setChecklist({ ...checklist, fiberPlugged: e.target.checked })} className="rounded text-indigo-600" />
                <span>Modul SFP &amp; kabel optik sudah terhubung ke <strong>Modem/ONU</strong></span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveStep(2)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 2: Setup VPN di VPS ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2: SETUP VPN SERVER DI VPS CLOUD
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 2 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                🛡️ Langkah 2: Aktifkan VPN Server di VPS Cloud ({config.vpsIp})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Jalankan script otomatis berikut di terminal SSH VPS Anda untuk mengaktifkan server L2TP/IPsec.
              </p>
            </div>
            <button
              onClick={generateRandomCredentials}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all self-start sm:self-auto shadow-2xs"
            >
              🎲 Acak Kredensial Baru
            </button>
          </div>

          {/* Form Kredensial VPN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-neutral-900/50 p-4 rounded-lg border border-slate-200 dark:border-[#222222]">
            <div>
              <label className={labelCls}>IP Publik VPS</label>
              <input
                type="text"
                value={config.vpsIp}
                onChange={e => setConfig({ ...config, vpsIp: e.target.value })}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div>
              <label className={labelCls}>VPN Username</label>
              <input
                type="text"
                value={config.vpnUser}
                onChange={e => setConfig({ ...config, vpnUser: e.target.value })}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div>
              <label className={labelCls}>VPN Password</label>
              <input
                type="text"
                value={config.vpnPassword}
                onChange={e => setConfig({ ...config, vpnPassword: e.target.value })}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div>
              <label className={labelCls}>IPsec Secret (PSK)</label>
              <input
                type="text"
                value={config.vpnSecret}
                onChange={e => setConfig({ ...config, vpnSecret: e.target.value })}
                className={inputCls + ' font-mono'}
              />
            </div>
          </div>

          {/* Script Box for VPS Terminal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                💻 Salin &amp; Paste Perintah Ini di Terminal SSH VPS:
              </label>
              <button
                onClick={() => copyToClipboard(scripts?.vps_script || '', 'vps')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>{copiedType === 'vps' ? '✓ Tersalin!' : '📋 Salin Script VPS'}</span>
              </button>
            </div>

            <pre className="bg-slate-950 dark:bg-black text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 dark:border-[#222222] shadow-inner">
              {scripts?.vps_script || 'Menghasilkan script...'}
            </pre>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveStep(1)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              ⬅ Kembali
            </button>
            <button
              onClick={() => setActiveStep(3)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 3: Script MikroTik ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3: SCRIPT GENERATOR 1-KLIK MIKROTIK hAP LITE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 3 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                🚀 Langkah 3: Script Siap Pakai untuk MikroTik hAP lite
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Buka aplikasi <strong>Winbox</strong> $\rightarrow$ Login hAP lite $\rightarrow$ Buka menu <strong>New Terminal</strong> $\rightarrow$ Paste script ini.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadRscFile}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors shadow-2xs flex items-center gap-1"
              >
                <span>💾 Download .RSC</span>
              </button>
              <button
                onClick={() => copyToClipboard(scripts?.mikrotik_script || '', 'mikrotik')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>{copiedType === 'mikrotik' ? '✓ Tersalin!' : '📋 Salin Script'}</span>
              </button>
            </div>
          </div>

          {/* Quick Port Mapping Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-neutral-900/50 p-4 rounded-lg border border-slate-200 dark:border-[#222222] text-xs">
            <div>
              <label className={labelCls}>Port Internet WAN</label>
              <select
                value={config.wanInterface}
                onChange={e => setConfig({ ...config, wanInterface: e.target.value })}
                className={inputCls}
              >
                <option value="ether1">ether1 (Default WAN)</option>
                <option value="ether2">ether2</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Port Jalur OLT HSGQ</label>
              <select
                value={config.oltInterface}
                onChange={e => setConfig({ ...config, oltInterface: e.target.value })}
                className={inputCls}
              >
                <option value="ether2">ether2 (Default OLT)</option>
                <option value="ether3">ether3</option>
                <option value="ether4">ether4</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Port Jalur Laptop / LAN</label>
              <select
                value={config.lanInterface}
                onChange={e => setConfig({ ...config, lanInterface: e.target.value })}
                className={inputCls}
              >
                <option value="ether3">ether3 (Default Laptop)</option>
                <option value="ether4">ether4</option>
              </select>
            </div>
          </div>

          {/* Script Output Box */}
          <div className="space-y-2">
            <pre className="bg-slate-950 dark:bg-black text-indigo-300 dark:text-indigo-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 dark:border-[#222222] shadow-inner max-h-96">
              {scripts?.mikrotik_script || 'Menghasilkan script MikroTik...'}
            </pre>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              ⬅ Kembali
            </button>
            <button
              onClick={() => setActiveStep(4)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 4: Setting OLT &amp; SNMP ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4: KONFIGURASI WEB GUI OLT HSGQ & SNMP
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 4 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🏢 Langkah 4: Aktivasi SNMP &amp; VLAN di Web GUI OLT HSGQ-E04
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Buka browser di laptop dan akses alamat Web OLT: <code className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">http://192.168.100.1</code>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Box 1: Login & VLAN */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-neutral-900/50 space-y-2.5">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-bold">A</span>
                <span>Login &amp; VLAN Transparan</span>
              </h3>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span><strong>Username:</strong> <code className="bg-white dark:bg-black px-1 rounded font-mono border border-slate-200 dark:border-[#222222]">root</code> (atau <code className="bg-white dark:bg-black px-1 rounded font-mono border border-slate-200 dark:border-[#222222]">admin</code>)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span><strong>Password:</strong> <code className="bg-white dark:bg-black px-1 rounded font-mono border border-slate-200 dark:border-[#222222]">admin</code></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>Masuk ke menu <strong>VLAN Management</strong> $\rightarrow$ Pastikan Port <strong>Uplink 1</strong> dan <strong>PON 1</strong> terdaftar dalam <strong>Default VLAN 1</strong> (Untagged/Hybrid).</span>
                </li>
              </ul>
            </div>

            {/* Box 2: SNMP Configuration */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-neutral-900/50 space-y-2.5">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">B</span>
                <span>Aktivasi Layanan SNMP (Kritis)</span>
              </h3>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Masuk ke menu <strong>System Management</strong> $\rightarrow$ <strong>SNMP Configuration</strong>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Centang <strong>SNMP Enable = ON</strong>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Pilih Version: <strong>v2c</strong>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Isi Read Community: <code className="bg-white dark:bg-black px-1.5 py-0.5 rounded font-mono font-bold text-emerald-600 border border-slate-200 dark:border-[#222222]">public</code></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>Klik <strong>Apply</strong>, lalu klik <strong>Save Configuration / Save to Flash</strong> di pojok kanan atas.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveStep(3)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              ⬅ Kembali
            </button>
            <button
              onClick={() => setActiveStep(5)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 5: Uji Bridge &amp; SNMP Live ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 5: UJI KONEKSI BRIDGE & DIAGNOSTIC SNMP LIVE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 5 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              ⚡ Langkah 5: Uji Jangkauan dari VPS Cloud ke OLT Kantor
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tekan tombol di bawah untuk menguji apakah VPS Cloud sudah bisa melakukan Ping dan membaca SNMP OLT di meja kantor Anda.
            </p>
          </div>

          {/* Target Switch: OLT SNMP vs MikroTik RouterOS API */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#222222] pb-3">
            <button
              onClick={() => setTestTargetType('olt')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${testTargetType === 'olt'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
            >
              🏢 1. Uji SNMP OLT ({config.oltIp})
            </button>
            <button
              onClick={() => setTestTargetType('router')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${testTargetType === 'router'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
            >
              📶 2. Uji RouterOS API Socket (Port 8728)
            </button>
          </div>

          <div className="p-5 rounded-lg bg-slate-50 dark:bg-neutral-900/50 border border-slate-200 dark:border-[#222222] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className={labelCls}>
                  {testTargetType === 'olt' ? 'Target IP OLT (SNMP UDP 161)' : 'Target IP MikroTik (API Port 8728)'}
                </label>
                <div className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {testTargetType === 'olt' ? config.oltIp : '10.254.0.2 (atau IP LAN Router)'}
                </div>
              </div>

              <button
                onClick={handleTestBridge}
                disabled={testing}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? <span>Menguji Koneksi...</span> : (
                  <span>{testTargetType === 'olt' ? '⚡ Uji Koneksi Live SNMP OLT' : '⚡ Uji RouterOS API Socket'}</span>
                )}
              </button>
            </div>

            {/* Test Result Display - OLT SNMP */}
            {testTargetType === 'olt' && testResult && (
              <div className={`p-4 rounded-lg border space-y-2.5 ${testResult.snmp_success
                ? 'bg-emerald-50 dark:bg-neutral-900 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : testResult.ping_success
                  ? 'bg-amber-50 dark:bg-neutral-900 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-neutral-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">
                    {testResult.snmp_success
                      ? '🎉 KONEKSI SNMP BERHASIL! VPS & OLT TERHUBUNG 100%'
                      : testResult.ping_success
                        ? '⚠️ PING BERHASIL · SNMP TIDAK MERESPON'
                        : '❌ PING GAGAL (TIDAK TERJANGKAU)'}
                  </div>
                  {testResult.latency_ms && (
                    <span className="text-xs font-mono font-bold bg-white/80 dark:bg-black/60 px-2 py-0.5 rounded border border-current">
                      Latency: {testResult.latency_ms} ms
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1">
                  {testResult.snmp_success ? (
                    <p>Layanan SNMP merespon data MIB dengan sempurna. Anda sudah bisa langsung membuka halaman <strong>OLT Management</strong> untuk melihat status port live dan redaman optik.</p>
                  ) : testResult.ping_success ? (
                    <p>OLT dapat di-ping melalui VPN, namun SNMP belum aktif di Web GUI OLT. Pastikan menu SNMP sudah di-Enable dengan community <code>public</code>.</p>
                  ) : (
                    <p>VPS belum bisa menjangkau IP {config.oltIp}. Pastikan VPN di MikroTik hAP lite sudah berstatus <em>Connected (R)</em> dan rute di VPS sudah ditambahkan.</p>
                  )}
                </div>
              </div>
            )}

            {/* Test Result Display - RouterOS API */}
            {testTargetType === 'router' && routerApiResult && (
              <div className={`p-4 rounded-lg border space-y-2.5 ${routerApiResult.success
                ? 'bg-emerald-50 dark:bg-neutral-900 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-neutral-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">
                    {routerApiResult.success
                      ? '🎉 KONEKSI MIKROTIK ROUTEROS API BERHASIL!'
                      : '❌ MIKROTIK ROUTEROS API BELUM TERHUBUNG'}
                  </div>
                </div>

                {routerApiResult.success && routerApiResult.data && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
                    <div className="p-2 bg-white dark:bg-black rounded border border-current">
                      <div className="text-[10px] uppercase opacity-70">Model Router</div>
                      <div className="font-bold">{routerApiResult.data.system?.board_name || 'hAP lite'}</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-black rounded border border-current">
                      <div className="text-[10px] uppercase opacity-70">RouterOS</div>
                      <div className="font-bold">{routerApiResult.data.system?.version || '-'}</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-black rounded border border-current">
                      <div className="text-[10px] uppercase opacity-70">CPU Load</div>
                      <div className="font-bold">{routerApiResult.data.system?.cpu_load}%</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-black rounded border border-current">
                      <div className="text-[10px] uppercase opacity-70">PPPoE Aktif</div>
                      <div className="font-bold">{routerApiResult.data.pppoe_active_count} Sesi</div>
                    </div>
                  </div>
                )}

                <div className="text-xs">
                  {routerApiResult.message || 'Data telemetri RouterOS API socket terbaca dengan baik.'}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveStep(4)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              ⬅ Kembali
            </button>
            <a
              href="/olt-management"
              className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Buka OLT Management Sekarang ➜</span>
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
