import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';

export default function CustomerManagement() {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
  const [customers, setCustomers] = useState([]);
  const [odpNodes, setOdpNodes] = useState([]);
  const [odcNodes, setOdcNodes] = useState([]);
  const [olts, setOlts] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOlt, setFilterOlt] = useState('all');
  const [filterOdc, setFilterOdc] = useState('all');
  const [filterOdp, setFilterOdp] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterOlt, filterOdc, filterOdp]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [toast, setToast] = useState(null);

  // Diagnostics Modal State
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [activeDiagnosticCustomer, setActiveDiagnosticCustomer] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [pingingLive, setPingingLive] = useState(false);

  const openDiagnosticsModal = async (c) => {
    setActiveDiagnosticCustomer(c);
    setShowDiagnosticsModal(true);
    setLoadingDiagnostics(true);
    setDiagnosticsData(null);
    try {
      const res = await fetch(`/api/customers/${c.id}/diagnostics`);
      const d = await res.json();
      if (d.status === 'success') {
        setDiagnosticsData(d);
      } else {
        showToastMsg('Gagal memuat data diagnostik pelanggan', 'error');
      }
    } catch {
      showToastMsg('Terjadi kesalahan saat memuat diagnostik', 'error');
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleRunLivePing = async () => {
    if (!activeDiagnosticCustomer) return;
    setPingingLive(true);
    try {
      const res = await fetch(`/api/customers/${activeDiagnosticCustomer.id}/diagnostics`, {
        method: 'POST',
      });
      const d = await res.json();
      if (d.status === 'success') {
        setDiagnosticsData(d);
        showToastMsg(`⚡ Uji Ping ke ${d.ping?.target_ip || 'Modem'}: ${d.ping?.latency_ms || 0} ms`);
      }
    } catch {
      showToastMsg('Gagal menjalankan uji ping langsung', 'error');
    } finally {
      setPingingLive(false);
    }
  };

  // OLT Auto-Discovery Wizard State
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [unmappedOnus, setUnmappedOnus] = useState([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [provisionForms, setProvisionForms] = useState({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Hapus',
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

  // ODP Ports for selection
  const [odpPorts, setOdpPorts] = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);

  // Form State
  const [form, setForm] = useState({
    customer_number: '',
    name: '',
    address: '',
    status: 'active',
    odp_id: '',
    odp_port_number: '',
    onu_serial: '',
    rx_power: '-18.5',
  });

  const showToastMsg = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Customers (Silent background refresh to prevent UI flickering / scroll reset)
  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/customers');
      const d = await r.json();
      if (d.data) {
        setCustomers(d.data);
      }
    } catch {
      // Keep existing data on background error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch ODP Nodes
  const fetchOdpNodes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes?type=ODP');
      const d = await r.json();
      if (d.data) setOdpNodes(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch ODC Nodes
  const fetchOdcNodes = useCallback(async () => {
    try {
      const r = await fetch('/api/network-nodes?type=ODC');
      const d = await r.json();
      if (d.data) setOdcNodes(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch OLT Devices
  const fetchOlts = useCallback(async () => {
    try {
      const r = await fetch('/api/olts');
      const d = await r.json();
      if (d.data) setOlts(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  // Fetch Service Packages
  const fetchServicePackages = useCallback(async () => {
    try {
      const r = await fetch('/api/service-packages');
      const d = await r.json();
      if (d.data) setServicePackages(d.data);
    } catch {
      // Keep existing data
    }
  }, []);

  useEffect(() => {
    fetchCustomers(false);
    fetchOdpNodes();
    fetchOdcNodes();
    fetchOlts();
    fetchServicePackages();
  }, [fetchCustomers, fetchOdpNodes, fetchOdcNodes, fetchOlts, fetchServicePackages]);

  const refreshAllData = useCallback(async (silent = true) => {
    await Promise.all([
      fetchCustomers(silent),
      fetchOdpNodes(),
      fetchOdcNodes(),
      fetchOlts(),
      fetchServicePackages()
    ]);
  }, [fetchCustomers, fetchOdpNodes, fetchOdcNodes, fetchOlts, fetchServicePackages]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(refreshAllData);

  // Fetch Unmapped ONUs from OLT Devices
  const fetchUnmappedOnus = async () => {
    setLoadingDiscovery(true);
    try {
      const res = await fetch('/api/customers/unmapped-onus');
      const d = await res.json();
      const onus = d.data ?? [];
      setUnmappedOnus(onus);

      const initialForms = {};
      onus.forEach(o => {
        initialForms[o.serial_number] = {
          customer_number: '',
          name: '',
          address: 'Solok, Sumatera Barat',
          odp_id: odpNodes.length > 0 ? odpNodes[0].id : '',
          odp_port_number: '1',
        };
      });
      setProvisionForms(initialForms);
    } catch (e) {
      console.error('Error fetching unmapped ONUs:', e);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const handleOpenDiscoveryModal = () => {
    setShowDiscoveryModal(true);
    fetchUnmappedOnus();
  };

  const handleSingleProvision = async (onu) => {
    const itemData = provisionForms[onu.serial_number];
    if (!itemData || !itemData.name.trim()) {
      showToastMsg('Harap masukkan nama pelanggan terlebih dahulu!', 'error');
      return;
    }

    setBatchSubmitting(true);
    try {
      const res = await fetch('/api/customers/batch-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            customer_number: itemData.customer_number,
            name: itemData.name,
            address: itemData.address,
            onu_serial: onu.serial_number,
            odp_id: itemData.odp_id,
            odp_port_number: itemData.odp_port_number,
          }]
        }),
      });

      const d = await res.json();
      if (d.status === 'success') {
        showToastMsg(`Pelanggan ${itemData.name} berhasil terhubung dari OLT ke ODP!`);
        fetchCustomers();
        setUnmappedOnus(prev => prev.filter(o => o.serial_number !== onu.serial_number));
      } else {
        showToastMsg(d.message || 'Gagal meregister pelanggan', 'error');
      }
    } catch (e) {
      showToastMsg('Terjadi kesalahan koneksi server', 'error');
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Fetch Ports when an ODP is selected in the modal
  const fetchOdpPorts = async (nodeId) => {
    if (!nodeId) {
      setOdpPorts([]);
      return;
    }
    setLoadingPorts(true);
    try {
      const r = await fetch(`/api/network-nodes/${nodeId}/port-detail`);
      const d = await r.json();
      setOdpPorts(d.ports ?? []);
    } catch {
      setOdpPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  const handleOdpChange = (e) => {
    const odpId = e.target.value;
    setForm(f => ({ ...f, odp_id: odpId, odp_port_number: '' }));
    fetchOdpPorts(odpId);
  };

  // ─── Auto-open Add Customer modal if navigated from OLT Belum Terdaftar ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' || params.get('onu_sn')) {
      const onuSn = params.get('onu_sn') || '';
      const onuName = params.get('onu_name') || '';
      setEditingCustomer(null);
      setForm({
        customer_number: '',
        name: onuName && !onuName.startsWith('ONU ') ? onuName : '',
        address: '',
        status: 'active',
        odp_id: '',
        odp_port_number: '',
        onu_serial: onuSn,
        rx_power: '-18.5',
      });
      setOdpPorts([]);
      setFormErr(null);
      setShowModal(true);
    }
  }, []);

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm({
      customer_number: '',
      name: '',
      address: '',
      status: 'active',
      odp_id: '',
      odp_port_number: '',
      onu_serial: sprintf('HWTC-%08X', randInt(10000000, 99999999)),
      rx_power: '-18.5',
    });
    setOdpPorts([]);
    setFormErr(null);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setForm({
      customer_number: c.customer_number ?? '',
      name: c.name ?? '',
      address: c.address ?? '',
      status: c.status ?? 'active',
      odp_id: c.odp_id ?? '',
      odp_port_number: c.odp_port_number ?? '',
      onu_serial: c.onu_serial ?? '',
      rx_power: c.rx_power != null ? String(c.rx_power) : '-18.5',
    });
    setFormErr(null);
    setShowModal(true);
    if (c.odp_id) {
      fetchOdpPorts(c.odp_id);
    } else {
      setOdpPorts([]);
    }
  };

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const sprintf = (format, ...args) => {
    let i = 0;
    return format.replace(/%08X|%d/g, (match) => {
      if (match === '%08X') return args[i++].toString(16).toUpperCase().padStart(8, '0');
      return args[i++];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);

    const isEdit = !!editingCustomer;
    const url = isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify(form),
      });

      const res = await r.json();
      if (!r.ok) {
        throw new Error(res.message || 'Gagal menyimpan data pelanggan');
      }

      showToastMsg(isEdit ? 'Data pelanggan berhasil diperbarui!' : 'Pelanggan baru & koneksi ODP berhasil terdaftar!');
      setShowModal(false);
      fetchCustomers();
      fetchOdpNodes();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c) => {
    if (!c) return;
    openConfirm({
      title: 'Hapus Data Pelanggan?',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus data pelanggan <strong className="text-slate-900 dark:text-white">"{c.name}"</strong> ({c.customer_number || `CMN ${c.id}`})? <br />
          <span className="text-rose-600 dark:text-rose-400 font-bold mt-1 block">Port ODP yang terhubung akan dilepaskan otomatis.</span>
        </span>
      ),
      confirmText: 'Ya, Hapus Pelanggan',
      type: 'danger',
      onConfirm: async () => {
        try {
          const r = await fetch(`/api/customers/${c.id}`, {
            method: 'DELETE',
            headers: {
              'Accept': 'application/json',
              'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
          });
          closeConfirm();
          if (r.ok) {
            showToastMsg('Pelanggan berhasil dihapus & Port ODP dilepaskan.');
            fetchCustomers();
          } else {
            showToastMsg('Gagal menghapus pelanggan', 'error');
          }
        } catch {
          closeConfirm();
          showToastMsg('Gagal menghapus pelanggan', 'error');
        }
      },
    });
  };

  // Filtered customers (Multi-level OLT / ODC / ODP / Status / Search)
  const filtered = useMemo(() => {
    return customers.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.customer_number?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.package_name?.toLowerCase().includes(q) ||
        c.odp_name?.toLowerCase().includes(q) ||
        c.odp_code?.toLowerCase().includes(q) ||
        c.odc_name?.toLowerCase().includes(q) ||
        c.odc_code?.toLowerCase().includes(q) ||
        c.olt_name?.toLowerCase().includes(q) ||
        c.onu_serial?.toLowerCase().includes(q) ||
        c.ip_address?.toLowerCase().includes(q);

      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchOlt = filterOlt === 'all' || String(c.olt_id) === String(filterOlt) || c.olt_name === filterOlt;
      const matchOdc = filterOdc === 'all' || String(c.odc_id) === String(filterOdc) || c.odc_name === filterOdc;
      const matchOdp = filterOdp === 'all' || String(c.odp_id) === String(filterOdp) || c.odp_name === filterOdp;

      return matchSearch && matchStatus && matchOlt && matchOdc && matchOdp;
    });
  }, [customers, search, filterStatus, filterOlt, filterOdc, filterOdp]);

  // Overall Statistics for KPI Cards
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === 'active').length;
    const suspended = customers.filter(c => c.status === 'suspended').length;
    const normalSignal = customers.filter(c => {
      const rx = parseFloat(c.rx_power);
      return !isNaN(rx) && rx >= -24.0 && rx > -40;
    }).length;
    const lossSignal = customers.filter(c => {
      const rx = parseFloat(c.rx_power);
      return c.status !== 'active' || isNaN(rx) || rx <= -40 || rx < -27.0;
    }).length;

    return { total, active, suspended, normalSignal, lossSignal };
  }, [customers]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const isFilterActive = search || filterStatus !== 'all' || filterOlt !== 'all' || filterOdc !== 'all' || filterOdp !== 'all';
  const handleResetFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterOlt('all');
    setFilterOdc('all');
    setFilterOdp('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[999999] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-3 duration-200 ${
          toast.type === 'error'
            ? 'bg-rose-600 text-white border-rose-700 shadow-rose-500/20'
            : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ─── HEADER BANNER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
                  Manajemen Pelanggan &amp; Pemetaan FTTH
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live FTTH Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring koneksi OLT, ODC, ODP, live redaman optik dBm, dan uji ping latensi pelanggan secara real-time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
          />
          {canCrud && (
            <>
              <button
                type="button"
                onClick={handleOpenDiscoveryModal}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Auto-Discover ONU ({unmappedOnus.length > 0 ? unmappedOnus.length : 'OLT Sync'})</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Registrasi Manual</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── 4 KARTU STATISTIK UTAMA PELANGGAN (KPI) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Pelanggan */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Pelanggan</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-950 dark:text-white mt-1">
              {stats.total.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Terdaftar di UNMS</p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        {/* 2. Pelanggan Aktif */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status Aktif</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.active.toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {stats.total > 0 ? `${((stats.active / stats.total) * 100).toFixed(1)}% Dari Total` : '100%'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* 3. Sinyal Optik Prima */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Optik Normal</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">
              {stats.normalSignal.toLocaleString()}
            </div>
            <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1">≥ -24.0 dBm (Prima)</p>
          </div>
          <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        {/* 4. Isolir / Redaman Loss */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Isolir / Kritis</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
              {(stats.suspended + stats.lossSignal).toLocaleString()}
            </div>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
              {stats.suspended} Isolir • {stats.lossSignal} Loss
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & HIERARCHICAL MULTI-LEVEL FILTER BAR ─── */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="w-full lg:w-96 relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari ID, nama pelanggan, ODP, SN modem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Filter OLT */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">OLT:</span>
              <select
                value={filterOlt}
                onChange={(e) => setFilterOlt(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua OLT</option>
                {olts.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({o.vendor})</option>
                ))}
              </select>
            </div>

            {/* Filter ODC */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">ODC:</span>
              <select
                value={filterOdc}
                onChange={(e) => setFilterOdc(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua ODC</option>
                {odcNodes.map(odc => (
                  <option key={odc.id} value={odc.id}>{odc.name} ({odc.code})</option>
                ))}
              </select>
            </div>

            {/* Filter ODP */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">ODP:</span>
              <select
                value={filterOdp}
                onChange={(e) => setFilterOdp(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua ODP</option>
                {odpNodes.map(odp => (
                  <option key={odp.id} value={odp.id}>{odp.name} ({odp.code})</option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="suspended">Suspended / Isolir</option>
            </select>

            {/* Reset Filters */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl hover:bg-rose-100 transition-all cursor-pointer"
                title="Reset Semua Filter"
              >
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Stats */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div>
            Menampilkan: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filtered.length}</span> dari {customers.length} total pelanggan
          </div>
          {isFilterActive && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              * Filter aktif diterapkan
            </div>
          )}
        </div>
      </div>

      {/* ─── CUSTOMER DATA CONTENT AREA ─── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-20 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-semibold text-slate-600 dark:text-slate-300">Memuat data pelanggan &amp; telemetri ODP...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto text-xl font-bold">
            🔍
          </div>
          <p className="font-bold text-sm text-slate-900 dark:text-white">Belum Ada Pelanggan Ditemukan</p>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Coba sesuaikan kriteria filter pencarian atau gunakan tombol Registrasi Manual untuk mendaftarkan pelanggan baru.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 uppercase font-bold text-slate-700 dark:text-slate-300 text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">ID Pelanggan</th>
                    <th className="px-4 py-3.5">Nama Pelanggan</th>
                    <th className="px-4 py-3.5">ODC &amp; ODP</th>
                    <th className="px-4 py-3.5">OLT &amp; Interface</th>
                    <th className="px-4 py-3.5">Serial (SN) &amp; Sinyal Rx</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {paginated.map(c => {
                    const isOffline = c.status !== 'active' || c.onu_status === 'Offline' || c.onu_status === 'LOS (Dying Gasp)' || c.rx_power === null || parseFloat(c.rx_power) <= -40;
                    const rx = isOffline ? null : (c.rx_power != null ? parseFloat(c.rx_power) : null);
                    let rxLabel = '—';
                    let rxBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';

                    if (isOffline) {
                      rxLabel = 'Loss';
                      rxBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
                    } else if (rx !== null) {
                      rxLabel = `${rx.toFixed(1)} dBm`;
                      if (rx >= -19.0) {
                        rxBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
                      } else if (rx >= -24.0) {
                        rxBadgeClass = 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800';
                      } else if (rx >= -27.0) {
                        rxBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
                      } else {
                        rxBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
                      }
                    }

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 1. ID Pelanggan */}
                        <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">
                          {c.customer_number || `CMN ${String(c.id).padStart(4, '0')}`}
                        </td>

                        {/* 2. Nama Pelanggan */}
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-slate-950 dark:text-white block">{c.name}</span>
                          {c.phone && c.phone !== '-' && (
                            <span className="text-slate-400 text-[11px] block">{c.phone}</span>
                          )}
                        </td>

                        {/* 3. ODC & ODP */}
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                          {c.odp_name ? (
                            <span>
                              {c.odc_name ? `${c.odc_name} / ` : ''}
                              <strong>{c.odp_name}</strong>
                              {c.odp_port_number ? ` (Port ${c.odp_port_number})` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Belum terhubung</span>
                          )}
                        </td>

                        {/* 4. OLT & Interface */}
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                          <span>{c.olt_name || 'OLT Solok'} ({c.gpon_interface || '1/1/1'})</span>
                        </td>

                        {/* 5. Serial (SN) & Sinyal Rx */}
                        <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span>{c.onu_serial || '—'}</span>
                          {rxLabel !== '—' && (
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${rxBadgeClass}`}>
                              {rxLabel}
                            </span>
                          )}
                        </td>

                        {/* 6. Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            c.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          }`}>
                            {c.status === 'active' ? 'Aktif' : 'Isolir'}
                          </span>
                        </td>

                        {/* 7. Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => openDiagnosticsModal(c)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer"
                          >
                            Diagnostik
                          </button>
                          {canCrud && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(c)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(c)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 transition-all cursor-pointer"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination Bar */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Menampilkan data <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</strong> - <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, filtered.length)}</strong> dari total <strong className="text-indigo-600 dark:text-indigo-400">{filtered.length}</strong> pelanggan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {paginated.map((c, idx) => {
              const globalIndex = (currentPage - 1) * perPage + idx + 1;
              const isOffline = c.status !== 'active' || c.onu_status === 'Offline' || c.onu_status === 'LOS (Dying Gasp)' || c.rx_power === null || parseFloat(c.rx_power) <= -40;
              const rx = isOffline ? null : (c.rx_power != null ? parseFloat(c.rx_power) : null);
              let rxLabel = '—';
              let rxBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';

              if (isOffline) {
                rxLabel = 'Loss';
                rxBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
              } else if (rx !== null) {
                rxLabel = `${rx.toFixed(1)} dBm`;
                if (rx >= -19.0) {
                  rxBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
                } else if (rx >= -24.0) {
                  rxBadgeClass = 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800';
                } else if (rx >= -27.0) {
                  rxBadgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
                } else {
                  rxBadgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
                }
              }

              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {/* Row 1: Index & Status */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-slate-400 font-semibold">#{globalIndex} • {c.customer_number || `CMN ${c.id}`}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        c.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                      }`}>
                        {c.status === 'active' ? 'Aktif' : 'Isolir'}
                      </span>
                    </div>

                    {/* Row 2: Nama */}
                    <div className="px-4 py-3">
                      <span className="text-slate-400 text-[11px] block">Nama Pelanggan</span>
                      <span className="font-bold text-slate-950 dark:text-white text-sm">{c.name}</span>
                    </div>

                    {/* Row 3: ODC & ODP */}
                    <div className="px-4 py-2.5 grid grid-cols-3 gap-2">
                      <span className="text-slate-400">ODC / ODP</span>
                      <span className="col-span-2 text-slate-800 dark:text-slate-200 font-medium">
                        {c.odp_name ? `${c.odp_name} (Port ${c.odp_port_number || '—'})` : '—'}
                      </span>
                    </div>

                    {/* Row 4: Serial & Rx */}
                    <div className="px-4 py-2.5 grid grid-cols-3 gap-2 items-center">
                      <span className="text-slate-400">SN &amp; Sinyal</span>
                      <div className="col-span-2 flex items-center gap-1.5 font-mono">
                        <span className="text-slate-800 dark:text-slate-200 font-bold">{c.onu_serial || '—'}</span>
                        {rxLabel !== '—' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rxBadgeClass}`}>
                            {rxLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 5: Actions */}
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDiagnosticsModal(c)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                      >
                        Diagnostik
                      </button>
                      {canCrud && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination Control */}
            {totalPages > 1 && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {currentPage} / {totalPages} (Total {filtered.length})
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── MODAL REGISTRASI / EDIT PELANGGAN (FORM INPUT) ─── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    {editingCustomer ? 'Edit Data Pelanggan' : 'Registrasi Pelanggan & Koneksi ODP Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lengkapi informasi identitas pelanggan dan alokasi port ODP fiber optik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formErr && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
                  ⚠️ {formErr}
                </div>
              )}

              {/* Data Utama Pelanggan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    ID Pelanggan (ID ISP)
                  </label>
                  <input
                    type="text"
                    placeholder="misal: ISP-100293 / SLK-001"
                    value={form.customer_number}
                    onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Dapat diisi manual sesuai ID ISP Anda</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Nama Lengkap Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Budi Santoso"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Daerah / Alamat Pemasangan
                  </label>
                  <input
                    type="text"
                    placeholder="misal: Koto Baru, Solok"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                    Status Pelanggan
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Aktif</option>
                    <option value="suspended">Suspended / Isolir</option>
                  </select>
                </div>
              </div>

              {/* Section Konek Ke ODP */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Alokasi Koneksi ODP (Optical Distribution Point)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Pilih ODP *
                    </label>
                    <SearchableSelect
                      value={form.odp_id}
                      onChange={val => {
                        handleOdpChange({ target: { value: val } });
                      }}
                      placeholder="-- Pilih ODP --"
                      searchPlaceholder="Cari nama atau kode ODP..."
                      options={odpNodes.map(odp => ({
                        value: odp.id,
                        label: `${odp.name} (${odp.code})`,
                        sublabel: `Kapasitas: ${odp.used_ports}/${odp.total_ports} Port Terpakai`
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Port ODP *
                    </label>
                    <select
                      value={form.odp_port_number}
                      disabled={!form.odp_id || loadingPorts}
                      onChange={e => {
                        const portNum = e.target.value;
                        const selectedPortObj = odpPorts.find(p => String(p.port_number) === String(portNum));
                        setForm(f => ({
                          ...f,
                          odp_port_number: portNum,
                          odp_port_id: selectedPortObj?.id || '',
                        }));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-medium"
                    >
                      <option value="">-- Pilih Port --</option>
                      {loadingPorts ? (
                        <option disabled>Memuat port ODP...</option>
                      ) : (
                        odpPorts.map(p => {
                          const isOccupied = !!(p.customer_id || p.customer_service_id || p.status === 'used');
                          const isCurrentCustomer = editingCustomer && p.customer_name_cache === editingCustomer.name;
                          return (
                            <option
                              key={p.id}
                              value={p.port_number}
                              disabled={isOccupied && !isCurrentCustomer}
                            >
                              Port {p.port_number} {isOccupied ? (isCurrentCustomer ? '(Port Saat Ini)' : `(Terisi: ${p.customer_name || p.customer_name_cache})`) : '(Tersedia)'}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Saat disimpan, pelanggan akan otomatis terhubung ke Port ODP yang dipilih dan muncul di monitoring sinyal optik /network.
                </p>
              </div>

              {/* Section ONT & Optical Power */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  ONT / ONU &amp; Monitoring Sinyal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Serial Number ONT (SN)
                    </label>
                    <input
                      type="text"
                      placeholder="contoh: HWTC-A84F2B01"
                      value={form.onu_serial}
                      onChange={e => setForm(f => ({ ...f, onu_serial: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 text-[11px]">
                      Estimasi Sinyal (Rx Power dBm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="-18.5"
                      value={form.rx_power}
                      onChange={e => setForm(f => ({ ...f, rx_power: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-60 shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan &amp; Konekkan ke ODP</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── OLT ONU AUTO-DISCOVERY & MAPPING WIZARD MODAL ─── */}
      {showDiscoveryModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-950 dark:text-white">Auto-Discover &amp; Fast Mapping ONU OLT</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mendapatkan modem ONU terdaftar dari OLT secara otomatis. Cukup isi nama &amp; pilih ODP tanpa perlu ketik SN manual!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscoveryModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingDiscovery ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Melakukan pemindaian ONU modem terdaftar dari OLT...</p>
                </div>
              ) : unmappedOnus.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    ✓
                  </div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Seluruh ONU Modem OLT Telah Terpetakan!</p>
                  <p className="mt-1 max-w-md mx-auto text-slate-500 dark:text-slate-400">
                    Semua SN ONU modem yang aktif di OLT sudah terhubung dengan data Pelanggan &amp; Port ODP.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>Modem ONU Ditemukan di OLT ({unmappedOnus.length})</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Siap Dipetakan ke ODP</span>
                  </div>

                  <div className="space-y-3">
                    {unmappedOnus.map(item => {
                      const formVal = provisionForms[item.serial_number] || { customer_number: '', name: '', address: 'Solok, Sumatera Barat', odp_id: '', odp_port_number: '1' };

                      return (
                        <div key={item.serial_number} className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 transition-colors">
                          {/* Row 1: ONU Info Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                {item.vendor} {item.model}
                              </span>
                              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {item.serial_number}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                ({item.olt_name} - Port {item.gpon_port})
                              </span>
                            </div>

                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rx: {item.rx_power} dBm
                            </span>
                          </div>

                          {/* Row 2: Mapping Form Controls */}
                          <div className="space-y-2.5 text-xs">
                            {/* Line 1: ID Pelanggan, Nama, Alamat */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {/* ID Pelanggan */}
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ID Pelanggan (ID ISP)</label>
                                <input
                                  type="text"
                                  placeholder="misal: CMN 0001"
                                  value={formVal.customer_number || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setProvisionForms(prev => ({
                                      ...prev,
                                      [item.serial_number]: { ...prev[item.serial_number], customer_number: val }
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>

                              {/* Nama Pelanggan */}
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Pelanggan *</label>
                                <input
                                  type="text"
                                  placeholder="misal: Budi Santoso"
                                  value={formVal.name || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setProvisionForms(prev => ({
                                      ...prev,
                                      [item.serial_number]: { ...prev[item.serial_number], name: val }
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>

                              {/* Daerah / Alamat Pemasangan */}
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Daerah / Alamat Pemasangan</label>
                                <input
                                  type="text"
                                  placeholder="misal: Koto Baru, Solok"
                                  value={formVal.address || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setProvisionForms(prev => ({
                                      ...prev,
                                      [item.serial_number]: { ...prev[item.serial_number], address: val }
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            </div>

                            {/* Line 2: Searchable ODP, Port ODP, Button */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                              {/* Searchable ODP Dropdown */}
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pilih Node ODP (Search)</label>
                                <SearchableSelect
                                  value={formVal.odp_id || ''}
                                  onChange={val => {
                                    setProvisionForms(prev => ({
                                      ...prev,
                                      [item.serial_number]: { ...prev[item.serial_number], odp_id: val }
                                    }));
                                  }}
                                  placeholder="-- Pilih Node ODP --"
                                  searchPlaceholder="Cari nama atau kode ODP..."
                                  options={odpNodes.map(odp => ({
                                    value: odp.id,
                                    label: `${odp.name} (${odp.code})`,
                                    sublabel: `Kapasitas: ${odp.used_ports}/${odp.total_ports} Port Terpakai`
                                  }))}
                                />
                              </div>

                              {/* Port ODP */}
                              <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Port ODP</label>
                                <select
                                  value={formVal.odp_port_number || '1'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setProvisionForms(prev => ({
                                      ...prev,
                                      [item.serial_number]: { ...prev[item.serial_number], odp_port_number: val }
                                    }));
                                  }}
                                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(pNum => (
                                    <option key={pNum} value={pNum}>Port {pNum}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Button */}
                              <div>
                                <button
                                  type="button"
                                  onClick={() => handleSingleProvision(item)}
                                  disabled={batchSubmitting || !formVal.name.trim()}
                                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>Konekkan ODP</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Auto-Discovery Sync OLT Active Engine</span>
              <button
                type="button"
                onClick={() => setShowDiscoveryModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL DIAGNOSTIK OPTIK & UJI PING PELANGGAN ─── */}
      {showDiagnosticsModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    Diagnostik Optik &amp; Uji Ping Pelanggan
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeDiagnosticCustomer?.name} • <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{activeDiagnosticCustomer?.customer_number || `CMN ${activeDiagnosticCustomer?.id}`}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingDiagnostics ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Menghubungkan ke OLT &amp; Menarik Diagnostik Optik...</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Mengukur Rx Optical Power, SFP Laser Tx, dan Uji Ping Latensi</p>
              </div>
            ) : diagnosticsData ? (
              <div className="space-y-6">
                {/* 1. Top Metrics Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Rx Optical Power */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Rx Power (Daya Terima)
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-slate-950 dark:text-white">
                      {diagnosticsData.optical?.rx_power !== null && diagnosticsData.optical?.rx_power !== undefined
                        ? `${diagnosticsData.optical.rx_power.toFixed(2)} dBm`
                        : 'Loss of Signal'}
                    </div>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                      diagnosticsData.optical?.rx_power >= -19
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : diagnosticsData.optical?.rx_power >= -24
                        ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 border-teal-200 dark:border-teal-800'
                        : diagnosticsData.optical?.rx_power >= -27
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    }`}>
                      {diagnosticsData.optical?.quality || 'Good'}
                    </span>
                  </div>

                  {/* Tx Optical Power */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Tx Power (Laser OLT)
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                      +{diagnosticsData.optical?.tx_power?.toFixed(2) || '2.15'} dBm
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                      Laser SFP Class C+
                    </span>
                  </div>

                  {/* Attenuation Loss */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Total Redaman (Loss)
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-purple-600 dark:text-purple-400">
                      {diagnosticsData.optical?.attenuation_loss_db || '10.5'} dB
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                      Kabel + Splitter ODC/ODP
                    </span>
                  </div>

                  {/* Jarak Fiber */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Estimasi Jarak Fiber
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {diagnosticsData.optical?.distance_meters || 650} m
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                      ~{((diagnosticsData.optical?.distance_meters || 650) / 1000).toFixed(2)} km dari OLT
                    </span>
                  </div>
                </div>

                {/* 2. Visual Grafis Riwayat Redaman Optik (SVG Line Chart 24 Jam) */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-950 dark:text-white">
                        Riwayat Redaman Optik Rx (24 Jam Terakhir)
                      </h5>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Fluktuasi redaman sinyal optik fiber harian. Batas aman minimum adalah -27.0 dBm.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Live Telemetry
                    </span>
                  </div>

                  {/* SVG Chart */}
                  <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60">
                    <svg viewBox="0 0 500 140" className="w-full h-36 overflow-visible">
                      <defs>
                        <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="40" y1="20" x2="480" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800" />
                      <line x1="40" y1="60" x2="480" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-800" />
                      <line x1="40" y1="100" x2="480" y2="100" stroke="#f43f5e" strokeDasharray="4 4" strokeWidth="1" />
                      
                      {/* Grid Labels (dBm) */}
                      <text x="35" y="24" textAnchor="end" className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono">-15 dBm</text>
                      <text x="35" y="64" textAnchor="end" className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono">-21 dBm</text>
                      <text x="35" y="104" textAnchor="end" className="text-[9px] fill-rose-500 font-bold font-mono">-27 dBm (Batas)</text>

                      {/* Curve Calculation */}
                      {(() => {
                        const history = diagnosticsData.optical?.history || [];
                        if (history.length === 0) return null;

                        const minDb = -30;
                        const maxDb = -14;
                        const range = maxDb - minDb;

                        const points = history.map((h, i) => {
                          const x = 50 + (i * (420 / (history.length - 1)));
                          const clampedRx = Math.max(minDb, Math.min(maxDb, h.rx_power));
                          const y = 110 - ((clampedRx - minDb) / range) * 90;
                          return { x, y, h };
                        });

                        const pathData = points.reduce((acc, p, i) => {
                          return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                        }, '');

                        const areaData = `${pathData} L ${points[points.length - 1].x} 115 L ${points[0].x} 115 Z`;

                        return (
                          <>
                            {/* Area Fill */}
                            <path d={areaData} fill="url(#rxGradient)" />

                            {/* Line */}
                            <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Data Points */}
                            {points.map((p, i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" className="dark:stroke-slate-900" />
                                <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[8px] font-mono font-bold fill-indigo-600 dark:fill-indigo-400">
                                  {p.h.rx_power}
                                </text>
                                <text x={p.x} y="130" textAnchor="middle" className="text-[9px] fill-slate-400 dark:fill-slate-500 font-medium">
                                  {p.h.time}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                {/* 3. Live Ping & Latency Sweep Box */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Uji Ping &amp; Latensi Modem Pelanggan
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        IP: {diagnosticsData.ping?.target_ip || '10.20.15.42'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                      <span>Latensi: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{diagnosticsData.ping?.latency_ms ? `${diagnosticsData.ping.latency_ms} ms` : '—'}</strong></span>
                      <span>Packet Loss: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{diagnosticsData.ping?.packet_loss_pct || 0}%</strong></span>
                      <span>Jitter: <strong className="text-slate-800 dark:text-slate-200 font-bold">{diagnosticsData.ping?.jitter_ms || 0.4} ms</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunLivePing}
                    disabled={pingingLive}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    <span>{pingingLive ? 'Menguji Ping...' : 'Jalankan Uji Ping Ulang'}</span>
                  </button>
                </div>

                {/* 4. End-to-End FTTH Topology Visual */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Jalur Jaringan FTTH (End-to-End)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    {/* OLT */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold">1. OLT Port</span>
                      <p className="font-bold text-slate-950 dark:text-white">{diagnosticsData.topology?.olt_name}</p>
                      <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400">{diagnosticsData.topology?.gpon_interface}</p>
                    </div>

                    {/* ODC */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold">2. ODC Feeder</span>
                      <p className="font-bold text-slate-950 dark:text-white">{diagnosticsData.topology?.odc_name || 'ODC Utama'}</p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{diagnosticsData.topology?.odc_code || 'ODC-01'}</p>
                    </div>

                    {/* ODP */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold">3. ODP Distribusi</span>
                      <p className="font-bold text-slate-950 dark:text-white">{diagnosticsData.topology?.odp_name || 'ODP Pelanggan'}</p>
                      <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">Port {diagnosticsData.topology?.odp_port || '1'}</p>
                    </div>

                    {/* ONT */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold">4. ONT / Modem</span>
                      <p className="font-bold text-slate-950 dark:text-white font-mono text-[11px] truncate">{diagnosticsData.topology?.onu_serial}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{diagnosticsData.topology?.onu_type || 'GPON ONT'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-all text-xs cursor-pointer"
              >
                Tutup Diagnostik
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Dialog */}
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

