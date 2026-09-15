import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import KmlImportModal from '../components/KmlImportModal';

// TIA-598-A 12 Standard Fiber Colors
const TIA_COLORS = [
  { no: 1, name: 'Biru', hex: '#2563eb', bg: 'bg-blue-600', text: 'text-white' },
  { no: 2, name: 'Oranye', hex: '#f97316', bg: 'bg-orange-500', text: 'text-white' },
  { no: 3, name: 'Hijau', hex: '#16a34a', bg: 'bg-green-600', text: 'text-white' },
  { no: 4, name: 'Cokelat', hex: '#78350f', bg: 'bg-amber-900', text: 'text-white' },
  { no: 5, name: 'Abu-abu', hex: '#64748b', bg: 'bg-slate-500', text: 'text-white' },
  { no: 6, name: 'Putih', hex: '#f8fafc', bg: 'bg-slate-100', text: 'text-slate-800' },
  { no: 7, name: 'Merah', hex: '#dc2626', bg: 'bg-red-600', text: 'text-white' },
  { no: 8, name: 'Hitam', hex: '#09090b', bg: 'bg-slate-950', text: 'text-white' },
  { no: 9, name: 'Kuning', hex: '#eab308', bg: 'bg-yellow-400', text: 'text-slate-900' },
  { no: 10, name: 'Ungu', hex: '#9333ea', bg: 'bg-purple-600', text: 'text-white' },
  { no: 11, name: 'Pink', hex: '#ec4899', bg: 'bg-pink-500', text: 'text-white' },
  { no: 12, name: 'Toska', hex: '#06b6d4', bg: 'bg-cyan-500', text: 'text-white' },
];

export default function CableManagement() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [cables, setCables] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterInstallation, setFilterInstallation] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCableData, setEditCableData] = useState(null);
  const [deleteCableData, setDeleteCableData] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [matrixCableData, setMatrixCableData] = useState(null);
  const [selectedTube, setSelectedTube] = useState(1);
  const [editingCore, setEditingCore] = useState(null);
  const [showKmlModal, setShowKmlModal] = useState(false);

  // Form states for Add Cable
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formFromNodeId, setFormFromNodeId] = useState('');
  const [formToNodeId, setFormToNodeId] = useState('');
  const [formLengthMeters, setFormLengthMeters] = useState('1000');
  const [formCoreCount, setFormCoreCount] = useState('24');
  const [formTubeCount, setFormTubeCount] = useState('2');
  const [formInstallation, setFormInstallation] = useState('Aerial');
  const [formRouteDesc, setFormRouteDesc] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form states for Edit Cable
  const [editName, setEditName] = useState('');
  const [editFromNodeId, setEditFromNodeId] = useState('');
  const [editToNodeId, setEditToNodeId] = useState('');
  const [editLengthMeters, setEditLengthMeters] = useState('');
  const [editInstallation, setEditInstallation] = useState('Aerial');
  const [editStatus, setEditStatus] = useState('active');
  const [editRouteDesc, setEditRouteDesc] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Form states for Edit Core
  const [coreStatus, setCoreStatus] = useState('available');
  const [coreDestType, setCoreDestType] = useState('UNASSIGNED');
  const [coreDestName, setCoreDestName] = useState('');
  const [coreOdfLabel, setCoreOdfLabel] = useState('');
  const [coreNotes, setCoreNotes] = useState('');
  const [coreSaving, setCoreSaving] = useState(false);

  // Role permissions check
  const isReadOnly = currentUser?.role && ['Teknisi Jointer', 'Customer Service', 'Finance & Billing'].includes(currentUser.role);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Cable Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/network-cables/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch cable stats:', err);
    }
  };

  // Fetch Cables with Cores
  const fetchCables = async () => {
    try {
      const res = await fetch('/api/network-cables?with_cores=1');
      if (res.ok) {
        const json = await res.json();
        setCables(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch cables:', err);
    }
  };

  // Fetch Network Nodes (POP, ODC, ODP) for dropdowns
  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/network-nodes?per_page=5000');
      if (res.ok) {
        const json = await res.json();
        setNodes(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchCables(), fetchNodes()]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchCables()]);
    setRefreshing(false);
    showToast('Data rute kabel berhasil diperbarui', 'info');
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered Cables list
  const filteredCables = useMemo(() => {
    return cables.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchCode = c.code?.toLowerCase().includes(q);
        const matchFrom = c.from_node?.name?.toLowerCase().includes(q) || c.from_node?.code?.toLowerCase().includes(q);
        const matchTo = c.to_node?.name?.toLowerCase().includes(q) || c.to_node?.code?.toLowerCase().includes(q);
        const matchDesc = c.route_description?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchFrom && !matchTo && !matchDesc) return false;
      }
      // Status
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      // Installation
      if (filterInstallation !== 'all' && c.installation_type !== filterInstallation) return false;
      return true;
    });
  }, [cables, searchQuery, filterStatus, filterInstallation]);

  // Auto calculate tube count based on total cores
  const handleCoreCountChange = (val) => {
    setFormCoreCount(val);
    const cores = parseInt(val, 10);
    if (cores === 6) setFormTubeCount('1');
    else if (cores === 12) setFormTubeCount('1');
    else if (cores === 24) setFormTubeCount('2');
    else if (cores === 48) setFormTubeCount('4');
    else if (cores === 96) setFormTubeCount('8');
    else if (cores === 144) setFormTubeCount('12');
  };

  // Generate random cable code helper
  const handleGenerateCode = () => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const instPrefix = formInstallation === 'Underground' ? 'UG' : formInstallation === 'Duct' ? 'DC' : 'AR';
    setFormCode(`KBL-${instPrefix}-${formCoreCount}C-${randomHex}`);
  };

  // Handle Add Cable Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama kabel wajib diisi', 'error');
      return;
    }
    if (!formCode.trim()) {
      showToast('Kode kabel wajib diisi', 'error');
      return;
    }
    if (!formFromNodeId) {
      showToast('Node asal wajib dipilih', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/network-cables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          from_node_id: formFromNodeId,
          to_node_id: formToNodeId || null,
          length_meters: parseFloat(formLengthMeters) || 100,
          core_count_total: parseInt(formCoreCount, 10),
          tube_count: parseInt(formTubeCount, 10),
          installation_type: formInstallation,
          route_description: formRouteDesc.trim() || null,
          notes: formNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menambahkan kabel');
      }

      showToast(`Kabel ${data.data?.name || formName} berhasil didaftarkan beserta Core Matrix!`);
      setShowAddModal(false);
      // Reset form
      setFormName('');
      setFormCode('');
      setFormFromNodeId('');
      setFormToNodeId('');
      setFormRouteDesc('');
      setFormNotes('');
      // Reload
      await Promise.all([fetchStats(), fetchCables()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (cable) => {
    setEditCableData(cable);
    setEditName(cable.name || '');
    setEditFromNodeId(cable.from_node_id ? String(cable.from_node_id) : '');
    setEditToNodeId(cable.to_node_id ? String(cable.to_node_id) : '');
    setEditLengthMeters(String(cable.length_meters || ''));
    setEditInstallation(cable.installation_type || 'Aerial');
    setEditStatus(cable.status || 'active');
    setEditRouteDesc(cable.route_description || '');
    setEditNotes(cable.notes || '');
  };

  // Handle Edit Cable Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editCableData) return;

    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/network-cables/${editCableData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({
          name: editName.trim(),
          from_node_id: editFromNodeId || null,
          to_node_id: editToNodeId || null,
          length_meters: parseFloat(editLengthMeters) || editCableData.length_meters,
          installation_type: editInstallation,
          status: editStatus,
          route_description: editRouteDesc.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal memperbarui data kabel');
      }

      showToast(`Data kabel ${editName} berhasil disimpan!`);
      setEditCableData(null);
      await Promise.all([fetchStats(), fetchCables()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete Cable
  const handleDeleteSubmit = async () => {
    if (!deleteCableData) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/network-cables/${deleteCableData.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal menghapus kabel');
      }

      showToast(`Kabel ${deleteCableData.name} telah berhasil dihapus.`);
      setDeleteCableData(null);
      await Promise.all([fetchStats(), fetchCables()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Mass Delete All Cables
  const handleDeleteAllSubmit = async () => {
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/network-cables/delete-all', {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
      });

      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        throw new Error(data.message || 'Gagal menghapus semua bentangan kabel');
      }

      showToast(`🗑️ ${data.message || 'Seluruh bentangan kabel berhasil dihapus.'}`);
      setShowDeleteAllModal(false);
      await Promise.all([fetchStats(), fetchCables()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Core Matrix Modal
  const openMatrixModal = (cable) => {
    setMatrixCableData(cable);
    setSelectedTube(1);
    setEditingCore(null);
  };

  // Open Core Edit
  const openCoreEdit = (core) => {
    setEditingCore(core);
    setCoreStatus(core.status || 'available');
    setCoreDestType(core.destination_type || 'UNASSIGNED');
    setCoreDestName(core.destination_name || '');
    setCoreOdfLabel(core.odf_cassette_label || '');
    setCoreNotes(core.notes || '');
  };

  // Handle Core Edit Save
  const handleSaveCore = async (e) => {
    e.preventDefault();
    if (!editingCore) return;

    setCoreSaving(true);
    try {
      const res = await fetch(`/api/network-cable-cores/${editingCore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({
          status: coreStatus,
          destination_type: coreDestType,
          destination_name: coreDestName.trim() || null,
          odf_cassette_label: coreOdfLabel.trim() || null,
          notes: coreNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal memperbarui data core');
      }

      showToast(`Core #${editingCore.core_number} berhasil diperbarui!`);
      const updatedCore = data.core;

      // Update in local matrixCableData
      setMatrixCableData(prev => {
        if (!prev) return null;
        const newCores = (prev.cores || []).map(c => c.id === updatedCore.id ? { ...c, ...updatedCore } : c);
        const usedCount = newCores.filter(c => c.status === 'used').length;
        return {
          ...prev,
          core_count_used: usedCount,
          cores: newCores,
        };
      });

      // Also update in cables list
      setCables(prev => prev.map(c => {
        if (c.id === matrixCableData.id) {
          const newCores = (c.cores || []).map(cr => cr.id === updatedCore.id ? { ...cr, ...updatedCore } : cr);
          const usedCount = newCores.filter(cr => cr.status === 'used').length;
          return { ...c, core_count_used: usedCount, cores: newCores };
        }
        return c;
      }));

      setEditingCore(null);
      // Refresh stats quietly
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCoreSaving(false);
    }
  };

  // Grouped tubes for matrix viewer
  const tubeNumbers = useMemo(() => {
    if (!matrixCableData || !matrixCableData.cores) return [1];
    const tubes = new Set(matrixCableData.cores.map(c => c.tube_number || 1));
    return Array.from(tubes).sort((a, b) => a - b);
  }, [matrixCableData]);

  const coresInSelectedTube = useMemo(() => {
    if (!matrixCableData || !matrixCableData.cores) return [];
    return matrixCableData.cores.filter(c => (c.tube_number || 1) === selectedTube);
  }, [matrixCableData, selectedTube]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : toast.type === 'info'
              ? 'bg-sky-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-75 hover:opacity-100 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Manajemen Kabel &amp; Core Fiber Optik
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pengelolaan inventaris kabel backbone, feeder, dan distribusi serta visualisasi Core Matrix TIA-598-A
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5"
            title="Muat ulang data"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Segarkan</span>
          </button>

          <button
            onClick={() => setShowKmlModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import KML Kabel</span>
          </button>

          <button
            onClick={() => navigate('/cable-routes')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span>Pemetaan Rute</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => {
                handleGenerateCode();
                setShowAddModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Tambah Kabel Baru</span>
            </button>
          )}

          {!isReadOnly && cables.length > 0 && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 shadow-2xs"
              title="Hapus seluruh data bentangan kabel & core matrix"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Hapus Semua Kabel</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bentangan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Bentangan</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {stats ? stats.total_cables : (loading ? '...' : 0)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stats?.by_status?.active || 0} Aktif • {stats?.by_status?.maintenance || 0} Maintenance
          </div>
        </div>

        {/* Total Panjang */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Panjang Rute</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {stats ? `${stats.total_length_km} km` : (loading ? '...' : '0 km')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stats ? Number(stats.total_length_meters).toLocaleString('id-ID') : 0} meter kabel optik
          </div>
        </div>

        {/* Total Kapasitas Core */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Kapasitas Core Optik</span>
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {stats ? `${stats.total_cores} Core` : (loading ? '...' : '0 Core')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stats ? `${stats.available_cores} Tersedia (${100 - (stats.used_percentage || 0)}%)` : ''}
          </div>
        </div>

        {/* Utilisasi Core */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Utilisasi Core</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>{stats ? `${stats.used_percentage}%` : (loading ? '...' : '0%')}</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              ({stats ? stats.used_cores : 0} Terpakai)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-500 ${
                (stats?.used_percentage || 0) > 85
                  ? 'bg-rose-500'
                  : (stats?.used_percentage || 0) > 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, stats?.used_percentage || 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kabel, kode, titik asal, atau tujuan..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif (Active)</option>
            <option value="maintenance">Maintenance</option>
            <option value="damaged">Rusak / Putus (Damaged)</option>
            <option value="inactive">Nonaktif (Inactive)</option>
          </select>

          {/* Installation Filter */}
          <select
            value={filterInstallation}
            onChange={(e) => setFilterInstallation(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua Tipe Instalasi</option>
            <option value="Aerial">Aerial (Udara/Tiang)</option>
            <option value="Underground">Underground (Tanam Langsung)</option>
            <option value="Duct">Duct (Subduct / Pipa)</option>
            <option value="Wall">Wall (Dinding / Gedung)</option>
          </select>
        </div>
      </div>

      {/* Main Table / Card View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <svg className="w-8 h-8 animate-spin text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-sm font-medium">Memuat data infrastruktur kabel...</p>
          </div>
        ) : filteredCables.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Tidak ada kabel ditemukan</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'all' || filterInstallation !== 'all'
                ? 'Tidak ada bentangan kabel yang cocok dengan kriteria pencarian dan filter Anda.'
                : 'Belum ada bentangan kabel optik yang terdaftar. Tambahkan kabel baru atau lakukan Import file KML rute kabel.'}
            </p>
            {!isReadOnly && !searchQuery && (
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  + Tambah Kabel Pertama
                </button>
                <button
                  onClick={() => setShowKmlModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
                >
                  📥 Import File KML
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Kabel &amp; Kode</th>
                  <th className="px-4 py-3.5">Titik Sambung (Asal ➔ Tujuan)</th>
                  <th className="px-4 py-3.5">Tipe &amp; Panjang</th>
                  <th className="px-4 py-3.5">Alokasi Core</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredCables.map((cable) => {
                  const usedCores = cable.core_count_used || 0;
                  const totalCores = cable.core_count_total || 1;
                  const usedPct = Math.round((usedCores / totalCores) * 100);

                  return (
                    <tr
                      key={cable.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name & Code */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {cable.code}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {cable.name}
                            </span>
                          </div>
                          {cable.route_description && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {cable.route_description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Asal -> Tujuan */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {/* From Node */}
                          {cable.from_node ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${cable.from_node.type === 'POP' ? 'bg-indigo-500' : cable.from_node.type === 'ODC' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                              {cable.from_node.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Tanpa Asal</span>
                          )}

                          <span className="text-slate-400 font-bold">➔</span>

                          {/* To Node */}
                          {cable.to_node ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${cable.to_node.type === 'POP' ? 'bg-indigo-500' : cable.to_node.type === 'ODC' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                              {cable.to_node.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Tanpa Tujuan</span>
                          )}
                        </div>
                      </td>

                      {/* Type & Length */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold w-fit bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            {cable.installation_type || 'Aerial'}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                            {cable.length_meters >= 1000
                              ? `${(cable.length_meters / 1000).toFixed(2)} km`
                              : `${Number(cable.length_meters).toLocaleString('id-ID')} m`}
                          </span>
                        </div>
                      </td>

                      {/* Core Allocation & Bar */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-slate-700 dark:text-slate-300">
                              {usedCores} / {totalCores} C
                            </span>
                            <span className={usedPct > 85 ? 'text-rose-500' : usedPct > 60 ? 'text-amber-500' : 'text-emerald-500'}>
                              {usedPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${usedPct > 85 ? 'bg-rose-500' : usedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, usedPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            cable.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : cable.status === 'maintenance'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : cable.status === 'damaged'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cable.status === 'active' ? 'bg-emerald-500 animate-pulse' : cable.status === 'maintenance' ? 'bg-amber-500' : cable.status === 'damaged' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                          {cable.status === 'active'
                            ? 'Aktif'
                            : cable.status === 'maintenance'
                            ? 'Maintenance'
                            : cable.status === 'damaged'
                            ? 'Rusak/Putus'
                            : 'Nonaktif'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Core Matrix Modal */}
                          <button
                            onClick={() => openMatrixModal(cable)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-all flex items-center gap-1"
                            title="Buka Core Matrix TIA-598-A"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span>Core Matrix</span>
                          </button>

                          {/* View in Cable Route Editor */}
                          <button
                            onClick={() => navigate(`/cable-routes?cable_id=${cable.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-all"
                            title="Lihat &amp; Petakan Rute di Peta"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </button>

                          {/* Edit Cable */}
                          {!isReadOnly && (
                            <button
                              onClick={() => openEditModal(cable)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all"
                              title="Edit Kabel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}

                          {/* Delete Cable */}
                          {!isReadOnly && (
                            <button
                              onClick={() => setDeleteCableData(cable)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all"
                              title="Hapus Kabel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: TAMBAH KABEL BARU
      ══════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Tambah Bentangan Kabel Baru</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftarkan rute kabel dan auto-generate alokasi core matrix standar TIA-598-A</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Bentangan Kabel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Kabel Feeder POP Sudirman ke ODC Kota 01"
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Code with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Kode Kabel <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      ⚡ Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: KBL-FD-24C-01"
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Installation Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipe Instalasi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formInstallation}
                    onChange={(e) => setFormInstallation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Aerial">Aerial (Udara/Tiang)</option>
                    <option value="Underground">Underground (Tanam)</option>
                    <option value="Duct">Duct (Subduct / Pipa)</option>
                    <option value="Wall">Wall (Dinding / Gedung)</option>
                  </select>
                </div>

                {/* From Node */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Node Asal (Source) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formFromNodeId}
                    onChange={(e) => setFormFromNodeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Pilih Node Asal --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        [{n.type}] {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Node */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Node Tujuan (Destination)
                  </label>
                  <select
                    value={formToNodeId}
                    onChange={(e) => setFormToNodeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Tanpa Node Tujuan (Opsional) --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        [{n.type}] {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Core Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Core Optik <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCoreCount}
                    onChange={(e) => handleCoreCountChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="6">6 Core (1 Tube @ 6 Core)</option>
                    <option value="12">12 Core (1 Tube @ 12 Core)</option>
                    <option value="24">24 Core (2 Tube @ 12 Core)</option>
                    <option value="48">48 Core (4 Tube @ 12 Core)</option>
                    <option value="96">96 Core (8 Tube @ 12 Core)</option>
                    <option value="144">144 Core (12 Tube @ 12 Core)</option>
                  </select>
                </div>

                {/* Tube Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Tube (Buffer) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={formTubeCount}
                    onChange={(e) => setFormTubeCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Standar FTTH TIA-598: ~12 core per tube
                  </span>
                </div>

                {/* Length Meters */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Panjang Bentangan Kabel (Meter) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      value={formLengthMeters}
                      onChange={(e) => setFormLengthMeters(e.target.value)}
                      placeholder="1000"
                      className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">
                      Meter ({formLengthMeters ? (parseFloat(formLengthMeters) / 1000).toFixed(2) : 0} km)
                    </span>
                  </div>
                </div>

                {/* Route Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deskripsi Rute Jalur Tiang / Duct
                  </label>
                  <input
                    type="text"
                    value={formRouteDesc}
                    onChange={(e) => setFormRouteDesc(e.target.value)}
                    placeholder="Contoh: Jl. Ahmad Yani - Menuju Tiang PLN #12 s/d ODC-01"
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Teknis Tambahan
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Catatan sambungan, merk kabel, redaman awal, dll..."
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-1.5"
                >
                  {formSubmitting && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>Simpan &amp; Generate Matrix</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: EDIT KABEL
      ══════════════════════════════════════════════════════════════════ */}
      {editCableData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Data Kabel</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perbarui spesifikasi bentangan kabel {editCableData.code}
                </p>
              </div>
              <button
                onClick={() => setEditCableData(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Kabel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status Operasional <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="active">Aktif (Active)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="damaged">Rusak / Putus (Damaged)</option>
                    <option value="inactive">Nonaktif (Inactive)</option>
                  </select>
                </div>

                {/* Installation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipe Instalasi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editInstallation}
                    onChange={(e) => setEditInstallation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Aerial">Aerial (Udara/Tiang)</option>
                    <option value="Underground">Underground (Tanam)</option>
                    <option value="Duct">Duct (Subduct / Pipa)</option>
                    <option value="Wall">Wall (Dinding / Gedung)</option>
                  </select>
                </div>

                {/* From Node */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Node Asal
                  </label>
                  <select
                    value={editFromNodeId}
                    onChange={(e) => setEditFromNodeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Tanpa Node Asal --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        [{n.type}] {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Node */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Node Tujuan
                  </label>
                  <select
                    value={editToNodeId}
                    onChange={(e) => setEditToNodeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Tanpa Node Tujuan --</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        [{n.type}] {n.name} ({n.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Length Meters */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Panjang Bentangan (Meter) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={editLengthMeters}
                    onChange={(e) => setEditLengthMeters(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Route Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deskripsi Jalur Rute
                  </label>
                  <input
                    type="text"
                    value={editRouteDesc}
                    onChange={(e) => setEditRouteDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditCableData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-1.5"
                >
                  {formSubmitting && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: CORE MATRIX TIA-598-A DETAIL & EDITOR
      ══════════════════════════════════════════════════════════════════ */}
      {matrixCableData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {matrixCableData.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Core Matrix: {matrixCableData.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total {matrixCableData.core_count_total || 0} Core ({matrixCableData.core_count_used || 0} Terpakai) • Standar TIA-598-A 12 Warna
                </p>
              </div>
              <button
                onClick={() => setMatrixCableData(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tube Selector Tabs */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Pilih Tube:</span>
              {tubeNumbers.map((tubeNo) => {
                const tubeColor = TIA_COLORS[((tubeNo - 1) % 12)];
                const isSelected = selectedTube === tubeNo;
                return (
                  <button
                    key={tubeNo}
                    onClick={() => {
                      setSelectedTube(tubeNo);
                      setEditingCore(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${tubeColor.bg}`} />
                    <span>Tube #{tubeNo} ({tubeColor.name})</span>
                  </button>
                );
              })}
            </div>

            {/* Matrix Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Cores Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {coresInSelectedTube.map((core) => {
                  const coreColorIndex = ((core.core_number - 1) % 12);
                  const colorDef = TIA_COLORS[coreColorIndex] || TIA_COLORS[0];
                  const isCoreUsed = core.status === 'used';
                  const isCoreDamaged = core.status === 'damaged';
                  const isCoreReserved = core.status === 'reserved';

                  return (
                    <div
                      key={core.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        editingCore?.id === core.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Top row: Core Number + Color Pin */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full ${colorDef.bg} border border-black/20 shadow-2xs`}
                            title={`Warna: ${colorDef.name}`}
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            Core #{core.core_number}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">({colorDef.name})</span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCoreUsed
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : isCoreDamaged
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : isCoreReserved
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {isCoreUsed
                            ? 'Terpakai'
                            : isCoreDamaged
                            ? 'Rusak / Loss'
                            : isCoreReserved
                            ? 'Reserved'
                            : 'Tersedia'}
                        </span>
                      </div>

                      {/* Destination / Details */}
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>Peruntukan:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {core.destination_type || 'UNASSIGNED'}
                          </span>
                        </div>
                        {core.destination_name && (
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>Keterangan:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-right line-clamp-1">
                              {core.destination_name}
                            </span>
                          </div>
                        )}
                        {core.odf_cassette_label && (
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>ODF/Tray:</span>
                            <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                              {core.odf_cassette_label}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Edit Core Button */}
                      {!isReadOnly && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                          <button
                            onClick={() => openCoreEdit(core)}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Atur Core</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Inline Core Edit Form */}
              {editingCore && (
                <div className="mt-4 p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 animate-fadeIn">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs sm:text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <span>Konfigurasi Core #{editingCore.core_number}</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        (Tube #{editingCore.tube_number} - {editingCore.color})
                      </span>
                    </h4>
                    <button
                      onClick={() => setEditingCore(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                    >
                      ✕ Tutup Form
                    </button>
                  </div>

                  <form onSubmit={handleSaveCore} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Status */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Status Core
                        </label>
                        <select
                          value={coreStatus}
                          onChange={(e) => setCoreStatus(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="available">Tersedia (Available)</option>
                          <option value="used">Terpakai (Used)</option>
                          <option value="damaged">Rusak / Loss (Damaged)</option>
                          <option value="reserved">Reserved (Dicadangkan)</option>
                        </select>
                      </div>

                      {/* Destination Type */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Peruntukan / Destinasi
                        </label>
                        <select
                          value={coreDestType}
                          onChange={(e) => setCoreDestType(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="UNASSIGNED">Belum Ditentukan (UNASSIGNED)</option>
                          <option value="ODC">Feed ke ODC</option>
                          <option value="BTS">Backhaul BTS / Tower</option>
                          <option value="CORPORATE">Pelanggan Dedicated / Corporate</option>
                          <option value="LEASED_FIBER">Sewa Fiber / Dark Core</option>
                          <option value="BACKBONE">Link Antar POP / Backbone</option>
                          <option value="RESERVED">Dicadangkan (Reserved)</option>
                        </select>
                      </div>

                      {/* Destination Name / Pelanggan */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Keterangan / Nama Pelanggan
                        </label>
                        <input
                          type="text"
                          value={coreDestName}
                          onChange={(e) => setCoreDestName(e.target.value)}
                          placeholder="e.g. ODC-KOTA-01 atau PT ABC"
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* ODF Tray Label */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Label Kaset ODF / Tray
                        </label>
                        <input
                          type="text"
                          value={coreOdfLabel}
                          onChange={(e) => setCoreOdfLabel(e.target.value)}
                          placeholder="e.g. ODF-01 Tray-A Port-12"
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingCore(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={coreSaving}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-1"
                      >
                        {coreSaving && (
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        <span>Simpan Alokasi Core</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tersedia
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Terpakai
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Rusak
                </span>
              </div>
              <button
                onClick={() => setMatrixCableData(null)}
                className="px-4 py-1.5 rounded-xl font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: KONFIRMASI HAPUS KABEL
      ══════════════════════════════════════════════════════════════════ */}
      {deleteCableData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Hapus Bentangan Kabel?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apakah Anda yakin ingin menghapus bentangan kabel <strong className="text-slate-800 dark:text-slate-200">{deleteCableData.name} ({deleteCableData.code})</strong>?
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                ⚠️ Semua data core matrix ({deleteCableData.core_count_total} core) dan rute koordinat tiang kabel ini akan dihapus secara permanen.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCableData(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={handleDeleteSubmit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                {formSubmitting && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: KONFIRMASI HAPUS SEMUA KABEL
      ══════════════════════════════════════════════════════════════════ */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Hapus SEMUA Bentangan Kabel?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apakah Anda yakin ingin menghapus <strong className="text-rose-600 dark:text-rose-400">SEMUA ({cables.length} bentangan kabel)</strong> dari sistem?
              </p>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-left text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>⚠️ PERINGATAN KRITIKAL:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-rose-600 dark:text-rose-400">
                  <li>Seluruh data Core Matrix TIA-598-A akan dihapus permanen.</li>
                  <li>Seluruh koordinat rute tiang kabel di peta GIS akan dibersihkan.</li>
                  <li>Tindakan ini tidak dapat dibatalkan!</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={formSubmitting}
                onClick={handleDeleteAllSubmit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                {formSubmitting && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>Ya, Hapus Semua Kabel ({cables.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         MODAL: IMPORT KML/KMZ (TARGET: CABLE)
      ══════════════════════════════════════════════════════════════════ */}
      <KmlImportModal
        isOpen={showKmlModal}
        onClose={() => setShowKmlModal(false)}
        initialTarget="cable"
        onSuccess={() => {
          showToast('Import KML kabel berhasil! Data rute telah diperbarui.');
          setShowKmlModal(false);
          loadAllData();
        }}
      />
    </div>
  );
}
