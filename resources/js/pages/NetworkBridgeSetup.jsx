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
    vpnUser: 'unms_client',
    vpnPassword: 'unmspassword2026',
    vpnSecret: 'unmssecret2026',
    oltIp: '192.168.100.1',
    wanInterface: 'ether1',
    oltInterface: 'ether2',
    lanInterface: 'ether3',
    vlanId: 100,
    pppoePool: '10.10.100.2-10.10.100.254',
    pppoeGateway: '10.10.100.1',
    pppoeUser: 'client_demo',
    pppoePassword: 'client123',
    pppoeRate: '10M/10M',
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

  // Sub-tab state for Step 4 & Step 5
  const [oltVendorTab, setOltVendorTab] = useState('hsgq'); // 'hsgq', 'zte', 'huawei', 'vsol'
  const [modemVendorTab, setModemVendorTab] = useState('zte'); // 'zte', 'huawei', 'hsgq_vsol'

  // Physical Checklist State
  const [checklist, setChecklist] = useState({
    wanPlugged: false,
    oltPlugged: false,
    lanPlugged: false,
    fiberPlugged: false,
    onuPlugged: false,
  });

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
        vlan_id: config.vlanId,
        pppoe_pool: config.pppoePool,
        pppoe_gateway: config.pppoeGateway,
        pppoe_user: config.pppoeUser,
        pppoe_password: config.pppoePassword,
        pppoe_rate: config.pppoeRate,
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
  }, [
    config.vpsIp,
    config.vpnProtocol,
    config.vpnUser,
    config.vpnPassword,
    config.vpnSecret,
    config.oltIp,
    config.routerModel,
    config.wanInterface,
    config.oltInterface,
    config.lanInterface,
    config.vlanId,
    config.pppoePool,
    config.pppoeGateway,
    config.pppoeUser,
    config.pppoePassword,
    config.pppoeRate,
  ]);

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
    link.download = `mikrotik_unms_setup_${config.routerModel}.rsc`;
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
    { num: 1, title: '1. Topologi & Kabel', desc: 'Perkabelan Fisik Lengkap' },
    { num: 2, title: '2. Setup VPN VPS', desc: 'Terowongan Cloud' },
    { num: 3, title: '3. Setup MikroTik Awal', desc: 'VLAN + PPPoE + VPN' },
    { num: 4, title: '4. Setup OLT & Registrasi', desc: 'Otorisasi Modem Client' },
    { num: 5, title: '5. Setting Modem Client', desc: 'PPPoE + VLAN 100' },
    { num: 6, title: '6. Uji Bridge Live', desc: 'End-to-End Diagnostic' },
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
              Panduan Setup Lengkap ISP: Router MikroTik, OLT, VLAN, PPPoE Server, &amp; Registrasi Modem Client —
            </p>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              MikroTik + OLT + ONU/ONT Client
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
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono mt-1">
            {detecting ? 'Mendeteksi...' : (envData?.client_ip || '127.0.0.1')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">IP publik koneksi internet Anda</div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            ☁️ IP Server UNMS Cloud
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-1">
            {config.vpsIp}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Target tujuan tunnel VPN</div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            🏢 Target IP OLT Lokal
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {config.oltIp}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Port 161 (SNMPv2c public)</div>
        </div>

        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs hover:border-slate-300 dark:hover:border-[#333333] transition-all">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            🛡️ Subnet VPN Tunnel
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
            10.254.0.0/24
          </div>
          <div className="text-[11px] text-slate-400 mt-1">VPS: .1 | MikroTik: .2</div>
        </div>
      </div>

      {/* ── Wizard Progress Navigation Tabs (6 STEPS) ───────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-2 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map(s => {
            const isActive = activeStep === s.num;
            const isCompleted = activeStep > s.num;
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                className={`p-3 rounded-lg text-left transition-all relative ${isActive
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : isCompleted
                    ? 'bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-900/50'
                  }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-slate-400'
                    }`}>
                    {isCompleted ? '✓' : s.num}
                  </span>
                  <div className="font-bold text-xs truncate">{s.title}</div>
                </div>
                <div className={`text-[10px] mt-1 truncate ${isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'}`}>
                  {s.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1: TOPOLOGI FISIK & PERKABELAN LENGKAP
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 1 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🔌 Langkah 1: Topologi Fisik &amp; Perkabelan Lengkap ISP
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hubungkan kabel jaringan pada MikroTik hAP lite, OLT HSGQ, dan Modem Client (ONU/ONT) sesuai skema di bawah.
            </p>
          </div>

          {/* Visual Wiring Map Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: MikroTik */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📶</span>
                  <span>1. Router MikroTik hAP lite</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  VPN &amp; PPPoE Server
                </span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-mono">
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-indigo-600 font-bold">Ether 1 (WAN):</span> Colok kabel internet dari Modem ISP Kantor.
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-emerald-600 font-bold">Ether 2 (OLT):</span> Colok kabel LAN ke port <strong>Uplink 1 (GE1) OLT HSGQ</strong>.
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-amber-600 font-bold">Ether 3 (LAN):</span> Colok kabel ke <strong>Laptop Teknisi</strong>.
                </li>
              </ul>
            </div>

            {/* Box 2: OLT */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🏢</span>
                  <span>2. OLT HSGQ-E04</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  IP: 192.168.100.1
                </span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-mono">
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-emerald-600 font-bold">Port GE1 (Uplink):</span> Menerima jalur data &amp; VLAN dari Ether 2 MikroTik.
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-indigo-600 font-bold">Port PON 1:</span> Pasang Modul SFP PON &amp; kabel Fiber Optik (Dropcore).
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500 font-bold">Layanan SNMP:</span> Port UDP 161 (Read: public).
                </li>
              </ul>
            </div>

            {/* Box 3: Modem Client */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🏠</span>
                  <span>3. Modem Client (ONU / ONT)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Pelanggan
                </span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 font-mono">
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-purple-600 font-bold">Port Optik (PON):</span> Colok kabel fiber dari splitter/ODP OLT.
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-indigo-600 font-bold">Port LAN 1-4 &amp; Wi-Fi:</span> Terhubung ke HP/PC Pelanggan.
                </li>
                <li className="p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-emerald-600 font-bold">Mode Dial:</span> PPPoE Client (VLAN ID 100).
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Checklist */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Checklist Kesiapan Fisik Perangkat:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={checklist.wanPlugged}
                  onChange={e => setChecklist({ ...checklist, wanPlugged: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">Ether 1 hAP lite terhubung ke Internet WAN</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={checklist.oltPlugged}
                  onChange={e => setChecklist({ ...checklist, oltPlugged: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">Ether 2 hAP lite terhubung ke Uplink OLT</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={checklist.fiberPlugged}
                  onChange={e => setChecklist({ ...checklist, fiberPlugged: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">SFP PON OLT terpasang kabel Dropcore</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveStep(2)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 2: Setup VPN VPS ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2: SETUP VPN SERVER DI VPS CLOUD
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 2 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🛡️ Langkah 2: Server VPN L2TP/IPsec VPS Cloud (Aktif &amp; Siap)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Server VPN pada VPS <code className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">{config.vpsIp}</code> sudah aktif terpasang dan siap menerima koneksi terowongan dari router MikroTik kantor Anda.
            </p>
          </div>

          {/* Credentials Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Host VPS Public</div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">{config.vpsIp}</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase">IPsec Secret (PSK)</div>
              <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{config.vpnSecret}</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase">VPN Username</div>
              <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{config.vpnUser}</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase">VPN Password</div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">{config.vpnPassword}</div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300">
            ✅ <strong>Status Server VPN:</strong> Layanan strongSwan IPsec (Port UDP 500, 4500) dan xl2tpd (Port UDP 1701) sudah berjalan dengan subnet <code>10.254.0.0/24</code>. Rute static menuju subnet OLT <code>192.168.100.0/24 via 10.254.0.2</code> telah aktif.
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
              <span>Lanjut ke Langkah 3: Setup MikroTik Awal ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3: SETUP ROUTER MIKROTIK AWAL (VLAN + PPPoE + OLT BRIDGE + VPN)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 3 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                🚀 Langkah 3: Setup Router MikroTik Awal (VLAN, PPPoE &amp; VPN)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Konfigurasi lengkap router agar siap mengalirkan traffic internet pelanggan via PPPoE + VLAN 100 dan terhubung ke OLT.
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
                <span>{copiedType === 'mikrotik' ? '✓ Tersalin!' : '📋 Salin Script Winbox'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Parameters Setup Form */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Sesuaikan Parameter Jaringan MikroTik:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className={labelCls}>Port WAN (Internet ISP)</label>
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
                <label className={labelCls}>Port Menuju OLT (Uplink)</label>
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
                <label className={labelCls}>Port LAN Teknisi / Laptop</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-neutral-800">
              <div>
                <label className={labelCls}>VLAN ID Internet Pelanggan</label>
                <input
                  type="number"
                  value={config.vlanId}
                  onChange={e => setConfig({ ...config, vlanId: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="100"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default ISP: <code>100</code> (di-bridge ke OLT).</p>
              </div>

              <div>
                <label className={labelCls}>Subnet Pool PPPoE</label>
                <input
                  type="text"
                  value={config.pppoePool}
                  onChange={e => setConfig({ ...config, pppoePool: e.target.value })}
                  className={inputCls}
                  placeholder="10.10.100.2-10.10.100.254"
                />
                <p className="text-[10px] text-slate-400 mt-1">Rentang IP untuk Modem Client.</p>
              </div>

              <div>
                <label className={labelCls}>Sample User &amp; Password PPPoE</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.pppoeUser}
                    onChange={e => setConfig({ ...config, pppoeUser: e.target.value })}
                    className={inputCls}
                    placeholder="client_demo"
                  />
                  <input
                    type="text"
                    value={config.pppoePassword}
                    onChange={e => setConfig({ ...config, pppoePassword: e.target.value })}
                    className={inputCls}
                    placeholder="client123"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Script Output Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Script Terminal Winbox (Otomatis Ter-update):</span>
              <span className="font-mono text-[11px]">RouterOS v6 / v7 Ready</span>
            </div>
            <pre className="bg-slate-950 dark:bg-black text-indigo-300 dark:text-indigo-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 dark:border-[#222222] shadow-inner max-h-96">
              {scripts?.mikrotik_script || 'Menghasilkan script MikroTik...'}
            </pre>
          </div>

          {/* How to paste guide */}
          <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-300">
            💡 <strong>Cara Pakai:</strong> Buka aplikasi <strong>Winbox</strong> $\rightarrow$ Hubungkan ke MikroTik hAP lite $\rightarrow$ Klik menu <strong>New Terminal</strong> $\rightarrow$ Paste script di atas lalu tekan Enter.
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
              <span>Lanjut ke Langkah 4: Setup OLT &amp; Registrasi ONU ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4: SETUP OLT & CARA REGISTRASI MODEM CLIENT (ONU)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 4 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🏢 Langkah 4: Setup OLT &amp; Cara Registrasi Modem Client (ONU)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Panduan mengaktifkan VLAN {config.vlanId}, SNMP, dan melakukan otorisasi modem client (ONU) agar terbaca di OLT.
            </p>
          </div>

          {/* OLT Vendor Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#222222] pb-2">
            {[
              { id: 'hsgq', label: 'HSGQ-E04 / G004 (Web GUI)' },
              { id: 'zte', label: 'ZTE C300 / C320 (CLI)' },
              { id: 'huawei', label: 'Huawei SmartAX (CLI)' },
              { id: 'vsol', label: 'VSOL EPON/GPON (Web GUI)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOltVendorTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${oltVendorTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* HSGQ Guide */}
          {oltVendorTab === 'hsgq' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. VLAN 100 Setup */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-2.5">
                  <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>Setting VLAN {config.vlanId}</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                    <li>• Buka <code>http://192.168.100.1</code> (User: <code>root</code>, Pass: <code>admin</code>).</li>
                    <li>• Masuk menu <strong>VLAN Management</strong> $\rightarrow$ <strong>VLAN Configuration</strong>.</li>
                    <li>• Tambahkan VLAN ID: <code className="font-bold text-indigo-600">{config.vlanId}</code>.</li>
                    <li>• Port <strong>GE1 (Uplink)</strong>: Set sebagai <strong>Tagged</strong>.</li>
                    <li>• Port <strong>PON 1</strong>: Set sebagai <strong>Tagged (Trunk)</strong>.</li>
                    <li>• Klik <strong>Apply</strong> &amp; <strong>Save to Flash</strong>.</li>
                  </ul>
                </div>

                {/* 2. SNMP Setup */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-2.5">
                  <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                    <span>Aktivasi SNMP OLT</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                    <li>• Masuk menu <strong>System Management</strong> $\rightarrow$ <strong>SNMP Configuration</strong>.</li>
                    <li>• Centang <strong>SNMP Switch: ON</strong>.</li>
                    <li>• Version: <strong>v2c</strong>.</li>
                    <li>• Read Community: <code className="font-bold text-emerald-600">public</code>.</li>
                    <li>• Port: <strong>161</strong> (UDP).</li>
                    <li>• Klik <strong>Apply</strong> &amp; <strong>Save to Flash</strong>.</li>
                  </ul>
                </div>

                {/* 3. ONU Registration */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-2.5">
                  <div className="font-bold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                    <span>Registrasi Modem ONU</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                    <li>• Masuk menu <strong>ONU Management</strong> $\rightarrow$ <strong>Auto Find ONU</strong>.</li>
                    <li>• Cari MAC Address / SN Modem Client yang terdeteksi di PON 1.</li>
                    <li>• Klik tombol <strong>Bind / Authorize</strong>.</li>
                    <li>• Pilih DBA Profile: <code>Default</code> &amp; VLAN: <code>{config.vlanId}</code>.</li>
                    <li>• Status ONU akan berubah menjadi <span className="font-bold text-emerald-600">Online</span> (Lampu PON hijau diam).</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ZTE Guide */}
          {oltVendorTab === 'zte' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">Jalankan command CLI berikut di Telnet / Console ZTE C300/C320:</p>
              <pre className="bg-slate-950 dark:bg-black text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 dark:border-[#222222]">
{`# 1. Konfigurasi VLAN ${config.vlanId}
configure terminal
vlan ${config.vlanId}
 name VLAN-INTERNET
exit
interface gei_1/19/1
 switchport mode trunk
 switchport trunk vlan ${config.vlanId}
exit

# 2. Konfigurasi SNMP Read Community
snmp-server community public view AllView rw
snmp-server enable

# 3. Registrasi / Otorisasi Modem Client (ONU)
show gpon onu uncfg
interface gpon-olt_1/1/1
 onu 1 type ZTE-F609 sn ZTEGC1234567
exit
interface gpon-onu_1/1/1:1
 tcont 1 profile 1G
 gemport 1 name INTERNET tcont 1
 service-port 1 vport 1 user-vlan ${config.vlanId} vlan ${config.vlanId}
exit`}
              </pre>
            </div>
          )}

          {/* Huawei Guide */}
          {oltVendorTab === 'huawei' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">Jalankan command CLI berikut di Telnet / Console Huawei SmartAX:</p>
              <pre className="bg-slate-950 dark:bg-black text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 dark:border-[#222222]">
{`# 1. Tambah VLAN ${config.vlanId} & Uplink Port
config
vlan ${config.vlanId} smart
port vlan ${config.vlanId} 0/19 0

# 2. Cek Modem Unregistered & Registrasi
display ont autofind all
interface gpon 0/1
 ont add 0 1 sn-auth "4857544312345678" omci ont-lineprofile-id 10 ont-srvprofile-id 10
 quit

# 3. Service Port Mapping ke VLAN ${config.vlanId}
service-port vlan ${config.vlanId} gpon 0/1/0 ont 1 gemport 1 multi-service user-vlan ${config.vlanId}`}
              </pre>
            </div>
          )}

          {/* VSOL Guide */}
          {oltVendorTab === 'vsol' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-2">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">Langkah Web GUI VSOL V1600:</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
                  <li>Buka <code>http://192.168.8.100</code> (Default VSOL).</li>
                  <li>Menu <strong>VLAN</strong> $\rightarrow$ Tambah VLAN ID <code>{config.vlanId}</code> $\rightarrow$ Tagged pada GE1 &amp; PON1.</li>
                  <li>Menu <strong>ONU Configuration</strong> $\rightarrow$ <strong>Auto Auth List</strong> $\rightarrow$ Enable Auto Learn.</li>
                  <li>Pilih ONU MAC yang ditemukan $\rightarrow$ Klik <strong>Authorize</strong> dengan Line Profile VLAN <code>{config.vlanId}</code>.</li>
                </ol>
              </div>
            </div>
          )}

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
              <span>Lanjut ke Langkah 5: Setting Modem Client ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 5: KONFIGURASI MODEM CLIENT (ONU / ONT RUMAH PELANGGAN)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 5 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              🏠 Langkah 5: Konfigurasi Modem Client (PPPoE &amp; VLAN {config.vlanId})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Panduan setting modem pelanggan di rumah agar otomatis dial PPPoE ke MikroTik dan terkoneksi ke internet.
            </p>
          </div>

          {/* Modem Brand Selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#222222] pb-2">
            {[
              { id: 'zte', label: 'ZTE F609 / F670 (Indihome/Retail)' },
              { id: 'huawei', label: 'Huawei HG8245H / HG8245A' },
              { id: 'hsgq_vsol', label: 'HSGQ / V-SOL / Global XPON' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setModemVendorTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modemVendorTab === tab.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Step-by-Step Modem Config Guide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Left Box: Form Parameters Checklist */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>⚙️</span>
                <span>Parameter WAN Connection Modem:</span>
              </h3>

              <div className="space-y-2 font-mono">
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">IP Web GUI Modem:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">192.168.1.1</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">Default Login:</span>
                  <span className="font-bold">user: admin / pass: admin</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">Link Mode:</span>
                  <span className="font-bold text-emerald-600">Route (Bukan Bridge)</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">WAN Type:</span>
                  <span className="font-bold text-indigo-600">PPPoE</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">VLAN Mode:</span>
                  <span className="font-bold text-purple-600">Tag (VLAN ID: {config.vlanId})</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">Username PPPoE:</span>
                  <span className="font-bold text-indigo-600">{config.pppoeUser}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">Password PPPoE:</span>
                  <span className="font-bold">{config.pppoePassword}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-white dark:bg-black border border-slate-200 dark:border-neutral-800">
                  <span className="text-slate-500">Port Binding:</span>
                  <span className="font-bold">LAN1, LAN2, LAN3, LAN4, SSID1</span>
                </div>
              </div>
            </div>

            {/* Right Box: Visual LED Verification Guide */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>💡</span>
                <span>Cara Membaca Lampu Indikator Modem:</span>
              </h3>

              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-start gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 flex-shrink-0 animate-pulse" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Lampu PON Hijau Solid (Diam)</div>
                    <div className="text-slate-500 mt-0.5">Artinya modem sukses terdaftar dan disinkronisasi oleh OLT.</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-start gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-neutral-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Lampu LOS Mati (Off)</div>
                    <div className="text-slate-500 mt-0.5">Artinya sinyal optik normal (tidak putus). Redaman berkisar antara -18 s/d -24 dBm.</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex items-start gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">Lampu Internet / WAN Hijau</div>
                    <div className="text-slate-500 mt-0.5">Artinya modem sukses dial PPPoE ke MikroTik dan pelanggan sudah bisa browsing internet!</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                🎉 Buka menu <strong>Status</strong> $\rightarrow$ <strong>WAN Status</strong> pada Web Modem $\rightarrow$ Pastikan mendapat IP <code>10.10.100.x</code> dengan status <strong>Connected</strong>.
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveStep(4)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              ⬅ Kembali
            </button>
            <button
              onClick={() => setActiveStep(6)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-xs"
            >
              <span>Lanjut ke Langkah 6: Uji Bridge &amp; Diagnostic Live ➜</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 6: UJI KONEKSI BRIDGE & DIAGNOSTIC SNMP LIVE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeStep === 6 && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 dark:border-[#222222] pb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              ⚡ Langkah 6: Uji Jangkauan End-to-End VPS ke OLT &amp; Router
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tekan tombol di bawah untuk menguji apakah VPS Cloud sudah bisa melakukan Ping dan membaca SNMP OLT serta RouterOS API di meja kantor Anda.
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
              onClick={() => setActiveStep(5)}
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
