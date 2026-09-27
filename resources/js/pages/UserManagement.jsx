import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingState from '../components/LoadingState';

/* ══════════════════════════════════════════════════════════════════
   ROLE BADGES & RBAC PERMISSION MATRIX DEFINITION (ZERO EMOJI)
══════════════════════════════════════════════════════════════════ */
const getRoleBadge = (role) => {
  switch (role) {
    case 'Super Administrator':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {role}
        </span>
      );
    case 'NOC Operator':
    case 'Operator Jaringan':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          {role}
        </span>
      );
    case 'Teknisi Jointer':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          {role}
        </span>
      );
    case 'Customer Service':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {role}
        </span>
      );
    case 'Finance & Billing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          {role}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-black/5 dark:bg-white/10 text-black/80 dark:text-white/80 border border-black/15 dark:border-white/15">
          {role}
        </span>
      );
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'Active':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    case 'Inactive':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Inactive
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Suspended
        </span>
      );
  }
};

import { SYSTEM_NAVIGATION_MODULES as SYSTEM_MODULES } from '../config/navigationModules.jsx';

const TARGET_ROLES = [
  { key: 'Operator Jaringan', label: 'Operator Jaringan', color: 'indigo' },
  { key: 'Teknisi Jointer', label: 'Teknisi Jointer', color: 'amber' },
  { key: 'Customer Service', label: 'Customer Service', color: 'sky' },
  { key: 'Finance & Billing', label: 'Finance & Billing', color: 'emerald' },
];

/* ══════════════════════════════════════════════════════════════════
   MODAL FORM USER (PORTAL & DESIGN SYSTEM HARMONIZED)
══════════════════════════════════════════════════════════════════ */
function UserFormModal({ user, onSave, onClose, loading, error }) {
  const [form, setForm] = useState({
    name: user?.name ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'Operator Jaringan',
    division: user?.division ?? 'Operasional Fiber',
    phone: user?.phone ?? '',
    status: user?.status ?? 'Active',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleEmailChange = (val) => {
    setForm(f => {
      const updated = { ...f, email: val };
      if (!user && !f.username && val.includes('@')) {
        updated.username = val.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fc = 'w-full px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs sm:text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all font-medium';
  const lc = 'block text-[11px] font-bold text-black/70 dark:text-white/70 uppercase tracking-wide mb-1';

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Header */}
        <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-black/20 dark:border-white/20">
          <div>
            <h3 className="text-sm sm:text-base font-bold">
              {user ? `Edit Pengguna — ${user.name}` : 'Tambah Akun Pengguna Baru'}
            </h3>
            <p className="text-[11px] text-black/60 dark:text-white/60">
              Pengaturan Hak Akses RBAC &amp; Data Pegawai Enterprise
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
            title="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden text-xs">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-3 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {typeof error === 'object' ? Object.values(error).flat().join(' · ') : error}
              </div>
            )}

            <div>
              <label className={lc}>Nama Lengkap Pegawai *</label>
              <input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="misal: Rian Hidayat"
                className={fc}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>Username Login *</label>
                <input
                  required
                  value={form.username}
                  onChange={e => set('username', e.target.value.toLowerCase().trim())}
                  placeholder="misal: rian2026"
                  className={fc}
                />
              </div>

              <div>
                <label className={lc}>Alamat Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => handleEmailChange(e.target.value)}
                  placeholder="name@fiber-unms.id"
                  className={fc}
                />
              </div>
            </div>

            <div>
              <label className={lc}>
                {user ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password Login *'}
              </label>
              <input
                type="password"
                required={!user}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                className={fc}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>Peran Sistem (Role RBAC) *</label>
                <select value={form.role} onChange={e => set('role', e.target.value)} className={fc}>
                  <option value="Super Administrator">Super Administrator</option>
                  <option value="Operator Jaringan">Operator Jaringan</option>
                  <option value="Teknisi Jointer">Teknisi Jointer</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Finance & Billing">Finance &amp; Billing</option>
                </select>
              </div>
              <div>
                <label className={lc}>Divisi / Departemen *</label>
                <input
                  required
                  value={form.division}
                  onChange={e => set('division', e.target.value)}
                  placeholder="misal: Field Operations"
                  className={fc}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>No. Telepon / WhatsApp</label>
                <input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className={fc}
                />
              </div>
              <div>
                <label className={lc}>Status Akun *</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
                  <option value="Active">Aktif (Active)</option>
                  <option value="Inactive">Non-Aktif (Inactive)</option>
                  <option value="Suspended">Ditangguhkan (Suspended)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pinned Footer */}
          <div className="px-5 py-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? 'Menyimpan...' : (user ? 'Simpan Perubahan' : 'Buat Akun Pengguna')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN USER MANAGEMENT COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function UserManagement() {
  const { currentUser, logout, routePermissions, setRoutePermissions, fetchRoutePermissions } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.role === 'Super Administrator';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'matrix'

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState(null);

  // Delete Confirm State
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── RBAC Permission Settings Matrix State ──
  const [matrixPermissions, setMatrixPermissions] = useState({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState('');
  const [hasUnsavedMatrixChanges, setHasUnsavedMatrixChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingMatrix, setResettingMatrix] = useState(false);

  const triggerFeedback = ({ type, message }) => {
    if (typeof window !== 'undefined' && window.showAppAlert) {
      window.showAppAlert({
        type: type === 'error' ? 'error' : 'success',
        title: type === 'error' ? 'Pemberitahuan Gagal' : 'Berhasil!',
        message,
        duration: 2600,
      });
    }
  };

  const fetchUsers = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    let url = '/api/users?';
    if (roleFilter) url += `role=${encodeURIComponent(roleFilter)}&`;
    if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    return fetch(url)
      .then(res => res.json())
      .then(res => {
        if (res.data) setUsers(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [roleFilter, statusFilter, search]);

  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchUsers);

  // Fetch Matrix Permissions from Server
  const loadMatrixPermissions = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const res = await fetch('/api/rbac/permissions');
      const json = await res.json();
      if (json?.data && typeof json.data === 'object') {
        setMatrixPermissions(json.data);
        setHasUnsavedMatrixChanges(false);
      }
    } catch (err) {
      console.error('Failed to load RBAC permissions:', err);
    } finally {
      setLoadingMatrix(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'matrix') {
      loadMatrixPermissions();
    }
  }, [activeTab, loadMatrixPermissions]);

  // Handle Save User
  const handleSaveUser = (formData) => {
    setSaving(true);
    setModalErr(null);

    const isEdit = !!editingUser;
    const url = isEdit ? `/api/users/${editingUser.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
      },
      body: JSON.stringify(formData)
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => Promise.reject(e));
        return res.json();
      })
      .then(async () => {
        setSaving(false);
        setShowModal(false);

        // Jika pengguna mengedit password akunnya sendiri
        if (isEdit && String(editingUser.id) === String(currentUser?.id) && formData.password && formData.password.trim() !== '') {
          setEditingUser(null);
          await logout();
          navigate('/login', {
            replace: true,
            state: { infoMessage: 'Perubahan kata sandi akun berhasil! Silakan masuk kembali menggunakan kata sandi baru Anda.' }
          });
          return;
        }

        setEditingUser(null);
        triggerFeedback({ type: 'success', message: isEdit ? 'Data akun pengguna berhasil diperbarui.' : 'Akun pengguna baru berhasil dibuat.' });
        fetchUsers();
      })
      .catch(err => {
        setSaving(false);
        setModalErr(err.errors || err.message || 'Gagal menyimpan akun user');
      });
  };

  const confirmExecuteDeleteUser = () => {
    if (!userToDelete) return;
    setDeleting(true);
    fetch(`/api/users/${userToDelete.id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
      }
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => Promise.reject(e));
        return res.json();
      })
      .then(() => {
        setDeleting(false);
        const name = userToDelete.name;
        setUserToDelete(null);
        triggerFeedback({ type: 'success', message: `Akun "${name}" berhasil dihapus dari sistem.` });
        fetchUsers();
      })
      .catch(err => {
        setDeleting(false);
        setUserToDelete(null);
        triggerFeedback({ type: 'error', message: err.message || 'Gagal menghapus user dari sistem.' });
      });
  };

  // Toggle Single Permission in Matrix
  const handleTogglePermission = (path, roleKey) => {
    if (!isSuperAdmin) return;
    if (roleKey === 'Super Administrator') return; // Locked

    setMatrixPermissions(prev => {
      const currentList = Array.isArray(prev[path]) ? [...prev[path]] : [];
      const index = currentList.indexOf(roleKey);
      let nextList;
      if (index > -1) {
        nextList = currentList.filter(r => r !== roleKey);
      } else {
        nextList = [...currentList, roleKey];
      }

      setHasUnsavedMatrixChanges(true);
      return {
        ...prev,
        [path]: nextList
      };
    });
  };

  // Bulk Toggle for a Role across all currently filtered modules
  const handleBulkToggleRole = (roleKey, enableAll) => {
    if (!isSuperAdmin) return;
    setMatrixPermissions(prev => {
      const next = { ...prev };
      SYSTEM_MODULES.forEach(mod => {
        const cur = Array.isArray(next[mod.path]) ? [...next[mod.path]] : [];
        if (enableAll) {
          if (!cur.includes(roleKey)) cur.push(roleKey);
        } else {
          const idx = cur.indexOf(roleKey);
          if (idx > -1) cur.splice(idx, 1);
        }
        next[mod.path] = cur;
      });
      setHasUnsavedMatrixChanges(true);
      return next;
    });
  };

  // Save Matrix Permissions to Backend
  const handleSaveMatrixPermissions = async () => {
    if (!isSuperAdmin) return;
    setSavingMatrix(true);
    try {
      const res = await fetch('/api/rbac/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify({ permissions: matrixPermissions })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menyimpan hak akses halaman.');
      }

      setMatrixPermissions(data.data || matrixPermissions);
      if (setRoutePermissions) {
        setRoutePermissions(data.data || matrixPermissions);
      }
      if (fetchRoutePermissions) {
        fetchRoutePermissions();
      }
      setHasUnsavedMatrixChanges(false);
      triggerFeedback({
        type: 'success',
        message: 'Pengaturan hak akses halaman berhasil disimpan dan langsung diterapkan ke seluruh pengguna!'
      });
    } catch (err) {
      triggerFeedback({
        type: 'error',
        message: err.message || 'Gagal menyimpan pengaturan hak akses.'
      });
    } finally {
      setSavingMatrix(false);
    }
  };

  // Reset Matrix Permissions to Factory Default
  const handleResetMatrixPermissions = async () => {
    if (!isSuperAdmin) return;
    setResettingMatrix(true);
    try {
      const res = await fetch('/api/rbac/permissions/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mereset hak akses.');
      }

      setMatrixPermissions(data.data || {});
      if (setRoutePermissions) {
        setRoutePermissions(data.data || {});
      }
      if (fetchRoutePermissions) {
        fetchRoutePermissions();
      }
      setShowResetConfirm(false);
      setHasUnsavedMatrixChanges(false);
      triggerFeedback({
        type: 'success',
        message: 'Hak akses halaman berhasil direset ke pengaturan bawaan pabrik!'
      });
    } catch (err) {
      triggerFeedback({
        type: 'error',
        message: err.message || 'Gagal mereset pengaturan hak akses.'
      });
    } finally {
      setResettingMatrix(false);
    }
  };

  const totalPages = Math.ceil(users.length / perPage) || 1;
  const paginatedUsers = users.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Filtered System Modules for Tab 2
  const categories = useMemo(() => {
    const setCat = new Set(SYSTEM_MODULES.map(m => m.category));
    return Array.from(setCat);
  }, []);

  const filteredModules = useMemo(() => {
    return SYSTEM_MODULES.filter(mod => {
      if (matrixCategoryFilter && mod.category !== matrixCategoryFilter) return false;
      if (matrixSearch) {
        const s = matrixSearch.toLowerCase();
        const label = (mod.name || mod.label || '').toLowerCase();
        const path = (mod.path || '').toLowerCase();
        const desc = (mod.desc || '').toLowerCase();
        return label.includes(s) || path.includes(s) || desc.includes(s);
      }
      return true;
    });
  }, [matrixCategoryFilter, matrixSearch]);

  return (
    <div className="space-y-5 stagger-enter">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 sm:p-6 rounded-lg border border-black/70 dark:border-white/70 shadow-2xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight font-sans">
            Manajemen Pengguna &amp; Hak Akses Halaman
          </h3>
          <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
            Kelola akun staf, kontrol RBAC dinamis, dan atur izin akses modul halaman per peran
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing || loadingMatrix}
            onRefresh={() => {
              fetchUsers(true);
              if (activeTab === 'matrix') loadMatrixPermissions();
            }}
            lastUpdatedText={timeAgoText}
            label="Segarkan Data"
          />
          <button
            onClick={() => { setEditingUser(null); setModalErr(null); setShowModal(true); }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Akun Pengguna
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 sm:p-5 rounded-lg space-y-1 shadow-2xs">
          <div className="text-[11px] text-black/60 dark:text-white/60 font-bold uppercase tracking-wider">
            Total Akun Terdaftar
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
            {users.length}
          </div>
          <div className="text-[11px] text-black/50 dark:text-white/50 font-medium">
            Pegawai aktif &amp; staf admin
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 sm:p-5 rounded-lg space-y-1 shadow-2xs">
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
            Super Administrator
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {users.filter(u => u.role === 'Super Administrator').length}
          </div>
          <div className="text-[11px] text-black/50 dark:text-white/50 font-medium">
            Akses penuh kontrol root
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 sm:p-5 rounded-lg space-y-1 shadow-2xs">
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
            Operator &amp; Field Jointer
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {users.filter(u => u.role === 'Operator Jaringan' || u.role === 'NOC Operator' || u.role === 'Teknisi Jointer').length}
          </div>
          <div className="text-[11px] text-black/50 dark:text-white/50 font-medium">
            Operator teknis &amp; splicer
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 p-4 sm:p-5 rounded-lg space-y-1 shadow-2xs">
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
            Customer Service &amp; Finance
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {users.filter(u => u.role === 'Customer Service' || u.role === 'Finance & Billing').length}
          </div>
          <div className="text-[11px] text-black/50 dark:text-white/50 font-medium">
            Layanan helpdesk &amp; billing
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-black/20 dark:border-white/20 bg-white dark:bg-black px-4 pt-2 rounded-t-lg">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-black dark:border-white text-black dark:text-white bg-black/5 dark:bg-white/5 rounded-t-md'
                : 'border-transparent text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
            }`}
          >
            Daftar Akun Pengguna ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'matrix'
                ? 'border-black dark:border-white text-black dark:text-white bg-black/5 dark:bg-white/5 rounded-t-md'
                : 'border-transparent text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
            }`}
          >
            Pengaturan Hak Akses Halaman (RBAC)
            {hasUnsavedMatrixChanges && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-500 inline-block" title="Perubahan belum disimpan" />
            )}
          </button>
        </div>

        {activeTab === 'matrix' && isSuperAdmin && hasUnsavedMatrixChanges && (
          <div className="hidden sm:flex items-center gap-2 py-1">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
              Ada perubahan belum disimpan
            </span>
            <button
              onClick={handleSaveMatrixPermissions}
              disabled={savingMatrix}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {savingMatrix ? 'Menyimpan...' : 'Simpan Izin Akses'}
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: USER ACCOUNTS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-lg border border-black/70 dark:border-white/70 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama pegawai, email, username, no. HP..."
                  className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all font-medium"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-black/40 dark:text-white/40 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">— Semua Peran Role —</option>
                <option value="Super Administrator">Super Administrator</option>
                <option value="Operator Jaringan">Operator Jaringan</option>
                <option value="Teknisi Jointer">Teknisi Jointer</option>
                <option value="Customer Service">Customer Service</option>
                <option value="Finance & Billing">Finance &amp; Billing</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">— Semua Status —</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState
              type="table"
              rows={5}
              title="Memuat Data Pengguna..."
              description="Mengambil data pegawai, peran RBAC, dan status akun..."
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-black/80 dark:text-white/80">
                    <thead className="bg-black/5 dark:bg-white/5 border-b border-black/20 dark:border-white/20 text-[11px] uppercase font-bold text-black/70 dark:text-white/70 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Nama &amp; Email Pegawai</th>
                        <th className="px-5 py-3.5">Peran (Role RBAC)</th>
                        <th className="px-5 py-3.5">Divisi &amp; Kontak</th>
                        <th className="px-5 py-3.5">Status Akun</th>
                        <th className="px-5 py-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10 dark:divide-white/10">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs text-black/40 dark:text-white/40 italic">
                            Tidak ada akun user ditemukan
                          </td>
                        </tr>
                      ) : (
                    paginatedUsers.map(u => (
                      <tr key={u.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-black dark:text-white">{u.name}</p>
                            {u.username && (
                              <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded font-mono">
                                @{u.username}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-black/60 dark:text-white/60 mt-0.5">{u.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {getRoleBadge(u.role)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-black dark:text-white">{u.division}</div>
                          {u.phone && <div className="text-[11px] font-mono text-black/60 dark:text-white/60">{u.phone}</div>}
                        </td>
                        <td className="px-5 py-3.5">
                          {getStatusBadge(u.status)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => window.dispatchEvent(new CustomEvent('fiber:call-user', { detail: { user: u } }))}
                              className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-md text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Panggil Pengguna Ini"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>Panggil</span>
                            </button>
                            <button
                              onClick={() => { setEditingUser(u); setModalErr(null); setShowModal(true); }}
                              className="px-2.5 py-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination */}
            {totalPages > 1 && (
              <div className="p-3.5 bg-black/5 dark:bg-white/5 border-t border-black/20 dark:border-white/20 flex items-center justify-between text-xs">
                <span className="text-black/60 dark:text-white/60 font-medium">
                  Menampilkan <span className="font-bold text-black dark:text-white">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-black dark:text-white">{Math.min(currentPage * perPage, users.length)}</span> dari <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{users.length}</span> pengguna
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-black dark:text-white">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Card List View (md:hidden) */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-6 text-center text-xs text-black/40 dark:text-white/40 italic">
                Memuat data pengguna...
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-6 text-center text-xs text-black/40 dark:text-white/40 italic">
                Tidak ada akun pengguna ditemukan
              </div>
            ) : (
              paginatedUsers.map(u => (
                <div
                  key={u.id}
                  className="bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-black dark:text-white">{u.name}</span>
                        {u.username && (
                          <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded font-mono">
                            @{u.username}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-black/60 dark:text-white/60 mt-0.5">{u.email}</p>
                    </div>
                    <div>
                      {getStatusBadge(u.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-black/60 dark:text-white/60 uppercase font-bold block">Peran RBAC</span>
                      <div className="mt-1">{getRoleBadge(u.role)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-black/60 dark:text-white/60 uppercase font-bold block">Divisi &amp; Kontak</span>
                      <p className="font-medium text-black dark:text-white mt-0.5">{u.division}</p>
                      {u.phone && <p className="text-[11px] font-mono text-black/60 dark:text-white/60">{u.phone}</p>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2">
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('fiber:call-user', { detail: { user: u } }))}
                      className="flex-1 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      Panggil
                    </button>
                    <button
                      onClick={() => { setEditingUser(u); setModalErr(null); setShowModal(true); }}
                      className="flex-1 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-md text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setUserToDelete(u)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-md text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="p-3 bg-white dark:bg-black rounded-lg border border-black/70 dark:border-white/70 flex items-center justify-between text-xs">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="font-bold text-black dark:text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-md border border-black/30 dark:border-white/30 bg-white dark:bg-black text-black dark:text-white font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE RBAC PERMISSION MATRIX & DYNAMIC PAGE ACCESS SETTINGS */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg overflow-hidden shadow-2xs p-4 sm:p-6 space-y-4">
          {/* Header Description & Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-black dark:text-white flex items-center gap-2">
                <span>Pengaturan Hak Akses Halaman (Role-Based Page Access)</span>
                {isSuperAdmin ? (
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold font-mono">
                    Mode Pengeditan Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold font-mono">
                    Hanya Baca (Read-Only)
                  </span>
                )}
              </h3>
              <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                Centang kotak pada peran (Role) yang diizinkan mengakses dan melihat menu halaman terkait. Perubahan akan berlaku seketika di seluruh sistem.
              </p>
            </div>

            {isSuperAdmin && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={savingMatrix || resettingMatrix}
                  className="px-3 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white border border-black/20 dark:border-white/20 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Kembalikan semua izin akses ke pengaturan default pabrik"
                >
                  Reset ke Default
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatrixPermissions}
                  disabled={savingMatrix || !hasUnsavedMatrixChanges}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{savingMatrix ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-md border border-black/10 dark:border-white/10">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={matrixSearch}
                  onChange={e => setMatrixSearch(e.target.value)}
                  placeholder="Cari modul / rute halaman..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-black/40 dark:text-white/40 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <select
                value={matrixCategoryFilter}
                onChange={e => setMatrixCategoryFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-1.5 bg-white dark:bg-black border border-black/30 dark:border-white/30 rounded-md text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">— Semua Kategori Modul —</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-black/60 dark:text-white/60 font-mono">
              Menampilkan <b>{filteredModules.length}</b> dari {SYSTEM_MODULES.length} halaman
            </div>
          </div>

          {/* Quick Role Bulk Actions (Super Admin Only) */}
          {isSuperAdmin && (
            <div className="p-3 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-black/70 dark:text-white/70 uppercase">Pintasan Cepat Peran:</span>
              {TARGET_ROLES.map(role => (
                <div key={role.key} className="flex items-center gap-1 border-r border-black/15 dark:border-white/15 pr-2 mr-1">
                  <span className="font-semibold text-black dark:text-white">{role.label}:</span>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleRole(role.key, true)}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold cursor-pointer"
                    title={`Beri semua akses halaman ke role ${role.label}`}
                  >
                    + Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleRole(role.key, false)}
                    className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold cursor-pointer"
                    title={`Cabut semua akses halaman dari role ${role.label}`}
                  >
                    - Kosongkan
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Matrix Table */}
          <div className="overflow-x-auto border border-black/20 dark:border-white/20 rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/5 dark:bg-white/5 border-b border-black/20 dark:border-white/20 text-black dark:text-white font-bold">
                <tr>
                  <th className="p-3.5 min-w-[240px]">Halaman &amp; Rute Sistem</th>
                  <th className="p-3.5 text-center min-w-[130px] bg-purple-500/5">
                    <div className="flex flex-col items-center">
                      <span className="text-purple-600 dark:text-purple-400 font-bold">Super Admin</span>
                      <span className="text-[9px] font-mono text-purple-600/70 dark:text-purple-400/70 uppercase">Akses Penuh</span>
                    </div>
                  </th>
                  {TARGET_ROLES.map(role => (
                    <th key={role.key} className="p-3.5 text-center min-w-[140px]">
                      <div className="flex flex-col items-center">
                        <span className="text-black dark:text-white font-bold">{role.label}</span>
                        <span className="text-[9px] font-mono text-black/50 dark:text-white/50 uppercase">Klik untuk atur</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10 font-medium">
                {loadingMatrix ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-black/40 dark:text-white/40">
                      <LoadingState type="inline" title="Memuat konfigurasi matriks hak akses..." />
                    </td>
                  </tr>
                ) : filteredModules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-black/40 dark:text-white/40 italic">
                      Tidak ada halaman modul yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredModules.map((mod, idx) => {
                    const currentRoles = Array.isArray(matrixPermissions[mod.path]) ? matrixPermissions[mod.path] : [];

                    return (
                      <tr key={mod.path} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        {/* Page Info */}
                        <td className="p-3.5">
                          <div className="font-bold text-black dark:text-white flex items-center gap-2">
                            <span>{mod.name || mod.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60">
                              {mod.path}
                            </span>
                          </div>
                          <div className="text-[11px] text-black/50 dark:text-white/50 mt-0.5">
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
                              [{mod.category}]
                            </span>
                            {mod.desc}
                          </div>
                        </td>

                        {/* Super Administrator: Locked always enabled */}
                        <td className="p-3.5 text-center bg-purple-500/5">
                          <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono text-[11px] font-bold">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Terkunci</span>
                          </div>
                        </td>

                        {/* Configurable Roles */}
                        {TARGET_ROLES.map(role => {
                          const isAllowed = currentRoles.includes(role.key) || currentRoles.includes('*');

                          return (
                            <td key={role.key} className="p-3.5 text-center">
                              {isSuperAdmin ? (
                                <label className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors select-none">
                                  <input
                                    type="checkbox"
                                    checked={isAllowed}
                                    onChange={() => handleTogglePermission(mod.path, role.key)}
                                    className="w-4 h-4 rounded border-black/30 dark:border-white/30 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </label>
                              ) : (
                                isAllowed ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Ya
                                  </span>
                                ) : (
                                  <span className="text-black/30 dark:text-white/30 font-mono">—</span>
                                )
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Floating/Pinned Save Bar if Unsaved */}
          {isSuperAdmin && (
            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-black/60 dark:text-white/60">
                {hasUnsavedMatrixChanges ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    Perubahan konfigurasi belum disimpan ke database
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Seluruh konfigurasi hak akses tersinkronisasi
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadMatrixPermissions}
                  disabled={!hasUnsavedMatrixChanges || savingMatrix}
                  className="px-3.5 py-2 rounded-md border border-black/30 dark:border-white/30 text-xs font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Batalkan Perubahan
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatrixPermissions}
                  disabled={!hasUnsavedMatrixChanges || savingMatrix}
                  className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{savingMatrix ? 'Menyimpan ke Sistem...' : 'Simpan Perubahan Hak Akses'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORM MODAL */}
      {showModal && (
        <UserFormModal
          user={editingUser}
          onSave={handleSaveUser}
          onClose={() => { setShowModal(false); setEditingUser(null); setModalErr(null); }}
          loading={saving}
          error={modalErr}
        />
      )}

      {/* Standard Confirm Dialog for Delete User */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        title="Konfirmasi Hapus Akun"
        message={`Apakah Anda yakin ingin menghapus akun pegawai "${userToDelete?.name}" (Role: ${userToDelete?.role})? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.`}
        confirmText={deleting ? 'Menghapus...' : 'Ya, Hapus Akun'}
        cancelText="Batal"
        type="danger"
        loading={deleting}
        onConfirm={confirmExecuteDeleteUser}
        onClose={() => setUserToDelete(null)}
      />

      {/* Standard Confirm Dialog for Reset RBAC Matrix */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Hak Akses ke Bawaan"
        message="Apakah Anda yakin ingin mereset seluruh konfigurasi izin akses halaman ke pengaturan bawaan pabrik (default)? Seluruh penyesuaian hak akses peran akan ditimpa."
        confirmText={resettingMatrix ? 'Mereset...' : 'Ya, Reset ke Bawaan'}
        cancelText="Batal"
        type="warning"
        loading={resettingMatrix}
        onConfirm={handleResetMatrixPermissions}
        onClose={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
