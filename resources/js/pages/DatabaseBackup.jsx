import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

/* ── Clean SVG Icons (No Emojis) ── */
const IconDatabase = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const IconRefresh = ({ spinning }) => (
  <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconUpload = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IconDownload = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const IconRestore = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconFile = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconAlertTriangle = () => (
  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default function DatabaseBackup() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Administrator');

  const [backups, setBackups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [restoreModalData, setRestoreModalData] = useState(null);
  const [deleteConfirmData, setDeleteConfirmData] = useState(null);

  // Form States
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    notes: '',
    custom_tag: '',
    compress: false,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadNotes, setUploadNotes] = useState('');
  const fileInputRef = useRef(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [restoreError, setRestoreError] = useState(null);

  // Clear Operational Data States
  const [clearing, setClearing] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [clearError, setClearError] = useState(null);
  const [autoBackupBeforeClear, setAutoBackupBeforeClear] = useState(true);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/database/backups');
      const json = await res.json();
      if (json.success) {
        setBackups(json.data || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/database/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Backup database berhasil dibuat.');
        setShowCreateModal(false);
        setCreateForm({ notes: '', custom_tag: '', compress: false });
        fetchBackups();
      } else {
        alert(json.message || 'Gagal membuat backup');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan saat membuat backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleUploadBackup = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Pilih file cadangan (.sql / .sql.gz) terlebih dahulu.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('backup_file', file);
    formData.append('notes', uploadNotes);

    try {
      const res = await fetch('/api/database/backups/upload', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'File backup berhasil diunggah.');
        setShowUploadModal(false);
        setUploadNotes('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchBackups();
      } else {
        alert(json.message || 'Gagal mengunggah file backup');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengunggah file.');
    } finally {
      setUploading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreModalData) return;
    if (restoreConfirmationText.trim().toUpperCase() !== 'RESTORE') {
      setRestoreError('Ketik kata "RESTORE" dengan huruf besar untuk mengonfirmasi tindakan.');
      return;
    }

    setRestoring(true);
    setRestoreError(null);

    try {
      const res = await fetch(`/api/database/backups/${encodeURIComponent(restoreModalData.filename)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Database berhasil dipulihkan.');
        setRestoreModalData(null);
        setRestoreConfirmationText('');
        fetchBackups();
      } else {
        setRestoreError(json.message || 'Gagal memulihkan database.');
      }
    } catch (err) {
      console.error(err);
      setRestoreError('Terjadi kesalahan sistem saat memulihkan database.');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!deleteConfirmData) return;
    try {
      const res = await fetch(`/api/database/backups/${encodeURIComponent(deleteConfirmData.filename)}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'File cadangan berhasil dihapus.');
        setDeleteConfirmData(null);
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus file cadangan.');
    }
  };

  const handleClearOperationalData = async () => {
    if (clearConfirmationText.trim() !== 'KOSONGKAN-DATABASE-OPERASIONAL') {
      setClearError('Ketik "KOSONGKAN-DATABASE-OPERASIONAL" secara persis dengan huruf besar.');
      return;
    }

    setClearing(true);
    setClearError(null);

    try {
      const res = await fetch('/api/database/clear-operational-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          confirmation: clearConfirmationText.trim(),
          auto_backup: autoBackupBeforeClear,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Seluruh data operasional berhasil dikosongkan.');
        setShowClearModal(false);
        setClearConfirmationText('');
        fetchBackups();
      } else {
        setClearError(json.message || 'Gagal mengosongkan database.');
      }
    } catch (err) {
      console.error(err);
      setClearError('Terjadi kesalahan jaringan/sistem saat mengosongkan database.');
    } finally {
      setClearing(false);
    }
  };

  const filteredBackups = useMemo(() => {
    if (!search.trim()) return backups;
    const q = search.toLowerCase();
    return backups.filter(b =>
      b.filename.toLowerCase().includes(q) ||
      (b.notes && b.notes.toLowerCase().includes(q)) ||
      (b.created_at && b.created_at.toLowerCase().includes(q))
    );
  }, [backups, search]);

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs sm:text-sm text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium';
  const lc = 'block text-xs font-bold text-black dark:text-white uppercase tracking-wide mb-1';

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[99999] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 bg-black text-white border-neutral-800 dark:bg-white dark:text-black dark:border-neutral-200 animate-in slide-in-from-top duration-200">
          <IconCheck />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight font-sans flex items-center gap-2.5">
            <IconDatabase />
            <span>Manajemen Cadangan &amp; Pemulihan Database</span>
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
            Pencadangan snapshot seluruh 52 tabel sistem PostgreSQL Fiber-UNMS Enterprise untuk keamanan &amp; pemulihan data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchBackups}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <IconRefresh spinning={loading} />
            <span>Perbarui</span>
          </button>

          {isSuperAdmin && (
            <>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <IconUpload />
                <span>Unggah Cadangan</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>+</span>
                <span>Buat Cadangan Database Sekarang</span>
              </button>

              <button
                onClick={() => {
                  setClearConfirmationText('');
                  setClearError(null);
                  setShowClearModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Kosongkan data OLT, POP, ODC, ODP, BTS, Pelanggan, Tiket untuk mulai dari awal"
              >
                <IconTrash />
                <span>Kosongkan Seluruh Data</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Total File Cadangan</div>
          <div className="text-2xl font-bold text-black dark:text-white mt-1">
            {summary ? `${summary.total_files} File` : '—'}
          </div>
          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-1 font-medium">Tersimpan di local storage</p>
        </div>

        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Total Ukuran Disk</div>
          <div className="text-2xl font-bold text-black dark:text-white mt-1 font-mono">
            {summary?.total_size_formatted || '0 B'}
          </div>
          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-1 font-mono">Format .sql / .sql.gz</p>
        </div>

        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Engine Database</div>
          <div className="text-2xl font-bold text-black dark:text-white mt-1 uppercase">
            {summary?.database_driver || 'PostgreSQL'}
          </div>
          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-1 font-mono">{summary?.database_name || 'fiber_unms_enterprise'}</p>
        </div>

        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Cadangan Terakhir</div>
          <div className="text-sm font-bold text-black dark:text-white mt-2 truncate font-mono">
            {backups.length > 0 ? backups[0].created_human : 'Belum Ada'}
          </div>
          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5">
            {backups.length > 0 ? new Date(backups[0].created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Cari nama file atau catatan backup..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs text-black dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
          />
        </div>

        <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400 shrink-0">
          Menampilkan <span className="text-black dark:text-white">{filteredBackups.length}</span> dari total {backups.length} file cadangan
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 py-16 text-center text-neutral-600 dark:text-neutral-400 text-xs animate-pulse space-y-2">
          <div className="w-7 h-7 border-2 border-slate-300 dark:border-neutral-700 border-t-black dark:border-t-white rounded-full animate-spin mx-auto" />
          <p className="font-bold">Memuat daftar cadangan database...</p>
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 py-16 text-center text-neutral-600 dark:text-neutral-400 text-xs space-y-2">
          <p className="font-bold text-black dark:text-white text-sm">Belum Ada File Cadangan Database</p>
          <p>Klik tombol <strong>"+ Buat Cadangan Database Sekarang"</strong> di atas untuk membuat cadangan data pertama Anda.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-black dark:text-white">
              <thead className="bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 text-xs uppercase font-bold text-neutral-700 dark:text-neutral-300 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Nama File Cadangan</th>
                  <th className="px-5 py-3.5">Waktu Pembuatan</th>
                  <th className="px-5 py-3.5">Ukuran File</th>
                  <th className="px-5 py-3.5">Skema &amp; Data</th>
                  <th className="px-5 py-3.5">Catatan Cadangan</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-900 text-xs">
                {filteredBackups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50 dark:hover:bg-neutral-900/60 transition-colors">
                    {/* Filename */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-neutral-500 dark:text-neutral-400"><IconFile /></span>
                        <div>
                          <p className="font-mono font-bold text-black dark:text-white text-xs">{b.filename}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">Driver: {b.driver} {b.compressed ? '(Gzip)' : '(SQL Plain)'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Created Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-bold text-black dark:text-white">
                        {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-neutral-500">{b.created_human}</p>
                    </td>

                    {/* Size */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-neutral-900 text-black dark:text-white border border-slate-300 dark:border-neutral-700">
                        {b.size_formatted}
                      </span>
                    </td>

                    {/* Tables & Records */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {b.tables_count ? (
                        <span className="font-bold text-black dark:text-white">
                          {b.tables_count} Tabel · {b.records_count ? `${b.records_count.toLocaleString()} Baris` : ''}
                        </span>
                      ) : (
                        <span className="text-neutral-500 italic">Full Database Dump</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-3.5 max-w-xs truncate">
                      <span className="text-black dark:text-white font-medium">{b.notes || '—'}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download */}
                        <a
                          href={`/api/database/backups/${encodeURIComponent(b.filename)}/download`}
                          download={b.filename}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-black dark:text-white font-bold text-xs border border-slate-300 dark:border-neutral-700 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Download file .sql ke komputer lokal"
                        >
                          <IconDownload />
                          <span>Unduh</span>
                        </a>

                        {/* Restore Button */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              setRestoreModalData(b);
                              setRestoreConfirmationText('');
                              setRestoreError(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-neutral-900 hover:bg-amber-100 dark:hover:bg-neutral-800 text-amber-800 dark:text-amber-200 font-bold text-xs border border-amber-300 dark:border-amber-700 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Pulihkan database dari file cadangan ini"
                          >
                            <IconRestore />
                            <span>Pulihkan</span>
                          </button>
                        )}

                        {/* Delete Button */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeleteConfirmData(b)}
                            className="px-2.5 py-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-neutral-900 text-xs font-bold transition-all cursor-pointer border border-transparent hover:border-red-300 dark:hover:border-red-900"
                            title="Hapus file cadangan ini"
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Buat Backup Database Baru (createPortal)
      ══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Pinned Header */}
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <IconDatabase />
                  <span>Buat Cadangan Database Baru</span>
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Ekspor seluruh 52 tabel database PostgreSQL UNMS</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBackup} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className={lc}>Catatan Cadangan (Opsional)</label>
                  <input
                    type="text"
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    placeholder="misal: Backup sebelum migrasi router OLT ZTE C300"
                    className={fc}
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Membantu mengingat tujuan pembuatan cadangan ini.</p>
                </div>

                <div>
                  <label className={lc}>Label / Tag Khusus (Opsional)</label>
                  <input
                    type="text"
                    value={createForm.custom_tag}
                    onChange={(e) => setCreateForm({ ...createForm, custom_tag: e.target.value })}
                    placeholder="misal: pre-update / bulanan"
                    className={`${fc} font-mono`}
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-black dark:text-white text-xs">Kompresi File (GZIP .sql.gz)</span>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400">Menghemat ruang penyimpanan hingga 80%</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={createForm.compress}
                      onChange={(e) => setCreateForm({ ...createForm, compress: e.target.checked })}
                      className="w-4 h-4 rounded text-black focus:ring-black cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-black dark:text-white rounded-xl text-xs space-y-1">
                  <p className="font-bold">Informasi Pencadangan Penuh:</p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Sistem akan mengekspor seluruh struktur tabel, sequence auto-increment, data pelanggan, tiket gangguan, perangkat OLT, site BTS, dan log audit.
                  </p>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-bold transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {creating && <span className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-black rounded-full animate-spin" />}
                  <span>{creating ? 'Mengekspor Database...' : 'Mulai Ekspor Backup'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Upload File Cadangan Eksternal (createPortal)
      ══════════════════════════════════════════════════════════════════ */}
      {showUploadModal && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-xl bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Pinned Header */}
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <IconUpload />
                  <span>Unggah File Cadangan (.sql / .gz)</span>
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Masukkan file database yang telah Anda backup sebelumnya</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadBackup} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className={lc}>Pilih File Backup (*.sql, *.sql.gz) *</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".sql,.gz,.sql.gz"
                    required
                    className="w-full text-xs text-black dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 dark:file:bg-neutral-800 file:text-black dark:file:text-white hover:file:opacity-80 cursor-pointer border border-slate-300 dark:border-neutral-700 rounded-xl p-2 bg-slate-50 dark:bg-neutral-900"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Maksimal ukuran file: 100 MB</p>
                </div>

                <div>
                  <label className={lc}>Catatan Tambahan File (Opsional)</label>
                  <input
                    type="text"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="misal: Backup server lama tanggal 10 Januari"
                    className={fc}
                  />
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-bold transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {uploading && <span className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-black rounded-full animate-spin" />}
                  <span>{uploading ? 'Mengunggah File...' : 'Upload File'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Konfirmasi Restore Database (Danger Zone - createPortal)
      ══════════════════════════════════════════════════════════════════ */}
      {restoreModalData && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
          <div className="relative w-full max-w-lg bg-white dark:bg-black rounded-2xl shadow-2xl border border-amber-300 dark:border-amber-800 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Header */}
            <div className="bg-white dark:bg-black text-black dark:text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <IconAlertTriangle />
                <div>
                  <h3 className="text-base font-bold">Konfirmasi Pemulihan Database</h3>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">Tindakan ini akan menimpa data aktif saat ini</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="p-3.5 bg-amber-50 dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl leading-relaxed">
                <p className="font-bold mb-1">Perhatian Penting:</p>
                <p>
                  Memulihkan database dari file <strong>"{restoreModalData.filename}"</strong> akan menimpa seluruh data tabel saat ini dengan snapshot yang ada pada cadangan tersebut secara aman.
                </p>
              </div>

              {restoreError && (
                <div className="p-3 bg-red-50 dark:bg-neutral-900 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl font-bold">
                  {restoreError}
                </div>
              )}

              <div>
                <label className={lc}>Ketik kata "RESTORE" untuk melanjutkan:</label>
                <input
                  type="text"
                  value={restoreConfirmationText}
                  onChange={(e) => setRestoreConfirmationText(e.target.value)}
                  placeholder="Ketik RESTORE"
                  className={`${fc} uppercase font-mono font-bold tracking-widest text-center text-base`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                disabled={restoring}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || restoreConfirmationText.trim().toUpperCase() !== 'RESTORE'}
                className="px-5 py-2 rounded-xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
              >
                {restoring && <span className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-black rounded-full animate-spin" />}
                <span>{restoring ? 'Memulihkan Database...' : 'Ya, Pulihkan Sekarang'}</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CLEAR OPERATIONAL DATA MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showClearModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-950 border border-rose-300 dark:border-rose-900/60 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                  <IconTrash />
                </span>
                <div>
                  <h3 className="font-bold text-base text-rose-900 dark:text-rose-100">Kosongkan Seluruh Data Operasional</h3>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">Membersihkan data inputan agar sistem siap dimulai dari awal &amp; bersih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* Detailed Scope Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-1.5">
                  <div className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                    <span>🗑️ Data yang AKAN DIBERSIHKAN:</span>
                  </div>
                  <ul className="space-y-1 text-rose-700 dark:text-rose-300/90 pl-3 list-disc">
                    <li>Semua OLT &amp; Registrasi ONT</li>
                    <li>Semua Node (POP, ODC, ODP, Closure)</li>
                    <li>Kabel Fiber, Core Matrix, Splitter &amp; Port</li>
                    <li>Semua Data Pelanggan, Layanan &amp; Invoice</li>
                    <li>Semua Tiket &amp; Pengukuran ODP/OPM</li>
                    <li>Data BTS Sites &amp; Telemetri</li>
                  </ul>
                </div>

                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl space-y-1.5">
                  <div className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>🛡️ Data yang DIJAMIN AMAN:</span>
                  </div>
                  <ul className="space-y-1 text-emerald-700 dark:text-emerald-300/90 pl-3 list-disc">
                    <li><strong>Manajemen Users &amp; Akun Login</strong> (Tidak dihapus)</li>
                    <li>Hak Akses (Roles &amp; Permissions)</li>
                    <li>Master Wilayah (Provinsi/Kota/Kecamatan)</li>
                    <li>Tipe Standar Kabel &amp; Splitter</li>
                  </ul>
                </div>
              </div>

              {/* Auto Backup Safeguard Notice */}
              <div className="p-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">Cadangan Darurat Otomatis</div>
                  <div className="text-[11px] text-slate-500">Sistem otomatis membuat backup (.sql) sebelum penghapusan dijalankan.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupBeforeClear}
                    onChange={(e) => setAutoBackupBeforeClear(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {clearError && (
                <div className="p-3 bg-red-50 dark:bg-neutral-900 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl font-bold">
                  {clearError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide mb-1">
                  Ketik persis kata konfirmasi di bawah untuk mengeksekusi:
                </label>
                <div className="p-2 bg-slate-100 dark:bg-neutral-900 rounded-lg text-center font-mono font-black text-rose-600 dark:text-rose-400 select-all mb-2 tracking-wider">
                  KOSONGKAN-DATABASE-OPERASIONAL
                </div>
                <input
                  type="text"
                  value={clearConfirmationText}
                  onChange={(e) => setClearConfirmationText(e.target.value)}
                  placeholder="Ketik KOSONGKAN-DATABASE-OPERASIONAL"
                  className={`${fc} uppercase font-mono font-bold tracking-wider text-center text-sm border-rose-300 dark:border-rose-800 focus:ring-rose-500`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearOperationalData}
                disabled={clearing || clearConfirmationText.trim() !== 'KOSONGKAN-DATABASE-OPERASIONAL'}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
              >
                {clearing && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <span>{clearing ? 'Sedang Mengosongkan Database...' : '🗑️ Ya, Kosongkan Data Sekarang'}</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONFIRM DELETE DIALOG
      ══════════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        isOpen={!!deleteConfirmData}
        title="Hapus File Cadangan Database"
        message={`Apakah Anda yakin ingin menghapus file cadangan "${deleteConfirmData?.filename}" secara permanen?`}
        confirmText="Ya, Hapus File"
        cancelText="Batal"
        type="danger"
        onConfirm={handleDeleteBackup}
        onClose={() => setDeleteConfirmData(null)}
      />
    </div>
  );
}
