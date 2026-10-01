import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext.jsx';
import RefreshButton from '../components/RefreshButton.jsx';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';

const AVAILABLE_ROLES = [
  'Super Administrator',
  'Operator Jaringan',
  'Teknisi Jointer',
  'Customer Service',
  'Finance & Billing',
];

const ALERT_TYPES = [
  { value: 'info', label: 'Info / Umum', color: 'blue', desc: 'Pengumuman reguler, info fitur & pesan umum' },
  { value: 'maintenance', label: 'Pemeliharaan', color: 'amber', desc: 'Jadwal maintenance link optik, OLT & server' },
  { value: 'warning', label: 'Peringatan', color: 'amber', desc: 'Peringatan gangguan parsial atau imbauan teknis' },
  { value: 'critical', label: 'Darurat / Kritis', color: 'rose', desc: 'Insiden darurat, FO cut massal & down total' },
  { value: 'update', label: 'Update Sistem', color: 'emerald', desc: 'Rilis versi baru, pembaruan aplikasi & patch' },
];

export default function PopupAlertManagement() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal State for Create / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    image_url: '',
    type: 'info',
    badge_text: '',
    target_roles: ['all'],
    is_active: true,
    show_once_per_user: false,
    starts_at: '',
    expires_at: '',
    action_button_text: '',
    action_button_url: '',
  });

  // Modal State for Test Preview
  const [previewAlert, setPreviewAlert] = useState(null);

  // Modal State for Image Lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // Modal State for Delete Confirmation
  const [deleteConfirmAlert, setDeleteConfirmAlert] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch all alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('is_active', filterStatus);

      const res = await fetch(`/api/popup-alerts?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setAlerts(json.data || []);
      } else {
        setErrorMsg(json.message || 'Gagal memuat daftar pop-up alert.');
      }
    } catch (err) {
      setErrorMsg(`Error koneksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus, currentUser]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchAlerts);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle ESC key for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null);
        else if (previewAlert) setPreviewAlert(null);
        else if (isFormOpen && !saving) setIsFormOpen(false);
        else if (deleteConfirmAlert && !deleting) setDeleteConfirmAlert(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, previewAlert, isFormOpen, deleteConfirmAlert, saving, deleting]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => a.is_active).length;
    const maintenance = alerts.filter((a) => a.type === 'maintenance').length;
    const criticalOrWarning = alerts.filter((a) => a.type === 'critical' || a.type === 'warning').length;
    return { total, active, maintenance, criticalOrWarning };
  }, [alerts]);

  // Helper kompresi gambar client-side untuk performa optimal & anti-gagal
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Handle Image Upload dengan Multi-Layer Fallback
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran berkas gambar terlalu besar (maksimal 15 MB).');
      return;
    }

    setUploadingImage(true);
    try {
      // 1. Dapatkan base64 terkompresi secara instan
      const base64Data = await compressImage(file);

      // 2. Coba kirimkan ke server API
      let uploadedUrl = null;
      try {
        const data = new FormData();
        data.append('image', file);
        if (base64Data) {
          data.append('image_base64', base64Data);
        }
        data.append('user_id', currentUser?.id || '');

        const res = await fetch('/api/popup-alerts/upload-image', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            'X-User-Id': currentUser?.id || '',
          },
          body: data,
        });

        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && json.url) {
            uploadedUrl = json.url;
          }
        }
      } catch (apiErr) {
        console.warn('API upload error, falling back to direct base64:', apiErr);
      }

      // 3. Gunakan URL dari server atau fallback aman ke base64 yang sudah dioptimasi
      const finalUrl = uploadedUrl || base64Data;
      if (finalUrl) {
        setFormData((prev) => ({ ...prev, image_url: finalUrl }));
      } else {
        alert('Gagal memproses gambar yang dipilih.');
      }
    } catch (err) {
      console.error('Upload handler error:', err);
      alert(`Gagal memuat gambar: ${err.message}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingAlert(null);
    setFormData({
      title: '',
      message: '',
      image_url: '',
      type: 'info',
      badge_text: '',
      target_roles: ['all'],
      is_active: true,
      show_once_per_user: false,
      starts_at: '',
      expires_at: '',
      action_button_text: '',
      action_button_url: '',
    });
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (alert) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title || '',
      message: alert.message || '',
      image_url: alert.image_url || '',
      type: alert.type || 'info',
      badge_text: alert.badge_text || '',
      target_roles: Array.isArray(alert.target_roles) && alert.target_roles.length > 0 ? alert.target_roles : ['all'],
      is_active: Boolean(alert.is_active),
      show_once_per_user: Boolean(alert.show_once_per_user),
      starts_at: alert.starts_at ? alert.starts_at.substring(0, 16) : '',
      expires_at: alert.expires_at ? alert.expires_at.substring(0, 16) : '',
      action_button_text: alert.action_button_text || '',
      action_button_url: alert.action_button_url || '',
    });
    setIsFormOpen(true);
  };

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      alert('Harap lengkapi Judul dan Isi Pesan Alert.');
      return;
    }

    setSaving(true);
    try {
      const url = editingAlert ? `/api/popup-alerts/${editingAlert.id}` : '/api/popup-alerts';
      const method = editingAlert ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        starts_at: formData.starts_at ? formData.starts_at : null,
        expires_at: formData.expires_at ? formData.expires_at : null,
        user_id: currentUser?.id,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setIsFormOpen(false);
        fetchAlerts();
      } else {
        alert(json.message || 'Gagal menyimpan data pop-up alert.');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Quick Toggle Active Switch
  const handleToggleActive = async (alert) => {
    try {
      const res = await fetch(`/api/popup-alerts/${alert.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({ user_id: currentUser?.id }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        fetchAlerts();
      } else {
        alert(json.message || 'Gagal mengubah status alert.');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete Alert
  const handleDelete = async () => {
    if (!deleteConfirmAlert) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/popup-alerts/${deleteConfirmAlert.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({ user_id: currentUser?.id }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setDeleteConfirmAlert(null);
        fetchAlerts();
      } else {
        alert(json.message || 'Gagal menghapus alert.');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Format Helper
  const getTypeBadge = (type) => {
    switch (type) {
      case 'maintenance':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800">Pemeliharaan</span>;
      case 'warning':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800">Peringatan</span>;
      case 'critical':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">Darurat / Kritis</span>;
      case 'update':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800">Update Sistem</span>;
      case 'info':
      default:
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800">Info Umum</span>;
    }
  };

  // Format Roles List
  const formatRoles = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0 || roles.includes('all')) {
      return <span className="font-semibold text-black dark:text-white">Semua Pengguna</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {roles.map((r, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10">
            {r}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-black dark:text-white">

      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
              Khusus Super Administrator
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black dark:text-white">
            Pop-up Pemberitahuan
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
            Kelola pengumuman modal bergambar, jadwal maintenance, peringatan darurat & siaran sistem untuk seluruh pengguna.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing || loading}
            onRefresh={() => triggerRefresh(true)}
            lastUpdatedText={timeAgoText}
            label="Segarkan"
          />
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-bold text-xs hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-2xs cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Buat Pop-up Baru</span>
          </button>
        </div>
      </div>

      {/* ── 2. Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-black border border-black/20 dark:border-white/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Total Pop-up Alert
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1 font-mono">{stats.total}</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Seluruh arsip pengumuman</div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-black border border-black/20 dark:border-white/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Sedang Aktif (Tayang)
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1 font-mono text-emerald-600 dark:text-emerald-400">{stats.active}</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Ditampilkan ke user yang dituju</div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-black border border-black/20 dark:border-white/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Pemeliharaan Jaringan
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1 font-mono text-amber-600 dark:text-amber-400">{stats.maintenance}</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Jadwal maintenance optik</div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-black border border-black/20 dark:border-white/20 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Peringatan & Kritis
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1 font-mono text-rose-600 dark:text-rose-400">{stats.criticalOrWarning}</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">Pemberitahuan darurat/FO cut</div>
        </div>
      </div>

      {/* ── 3. Filters & Search Bar ── */}
      <div className="p-4 rounded-lg bg-white dark:bg-black border border-black/20 dark:border-white/20 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul alert, isi pesan, atau pembuat..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden focus:border-black dark:focus:border-white"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-neutral-500 shrink-0">Tipe:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
          >
            <option value="all">Semua Tipe</option>
            <option value="info">Info / Umum</option>
            <option value="maintenance">Pemeliharaan</option>
            <option value="warning">Peringatan</option>
            <option value="critical">Darurat / Kritis</option>
            <option value="update">Update Sistem</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-neutral-500 shrink-0">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
          >
            <option value="all">Semua Status</option>
            <option value="true">Aktif Saja</option>
            <option value="false">Nonaktif Saja</option>
          </select>
        </div>
      </div>

      {/* ── 4. Alerts Data Table ── */}
      <div className="bg-white dark:bg-black border border-black/20 dark:border-white/20 rounded-lg shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-neutral-500">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Memuat daftar pop-up alert...
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-xs text-rose-500">
            {errorMsg}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto text-neutral-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="text-sm font-bold text-black dark:text-white">Belum Ada Pop-up Alert</div>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Klik tombol &quot;Buat Pop-up Baru&quot; untuk menyetel pengumuman yang akan muncul di layar seluruh pengguna sistem.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tipe & Badge</th>
                  <th className="py-3 px-4">Banner / Foto</th>
                  <th className="py-3 px-4">Judul & Isi Pesan</th>
                  <th className="py-3 px-4">Target Hak Akses</th>
                  <th className="py-3 px-4">Jadwal Tayang</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    {/* Status Toggle */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(alert)}
                        title={alert.is_active ? 'Klik untuk Nonaktifkan' : 'Klik untuk Aktifkan'}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                          alert.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                            : 'bg-black/5 text-neutral-500 border-black/10 dark:bg-white/5 dark:text-neutral-400 dark:border-white/10'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${alert.is_active ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                        <span>{alert.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>

                    {/* Tipe & Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>{getTypeBadge(alert.type)}</div>
                        {alert.badge_text && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {alert.badge_text}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Banner / Foto Thumbnail */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {alert.image_url ? (
                        <div
                          onClick={() => setLightboxImage(alert.image_url)}
                          className="w-14 h-10 rounded-md overflow-hidden border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 cursor-pointer hover:opacity-80 transition-opacity shadow-2xs relative group"
                          title="Klik untuk perbesar gambar"
                        >
                          <img
                            src={alert.image_url}
                            alt={alert.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-400 font-mono italic">— Tanpa Foto</span>
                      )}
                    </td>

                    {/* Title & Message Snippet */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-bold text-black dark:text-white text-sm">
                        {alert.title}
                      </div>
                      <div className="text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed font-normal">
                        {alert.message}
                      </div>
                      {alert.action_button_url && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 dark:text-cyan-400 font-mono">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span>{alert.action_button_text || 'Tombol Tautan'}: {alert.action_button_url}</span>
                        </div>
                      )}
                    </td>

                    {/* Target Roles */}
                    <td className="py-3 px-4">
                      {formatRoles(alert.target_roles)}
                    </td>

                    {/* Schedule */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {alert.starts_at || alert.expires_at ? (
                        <div className="space-y-0.5">
                          {alert.starts_at && <div>Mulai: {new Date(alert.starts_at).toLocaleDateString('id-ID')}</div>}
                          {alert.expires_at && <div>Selesai: {new Date(alert.expires_at).toLocaleDateString('id-ID')}</div>}
                        </div>
                      ) : (
                        <span className="text-neutral-400">Selalu Tayang</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1.5">
                      {/* Test Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewAlert(alert)}
                        title="Uji Tampilan Pop-up"
                        className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(alert)}
                        title="Edit Alert"
                        className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmAlert(alert)}
                        title="Hapus Alert"
                        className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-neutral-600 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. Modal Form (Create / Edit Alert) ── */}
      {isFormOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setIsFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-black dark:text-white my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black text-black dark:text-white">
                  {editingAlert ? 'Edit Pop-up Alert Pemberitahuan' : 'Buat Pop-up Alert Baru'}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Pengumuman ini akan muncul sebagai pop-up interaktif bergambar bagi pengguna yang dituju.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                disabled={saving}
                className="text-neutral-400 hover:text-black dark:hover:text-white p-1 rounded-md cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Judul & Tipe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                    Judul Alert <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Contoh: Pemeliharaan Link Core FO Padang Timur"
                    className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden focus:border-black dark:focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                    Tipe Alert <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                  >
                    {ALERT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Foto / Banner Gambar Pop-up */}
              <div className="p-4 rounded-lg border border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                    Foto / Banner Gambar Pengumuman (Opsional)
                  </label>
                  {formData.image_url && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image_url: '' })}
                      className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>

                {formData.image_url ? (
                  <div className="relative rounded-lg overflow-hidden border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 max-h-48 flex items-center justify-center group">
                    <img
                      src={formData.image_url}
                      alt="Banner Preview"
                      className="w-full h-48 object-contain"
                      onError={(e) => { e.currentTarget.src = ''; }}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-md bg-black/70 hover:bg-black text-white text-[11px] font-bold backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        Ganti Gambar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-md border border-dashed border-black/40 dark:border-white/40 hover:border-black dark:hover:border-white bg-white dark:bg-black text-black dark:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {uploadingImage ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Upload File Gambar (PNG/JPG/WEBP)</span>
                        </>
                      )}
                    </button>

                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">ATAU</span>

                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="Tempel tautan URL gambar eksternal (https://...)"
                      className="flex-1 w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                    />
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Badge Text Kustom */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                  Teks Badge Kustom (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.badge_text}
                  onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                  placeholder="Contoh: Jadwal Pemeliharaan, Siaran Darurat, Update v2.5"
                  className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                />
              </div>

              {/* Isi Pesan */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                  Isi Pesan / Pengumuman <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tuliskan rincian pengumuman yang lengkap. Baris baru (enter) akan otomatis dirapikan..."
                  className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Tombol Aksi Tambahan (Opsional) */}
              <div className="p-3.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
                <div className="text-xs font-bold text-black dark:text-white">Tombol Aksi Tautan (Opsional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500">Teks Tombol</label>
                    <input
                      type="text"
                      value={formData.action_button_text}
                      onChange={(e) => setFormData({ ...formData, action_button_text: e.target.value })}
                      placeholder="Contoh: Lihat Detail Topologi"
                      className="w-full px-3 py-1.5 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500">URL / Rute Tautan</label>
                    <input
                      type="text"
                      value={formData.action_button_url}
                      onChange={(e) => setFormData({ ...formData, action_button_url: e.target.value })}
                      placeholder="Contoh: /network atau https://..."
                      className="w-full px-3 py-1.5 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Target Hak Akses (Target Roles) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">
                  Target Hak Akses Pengguna
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, target_roles: ['all'] })}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      formData.target_roles.includes('all')
                        ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                        : 'bg-white dark:bg-black border-black/20 dark:border-white/20 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    Semua Pengguna (All Roles)
                  </button>
                  {AVAILABLE_ROLES.map((role) => {
                    const isSelected = !formData.target_roles.includes('all') && formData.target_roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          let current = formData.target_roles.includes('all') ? [] : [...formData.target_roles];
                          if (current.includes(role)) {
                            current = current.filter((r) => r !== role);
                            if (current.length === 0) current = ['all'];
                          } else {
                            current.push(role);
                          }
                          setFormData({ ...formData, target_roles: current });
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                            : 'bg-white dark:bg-black border-black/20 dark:border-white/20 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jadwal Tayang (Rentang Waktu) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Mulai Ditampilkan (Opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Berakhir Pada (Opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-md bg-white dark:bg-black border border-black/20 dark:border-white/20 text-black dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Options: is_active & show_once_per_user */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-black/30 dark:border-white/30 text-black dark:text-white cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-black dark:text-white">Publikasikan & Aktifkan</div>
                    <div className="text-[10px] text-neutral-500">Langsung tayang untuk user yang dituju</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_once_per_user}
                    onChange={(e) => setFormData({ ...formData, show_once_per_user: e.target.checked })}
                    className="w-4 h-4 rounded border-black/30 dark:border-white/30 text-black dark:text-white cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-black dark:text-white">Tampilkan 1x Per Pengguna</div>
                    <div className="text-[10px] text-neutral-500">Otomatis selesai setelah ditutup sekali</div>
                  </div>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-md border border-black/20 dark:border-white/20 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-5 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-2xs cursor-pointer flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{editingAlert ? 'Simpan Perubahan' : 'Publikasikan Alert'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── 6. Live Test Preview Modal ── */}
      {previewAlert && createPortal(
        <div
          className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewAlert(null);
          }}
        >
          <div className="relative w-full max-w-lg bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-black dark:text-white my-auto">
            {/* Header Preview Banner */}
            <div className="bg-neutral-900 text-white text-[10px] font-mono font-bold px-4 py-1.5 flex items-center justify-between border-b border-neutral-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                MODE SIMULASI PRATINJAU USER
              </span>
              <span>Tutup Pratinjau (Esc)</span>
            </div>

            {/* Popup Header */}
            <div className="p-5 sm:p-6 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeBadge(previewAlert.type)}
                    {previewAlert.badge_text && (
                      <span className="text-[10px] text-neutral-500 font-mono font-bold">
                        • {previewAlert.badge_text}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-black dark:text-white leading-tight">
                    {previewAlert.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewAlert(null)}
                  className="text-neutral-400 hover:text-black dark:hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Popup Body */}
            <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
              
              {/* Banner Image Preview */}
              {previewAlert.image_url && (
                <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shadow-2xs">
                  <img
                    src={previewAlert.image_url}
                    alt={previewAlert.title}
                    className="w-full h-auto max-h-72 object-contain mx-auto bg-black/5 dark:bg-white/5"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="whitespace-pre-line bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-lg border border-black/10 dark:border-white/10 font-sans">
                {previewAlert.message}
              </div>

              {previewAlert.action_button_url && (
                <div className="pt-1">
                  <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 text-white font-semibold text-xs shadow-2xs">
                    <span>{previewAlert.action_button_text || 'Buka Tautan'}</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="p-4 sm:p-5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-500">
                Pratinjau pop-up pada layar perangkat pengguna
              </span>
              <button
                type="button"
                onClick={() => setPreviewAlert(null)}
                className="px-5 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black font-bold text-xs hover:bg-black/90 dark:hover:bg-white/90 transition-all cursor-pointer shadow-2xs"
              >
                Saya Mengerti (Tutup)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 7. Image Lightbox Modal ── */}
      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-neutral-300 p-2 cursor-pointer font-bold text-sm flex items-center gap-1"
            >
              <span>Tutup (Esc)</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightboxImage}
              alt="Lightbox View"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ── 8. Delete Confirmation Modal ── */}
      {deleteConfirmAlert && createPortal(
        <div
          className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteConfirmAlert(null);
          }}
        >
          <div className="relative w-full max-w-md bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-xl shadow-2xl p-6 text-black dark:text-white space-y-4 my-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <div>
              <h3 className="text-base font-black text-black dark:text-white">
                Hapus Pop-up Alert?
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus alert &quot;<strong>{deleteConfirmAlert.title}</strong>&quot;? Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDeleteConfirmAlert(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-md border border-black/20 dark:border-white/20 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Alert'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
