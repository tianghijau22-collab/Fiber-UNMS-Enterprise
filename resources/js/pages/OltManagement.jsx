import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';
import VpnMikrotikBridgeModal from '../components/VpnMikrotikBridgeModal';

// ─── Icon Components ──────────────────────────────────────────────────────────
const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);
const IconWifi = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);
const IconCheck = ({ size = 'w-4 h-4' }) => (
  <svg className={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const IconX = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IconNetwork = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const IconServer = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="2" y="2" width="20" height="8" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth={2.5} strokeLinecap="round" />
    <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);
const IconRouter = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth={2.5} strokeLinecap="round" />
    <line x1="10" y1="18" x2="10.01" y2="18" strokeWidth={2.5} strokeLinecap="round" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 14V8a3 3 0 013-3h6a3 3 0 013 3v6" />
    <line x1="12" y1="5" x2="12" y2="2" strokeWidth={2} strokeLinecap="round" />
  </svg>
);
const IconLayers = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <polygon points="12 2 2 7 12 12 22 7 12 2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="2 17 12 22 22 17" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="2 12 12 17 22 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconZap = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconRefresh = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconActivity = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCpu = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="9" y="9" width="6" height="6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <line x1="9" y1="1" x2="9" y2="4" strokeWidth={2} strokeLinecap="round" />
    <line x1="15" y1="1" x2="15" y2="4" strokeWidth={2} strokeLinecap="round" />
    <line x1="9" y1="20" x2="9" y2="23" strokeWidth={2} strokeLinecap="round" />
    <line x1="15" y1="20" x2="15" y2="23" strokeWidth={2} strokeLinecap="round" />
    <line x1="20" y1="9" x2="23" y2="9" strokeWidth={2} strokeLinecap="round" />
    <line x1="20" y1="15" x2="23" y2="15" strokeWidth={2} strokeLinecap="round" />
    <line x1="1" y1="9" x2="4" y2="9" strokeWidth={2} strokeLinecap="round" />
    <line x1="1" y1="15" x2="4" y2="15" strokeWidth={2} strokeLinecap="round" />
  </svg>
);
const IconSearch = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="11" cy="11" r="8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spinner = () => (
  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
);

const SortIcon = ({ field, currentField, direction }) => {
  if (field !== currentField) {
    return <span className="text-slate-400 opacity-40 ml-1 text-[10px]">↕</span>;
  }
  return <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1 text-xs">{direction === 'asc' ? '▲' : '▼'}</span>;
};

const SignalStrengthMeter = ({ rxPower, status }) => {
  if (status !== 'Online' || rxPower === null || rxPower <= -40) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <span className="flex gap-0.5 items-end h-3">
          <span className="w-1 h-1 bg-rose-400 rounded-2xs" />
          <span className="w-1 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-2xs" />
          <span className="w-1 h-2 bg-slate-300 dark:bg-slate-700 rounded-2xs" />
          <span className="w-1 h-3 bg-slate-300 dark:bg-slate-700 rounded-2xs" />
        </span>
        <span>Offline (-40.00 dBm)</span>
      </span>
    );
  }
  const rx = parseFloat(rxPower);
  const bars = rx >= -19 ? 4 : rx >= -23 ? 3 : rx >= -27 ? 2 : 1;
  const colorCls = bars >= 3 ? 'bg-emerald-500' : bars === 2 ? 'bg-amber-500' : 'bg-rose-500';
  const textCls = bars >= 3 ? 'text-emerald-700 dark:text-emerald-400' : bars === 2 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400';
  const bgCls = bars >= 3 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80' : bars === 2 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold shadow-2xs ${bgCls}`}>
      <span className="flex gap-0.5 items-end h-3">
        <span className={`w-1 h-1 rounded-2xs ${bars >= 1 ? colorCls : 'bg-slate-200 dark:bg-slate-700'}`} />
        <span className={`w-1 h-1.5 rounded-2xs ${bars >= 2 ? colorCls : 'bg-slate-200 dark:bg-slate-700'}`} />
        <span className={`w-1 h-2 rounded-2xs ${bars >= 3 ? colorCls : 'bg-slate-200 dark:bg-slate-700'}`} />
        <span className={`w-1 h-3 rounded-2xs ${bars >= 4 ? colorCls : 'bg-slate-200 dark:bg-slate-700'}`} />
      </span>
      <span className={textCls}>{rxPower} dBm</span>
    </div>
  );
};

// Helper: Menentukan apakah sebuah port berstatus Up (Hijau) HANYA JIKA ada ONU fisik/terdaftar terhubung
const checkIsPortUp = (port, oltDataRef) => {
  if (!port) return false;
  const regCount = Number(port.registered_onus || 0);
  const uncfgCount = Number(port.unconfigured_onus || 0);
  const onCount = Number(port.online_onus || 0);

  if (regCount > 0 || uncfgCount > 0 || onCount > 0) return true;

  if (!oltDataRef) return false;
  const portId = port.port_id || '';
  const clean = portId.replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
  const slotNum = port.slot;
  const portNum = port.port || port.portNum;

  // Cek apakah ada unconfigured ONUs pada port ini
  const hasUncfg = (oltDataRef.unconfigured_onus || []).some(o => {
    const p = (o.detected_port || o.port || '').replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
    return p === clean || p === portId || (slotNum && portNum && (p === `${slotNum}/${portNum}` || p === `1/${slotNum}/${portNum}`));
  });
  if (hasUncfg) return true;

  // Cek apakah ada registered ONUs pada port ini
  const hasOnu = (oltDataRef.onu_list || []).some(o => {
    const p = (o.port || '').replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
    return p === clean || p === portId || (slotNum && portNum && (p === `${slotNum}/${portNum}` || p === `1/${slotNum}/${portNum}`));
  });
  return hasOnu;
};

// ─── Deployment Mode Options ──────────────────────────────────────────────────
const DEPLOYMENT_MODES = [
  {
    value: 'vpn',
    label: 'VPN Tunnel / L2TP Perusahaan (Rekomendasi)',
    desc: 'VPS terhubung ke jaringan ISP via VPN L2TP / Tunnel MikroTik. SNMP langsung menjangkau IP lokal OLT.',
    icon: '',
    color: 'emerald',
  },
  {
    value: 'direct',
    label: 'Direct LAN (Satu Jaringan)',
    desc: 'Server UNMS berada dalam satu jaringan lokal yang sama persis dengan OLT.',
    icon: '',
    color: 'indigo',
  },
  {
    value: 'probe',
    label: 'Local Probe Agent (Cloud External)',
    desc: 'Server di luar ISP tanpa VPN. Memerlukan NMS Probe Agent yang diinstal di dalam jaringan lokal kantor.',
    icon: '',
    color: 'amber',
  },
];

export default function OltManagement() {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
  const [olts, setOlts] = useState([]);
  const [selectedOltId, setSelectedOltId] = useState(null);
  const [loadingOltList, setLoadingOltList] = useState(true);
  const [loading, setLoading] = useState(true);
  const [oltData, setOltData] = useState(null);
  const [notification, setNotification] = useState(null);
  const [notifType, setNotifType] = useState('success');
  const [systemCapabilities, setSystemCapabilities] = useState(null);
  const [showVpnModal, setShowVpnModal] = useState(false);

  const [selectedSlotFilter, setSelectedSlotFilter] = useState(null);
  const [selectedPortFilter, setSelectedPortFilter] = useState(null);
  const [oltTopology, setOltTopology] = useState([]);

  // Helper Format Port Interface (menampilkan format interface otentik dari OLT)
  const formatShortPort = (portStr) => {
    if (!portStr) return '—';
    return String(portStr);
  };

  // OLT Search & Status Filter
  const [oltSearchQuery, setOltSearchQuery] = useState('');
  const [oltStatusFilter, setOltStatusFilter] = useState('all'); // 'all' | 'live' | 'offline'

  // ONU Search & Filter
  const [onuSearchQuery, setOnuSearchQuery] = useState('');
  const [onuStatusFilter, setOnuStatusFilter] = useState('all'); // all, online, los, high_loss

  // Optical Power Modal
  const [selectedOnuForOptical, setSelectedOnuForOptical] = useState(null);

  // SNMP Diagnostics Modal
  const [showSnmpDiagModal, setShowSnmpDiagModal] = useState(false);

  // External Fallback Sync Modal State
  const [showSyncExternalModal, setShowSyncExternalModal] = useState(false);
  const [syncSourceType, setSyncSourceType] = useState('regis_zte');
  const [syncExternalUrl, setSyncExternalUrl] = useState('http://103.152.119.26:2227');
  const [syncUsername, setSyncUsername] = useState('amar');
  const [syncPassword, setSyncPassword] = useState('amar');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleRunSyncExternal = async () => {
    if (!activeOlt) return;
    setSyncLoading(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/olt/sync-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: activeOlt.id,
          source_type: syncSourceType,
          external_url: syncExternalUrl,
          username: syncUsername,
          password: syncPassword,
        })
      });
      const data = await res.json();
      setSyncLoading(false);
      if (data.success) {
        setSyncResult({ success: true, message: data.message, imported: data.imported, updated: data.updated });
        const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
        fetchOltHardware(vk, activeOlt.id, false, true);
      } else {
        setSyncResult({ success: false, message: data.message || 'Gagal melakukan sinkronisasi cadangan.' });
      }
    } catch (err) {
      setSyncLoading(false);
      setSyncResult({ success: false, message: 'Terjadi kesalahan koneksi ke server.' });
    }
  };

  // Direct 1-Click Import 1628 ONUs
  const [isImporting1628, setIsImporting1628] = useState(false);

  const handleDirectImport1628 = async () => {
    if (!activeOlt) return;
    setIsImporting1628(true);
    try {
      const res = await fetch('/api/olt/import-1628-onus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: activeOlt.id })
      });
      const data = await res.json();
      setIsImporting1628(false);
      if (data.success) {
        alert(`✅ ${data.message}`);
        const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
        fetchOltHardware(vk, activeOlt.id, false, true);
      } else {
        alert(`❌ Gagal: ${data.message || 'Gagal mengimpor 1.628 ONU'}`);
      }
    } catch (err) {
      setIsImporting1628(false);
      alert('❌ Terjadi kesalahan koneksi saat mengimpor 1.628 ONU.');
    }
  };
  const [pollingInterval, setPollingInterval] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [isAutoPollingPaused, setIsAutoPollingPaused] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState(new Date());
  const [isPollingLive, setIsPollingLive] = useState(false);

  // Fetch OLT Topology (ODCs & ODPs connected to this OLT)
  const fetchOltTopology = (oltId) => {
    fetch(`/api/network-nodes/olt-topology?olt_id=${oltId}`)
      .then(r => r.json())
      .then(d => setOltTopology(d.data ?? []))
      .catch(() => setOltTopology([]));
  };

  // Progressive Batch Sync Modal State (Port-by-Port Sync Wizard)
  const [showProgressiveSyncModal, setShowProgressiveSyncModal] = useState(false);
  const [loadingPortOnus, setLoadingPortOnus] = useState(false);
  const [progressiveSyncState, setProgressiveSyncState] = useState({
    running: false,
    currentIndex: 0,
    totalPorts: 0,
    currentPort: '',
    results: [],
    canceled: false,
  });

  // Tampilan Chassis Rack vs Grid Kartu Port ('chassis' | 'cards')
  const [chassisViewMode, setChassisViewMode] = useState('chassis');
  const [hoveredPortInfo, setHoveredPortInfo] = useState(null);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddOltModal, setShowAddOltModal] = useState(false);
  const [showEditOltModal, setShowEditOltModal] = useState(false);
  const [editingOlt, setEditingOlt] = useState(null);
  const [submittingEditOlt, setSubmittingEditOlt] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [submittingOlt, setSubmittingOlt] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  // ── Custom Confirm Dialog State ─────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    type: 'danger',
    loading: false,
    onConfirm: null,
  });

  const openConfirm = ({ title, message, confirmText, type = 'danger', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText: 'Batal',
      type,
      loading: false,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        onConfirm();
      },
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
  };

  // Security Role & IP Masking State
  const [showSensitiveIp, setShowSensitiveIp] = useState(false);

  const maskIpAddress = (ip) => {
    if (!ip) return '—';
    if (showSensitiveIp) return ip;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return '***.***.***.***';
  };

  // ── Pure SNMP Config Form State (per device) ────────────────────────────────
  const defaultConfigForm = {
    deployment_mode: 'vpn',
    // SNMP
    snmp_version: 'v2c',
    snmp_community_type: 'public', polling_interval_seconds: 60,
    snmp_community: '',
    snmp_port: 161,
    snmp_timeout: 3,
    // SNMPv3
    snmp_v3_username: '',
    snmp_v3_auth_protocol: 'SHA',
    snmp_v3_auth_password: '',
    snmp_v3_priv_protocol: 'AES',
    snmp_v3_priv_password: '',
    // Probe Agent
    probe_agent_url: '',
    probe_agent_token: '',
    polling_interval_seconds: 60,
  };
  const [configForm, setConfigForm] = useState(defaultConfigForm);

  // ── Add OLT Form State ───────────────────────────────────────────────────────
  const defaultNewOltForm = {
    name: '', code: '', vendor: 'ZTE', model: 'ZXAN C300',
    location: '', ip_address: '', total_ports: 16,
    deployment_mode: 'vpn', snmp_version: 'v2c',
    snmp_community_type: 'public', snmp_community: '', polling_interval_seconds: 60,
  };
  const [newOltForm, setNewOltForm] = useState(defaultNewOltForm);

  // ── Edit OLT Form State ──────────────────────────────────────────────────────
  const [editOltForm, setEditOltForm] = useState({
    name: '', code: '', vendor: 'ZTE', model: 'ZXAN C300',
    location: '', ip_address: '', total_ports: 16,
    deployment_mode: 'vpn', snmp_version: 'v2c',
    snmp_community_type: 'public',
  });

  // ─── Fetch OLT Registry ──────────────────────────────────────────────────────
  const fetchOlts = useCallback((silent = false) => {
    if (!silent) setLoadingOltList(true);
    return fetch('/api/olts')
      .then(r => r.json())
      .then(res => {
        if (res.data && res.data.length > 0) {
          setOlts(res.data);
          if (!selectedOltId || !res.data.some(o => o.id === selectedOltId)) {
            setSelectedOltId(res.data[0].id);
          }
        } else {
          setOlts([]);
          setSelectedOltId(null);
          setOltData(null);
        }
        if (res.capabilities) setSystemCapabilities(res.capabilities);
        setLoadingOltList(false);
      })
      .catch(() => {
        setLoadingOltList(false);
      });
  }, [selectedOltId]);

  useEffect(() => { fetchOlts(false); }, [fetchOlts]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchOlts);
  const activeOlt = olts.find(o => o.id === selectedOltId);

  // Silent Background Auto-Refresh dari Database Snapshot (tanpa re-render per detik)
  useEffect(() => {
    if (!activeOlt || isAutoPollingPaused) return;
    const intervalSec = Math.max(15, activeOlt.polling_interval_seconds || 30);

    const timer = setInterval(() => {
      const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
      fetchOltHardware(vk, activeOlt.id, true, false); // Ambil snapshot database terbaru secara background
      fetchOlts(true);
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [activeOlt?.id, activeOlt?.polling_interval_seconds, isAutoPollingPaused]);

  // ─── Fetch OLT Hardware Telemetry dari Database Snapshot (Instan < 10ms) ───
  const fetchOltHardware = (vendorKey, deviceId, silent = false, fresh = false) => {
    if (!silent) setLoading(true);
    const url = `/api/olt/hardware?vendor=${vendorKey}&device_id=${deviceId || ''}${fresh ? '&fresh=1' : ''}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('API ' + r.status); return r.json(); })
      .then(data => {
        setOltData(data);
        if (!silent) setLoading(false);
        setLastPolledAt(new Date());
      })
      .catch(() => {
        if (!silent) setLoading(false);
      });
  };

  // ─── Granular Lazy Loading per Port PON (Ultra-Fast & Anti-Timeout) ───────────
  const fetchPortOnus = useCallback((portId, fresh = false) => {
    if (!activeOlt || !portId) return;
    setLoadingPortOnus(true);
    const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
    fetch(`/api/olt/port-onus?vendor=${vk}&device_id=${activeOlt.id}&port=${encodeURIComponent(portId)}${fresh ? '&fresh=1' : ''}`)
      .then(r => r.json())
      .then(res => {
        setLoadingPortOnus(false);
        if (res.status === 'success') {
          setOltData(prev => {
            if (!prev) return prev;
            const targetClean = portId.replace(/^gpon[-_]olt_/i, '').replace(/^epon[-_]olt_/i, '');
            const otherOnus = (prev.onu_list || []).filter(o => {
              const p = (o.port || '').replace(/^gpon[-_]olt_/i, '').replace(/^epon[-_]olt_/i, '');
              return p !== targetClean && !p.startsWith(targetClean + '/');
            });
            const otherUncfg = (prev.unconfigured_onus || []).filter(o => {
              const p = (o.detected_port || o.port || '').replace(/^gpon[-_]olt_/i, '').replace(/^epon[-_]olt_/i, '');
              return p !== targetClean && !p.startsWith(targetClean + '/');
            });
            const totalFoundOnPort = (res.onu_list || []).length + (res.unconfigured_onus || []).length;
            const onlineFoundOnPort = (res.onu_list || []).filter(o => o.status === 'Online').length + (res.unconfigured_onus || []).filter(o => o.status === 'Online').length;

            const updatedPonPorts = (prev.pon_ports || []).map(p => {
              const pClean = (p.port_id || '').replace(/^gpon[-_]olt_/i, '').replace(/^epon[-_]olt_/i, '');
              if (p.port_id === portId || pClean === targetClean || `1/${p.port}` === targetClean || (p.slot && p.port && `1/${p.slot}/${p.port}` === targetClean)) {
                return {
                  ...p,
                  status: (totalFoundOnPort > 0 || p.status === 'Up') ? 'Up' : 'Down',
                  registered_onus: (res.onu_list || []).length,
                  unconfigured_onus: (res.unconfigured_onus || []).length,
                  online_onus: onlineFoundOnPort,
                };
              }
              return p;
            });

            return {
              ...prev,
              pon_ports: updatedPonPorts,
              onu_list: [...otherOnus, ...(res.onu_list || [])],
              unconfigured_onus: [...otherUncfg, ...(res.unconfigured_onus || [])],
              orphaned_onus: res.orphaned_onus || prev.orphaned_onus,
            };
          });
          if (fresh) {
            showNotif(`Berhasil memuat data Port ${formatShortPort(portId)} via SNMP.`, 'success');
          }
        }
      })
      .catch(() => {
        setLoadingPortOnus(false);
        if (fresh) {
          showNotif(`Gagal mengambil data live untuk Port ${formatShortPort(portId)}.`, 'error');
        }
      });
  }, [activeOlt]);

  const handleSelectPort = (portId) => {
    if (selectedPortFilter === portId) {
      setSelectedPortFilter(null);
    } else {
      setSelectedPortFilter(portId);
      // Reset pagination ke page 1 secara instan
      setRegisteredPage(1);
      setUnregisteredPage(1);
      setOrphanedPage(1);
      // Data difilter langsung dari database snapshot lokal (instan < 1ms)
    }
  };

  // ─── Progressive Port-by-Port Batch Sync (Inisialisasi OLT Tanpa Timeout) ──
  const startProgressiveSync = async () => {
    if (!activeOlt || !oltData?.pon_ports?.length) return;
    const ports = oltData.pon_ports.map(p => p.port_id);
    const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';

    const initialResults = ports.map(p => ({
      port: p,
      count: 0,
      status: 'pending',
      message: 'Menunggu antrean...'
    }));

    setProgressiveSyncState({
      running: true,
      currentIndex: 0,
      totalPorts: ports.length,
      currentPort: ports[0],
      results: initialResults,
      canceled: false,
    });

    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      setProgressiveSyncState(prev => {
        if (prev.canceled) return prev;
        const updated = [...prev.results];
        updated[i] = { ...updated[i], status: 'syncing', message: 'Sedang membaca SNMP dari OLT...' };
        return { ...prev, currentIndex: i, currentPort: port, results: updated };
      });

      try {
        const res = await fetch('/api/olt/sync-port', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor: vk,
            device_id: activeOlt.id,
            port: port,
          }),
        });
        const data = await res.json();
        setProgressiveSyncState(prev => {
          const updated = [...prev.results];
          updated[i] = {
            port,
            count: data.count || 0,
            status: data.status === 'success' ? 'success' : 'error',
            message: data.message || (data.status === 'success' ? `${data.count} ONU terbaca` : 'Gagal'),
          };
          return { ...prev, results: updated };
        });
      } catch (err) {
        setProgressiveSyncState(prev => {
          const updated = [...prev.results];
          updated[i] = { port, count: 0, status: 'error', message: 'Koneksi error / timeout' };
          return { ...prev, results: updated };
        });
      }

      // Jeda 250ms antar port agar OLT CPU tidak lonjak
      await new Promise(r => setTimeout(r, 250));
    }

    setProgressiveSyncState(prev => ({ ...prev, running: false, currentPort: 'Semua Selesai!' }));
    // Refresh snapshot hardware setelah semua port selesai
    fetchOltHardware(vk, activeOlt.id, true, false);
    showNotif('Sinkronisasi bertahap seluruh Port OLT berhasil diselesaikan.', 'success');
  };

  useEffect(() => {
    setTestResult(null);
    setSelectedSlotFilter(null);
    setSelectedPortFilter(null);
  }, [selectedOltId]);

  useEffect(() => {
    if (activeOlt) {
      const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
      fetchOltHardware(vk, activeOlt.id);
      fetchOltTopology(activeOlt.id);
      setConfigForm({
        ...defaultConfigForm,
        deployment_mode: activeOlt.deployment_mode || 'vpn',
        snmp_version: activeOlt.snmp_version || 'v2c',
        snmp_community_type: activeOlt.snmp_community_type || 'public',
        snmp_port: activeOlt.snmp_port || 161,
        snmp_timeout: activeOlt.snmp_timeout || 3,
        probe_agent_url: activeOlt.probe_agent_url || '',
        polling_interval_seconds: activeOlt.polling_interval_seconds || 60,
      });
    } else {
      setLoading(false);
      setOltData(null);
    }
  }, [activeOlt?.id, activeOlt?.connection_mode, activeOlt?.ip_address, activeOlt?.polling_interval_seconds]);

  // ─── Test SNMP Connection ────────────────────────────────────────────────────
  const handleTestConnection = () => {
    if (!activeOlt) return;
    setTestingConnection(true);
    setTestResult(null);

    fetch(`/api/olts/${activeOlt.id}/connection-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_mode: configForm.deployment_mode,
        snmp_version: configForm.snmp_version,
        snmp_community_type: configForm.snmp_community_type,
        snmp_community: configForm.snmp_community_type === 'custom' ? configForm.snmp_community : undefined,
        snmp_v3_username: configForm.snmp_v3_username || undefined,
        snmp_v3_auth_protocol: configForm.snmp_v3_auth_protocol,
        snmp_v3_auth_password: configForm.snmp_v3_auth_password || undefined,
        snmp_v3_priv_protocol: configForm.snmp_v3_priv_protocol,
        snmp_v3_priv_password: configForm.snmp_v3_priv_password || undefined,
        snmp_port: configForm.snmp_port,
        snmp_timeout: configForm.snmp_timeout,
        probe_agent_url: configForm.probe_agent_url || undefined,
        probe_agent_token: configForm.probe_agent_token || undefined,
        polling_interval_seconds: parseInt(configForm.polling_interval_seconds) || 60,
      }),
    })
      .then(r => r.json())
      .then(() => {
        return fetch(`/api/olts/${activeOlt.id}/test-connection`, { method: 'POST' });
      })
      .then(r => r.json())
      .then(res => {
        setTestResult(res.data);
        setTestingConnection(false);
        fetchOlts();
      })
      .catch(() => {
        setTestResult({ message: 'Gagal menghubungi server.', connection_mode: 'simulation' });
        setTestingConnection(false);
      });
  };

  // ─── Save SNMP Config Only ──────────────────────────────────────────────────
  const handleSaveConfig = () => {
    if (!activeOlt) return;
    setSavingConfig(true);
    fetch(`/api/olts/${activeOlt.id}/connection-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_mode: configForm.deployment_mode,
        snmp_version: configForm.snmp_version,
        snmp_community_type: configForm.snmp_community_type,
        snmp_community: configForm.snmp_community_type === 'custom' ? configForm.snmp_community : undefined,
        snmp_v3_username: configForm.snmp_v3_username || undefined,
        snmp_v3_auth_protocol: configForm.snmp_v3_auth_protocol,
        snmp_v3_auth_password: configForm.snmp_v3_auth_password || undefined,
        snmp_v3_priv_protocol: configForm.snmp_v3_priv_protocol,
        snmp_v3_priv_password: configForm.snmp_v3_priv_password || undefined,
        snmp_port: configForm.snmp_port,
        snmp_timeout: configForm.snmp_timeout,
        probe_agent_url: configForm.probe_agent_url || undefined,
        probe_agent_token: configForm.probe_agent_token || undefined,
        polling_interval_seconds: parseInt(configForm.polling_interval_seconds) || 60,
      }),
    })
      .then(r => r.json())
      .then(() => {
        setSavingConfig(false);
        showNotif('Konfigurasi SNMP & Interval Polling berhasil disimpan.', 'success');
        setShowConfigModal(false);
        fetchOlts();
      })
      .catch(() => {
        setSavingConfig(false);
        showNotif('Gagal menyimpan konfigurasi.', 'error');
      });
  };

  // ─── Add New OLT ────────────────────────────────────────────────────────────
  const handleAddOlt = (e) => {
    e.preventDefault();
    setSubmittingOlt(true);
    fetch('/api/olts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newOltForm,
        snmp_community: newOltForm.snmp_community_type === 'custom' ? newOltForm.snmp_community : 'public',
      }),
    })
      .then(r => r.json())
      .then(res => {
        setSubmittingOlt(false);
        if (res.data) {
          setShowAddOltModal(false);
          setOlts(prev => [...prev, res.data]);
          setSelectedOltId(res.data.id);
          showNotif(res.message, 'success');
          setNewOltForm(defaultNewOltForm);
        } else {
          showNotif(res.message || 'Gagal menambahkan OLT.', 'error');
        }
      })
      .catch(() => { setSubmittingOlt(false); showNotif('Gagal menghubungi server.', 'error'); });
  };

  // ─── Open Edit Modal ─────────────────────────────────────────────────────────
  const handleOpenEditModal = (olt) => {
    setEditingOlt(olt);
    setEditOltForm({
      name: olt.name || '',
      code: olt.code || '',
      vendor: olt.vendor || 'ZTE',
      model: olt.model || '',
      location: olt.location || '',
      ip_address: olt.ip_address || '',
      total_ports: olt.total_ports || 16,
      deployment_mode: olt.deployment_mode || 'vpn',
      polling_interval_seconds: olt.polling_interval_seconds || 60,
      snmp_version: olt.snmp_version || 'v2c',
      snmp_community_type: olt.snmp_community_type || 'public',
    });
    setShowEditOltModal(true);
  };

  // ─── Edit OLT Submit ─────────────────────────────────────────────────────────
  const handleEditOlt = (e) => {
    e.preventDefault();
    if (!editingOlt) return;
    setSubmittingEditOlt(true);
    fetch(`/api/olts/${editingOlt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editOltForm),
    })
      .then(r => r.json())
      .then(res => {
        setSubmittingEditOlt(false);
        if (res.data) {
          setShowEditOltModal(false);
          setOlts(prev => prev.map(o => o.id === editingOlt.id ? res.data : o));
          if (selectedOltId === editingOlt.id) {
            const vk = res.data.vendor_key || res.data.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
            fetchOltHardware(vk, res.data.id);
          }
          showNotif(res.message || 'Perangkat OLT berhasil diperbarui!', 'success');
          setEditingOlt(null);
        } else {
          const errors = res.errors ? Object.values(res.errors).flat().join(' ') : '';
          showNotif(res.message || `Gagal memperbarui OLT. ${errors}`, 'error');
        }
      })
      .catch(() => { setSubmittingEditOlt(false); showNotif('Gagal menghubungi server.', 'error'); });
  };

  // ─── Disconnect OLT ──────────────────────────────────────────────────────────
  const handleDisconnectOlt = (olt) => {
    if (!olt) return;
    openConfirm({
      title: 'Hentikan Koneksi SNMP OLT?',
      message: (
        <span>
          Apakah Anda yakin ingin memutuskan sinkronisasi live SNMP ke perangkat <strong>{olt.name}</strong> ({olt.ip_address})? Sistem akan kembali ke mode database.
        </span>
      ),
      confirmText: 'Ya, Hentikan SNMP',
      type: 'warning',
      onConfirm: () => {
        setDisconnectingId(olt.id);
        fetch(`/api/olts/${olt.id}/disconnect`, { method: 'POST' })
          .then(r => r.json())
          .then(res => {
            closeConfirm();
            setDisconnectingId(null);
            showNotif(res.message || 'Koneksi SNMP dihentikan.', 'success');
            setOlts(prev => prev.map(o => o.id === olt.id ? { ...o, connection_mode: 'simulation' } : o));
            if (selectedOltId === olt.id) {
              const vk = olt.vendor_key || olt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
              fetchOltHardware(vk, olt.id);
            }
          })
          .catch(() => {
            closeConfirm();
            setDisconnectingId(null);
            showNotif('Gagal menghentikan koneksi SNMP.', 'error');
          });
      },
    });
  };

  // ─── Delete OLT ─────────────────────────────────────────────────────────────
  const handleDeleteOlt = (olt) => {
    const oltId = olt.id;
    openConfirm({
      title: 'Hapus Perangkat OLT?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus <strong>{olt.name}</strong> ({olt.code})? Data konfigurasi SNMP perangkat ini akan dihapus dari sistem.
        </span>
      ),
      confirmText: 'Ya, Hapus OLT',
      type: 'danger',
      onConfirm: () => {
        setDeletingId(oltId);
        fetch(`/api/olts/${oltId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(res => {
            closeConfirm();
            setDeletingId(null);
            showNotif(res.message || 'Perangkat OLT berhasil dihapus.', 'success');
            const remaining = olts.filter(o => o.id !== oltId);
            setOlts(remaining);
            if (selectedOltId === oltId) setSelectedOltId(remaining[0]?.id || null);
          })
          .catch(() => {
            closeConfirm();
            setDeletingId(null);
            showNotif('Gagal menghapus perangkat.', 'error');
          });
      },
    });
  };

  const showNotif = (msg, type = 'success') => {
    setNotification(msg); setNotifType(type);
    setTimeout(() => setNotification(null), 5000);
  };

  // ─── Helper ─────────────────────────────────────────────────────────────────
  const getConnectionBadge = (olt) => {
    const mode = olt?.connection_mode || 'simulation';
    if (mode === 'live') return { label: '● Live SNMP', cls: 'bg-emerald-400 text-emerald-950 font-bold' };
    return { label: 'Realtime Database UNMS', cls: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold' };
  };

  const badge = getConnectionBadge(activeOlt);

  const inputCls = "w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium";
  const labelCls = "block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5";

  // ─── Sorting State untuk Tabel ONU Terdaftar ───────────────────────────────
  const [sortField, setSortField] = useState('rx_power'); // 'rx_power' | 'customer_name' | 'port' | 'serial_number' | 'status'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' (terburuk dahulu) | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'rx_power' ? 'asc' : 'asc');
    }
  };

  // ─── Helper Pencocokan Port Multi-Format (ZTE/Huawei/HSGQ) ─────────────────
  const isPortMatching = useCallback((onuPort, filterPort) => {
    if (!filterPort) return true;
    if (!onuPort) return false;
    const cleanOnu = onuPort.replace(/^(gpon|epon)[-_](olt|onu)_/i, '').split(':')[0];
    const cleanFilter = filterPort.replace(/^(gpon|epon)[-_](olt|onu)_/i, '').split(':')[0];
    return onuPort === filterPort ||
      cleanOnu === cleanFilter ||
      cleanOnu.startsWith(cleanFilter + '/') ||
      cleanOnu.startsWith(cleanFilter + ':') ||
      onuPort.startsWith(filterPort);
  }, []);

  // ─── Optical Signal Quality Analytics ──────────────────────────────────────
  const opticalStats = useMemo(() => {
    const list = (oltData?.onu_list || []).filter(onu => {
      if (!isPortMatching(onu.port, selectedPortFilter)) {
        return false;
      }
      return true;
    });

    let excellent = 0, good = 0, warning = 0, critical = 0, los = 0;
    list.forEach(o => {
      const isOffline = o.status !== 'Online' || o.rx_power === null || o.rx_power <= -40;
      if (isOffline) {
        los++;
      } else {
        const rx = parseFloat(o.rx_power);
        if (rx >= -19) excellent++;
        else if (rx >= -23) good++;
        else if (rx >= -27) warning++;
        else critical++;
      }
    });

    const total = list.length;
    return {
      total,
      excellent,
      good,
      warning,
      critical,
      los,
      excellentPct: total > 0 ? Math.round((excellent / total) * 100) : 0,
      goodPct: total > 0 ? Math.round((good / total) * 100) : 0,
      warningPct: total > 0 ? Math.round((warning / total) * 100) : 0,
      criticalPct: total > 0 ? Math.round((critical / total) * 100) : 0,
      losPct: total > 0 ? Math.round((los / total) * 100) : 0,
    };
  }, [oltData?.onu_list, selectedPortFilter, isPortMatching]);

  // ─── Filtered & Sorted ONU List (Terdaftar) ─────────────────────────────────
  const rawFilteredOnus = useMemo(() => {
    return (oltData?.onu_list || []).filter(onu => {
      if (!isPortMatching(onu.port, selectedPortFilter)) {
        return false;
      }
      const isOffline = onu.status !== 'Online' || onu.rx_power === null || onu.rx_power <= -40;
      const rx = parseFloat(onu.rx_power);

      if (onuStatusFilter === 'online' && isOffline) return false;
      if (onuStatusFilter === 'los' && !isOffline) return false;
      if (onuStatusFilter === 'excellent' && (isOffline || rx < -19)) return false;
      if (onuStatusFilter === 'good' && (isOffline || rx >= -19 || rx < -23)) return false;
      if (onuStatusFilter === 'warning' && (isOffline || rx >= -23 || rx < -27)) return false;
      if (onuStatusFilter === 'critical' && (isOffline || rx >= -27)) return false;
      if (onuStatusFilter === 'high_loss' && (isOffline || rx >= -27)) return false;

      if (onuSearchQuery) {
        const q = onuSearchQuery.toLowerCase();
        const matchName = onu.customer_name?.toLowerCase().includes(q);
        const matchSn = onu.serial_number?.toLowerCase().includes(q);
        const matchPort = onu.port?.toLowerCase().includes(q);
        const matchIp = onu.ip_address?.toLowerCase().includes(q);
        return matchName || matchSn || matchPort || matchIp;
      }
      return true;
    });
  }, [oltData?.onu_list, selectedPortFilter, isPortMatching, onuStatusFilter, onuSearchQuery]);

  const filteredOnus = useMemo(() => {
    return [...rawFilteredOnus].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'rx_power') {
        const aOffline = a.status !== 'Online' || a.rx_power === null || a.rx_power <= -40;
        const bOffline = b.status !== 'Online' || b.rx_power === null || b.rx_power <= -40;
        const aVal = aOffline ? -999 : parseFloat(a.rx_power) || 0;
        const bVal = bOffline ? -999 : parseFloat(b.rx_power) || 0;
        comparison = aVal - bVal;
      } else if (sortField === 'customer_name') {
        comparison = (a.customer_name || '').localeCompare(b.customer_name || '');
      } else if (sortField === 'port') {
        comparison = (a.port || '').localeCompare(b.port || '');
      } else if (sortField === 'serial_number') {
        comparison = (a.serial_number || '').localeCompare(b.serial_number || '');
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rawFilteredOnus, sortField, sortDirection]);

  // ─── Filtered Unregistered ONUs (Fisik di OLT tapi belum di UNMS) ───────────
  const [tableSectionTab, setTableSectionTab] = useState('registered'); // 'registered' | 'unregistered' | 'orphaned'

  const [orphanedSearchQuery, setOrphanedSearchQuery] = useState('');
  const [orphanedPage, setOrphanedPage] = useState(1);
  const orphanedPerPage = 10;
  const [selectedOrphanedIds, setSelectedOrphanedIds] = useState([]);
  const [isDeletingOrphaned, setIsDeletingOrphaned] = useState(false);

  const [unregisteredSearchQuery, setUnregisteredSearchQuery] = useState('');
  const [unregisteredPage, setUnregisteredPage] = useState(1);
  const unregisteredPerPage = 10;

  const [registeredPage, setRegisteredPage] = useState(1);
  const registeredPerPage = 10;

  const filteredUnregisteredOnus = useMemo(() => {
    return (oltData?.unconfigured_onus || []).filter(onu => {
      if (!isPortMatching(onu.detected_port || onu.port, selectedPortFilter)) {
        return false;
      }
      if (unregisteredSearchQuery) {
        const q = unregisteredSearchQuery.toLowerCase();
        const matchSn = (onu.serial_number || onu.mac_address)?.toLowerCase().includes(q);
        const matchName = onu.onu_name?.toLowerCase().includes(q);
        const matchPort = (onu.detected_port || onu.port)?.toLowerCase().includes(q);
        const matchModel = onu.vendor_model?.toLowerCase().includes(q);
        return matchSn || matchName || matchPort || matchModel;
      }
      return true;
    });
  }, [oltData?.unconfigured_onus, selectedPortFilter, isPortMatching, unregisteredSearchQuery]);

  const totalUnregisteredPages = Math.max(1, Math.ceil(filteredUnregisteredOnus.length / unregisteredPerPage));
  const paginatedUnregisteredOnus = useMemo(() => {
    return filteredUnregisteredOnus.slice(
      (unregisteredPage - 1) * unregisteredPerPage,
      unregisteredPage * unregisteredPerPage
    );
  }, [filteredUnregisteredOnus, unregisteredPage, unregisteredPerPage]);

  const totalRegisteredPages = Math.max(1, Math.ceil(filteredOnus.length / registeredPerPage));
  const paginatedRegisteredOnus = useMemo(() => {
    return filteredOnus.slice(
      (registeredPage - 1) * registeredPerPage,
      registeredPage * registeredPerPage
    );
  }, [filteredOnus, registeredPage, registeredPerPage]);

  const filteredOrphanedOnus = useMemo(() => {
    return (oltData?.orphaned_onus || []).filter(onu => {
      if (!isPortMatching(onu.olt_port, selectedPortFilter)) {
        return false;
      }
      if (orphanedSearchQuery) {
        const q = orphanedSearchQuery.toLowerCase();
        const matchName = onu.customer_name?.toLowerCase().includes(q);
        const matchSn = (onu.onu_serial || onu.onu_mac)?.toLowerCase().includes(q);
        const matchCode = onu.customer_number?.toLowerCase().includes(q);
        const matchOdp = onu.odp_name?.toLowerCase().includes(q);
        const matchPort = onu.olt_port?.toLowerCase().includes(q);
        return matchName || matchSn || matchCode || matchOdp || matchPort;
      }
      return true;
    });
  }, [oltData?.orphaned_onus, selectedPortFilter, isPortMatching, orphanedSearchQuery]);

  const totalOrphanedPages = Math.max(1, Math.ceil(filteredOrphanedOnus.length / orphanedPerPage));
  const paginatedOrphanedOnus = useMemo(() => {
    return filteredOrphanedOnus.slice(
      (orphanedPage - 1) * orphanedPerPage,
      orphanedPage * orphanedPerPage
    );
  }, [filteredOrphanedOnus, orphanedPage, orphanedPerPage]);

  const handleDeleteOrphaned = (onu) => {
    openConfirm({
      title: 'Pembersihan Data Modem Terputus',
      message: `Apakah Anda yakin ingin menghapus data ONU ${onu.onu_serial || onu.onu_mac} milik "${onu.customer_name}" dari database UNMS? Tindakan ini akan otomatis membebaskan port ${onu.odp_name} (${onu.odp_port}) agar dapat digunakan kembali oleh pelanggan baru.`,
      confirmLabel: 'Ya, Hapus Data',
      variant: 'danger',
      onConfirm: () => {
        setIsDeletingOrphaned(true);
        fetch(`/api/olt/orphaned-onus/${onu.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          }
        })
          .then(res => res.json())
          .then(data => {
            closeConfirm();
            setIsDeletingOrphaned(false);
            if (data.success) {
              showNotif(data.message || 'Data berhasil dibersihkan dari UNMS.', 'success');
              setOltData(prev => ({
                ...prev,
                orphaned_onus: (prev.orphaned_onus || []).filter(o => o.id !== onu.id),
              }));
              setSelectedOrphanedIds(prev => prev.filter(id => id !== onu.id));
            } else {
              showNotif(data.message || 'Gagal menghapus data.', 'error');
            }
          })
          .catch(() => {
            closeConfirm();
            setIsDeletingOrphaned(false);
            showNotif('Terjadi kesalahan jaringan saat menghapus data.', 'error');
          });
      }
    });
  };

  const handleBulkDeleteOrphaned = (targetIds = null) => {
    const idsToDelete = targetIds || selectedOrphanedIds;
    if (!idsToDelete.length) {
      showNotif('Pilih setidaknya satu data untuk dibersihkan.', 'error');
      return;
    }

    openConfirm({
      title: `Pembersihan Masal (${idsToDelete.length} Data)`,
      message: `Apakah Anda yakin ingin menghapus ${idsToDelete.length} data ONU terputus yang dipilih dari database UNMS? Seluruh port ODP terkait akan otomatis dibebaskan kembali.`,
      confirmLabel: `Ya, Bersihkan ${idsToDelete.length} Data`,
      variant: 'danger',
      onConfirm: () => {
        setIsDeletingOrphaned(true);
        fetch('/api/olt/orphaned-onus/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          },
          body: JSON.stringify({ ids: idsToDelete }),
        })
          .then(res => res.json())
          .then(data => {
            closeConfirm();
            setIsDeletingOrphaned(false);
            if (data.success) {
              showNotif(data.message || 'Pembersihan masal berhasil dilakukan.', 'success');
              setOltData(prev => ({
                ...prev,
                orphaned_onus: (prev.orphaned_onus || []).filter(o => !idsToDelete.includes(o.id)),
              }));
              setSelectedOrphanedIds([]);
            } else {
              showNotif(data.message || 'Gagal melakukan pembersihan masal.', 'error');
            }
          })
          .catch(() => {
            closeConfirm();
            setIsDeletingOrphaned(false);
            showNotif('Terjadi kesalahan koneksi saat pembersihan masal.', 'error');
          });
      }
    });
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 transition-colors duration-300 stagger-enter">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Perangkat OLT
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Akuisisi Data &amp; Monitoring Telemetri via SNMP —
            </p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
            {systemCapabilities && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${systemCapabilities.snmp_extension
                ? 'bg-emerald-50 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                : 'bg-rose-50 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                }`}>
                PHP SNMP Ext: {systemCapabilities.snmp_extension ? 'Aktif' : 'Tidak Aktif'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Live Real-Time Database Telemetry Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Database Telemetry:
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Live Sync 24/7
              </span>
            </div>
            {activeOlt?.last_connected_at && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline font-mono">
                • {new Date(activeOlt.last_connected_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={() => {
              triggerRefresh();
              if (activeOlt) {
                const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
                fetchOltHardware(vk, activeOlt.id, false, true);
              }
            }}
            lastUpdatedText={timeAgoText}
            label="Segarkan OLT"
          />
          {activeOlt && (
            <button
              onClick={() => setShowProgressiveSyncModal(true)}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Sinkronisasi seluruh port OLT satu-persatu tanpa risiko timeout (Aman untuk >2.000 ONU)"
            >
              <span>⚡ Sinkronisasi Bertahap</span>
            </button>
          )}
          {activeOlt && (
            <button
              onClick={() => setShowSnmpDiagModal(true)}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Uji OID MIB SNMP Live langsung dari browser"
            >
              <span>Diagnostic SNMP &amp; MIB</span>
            </button>
          )}
          {canCrud && (
            <button onClick={() => setShowAddOltModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 border border-slate-700 dark:border-slate-300">
              <IconPlus /><span>Tambah OLT Baru</span>
            </button>
          )}
          {canCrud && (
            <button onClick={() => { setTestResult(null); setShowConfigModal(true); }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-all flex items-center space-x-1.5">
              <IconWifi /><span>Konfigurasi SNMP</span>
            </button>
          )}
          {activeOlt && activeOlt.connection_mode === 'live' && (
            <button
              onClick={() => handleDisconnectOlt(activeOlt)}
              disabled={disconnectingId === activeOlt.id}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-1.5 disabled:opacity-50">
              {disconnectingId === activeOlt.id ? <Spinner /> : <span>Hentikan SNMP</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── Notification ────────────────────────────────────────────────────── */}
      {notification && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xs ${notifType === 'error'
          ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-400'
          : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400'
          }`}>
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="font-semibold text-lg leading-none opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}


      {/* ── OLT Selector ────────────────────────────────────────────────────── */}
      {(() => {
        const liveCount = olts.filter(o => o.connection_mode === 'live').length;
        const offlineCount = olts.filter(o => o.connection_mode !== 'live').length;

        const filteredOlts = olts.filter(o => {
          if (oltStatusFilter === 'live' && o.connection_mode !== 'live') return false;
          if (oltStatusFilter === 'offline' && o.connection_mode === 'live') return false;
          if (oltSearchQuery.trim()) {
            const q = oltSearchQuery.toLowerCase();
            const matchName = (o.name || '').toLowerCase().includes(q);
            const matchIp = (o.ip_address || '').toLowerCase().includes(q);
            const matchVendor = (o.vendor || '').toLowerCase().includes(q);
            const matchModel = (o.model || '').toLowerCase().includes(q);
            const matchLoc = (o.location || '').toLowerCase().includes(q);
            return matchName || matchIp || matchVendor || matchModel || matchLoc;
          }
          return true;
        });

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Header & Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Title & Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
                    <IconServer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-950 dark:text-white">Daftar Perangkat OLT</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {filteredOlts.length} dari {olts.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pilih perangkat OLT di bawah untuk memantau telemetri port &amp; ONU secara realtime
                    </p>
                  </div>
                </div>

                {/* Filter & Controls Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Tabs */}
                  <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setOltStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${oltStatusFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      Semua ({olts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOltStatusFilter('live')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${oltStatusFilter === 'live'
                        ? 'bg-emerald-500 text-white shadow-xs font-bold'
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                      Live ({liveCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOltStatusFilter('offline')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${oltStatusFilter === 'offline'
                        ? 'bg-amber-500 text-white shadow-xs font-bold'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                      Offline ({offlineCount})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IconSearch className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={oltSearchQuery}
                      onChange={(e) => setOltSearchQuery(e.target.value)}
                      placeholder="Cari OLT..."
                      className="pl-8 pr-7 py-1.5 w-36 sm:w-44 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    {oltSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOltSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Toggle IP Visibility Button */}
                  <button
                    type="button"
                    onClick={() => setShowSensitiveIp(!showSensitiveIp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${showSensitiveIp
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    title="Toggle sensor IP address"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {showSensitiveIp
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                    </svg>
                    <span>{showSensitiveIp ? 'IP Terlihat' : 'Sensor IP'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Device Cards Grid */}
            <div className="p-4 sm:p-5">
              {filteredOlts.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <IconSearch className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Tidak Ada Perangkat OLT Ditemukan</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tidak ditemukan perangkat OLT yang sesuai dengan kata kunci "{oltSearchQuery}" atau filter status yang dipilih.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setOltSearchQuery(''); setOltStatusFilter('all'); }}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
                  {filteredOlts.map(o => {
                    const isActive = selectedOltId === o.id;
                    const isLive = o.connection_mode === 'live';

                    return (
                      <div
                        key={o.id}
                        onClick={() => setSelectedOltId(o.id)}
                        className={`relative rounded-2xl border transition-all duration-200 group overflow-hidden cursor-pointer flex flex-col justify-between ${isActive
                          ? 'bg-slate-50/80 dark:bg-slate-800 border-2 border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                          }`}
                      >
                        {/* Active top highlight strip */}
                        {isActive && (
                          <div className="h-1 bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-600" />
                        )}

                        <div className="p-3.5 pb-2">
                          {/* Top Row: Vendor Badge + Status Pill */}
                          <div className="flex items-center justify-between gap-1.5 mb-2.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${isActive
                              ? 'bg-slate-200/80 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                              }`}>
                              {o.vendor}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isLive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                              }`}>
                              <span className="relative flex w-1.5 h-1.5">
                                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full w-1.5 h-1.5 ${isLive ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                              </span>
                              <span>{isLive ? 'Live' : 'DB'}</span>
                            </span>
                          </div>

                          {/* OLT Name & Model */}
                          <div className="font-bold text-sm text-slate-950 dark:text-white leading-tight truncate" title={o.name}>
                            {o.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            {o.model || 'OLT Gateway'}
                          </div>

                          {/* IP Address Pill */}
                          <div className={`mt-2.5 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center justify-between ${isActive
                            ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}>
                            <span className="truncate">{maskIpAddress(o.ip_address)}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-sans font-bold">IP</span>
                          </div>

                          {/* Location */}
                          <div className="text-[11px] mt-2 truncate flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{o.location || 'Lokasi tidak diatur'}</span>
                          </div>
                        </div>

                        {/* Card Footer: Active State or Action Buttons */}
                        <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            {isActive ? (
                              <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <IconCheck className="w-3 h-3 stroke-[3]" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                Pilih OLT
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            {isLive && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDisconnectOlt(o); }}
                                disabled={disconnectingId === o.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                title={`Hentikan SNMP ke ${o.name}`}
                              >
                                {disconnectingId === o.id ? <Spinner /> : (
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                  </svg>
                                )}
                              </button>
                            )}
                            {canCrud && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(o); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Edit OLT"
                                >
                                  <IconEdit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteOlt(o); }}
                                  disabled={deletingId === o.id}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                  title="Hapus OLT"
                                >
                                  {deletingId === o.id ? <Spinner /> : <IconTrash className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Empty State ── */}
      {!loadingOltList && olts.length === 0 && (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <div className="text-4xl"></div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Belum Ada Perangkat OLT Terdaftar</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Database OLT saat ini kosong. Silakan tambahkan perangkat OLT aktif Anda (ZTE, Huawei, VSOL, HSGQ, Hioso, Tarmoc, BDCOM, FiberHome) untuk mulai pemantauan telemetri via SNMP.
          </p>
          <button
            onClick={() => setShowAddOltModal(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all inline-flex items-center space-x-2"
          >
            <IconPlus /><span>+ Tambah Perangkat OLT Baru</span>
          </button>
        </div>
      )}

      {/* ── Hardware Telemetry via SNMP ───────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-600 dark:text-slate-400 flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Melakukan polling SNMP ke telemetri {activeOlt?.name}...</span>
        </div>
      ) : oltData && (
        <div className="space-y-6">

          {/* Data source indicator */}
          {oltData.device_info?._source && (
            <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs ${oltData.device_info._source === 'live_snmp'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}>
              <div className="flex items-center space-x-2">
                <span>{oltData.device_info._source === 'live_snmp' ? '' : ''}</span>
                <span>
                  {oltData.device_info._source === 'live_snmp'
                    ? `Data real dari OLT via SNMP — IP: ${maskIpAddress(activeOlt?.ip_address)} (Port UDP 161)`
                    : 'Data Realtime Database UNMS (OLT belum terhubung Live SNMP). Klik "Konfigurasi SNMP" untuk menguji query live.'}
                </span>
              </div>
              {oltData.device_info._source === 'live_snmp' && activeOlt && (
                <button
                  onClick={() => handleDisconnectOlt(activeOlt)}
                  disabled={disconnectingId === activeOlt.id}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors flex items-center space-x-1 disabled:opacity-50">
                  {disconnectingId === activeOlt.id ? <Spinner /> : <span>Hentikan SNMP</span>}
                </button>
              )}
            </div>
          )}



          {/* ══════════════════════════════════════════════════════════════════
              TOOLBAR MODE TAMPILAN: VIRTUAL CHASSIS vs GRID KARTU
          ══════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="font-bold text-slate-950 dark:text-white text-base flex items-center gap-2">
                <IconServer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Visualisasi Perangkat &amp; Port Fisik OLT</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {activeOlt?.vendor || 'ZTE'} {oltData.device_info?.model || 'ZXAN C320 / C300'}
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Pilih mode visualisasi rak fisik chassis atau mode grid kartu port interaktif.
              </p>
            </div>

            {/* View Switcher Buttons with SVG Icons */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setChassisViewMode('chassis')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${chassisViewMode === 'chassis'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
              >
                <IconServer className="w-4 h-4" />
                <span>Virtual Chassis Rack</span>
              </button>
              <button
                type="button"
                onClick={() => setChassisViewMode('cards')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${chassisViewMode === 'cards'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
              >
                <IconLayers className="w-4 h-4" />
                <span>Grid Kartu Port (Legacy)</span>
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              VIEW MODE 1: REALISTIC VIRTUAL CHASSIS RACK VIEW (HSGQ / ZTE C300 / ZTE C320)
          ══════════════════════════════════════════════════════════════════ */}
          {chassisViewMode === 'chassis' && (() => {
            const isHsgq = (activeOlt?.vendor || '').toLowerCase().includes('hsgq') ||
              (activeOlt?.model || '').toLowerCase().includes('hsgq') ||
              (activeOlt?.name || '').toLowerCase().includes('hsgq') ||
              (activeOlt?.vendor_key || '').includes('hsgq');

            const isC300 = !isHsgq && (
              activeOlt?.model?.toLowerCase().includes('300') ||
              activeOlt?.name?.toLowerCase().includes('c300') ||
              activeOlt?.vendor_key?.includes('c300') ||
              (oltData.device_info?.model || '').toLowerCase().includes('300')
            );

            // Helper menghitung kapasitas port berdasarkan tipe kartu
            const getCardPortCount = (cardType) => {
              if (!cardType) return 0;
              const type = String(cardType).toUpperCase();
              if (type.startsWith('GTGO') || type.startsWith('ETGO') || type.includes('8P')) return 8;
              if (type.startsWith('GTGH') || type.startsWith('GFGH') || type.startsWith('GTGK') || type.includes('16P')) return 16;
              if (type.startsWith('GTXO') || type.includes('4P')) return 4;
              if (type.startsWith('HUVQ') || type.startsWith('XUTQ') || type.startsWith('SMXA') || type.startsWith('SCXN') || type.startsWith('SCTM')) return 4;
              return 16;
            };

            const discoveredCards = oltData.device_info?.cards || [];

            return (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 1. Realistic Hardware Chassis Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs overflow-x-auto">
                  <div className="min-w-[1240px] space-y-5">
                    {/* Top Bar: Title & Specs & Model Profile Badge */}
                    <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-900 dark:text-slate-200 pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 text-xs">
                          {isHsgq ? '1U DESKTOP / RACK BOX' : isC300 ? 'RACK 19" 10U (VERTICAL BLADES)' : 'RACK 19" 2U (HORIZONTAL)'}
                        </span>
                        <strong className="text-slate-950 dark:text-white text-base tracking-wide font-black">
                          Virtual Chassis View — {activeOlt?.vendor || (isHsgq ? 'HSGQ' : 'ZTE')} {isHsgq ? (activeOlt?.model || 'HSGQ-E04M Gigabit Series') : isC300 ? 'ZXAN C300 Enterprise' : (activeOlt?.model || 'ZXAN C320')}
                        </strong>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          · {isHsgq ? `${oltData.pon_ports?.length || 4} PON Ports + 4 Uplink` : isC300 ? '21 Slots Architecture' : '4 Slots Architecture'} / {oltData.pon_ports?.length || 16} Ports Active
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500 shadow-xs shadow-emerald-500/50" /> Port Up / Active Laser</span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-rose-500 shadow-xs shadow-rose-500/50" /> Port Down / Standby</span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900" /> Selected</span>
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════════════
                        LAYOUT C: HSGQ (1U COMPACT BOX-TYPE OLT — HSGQ-E04M / HSGQ-G08M)
                    ══════════════════════════════════════════════════════════════════ */}
                    {isHsgq ? (
                      <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
                        {/* Top Metal Body with "O L T" Grille Ventilation Cutouts */}
                        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-2.5 flex items-center justify-between text-xs font-mono select-none">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-widest text-slate-800 dark:text-slate-200">HSGQ 1U GIGABIT EPON/GPON OLT</span>
                          </div>

                          {/* "O L T" Grille Ventilation Pattern */}
                          <div className="flex items-center gap-6 text-slate-400 dark:text-slate-600 font-mono tracking-widest text-sm font-black select-none">
                            <span className="tracking-[5px] border-b-2 border-dashed border-slate-300 dark:border-slate-700">||||||||  O</span>
                            <span className="tracking-[5px] border-b-2 border-dashed border-slate-300 dark:border-slate-700">||||||||  L</span>
                            <span className="tracking-[5px] border-b-2 border-dashed border-slate-300 dark:border-slate-700">||||||||  T</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" />
                            <span>100-240V AC / DC-12V</span>
                          </div>
                        </div>

                        {/* Front Metallic Bezel Panel (Sesuai Foto Asli HSGQ-E04M) */}
                        <div className="bg-slate-50/60 dark:bg-slate-900/90 border-y border-slate-200 dark:border-slate-700 p-6 sm:p-7 flex flex-wrap items-center justify-between gap-6 font-mono select-none text-slate-950 dark:text-white">
                          {/* 1. Left Brand & Model Section */}
                          <div className="flex items-center gap-5">
                            <div>
                              <div className="text-2xl font-black text-rose-600 dark:text-rose-500 tracking-tighter flex items-center gap-1.5">
                                <span>HSGQ</span>
                              </div>
                              <div className="text-sm font-black text-slate-950 dark:text-white mt-0.5 tracking-tight">
                                {activeOlt?.model || 'HSGQ-E04M'}
                              </div>
                            </div>

                            {/* Reset Button */}
                            <div className="flex flex-col items-center gap-1 pl-4 border-l border-slate-300 dark:border-slate-700">
                              <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 shadow-inner" title="Factory Reset Pinhole" />
                              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-sans uppercase font-bold">Reset</span>
                            </div>
                          </div>

                          {/* 2. Middle Section: PON Ports & UPLINK Ports */}
                          <div className="flex items-center gap-8">
                            {/* PON Ports Group */}
                            <div className="flex flex-col items-center">
                              <div className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider mb-1.5">
                                ┌───── PON ─────┐
                              </div>
                              <div className="flex items-center gap-2">
                                {Array.from({ length: Math.max(oltData.pon_ports?.length || 4, 4) }).map((_, idx) => {
                                  const portNum = idx + 1;
                                  const targetPortId = `1/${portNum}`;
                                  const matchedPort = (oltData.pon_ports || []).find(p => {
                                    const clean = p.port_id.replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
                                    return clean === targetPortId || clean === `${portNum}` || p.port_id.endsWith(`/${portNum}`) || Number(p.port) === portNum;
                                  }) || {
                                    port_id: `pon_1/${portNum}`,
                                    status: 'Down',
                                    registered_onus: 0,
                                    online_onus: 0,
                                  };

                                  const isSelected = selectedPortFilter === matchedPort.port_id || selectedPortFilter === targetPortId;
                                  const isUp = checkIsPortUp(matchedPort, oltData);

                                  return (
                                    <div key={idx} className="flex flex-col items-center gap-1">
                                      <span className="text-xs font-black text-slate-950 dark:text-white">{portNum}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectPort(matchedPort.port_id)}
                                        onMouseEnter={() => setHoveredPortInfo({ ...matchedPort, slot: 1, portNum })}
                                        onMouseLeave={() => setHoveredPortInfo(null)}
                                        className={`w-11 sm:w-13 h-11 sm:h-13 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-black transition-all shadow-xs ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white border-white ring-4 ring-indigo-400 scale-110 z-20 shadow-lg'
                                            : isUp
                                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600 shadow-emerald-500/40'
                                              : 'bg-slate-100 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900 shadow-inner'
                                        }`}
                                        title={`PON Port ${portNum}: ${isUp ? `Up (${matchedPort.online_onus || 0} Online)` : 'Down'}`}
                                      >
                                        <div className="w-5 h-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xs flex items-center justify-center">
                                          <span className={`w-2.5 h-1.5 rounded-2xs ${isUp ? 'bg-emerald-500 shadow-xs shadow-emerald-500' : 'bg-rose-500'}`} />
                                        </div>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* UP LINK Ports Group */}
                            <div className="flex flex-col items-center">
                              <div className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider mb-1.5">
                                ┌──── UP LINK ────┐
                              </div>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4].map(uNum => (
                                  <div key={uNum} className="flex flex-col items-center gap-1">
                                    <span className="text-xs font-black text-slate-950 dark:text-white">{uNum}</span>
                                    <div
                                      className="w-11 sm:w-13 h-11 sm:h-13 rounded-lg border-2 border-emerald-600 bg-emerald-500 flex flex-col items-center justify-center text-xs font-black text-slate-950 shadow-xs"
                                      title={`Uplink GE/10GE Port ${uNum}: Active (1000M/10G Full-Duplex)`}
                                    >
                                      <div className="w-5 h-3.5 bg-slate-950 border border-emerald-700 rounded-xs flex items-center justify-center">
                                        <span className="w-2.5 h-1.5 rounded-2xs bg-emerald-400 shadow-xs shadow-emerald-400" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 3. Right Section: Dual RJ45 Management & Status LED Matrix */}
                          <div className="flex items-center gap-6">
                            {/* Dual Stacked RJ45 (CONSOLE & NMS) */}
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] font-bold text-slate-600 dark:text-slate-400">CONSOLE</span>
                                <div className="w-9 h-6 rounded-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-inner">
                                  <span className="w-4 h-3 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xs" />
                                </div>
                              </div>
                              <div className="flex flex-col items-center">
                                <div className="w-9 h-6 rounded-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-inner">
                                  <span className="w-4 h-3 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xs" />
                                </div>
                                <span className="text-[8px] font-bold text-slate-600 dark:text-slate-400">NMS</span>
                              </div>
                            </div>

                            {/* LED Matrix Columns (PON1..4, GE1..4, PWR, SYS, NMS) */}
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[8px] font-bold text-slate-800 dark:text-slate-200 border-l border-slate-300 dark:border-slate-700 pl-4">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>PON1</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>GE1</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>PWR</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>PON2</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>GE2</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" />
                                <span>SYS</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>PON3</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>GE3</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>NMS</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>PON4</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                <span>GE4</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                                <span>ALM</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : isC300 ? (
                      <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                        {/* Top Large Fan Tray Bar with 2 Orange Latch Handles */}
                        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between text-xs font-mono select-none">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-900 dark:text-white font-black tracking-wider text-xs flex items-center gap-1.5">
                              <IconActivity className="w-4 h-4 text-emerald-500" />
                              <span>FAN UNIT MODULE</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN TRAY 1: Normal" />
                              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN TRAY 2: Normal" />
                              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN TRAY 3: Normal" />
                            </div>
                          </div>

                          {/* 2 Orange Release Latch Handles (Persis Foto ZTE C300) */}
                          <div className="flex items-center gap-16">
                            <div className="w-20 h-4 rounded bg-orange-600 border border-orange-500 shadow-inner flex items-center justify-center text-[8px] text-white font-black">LATCH 1</div>
                            <div className="w-20 h-4 rounded bg-orange-600 border border-orange-500 shadow-inner flex items-center justify-center text-[8px] text-white font-black">LATCH 2</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-700 flex items-center gap-1">
                              <IconZap className="w-3.5 h-3.5 text-amber-500" />
                              <span>48V DC / 220V AC</span>
                            </span>
                            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="MAIN POWER OK" />
                          </div>
                        </div>

                        {/* 21 Vertical Blade Card Slots (Side-by-Side Horizontal Chain) */}
                        <div className="grid grid-cols-21 divide-x divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-950 font-mono text-xs min-h-[500px]">
                          {/* Slot 1: PRWG (Power Blade) */}
                          <div className="flex flex-col items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-300 font-bold">|</div>
                              <span className="font-black text-[10px] text-slate-900 dark:text-white tracking-tighter">PRWG</span>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                            </div>

                            {/* Power Connector Visuals */}
                            <div className="space-y-4 py-3 flex flex-col items-center">
                              <div className="w-7 h-12 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 shadow-inner">
                                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                              </div>
                              <div className="w-5 h-5 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center text-xs text-white font-black shadow-xs">⚡</div>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white">1</div>
                              <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-300 font-bold">|</div>
                            </div>
                          </div>

                          {/* Slots 2 to 21 (Line Cards & Control Blades & Uplink) */}
                          {Array.from({ length: 20 }).map((_, sIdx) => {
                            const slotNum = sIdx + 2; // Slot 2..21
                            const isCenterControl = slotNum === 10 || slotNum === 11; // SCXN

                            // Ambil info kartu riil dari data OLT
                            const cardInfo = discoveredCards.find(c => Number(c.slot) === slotNum);
                            const cardTypeUpper = (cardInfo?.type || '').toUpperCase();
                            const isUplinkBlade = cardTypeUpper.startsWith('HUVQ') || cardTypeUpper.startsWith('XUTQ') || (!cardInfo && (slotNum === 19 || slotNum === 20));
                            const isLineCard = !isCenterControl && !isUplinkBlade && (!!cardInfo || slotNum <= 7);

                            // Dapatkan jumlah port yang presisi sesuai tipe kartu (GTGH: 16 port, GTGO: 8 port)
                            const cardType = cardInfo?.type || (slotNum === 3 || slotNum === 4 ? 'GTGOG' : slotNum === 7 ? 'GTGHK' : 'GTGHG');
                            const portCount = isLineCard ? getCardPortCount(cardType) : 0;

                            // Filter port-port PON untuk slot ini
                            const slotPorts = (oltData.pon_ports || []).filter(p => {
                              const clean = p.port_id.replace(/^gpon[-_]olt_/i, '');
                              return Number(p.slot) === slotNum || clean.startsWith(`1/${slotNum}/`) || clean.startsWith(`${slotNum}/`);
                            });

                            return (
                              <div
                                key={slotNum}
                                className={`flex flex-col items-center justify-between p-1.5 transition-colors ${isCenterControl
                                  ? 'bg-indigo-50/50 dark:bg-slate-900 border-x border-indigo-200 dark:border-indigo-500/40 shadow-inner'
                                  : isUplinkBlade
                                    ? 'bg-slate-50/60 dark:bg-slate-900/80'
                                    : isLineCard
                                      ? 'bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      : 'bg-slate-50/30 dark:bg-slate-950/60 opacity-60'
                                  }`}
                              >
                                {/* Top Screw & Card Label */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-300 font-bold">|</div>
                                  <span className="font-black text-[10px] sm:text-[11px] text-slate-900 dark:text-white truncate max-w-[40px]">
                                    {isCenterControl ? 'SCXN' : isUplinkBlade ? (cardInfo?.type || 'HUVQ') : isLineCard ? cardType : '—'}
                                  </span>
                                  {(isLineCard || isCenterControl || isUplinkBlade) && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                  )}
                                </div>

                                {/* Center Area: Vertical Ports Array / Vent Grooves */}
                                <div className="py-1 flex-1 flex flex-col items-center justify-center w-full">
                                  {/* Line Card: Menyesuaikan jumlah port riil (GTGH = 16 port, GTGO = 8 port) */}
                                  {isLineCard ? (
                                    <div className="space-y-1 w-full flex flex-col items-center">
                                      {Array.from({ length: portCount }).map((_, pIdx) => {
                                        const portNum = pIdx + 1;
                                        const targetPortId = `1/${slotNum}/${portNum}`;
                                        const matchedPort = slotPorts.find(p => {
                                          const clean = p.port_id.replace(/^gpon[-_]olt_/i, '');
                                          return clean === targetPortId || clean === `${slotNum}/${portNum}` || (Number(p.slot) === slotNum && Number(p.port) === portNum);
                                        }) || {
                                          port_id: `gpon-olt_1/${slotNum}/${portNum}`,
                                          status: 'Down',
                                          registered_onus: 0,
                                          online_onus: 0,
                                          los_onus: 0,
                                        };

                                        const isSelected = selectedPortFilter === matchedPort.port_id || selectedPortFilter === `gpon-olt_${targetPortId}` || selectedPortFilter === targetPortId;
                                        const isUp = checkIsPortUp(matchedPort, oltData);

                                        return (
                                          <button
                                            key={pIdx}
                                            type="button"
                                            onClick={() => handleSelectPort(matchedPort.port_id)}
                                            onMouseEnter={() => setHoveredPortInfo({ ...matchedPort, slot: slotNum, portNum })}
                                            onMouseLeave={() => setHoveredPortInfo(null)}
                                            className={`w-full max-w-[32px] h-5 sm:h-5.5 rounded border flex items-center justify-center text-[9px] sm:text-[10px] font-black transition-all ${isSelected
                                              ? 'bg-indigo-600 text-white border-white ring-2 ring-indigo-400 scale-125 z-20 shadow-lg'
                                              : isUp
                                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600 shadow-emerald-500/30'
                                                : 'bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 shadow-inner'
                                              }`}
                                            title={`Port 1/${slotNum}/${portNum} (${cardType}): ${isUp ? `Up / Active Laser` : 'Down / Standby'} (Tx: ${matchedPort.tx_power_dbm || '—'} dBm, ${matchedPort.online_onus || 0} Online)`}
                                          >
                                            {portNum}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : isCenterControl ? (
                                    /* SCXN Control Blade: 4x 10GE SFP+ & 3x RJ45 Ports */
                                    <div className="space-y-2 flex flex-col items-center py-1">
                                      <div className="space-y-1">
                                        {[1, 2, 3, 4].map(uN => (
                                          <div key={uN} className="w-7 h-5 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-600 flex items-center justify-center text-[8px] text-indigo-700 dark:text-indigo-200 font-bold shadow-xs" title={`SCXN 10GE Uplink ${uN}: Up`}>
                                            X{uN}
                                          </div>
                                        ))}
                                      </div>
                                      <div className="w-5 h-2 bg-orange-500 rounded-xs shadow-inner" title="Release Latch" />
                                      <div className="space-y-1">
                                        {['C', 'M', 'B'].map((l, i) => (
                                          <div key={i} className="w-5 h-4 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[7px] text-slate-700 dark:text-slate-300 font-bold shadow-xs" title={l === 'C' ? 'Console' : l === 'M' ? 'MGMT' : 'BITS'}>
                                            {l}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : isUplinkBlade ? (
                                    /* HUVQ Uplink Blade: 4x 10GE SFP+ */
                                    <div className="space-y-2 flex flex-col items-center py-2">
                                      {[1, 2, 3, 4].map(uN => (
                                        <div key={uN} className="w-7 h-7 rounded border border-emerald-600 bg-emerald-500 flex items-center justify-center text-[10px] text-slate-950 font-black shadow-xs" title={`HUVQ 10GE SFP+ ${uN}: Up`}>
                                          U{uN}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    /* Empty Slot: Metal Blank Plate with Vertical Grooves */
                                    <div className="h-full flex items-center justify-center gap-1 py-4 opacity-30">
                                      <div className="w-1 h-64 bg-slate-300 dark:bg-slate-700 rounded-full" />
                                      <div className="w-1 h-64 bg-slate-300 dark:bg-slate-700 rounded-full" />
                                    </div>
                                  )}
                                </div>

                                {/* Bottom Slot Number & Screw */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white shadow-xs">
                                    {slotNum}
                                  </div>
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-300 font-bold">|</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* ══════════════════════════════════════════════════════════════════
                          LAYOUT B: ZTE C320 (2U HORIZONTAL COMPACT CHASSIS)
                      ══════════════════════════════════════════════════════════════════ */
                      <div className="flex border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                        {/* Left Vertical Column: FAN TRAY */}
                        <div className="w-16 sm:w-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center justify-between text-center select-none">
                          <div className="text-xs font-mono font-black text-slate-900 dark:text-white tracking-wider">FAN</div>
                          <div className="space-y-2.5 py-3">
                            <div className="w-9 h-4 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN 1 OK" />
                            <div className="w-9 h-4 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN 2 OK" />
                            <div className="w-9 h-4 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse" title="FAN 3 OK" />
                          </div>
                          <div className="w-8 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                        </div>

                        {/* Right Main Column: Slots 1, 2, 3 & 4 */}
                        <div className="flex-1 divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900/60 font-mono">
                          {/* ROW 1: SLOT 1 */}
                          {(() => {
                            const card1 = discoveredCards.find(c => Number(c.slot) === 1) || { type: 'GTGHG' };
                            const portCount1 = getCardPortCount(card1.type) || 16;

                            return (
                              <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                <div className="flex items-center gap-3 w-36 shrink-0">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="RUN LED: Active" />
                                  <span className="text-sm font-black text-slate-900 dark:text-white">{card1.type}</span>
                                </div>

                                <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 overflow-x-auto">
                                  {Array.from({ length: portCount1 }).map((_, idx) => {
                                    const portNum = idx + 1;
                                    const targetPortId = `1/1/${portNum}`;
                                    const matchedPort = (oltData.pon_ports || []).find(p => {
                                      const clean = p.port_id.replace(/^gpon[-_]olt_/i, '');
                                      return clean === targetPortId || clean === `1/${portNum}` || (Number(p.slot) === 1 && Number(p.port) === portNum);
                                    }) || {
                                      port_id: `gpon-olt_1/1/${portNum}`,
                                      status: 'Down',
                                      registered_onus: 0,
                                      online_onus: 0,
                                      los_onus: 0,
                                    };

                                    const isSelected = selectedPortFilter === matchedPort.port_id || selectedPortFilter === `gpon-olt_${targetPortId}` || selectedPortFilter === targetPortId;
                                    const isUp = checkIsPortUp(matchedPort, oltData);

                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectPort(matchedPort.port_id)}
                                        onMouseEnter={() => setHoveredPortInfo({ ...matchedPort, slot: 1, portNum })}
                                        onMouseLeave={() => setHoveredPortInfo(null)}
                                        className={`w-10 sm:w-11 h-11 sm:h-12 rounded-lg border flex flex-col items-center justify-center text-xs font-black transition-all shadow-xs shrink-0 ${isSelected
                                          ? 'bg-indigo-600 text-white border-white ring-2 ring-indigo-400 scale-110 z-20 shadow-md'
                                          : isUp
                                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600 shadow-emerald-500/30'
                                            : 'bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 shadow-inner'
                                          }`}
                                        title={`Port 1/1/${portNum}: ${isUp ? `Up (${matchedPort.online_onus || 0} Online)` : 'Down'}`}
                                      >
                                        <span>{portNum}</span>
                                        <span className={`w-2 h-2 rounded-full mt-1 ${isSelected ? 'bg-white' : isUp ? 'bg-emerald-950' : 'bg-rose-400'}`} />
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-end gap-3 w-20 shrink-0">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white shadow-xs">1</div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* ROW 2: SLOT 2 */}
                          {(() => {
                            const card2 = discoveredCards.find(c => Number(c.slot) === 2);
                            const hasCard2 = !!card2;
                            const portCount2 = hasCard2 ? (getCardPortCount(card2.type) || 16) : 0;

                            if (!hasCard2) {
                              return (
                                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                                  <div className="flex items-center gap-3 w-36 shrink-0">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-400 font-bold">|</div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">SLOT 2 (EMPTY)</span>
                                  </div>
                                  <div className="flex-1 flex items-center justify-center gap-3 opacity-30">
                                    <div className="w-40 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                    <span className="text-xs font-mono">EXPANSION BLANK PANEL</span>
                                    <div className="w-40 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                  </div>
                                  <div className="flex items-center justify-end gap-3 w-20 shrink-0">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-400">2</div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                <div className="flex items-center gap-3 w-36 shrink-0">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="RUN LED: Active" />
                                  <span className="text-sm font-black text-slate-900 dark:text-white">{card2.type}</span>
                                </div>

                                <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 overflow-x-auto">
                                  {Array.from({ length: portCount2 }).map((_, idx) => {
                                    const portNum = idx + 1;
                                    const targetPortId = `1/2/${portNum}`;
                                    const matchedPort = (oltData.pon_ports || []).find(p => {
                                      const clean = p.port_id.replace(/^gpon[-_]olt_/i, '');
                                      return clean === targetPortId || clean === `2/${portNum}` || (Number(p.slot) === 2 && Number(p.port) === portNum);
                                    }) || {
                                      port_id: `gpon-olt_1/2/${portNum}`,
                                      status: 'Down',
                                      registered_onus: 0,
                                      online_onus: 0,
                                      los_onus: 0,
                                    };

                                    const isSelected = selectedPortFilter === matchedPort.port_id || selectedPortFilter === `gpon-olt_${targetPortId}` || selectedPortFilter === targetPortId;
                                    const isUp = checkIsPortUp(matchedPort, oltData);

                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectPort(matchedPort.port_id)}
                                        onMouseEnter={() => setHoveredPortInfo({ ...matchedPort, slot: 2, portNum })}
                                        onMouseLeave={() => setHoveredPortInfo(null)}
                                        className={`w-10 sm:w-11 h-11 sm:h-12 rounded-lg border flex flex-col items-center justify-center text-xs font-black transition-all shadow-xs shrink-0 ${isSelected
                                          ? 'bg-indigo-600 text-white border-white ring-2 ring-indigo-400 scale-110 z-20 shadow-md'
                                          : isUp
                                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600 shadow-emerald-500/30'
                                            : 'bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 shadow-inner'
                                          }`}
                                        title={`Port 1/2/${portNum}: ${isUp ? `Up (${matchedPort.online_onus || 0} Online)` : 'Down'}`}
                                      >
                                        <span>{portNum}</span>
                                        <span className={`w-2 h-2 rounded-full mt-1 ${isSelected ? 'bg-white' : isUp ? 'bg-emerald-950' : 'bg-rose-400'}`} />
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-end gap-3 w-20 shrink-0">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white shadow-xs">2</div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* ROW 3: SLOT 3 (PRAM) & SLOT 4 (SMXA) */}
                          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
                            {/* Slot 3: PRAM */}
                            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="POWER LED: Active" />
                                <span className="text-sm font-black text-slate-900 dark:text-white">PRAM</span>
                              </div>

                              <div className="flex items-center gap-2.5 px-3">
                                <div className="w-12 h-7 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-1.5 shadow-inner">
                                  <span className="w-1.5 h-4 bg-slate-400 rounded-2xs" />
                                  <span className="w-1.5 h-4 bg-slate-400 rounded-2xs" />
                                  <span className="w-1.5 h-4 bg-slate-400 rounded-2xs" />
                                </div>
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-bold hidden sm:inline">220V AC / -48V DC</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white shadow-xs">3</div>
                              </div>
                            </div>

                            {/* Slot 4: SMXA */}
                            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" title="CTRL LED: Active" />
                                <span className="text-sm font-black text-slate-900 dark:text-white">SMXA</span>
                              </div>


                              <div className="flex items-center gap-2 px-3">
                                {[1, 2, 3, 4].map(uNum => (
                                  <div
                                    key={uNum}
                                    className="w-9 h-9 rounded-lg border border-emerald-600 bg-emerald-500 flex flex-col items-center justify-center text-[10px] font-black text-slate-950 shadow-xs"
                                    title={`Uplink Port ${uNum} (10GE XGE): Up`}
                                  >
                                    <span>U{uNum}</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-950 mt-0.5" />
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-300 font-bold shadow-xs">|</div>
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white shadow-xs">4</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Persistent Active/Selected & Hovered Port Telemetry HUD */}
                    {(() => {
                      const activePortHUD = hoveredPortInfo || (selectedPortFilter ? (() => {
                        const matched = (oltData.pon_ports || []).find(p => {
                          const clean = p.port_id.replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
                          return p.port_id === selectedPortFilter || clean === selectedPortFilter || `1/${p.port}` === selectedPortFilter || clean === selectedPortFilter.replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
                        });
                        if (matched) return matched;
                        return {
                          port_id: selectedPortFilter,
                          status: 'Up',
                          registered_onus: (oltData.onus || []).filter(o => o.port_id === selectedPortFilter).length,
                          online_onus: (oltData.onus || []).filter(o => o.port_id === selectedPortFilter && (o.status === 'online' || o.status === 'Working')).length,
                        };
                      })() : null);

                      if (!activePortHUD) {
                        return (
                          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800 dark:text-white animate-in fade-in duration-150">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                Silakan <strong className="text-slate-900 dark:text-white">klik salah satu nomor Port PON (1–16)</strong> pada visual kartu blade di atas untuk melihat telemetri port &amp; memuat daftar ONU secara realtime.
                              </span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              Mode: On-Demand Lazy Loading
                            </span>
                          </div>
                        );
                      }

                      const isPortUp = checkIsPortUp(activePortHUD, oltData);
                      const totalOnusOnPort = (activePortHUD.registered_onus || 0) + (activePortHUD.unconfigured_onus || 0);

                      return (
                        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500 dark:border-indigo-500/80 shadow-md flex flex-wrap items-center justify-between gap-4 text-xs text-slate-900 dark:text-white animate-in fade-in duration-100">
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black font-mono shadow-xs text-xs sm:text-sm">
                              PORT {activePortHUD.slot ? `1/${activePortHUD.slot}/${activePortHUD.portNum || activePortHUD.port || 1}` : activePortHUD.port_id}
                            </span>
                            <div>
                              <span className="font-black text-sm text-slate-900 dark:text-white">{activePortHUD.port_id}</span>
                              <div className="text-slate-600 dark:text-slate-300 text-xs font-semibold flex flex-wrap items-center gap-2 mt-1">
                                <span>Status: <strong className={isPortUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{isPortUp ? 'Up / Active Laser' : 'Down / Standby'}</strong></span>
                                <span>·</span>
                                <span><strong className="text-slate-900 dark:text-white font-bold">{activePortHUD.registered_onus || 0}</strong> Terdaftar {activePortHUD.unconfigured_onus > 0 ? <span>(<strong className="text-amber-600 dark:text-amber-400">{activePortHUD.unconfigured_onus}</strong> Belum Terdaftar)</span> : ''}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                                  <span>SFP:</span>
                                  <span className="text-indigo-600 dark:text-indigo-400">{activePortHUD.sfp_class || 'Class C+'}</span>
                                  {activePortHUD.sfp_vendor && activePortHUD.sfp_vendor !== '—' && (
                                    <span className="text-slate-500 dark:text-slate-400 font-normal">({activePortHUD.sfp_vendor})</span>
                                  )}
                                </span>
                                <span>·</span>
                                <span>Tx Power: <strong className="text-amber-600 dark:text-amber-400 font-bold font-mono">{activePortHUD.tx_power_dbm ? `+${activePortHUD.tx_power_dbm} dBm` : (isPortUp ? '+5.50 dBm' : '—')}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {selectedPortFilter === activePortHUD.port_id ? (
                              <button
                                type="button"
                                onClick={() => handleSelectPort(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs shadow-xs border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
                              >
                                <IconX />
                                <span>Tampilkan Semua Port</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectPort(activePortHUD.port_id)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2"
                              >
                                <span>Buka &amp; Filter Port Ini</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW MODE 2: GRID KARTU PORT (LEGACY MODERN CARDS)
          ══════════════════════════════════════════════════════════════════ */}
          {chassisViewMode === 'cards' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Chassis cards */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Slot &amp; Card — {activeOlt?.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Klik salah satu Slot Card di bawah untuk memfilter daftar Port PON</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Total {oltData.device_info?.cards?.length ?? 0} Slot</span>
                    {selectedSlotFilter && (
                      <button onClick={() => { setSelectedSlotFilter(null); setSelectedPortFilter(null); }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors">
                        Reset Filter Slot
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {oltData.device_info?.cards?.map((card, i) => {
                    const isSelected = selectedSlotFilter === card.slot;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedSlotFilter(isSelected ? null : card.slot);
                          setSelectedPortFilter(null);
                        }}
                        className={`p-4 rounded-xl space-y-2 text-left transition-all relative ${isSelected
                          ? 'bg-indigo-600 border-2 border-indigo-600 shadow-md text-white ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700'
                          }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>Slot {card.slot} ({card.type})</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            }`}>{card.status}</span>
                        </div>
                        <div className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>
                          Kapasitas: <span className="font-bold">{card.ports} Port</span>
                        </div>
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 bg-emerald-400 dark:bg-emerald-500 text-slate-950 dark:text-white rounded-full p-0.5 shadow-md">
                            <IconCheck size="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PON Ports */}
              {(() => {
                const displayPorts = selectedSlotFilter
? oltData.pon_ports?.filter(p => p.slot === selectedSlotFilter || p.port_id.includes(`/${selectedSlotFilter}/`))
                  : oltData.pon_ports;

                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                          {selectedSlotFilter
                            ? `Status Port PON & Power Optical (SFP) — Filtered [ Slot ${selectedSlotFilter} ]`
                            : `Status Port PON & Power Optical (SFP) — ${activeOlt?.name}`}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {selectedSlotFilter
                            ? `Menampilkan ${displayPorts?.length ?? 0} Port PON pada Slot ${selectedSlotFilter}. Klik salah satu kartu port untuk memfilter tabel ONU.`
                            : `Klik Slot Card di atas atau klik salah satu kartu Port PON di bawah untuk memfilter tabel ONU.`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Total {displayPorts?.length ?? 0} Port</span>
                        {selectedSlotFilter && (
                          <button onClick={() => { setSelectedSlotFilter(null); setSelectedPortFilter(null); }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold text-xs transition-colors flex items-center space-x-1">
                            <IconX />
                            <span>Tampilkan Semua Slot ({oltData.pon_ports?.length ?? 0})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {displayPorts && displayPorts.length > 0 ? (
                        displayPorts.map(port => {
                          const isSelected = selectedPortFilter === port.port_id;
                          const isPortUp = checkIsPortUp(port, oltData);
                          const matchedOdcs = oltTopology.filter(o => {
                            if (!o.olt_port_ref) return false;
                            const targetClean = port.port_id.replace(/^gpon[-_]olt_/i, '');
                            const refs = o.olt_port_ref.split(',').map(r => r.trim().replace(/^gpon[-_]olt_/i, ''));
                            return refs.some(r => r === targetClean || r === port.port_id || `gpon-olt_${r}` === port.port_id);
                          });
                          const odcCount = matchedOdcs.length;
                          const odpCount = matchedOdcs.reduce((acc, o) => acc + (o.odps?.length || 0), 0);

                          const portOnusList = (oltData.onu_list || []).filter(o => {
                            const p = (o.port || '').replace(/^gpon[-_]olt_/i, '');
                            const target = port.port_id.replace(/^gpon[-_]olt_/i, '');
                            return p === target || p.startsWith(target + '/');
                          });
                          const activeOnus = portOnusList.filter(o => o.status === 'Online' && o.rx_power !== null && o.rx_power > -40);
                          const avgRx = activeOnus.length > 0
                            ? (activeOnus.reduce((acc, o) => acc + parseFloat(o.rx_power), 0) / activeOnus.length).toFixed(1)
                            : null;
                          const maxCapacity = 64;
                          const currentRegistered = port.registered_onus || portOnusList.length;
                          const capPercent = Math.min(100, Math.round((currentRegistered / maxCapacity) * 100));

                          return (
                            <button
                              key={port.port_id}
                              type="button"
                              onClick={() => handleSelectPort(port.port_id)}
                              className={`p-4 rounded-2xl space-y-3 text-left transition-all relative group ${isSelected
                                ? 'bg-indigo-50/90 dark:bg-indigo-900/30 border-2 border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 shadow-2xs'
                                }`}
                            >
                              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/70 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${port.status === 'Up' ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'}`} />
                                  <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                    <span>{formatShortPort(port.port_id)}</span>
                                    {isSelected && loadingPortOnus && <Spinner />}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isPortUp
                                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  }`}>
                                  {isPortUp ? 'Up' : 'Down'}
                                </span>
                              </div>

                              {/* Quick Counters */}
                              <div className="grid grid-cols-3 gap-1.5 text-center">
                                <div className="bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
                                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Total</div>
                                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">{currentRegistered}</div>
                                </div>
                                <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
                                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Online</div>
                                  <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{port.online_onus}</div>
                                </div>
                                <div className={`p-1.5 rounded-xl border ${port.los_onus > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40' : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-700/70'}`}>
                                  <div className={`text-[10px] font-bold ${port.los_onus > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>Offline</div>
                                  <div className={`text-xs font-extrabold ${port.los_onus > 0 ? 'text-rose-700 dark:text-rose-300 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>{port.los_onus}</div>
                                </div>
                              </div>

                              {/* Capacity Progress Bar */}
                              <div className="space-y-1 pt-0.5">
                                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <span>Kapasitas ({currentRegistered}/{maxCapacity})</span>
                                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{capPercent}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${capPercent > 90 ? 'bg-rose-500' : capPercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.max(4, capPercent)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Optical Power Telemetry & Avg Rx */}
                              <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                                {avgRx ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 font-semibold">Avg Rx:</span>
                                    <span className={`font-mono font-extrabold px-1.5 py-0.5 rounded text-[10px] ${parseFloat(avgRx) >= -23 ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : parseFloat(avgRx) >= -27 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
                                      {avgRx} dBm
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No Optical Data</span>
                                )}

                                {port.tx_power_dbm !== null && port.tx_power_dbm !== undefined && (
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                    <span>TX +{port.tx_power_dbm} dBm</span>
                                    {port.sfp_class && (
                                      <span className="px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-sans">
                                        {port.sfp_class}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Info ODC & ODP Terhubung */}
                              {odcCount > 0 && (
                                <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                                  <span className="text-blue-700 dark:text-blue-400 font-semibold truncate max-w-[130px]" title={matchedOdcs.map(o => o.name).join(', ')}>
                                    {matchedOdcs.map(o => o.name).join(', ')}
                                  </span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded text-[10px]">
                                    {odpCount} ODP
                                  </span>
                                </div>
                              )}

                              {isSelected && (
                                <div className="absolute -top-2 -right-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full p-0.5 shadow-md">
                                  <IconCheck size="w-3.5 h-3.5" />
                                </div>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="col-span-4 p-8 text-center text-slate-400 dark:text-slate-500 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          Tidak ada port PON pada Slot {selectedSlotFilter}.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}



          {/* ══════════════════════════════════════════════════════════════════
              WIDGET GRAFIK DISTRIBUSI KUALITAS REDAMAN OPTIK (ANALYTICS)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Distribusi Kualitas Redaman Optik (Optical Signal Quality)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Menganalisis sinyal optik dari <strong>{opticalStats.total} ONU</strong> {selectedPortFilter ? `pada Port [ ${formatShortPort(selectedPortFilter)} ]` : 'pada seluruh Port OLT'}. Klik salah satu kartu di bawah untuk memfilter tabel secara instan.
                </p>
              </div>
              {onuStatusFilter !== 'all' && (
                <button
                  onClick={() => { setOnuStatusFilter('all'); setRegisteredPage(1); }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <IconX />
                  <span>Reset Filter Sinyal ({onuStatusFilter})</span>
                </button>
              )}
            </div>

            {/* Segmented Signal Distribution Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden flex shadow-inner border border-slate-200/60 dark:border-slate-700/60">
                {opticalStats.total > 0 ? (
                  <>
                    <div
                      style={{ width: `${(opticalStats.excellent / opticalStats.total) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500 hover:opacity-90"
                      title={`Sangat Baik: ${opticalStats.excellent} ONU (${opticalStats.excellentPct}%)`}
                    />
                    <div
                      style={{ width: `${(opticalStats.good / opticalStats.total) * 100}%` }}
                      className="bg-teal-400 h-full transition-all duration-500 hover:opacity-90"
                      title={`Normal: ${opticalStats.good} ONU (${opticalStats.goodPct}%)`}
                    />
                    <div
                      style={{ width: `${(opticalStats.warning / opticalStats.total) * 100}%` }}
                      className="bg-amber-400 h-full transition-all duration-500 hover:opacity-90"
                      title={`Warning: ${opticalStats.warning} ONU (${opticalStats.warningPct}%)`}
                    />
                    <div
                      style={{ width: `${(opticalStats.critical / opticalStats.total) * 100}%` }}
                      className="bg-rose-500 h-full transition-all duration-500 hover:opacity-90"
                      title={`Kritis: ${opticalStats.critical} ONU (${opticalStats.criticalPct}%)`}
                    />
                    <div
                      style={{ width: `${(opticalStats.los / opticalStats.total) * 100}%` }}
                      className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-500 hover:opacity-90"
                      title={`LOS / Offline: ${opticalStats.los} ONU (${opticalStats.losPct}%)`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-full" />
                )}
              </div>
            </div>

            {/* 5 Clickable Distribution Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Sangat Baik */}
              <button
                type="button"
                onClick={() => { setOnuStatusFilter(prev => prev === 'excellent' ? 'all' : 'excellent'); setRegisteredPage(1); }}
                className={`p-3.5 rounded-xl text-left transition-all relative border ${onuStatusFilter === 'excellent'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">Sangat Baik</span>
                  <span className="font-mono text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.2 rounded">&gt; -19 dBm</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{opticalStats.excellent}</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">{opticalStats.excellentPct}%</span>
                </div>
              </button>

              {/* 2. Normal */}
              <button
                type="button"
                onClick={() => { setOnuStatusFilter(prev => prev === 'good' ? 'all' : 'good'); setRegisteredPage(1); }}
                className={`p-3.5 rounded-xl text-left transition-all relative border ${onuStatusFilter === 'good'
                  ? 'bg-teal-100 dark:bg-teal-950/80 border-teal-500 shadow-sm ring-2 ring-teal-500/30'
                  : 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/40 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40'
                  }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-800 dark:text-teal-300">Normal</span>
                  <span className="font-mono text-[10px] font-extrabold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.2 rounded">-19 s/d -23</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-teal-900 dark:text-teal-100">{opticalStats.good}</span>
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 font-mono">{opticalStats.goodPct}%</span>
                </div>
              </button>

              {/* 3. Warning */}
              <button
                type="button"
                onClick={() => { setOnuStatusFilter(prev => prev === 'warning' ? 'all' : 'warning'); setRegisteredPage(1); }}
                className={`p-3.5 rounded-xl text-left transition-all relative border ${onuStatusFilter === 'warning'
                  ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-500 shadow-sm ring-2 ring-amber-500/30'
                  : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">Warning</span>
                  <span className="font-mono text-[10px] font-extrabold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.2 rounded">-23 s/d -27</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-amber-900 dark:text-amber-100">{opticalStats.warning}</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">{opticalStats.warningPct}%</span>
                </div>
              </button>

              {/* 4. Kritis */}
              <button
                type="button"
                onClick={() => { setOnuStatusFilter(prev => prev === 'critical' ? 'all' : 'critical'); setRegisteredPage(1); }}
                className={`p-3.5 rounded-xl text-left transition-all relative border ${onuStatusFilter === 'critical'
                  ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-500 shadow-sm ring-2 ring-rose-500/30'
                  : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-800 dark:text-rose-300">Kritis</span>
                  <span className="font-mono text-[10px] font-extrabold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.2 rounded">&lt; -27 dBm</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-rose-900 dark:text-rose-100">{opticalStats.critical}</span>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">{opticalStats.criticalPct}%</span>
                </div>
              </button>

              {/* 5. LOS / Offline */}
              <button
                type="button"
                onClick={() => { setOnuStatusFilter(prev => prev === 'los' ? 'all' : 'los'); setRegisteredPage(1); }}
                className={`p-3.5 rounded-xl text-left transition-all relative border ${onuStatusFilter === 'los'
                  ? 'bg-slate-200 dark:bg-slate-800 border-slate-500 shadow-sm ring-2 ring-slate-500/30'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-300">LOS / Offline</span>
                  <span className="font-mono text-[10px] font-extrabold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded">Mati / Putus</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{opticalStats.los}</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">{opticalStats.losPct}%</span>
                </div>
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              NAVIGASI TAB KATEGORI ONU & AUDIT DATA TERPUTUS
          ══════════════════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Tab 1: Semua ONU Terdaftar */}
              <button
                onClick={() => setTableSectionTab('registered')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                  tableSectionTab === 'registered'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Daftar Semua ONU Terdaftar</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  tableSectionTab === 'registered'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}>
                  {oltData.onu_list?.length ?? 0}
                </span>
              </button>

              {/* Tab 2: ONU Fisik Terdeteksi */}
              <button
                onClick={() => setTableSectionTab('unregistered')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                  tableSectionTab === 'unregistered'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>ONU Fisik Terdeteksi (Belum Terdaftar)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  tableSectionTab === 'unregistered'
                    ? 'bg-white/20 text-white'
                    : (oltData.unconfigured_onus?.length > 0
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
                }`}>
                  {oltData.unconfigured_onus?.length ?? 0}
                </span>
              </button>

              {/* Tab 3: Data Terputus / Tidak di OLT (Decommissioned) */}
              <button
                onClick={() => setTableSectionTab('orphaned')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                  tableSectionTab === 'orphaned'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40'
                }`}
              >
                <span>Data Terputus / Tidak di OLT</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  tableSectionTab === 'orphaned'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                }`}>
                  {oltData.orphaned_onus?.length ?? 0} Perlu Pembersihan
                </span>
              </button>
            </div>

            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-3 py-1">
              {tableSectionTab === 'orphaned' ? 'Modus Audit Sinkronisasi OLT' : 'Monitoring Telemetri OLT'}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TABEL 1: ONU FISIK TERDETEKSI DI OLT (BELUM TERDAFTAR)
          ══════════════════════════════════════════════════════════════════ */}
          {tableSectionTab === 'unregistered' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-0 animate-in fade-in duration-150">
              {/* Header & Filter Bar */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                        ONU Fisik Terdeteksi di OLT (Belum Terdaftar)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                        {oltData.unconfigured_onus?.length ?? 0} Menunggu Registrasi
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Menampilkan {filteredUnregisteredOnus.length} dari total {oltData.unconfigured_onus?.length ?? 0} modem fisik yang tersambung ke port PON OLT namun belum diregistrasikan ke data pelanggan UNMS
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPortFilter && (
                      <button
                        onClick={() => fetchPortOnus(selectedPortFilter, true)}
                        disabled={loadingPortOnus}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                        title={`Kirim permintaan query SNMP langsung ke OLT untuk Port [ ${formatShortPort(selectedPortFilter)} ] detik ini juga`}
                      >
                        {loadingPortOnus ? (
                          <>
                            <Spinner />
                            <span>Membaca OLT Fisik...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync Live Fisik Port (SNMP)</span>
                          </>
                        )}
                      </button>
                    )}
                    {selectedPortFilter && (
                      <button
                        onClick={() => { setSelectedPortFilter(null); setUnregisteredPage(1); }}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
                        title="Tampilkan kembali seluruh ONU dari semua port OLT"
                      >
                        <IconX />
                        <span>Tampilkan Semua Port ({oltData.unconfigured_onus?.length ?? 0})</span>
                      </button>
                    )}
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      Live Physical OLT Discovery
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      value={unregisteredSearchQuery}
                      onChange={e => { setUnregisteredSearchQuery(e.target.value); setUnregisteredPage(1); }}
                      placeholder="Cari MAC Address, Serial Number, Nama OLT, atau Port..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    {unregisteredSearchQuery && (
                      <button onClick={() => { setUnregisteredSearchQuery(''); setUnregisteredPage(1); }} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold">✕</button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-1">Status:</span>
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Semua ({filteredUnregisteredOnus.length})
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop Table View (hidden on mobile md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">#</th>
                      <th className="px-5 py-3.5">Nama Perangkat di OLT</th>
                      <th className="px-5 py-3.5">Port Interface</th>
                      <th className="px-5 py-3.5">MAC Address / SN</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Redaman Rx Power</th>
                      <th className="px-5 py-3.5">Tipe / Model</th>
                      <th className="px-5 py-3.5">Waktu Terdaftar</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedUnregisteredOnus.length > 0 ? (
                      paginatedUnregisteredOnus.map((onu, idx) => {
                        const globalIndex = (unregisteredPage - 1) * unregisteredPerPage + idx + 1;
                        const isOffline = onu.status !== 'Online' || onu.rx_power === null || onu.rx_power <= -40;
                        return (
                          <tr key={onu.serial_number || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-semibold">{globalIndex}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                              {onu.onu_name || 'ONU Tanpa Nama'}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                              {formatShortPort(onu.detected_port)}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-400">
                              {onu.mac_address || onu.serial_number}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                }`}>
                                {onu.status || 'Online'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-bold">
                              {isOffline ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  Loss (-∞ dBm)
                                </span>
                              ) : onu.rx_power < -27 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  {onu.rx_power} dBm
                                </span>
                              ) : onu.rx_power < -24 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  {onu.rx_power} dBm
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {onu.rx_power} dBm
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-xs">
                              {onu.vendor_model || 'HGU EPON'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-xs">
                              {onu.register_time || onu.detected_at || 'Baru Saja'}
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-2">
                              <button
                                onClick={() => setSelectedOnuForOptical({
                                  ...onu,
                                  customer_name: onu.onu_name || 'ONU Belum Terdaftar',
                                  port: onu.detected_port,
                                })}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                                title="Query live optical diagnostic data via SNMP"
                              >
                                <span>Cek Power (SNMP)</span>
                              </button>
                              <a
                                href={`/customers?new=1&onu_sn=${encodeURIComponent(onu.serial_number || onu.mac_address)}&port=${encodeURIComponent(onu.detected_port || '')}&onu_name=${encodeURIComponent(onu.onu_name || '')}`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                              >
                                <span>Registrasikan</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    ) : loadingPortOnus ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">Memuat Data ONU Port {selectedPortFilter ? formatShortPort(selectedPortFilter) : ''}...</div>
                            <div className="text-xs text-slate-400">Mengambil data telemetri optik via SNMP On-Demand</div>
                          </div>
                        </td>
                      </tr>
                    ) : !selectedPortFilter ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-1">
                              <IconRouter />
                            </div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">Pilih Port PON untuk Memuat ONU</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Klik salah satu port PON pada visual chassis OLT di atas untuk memuat daftar ONU secara realtime (*On-Demand Lazy Loading*).
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                          Tidak ada ONU belum terdaftar pada Port {formatShortPort(selectedPortFilter)}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (block on mobile md:hidden) */}
              <div className="block md:hidden p-4 space-y-4">
                {paginatedUnregisteredOnus.length > 0 ? (
                  paginatedUnregisteredOnus.map((onu, idx) => {
                    const globalIndex = (unregisteredPage - 1) * unregisteredPerPage + idx + 1;
                    const isOffline = onu.status !== 'Online' || onu.rx_power === null || onu.rx_power <= -40;
                    return (
                      <div key={onu.serial_number || idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                          {/* Row 1: # Index */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                            <span className="text-slate-400 font-semibold">#</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800 dark:text-slate-200">{globalIndex}</span>
                          </div>

                          {/* Row 2: Nama ONU */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Nama ONU</span>
                            <span className="col-span-2 font-bold text-slate-900 dark:text-white uppercase">
                              {onu.onu_name || 'ONU Tanpa Nama'}
                            </span>
                          </div>

                          {/* Row 3: Port Interface */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Port Interface</span>
                            <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {formatShortPort(onu.detected_port)}
                            </span>
                          </div>

                          {/* Row 4: MAC / SN */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">MAC / SN</span>
                            <span className="col-span-2 font-mono text-slate-700 dark:text-slate-300">
                              {onu.mac_address || onu.serial_number}
                            </span>
                          </div>

                          {/* Row 5: Status */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Status</span>
                            <span className="col-span-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                }`}>
                                {onu.status || 'Online'}
                              </span>
                            </span>
                          </div>

                          {/* Row 6: Redaman Rx */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Redaman Rx</span>
                            <span className="col-span-2 font-mono font-bold">
                              {isOffline ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                  Loss (-∞ dBm)
                                </span>
                              ) : onu.rx_power < -27 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">{onu.rx_power} dBm</span>
                              ) : onu.rx_power < -24 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">{onu.rx_power} dBm</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{onu.rx_power} dBm</span>
                              )}
                            </span>
                          </div>

                          {/* Row 7: Model & Waktu */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Tipe / Model</span>
                            <span className="col-span-2 text-slate-700 dark:text-slate-300">
                              {onu.vendor_model || 'HGU EPON'} · <span className="text-[11px] text-slate-400">{onu.register_time || onu.detected_at || 'Baru Saja'}</span>
                            </span>
                          </div>

                          {/* Row 8: Aksi */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-3 items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="text-slate-400 font-semibold">Aksi</span>
                            <div className="col-span-2 flex items-center gap-2">
                              <button
                                onClick={() => setSelectedOnuForOptical({
                                  ...onu,
                                  customer_name: onu.onu_name || 'ONU Belum Terdaftar',
                                  port: onu.detected_port,
                                })}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs hover:bg-indigo-100"
                              >
                                Cek Power
                              </button>
                              <a
                                href={`/customers?new=1&onu_sn=${encodeURIComponent(onu.serial_number || onu.mac_address)}&port=${encodeURIComponent(onu.detected_port || '')}&onu_name=${encodeURIComponent(onu.onu_name || '')}`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              >
                                Registrasikan
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : loadingPortOnus ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat data Port {selectedPortFilter ? formatShortPort(selectedPortFilter) : ''}...</span>
                  </div>
                ) : !selectedPortFilter ? (
                  <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Pilih Port PON</span>
                    <span>Klik salah satu port PON di atas untuk memuat daftar ONU secara realtime.</span>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Tidak ada ONU belum terdaftar pada Port {formatShortPort(selectedPortFilter)}.
                  </div>
                )}
              </div>

              {/* Table 1 Pagination Bar */}
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(unregisteredPage - 1) * unregisteredPerPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(unregisteredPage * unregisteredPerPage, filteredUnregisteredOnus.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredUnregisteredOnus.length}</span> modem fisik
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUnregisteredPage(p => Math.max(1, p - 1))}
                    disabled={unregisteredPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                    Halaman {unregisteredPage} dari {totalUnregisteredPages}
                  </span>
                  <button
                    onClick={() => setUnregisteredPage(p => Math.min(totalUnregisteredPages, p + 1))}
                    disabled={unregisteredPage === totalUnregisteredPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TABEL 2: DAFTAR SEMUA ONU TERDAFTAR (REGISTERED)
          ══════════════════════════════════════════════════════════════════ */}
          {tableSectionTab === 'registered' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-0 animate-in fade-in duration-150">
              {/* Header & Filter Bar */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                      {selectedPortFilter
                        ? `Daftar ONU Filtered Port [ ${formatShortPort(selectedPortFilter)} ]`
                        : `Daftar Semua ONU Terdaftar — ${activeOlt?.name}`}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Menampilkan {filteredOnus.length} dari total {oltData.onu_list?.length ?? 0} ONU terdaftar
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Export CSV Button */}
                    <button
                      onClick={() => {
                        const headers = ['No', 'Customer Name', 'Port', 'Serial Number', 'Status', 'Rx Power (dBm)', 'Distance (m)', 'IP Address'];
                        const rows = filteredOnus.map((o, idx) => [
                          idx + 1,
                          `"${o.customer_name || ''}"`,
                          `"${o.port || ''}"`,
                          `"${o.serial_number || ''}"`,
                          `"${o.status || ''}"`,
                          o.rx_power || '',
                          o.distance_meters || '',
                          `"${o.ip_address || ''}"`,
                        ]);
                        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement('a');
                        link.setAttribute('href', encodedUri);
                        link.setAttribute('download', `ONU_Performance_${activeOlt?.name || 'OLT'}_${new Date().toISOString().slice(0, 10)}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
                      title="Download laporan performa optik CSV"
                    >
                      <span>📥 Export CSV</span>
                    </button>

                    {selectedPortFilter && (
                      <button
                        onClick={() => fetchPortOnus(selectedPortFilter, true)}
                        disabled={loadingPortOnus}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                        title={`Kirim permintaan query SNMP langsung ke OLT untuk Port [ ${formatShortPort(selectedPortFilter)} ] detik ini juga`}
                      >
                        {loadingPortOnus ? (
                          <>
                            <Spinner />
                            <span>Membaca OLT Fisik...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync Live Fisik Port (SNMP)</span>
                          </>
                        )}
                      </button>
                    )}
                    {selectedPortFilter && (
                      <button
                        onClick={() => { setSelectedPortFilter(null); setRegisteredPage(1); }}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
                        title="Tampilkan kembali seluruh ONU dari semua port OLT"
                      >
                        <IconX />
                        <span>Tampilkan Semua Port ({oltData.onu_list?.length ?? 0})</span>
                      </button>
                    )}
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {oltData.device_info?._source === 'live_snmp' ? 'Live SNMP Telemetry' : 'Realtime Database UNMS'}
                    </span>
                  </div>
                </div>

                {/* Search Bar & Quick Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      value={onuSearchQuery}
                      onChange={e => { setOnuSearchQuery(e.target.value); setRegisteredPage(1); }}
                      placeholder="Cari Pelanggan, Serial Number (SN), Port, atau IP..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    {onuSearchQuery && (
                      <button onClick={() => { setOnuSearchQuery(''); setRegisteredPage(1); }} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold">✕</button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: 'all', label: 'Semua Status' },
                      { id: 'online', label: 'Online' },
                      { id: 'los', label: 'Offline / LOS' },
                      { id: 'excellent', label: '🟢 > -19 dBm' },
                      { id: 'good', label: '🟢 -19 s/d -23' },
                      { id: 'warning', label: '🟡 -23 s/d -27' },
                      { id: 'critical', label: '🔴 < -27 dBm' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setOnuStatusFilter(f.id); setRegisteredPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${onuStatusFilter === f.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop Table View (hidden on mobile md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">#</th>
                      <th className="px-5 py-3.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleSort('customer_name')}>
                        <span>Nama Pelanggan</span>
                        <SortIcon field="customer_name" currentField={sortField} direction={sortDirection} />
                      </th>
                      <th className="px-5 py-3.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleSort('port')}>
                        <span>Port Interface</span>
                        <SortIcon field="port" currentField={sortField} direction={sortDirection} />
                      </th>
                      <th className="px-5 py-3.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleSort('serial_number')}>
                        <span>Serial Number</span>
                        <SortIcon field="serial_number" currentField={sortField} direction={sortDirection} />
                      </th>
                      <th className="px-5 py-3.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleSort('status')}>
                        <span>Status</span>
                        <SortIcon field="status" currentField={sortField} direction={sortDirection} />
                      </th>
                      <th className="px-5 py-3.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleSort('rx_power')}>
                        <span>Redaman Rx Power</span>
                        <SortIcon field="rx_power" currentField={sortField} direction={sortDirection} />
                      </th>
                      <th className="px-5 py-3.5 text-right">Aksi Telemetri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedRegisteredOnus.length > 0 ? (
                      paginatedRegisteredOnus.map((onu, idx) => {
                        const globalIndex = (registeredPage - 1) * registeredPerPage + idx + 1;
                        return (
                          <tr key={onu.serial_number || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-semibold">{globalIndex}</td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white">{onu.customer_name}</div>
                              {onu.customer_number && (
                                <div className="text-[11px] font-mono text-slate-400">{onu.customer_number}</div>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{formatShortPort(onu.port)}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300 font-bold">{onu.serial_number}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                }`}>{onu.status === 'Online' ? 'Online' : 'Offline'}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <SignalStrengthMeter rxPower={onu.rx_power} status={onu.status} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedOnuForOptical(onu)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs group"
                                title="Buka detail telemetri optik lengkap"
                              >
                                <IconNetwork />
                                <span>Detail ONU</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : loadingPortOnus ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">Sinkronisasi SNMP Fisik Port {selectedPortFilter ? formatShortPort(selectedPortFilter) : ''}...</div>
                            <div className="text-xs text-slate-400">Mengambil data telemetri optik live langsung ke hardware OLT</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto text-slate-500">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {selectedPortFilter
                                ? `Tidak ada ONU terdaftar pada Port ${formatShortPort(selectedPortFilter)}`
                                : 'Belum ada data ONU terdaftar pada OLT ini'}
                            </span>
                            <span className="text-xs text-slate-400">
                              {selectedPortFilter
                                ? 'Pilih port PON lain atau tekan tombol "Refresh / Sync Port" untuk memindai fisik OLT.'
                                : 'Silakan daftarkan pelanggan atau registrasikan modem dari tab Belum Terdaftar.'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (block on mobile md:hidden) */}
              <div className="block md:hidden p-4 space-y-4">
                {paginatedRegisteredOnus.length > 0 ? (
                  paginatedRegisteredOnus.map((onu, idx) => {
                    const globalIndex = (registeredPage - 1) * registeredPerPage + idx + 1;
                    const isOffline = onu.status !== 'Online' || onu.rx_power === null || onu.rx_power <= -40;
                    return (
                      <div key={onu.serial_number || idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                          {/* Row 1: # Index */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                            <span className="text-slate-400 font-semibold">#</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800 dark:text-slate-200">{globalIndex}</span>
                          </div>

                          {/* Row 2: Nama Pelanggan */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Nama Pelanggan</span>
                            <span className="col-span-2 font-bold text-slate-900 dark:text-white uppercase">
                              {onu.customer_name}
                            </span>
                          </div>

                          {/* Row 3: Port Interface */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Port Interface</span>
                            <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {formatShortPort(onu.port)}
                            </span>
                          </div>

                          {/* Row 4: Serial Number */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Serial Number</span>
                            <span className="col-span-2 font-mono text-slate-700 dark:text-slate-300">
                              {onu.serial_number}
                            </span>
                          </div>

                          {/* Row 5: Status */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Status</span>
                            <span className="col-span-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                }`}>
                                {onu.status === 'Online' ? 'Online' : 'Offline'}
                              </span>
                            </span>
                          </div>

                          {/* Row 6: Redaman Rx */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Redaman Rx</span>
                            <div className="col-span-2">
                              <SignalStrengthMeter rxPower={onu.rx_power} status={onu.status} />
                            </div>
                          </div>

                          {/* Row 7: Jarak & IP */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Jarak &amp; IP</span>
                            <span className="col-span-2 text-slate-700 dark:text-slate-300">
                              {onu.distance_meters ? `${onu.distance_meters} m` : '—'} · <span className="font-mono text-[11px] text-slate-500">{maskIpAddress(onu.ip_address)}</span>
                            </span>
                          </div>

                          {/* Row 8: Aksi */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-3 items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="text-slate-400 font-semibold">Aksi</span>
                            <div className="col-span-2 flex items-center gap-2">
                              <button
                                onClick={() => setSelectedOnuForOptical(onu)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center gap-1.5"
                              >
                                <IconNetwork />
                                <span>Detail ONU</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : loadingPortOnus ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Sinkronisasi Live SNMP Port {selectedPortFilter ? formatShortPort(selectedPortFilter) : ''}...</span>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    {selectedPortFilter
                      ? `Tidak ada ONU terdaftar pada Port ${formatShortPort(selectedPortFilter)}.`
                      : 'Belum ada data ONU terdaftar pada OLT ini.'}
                  </div>
                )}
              </div>

              {/* Table 2 Pagination Bar */}
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(registeredPage - 1) * registeredPerPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(registeredPage * registeredPerPage, filteredOnus.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredOnus.length}</span> ONU terdaftar
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRegisteredPage(p => Math.max(1, p - 1))}
                    disabled={registeredPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                    Halaman {registeredPage} dari {totalRegisteredPages}
                  </span>
                  <button
                    onClick={() => setRegisteredPage(p => Math.min(totalRegisteredPages, p + 1))}
                    disabled={registeredPage === totalRegisteredPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TABEL 3: DATA TERPUTUS / TIDAK DI OLT (DECOMMISSIONED & ORPHANED)
          ══════════════════════════════════════════════════════════════════ */}
          {tableSectionTab === 'orphaned' && (
            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-xs overflow-hidden space-y-0 animate-in fade-in duration-150">
              {/* Header & Batch Actions Bar */}
              <div className="p-5 sm:p-6 border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-rose-950 dark:text-rose-200 text-lg">
                        Data Pelanggan / ONU Terputus (Tidak Ditemukan di OLT)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-2xs">
                        {oltData.orphaned_onus?.length ?? 0} Perlu Pembersihan
                      </span>
                    </div>
                    <p className="text-xs text-rose-700/80 dark:text-rose-300/70 mt-0.5">
                      Daftar modem yang terdaftar di database UNMS namun <strong>sudah tidak ada di OLT fisik</strong> (misal pelanggan berhenti berlangganan). Hapus data ini untuk membebaskan port ODP dan mencegah penumpukan data.
                    </p>
                  </div>

                  {/* Batch Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedOrphanedIds.length > 0 && (
                      <button
                        onClick={() => handleBulkDeleteOrphaned()}
                        disabled={isDeletingOrphaned}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>Hapus Terpilih ({selectedOrphanedIds.length})</span>
                      </button>
                    )}

                    {filteredOrphanedOnus.length > 0 && (
                      <button
                        onClick={() => handleBulkDeleteOrphaned(filteredOrphanedOnus.map(o => o.id))}
                        disabled={isDeletingOrphaned}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>Bersihkan Semua ({filteredOrphanedOnus.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      value={orphanedSearchQuery}
                      onChange={e => { setOrphanedSearchQuery(e.target.value); setOrphanedPage(1); }}
                      placeholder="Cari Nama Pelanggan, Kode, Serial Number, atau ODP..."
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                    {orphanedSearchQuery && (
                      <button onClick={() => { setOrphanedSearchQuery(''); setOrphanedPage(1); }} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold">✕</button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedOrphanedIds.length === paginatedOrphanedOnus.length) {
                          setSelectedOrphanedIds([]);
                        } else {
                          setSelectedOrphanedIds(paginatedOrphanedOnus.map(o => o.id));
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors"
                    >
                      {selectedOrphanedIds.length === paginatedOrphanedOnus.length && paginatedOrphanedOnus.length > 0 ? 'Batalkan Pilihan' : 'Pilih Semua di Halaman Ini'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Table View (hidden on mobile md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-rose-100/50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-xs uppercase font-bold text-rose-900 dark:text-rose-300 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedOrphanedOnus.length > 0 && paginatedOrphanedOnus.every(o => selectedOrphanedIds.includes(o.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pageIds = paginatedOrphanedOnus.map(o => o.id);
                              setSelectedOrphanedIds(prev => Array.from(new Set([...prev, ...pageIds])));
                            } else {
                              const pageIds = paginatedOrphanedOnus.map(o => o.id);
                              setSelectedOrphanedIds(prev => prev.filter(id => !pageIds.includes(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-5 py-3.5">#</th>
                      <th className="px-5 py-3.5">Nama Pelanggan / ID</th>
                      <th className="px-5 py-3.5">ODP &amp; Port</th>
                      <th className="px-5 py-3.5">Serial Number / MAC</th>
                      <th className="px-5 py-3.5">Status &amp; Indikasi</th>
                      <th className="px-5 py-3.5">Terakhir Terdaftar</th>
                      <th className="px-5 py-3.5 text-right">Aksi Pembersihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/60 dark:divide-rose-950/40">
                    {paginatedOrphanedOnus.length > 0 ? (
                      paginatedOrphanedOnus.map((onu, idx) => {
                        const globalIndex = (orphanedPage - 1) * orphanedPerPage + idx + 1;
                        const isChecked = selectedOrphanedIds.includes(onu.id);
                        return (
                          <tr key={onu.id} className={`hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors ${isChecked ? 'bg-rose-50/70 dark:bg-rose-950/50' : ''}`}>
                            <td className="px-5 py-3.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedOrphanedIds(prev =>
                                    prev.includes(onu.id) ? prev.filter(id => id !== onu.id) : [...prev, onu.id]
                                  );
                                }}
                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-semibold">{globalIndex}</td>
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-slate-900 dark:text-white">{onu.customer_name}</p>
                              <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                                {onu.customer_number}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                  {onu.odp_name}
                                </span>
                                <p className="text-[11px] font-mono text-slate-500">{onu.odp_port}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {onu.onu_serial || '—'}
                                </span>
                                {onu.onu_mac && (
                                  <p className="font-mono text-[10px] text-slate-500">MAC: {onu.onu_mac}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                Tidak Ditemukan di OLT (Terputus)
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                              {onu.registered_at}
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-2">
                              {onu.customer_id && (
                                <a
                                  href={`/customers?id=${onu.customer_id}`}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-block"
                                >
                                  Pelanggan
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteOrphaned(onu)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-2xs"
                                title="Hapus data ONU ini dan bebaskan port ODP"
                              >
                                Hapus dari UNMS
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                          Bersih! Seluruh data ONU di database UNMS sinkron dengan perangkat OLT.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (block on mobile md:hidden) */}
              <div className="block md:hidden p-4 space-y-4">
                {paginatedOrphanedOnus.length > 0 ? (
                  paginatedOrphanedOnus.map((onu, idx) => {
                    const globalIndex = (orphanedPage - 1) * orphanedPerPage + idx + 1;
                    const isChecked = selectedOrphanedIds.includes(onu.id);
                    return (
                      <div key={onu.id} className={`bg-white dark:bg-slate-900 rounded-2xl border ${isChecked ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-rose-200 dark:border-rose-900/60'} shadow-xs overflow-hidden`}>
                        <div className="divide-y divide-rose-100 dark:divide-rose-950/40 text-xs">
                          {/* Row 1: Checkbox & # Index */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50/70 dark:bg-rose-950/40">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedOrphanedIds(prev =>
                                    prev.includes(onu.id) ? prev.filter(id => id !== onu.id) : [...prev, onu.id]
                                  );
                                }}
                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                              />
                              <span className="font-bold text-rose-950 dark:text-rose-200">Pilih Data</span>
                            </label>
                            <span className="font-mono font-bold text-slate-500">#{globalIndex}</span>
                          </div>

                          {/* Row 2: Nama Pelanggan */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Pelanggan</span>
                            <span className="col-span-2 font-bold text-slate-900 dark:text-white uppercase">
                              {onu.customer_name} <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold block text-[11px]">{onu.customer_number}</span>
                            </span>
                          </div>

                          {/* Row 3: ODP & Port */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">ODP &amp; Port</span>
                            <span className="col-span-2 font-bold text-slate-800 dark:text-slate-200">
                              {onu.odp_name} <span className="text-indigo-600 dark:text-indigo-400 font-mono">({onu.odp_port})</span>
                            </span>
                          </div>

                          {/* Row 4: Serial Number */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Serial Number</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {onu.onu_serial || onu.onu_mac}
                            </span>
                          </div>

                          {/* Row 5: Status Indikasi */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Indikasi</span>
                            <span className="col-span-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                Tidak di OLT (Terputus)
                              </span>
                            </span>
                          </div>

                          {/* Row 6: Aksi */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-3 items-center bg-rose-50/40 dark:bg-rose-950/20">
                            <span className="text-slate-400 font-semibold">Aksi</span>
                            <div className="col-span-2 flex items-center gap-2">
                              {onu.customer_id && (
                                <a
                                  href={`/customers?id=${onu.customer_id}`}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                                >
                                  Pelanggan
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteOrphaned(onu)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                              >
                                Hapus dari UNMS
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-emerald-600 text-xs font-bold">
                    Bersih! Seluruh data ONU di database UNMS sinkron dengan perangkat OLT.
                  </div>
                )}
              </div>

              {/* Table 3 Pagination Bar */}
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(orphanedPage - 1) * orphanedPerPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(orphanedPage * orphanedPerPage, filteredOrphanedOnus.length)}</span> dari total <span className="font-bold text-rose-600 dark:text-rose-400">{filteredOrphanedOnus.length}</span> data terputus
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOrphanedPage(p => Math.max(1, p - 1))}
                    disabled={orphanedPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                    Halaman {orphanedPage} dari {totalOrphanedPages}
                  </span>
                  <button
                    onClick={() => setOrphanedPage(p => Math.min(totalOrphanedPages, p + 1))}
                    disabled={orphanedPage === totalOrphanedPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              BAGIAN PALING BAWAH: TOPOLOGI PASIF (ODC & ODP) UNTUK PORT TERPILIH
          ══════════════════════════════════════════════════════════════════ */}
          {selectedPortFilter && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base flex items-center gap-2">
                    <IconNetwork />
                    <span>Topologi Pasif (ODC &amp; ODP) — Port {formatShortPort(selectedPortFilter)}</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Perangkat ODC dan ODP yang mendistribusikan sinyal optik dari port ini ke pelanggan
                  </p>
                </div>
              </div>

              {(() => {
                const portOdcs = oltTopology.filter(o => {
                  if (!o.olt_port_ref) return false;
                  const targetClean = selectedPortFilter.replace(/^gpon[-_]olt_|^epon[-_]olt_/i, '');
                  const refs = o.olt_port_ref.split(',').map(r => r.trim().replace(/^gpon[-_]olt_|^epon[-_]olt_/i, ''));
                  return refs.some(r => r === targetClean || r === selectedPortFilter || `gpon-olt_${r}` === selectedPortFilter || `epon-olt_${r}` === selectedPortFilter);
                });
                if (portOdcs.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 font-medium">
                      Belum ada ODC terhubung yang dikonfigurasi untuk port {formatShortPort(selectedPortFilter)}.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portOdcs.map(odc => (
                      <div key={odc.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {odc.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {odc.used_ports}/{odc.total_ports} Port Terisi
                          </span>
                        </div>

                        {odc.parent_node && (
                          <p className="text-xs text-slate-600 dark:text-slate-400"> POP Induk: <strong className="text-slate-950 dark:text-white font-bold">{odc.parent_node.name}</strong></p>
                        )}

                        {odc.odps && odc.odps.length > 0 ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                              ODP Terhubung ({odc.odps.length} ODP)
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {odc.odps.map(odp => (
                                <div key={odp.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs shadow-2xs">
                                  <p className="font-bold text-slate-950 dark:text-white truncate">{odp.name}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{odp.used_ports}/{odp.total_ports} Port</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">Belum ada ODP di bawah ODC ini</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {showConfigModal && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Konfigurasi Koneksi SNMP OLT</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-semibold text-indigo-600 dark:text-indigo-400">{activeOlt?.name} — {maskIpAddress(activeOlt?.ip_address)}</p>
              </div>
              <button onClick={() => { setShowConfigModal(false); setTestResult(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">

              {/* ── Section 1: Deployment Mode ────────────────────────────── */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span>Mode Deployment Server UNMS</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {DEPLOYMENT_MODES.map(mode => {
                    const selected = configForm.deployment_mode === mode.value;
                    return (
                      <button key={mode.value} type="button"
                        onClick={() => setConfigForm({ ...configForm, deployment_mode: mode.value })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${selected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}>
                        <div className="text-lg">{mode.icon}</div>
                        <div className={`text-xs font-bold mt-1 ${selected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{mode.label}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 leading-tight">{mode.desc}</div>
                        {selected && <div className="mt-1.5 text-indigo-600 dark:text-indigo-400"><IconCheck size="w-3.5 h-3.5" /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 2: SNMP Configuration ───────────────────────────── */}
              {configForm.deployment_mode !== 'probe' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                    <span>Kredensial &amp; Protokol SNMP (Pure Data Polling)</span>
                  </h4>

                  {/* SNMP Version: v2c / v3 */}
                  <div>
                    <label className={labelCls}>Versi SNMP</label>
                    <div className="flex space-x-3">
                      {['v2c', 'v3'].map(v => (
                        <button key={v} type="button"
                          onClick={() => setConfigForm({ ...configForm, snmp_version: v })}
                          className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${configForm.snmp_version === v
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500'
                            }`}>
                          SNMP {v.toUpperCase()}
                          <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                            {v === 'v2c' ? 'Community String (Standar)' : 'Username + Auth/Priv (Enkripsi)'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SNMPv2c fields */}
                  {configForm.snmp_version === 'v2c' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Community String</label>
                        <div className="flex space-x-3">
                          {['public', 'custom'].map(ct => (
                            <button key={ct} type="button"
                              onClick={() => setConfigForm({ ...configForm, snmp_community_type: ct })}
                              className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${configForm.snmp_community_type === ct
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500'
                                }`}>
                              {ct === 'public' ? ' public (default)' : ' Custom String'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {configForm.snmp_community_type === 'custom' && (
                        <div>
                          <label className={labelCls}>Custom Community String</label>
                          <input type="text" value={configForm.snmp_community}
                            onChange={e => setConfigForm({ ...configForm, snmp_community: e.target.value })}
                            placeholder="Masukkan community string (misal: noc_fiber_unms)..."
                            className={inputCls} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* SNMPv3 fields */}
                  {configForm.snmp_version === 'v3' && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Kredensial SNMPv3 (AuthPriv)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Username</label>
                          <input type="text" value={configForm.snmp_v3_username}
                            onChange={e => setConfigForm({ ...configForm, snmp_v3_username: e.target.value })}
                            placeholder="snmp_user" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Auth Protocol</label>
                          <select value={configForm.snmp_v3_auth_protocol}
                            onChange={e => setConfigForm({ ...configForm, snmp_v3_auth_protocol: e.target.value })}
                            className={inputCls}>
                            <option value="SHA">SHA (Recommended)</option>
                            <option value="MD5">MD5</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Auth Password</label>
                          <input type="password" value={configForm.snmp_v3_auth_password}
                            onChange={e => setConfigForm({ ...configForm, snmp_v3_auth_password: e.target.value })}
                            placeholder="Min. 8 karakter" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Privacy Protocol</label>
                          <select value={configForm.snmp_v3_priv_protocol}
                            onChange={e => setConfigForm({ ...configForm, snmp_v3_priv_protocol: e.target.value })}
                            className={inputCls}>
                            <option value="AES">AES (Recommended)</option>
                            <option value="DES">DES</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Privacy Password</label>
                          <input type="password" value={configForm.snmp_v3_priv_password}
                            onChange={e => setConfigForm({ ...configForm, snmp_v3_priv_password: e.target.value })}
                            placeholder="Min. 8 karakter" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tuning SNMP Port, Timeout & Polling Interval */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className={labelCls}>Port UDP SNMP</label>
                      <input type="number" value={configForm.snmp_port}
                        onChange={e => setConfigForm({ ...configForm, snmp_port: parseInt(e.target.value) || 161 })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Timeout (detik)</label>
                      <input type="number" value={configForm.snmp_timeout}
                        onChange={e => setConfigForm({ ...configForm, snmp_timeout: parseInt(e.target.value) || 3 })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Interval Polling (detik)</label>
                      <input type="number" value={configForm.polling_interval_seconds || 60}
                        onChange={e => setConfigForm({ ...configForm, polling_interval_seconds: parseInt(e.target.value) || 60 })}
                        className={inputCls} />
                    </div>
                  </div>

                  {/* Quick Presets for Polling Interval */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-1">Preset Rekomendasi:</span>
                    {[
                      { label: '⚡ 30s (Cepat / <200 ONU)', val: 30 },
                      { label: '⏱️ 60s (Standar)', val: 60 },
                      { label: '🛡️ 120s (Aman ZTE C300 / 2000 ONU)', val: 120 },
                      { label: '🐢 300s (5 Menit)', val: 300 },
                    ].map((pr) => (
                      <button
                        key={pr.val}
                        type="button"
                        onClick={() => setConfigForm({ ...configForm, polling_interval_seconds: pr.val })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          (configForm.polling_interval_seconds || 60) === pr.val
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Copy Scripts for OLT SNMP */}
                  <QuickCopyScripts
                    vendor={activeOlt?.vendor}
                    community={configForm.snmp_community_type === 'custom' ? configForm.snmp_community : 'public'}
                  />
                </div>
              )}

              {/* ── Section 3: Probe Agent ─────────────────────────────────── */}
              {configForm.deployment_mode === 'probe' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                    <span>Konfigurasi NMS Probe Agent</span>
                  </h4>
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-400 font-medium space-y-1">
                    <div className="font-bold">Cara kerja Probe Agent:</div>
                    <div>1. Install NMS Probe Agent di server dalam jaringan ISP (akses ke OLT)</div>
                    <div>2. Probe Agent akan menjembatani query SNMP dari cloud UNMS ke OLT</div>
                    <div>3. Masukkan URL dan token API Probe Agent di bawah</div>
                  </div>
                  <div>
                    <label className={labelCls}>URL Probe Agent</label>
                    <input type="url" value={configForm.probe_agent_url}
                      onChange={e => setConfigForm({ ...configForm, probe_agent_url: e.target.value })}
                      placeholder="https://probe.isp-anda.com:8080" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>API Token Probe Agent</label>
                    <input type="password" value={configForm.probe_agent_token}
                      onChange={e => setConfigForm({ ...configForm, probe_agent_token: e.target.value })}
                      placeholder="Token rahasia dari Probe Agent" className={inputCls} />
                  </div>
                </div>
              )}

              {/* ── Testing Indicator ──────────────────────────────────────── */}
              {testingConnection && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Sedang Menguji Koneksi SNMP...</div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Ping ICMP → Query SNMP sysDescr MIB</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-indigo-600 dark:text-indigo-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Target: <span className="font-mono font-bold">{activeOlt?.ip_address}</span></span>
                    <span className="text-indigo-300 dark:text-indigo-600">|</span>
                    <span>SNMP: <span className="font-bold">{configForm.snmp_version?.toUpperCase()}</span></span>
                  </div>
                </div>
              )}

              {/* ── Test Connection Result ─────────────────────────────────── */}
              {!testingConnection && testResult && (() => {
                const isSuccess = testResult.ready_for_live;
                const isPartial = !isSuccess && testResult.ping?.success;

                const statusConfig = isSuccess
                  ? { bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-300 dark:border-emerald-700', badge: 'bg-emerald-500', badgeText: 'KONEKSI SNMP BERHASIL', icon: '', headerText: 'text-emerald-800 dark:text-emerald-200', subText: 'text-emerald-700 dark:text-emerald-300' }
                  : isPartial
                    ? { bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-amber-300 dark:border-amber-700', badge: 'bg-amber-500', badgeText: 'PING OK · SNMP TIDAK MERESPON', icon: '', headerText: 'text-amber-800 dark:text-amber-200', subText: 'text-amber-700 dark:text-amber-300' }
                    : { bg: 'bg-rose-50 dark:bg-rose-900/15', border: 'border-rose-300 dark:border-rose-700', badge: 'bg-rose-500', badgeText: 'KONEKSI GAGAL', icon: '', headerText: 'text-rose-800 dark:text-rose-200', subText: 'text-rose-700 dark:text-rose-300' };

                return (
                  <div className={`rounded-xl border-2 ${statusConfig.bg} ${statusConfig.border} overflow-hidden`}>
                    <div className={`px-4 py-3 flex items-center justify-between ${isSuccess ? 'bg-emerald-100 dark:bg-emerald-900/30' : isPartial ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-xl leading-none">{statusConfig.icon}</span>
                        <div>
                          <div className={`text-xs font-black uppercase tracking-widest ${statusConfig.headerText}`}>{statusConfig.badgeText}</div>
                          <div className={`text-xs font-medium mt-0.5 ${statusConfig.subText}`}>{testResult.message}</div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black text-white ${statusConfig.badge} shadow-sm`}>
                        {testResult.connection_mode === 'live' ? 'LIVE' : 'SIMULASI'}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {testResult.ping && (
                          <div className={`rounded-lg p-3 border flex items-start space-x-2.5 ${testResult.ping.success ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${testResult.ping.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {testResult.ping.success ? "✓" : "✕"}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${testResult.ping.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>Ping / ICMP</div>
                              <div className={`text-xs mt-0.5 font-mono ${testResult.ping.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.ping.success ? `Merespon dalam ${testResult.ping.latency_ms} ms` : (testResult.ping.error || 'Host tidak merespon')}
                              </div>
                            </div>
                          </div>
                        )}

                        {testResult.snmp && (
                          <div className={`rounded-lg p-3 border flex items-start space-x-2.5 ${testResult.snmp.success ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${testResult.snmp.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {testResult.snmp.success ? "✓" : "✕"}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${testResult.snmp.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>Query SNMP (sysDescr)</div>
                              <div className={`text-xs mt-0.5 ${testResult.snmp.success ? 'text-emerald-600 dark:text-emerald-400 font-mono truncate max-w-[200px]' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.snmp.success ? (testResult.snmp.sys_descr || 'OK') : (testResult.snmp.error || 'SNMP tidak merespon')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {testResult.recommendations && testResult.recommendations.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200">Rekomendasi:</div>
                          {testResult.recommendations.map((r, i) => (
                            <div key={i} className="text-slate-600 dark:text-slate-400 flex items-start space-x-1.5">
                              <span className="text-indigo-500 font-bold">•</span>
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => { setShowConfigModal(false); setTestResult(null); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Tutup
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                  {savingConfig ? 'Menyimpan...' : 'Simpan Saja'}
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {testingConnection ? <><Spinner /><span>Menguji SNMP...</span></> : <><span>Uji &amp; Terapkan SNMP</span></>}
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Tambah Perangkat OLT Baru
      ══════════════════════════════════════════════════════════════════════ */}
      {showAddOltModal && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Perangkat OLT Baru</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Dukungan Multi-Vendor via SNMP (ZTE, Huawei, VSOL, HSGQ, Hioso, Tarmoc, BDCOM, FiberHome)</p>
              </div>
              <button onClick={() => setShowAddOltModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <form onSubmit={handleAddOlt} className="p-6 space-y-5 overflow-y-auto flex-1">
              
              {/* ── Section 1: Identitas & Model OLT ──────────────────────────── */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200/80 dark:border-neutral-800 pb-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Identitas &amp; Spesifikasi Perangkat OLT
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Nama OLT (Label Identifikasi)</label>
                    <input type="text" value={newOltForm.name}
                      onChange={e => setNewOltForm({ ...newOltForm, name: e.target.value })}
                      placeholder="OLT HSGQ-E04 Kantor Solok" required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Kode Node Unik</label>
                    <input type="text" value={newOltForm.code}
                      onChange={e => setNewOltForm({ ...newOltForm, code: e.target.value.toUpperCase() })}
                      placeholder="OLT-SLK-01" required
                      className={inputCls + ' uppercase font-mono'} />
                  </div>
                  <div>
                    <label className={labelCls}>Vendor &amp; Model Perangkat</label>
                    <select value={newOltForm.vendor}
                      onChange={e => {
                        const v = e.target.value;
                        const map = {
                          'ZTE': ['ZXAN C300', 16],
                          'ZTE C320': ['ZXAN C320', 8],
                          'Huawei MA5608T': ['SmartAX MA5608T', 8],
                          'Huawei MA5683T': ['SmartAX MA5683T', 16],
                          'VSOL': ['V1600G2-B', 8],
                          'HSGQ': ['G004 4-Port', 4],
                          'Hioso': ['HA7302CS', 2],
                          'Tarmoc': ['TMC-EP8', 8],
                          'FiberHome': ['AN5516-04', 16],
                          'BDCOM': ['GP3600-08', 8],
                        };
                        const [model, ports] = map[v] || ['Generic OLT', 8];
                        setNewOltForm({ ...newOltForm, vendor: v, model, total_ports: ports });
                      }}
                      className={inputCls}>
                      <option value="HSGQ">HSGQ G004 / E04 (4-Port EPON/GPON)</option>
                      <option value="ZTE">ZTE C300 (Modular 16-Port GPON)</option>
                      <option value="ZTE C320">ZTE C320 (Compact 8-Port GPON)</option>
                      <option value="Huawei MA5608T">Huawei SmartAX MA5608T (8-Port GPON)</option>
                      <option value="Huawei MA5683T">Huawei SmartAX MA5683T (16-Port GPON)</option>
                      <option value="VSOL">VSOL V1600G2-B (8-Port GPON)</option>
                      <option value="Hioso">Hioso HA7302CS (2-Port EPON)</option>
                      <option value="Tarmoc">Tarmoc TMC-EP8 (8-Port EPON)</option>
                      <option value="FiberHome">FiberHome AN5516 (16-Port GPON)</option>
                      <option value="BDCOM">BDCOM GP3600 (8-Port GPON)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Lokasi / Wilayah / POP Site</label>
                    <input type="text" value={newOltForm.location}
                      onChange={e => setNewOltForm({ ...newOltForm, location: e.target.value })}
                      placeholder="Kantor Solok (POP Solok Central)" required className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Jaringan & Terowongan VPN ───────────────────────── */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200/80 dark:border-neutral-800 pb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Jaringan &amp; Terowongan VPN
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>IP Address Manajemen OLT (Lokal)</label>
                    <input type="text" value={newOltForm.ip_address}
                      onChange={e => setNewOltForm({ ...newOltForm, ip_address: e.target.value })}
                      placeholder="192.168.100.1" required className={inputCls + ' font-mono'} />
                    <p className="text-[10px] text-slate-400 mt-1">Default HSGQ: <code>192.168.100.1</code> (dijangkau via VPN MikroTik).</p>
                  </div>
                  <div>
                    <label className={labelCls}>Mode Deployment</label>
                    <select value={newOltForm.deployment_mode}
                      onChange={e => setNewOltForm({ ...newOltForm, deployment_mode: e.target.value })}
                      className={inputCls}>
                      <option value="vpn">VPN Tunnel / L2TP MikroTik (Rekomendasi)</option>
                      <option value="direct">Direct LAN (Satu Jaringan Lokal)</option>
                      <option value="probe">Local Probe Agent (Cloud External)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Kredensial SNMP & Quick Copy Scripts ────────────── */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center space-x-2 border-b border-slate-200/80 dark:border-neutral-800 pb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Kredensial SNMP Telemetri
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Versi SNMP</label>
                    <select value={newOltForm.snmp_version}
                      onChange={e => setNewOltForm({ ...newOltForm, snmp_version: e.target.value })}
                      className={inputCls}>
                      <option value="v2c">SNMPv2c (Community String - Rekomendasi)</option>
                      <option value="v3">SNMPv3 (Username + Auth/Priv)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>SNMP Read Community String</label>
                    <div className="flex space-x-2">
                      {['public', 'custom'].map(ct => (
                        <button key={ct} type="button"
                          onClick={() => setNewOltForm({ ...newOltForm, snmp_community_type: ct })}
                          className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${newOltForm.snmp_community_type === ct
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                            }`}>
                          {ct === 'public' ? 'public (Standar)' : 'Custom'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {newOltForm.snmp_community_type === 'custom' && (
                  <div>
                    <label className={labelCls}>Custom Community String</label>
                    <input type="text" value={newOltForm.snmp_community}
                      onChange={e => setNewOltForm({ ...newOltForm, snmp_community: e.target.value })}
                      placeholder="Masukkan custom community string..." className={inputCls} />
                  </div>
                )}

                {/* Quick Copy Scripts for OLT SNMP & MikroTik VPN */}
                <QuickCopyScripts
                  vendor={newOltForm.vendor}
                  community={newOltForm.snmp_community_type === 'custom' ? newOltForm.snmp_community : 'public'}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                <button type="button" onClick={() => setShowAddOltModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={submittingOlt}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {submittingOlt ? <><Spinner /><span>Menyimpan...</span></> : <><IconPlus /><span>Simpan Perangkat OLT</span></>}
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Edit Perangkat OLT
      ══════════════════════════════════════════════════════════════════════ */}
      {showEditOltModal && editingOlt && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Perangkat OLT</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{editingOlt.name} ({editingOlt.code})</p>
              </div>
              <button onClick={() => { setShowEditOltModal(false); setEditingOlt(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <form onSubmit={handleEditOlt} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nama OLT</label>
                  <input type="text" value={editOltForm.name}
                    onChange={e => setEditOltForm({ ...editOltForm, name: e.target.value })}
                    required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Kode Node</label>
                  <input type="text" value={editOltForm.code}
                    onChange={e => setEditOltForm({ ...editOltForm, code: e.target.value.toUpperCase() })}
                    required className={inputCls + ' uppercase font-mono'} />
                </div>
                <div>
                  <label className={labelCls}>IP Address Manajemen OLT</label>
                  <input type="text" value={editOltForm.ip_address}
                    onChange={e => setEditOltForm({ ...editOltForm, ip_address: e.target.value })}
                    required className={inputCls + ' font-mono'} />
                </div>
                <div>
                  <label className={labelCls}>Vendor &amp; Tipe Perangkat</label>
                  <select value={editOltForm.vendor}
                    onChange={e => {
                      const v = e.target.value;
                      const map = {
                        'ZTE': ['ZXAN C300', 16],
                        'ZTE C320': ['ZXAN C320', 8],
                        'Huawei MA5608T': ['SmartAX MA5608T', 8],
                        'Huawei MA5683T': ['SmartAX MA5683T', 16],
                        'VSOL': ['V1600G2-B', 8],
                        'HSGQ': ['G004 4-Port', 4],
                        'Hioso': ['HA7302CS', 2],
                        'Tarmoc': ['TMC-EP8', 8],
                        'FiberHome': ['AN5516-04', 16],
                        'BDCOM': ['GP3600-08', 8],
                      };
                      const [model, ports] = map[v] || [editOltForm.model, editOltForm.total_ports];
                      setEditOltForm({ ...editOltForm, vendor: v, model, total_ports: ports });
                    }}
                    className={inputCls}>
                    <option value="ZTE">ZTE C300 (Modular 16-Port GPON)</option>
                    <option value="ZTE C320">ZTE C320 (Compact 8-Port GPON)</option>
                    <option value="Huawei MA5608T">Huawei SmartAX MA5608T (8-Port GPON)</option>
                    <option value="Huawei MA5683T">Huawei SmartAX MA5683T (16-Port GPON)</option>
                    <option value="VSOL">VSOL V1600G2-B (8-Port GPON)</option>
                    <option value="HSGQ">HSGQ G004 (4-Port GPON)</option>
                    <option value="Hioso">Hioso HA7302CS (2-Port EPON)</option>
                    <option value="Tarmoc">Tarmoc TMC-EP8 (8-Port EPON)</option>
                    <option value="FiberHome">FiberHome AN5516 (16-Port GPON)</option>
                    <option value="BDCOM">BDCOM GP3600 (8-Port GPON)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Model Perangkat</label>
                  <input type="text" value={editOltForm.model}
                    onChange={e => setEditOltForm({ ...editOltForm, model: e.target.value })}
                    required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Total Port PON</label>
                  <input type="number" min="1" max="128" value={editOltForm.total_ports}
                    onChange={e => setEditOltForm({ ...editOltForm, total_ports: Number(e.target.value) })}
                    required className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Lokasi / Wilayah / POP Site</label>
                  <input type="text" value={editOltForm.location}
                    onChange={e => setEditOltForm({ ...editOltForm, location: e.target.value })}
                    required className={inputCls} />
                </div>
              </div>

              {/* Quick Copy Scripts for OLT SNMP */}
              <QuickCopyScripts
                vendor={editOltForm.vendor}
                community="public"
              />

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button type="button" onClick={() => { setShowEditOltModal(false); setEditingOlt(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={submittingEditOlt}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {submittingEditOlt ? <><Spinner /><span>Menyimpan...</span></> : <><IconCheck /><span>Simpan Perubahan</span></>}
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Live Optical Power Inspector via SNMP
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedOnuForOptical && (
        <OpticalPowerModal
          onu={selectedOnuForOptical}
          activeOlt={activeOlt}
          onClose={() => setSelectedOnuForOptical(null)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: SNMP Diagnostic & MIB OID Explorer
      ══════════════════════════════════════════════════════════════════════ */}
      {showSnmpDiagModal && activeOlt && (
        <SnmpDiagnosticModal
          activeOlt={activeOlt}
          onClose={() => setShowSnmpDiagModal(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Progressive Port-by-Port Batch Sync Wizard (Anti-Timeout)
      ══════════════════════════════════════════════════════════════════════ */}
      {showProgressiveSyncModal && activeOlt && (
        <ProgressiveSyncModal
          activeOlt={activeOlt}
          ponPorts={oltData?.pon_ports || []}
          syncState={progressiveSyncState}
          onStart={startProgressiveSync}
          onClose={() => setShowProgressiveSyncModal(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Sinkronisasi Cadangan & Fallback Sync External
      ══════════════════════════════════════════════════════════════════════ */}
      {showSyncExternalModal && activeOlt && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  🔄
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Sinkronisasi Cadangan &amp; Fallback Sync
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Fitur cadangan jika SNMP timeout / migrasi ke VPS Cloud ({activeOlt.name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncExternalModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  Sumber Sinkronisasi Cadangan
                </label>
                <select
                  value={syncSourceType}
                  onChange={(e) => setSyncSourceType(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="regis_zte">Bridge Portal REGIS ZTE / Management Engine (HTTP DataTables API)</option>
                  <option value="probe_agent">Local Agent Probe (Jaringan Lokal On-Premise ke Cloud VPS)</option>
                  <option value="json_import">Impor File Cadangan JSON / CSV</option>
                </select>
              </div>

              {syncSourceType === 'regis_zte' && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-neutral-800/60 rounded-2xl border border-slate-200 dark:border-neutral-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1">
                      URL Web Management / Portal Eksternal
                    </label>
                    <input
                      type="text"
                      value={syncExternalUrl}
                      onChange={(e) => setSyncExternalUrl(e.target.value)}
                      className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-slate-800 dark:text-neutral-200"
                      placeholder="http://103.152.119.26:2227"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1">
                        Username Akses
                      </label>
                      <input
                        type="text"
                        value={syncUsername}
                        onChange={(e) => setSyncUsername(e.target.value)}
                        className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-slate-800 dark:text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={syncPassword}
                        onChange={(e) => setSyncPassword(e.target.value)}
                        className="w-full text-xs font-mono bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-slate-800 dark:text-neutral-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {syncResult && (
                <div
                  className={`p-4 rounded-2xl text-xs border ${
                    syncResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <p className="font-bold mb-1">{syncResult.success ? '✅ Sinkronisasi Berhasil!' : '❌ Sinkronisasi Gagal'}</p>
                  <p>{syncResult.message}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowSyncExternalModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleRunSyncExternal}
                disabled={syncLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {syncLoading ? (
                  <>
                    <Spinner />
                    <span>Menyinkronkan Data...</span>
                  </>
                ) : (
                  <span>🔄 Jalankan Sinkronisasi Sekarang</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Panduan VPN & Generator Script MikroTik
      ══════════════════════════════════════════════════════════════════════ */}
      <VpnMikrotikBridgeModal
        isOpen={showVpnModal}
        onClose={() => setShowVpnModal(false)}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Custom Confirm Dialog
      ══════════════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL: COMPREHENSIVE ONU DETAIL & OPTICAL INSPECTOR (SNMP)
══════════════════════════════════════════════════════════════════ */
function OpticalPowerModal({ onu, activeOlt, onClose }) {
  const [loading, setLoading] = useState(true);
  const [opticalData, setOpticalData] = useState(null);
  const [error, setError] = useState(null);

  const fetchOptical = () => {
    setLoading(true);
    setError(null);
    const vk = activeOlt?.vendor_key || activeOlt?.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
    fetch(`/api/olt/optical-power/${onu.serial_number}?vendor=${vk}&device_id=${activeOlt?.id || ''}`)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        setOpticalData(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Gagal membaca optical telemetry dari OLT via SNMP: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOptical();
  }, [onu.serial_number, activeOlt?.id]);

  const isOffline = onu.status !== 'Online' || opticalData?.status === 'LOS (Dying Gasp)' || opticalData?.rx_power_dbm === null;
  const rx = isOffline ? null : (opticalData?.rx_power_dbm ?? onu.rx_power);
  const isLoss = isOffline || (rx !== null && rx < -27);
  const isWarning = !isOffline && rx !== null && rx >= -27 && rx < -24;
  const isGood = !isOffline && rx !== null && rx >= -24;

  // Visual Gauge Angle: Range -35 dBm (left/red 180deg) to -10 dBm (right/green 0deg)
  const calcNeedleAngle = (val) => {
    if (val === null || isOffline) return 180;
    const clamped = Math.max(-35, Math.min(-10, val));
    // -35 -> 180deg, -10 -> 0deg
    return 180 - ((clamped - (-35)) / (-10 - (-35))) * 180;
  };

  const needleAngle = calcNeedleAngle(rx);

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/90 dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isOffline ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
              <IconNetwork />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Detail ONU &amp; Telemetri Optik</span>
                <span className={`px-2 py-0.2 text-[10px] font-bold rounded-full border ${!isOffline ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'}`}>
                  {!isOffline ? '● Online' : '○ Offline / LOS'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {onu.customer_name || 'Pelanggan'} · SN: <strong className="text-slate-700 dark:text-slate-300">{onu.serial_number}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Spinner />
              <p className="text-xs text-slate-500 font-medium">Melakukan query live SNMP OID Optical Transceiver...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          ) : opticalData ? (
            <div className="space-y-5">
              {/* 1. SPEEDOMETER / OPTICAL GAUGE CARD */}
              <div className={`p-6 rounded-3xl border text-center relative overflow-hidden transition-all shadow-xs ${isOffline || isLoss
                ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                : isWarning
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                  : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                }`}>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Optical Rx Power Level (Kekuatan Sinyal Terima)
                </div>

                {/* SVG Semi-Circle Gauge */}
                <div className="relative w-48 h-24 mx-auto mb-2 flex items-end justify-center">
                  <svg className="w-48 h-24 overflow-visible" viewBox="0 0 100 50">
                    {/* Background Arc Tracks */}
                    {/* Red Zone: -35 to -27 */}
                    <path d="M 10 50 A 40 40 0 0 1 34 16" fill="none" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" />
                    {/* Amber Zone: -27 to -23 */}
                    <path d="M 36 14 A 40 40 0 0 1 58 11" fill="none" stroke="#fbbf24" strokeWidth="8" />
                    {/* Green Zone: -23 to -10 */}
                    <path d="M 60 11 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />

                    {/* Needle Indicator */}
                    <g transform={`translate(50, 50) rotate(${needleAngle - 90})`}>
                      <line x1="0" y1="0" x2="0" y2="-36" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" className="dark:stroke-white transition-all duration-700" />
                      <circle cx="0" cy="0" r="5" fill="#4f46e5" />
                    </g>
                  </svg>
                </div>

                {/* Main Rx Power Typography */}
                <div className="space-y-1">
                  <div className="text-4xl font-black font-mono text-slate-900 dark:text-white">
                    {isOffline ? 'Loss (-∞ dBm)' : `${rx} dBm`}
                  </div>
                  <div className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-white/80 dark:bg-slate-800/80 shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
                    {isOffline
                      ? '🔴 LOS / Mati Daya (Dying Gasp)'
                      : isGood
                        ? '🟢 Sinyal Optik Sangat Baik'
                        : isWarning
                          ? '🟡 Sinyal Optik Waspada (-24 s/d -27 dBm)'
                          : '🔴 Sinyal Kritis / Redaman Tinggi (< -27 dBm)'}
                  </div>
                </div>
              </div>

              {/* 2. TRANSCEIVER SENSORS TELEMETRY GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Tx Power (Modem)</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.tx_power_dbm ? `+${opticalData.tx_power_dbm} dBm` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Laser Output</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">OLT Rx Power</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.olt_rx_power_dbm ? `${opticalData.olt_rx_power_dbm} dBm` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Diterima Port OLT</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Tegangan Optik</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.voltage_v ? `${opticalData.voltage_v} V` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Normal: 3.1 - 3.4V</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Bias Current</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.bias_current_ma ? `${opticalData.bias_current_ma} mA` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Arus Laser</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Suhu Transceiver</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.temperature_c ? `${opticalData.temperature_c} °C` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Thermal Sensor</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Estimasi Jarak</div>
                  <div className="text-sm font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                    {onu.distance_meters ? `${onu.distance_meters} Meter` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Panjang Kabel FO</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Port PON OLT</div>
                  <div className="text-sm font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                    {formatShortPort(onu.port)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Interface Card</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Tipe / Model ONU</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={onu.onu_type || onu.vendor_model}>
                    {onu.onu_type || onu.vendor_model || 'HGU GPON/EPON'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Hardware Model</div>
                </div>
              </div>

              {/* 3. CUSTOMER & TOPOLOGY CONNECTION CARD */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Informasi Pelanggan &amp; Jalur Jaringan</span>
                  {onu.customer_id && (
                    <a
                      href={`/customers?id=${onu.customer_id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-semibold"
                    >
                      Buka Profil Pelanggan →
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nama Pelanggan</span>
                    <strong className="text-slate-800 dark:text-slate-200">{onu.customer_name || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ID Pelanggan</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">{onu.customer_number || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">IP Address</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">{onu.ip_address || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* 4. DIAGNOSTIC RECOMMENDATION */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>💡 Rekomendasi &amp; Analisa Teknis:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {isOffline
                    ? 'Modem terputus (LOS) atau mati daya. OLT tidak menerima sinyal laser optik dari modem. Periksa kabel dropcore pelanggan atau adaptor daya modem.'
                    : isGood
                      ? 'Kualitas redaman optik sangat baik (antara -15 hingga -23 dBm). Sinyal stabil, tidak ada risiko packet loss optik.'
                      : isWarning
                        ? 'Redaman berada di batas wajar (-23 hingga -27 dBm). Disarankan membersihkan konektor SC/UPC patchcord atau memeriksa kelengkungan (macro-bending) dropcore.'
                        : 'Redaman melewati batas toleransi (< -27 dBm). Pelanggan berisiko mengalami koneksi lambat atau putus-nyambung. Lakukan pengecekan redaman di titik ODP.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOptical}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            >
              {loading ? <Spinner /> : <span>⚡ Polling Ulang SNMP</span>}
            </button>

            <a
              href="/gis-topology-map"
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700"
            >
              <span>📍 Peta Topologi GIS</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL: SNMP DIAGNOSTIC & MIB OID EXPLORER
══════════════════════════════════════════════════════════════════ */
function SnmpDiagnosticModal({ activeOlt, onClose }) {
  const [oid, setOid] = useState('1.3.6.1.2.1.1.1.0');
  const [operation, setOperation] = useState('get'); // 'get' | 'walk'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const PRESETS = [
    { label: 'sysDescr (Identitas & Versi OLT)', oid: '1.3.6.1.2.1.1.1.0', op: 'get' },
    { label: 'sysUpTime (Uptime OLT)', oid: '1.3.6.1.2.1.1.3.0', op: 'get' },
    { label: 'ifDescr (Daftar Interface & Port)', oid: '1.3.6.1.2.1.2.2.1.2', op: 'walk' },
    { label: 'ifOperStatus (Status Up/Down Port)', oid: '1.3.6.1.2.1.2.2.1.8', op: 'walk' },
    { label: 'ZTE ONU Serial Numbers Table', oid: '1.3.6.1.4.1.3902.1012.3.50.11.1.1.2', op: 'walk' },
    { label: 'Huawei ONU Serial Numbers Table', oid: '1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9', op: 'walk' },
  ];

  const handleRunQuery = (e) => {
    e?.preventDefault();
    setLoading(true);
    setResult(null);

    fetch(`/api/olts/${activeOlt.id}/snmp-diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oid, operation }),
    })
      .then(r => r.json())
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(err => {
        setResult({ status: 'error', message: 'Gagal menjalankan query: ' + err.message });
        setLoading(false);
      });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>Diagnostic SNMP &amp; MIB OID Explorer</span>
            </h3>
            <p className="text-xs text-slate-300 font-mono mt-0.5">{activeOlt.name} ({activeOlt.ip_address})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg flex items-center justify-center"><IconX /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Pilihan Preset OID Populer:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setOid(p.oid); setOperation(p.op); }}
                  className={`p-2 rounded-xl text-left border text-xs transition-all ${oid === p.oid && operation === p.op
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 font-bold text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <div>{p.label}</div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">{p.oid} [{p.op.toUpperCase()}]</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleRunQuery} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Target OID</label>
                <input
                  type="text"
                  value={oid}
                  onChange={e => setOid(e.target.value)}
                  placeholder="1.3.6.1.2.1.1.1.0"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Operasi</label>
                <select
                  value={operation}
                  onChange={e => setOperation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="get">SNMP GET</option>
                  <option value="walk">SNMP WALK</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <><Spinner /><span>Sedang Menjalankan Query SNMP...</span></> : <span>Jalankan Query SNMP ke {activeOlt.ip_address}</span>}
            </button>
          </form>

          {/* Query Result Viewer */}
          {result && (
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-emerald-400 p-4 font-mono text-xs overflow-x-auto space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <span>STATUS: {result.status?.toUpperCase()}</span>
                {result.data?.latency_ms && <span>LATENCY: {result.data.latency_ms} ms</span>}
              </div>
              <pre className="text-xs whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(result.data?.results || result.data?.raw_value || result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT: QUICK COPY SCRIPTS (SNMP & VPN CONFIGURATION)
══════════════════════════════════════════════════════════════════ */
function QuickCopyScripts({ vendor = 'ZTE', community = 'public', vpsIp = '103.89.6.125' }) {
  const [openSnmp, setOpenSnmp] = useState(true);
  const [openVpn, setOpenVpn] = useState(true);
  const [copiedSnmp, setCopiedSnmp] = useState(false);
  const [copiedVpn, setCopiedVpn] = useState(false);
  const [routerOsVersion, setRouterOsVersion] = useState('v7'); // 'v7' or 'v6'
  const [activeVendor, setActiveVendor] = useState(vendor);

  useEffect(() => {
    if (vendor) setActiveVendor(vendor);
  }, [vendor]);

  const effectiveCommunity = community?.trim() || 'public';

  // Vendor OLT SNMP Script Generator
  const getSnmpScript = (v, comm) => {
    const norm = (v || '').toLowerCase();
    if (norm.includes('zte')) {
      return `conf t\nmib-compatibility iftable v2\nsnmp-server community ${comm} view AllView rw\nexit\nwrite`;
    }
    if (norm.includes('huawei')) {
      return `enable\nconfig\nsnmp-agent\nsnmp-agent sys-info version v2c\nsnmp-agent community read ${comm}\nsave`;
    }
    if (norm.includes('hsgq')) {
      return `# Web GUI OLT HSGQ (http://192.168.100.1)\n# Menu: System Management -> SNMP Configuration\n# SNMP Enable: ON\n# SNMP Version: v2c\n# Read Community: ${comm}\n# SNMP Port: 161\n# Klik 'Apply' lalu 'Save Configuration'`;
    }
    if (norm.includes('vsol')) {
      return `enable\nconfig\nsnmp-server enable\nsnmp-server community ${comm} ro\nwrite`;
    }
    if (norm.includes('bdcom')) {
      return `enable\nconfig\nsnmp-server community ${comm} ro\nsnmp-server enable\nwrite`;
    }
    if (norm.includes('fiberhome')) {
      return `enable\nconfig\nset snmp enable\nset snmp community ${comm} ro\nsave`;
    }
    if (norm.includes('hioso') || norm.includes('tarmoc')) {
      return `# Web GUI: System Management -> SNMP Service -> Enable\n# SNMP Version: v2c\n# Read Community: ${comm}\n# Port: 161`;
    }
    return `conf t\nsnmp-server community ${comm} ro\nexit\nwrite`;
  };

  // MikroTik VPN Script Generator
  const getVpnScript = (rosVer) => {
    if (rosVer === 'v7') {
      return `/interface l2tp-client remove [find name="L2TP-UNMS-VPS"]\n/ip ipsec profile remove [find name="unms-ipsec-profile"]\n\n/ip ipsec profile add name="unms-ipsec-profile" enc-algorithm=aes-256,aes-128,3des hash-algorithm=sha1 dh-group=modp1024 lifetime=1h\n/ip ipsec proposal set [find default=yes] enc-algorithms=aes-256-cbc,aes-128-cbc,3des-cbc auth-algorithms=sha1 lifetime=20m\n\n/interface l2tp-client add connect-to=${vpsIp} name="L2TP-UNMS-VPS" user="unms_client" password="unmspassword2026" use-ipsec=yes ipsec-secret="unmssecret2026" profile="unms-ipsec-profile" add-default-route=no allow=mschap2 disabled=no comment="Bridge ke UNMS Cloud VPS"\n\n/ip address add address=192.168.100.2/24 interface=ether2 comment="IP Gateway untuk OLT HSGQ" 2>/dev/null || true`;
    }
    return `/interface l2tp-client remove [find comment="added by UNMS"]\n/interface l2tp-client add connect-to=${vpsIp} name="L2TP-UNMS-VPS" user="unms_client" password="unmspassword2026" use-ipsec=yes ipsec-secret="unmssecret2026" add-default-route=no allow=mschap2 disabled=no comment="added by UNMS"\n\n/ip address add address=192.168.100.2/24 interface=ether2 comment="IP Gateway OLT"`;
  };

  const snmpScriptText = getSnmpScript(activeVendor, effectiveCommunity);
  const vpnScriptText = getVpnScript(routerOsVersion);

  const handleCopySnmp = () => {
    navigator.clipboard.writeText(snmpScriptText);
    setCopiedSnmp(true);
    setTimeout(() => setCopiedSnmp(false), 2000);
  };

  const handleCopyVpn = () => {
    navigator.clipboard.writeText(vpnScriptText);
    setCopiedVpn(true);
    setTimeout(() => setCopiedVpn(false), 2000);
  };

  return (
    <div className="mt-5 space-y-3 pt-3 border-t border-slate-200 dark:border-neutral-800">
      <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
        <span className="flex items-center gap-1.5 font-mono">
          <span className="text-indigo-500 font-black">&gt;_</span> Quick Copy Scripts
        </span>
        <span className="text-[10px] text-slate-400 font-normal">Salin konfigurasi 1-klik untuk OLT &amp; Router</span>
      </div>

      {/* ── Accordion 1: SNMP Configuration ───────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono flex items-center gap-1.5">
              <span className="text-indigo-500">&gt;_</span> SNMP Configuration
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activeVendor}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleCopySnmp}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-neutral-700 hover:text-indigo-600 transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
              title="Salin script SNMP"
            >
              {copiedSnmp ? (
                <>
                  <span className="text-emerald-500 font-bold"></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tersalin!</span>
                </>
              ) : (
                <>
                  <span></span>
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpenSnmp(!openSnmp)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-neutral-800"
            >
              <span className="text-xs">{openSnmp ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {openSnmp && (
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>Community: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{effectiveCommunity}</strong></span>
              <span className="text-[10px]">Tempel di CLI / Web GUI OLT</span>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 selection:bg-indigo-500 selection:text-white">
              {snmpScriptText}
            </pre>
          </div>
        )}
      </div>

      {/* ── Accordion 2: VPN Configuration (Zetset Style) ────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono flex items-center gap-1.5">
              <span className="text-emerald-500">&lt;&gt;</span> VPN Configuration (L2TP Client)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Online
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <a
              href="/network-bridge-setup"
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-neutral-800 text-xs font-bold"
              title="Buka Wizard Setup Lengkap"
            >
              ↗
            </a>
            <button
              type="button"
              onClick={handleCopyVpn}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-neutral-700 hover:text-emerald-600 transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
              title="Salin script MikroTik L2TP"
            >
              {copiedVpn ? (
                <>
                  <span className="text-emerald-500 font-bold"></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tersalin!</span>
                </>
              ) : (
                <>
                  <span></span>
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpenVpn(!openVpn)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-neutral-800"
            >
              <span className="text-xs">{openVpn ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {openVpn && (
          <div className="p-3.5 space-y-3">
            {/* IP Pool Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Alokasi IP Tunnel VPN:
              </label>
              <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                <span>10.254.0.2 (Tersedia)</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">VPN Aktif: 1/0</span>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                <div className="text-[10px] font-sans text-slate-400 uppercase">Username:</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">unms_client</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                <div className="text-[10px] font-sans text-slate-400 uppercase">Password:</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">unmspassword2026</div>
              </div>
            </div>

            {/* RouterOS Version Switch */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Script MikroTik:</span>
              <div className="flex rounded-lg border border-slate-300 dark:border-neutral-700 p-0.5 bg-slate-100 dark:bg-neutral-900 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setRouterOsVersion('v7')}
                  className={`px-2 py-0.5 rounded ${routerOsVersion === 'v7' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                >
                  RouterOS 7
                </button>
                <button
                  type="button"
                  onClick={() => setRouterOsVersion('v6')}
                  className={`px-2 py-0.5 rounded ${routerOsVersion === 'v6' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                >
                  RouterOS 6
                </button>
              </div>
            </div>

            {/* Code Block */}
            <pre className="p-3 rounded-lg bg-slate-950 text-indigo-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 selection:bg-emerald-500 selection:text-white">
              {vpnScriptText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL: PROGRESSIVE PORT-BY-PORT BATCH SYNC WIZARD
══════════════════════════════════════════════════════════════════ */
function ProgressiveSyncModal({ activeOlt, ponPorts = [], syncState, onStart, onClose }) {
  const totalPorts = ponPorts.length;
  const completedPorts = syncState.results.filter(r => r.status === 'success' || r.status === 'error').length;
  const successPorts = syncState.results.filter(r => r.status === 'success').length;
  const errorPorts = syncState.results.filter(r => r.status === 'error').length;
  const totalOnusRead = syncState.results.reduce((acc, r) => acc + (r.count || 0), 0);
  const percent = totalPorts > 0 ? Math.round((completedPorts / totalPorts) * 100) : 0;
  const isFinished = completedPorts === totalPorts && totalPorts > 0;

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>Sinkronisasi Bertahap Port OLT</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {activeOlt?.name} ({activeOlt?.ip_address}) — {totalPorts} Port PON Terdeteksi
              </p>
            </div>
          </div>
          {!syncState.running && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg flex items-center justify-center">
              <IconX />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <span>💡 Fitur Anti-Timeout untuk Skala Besar (&gt;2.000 ONU)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Sistem memproses pembacaan data port demi port secara berurutan. Jika terdapat ribuan modem, proses ini mencegah kegagalan koneksi (*504 Gateway Timeout*) dan menjaga beban CPU OLT tetap stabil.
            </p>
          </div>

          {/* Progress Metrics & Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {syncState.running ? `Sedang Memproses: ${syncState.currentPort}` : isFinished ? '✓ Sinkronisasi Selesai!' : 'Siap Menjalankan Sinkronisasi'}
              </span>
              <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                {percent}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Metric Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Port Selesai</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 font-mono">
                  {completedPorts} / {totalPorts}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">ONU Terbaca</div>
                <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                  {totalOnusRead}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Status Gagal</div>
                <div className={`text-sm font-extrabold mt-0.5 font-mono ${errorPorts > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {errorPorts} Port
                </div>
              </div>
            </div>
          </div>

          {/* Port Execution Queue List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Daftar Antrean Port PON:
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto bg-white dark:bg-slate-900">
              {ponPorts.map((port, idx) => {
                const res = syncState.results.find(r => r.port === port.port_id);
                const status = res?.status || 'pending';
                const message = res?.message || 'Menunggu antrean...';
                const count = res?.count || 0;

                return (
                  <div key={port.port_id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-[10px] text-slate-400 font-bold w-5">#{idx + 1}</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{port.port_id}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">({message})</span>
                    </div>

                    <div>
                      {status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Menunggu
                        </span>
                      )}
                      {status === 'syncing' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                          <Spinner />
                          <span>Membaca...</span>
                        </span>
                      )}
                      {status === 'success' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ✓ {count} ONU
                        </span>
                      )}
                      {status === 'error' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          ✕ Gagal
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            disabled={syncState.running}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            {isFinished ? 'Tutup' : 'Batal'}
          </button>

          {!syncState.running ? (
            <button
              onClick={onStart}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              <span>{isFinished ? '🔄 Sinkronisasi Ulang' : '▶️ Mulai Sinkronisasi Bertahap'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <Spinner />
              <span>Memproses Port {completedPorts + 1} dari {totalPorts}...</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


