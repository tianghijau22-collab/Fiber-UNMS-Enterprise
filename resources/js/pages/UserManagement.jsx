import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';

/* ══════════════════════════════════════════════════════════════════
   ROLE BADGES & RBAC PERMISSION MATRIX DEFINITION
══════════════════════════════════════════════════════════════════ */
const getRoleBadge = (role) => {
  switch (role) {
    case 'Super Administrator':
      return <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">👑 {role}</span>;
    case 'NOC Operator':
    case 'Operator Jaringan':
      return <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">🖥️ {role}</span>;
    case 'Teknisi Jointer':
      return <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">🧰 {role}</span>;
    case 'Customer Service':
      return <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">🎧 {role}</span>;
    case 'Finance & Billing':
      return <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">💰 {role}</span>;
    default:
      return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold w-fit">{role}</span>;
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'Active':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Active</span>;
    case 'Inactive':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Inactive</span>;
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">Suspended</span>;
  }
};

const PERMISSIONS = [
  { key: 'olt_control', label: 'Akses OLT Telemetry & Provisioning ONU', roles: ['Super Administrator', 'Operator Jaringan', 'NOC Operator'] },
  { key: 'cable_edit', label: 'Edit Rute Kabel & Matriks Splicing Core', roles: ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'] },
  { key: 'otdr_trace', label: 'Menjalankan Fitur OTDR Fault Tracing', roles: ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'] },
  { key: 'ticketing', label: 'Kelola Tiket Trouble & Work Order', roles: ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer', 'Customer Service'] },
  { key: 'crm_customers', label: 'Akses Manajemen Pelanggan & Paket', roles: ['Super Administrator', 'Customer Service', 'Finance & Billing'] },
  { key: 'billing', label: 'Akses Invoicing, Billing, & Tagihan', roles: ['Super Administrator', 'Finance & Billing'] },
  { key: 'user_rbac', label: 'Manajemen Hak Akses & Akun Pegawai', roles: ['Super Administrator'] },
];

/* ══════════════════════════════════════════════════════════════════
   MODAL FORM USER
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

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto min-h-screen">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 my-auto">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold">{user ? `Edit User — ${user.name}` : 'Tambah Akun Pengguna Baru'}</h3>
            <p className="text-xs text-slate-300">Pengaturan Hak Akses RBAC &amp; Data Pegawai Enterprise</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
              {typeof error === 'object' ? Object.values(error).flat().join(' · ') : error}
            </div>
          )}

          <div>
            <label className={lc}>Nama Lengkap Pegawai *</label>
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="misal: Rian Hidayat" className={fc} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Username Login *</label>
              <input required value={form.username} onChange={e => set('username', e.target.value.toLowerCase().trim())} placeholder="misal: rian2026" className={fc} />
            </div>

            <div>
              <label className={lc}>Alamat Email *</label>
              <input required type="email" value={form.email} onChange={e => handleEmailChange(e.target.value)} placeholder="name@fiber-unms.id" className={fc} />
            </div>
          </div>

          <div>
            <label className={lc}>{user ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password Login *'}</label>
            <input type="password" required={!user} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" className={fc} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>Peran Sistem (Role RBAC) *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className={fc}>
                <option value="Super Administrator">👑 Super Administrator</option>
                <option value="Operator Jaringan">🖥️ Operator Jaringan</option>
                <option value="Teknisi Jointer">🧰 Teknisi Jointer</option>
                <option value="Customer Service">🎧 Customer Service</option>
                <option value="Finance & Billing">💰 Finance &amp; Billing</option>
              </select>
            </div>
            <div>
              <label className={lc}>Divisi / Departemen *</label>
              <input required value={form.division} onChange={e => set('division', e.target.value)} placeholder="misal: Field Operations" className={fc} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lc}>No. Telepon / WhatsApp</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0812xxxxxxxx" className={fc} />
            </div>
            <div>
              <label className={lc}>Status Akun *</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
                <option value="Active">🟢 Aktif (Active)</option>
                <option value="Inactive">🟡 Non-Aktif (Inactive)</option>
                <option value="Suspended">🔴 Ditangguhkan (Suspended)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">Batal</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? 'Menyimpan...' : (user ? 'Simpan Perubahan' : 'Buat Akun User')}
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
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

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

  // Custom UI Modals & Feedback (No Browser Alerts)
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
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
        triggerFeedback({ type: 'success', message: isEdit ? 'Data akun user berhasil diperbarui.' : 'Akun user baru berhasil dibuat.' });
        fetchUsers();
      })
      .catch(err => {
        setSaving(false);
        setModalErr(err.errors || err.message || 'Gagal menyimpan akun user');
      });
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
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

  const totalPages = Math.ceil(users.length / perPage) || 1;
  const paginatedUsers = users.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-6 stagger-enter">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Manajemen Pengguna
          </h3>

        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan Akun"
          />
          <button
            onClick={() => { setEditingUser(null); setModalErr(null); setShowModal(true); }}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            <span>+</span> Tambah Akun User
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Akun Terdaftar</div>
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100 font-mono">{users.length}</div>
          <div className="text-xs text-slate-500 font-medium">Pegawai aktif &amp; admin</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Super Administrator</div>
          <div className="text-3xl font-black text-purple-800 dark:text-purple-300 font-mono">{users.filter(u => u.role === 'Super Administrator').length}</div>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Akses penuh sistem root</div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wider">Operator &amp; Field Jointer</div>
          <div className="text-3xl font-black text-indigo-800 dark:text-indigo-300 font-mono">{users.filter(u => u.role === 'Operator Jaringan' || u.role === 'NOC Operator' || u.role === 'Teknisi Jointer').length}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Operator teknis &amp; splicer</div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Customer Service &amp; Finance</div>
          <div className="text-3xl font-black text-emerald-800 dark:text-emerald-300 font-mono">{users.filter(u => u.role === 'Customer Service' || u.role === 'Finance & Billing').length}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Layanan helpdesk &amp; billing</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-2xl">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-800/60 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          Daftar Akun &amp; Hak Akses ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'matrix' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-800/60 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          🛡️ Matriks Izin Akses RBAC
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama pegawai, email, divisi, HP..."
                className="w-full sm:w-72 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full sm:w-48 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                className="w-full sm:w-36 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value="">— Semua Status —</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Nama &amp; Email Pegawai</th>
                    <th className="px-6 py-4">Peran (Role RBAC)</th>
                    <th className="px-6 py-4">Divisi &amp; Kontak</th>
                    <th className="px-6 py-4">Status Akun</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-slate-400 italic">Memuat data pengguna...</td>
                    </tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-slate-400 italic">Tidak ada akun user ditemukan</td>
                    </tr>
                  ) : (
                    paginatedUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{u.name}</p>
                            {u.username && (
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold rounded-md font-mono">
                                @{u.username}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{u.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(u.role)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700 dark:text-slate-300">{u.division}</div>
                          {u.phone && <div className="text-xs font-mono text-slate-400">{u.phone}</div>}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(u.status)}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent('fiber:call-user', { detail: { user: u } }))}
                            className="px-2.5 py-1.5 bg-emerald-50 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                            title="Panggil Pengguna Ini"
                          >
                            <span>📞</span>
                            <span>Panggil</span>
                          </button>
                          <button
                            onClick={() => { setEditingUser(u); setModalErr(null); setShowModal(true); }}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all"
                          >
                            Edit Hak Akses
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/60 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-all"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Menampilkan <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * perPage + 1}</span> - <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * perPage, users.length)}</span> dari <span className="font-bold text-indigo-600 dark:text-indigo-400">{users.length}</span> user
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="px-2 font-bold text-slate-700 dark:text-slate-200">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RBAC PERMISSION MATRIX VISUALIZATION */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">🛡️ Matriks Matriks Izin Akses Sistem (RBAC Permission Matrix)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pemetaan otomatis fitur &amp; hak eksekusi sistem berdasarkan Peran Pegawai</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 dark:bg-slate-950 text-white font-bold">
                <tr>
                  <th className="p-4 w-1/3">Modul &amp; Hak Eksekusi Sistem</th>
                  <th className="p-4 text-center">Super Admin</th>
                  <th className="p-4 text-center">Operator Jaringan</th>
                  <th className="p-4 text-center">Teknisi Jointer</th>
                  <th className="p-4 text-center">Customer Service</th>
                  <th className="p-4 text-center">Finance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {PERMISSIONS.map((perm, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{perm.label}</td>
                    <td className="p-4 text-center">{perm.roles.includes('Super Administrator') ? <span className="text-emerald-600 font-black text-sm">✓ Ya</span> : <span className="text-slate-300">✕</span>}</td>
                    <td className="p-4 text-center">{(perm.roles.includes('Operator Jaringan') || perm.roles.includes('NOC Operator')) ? <span className="text-emerald-600 font-black text-sm">✓ Ya</span> : <span className="text-slate-300">✕</span>}</td>
                    <td className="p-4 text-center">{perm.roles.includes('Teknisi Jointer') ? <span className="text-emerald-600 font-black text-sm">✓ Ya</span> : <span className="text-slate-300">✕</span>}</td>
                    <td className="p-4 text-center">{perm.roles.includes('Customer Service') ? <span className="text-emerald-600 font-black text-sm">✓ Ya</span> : <span className="text-slate-300">✕</span>}</td>
                    <td className="p-4 text-center">{perm.roles.includes('Finance & Billing') ? <span className="text-emerald-600 font-black text-sm">✓ Ya</span> : <span className="text-slate-300">✕</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* ── Custom Modal Konfirmasi Hapus User (Pengganti window.confirm) ── */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#52525b] rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-xl shrink-0 text-rose-600 dark:text-rose-400">
                🗑️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Konfirmasi Hapus Akun
                </h3>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                  TINDAKAN PERMANEN
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pegawai <strong className="text-slate-900 dark:text-white">"{userToDelete.name}"</strong> (Role: {userToDelete.role})? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#52525b] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmExecuteDeleteUser}
                disabled={deleting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
