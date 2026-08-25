import React, { useState, useEffect, useCallback } from 'react';
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
const Spinner = () => (
  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
);

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

  // ONU Search & Filter
  const [onuSearchQuery, setOnuSearchQuery] = useState('');
  const [onuStatusFilter, setOnuStatusFilter] = useState('all'); // all, online, los, high_loss

  // Optical Power Modal
  const [selectedOnuForOptical, setSelectedOnuForOptical] = useState(null);

  // SNMP Diagnostics Modal
  const [showSnmpDiagModal, setShowSnmpDiagModal] = useState(false);

  // Live Polling Interval (0 = Manual, 5 = 5s, 10 = 10s, 30 = 30s)
  const [pollingInterval, setPollingInterval] = useState(0);

  // Fetch OLT Topology (ODCs & ODPs connected to this OLT)
  const fetchOltTopology = (oltId) => {
    fetch(`/api/network-nodes/olt-topology?olt_id=${oltId}`)
      .then(r => r.json())
      .then(d => setOltTopology(d.data ?? []))
      .catch(() => setOltTopology([]));
  };

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
    snmp_community_type: 'public',
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
  };
  const [configForm, setConfigForm] = useState(defaultConfigForm);

  // ── Add OLT Form State ───────────────────────────────────────────────────────
  const defaultNewOltForm = {
    name: '', code: '', vendor: 'ZTE', model: 'ZXAN C300',
    location: '', ip_address: '', total_ports: 16,
    deployment_mode: 'vpn', snmp_version: 'v2c',
    snmp_community_type: 'public', snmp_community: '',
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

  // Live Polling Interval Effect
  useEffect(() => {
    if (!pollingInterval || pollingInterval <= 0) return;
    const timer = setInterval(() => {
      if (activeOlt) {
        const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
        fetchOltHardware(vk, activeOlt.id);
      }
    }, pollingInterval * 1000);
    return () => clearInterval(timer);
  }, [pollingInterval, activeOlt]);

  // ─── Fetch OLT Hardware Telemetry via SNMP ──────────────────────────────────
  const fetchOltHardware = (vendorKey, deviceId) => {
    setLoading(true);
    const url = `/api/olt/hardware?vendor=${vendorKey}&device_id=${deviceId || ''}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('API ' + r.status); return r.json(); })
      .then(data => { setOltData(data); setLoading(false); })
      .catch(() => setLoading(false));
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
      });
    } else {
      setLoading(false);
      setOltData(null);
    }
  }, [activeOlt?.id, activeOlt?.connection_mode, activeOlt?.ip_address]);

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
      }),
    })
      .then(r => r.json())
      .then(() => {
        setSavingConfig(false);
        showNotif('Konfigurasi SNMP berhasil disimpan.', 'success');
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

  // ─── Filtered ONU List (Terdaftar) ──────────────────────────────────────────
  const filteredOnus = (oltData?.onu_list || []).filter(onu => {
    if (selectedPortFilter && onu.port !== selectedPortFilter && !onu.port.startsWith(selectedPortFilter)) {
      return false;
    }
    if (onuStatusFilter === 'online' && onu.status !== 'Online') return false;
    if (onuStatusFilter === 'los' && onu.status === 'Online') return false;
    if (onuStatusFilter === 'high_loss' && onu.rx_power >= -27) return false;

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

  const filteredUnregisteredOnus = (oltData?.unconfigured_onus || []).filter(onu => {
    if (selectedPortFilter && onu.detected_port !== selectedPortFilter && !onu.detected_port.startsWith(selectedPortFilter)) {
      return false;
    }
    if (unregisteredSearchQuery) {
      const q = unregisteredSearchQuery.toLowerCase();
      const matchSn = (onu.serial_number || onu.mac_address)?.toLowerCase().includes(q);
      const matchName = onu.onu_name?.toLowerCase().includes(q);
      const matchPort = onu.detected_port?.toLowerCase().includes(q);
      const matchModel = onu.vendor_model?.toLowerCase().includes(q);
      return matchSn || matchName || matchPort || matchModel;
    }
    return true;
  });

  const totalUnregisteredPages = Math.max(1, Math.ceil(filteredUnregisteredOnus.length / unregisteredPerPage));
  const paginatedUnregisteredOnus = filteredUnregisteredOnus.slice(
    (unregisteredPage - 1) * unregisteredPerPage,
    unregisteredPage * unregisteredPerPage
  );

  const totalRegisteredPages = Math.max(1, Math.ceil(filteredOnus.length / registeredPerPage));
  const paginatedRegisteredOnus = filteredOnus.slice(
    (registeredPage - 1) * registeredPerPage,
    registeredPage * registeredPerPage
  );

  const filteredOrphanedOnus = (oltData?.orphaned_onus || []).filter(onu => {
    if (selectedPortFilter && onu.olt_port !== selectedPortFilter && !onu.olt_port.startsWith(selectedPortFilter)) {
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

  const totalOrphanedPages = Math.max(1, Math.ceil(filteredOrphanedOnus.length / orphanedPerPage));
  const paginatedOrphanedOnus = filteredOrphanedOnus.slice(
    (orphanedPage - 1) * orphanedPerPage,
    orphanedPage * orphanedPerPage
  );

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
          {/* Live Polling Interval Selector */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-bold shadow-xs">
            <span className={`w-2 h-2 rounded-full ${pollingInterval > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-slate-600 dark:text-slate-400">Polling:</span>
            <select
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer pr-1"
            >
              <option value={0}>Manual</option>
              <option value={5}>Setiap 5 Detik</option>
              <option value={10}>Setiap 10 Detik</option>
              <option value={30}>Setiap 30 Detik</option>
            </select>
          </div>

          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan OLT"
          />
          {activeOlt && (
            <button
              onClick={() => setShowSnmpDiagModal(true)}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Uji OID MIB SNMP Live langsung dari browser"
            >
              <span>Diagnostic SNMP &amp; MIB</span>
            </button>
          )}
          <button
            onClick={() => setShowVpnModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Panduan VPN L2TP Perusahaan, Script MikroTik & Server Lokal On-Premise"
          >
            <IconNetwork />
            <span>Panduan Jaringan (VPN / MikroTik)</span>
          </button>
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

      {/* ── Architecture Pipeline Banner ───────────────────────────────── */}
      <div className="bg-slate-50/80 dark:bg-neutral-950 border border-slate-200 dark:border-[#222222] p-4 sm:p-5 rounded-lg shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Alur Koneksi
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Arsitektur Telemetri OLT via VPN &amp; SNMP
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Sistem UNMS mengambil data redaman &amp; status port OLT murni via query SNMP (UDP 161) melalui terowongan VPN router kantor Anda.
            </p>
          </div>

          {/* 3-Hop Pipeline Map */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="text-base"></span>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase font-sans">1. OLT Fisik</div>
                <div className="font-bold text-slate-800 dark:text-slate-200">Port SNMP 161 (public)</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="text-base"></span>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase font-sans">2. VPN Gateway</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">MikroTik (10.254.0.2)</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="text-base"></span>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase font-sans">3. UNMS Cloud</div>
                <div className="font-bold text-indigo-600 dark:text-indigo-400">Live Polling (103.89.6.125)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── OLT Selector ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Daftar Perangkat OLT
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Klik salah satu kartu OLT di bawah untuk memilih perangkat aktif
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSensitiveIp(!showSensitiveIp)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${showSensitiveIp
                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              title="Hanya tim NOC / Administrator yang berhak melihat IP address"
            >
              <span>{showSensitiveIp ? 'Sembunyikan IP' : 'Buka IP'}</span>
            </button>
            <div className="text-right">
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Total OLT</div>
              <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{olts.length} OLT</div>
            </div>
          </div>
        </div>

        {/* Quick device cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {olts.map(o => {
            const isActive = selectedOltId === o.id;
            const isLive = o.connection_mode === 'live';
            return (
              <div key={o.id} className={`p-3 rounded-xl border text-left transition-all group relative ${isActive ? 'bg-indigo-600 border-indigo-600 shadow-md text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700'
                }`}>
                <button onClick={() => setSelectedOltId(o.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase ${isActive ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>{o.vendor}</span>
                    <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`} title={isLive ? 'Live SNMP' : 'Database UNMS'} />
                  </div>
                  <div className="font-bold text-xs mt-1 truncate">{o.name}</div>
                  <div className={`text-[11px] font-mono mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>{maskIpAddress(o.ip_address)}</div>
                  <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{o.location}</div>
                </button>
                {/* Action buttons */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {isLive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDisconnectOlt(o); }}
                      disabled={disconnectingId === o.id}
                      className={`p-1 rounded-lg ${isActive ? 'text-rose-200 hover:bg-white/20' : 'text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400'}`}
                      title={`Hentikan koneksi SNMP ke ${o.name}`}>
                      {disconnectingId === o.id ? <Spinner /> : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>}
                    </button>
                  )}
                  {canCrud && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(o); }}
                        className={`p-1 rounded-lg ${isActive ? 'text-indigo-200 hover:bg-white/20' : 'text-slate-400 dark:text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                        title="Edit OLT">
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteOlt(o)}
                        disabled={deletingId === o.id}
                        className={`p-1 rounded-lg ${isActive ? 'text-indigo-200 hover:bg-white/20' : 'text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400'}`}
                        title="Hapus OLT">
                        {deletingId === o.id ? <Spinner /> : <IconTrash />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Nama &amp; Lokasi OLT</div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-2">{activeOlt?.name}</div>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">{activeOlt?.location}</div>
              {oltData.device_info?.mac_address && (
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">MAC: {oltData.device_info.mac_address}</div>
              )}
              {oltData.device_info?.mfg_date && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Produksi: {oltData.device_info.mfg_date}</div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">IP SNMP &amp; Firmware</div>
              <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{maskIpAddress(activeOlt?.ip_address)}</div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Firmware: {oltData.device_info?.firmware}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">CPU & Suhu Chassis (SNMP)</div>
              {oltData.device_info?.cpu_usage !== null && oltData.device_info?.cpu_usage !== undefined ? (
                <>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{oltData.device_info.cpu_usage}%</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full" style={{ width: `${oltData.device_info.cpu_usage}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                    Suhu: {oltData.device_info?.temperature ?? '--'}°C | Uptime: {oltData.device_info?.uptime ?? '--'}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{oltData.device_info?.uptime ?? '--'}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">CPU / RAM / Suhu: N/A</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">OLT tidak mengekspos OID ini via SNMP</div>
                  </div>
                </>
              )}

            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">ONU Belum Terdaftar</div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                {oltData.unconfigured_onus?.length ?? 0} Perangkat
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Menunggu otorisasi via Database</div>
            </div>
          </div>

          {/* Chassis cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Slot & Card — {activeOlt?.name}</h3>
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
                      const matchedOdcs = oltTopology.filter(o => {
                        if (!o.olt_port_ref) return false;
                        const targetClean = port.port_id.replace(/^gpon[-_]olt_/i, '');
                        const refs = o.olt_port_ref.split(',').map(r => r.trim().replace(/^gpon[-_]olt_/i, ''));
                        return refs.some(r => r === targetClean || r === port.port_id || `gpon-olt_${r}` === port.port_id);
                      });
                      const odcCount = matchedOdcs.length;
                      const odpCount = matchedOdcs.reduce((acc, o) => acc + (o.odps?.length || 0), 0);

                      return (
                        <button
                          key={port.port_id}
                          type="button"
                          onClick={() => setSelectedPortFilter(isSelected ? null : port.port_id)}
                          className={`p-4 rounded-xl space-y-3 text-left transition-all relative ${isSelected
                            ? 'bg-indigo-50/90 dark:bg-indigo-900/20 border-2 border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700'
                            }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-2">
                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{port.port_id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${port.status === 'Up' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                              }`}>{port.status}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Total</div>
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white">{port.registered_onus}</div>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Online</div>
                              <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{port.online_onus}</div>
                            </div>
                            <div className={`p-1.5 rounded-lg border ${port.los_onus > 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                              <div className={`text-[10px] font-bold ${port.los_onus > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>LOS</div>
                              <div className={`text-xs font-extrabold ${port.los_onus > 0 ? 'text-rose-700 dark:text-rose-300 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>{port.los_onus}</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-slate-700">
                            <span>TX Optical SFP:</span>
                            {port.tx_power_dbm !== null && port.tx_power_dbm !== undefined ? (
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{port.tx_power_dbm} dBm</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 font-medium text-[10px]">SFP Belum Terpasang</span>
                            )}
                          </div>


                          {/* Info ODC & ODP Terhubung */}
                          {odcCount > 0 && (
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px]">
                              <span className="text-blue-700 dark:text-blue-400 font-semibold truncate max-w-[140px]">
                                {matchedOdcs.map(o => o.name).join(', ')}
                              </span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
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

          {/* Topologi Pasif (ODC & ODP) untuk Port Terpilih */}
          {selectedPortFilter && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Topologi Pasif (ODC &amp; ODP) — Port {selectedPortFilter}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Perangkat ODC dan ODP yang mendistribusikan sinyal optik dari port ini ke pelanggan
                  </p>
                </div>
              </div>

              {(() => {
                const portOdcs = oltTopology.filter(o => {
                  if (!o.olt_port_ref) return false;
                  const targetClean = selectedPortFilter.replace(/^gpon[-_]olt_/i, '');
                  const refs = o.olt_port_ref.split(',').map(r => r.trim().replace(/^gpon[-_]olt_/i, ''));
                  return refs.some(r => r === targetClean || r === selectedPortFilter || `gpon-olt_${r}` === selectedPortFilter);
                });
                if (portOdcs.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      Belum ada ODC terhubung yang dikonfigurasi untuk port {selectedPortFilter}.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {portOdcs.map(odc => (
                      <div key={odc.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {odc.name}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {odc.used_ports}/{odc.total_ports} Port Terisi
                          </span>
                        </div>

                        {odc.parent_node && (
                          <p className="text-xs text-slate-600 dark:text-slate-400"> POP Induk: <strong className="text-slate-900 dark:text-white">{odc.parent_node.name}</strong></p>
                        )}

                        {odc.odps && odc.odps.length > 0 ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                              ODP Terhubung ({odc.odps.length} ODP)
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {odc.odps.map(odp => (
                                <div key={odp.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs">
                                  <p className="font-bold text-slate-900 dark:text-white truncate">{odp.name}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{odp.used_ports}/{odp.total_ports} Port</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada ODP di bawah ODC ini</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

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
                  <div className="flex items-center space-x-3">
                    {selectedPortFilter && (
                      <button
                        onClick={() => { setSelectedPortFilter(null); setUnregisteredPage(1); }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold text-xs transition-colors flex items-center space-x-1"
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
                      <th className="px-5 py-3.5">Port &amp; ONU ID</th>
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
                              {onu.detected_port} ({onu.onu_index || onu.onu_id})
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
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                          Semua ONU fisik pada OLT sudah terdaftar di Fiber UNMS.
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

                          {/* Row 3: Port & ONU ID */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Port &amp; ID</span>
                            <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {onu.detected_port} ({onu.onu_index || onu.onu_id})
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
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Semua ONU fisik pada OLT sudah terdaftar di Fiber UNMS.
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
                        ? `Daftar ONU Filtered Port [ ${selectedPortFilter} ]`
                        : `Daftar Semua ONU Terdaftar — ${activeOlt?.name}`}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Menampilkan {filteredOnus.length} dari total {oltData.onu_list?.length ?? 0} ONU terdaftar
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {selectedPortFilter && (
                      <button
                        onClick={() => { setSelectedPortFilter(null); setRegisteredPage(1); }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold text-xs transition-colors flex items-center space-x-1"
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

                {/* Search Bar & Filters */}
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
                      { id: 'los', label: 'LOS / Offline' },
                      { id: 'high_loss', label: 'Redaman Drop (< -27 dBm)' },
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
                      <th className="px-5 py-3.5">Nama Pelanggan</th>
                      <th className="px-5 py-3.5">Port &amp; ONU ID</th>
                      <th className="px-5 py-3.5">Serial Number</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Redaman Rx Power</th>
                      <th className="px-5 py-3.5">Jarak Fiber</th>
                      <th className="px-5 py-3.5">IP Address</th>
                      <th className="px-5 py-3.5 text-right">Aksi Telemetri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedRegisteredOnus.length > 0 ? (
                      paginatedRegisteredOnus.map((onu, idx) => {
                        const globalIndex = (registeredPage - 1) * registeredPerPage + idx + 1;
                        const isOffline = onu.status !== 'Online' || onu.rx_power === null || onu.rx_power <= -40;
                        return (
                          <tr key={onu.serial_number || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-semibold">{globalIndex}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">{onu.customer_name}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{onu.port} ({onu.onu_id})</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-400">{onu.serial_number}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
                                }`}>{onu.status}</span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-bold">
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
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-xs">{onu.distance_meters} m</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-500">{maskIpAddress(onu.ip_address)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedOnuForOptical(onu)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                                title="Query live optical diagnostic data via SNMP"
                              >
                                <span>Cek Power (SNMP)</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                          Tidak ada ONU yang cocok dengan kriteria pencarian/filter.
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

                          {/* Row 3: Port & ONU ID */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Port &amp; ID</span>
                            <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {onu.port} ({onu.onu_id})
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
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
                                }`}>
                                {onu.status}
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

                          {/* Row 7: Jarak & IP */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                            <span className="text-slate-400 font-semibold">Jarak &amp; IP</span>
                            <span className="col-span-2 text-slate-700 dark:text-slate-300">
                              {onu.distance_meters} m · <span className="font-mono text-[11px] text-slate-500">{maskIpAddress(onu.ip_address)}</span>
                            </span>
                          </div>

                          {/* Row 8: Aksi */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-3 items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="text-slate-400 font-semibold">Aksi</span>
                            <div className="col-span-2 flex items-center gap-2">
                              <button
                                onClick={() => setSelectedOnuForOptical(onu)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs hover:bg-indigo-100"
                              >
                                Cek Power (SNMP)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Tidak ada ONU yang cocok dengan kriteria pencarian/filter.
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

                  {/* Tuning SNMP Port & Timeout */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className={labelCls}>Port UDP SNMP</label>
                      <input type="number" value={configForm.snmp_port}
                        onChange={e => setConfigForm({ ...configForm, snmp_port: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Timeout Polling (detik)</label>
                      <input type="number" value={configForm.snmp_timeout}
                        onChange={e => setConfigForm({ ...configForm, snmp_timeout: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
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
   MODAL: LIVE OPTICAL POWER INSPECTOR (SNMP)
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

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>Telemetri Redaman Optik (SNMP)</span>
            </h3>
            <p className="text-xs text-slate-300 font-mono mt-0.5">{onu.customer_name} · {onu.serial_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg flex items-center justify-center"><IconX /></button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <Spinner />
              <p className="text-xs text-slate-500 font-medium">Melakukan polling SNMP OID Transceiver...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          ) : opticalData ? (
            <div className="space-y-4">
              {/* Primary Gauge Card */}
              <div className={`p-4 rounded-2xl border text-center space-y-2 ${isOffline || isLoss
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : isWarning
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                }`}>
                <div className="text-xs font-bold uppercase tracking-wider">Rx Optical Power (ONU)</div>
                <div className="text-3xl font-black font-mono">{isOffline ? 'Loss (-∞ dBm)' : `${rx} dBm`}</div>
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/80 dark:bg-black/40 shadow-2xs">
                  {isOffline ? 'LOS (No Signal / Dying Gasp)' : isGood ? 'Kualitas Redaman Baik' : isWarning ? 'Redaman Waspada' : 'Redaman Buruk / Kritis'}
                </div>
              </div>

              {/* Detail Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Tx Power (ONU)</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.tx_power_dbm ? `+${opticalData.tx_power_dbm} dBm` : '—'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">OLT Rx Power</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.olt_rx_power_dbm ? `${opticalData.olt_rx_power_dbm} dBm` : '—'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Tegangan (V)</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.voltage_v ? `${opticalData.voltage_v} V` : '—'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Bias Current</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.bias_current_ma ? `${opticalData.bias_current_ma} mA` : '—'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Suhu Transceiver</div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {!isOffline && opticalData.temperature_c ? `${opticalData.temperature_c} °C` : '—'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Port PON</div>
                  <div className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                    {onu.port}
                  </div>
                </div>
              </div>

              {/* Diagnosis Advice */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">Analisa &amp; Rekomendasi Jaringan:</div>
                <p className="text-slate-600 dark:text-slate-400">
                  {isOffline
                    ? 'Modem dalam status LOS (Loss of Signal) atau Mati Daya (Dying Gasp). Sensor optik OLT tidak mendeteksi cahaya laser dari modem. Periksa kabel dropcore optik atau adaptor daya modem pelanggan.'
                    : isGood
                      ? 'Redaman optik sangat baik (antara -15 hingga -24 dBm). Layanan internet berjalan optimal tanpa packet loss optik.'
                      : isWarning
                        ? 'Redaman berada di batas wajar (-24 hingga -27 dBm). Periksa kemungkinan kotoran pada patchcord atau bending ringan kabel dropcore.'
                        : 'Redaman melewati batas ambang toleransi (< -27 dBm). Disarankan melakukan tracing fisik sambungan fusion splice atau ODP.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={fetchOptical}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
          >
            {loading ? <Spinner /> : <span>Polling Ulang SNMP</span>}
          </button>
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


