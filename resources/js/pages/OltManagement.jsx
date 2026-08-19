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
    desc: 'VPS terhubung ke jaringan kantor via VPN L2TP Perusahaan atau Tunnel MikroTik. SNMP & Telnet langsung menjangkau IP lokal OLT.',
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

  // ── Config Form State (per device) ──────────────────────────────────────────
  const defaultConfigForm = {
    deployment_mode: 'direct',
    // SNMP
    snmp_version: 'v2c',
    snmp_community_type: 'public',
    snmp_community: '',
    snmp_port: 161,
    snmp_timeout: 5,
    // SNMPv3
    snmp_v3_username: '',
    snmp_v3_auth_protocol: 'SHA',
    snmp_v3_auth_password: '',
    snmp_v3_priv_protocol: 'AES',
    snmp_v3_priv_password: '',
    // CLI
    cli_protocol: 'telnet',
    cli_username: 'admin',
    cli_password: '',
    cli_port: 23,
    // Probe Agent
    probe_agent_url: '',
    probe_agent_token: '',
  };
  const [configForm, setConfigForm] = useState(defaultConfigForm);

  // ── Add OLT Form State ───────────────────────────────────────────────────────
  const defaultNewOltForm = {
    name: '', code: '', vendor: 'ZTE', model: 'ZXAN C300',
    location: '', ip_address: '', total_ports: 16,
    deployment_mode: 'direct', snmp_version: 'v2c',
    snmp_community_type: 'public', snmp_community: '',
  };
  const [newOltForm, setNewOltForm] = useState(defaultNewOltForm);

  // ── Edit OLT Form State ──────────────────────────────────────────────────────
  const [editOltForm, setEditOltForm] = useState({
    name: '', code: '', vendor: 'ZTE', model: 'ZXAN C300',
    location: '', ip_address: '', total_ports: 16,
    deployment_mode: 'direct', snmp_version: 'v2c',
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

  // ─── Fetch OLT Hardware Telemetry ────────────────────────────────────────────
  const fetchOltHardware = (vendorKey, deviceId) => {
    setLoading(true);
    const url = `/api/olt/hardware?vendor=${vendorKey}&device_id=${deviceId || ''}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('API ' + r.status); return r.json(); })
      .then(data => { setOltData(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // Jalankan saat OLT yang dipilih berubah — reset slot, port, dan test result
  useEffect(() => {
    setTestResult(null);
    setSelectedSlotFilter(null);
    setSelectedPortFilter(null);
  }, [selectedOltId]);

  // Jalankan saat data activeOlt berubah (termasuk setelah fetchOlts refresh)
  // TIDAK mereset testResult agar hasil tes koneksi tetap tampil
  useEffect(() => {
    if (activeOlt) {
      const vk = activeOlt.vendor_key || activeOlt.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
      fetchOltHardware(vk, activeOlt.id);
      fetchOltTopology(activeOlt.id);
      // Pre-fill config form from device data
      setConfigForm({
        ...defaultConfigForm,
        deployment_mode: activeOlt.deployment_mode || 'direct',
        snmp_version: activeOlt.snmp_version || 'v2c',
        snmp_community_type: activeOlt.snmp_community_type || 'public',
        snmp_port: activeOlt.snmp_port || 161,
        snmp_timeout: activeOlt.snmp_timeout || 5,
        cli_protocol: activeOlt.cli_protocol || 'telnet',
        cli_username: activeOlt.cli_username || 'admin',
        cli_port: activeOlt.cli_port || 23,
        probe_agent_url: activeOlt.probe_agent_url || '',
      });
    } else {
      setLoading(false);
      setOltData(null);
    }
  }, [activeOlt?.id, activeOlt?.connection_mode, activeOlt?.ip_address]);

  // ─── Test Real Connection ────────────────────────────────────────────────────
  const handleTestConnection = () => {
    if (!activeOlt) return;
    setTestingConnection(true);
    setTestResult(null);

    // First save config, then test
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
        cli_protocol: configForm.cli_protocol,
        cli_username: configForm.cli_username || undefined,
        cli_password: configForm.cli_password || undefined,
        cli_port: configForm.cli_port,
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
        // Refresh OLT list to get updated connection_mode
        fetchOlts();
      })
      .catch(() => {
        setTestResult({ message: ' Gagal menghubungi server. Pastikan php artisan serve berjalan.', connection_mode: 'simulation' });
        setTestingConnection(false);
      });
  };

  // ─── Save Config Only ────────────────────────────────────────────────────────
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
        cli_protocol: configForm.cli_protocol,
        cli_username: configForm.cli_username || undefined,
        cli_password: configForm.cli_password || undefined,
        cli_port: configForm.cli_port,
        probe_agent_url: configForm.probe_agent_url || undefined,
        probe_agent_token: configForm.probe_agent_token || undefined,
      }),
    })
      .then(r => r.json())
      .then(() => {
        setSavingConfig(false);
        showNotif(' Konfigurasi koneksi berhasil disimpan.', 'success');
        setShowConfigModal(false);
        fetchOlts();
      })
      .catch(() => {
        setSavingConfig(false);
        showNotif(' Gagal menyimpan konfigurasi.', 'error');
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
      deployment_mode: olt.deployment_mode || 'direct',
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
          // If editing active OLT, refresh hardware too
          if (selectedOltId === editingOlt.id) {
            const vk = res.data.vendor_key || res.data.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
            fetchOltHardware(vk, res.data.id);
          }
          showNotif(res.message || ' Perangkat OLT berhasil diperbarui!', 'success');
          setEditingOlt(null);
        } else {
          const errors = res.errors ? Object.values(res.errors).flat().join(' ') : '';
          showNotif(res.message || ` Gagal memperbarui OLT. ${errors}`, 'error');
        }
      })
      .catch(() => { setSubmittingEditOlt(false); showNotif(' Gagal menghubungi server.', 'error'); });
  };

  // ─── Disconnect OLT ──────────────────────────────────────────────────────────
  const handleDisconnectOlt = (olt) => {
    if (!olt) return;
    openConfirm({
      title: 'Hentikan Koneksi OLT?',
      message: (
        <span>
          Apakah Anda yakin ingin menghentikan koneksi SNMP ke OLT <strong className="text-slate-700 dark:text-slate-200">"{olt.name}"</strong> ({olt.ip_address})? Perangkat akan beralih ke mode simulasi.
        </span>
      ),
      confirmText: 'Ya, Hentikan Koneksi',
      type: 'warning',
      onConfirm: () => {
        setDisconnectingId(olt.id);
        fetch(`/api/olts/${olt.id}/disconnect`, { method: 'POST' })
          .then(r => r.json())
          .then(res => {
            setDisconnectingId(null);
            closeConfirm();
            if (res.data) {
              setOlts(prev => prev.map(o => o.id === olt.id ? res.data : o));
              if (selectedOltId === olt.id) {
                const vk = res.data.vendor_key || res.data.vendor?.toLowerCase().replace(/\s+/g, '-') || 'zte-c300';
                fetchOltHardware(vk, res.data.id);
              }
              showNotif(`⏹️ Koneksi ke ${olt.name} berhasil dihentikan.`, 'success');
            } else {
              showNotif(' Gagal menghentikan koneksi.', 'error');
            }
          })
          .catch(() => {
            setDisconnectingId(null);
            closeConfirm();
            showNotif(' Gagal menghubungi server.', 'error');
          });
      },
    });
  };

  // ─── Delete OLT ─────────────────────────────────────────────────────────────
  const handleDeleteOlt = (olt) => {
    if (!olt) return;
    const oltId = typeof olt === 'object' ? olt.id : olt;
    const oltObj = typeof olt === 'object' ? olt : olts.find(o => o.id === oltId);
    const oltName = oltObj ? oltObj.name : 'perangkat OLT ini';

    openConfirm({
      title: 'Hapus Perangkat OLT?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus <strong className="text-slate-700 dark:text-slate-200">"{oltName}"</strong> dari registry? Data konfigurasi perangkat ini akan dihapus permanen. <br />
          <span className="text-rose-600 dark:text-rose-400 font-bold mt-1 block">️ Tindakan ini tidak dapat dibatalkan!</span>
        </span>
      ),
      confirmText: 'Ya, Hapus Perangkat',
      type: 'danger',
      onConfirm: () => {
        setDeletingId(oltId);
        fetch(`/api/olts/${oltId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(res => {
            setDeletingId(oltId);
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
    return { label: ' Realtime Database UNMS', cls: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold' };
  };

  const badge = getConnectionBadge(activeOlt);

  const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium";
  const labelCls = "block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1";

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 transition-colors duration-300 stagger-enter">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-5 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Perangkat OLT
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitoring &amp; konfigurasi koneksi OLT —
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
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan OLT"
          />
          <button
            onClick={() => setShowVpnModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="Panduan VPN L2TP Perusahaan, Script MikroTik & Server Lokal On-Premise"
          >
            <IconNetwork />
            <span>Panduan Integrasi Jaringan (VPN / Local LAN)</span>
          </button>
          {canCrud && (
            <button onClick={() => setShowAddOltModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs transition-all flex items-center space-x-1.5 border border-slate-700 dark:border-slate-300">
              <IconPlus /><span>Tambah Perangkat OLT Baru</span>
            </button>
          )}
          {canCrud && (
            <button onClick={() => { setTestResult(null); setShowConfigModal(true); }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-all flex items-center space-x-1.5">
              <IconWifi /><span>Koneksikan Perangkat</span>
            </button>
          )}
          {activeOlt && activeOlt.connection_mode === 'live' && (
            <button
              onClick={() => handleDisconnectOlt(activeOlt)}
              disabled={disconnectingId === activeOlt.id}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-1.5 disabled:opacity-50">
              {disconnectingId === activeOlt.id ? <Spinner /> : <span>Hentikan Koneksi</span>}
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Daftar Perangkat OLT
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Klik salah satu kartu OLT di bawah untuk memilih perangkat aktif
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSensitiveIp(!showSensitiveIp)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${showSensitiveIp
                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              title="Hanya tim NOC / Administrator yang berhak melihat IP address"
            >
              <span>{showSensitiveIp ? '🔒 Sembunyikan IP' : '👁️ Buka IP'}</span>
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
              <div key={o.id} className={`p-3 rounded-xl border text-left transition-all group relative ${isActive ? 'bg-indigo-600 border-indigo-600 shadow-md text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700'
                }`}>
                <button onClick={() => setSelectedOltId(o.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase ${isActive ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>{o.vendor}</span>
                    <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'}`} title={isLive ? 'Live' : 'Simulation'} />
                  </div>
                  <div className="font-bold text-xs mt-1 truncate">{o.name}</div>
                  <div className={`text-[11px] font-mono mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{maskIpAddress(o.ip_address)}</div>
                  <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{o.location}</div>
                </button>
                {/* Action buttons: Disconnect + Edit + Delete */}
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
                        title="Edit perangkat">
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteOlt(o)}
                        disabled={deletingId === o.id}
                        className={`p-1 rounded-lg ${isActive ? 'text-indigo-200 hover:bg-white/20' : 'text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400'}`}
                        title="Hapus perangkat">
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
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Belum Ada Perangkat OLT Terdaftar</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Database OLT saat ini kosong. Silakan tambahkan perangkat OLT aktif Anda (ZTE, Hioso, HSGQ, Tarmoc, dll.) untuk mulai pemantauan telemetri.
          </p>
          <button
            onClick={() => setShowAddOltModal(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all inline-flex items-center space-x-2"
          >
            <IconPlus /><span>+ Tambah Perangkat OLT Baru</span>
          </button>
        </div>
      )}

      {/* ── Hardware Telemetry ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-500 dark:text-slate-400 flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Menghubungkan ke telemetri {activeOlt?.name}...</span>
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
                    ? `Data real dari OLT via SNMP — ${maskIpAddress(activeOlt?.ip_address)}`
                    : 'Data Realtime Database UNMS (OLT belum terhubung Live SNMP). Klik "Koneksikan Perangkat" untuk mengaktifkan sinkronisasi live.'}
                </span>
              </div>
              {oltData.device_info._source === 'live_snmp' && activeOlt && (
                <button
                  onClick={() => handleDisconnectOlt(activeOlt)}
                  disabled={disconnectingId === activeOlt.id}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors flex items-center space-x-1 disabled:opacity-50">
                  {disconnectingId === activeOlt.id ? <Spinner /> : <span>⏹️ Hentikan Koneksi</span>}
                </button>
              )}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Nama & Lokasi OLT</div>
              <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-2">{activeOlt?.name}</div>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">{activeOlt?.location}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">IP Address & Firmware</div>
              <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{maskIpAddress(activeOlt?.ip_address)}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Firmware: {oltData.device_info?.firmware}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">CPU & Suhu Chassis</div>
              <div className="flex items-center space-x-3 mt-2">
                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{oltData.device_info?.cpu_usage ?? '--'}%</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full" style={{ width: `${oltData.device_info?.cpu_usage ?? 0}%` }} />
                </div>
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Suhu: {oltData.device_info?.temperature ?? '--'}°C | Uptime: {oltData.device_info?.uptime ?? '--'}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
              <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">ONU Belum Terdaftar</div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                {oltData.unconfigured_onus?.length ?? 0} Perangkat
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Menunggu validasi & aktivasi manual</div>
            </div>
          </div>

          {/* Chassis cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Slot & Card — {activeOlt?.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Klik salah satu Slot Card di bawah untuk memfilter daftar Port PON</p>
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
                      : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Slot {card.slot} ({card.type})</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isSelected
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        }`}>{card.status}</span>
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
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

          {/* Auto-Discovery */}
          {oltData.unconfigured_onus?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                  <h3 className="font-bold text-amber-900 dark:text-amber-400 text-base">ONU Baru Terdeteksi — {activeOlt?.name}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50">Auto-Discovery Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {oltData.unconfigured_onus.map(onu => (
                  <div key={onu.serial_number} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{onu.serial_number}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Port: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{onu.port}</span> | {onu.vendor} ({onu.model})</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Terdeteksi: {onu.discovered_at}</div>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Terdeteksi (Registrasi via CLI/App Terpisah)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PON Ports */}
          {(() => {
            const displayPorts = selectedSlotFilter
              ? oltData.pon_ports?.filter(p => p.slot === selectedSlotFilter || p.port_id.includes(`/${selectedSlotFilter}/`))
              : oltData.pon_ports;

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                      {selectedSlotFilter
                        ? `Status Port PON & Power Optical (SFP) — Filtered [ Slot ${selectedSlotFilter} ]`
                        : `Status Port PON & Power Optical (SFP) — ${activeOlt?.name}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{port.registered_onus}</div>
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
                          {port.tx_power_dbm && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-slate-700">
                              <span>TX Optical:</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{port.tx_power_dbm} dBm</span>
                            </div>
                          )}

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
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    Topologi Pasif (ODC &amp; ODP) — Port {selectedPortFilter}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
                          <p className="text-xs text-slate-500 dark:text-slate-400"> POP Induk: <strong className="text-slate-700 dark:text-slate-200">{odc.parent_node.name}</strong></p>
                        )}

                        {/* ODP List inside ODC */}
                        {odc.odps && odc.odps.length > 0 ? (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                              ODP Terhubung ({odc.odps.length} ODP)
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {odc.odps.map(odp => (
                                <div key={odp.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs">
                                  <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{odp.name}</p>
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

          {/* ONU Table */}
          {(() => {
            const displayOnus = selectedPortFilter
              ? oltData.onu_list?.filter(onu => onu.port === selectedPortFilter || onu.port.startsWith(selectedPortFilter))
              : oltData.onu_list;

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                      {selectedPortFilter
                        ? `Daftar ONU Filtered Port [ ${selectedPortFilter} ]`
                        : `Daftar Semua ONU Terdaftar — ${activeOlt?.name}`}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedPortFilter
                        ? `Menampilkan ${displayOnus?.length ?? 0} ONU yang terhubung pada port ${selectedPortFilter}`
                        : `Menampilkan total ${displayOnus?.length ?? 0} ONU terdaftar di seluruh port`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {selectedPortFilter && (
                      <button
                        onClick={() => setSelectedPortFilter(null)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold text-xs transition-colors flex items-center space-x-1"
                      >
                        <IconX />
                        <span>Tampilkan Semua Port ({oltData.onu_list?.length ?? 0})</span>
                      </button>
                    )}
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {oltData.device_info?._source === 'live_snmp' ? ' Live SNMP Telemetry' : ' Realtime Database UNMS'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Nama Pelanggan</th>
                        <th className="px-6 py-4">Port & ONU ID</th>
                        <th className="px-6 py-4">Serial Number</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Redaman Rx Power</th>
                        <th className="px-6 py-4">Jarak Fiber</th>
                        <th className="px-6 py-4">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayOnus && displayOnus.length > 0 ? (
                        displayOnus.map(onu => (
                          <tr key={onu.serial_number} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{onu.customer_name}</td>
                            <td className="px-6 py-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{onu.port} ({onu.onu_id})</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-400">{onu.serial_number}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${onu.status === 'Online'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse'
                                }`}>{onu.status}</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold">
                              <span className={onu.rx_power < -27 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{onu.rx_power} dBm</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">{onu.distance_meters} m</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-500">{maskIpAddress(onu.ip_address)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                            Tidak ada ONU terdaftar pada port {selectedPortFilter}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Konfigurasi Koneksi OLT (Lengkap — Dual Mode)
      ══════════════════════════════════════════════════════════════════════ */}
      {showConfigModal && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Konfigurasi Koneksi OLT</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-semibold text-indigo-600 dark:text-indigo-400">{activeOlt?.name} — {maskIpAddress(activeOlt?.ip_address)}</p>
              </div>
              <button onClick={() => { setShowConfigModal(false); setTestResult(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">

              {/* ── Section 1: Deployment Mode ────────────────────────────── */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span>Mode Deployment Server</span>
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
                        <div className={`text-xs font-bold mt-1 ${selected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{mode.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{mode.desc}</div>
                        {selected && <div className="mt-1.5 text-indigo-600 dark:text-indigo-400"><IconCheck size="w-3.5 h-3.5" /></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 2: SNMP Configuration ───────────────────────────── */}
              {configForm.deployment_mode !== 'probe' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                    <span>Konfigurasi SNMP</span>
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
                            {v === 'v2c' ? 'Community String' : 'Username + Auth/Priv'}
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
                            placeholder="Masukkan community string..."
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

                  {/* Advanced SNMP options */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Port SNMP</label>
                      <input type="number" value={configForm.snmp_port}
                        onChange={e => setConfigForm({ ...configForm, snmp_port: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Timeout (detik)</label>
                      <input type="number" value={configForm.snmp_timeout}
                        onChange={e => setConfigForm({ ...configForm, snmp_timeout: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 3: CLI (Telnet/SSH) ─────────────────────────────── */}
              {configForm.deployment_mode !== 'probe' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                    <span>Konfigurasi CLI (Telnet/SSH) — Opsional</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Protokol CLI</label>
                      <div className="flex space-x-2">
                        {['telnet', 'ssh'].map(p => (
                          <button key={p} type="button"
                            onClick={() => setConfigForm({ ...configForm, cli_protocol: p, cli_port: p === 'ssh' ? 22 : 23 })}
                            className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${configForm.cli_protocol === p
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500'
                              }`}>
                            {p === 'telnet' ? ' Telnet (23)' : ' SSH (22)'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Port CLI</label>
                      <input type="number" value={configForm.cli_port}
                        onChange={e => setConfigForm({ ...configForm, cli_port: parseInt(e.target.value) })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Username CLI</label>
                      <input type="text" value={configForm.cli_username}
                        onChange={e => setConfigForm({ ...configForm, cli_username: e.target.value })}
                        placeholder="admin" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Password CLI</label>
                      <input type="password" value={configForm.cli_password}
                        onChange={e => setConfigForm({ ...configForm, cli_password: e.target.value })}
                        placeholder="••••••••" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 4: Probe Agent ─────────────────────────────────── */}
              {configForm.deployment_mode === 'probe' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                    <span>Konfigurasi NMS Probe Agent</span>
                  </h4>
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-400 font-medium space-y-1">
                    <div className="font-bold"> Cara kerja Probe Agent:</div>
                    <div>1. Install NMS Probe Agent di server dalam jaringan ISP (akses ke OLT)</div>
                    <div>2. Probe Agent akan menjembatani query SNMP dari cloud UNMS ke OLT</div>
                    <div>3. Masukkan URL dan token API Probe Agent di bawah</div>
                    <div className="text-amber-600 dark:text-amber-500 italic mt-1">️ Probe Agent adalah fitur Phase 4 — saat ini dalam pengembangan</div>
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

              {/* ── Testing In Progress Indicator ─────────────────────────── */}
              {testingConnection && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Sedang Menguji Koneksi...</div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Menyimpan konfigurasi → Ping ke OLT → Uji SNMP</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-indigo-600 dark:text-indigo-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Target: <span className="font-mono font-bold">{activeOlt?.ip_address}</span></span>
                    <span className="text-indigo-300 dark:text-indigo-600">|</span>
                    <span>Mode: <span className="font-bold">{configForm.deployment_mode}</span></span>
                    <span className="text-indigo-300 dark:text-indigo-600">|</span>
                    <span>SNMP: <span className="font-bold">{configForm.snmp_version?.toUpperCase()}</span></span>
                  </div>
                </div>
              )}

              {/* ── Test Connection Result ─────────────────────────────────── */}
              {!testingConnection && testResult && (() => {
                const isSuccess = testResult.ready_for_live;
                const isPartial = !isSuccess && testResult.ping?.success;
                const isFailed = !isSuccess && !testResult.ping?.success;

                const statusConfig = isSuccess
                  ? { bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-300 dark:border-emerald-700', badge: 'bg-emerald-500', badgeText: 'KONEKSI BERHASIL', icon: '', headerText: 'text-emerald-800 dark:text-emerald-200', subText: 'text-emerald-700 dark:text-emerald-300' }
                  : isPartial
                    ? { bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-amber-300 dark:border-amber-700', badge: 'bg-amber-500', badgeText: 'TERHUBUNG SEBAGIAN', icon: '️', headerText: 'text-amber-800 dark:text-amber-200', subText: 'text-amber-700 dark:text-amber-300' }
                    : { bg: 'bg-rose-50 dark:bg-rose-900/15', border: 'border-rose-300 dark:border-rose-700', badge: 'bg-rose-500', badgeText: 'KONEKSI GAGAL', icon: '', headerText: 'text-rose-800 dark:text-rose-200', subText: 'text-rose-700 dark:text-rose-300' };

                return (
                  <div className={`rounded-xl border-2 ${statusConfig.bg} ${statusConfig.border} overflow-hidden`}>

                    {/* Result Header Banner */}
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

                    {/* Test Detail Cards */}
                    <div className="p-4 space-y-3">

                      {/* Ping & SNMP grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

                        {/* Ping Result */}
                        {testResult.ping && (
                          <div className={`rounded-lg p-3 border flex items-start space-x-2.5 ${testResult.ping.success
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'
                            }`}>
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${testResult.ping.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {testResult.ping.success ? '' : ''}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${testResult.ping.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                Ping / ICMP
                              </div>
                              <div className={`text-xs mt-0.5 font-mono ${testResult.ping.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.ping.success
                                  ? ` Merespon dalam ${testResult.ping.latency_ms} ms`
                                  : ` ${testResult.ping.error || 'Host tidak merespon'}`}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* SNMP Result */}
                        {testResult.snmp && (
                          <div className={`rounded-lg p-3 border flex items-start space-x-2.5 ${testResult.snmp.success
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'
                            }`}>
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${testResult.snmp.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {testResult.snmp.success ? '' : ''}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${testResult.snmp.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                SNMP {testResult.snmp.snmp_version ? testResult.snmp.snmp_version.toUpperCase() : ''}
                              </div>
                              <div className={`text-xs mt-0.5 font-mono ${testResult.snmp.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.snmp.success
                                  ? ' Autentikasi berhasil'
                                  : ` ${testResult.snmp.error || 'Tidak merespon'}`}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Probe Result */}
                        {testResult.probe && (
                          <div className={`rounded-lg p-3 border flex items-start space-x-2.5 sm:col-span-2 ${testResult.probe.success
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800'
                            }`}>
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${testResult.probe.success ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                              {testResult.probe.success ? '' : ''}
                            </div>
                            <div>
                              <div className={`text-xs font-bold ${testResult.probe.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                Probe Agent
                              </div>
                              <div className={`text-xs mt-0.5 ${testResult.probe.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {testResult.probe.success
                                  ? ` Terhubung — versi ${testResult.probe.agent_version || 'unknown'}`
                                  : ` ${testResult.probe.error || 'Probe Agent tidak merespon'}`}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PHP SNMP Extension Warning */}
                      {testResult.snmp?.extension_missing && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3 flex items-start space-x-2.5">
                          <span className="text-amber-500 text-base flex-shrink-0">️</span>
                          <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                            <span className="font-bold">PHP SNMP extension tidak aktif.</span> Aktifkan dengan menambahkan{' '}
                            <code className="bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-mono">extension=snmp</code>{' '}
                            pada file <code className="bg-amber-200 dark:bg-amber-800/60 px-1 py-0.5 rounded font-mono">php.ini</code>.
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {testResult.recommendations?.length > 0 && (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                          <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <span></span><span>Langkah Perbaikan</span>
                          </div>
                          <ul className="space-y-1.5">
                            {testResult.recommendations.map((r, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start space-x-2">
                                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black mt-0.5">{i + 1}</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Success message */}
                      {isSuccess && (
                        <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center space-x-2">
                          <span className="text-base"></span>
                          <span>Perangkat OLT siap digunakan dalam mode <strong>Live SNMP</strong>. Data telemetri real akan segera tersedia.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <button onClick={() => { setShowConfigModal(false); setTestResult(null); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Tutup
              </button>
              <div className="flex items-center space-x-2">
                <button onClick={handleTestConnection} disabled={testingConnection || savingConfig}
                  className="px-4 py-2.5 rounded-xl bg-slate-700 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50">
                  {testingConnection ? <><Spinner /><span>Menguji Koneksi...</span></> : <><IconWifi /><span>Tes Koneksi</span></>}
                </button>
                <button onClick={handleSaveConfig} disabled={savingConfig || testingConnection}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {savingConfig ? <><Spinner /><span>Menyimpan...</span></> : <><IconCheck /><span>Simpan Konfigurasi</span></>}
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
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tambah Perangkat OLT Baru</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daftarkan OLT baru di wilayah / POP site yang berbeda</p>
              </div>
              <button onClick={() => setShowAddOltModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <form onSubmit={handleAddOlt} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nama OLT (Label Identifikasi)</label>
                  <input type="text" value={newOltForm.name}
                    onChange={e => setNewOltForm({ ...newOltForm, name: e.target.value })}
                    placeholder="OLT ZTE C300 Kota Solok" required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Kode Node Unik</label>
                  <input type="text" value={newOltForm.code}
                    onChange={e => setNewOltForm({ ...newOltForm, code: e.target.value.toUpperCase() })}
                    placeholder="OLT-SLK-01" required
                    className={inputCls + ' uppercase font-mono'} />
                </div>
                <div>
                  <label className={labelCls}>Vendor & Tipe Perangkat</label>
                  <select value={newOltForm.vendor}
                    onChange={e => {
                      const v = e.target.value;
                      const map = { 'ZTE': ['ZXAN C300', 16], 'ZTE C320': ['ZXAN C320', 8], 'Hioso': ['HA7302CS', 2], 'HSGQ': ['G004 4-Port', 4], 'Tarmoc': ['TMC-EP8', 8] };
                      const [model, ports] = map[v] || ['Unknown', 4];
                      setNewOltForm({ ...newOltForm, vendor: v, model, total_ports: ports });
                    }}
                    className={inputCls}>
                    <option value="ZTE">ZTE C300 (Modular 16-Port)</option>
                    <option value="ZTE C320">ZTE C320 (Compact 8-Port)</option>
                    <option value="Hioso">Hioso HA7302CS (2-Port EPON)</option>
                    <option value="HSGQ">HSGQ G004 (4-Port GPON)</option>
                    <option value="Tarmoc">Tarmoc TMC-EP8 (8-Port EPON)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Lokasi / Wilayah / POP Site</label>
                  <input type="text" value={newOltForm.location}
                    onChange={e => setNewOltForm({ ...newOltForm, location: e.target.value })}
                    placeholder="Kota Solok (POP Solok Central)" required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>IP Address Manajemen OLT (IP Lokal / VPN)</label>
                  <input type="text" value={newOltForm.ip_address}
                    onChange={e => setNewOltForm({ ...newOltForm, ip_address: e.target.value })}
                    placeholder="192.168.1.100 atau 10.10.20.1" required className={inputCls + ' font-mono'} />
                  <p className="text-[10px] text-neutral-500 mt-1">Masukkan IP lokal OLT (didukung via VPN L2TP/MikroTik).</p>
                </div>
                <div>
                  <label className={labelCls}>Mode Deployment</label>
                  <select value={newOltForm.deployment_mode}
                    onChange={e => setNewOltForm({ ...newOltForm, deployment_mode: e.target.value })}
                    className={inputCls}>
                    <option value="vpn">VPN Tunnel / L2TP Perusahaan (Rekomendasi)</option>
                    <option value="direct">Direct LAN (Satu Jaringan)</option>
                    <option value="probe">Local Probe Agent (Cloud External)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Versi SNMP</label>
                  <select value={newOltForm.snmp_version}
                    onChange={e => setNewOltForm({ ...newOltForm, snmp_version: e.target.value })}
                    className={inputCls}>
                    <option value="v2c">SNMPv2c (Community String)</option>
                    <option value="v3">SNMPv3 (Username + Auth/Priv)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>SNMP Community</label>
                  <div className="flex space-x-2">
                    {['public', 'custom'].map(ct => (
                      <button key={ct} type="button"
                        onClick={() => setNewOltForm({ ...newOltForm, snmp_community_type: ct })}
                        className={`flex-1 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${newOltForm.snmp_community_type === ct
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                        {ct === 'public' ? 'public' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>
                {newOltForm.snmp_community_type === 'custom' && (
                  <div className="md:col-span-2">
                    <label className={labelCls}>Custom Community String</label>
                    <input type="text" value={newOltForm.snmp_community}
                      onChange={e => setNewOltForm({ ...newOltForm, snmp_community: e.target.value })}
                      placeholder="Masukkan community string..." className={inputCls} />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button type="button" onClick={() => setShowAddOltModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700">
                  Batal
                </button>
                <button type="submit" disabled={submittingOlt}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {submittingOlt ? <><Spinner /><span>Mendaftarkan OLT...</span></> : <><IconCheck /><span>Simpan &amp; Daftarkan OLT</span></>}
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
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <IconEdit />
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit Perangkat OLT</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Memperbarui informasi dasar — <span className="font-semibold text-indigo-600 dark:text-indigo-400">{editingOlt.name}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowEditOltModal(false); setEditingOlt(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <IconX />
              </button>
            </div>

            <form onSubmit={handleEditOlt} className="p-6 space-y-4 overflow-y-auto flex-1">

              {/* Info banner */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 rounded-xl px-4 py-3 text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                Perubahan informasi dasar tidak akan mempengaruhi konfigurasi koneksi SNMP/CLI. Gunakan tombol <strong>"Koneksikan Perangkat"</strong> untuk mengubah konfigurasi koneksi.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Nama OLT */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Nama OLT (Label Identifikasi)</label>
                  <input
                    type="text"
                    value={editOltForm.name}
                    onChange={e => setEditOltForm({ ...editOltForm, name: e.target.value })}
                    placeholder="OLT ZTE C300 Kota Solok"
                    required
                    className={inputCls}
                  />
                </div>

                {/* Kode Node */}
                <div>
                  <label className={labelCls}>Kode Node Unik</label>
                  <input
                    type="text"
                    value={editOltForm.code}
                    onChange={e => setEditOltForm({ ...editOltForm, code: e.target.value.toUpperCase() })}
                    placeholder="OLT-SLK-01"
                    required
                    className={inputCls + ' uppercase font-mono'}
                  />
                </div>

                {/* IP Address */}
                <div>
                  <label className={labelCls}>IP Address Manajemen OLT (IP Lokal / VPN)</label>
                  <input
                    type="text"
                    value={editOltForm.ip_address}
                    onChange={e => setEditOltForm({ ...editOltForm, ip_address: e.target.value })}
                    placeholder="192.168.1.100 atau 10.10.20.1"
                    required
                    className={inputCls + ' font-mono'}
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Masukkan IP lokal OLT jika terhubung via VPN.</p>
                </div>

                {/* Vendor */}
                <div>
                  <label className={labelCls}>Vendor & Tipe Perangkat</label>
                  <select
                    value={editOltForm.vendor}
                    onChange={e => {
                      const v = e.target.value;
                      const map = { 'ZTE': ['ZXAN C300', 16], 'ZTE C320': ['ZXAN C320', 8], 'Hioso': ['HA7302CS', 2], 'HSGQ': ['G004 4-Port', 4], 'Tarmoc': ['TMC-EP8', 8] };
                      const [model, ports] = map[v] || [editOltForm.model, editOltForm.total_ports];
                      setEditOltForm({ ...editOltForm, vendor: v, model, total_ports: ports });
                    }}
                    className={inputCls}>
                    <option value="ZTE">ZTE C300 (Modular 16-Port)</option>
                    <option value="ZTE C320">ZTE C320 (Compact 8-Port)</option>
                    <option value="Hioso">Hioso HA7302CS (2-Port EPON)</option>
                    <option value="HSGQ">HSGQ G004 (4-Port GPON)</option>
                    <option value="Tarmoc">Tarmoc TMC-EP8 (8-Port EPON)</option>
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className={labelCls}>Model Perangkat</label>
                  <input
                    type="text"
                    value={editOltForm.model}
                    onChange={e => setEditOltForm({ ...editOltForm, model: e.target.value })}
                    placeholder="ZXAN C300"
                    required
                    className={inputCls}
                  />
                </div>

                {/* Lokasi */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Lokasi / Wilayah / POP Site</label>
                  <input
                    type="text"
                    value={editOltForm.location}
                    onChange={e => setEditOltForm({ ...editOltForm, location: e.target.value })}
                    placeholder="Kota Solok (POP Solok Central)"
                    required
                    className={inputCls}
                  />
                </div>

                {/* Total Ports */}
                <div>
                  <label className={labelCls}>Total Port PON</label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={editOltForm.total_ports}
                    onChange={e => setEditOltForm({ ...editOltForm, total_ports: Number(e.target.value) })}
                    required
                    className={inputCls}
                  />
                </div>

                {/* Deployment Mode */}
                <div>
                  <label className={labelCls}>Mode Deployment</label>
                  <select
                    value={editOltForm.deployment_mode}
                    onChange={e => setEditOltForm({ ...editOltForm, deployment_mode: e.target.value })}
                    className={inputCls}>
                    <option value="vpn">VPN Tunnel / L2TP Perusahaan (Rekomendasi)</option>
                    <option value="direct">Direct LAN (Satu Jaringan)</option>
                    <option value="probe">Local Probe Agent (Cloud External)</option>
                  </select>
                </div>

                {/* SNMP Version */}
                <div>
                  <label className={labelCls}>Versi SNMP</label>
                  <select
                    value={editOltForm.snmp_version}
                    onChange={e => setEditOltForm({ ...editOltForm, snmp_version: e.target.value })}
                    className={inputCls}>
                    <option value="v2c">SNMPv2c (Community String)</option>
                    <option value="v3">SNMPv3 (Username + Auth/Priv)</option>
                  </select>
                </div>

                {/* SNMP Community Type */}
                <div>
                  <label className={labelCls}>SNMP Community</label>
                  <div className="flex space-x-2">
                    {['public', 'custom'].map(ct => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setEditOltForm({ ...editOltForm, snmp_community_type: ct })}
                        className={`flex-1 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${editOltForm.snmp_community_type === ct
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                          }`}>
                        {ct === 'public' ? ' public' : ' Custom'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setShowEditOltModal(false); setEditingOlt(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingEditOlt}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50">
                  {submittingEditOlt
                    ? <><Spinner /><span>Menyimpan...</span></>
                    : <><IconCheck /><span>Simpan Perubahan</span></>}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Panduan VPN & Generator Script MikroTik
      ══════════════════════════════════════════════════════════════════════ */}
      <VpnMikrotikBridgeModal
        isOpen={showVpnModal}
        onClose={() => setShowVpnModal(false)}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Custom Confirm Dialog (Ganti window.confirm)
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
