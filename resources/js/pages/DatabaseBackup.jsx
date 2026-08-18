import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

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
        showToast(json.message || 'Backup database berhasil dibuat!');
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
        showToast(json.message || 'File backup berhasil diunggah!');
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
        showToast(json.message || 'Database berhasil dipulihkan!');
        setRestoreModalData(null);
        setRestoreConfirmationText('');
        fetchBackups();
      } else {
        setRestoreError(json.message || 'Gagal memulihkan database.');
      }
    } catch (err) {
      console.error(err);
      setRestoreError('Terjadi kesalahan sistem saat merestore database.');
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

  const filteredBackups = useMemo(() => {
    if (!search.trim()) return backups;
    const q = search.toLowerCase();
    return backups.filter(b =>
      b.filename.toLowerCase().includes(q) ||
      (b.notes && b.notes.toLowerCase().includes(q)) ||
      (b.created_at && b.created_at.toLowerCase().includes(q))
    );
  }, [backups, search]);

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[99999] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 bg-emerald-900 text-white border-emerald-700 animate-in slide-in-from-top duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans flex items-center gap-2">
            <span>💾</span> Manajemen Backup &amp; Restore Database
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pencadangan snapshot seluruh 52 tabel sistem PostgreSQL Fiber-UNMS Enterprise untuk keamanan &amp; pemulihan data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchBackups}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>

          {isSuperAdmin && (
            <>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>⬆️</span>
                <span>Upload Backup</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>+</span>
                <span>Buat Backup Database Sekarang</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total File Cadangan</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary ? `${summary.total_files} File` : '—'}
          </div>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">Tersimpan di local storage</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Ukuran Disk</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary?.total_size_formatted || '0 B'}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">Format .sql / .sql.gz</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Engine Database</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase">
            {summary?.database_driver || 'PostgreSQL'}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{summary?.database_name || 'fiber_unms_enterprise'}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cadangan Terakhir</div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 truncate">
            {backups.length > 0 ? backups[0].created_human : 'Belum Ada'}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {backups.length > 0 ? new Date(backups[0].created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="🔍 Cari nama file atau catatan backup..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Menampilkan <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredBackups.length}</span> dari total {backups.length} file cadangan
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs animate-pulse">
          <span>⚡</span> Memuat daftar cadangan database...
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-500 text-xs space-y-2">
          <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Belum Ada File Cadangan Database</p>
          <p>Klik tombol <strong>"+ Buat Backup Database Sekarang"</strong> di atas untuk membuat cadangan data pertama Anda.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Nama File Cadangan</th>
                  <th className="px-5 py-3.5">Waktu Pembuatan</th>
                  <th className="px-5 py-3.5">Ukuran File</th>
                  <th className="px-5 py-3.5">Skema &amp; Data</th>
                  <th className="px-5 py-3.5">Catatan Cadangan</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredBackups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Filename */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{b.compressed ? '📦' : '📄'}</span>
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{b.filename}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Driver: {b.driver} {b.compressed ? '(Gzip)' : '(SQL Plain)'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Created Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-slate-400">{b.created_human}</p>
                    </td>

                    {/* Size */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {b.size_formatted}
                      </span>
                    </td>

                    {/* Tables & Records */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {b.tables_count ? (
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {b.tables_count} Tabel · {b.records_count ? `${b.records_count.toLocaleString()} Baris` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Full Database Dump</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-3.5 max-w-xs truncate">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{b.notes || '—'}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download */}
                        <a
                          href={`/api/database/backups/${encodeURIComponent(b.filename)}/download`}
                          download={b.filename}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                          title="Download file .sql ke komputer lokal"
                        >
                          <span>⬇️</span>
                          <span>Download</span>
                        </a>

                        {/* Restore Button */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              setRestoreModalData(b);
                              setRestoreConfirmationText('');
                              setRestoreError(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800/80 transition-all flex items-center gap-1 cursor-pointer"
                            title="Pulihkan database dari file cadangan ini"
                          >
                            <span>🔄</span>
                            <span>Restore</span>
                          </button>
                        )}

                        {/* Delete Button */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeleteConfirmData(b)}
                            className="px-2.5 py-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition-all cursor-pointer"
                            title="Hapus file cadangan ini"
                          >
                            <span>🗑️</span>
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
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Pinned Header */}
            <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>💾 Buat Cadangan Database Baru</span>
                </h3>
                <p className="text-xs text-slate-300">Ekspor seluruh 52 tabel database PostgreSQL UNMS</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
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
                  <p className="text-[10px] text-slate-400 mt-1">Membantu Anda mengingat tujuan pembuatan cadangan ini.</p>
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

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Kompresi File (GZIP .sql.gz)</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Menghemat ruang penyimpanan hingga 80%</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={createForm.compress}
                      onChange={(e) => setCreateForm({ ...createForm, compress: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs space-y-1">
                  <p className="font-bold">ℹ️ Informasi Pencadangan Penuh:</p>
                  <p className="text-[11px] leading-relaxed">
                    Sistem akan mengekspor seluruh struktur tabel, sequence auto-increment, data pelanggan, tiket gangguan, perangkat OLT, site BTS, dan log audit.
                  </p>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {creating && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
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
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Pinned Header */}
            <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>⬆️ Unggah File Cadangan (.sql / .gz)</span>
                </h3>
                <p className="text-xs text-slate-300">Masukkan file database yang telah Anda backup sebelumnya</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
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
                    className="w-full text-xs text-slate-700 dark:text-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Maksimal ukuran file: 100 MB</p>
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
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {uploading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
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
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-300 dark:border-amber-700/80 flex flex-col my-auto max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Header */}
            <div className="bg-amber-600 dark:bg-amber-900/90 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-base font-bold">Konfirmasi Pemulihan Database</h3>
                  <p className="text-[11px] text-amber-100 font-mono">Tindakan ini akan menimpa data aktif saat ini</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl leading-relaxed">
                <p className="font-bold mb-1">Perhatian Penting:</p>
                <p>
                  Memulihkan database dari file <strong>"{restoreModalData.filename}"</strong> akan menggantikan seluruh tabel dan baris data saat ini dengan data yang ada pada file cadangan tersebut.
                </p>
              </div>

              {restoreError && (
                <div className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl font-medium">
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
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                disabled={restoring}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || restoreConfirmationText.trim().toUpperCase() !== 'RESTORE'}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
              >
                {restoring && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <span>{restoring ? 'Memulihkan Database...' : 'Ya, Pulihkan Sekarang'}</span>
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
