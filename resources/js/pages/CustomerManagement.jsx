import React, { useState, useEffect, useCallback } from 'react';
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
  const [servicePackages, setServicePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [toast, setToast] = useState(null);

  // OLT Auto-Discovery Wizard State
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [unmappedOnus, setUnmappedOnus] = useState([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [provisionForms, setProvisionForms] = useState({});
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Swap ONU Modal State (Pergantian Modem Rusak)
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapCustomer, setSwapCustomer] = useState(null);
  const [swapForm, setSwapForm] = useState({
    new_onu_serial: '',
    replacement_reason: 'Modem Rusak / Tersambar Petir',
    rx_power: '-19.2',
  });
  const [swapping, setSwapping] = useState(false);

  const openSwapModal = (c) => {
    setSwapCustomer(c);
    setSwapForm({
      new_onu_serial: '',
      replacement_reason: 'Modem Rusak / Tersambar Petir',
      rx_power: '-19.2',
    });
    setShowSwapModal(true);
    fetchUnmappedOnus();
  };

  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    if (!swapForm.new_onu_serial.trim()) {
      showToastMsg('Harap masukkan Serial Number (SN) ONU baru!', 'error');
      return;
    }

    setSwapping(true);
    try {
      const res = await fetch(`/api/customers/${swapCustomer.id}/swap-onu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapForm),
      });

      const d = await res.json();
      if (d.status === 'success') {
        showToastMsg(d.message);
        setShowSwapModal(false);
        fetchCustomers();
      } else {
        showToastMsg(d.message || 'Gagal melakukan pergantian ONU', 'error');
      }
    } catch (err) {
      showToastMsg('Terjadi kesalahan server saat pergantian ONU', 'error');
    } finally {
      setSwapping(false);
    }
  };

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
  }, [fetchCustomers, fetchOdpNodes]);

  const refreshAllData = useCallback(async (silent = true) => {
    await Promise.all([fetchCustomers(silent), fetchOdpNodes(), fetchServicePackages()]);
  }, [fetchCustomers, fetchOdpNodes, fetchServicePackages]);

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
          Apakah Anda yakin ingin menghapus data pelanggan <strong className="text-slate-700 dark:text-slate-200">"{c.name}"</strong> ({c.customer_code})? <br />
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

  // Filtered customers
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.name?.toLowerCase().includes(q) ||
      c.customer_number?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.package_name?.toLowerCase().includes(q) ||
      c.odp_name?.toLowerCase().includes(q) ||
      c.odp_code?.toLowerCase().includes(q);

    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 transition-colors duration-300 stagger-enter">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-900 text-white border-red-700' : 'bg-emerald-900 text-white border-emerald-700'
          }`}>
          <span>{toast.type === 'error' ? '️' : ''}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-lg border border-slate-200 dark:border-[#222222] shadow-2xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Pelanggan &amp; Pemetaan ODP
          </h3>

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
                onClick={handleOpenDiscoveryModal}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>⚡ Sync Auto-Discover ONU OLT</span>
              </button>
              <button
                onClick={openAddModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>+ Registrasi Manual</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
          <input
            type="text"
            placeholder=" Cari nama, kode, HP, ODP, atau paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua Status</option>
            <option value="active"> Aktif</option>
            <option value="suspended"> Suspended / Isolir</option>
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Total Pelanggan: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filtered.length}</span> dari {customers.length}
        </div>
      </div>

      {/* Customer Data Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs animate-pulse">
          <span></span> Memuat data pelanggan & port ODP...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs">
          <p className="font-bold text-slate-600 dark:text-slate-300">Belum Ada Pelanggan Ditemukan</p>
          <p className="mt-1">Klik "Registrasi Pelanggan Baru" untuk mendaftarkan pelanggan & port ODP.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on mobile md:block) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">ID Pelanggan</th>
                    <th className="px-5 py-3.5">Nama Pelanggan</th>
                    <th className="px-5 py-3.5">ODP &amp; Port</th>
                    <th className="px-5 py-3.5">Daerah / Alamat</th>
                    <th className="px-5 py-3.5">OLT &amp; Interface</th>
                    <th className="px-5 py-3.5">Serial Number (SN)</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginated.map(c => {
                    const rx = c.rx_power != null ? parseFloat(c.rx_power) : null;
                    let rxBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200';
                    let rxLabel = '—';
                    if (rx !== null) {
                      rxLabel = `${rx.toFixed(1)} dBm`;
                      if (rx >= -22.5) rxBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                      else if (rx >= -26.5) rxBadge = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                      else rxBadge = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold animate-pulse';
                    }

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        {/* ID Pelanggan */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {c.customer_number || `CMN ${String(c.id).padStart(4, '0')}`}
                          </span>
                        </td>

                        {/* Nama Pelanggan */}
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{c.name}</p>
                        </td>

                        {/* ODP & Port */}
                        <td className="px-5 py-3.5">
                          {c.odp_name ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {c.odp_name}
                              </span>
                              {c.odp_port_number && (
                                <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                                  (Port {c.odp_port_number})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Belum terhubung ODP</span>
                          )}
                        </td>

                        {/* Daerah / Alamat */}
                        <td className="px-5 py-3.5 max-w-[200px]">
                          <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 truncate block" title={c.address}>
                            {c.address || 'Solok, Sumatera Barat'}
                          </span>
                        </td>

                        {/* OLT & Interface */}
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.olt_name || 'OLT Utama Solok'}</p>
                            <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                              Interface: {c.gpon_interface || '1/1/1'}
                            </p>
                          </div>
                        </td>

                        {/* Serial Number (SN) & Sinyal Rx */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                              {c.onu_serial || '—'}
                            </span>
                            {rx !== null && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${rxBadge}`}>
                                {rxLabel}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}>
                            {c.status === 'active' ? 'Aktif' : 'Isolir'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openSwapModal(c)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-bold hover:bg-cyan-100 dark:hover:bg-cyan-900/80 transition-all flex items-center gap-1"
                              title="Ganti ONU Modem (Penggantian Modem Rusak)"
                            >
                              <span>🔄 Ganti ONU</span>
                            </button>
                            {canCrud && (
                              <>
                                <button
                                  onClick={() => openEditModal(c)}
                                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(c)}
                                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination Bar */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan data <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, filtered.length)}</span> dari total <span className="font-bold text-indigo-600 dark:text-indigo-400">{filtered.length}</span> pelanggan
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  ← Sebelumnya
                </button>
                <span className="px-2 font-bold text-slate-700 dark:text-slate-200">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards View (block on mobile md:hidden) */}
          <div className="block md:hidden space-y-4">
            {paginated.map((c, idx) => {
              const globalIndex = (currentPage - 1) * perPage + idx + 1;
              const rx = c.rx_power != null ? parseFloat(c.rx_power) : null;
              let rxBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200';
              let rxLabel = '—';
              if (rx !== null) {
                rxLabel = `${rx.toFixed(1)} dBm`;
                if (rx >= -22.5) rxBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                else if (rx >= -26.5) rxBadge = 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                else rxBadge = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold animate-pulse';
              }

              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  {/* Bordered Key-Value Table Grid */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {/* Row 1: # Index */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center bg-slate-50/70 dark:bg-slate-800/40">
                      <span className="text-slate-400 font-semibold">#</span>
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-200">{globalIndex}</span>
                    </div>

                    {/* Row 2: Code / ID Pelanggan */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Code</span>
                      <span className="col-span-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {c.customer_number || `CMN ${String(c.id).padStart(4, '0')}`}
                      </span>
                    </div>

                    {/* Row 3: Name */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Name</span>
                      <span className="col-span-2 font-bold text-slate-900 dark:text-slate-100 uppercase">
                        {c.name}
                      </span>
                    </div>

                    {/* Row 4: Address */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Address</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300 leading-snug uppercase">
                        {c.address || 'SOLOK, SUMATERA BARAT'}
                      </span>
                    </div>

                    {/* Row 5: ODP & Port */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">ODP &amp; Port</span>
                      <span className="col-span-2">
                        {c.odp_name ? (
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {c.odp_name} <span className="text-indigo-600 dark:text-indigo-400 font-mono">(Port {c.odp_port_number || '1'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belum terhubung ODP</span>
                        )}
                      </span>
                    </div>

                    {/* Row 6: OLT & Interface */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">OLT &amp; Interface</span>
                      <span className="col-span-2 text-slate-700 dark:text-slate-300">
                        <span className="font-bold block">{c.olt_name || 'OLT Utama Solok'}</span>
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">Interface: {c.gpon_interface || '1/1/1'}</span>
                      </span>
                    </div>

                    {/* Row 7: Serial (SN) */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Serial (SN)</span>
                      <span className="col-span-2 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {c.onu_serial || '—'}
                        </span>
                        {rx !== null && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${rxBadge}`}>
                            {rxLabel}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Row 8: Status */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center">
                      <span className="text-slate-400 font-semibold">Status</span>
                      <span className="col-span-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${c.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}>
                          {c.status === 'active' ? 'Aktif' : 'Isolir'}
                        </span>
                      </span>
                    </div>

                    {/* Row 9: Actions */}
                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => openSwapModal(c)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-bold hover:bg-cyan-100 transition-all flex items-center gap-1"
                      >
                        <span>🔄 Ganti ONU</span>
                      </button>
                      {canCrud && (
                        <>
                          <button
                            onClick={() => openEditModal(c)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold hover:bg-rose-100"
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages} (Total {filtered.length})
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Modal Registrasi / Edit Pelanggan ─── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span></span> {editingCustomer ? 'Edit Data Pelanggan' : 'Registrasi Pelanggan & Koneksi ODP Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formErr && (
                <div className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl font-medium">
                  ️ {formErr}
                </div>
              )}

              {/* Data Utama Pelanggan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">ID Pelanggan (ID ISP)</label>
                  <input
                    type="text"
                    placeholder="misal: ISP-100293 / SLK-001"
                    value={form.customer_number}
                    onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Dapat diisi manual sesuai ID ISP Anda</p>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Nama Lengkap Pelanggan *</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Budi Santoso"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Daerah / Alamat Pemasangan</label>
                  <input
                    type="text"
                    placeholder="misal: Koto Baru, Solok"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Status Pelanggan</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active"> Aktif</option>
                    <option value="suspended"> Suspended / Isolir</option>
                  </select>
                </div>
              </div>

              {/* Section Konek Ke ODP */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  Alokasi Koneksi ODP (Optical Distribution Point)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Pilih ODP *</label>
                    <SearchableSelect
                      value={form.odp_id}
                      onChange={val => {
                        // simulate change event for handleOdpChange
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
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Port ODP *</label>
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
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
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  ONT / ONU & Monitoring Sinyal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Serial Number ONT (SN)</label>
                    <input
                      type="text"
                      placeholder="contoh: HWTC-A84F2B01"
                      value={form.onu_serial}
                      onChange={e => setForm(f => ({ ...f, onu_serial: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Estimasi Sinyal (Rx Power dBm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="-18.5"
                      value={form.rx_power}
                      onChange={e => setForm(f => ({ ...f, rx_power: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-60 shadow-md shadow-indigo-600/20"
                >
                  {saving ? 'Menyimpan...' : ' Simpan & Konekkan ke ODP'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* OLT ONU Auto-Discovery & Mapping Wizard Modal */}
      {showDiscoveryModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 px-6 py-4 border-b border-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center font-bold text-lg">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Auto-Discover &amp; Fast Mapping ONU OLT</h3>
                  <p className="text-xs text-teal-300">
                    Mendapatkan modem ONU terdaftar dari OLT secara otomatis. Cukup isi nama &amp; pilih ODP tanpa perlu ketik SN manual!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiscoveryModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingDiscovery ? (
                <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
                  <span>⚡</span> Melakukan pemindaian ONU modem terdaftar dari OLT...
                </div>
              ) : unmappedOnus.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    ✓
                  </div>
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Seluruh ONU Modem OLT Telah Terpetakan!</p>
                  <p className="mt-1 max-w-md mx-auto">
                    Semua SN ONU modem yang aktif di OLT sudah terhubung dengan data Pelanggan &amp; Port ODP.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>Modem ONU Ditemukan di OLT ({unmappedOnus.length})</span>
                    <span className="text-teal-600 dark:text-teal-400 text-[11px]">Siap Dipetakan ke ODP</span>
                  </div>

                  <div className="space-y-3">
                    {unmappedOnus.map(item => {
                      const formVal = provisionForms[item.serial_number] || { customer_number: '', name: '', address: 'Solok, Sumatera Barat', odp_id: '', odp_port_number: '1' };

                      return (
                        <div key={item.serial_number} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 transition-colors">
                          {/* Row 1: ONU Info Badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                {item.vendor} {item.model}
                              </span>
                              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {item.serial_number}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
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
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(pNum => (
                                    <option key={pNum} value={pNum}>Port {pNum}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Button */}
                              <div>
                                <button
                                  onClick={() => handleSingleProvision(item)}
                                  disabled={batchSubmitting || !formVal.name.trim()}
                                  className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <span>🚀 Konekkan ODP</span>
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
              <span className="text-slate-500">Auto-Discovery Sync OLT Active Engine</span>
              <button
                onClick={() => setShowDiscoveryModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ─── Modal Swap / Pergantian ONU Modem ─── */}
      {showSwapModal && swapCustomer && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-cyan-900 px-6 py-4 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold text-lg">
                  🔄
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Fitur Pergantian ONU Modem</h3>
                  <p className="text-xs text-cyan-200">
                    Penggantian modem rusak / tersambar petir untuk pelanggan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSwapModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSwapSubmit} className="p-6 space-y-4 text-xs">
              {/* Customer Context Info */}
              <div className="p-3.5 bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {swapCustomer.name}
                  </span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {swapCustomer.customer_number || `CMN ${String(swapCustomer.id).padStart(4, '0')}`}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Alamat: {swapCustomer.address || 'Solok, Sumatera Barat'}
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">SN ONU Lama Saat Ini:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    {swapCustomer.onu_serial || '—'}
                  </span>
                </div>
              </div>

              {/* Input SN ONU Baru */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
                  Serial Number (SN) ONU Baru *
                </label>
                {unmappedOnus.length > 0 ? (
                  <div className="space-y-1.5 mb-2">
                    <select
                      value={swapForm.new_onu_serial}
                      onChange={e => setSwapForm(f => ({ ...f, new_onu_serial: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">-- Pilih dari ONU Terdeteksi di OLT --</option>
                      {unmappedOnus.map(u => (
                        <option key={u.serial_number} value={u.serial_number}>
                          {u.serial_number} ({u.vendor} {u.model} - Rx {u.rx_power} dBm)
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-slate-400">
                      <span>Atau ketik SN manual di bawah ini:</span>
                    </div>
                  </div>
                ) : null}
                <input
                  type="text"
                  required
                  placeholder="contoh: ZTEG-C99812A1 / HWTC-88291012"
                  value={swapForm.new_onu_serial}
                  onChange={e => setSwapForm(f => ({ ...f, new_onu_serial: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Alasan Pergantian */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Alasan Pergantian ONU</label>
                <select
                  value={swapForm.replacement_reason}
                  onChange={e => setSwapForm(f => ({ ...f, replacement_reason: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="Modem Rusak / Tersambar Petir">Modem Rusak / Tersambar Petir</option>
                  <option value="Port LAN / Wi-Fi Mati Total">Port LAN / Wi-Fi Mati Total</option>
                  <option value="Sinyal Optik Rx Loss / Redaman Drop">Sinyal Optik Rx Loss / Redaman Drop</option>
                  <option value="Upgrade Modem Dual Band Wi-Fi 5">Upgrade Modem Dual Band Wi-Fi 5</option>
                  <option value="Lainnya">Lainnya (Ganti Modem Baru)</option>
                </select>
              </div>

              {/* Estimasi Rx Power Baru */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">Estimasi Sinyal Rx Baru (dBm)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="-19.2"
                  value={swapForm.rx_power}
                  onChange={e => setSwapForm(f => ({ ...f, rx_power: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={swapping}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold disabled:opacity-60 shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5"
                >
                  <span>{swapping ? 'Memproses Swap...' : '🔄 Simpan & Update SN Baru'}</span>
                </button>
              </div>
            </form>
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

