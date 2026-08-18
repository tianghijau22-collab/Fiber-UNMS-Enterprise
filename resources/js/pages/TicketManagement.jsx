import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

/* ══════════════════════════════════════════════════════════════════
   BADGES & HELPERS
══════════════════════════════════════════════════════════════════ */
const getStatusBadge = (status) => {
  switch (status) {
    case 'Open':
      return <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🟡</span> Open</span>;
    case 'In Progress':
      return <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🔵</span> In Progress</span>;
    case 'Resolved':
      return <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>🟢</span> Resolved</span>;
    case 'Closed':
      return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-bold rounded-xl flex items-center gap-1.5 w-fit"><span>⚪</span> Closed</span>;
    default:
      return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl">{status}</span>;
  }
};

const getCategoryBadge = (cat) => {
  switch (cat) {
    case 'Gangguan ODP':
      return <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 text-[10px] font-bold rounded-md">🟡 Gangguan ODP</span>;
    case 'Pemasangan ODP Baru':
      return <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 text-[10px] font-bold rounded-md">📦 Pemasangan ODP Baru</span>;
    case 'Gangguan INTERFACE':
      return <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 text-[10px] font-bold rounded-md">⚡ Gangguan INTERFACE</span>;
    case 'Gangguan BTS / CORPORATE':
      return <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 text-[10px] font-bold rounded-md">🏢 BTS / CORPORATE</span>;
    case 'Fiber Cut':
      return <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-[10px] font-bold rounded-md">🔴 Fiber Cut (Putus)</span>;
    default:
      return <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold rounded-md">{cat}</span>;
  }
};

const JOINTER_CATEGORIES = [
  'Gangguan ODP',
  'Pemasangan ODP Baru',
  'Gangguan INTERFACE',
  'Gangguan BTS / CORPORATE',
  'Fiber Cut',
];

const QUICK_PRESETS = [
  { label: '🟡 Gangguan ODP', title: 'Perbaikan Redaman / Port ODP Bermasalah', category: 'Gangguan ODP', desc: 'Indikasi redaman tinggi pada port splitter ODP, perlu pengecekan adaptor & pembersihan pigtail.' },
  { label: '📦 Pasang ODP Baru', title: 'Pemasangan & Terminasi ODP Baru', category: 'Pemasangan ODP Baru', desc: 'Penarikan kabel feeder, pemasangan enclosure ODP di tiang, dan splicing core distribusi.' },
  { label: '⚡ Gangguan INTERFACE', title: 'Interface Port SFP / OLT Down', category: 'Gangguan INTERFACE', desc: 'Port uplink / PON interface mengalami loss optical signal atau status down, perlu cek transceiver SFP.' },
  { label: '🏢 BTS / CORPORATE', title: 'Gangguan Link Fiber Optik BTS / Pelanggan Dedicated', category: 'Gangguan BTS / CORPORATE', desc: 'Link transmisi BTS / pelanggan corporate terganggu, perlu penanganan tim jointer prioritas.' },
  { label: '🔴 Fiber Cut (Putus)', title: 'Kabel Fiber Optik Terputus (Fiber Cut)', category: 'Fiber Cut', desc: 'Kabel optik terputus terkena kendaraan / pohon tumbang, perlu penyambungan core dengan fusion splicer.' },
];

/* ══════════════════════════════════════════════════════════════════
   MODAL: BUAT TIKET JOINTER BARU (Hanya Superadmin & Operator)
══════════════════════════════════════════════════════════════════ */
function CreateTicketModal({ nodes = [], technicians = [], onSave, onClose, loading, error }) {
  const [form, setForm] = useState({
    title: '',
    category: 'Gangguan ODP',
    status: 'Open',
    network_node_id: '',
    technician_name: '',
    dispatch_team: '',
    description: '',
    dispatch_telegram: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const applyPreset = (p) => {
    setForm(prev => ({
      ...prev,
      title: p.title,
      category: p.category,
      description: p.desc,
    }));
  };

  const handleTechnicianSelect = (e) => {
    const techName = e.target.value;
    set('technician_name', techName);
    if (!techName) return;
    const user = technicians.find(u => u.name === techName);
    if (user && user.division) {
      set('dispatch_team', user.division);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Pinned Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>🛠️ Buat Tiket Penugasan Tim Jointer</span>
            </h3>
            <p className="text-xs text-slate-300">Penerbitan work order teknis pemeliharaan &amp; penarikan fiber optik</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
                {typeof error === 'object' ? Object.values(error).flat().join(' · ') : error}
              </div>
            )}

            {/* Quick Presets */}
            <div>
              <label className={lc}>Template Cepat Kasus Jointer</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {QUICK_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className={lc}>Judul Tiket / Ringkasan Pekerjaan *</label>
              <input
                required
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="misal: Sambung Ulang Dropcore ODP-01 Tiang #12"
                className={fc}
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lc}>Kategori Pekerjaan *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className={fc}>
                  {JOINTER_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lc}>Status Awal *</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={fc}>
                  <option value="Open">🟡 Open (Baru)</option>
                  <option value="In Progress">🔵 Dalam Penanganan</option>
                </select>
              </div>
            </div>

            {/* Node Selection */}
            <div>
              <label className={lc}>Titik Lokasi / ODP / POP / BTS (Opsional)</label>
              <select value={form.network_node_id} onChange={e => set('network_node_id', e.target.value)} className={fc}>
                <option value="">-- Pilih Node Jaringan / Titik Lokasi --</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    [{n.node_type || n.type || 'NODE'}] {n.name} ({n.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Technician Tagging (From Users Table) */}
            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide mb-1">
                    👷 Tag Teknisi Penanggung Jawab *
                  </label>
                  <select
                    value={form.technician_name}
                    onChange={handleTechnicianSelect}
                    className={`${fc} font-semibold`}
                  >
                    <option value="">-- Pilih User Teknisi / Jointer --</option>
                    {technicians.map(u => (
                      <option key={u.id} value={u.name}>
                        {u.name} — {u.role} ({u.division || 'Divisi Lapangan'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide mb-1">
                    👥 Tim Lapangan (Dispatch Team)
                  </label>
                  <input
                    value={form.dispatch_team}
                    onChange={e => set('dispatch_team', e.target.value)}
                    placeholder="misal: Tim Jointer 1"
                    className={fc}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={lc}>Instruksi / Catatan Awal Pekerjaan</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Rincian kendala, instruksi rute tiang, atau perlengkapan yang perlu dibawa..."
                className={fc}
              />
            </div>

            {/* Dispatch to Telegram checkbox */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-base">📢</span>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Siarkan Tugas ke Telegram Teknisi</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Kirim link pelacakan langsung ke grup Telegram NOC/Teknisi</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.dispatch_telegram}
                onChange={e => set('dispatch_telegram', e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Pinned Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{loading ? 'Menerbitkan...' : 'Terbitkan Tiket Jointer'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODAL: DETAIL TIKET, KRONOLOGI TINDAKAN & UPLOAD BUKTI FOTO (createPortal)
══════════════════════════════════════════════════════════════════ */
// Client-side smart image compressor (Resizes 10MB phone photo to ~150KB instant upload)
const compressImage = (file, maxWidth = 1280, quality = 0.8) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

function TicketDetailModal({ ticket, currentUser, technicians = [], onAddProgress, onDispatchTelegram, isOperatorOrAdmin, onClose }) {
  const [progressComment, setProgressComment] = useState('');
  const [progressStatus, setProgressStatus] = useState(ticket.status || 'In Progress');
  const [submittingProgress, setSubmittingProgress] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const fileInputRef = useRef(null);

  const handleSendProgress = async (e) => {
    e.preventDefault();
    if (!progressComment.trim()) {
      alert('Tuliskan catatan tindakan progres terlebih dahulu.');
      return;
    }

    setSubmittingProgress(true);

    try {
      let photoBase64 = null;
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        photoBase64 = await compressImage(file, 1280, 0.8);
      }

      const payload = {
        comment: progressComment.trim(),
        status: progressStatus,
        technician_name: currentUser?.name || ticket.technician_name || 'Teknisi Jointer',
        technician_role: currentUser?.role || 'Teknisi Jointer',
        photo_base64: photoBase64,
      };

      await onAddProgress(ticket.id, payload);
      setProgressComment('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setSubmittingProgress(false);
    }
  };

  const handleDispatch = async () => {
    setSendingTelegram(true);
    await onDispatchTelegram(ticket.id);
    setSendingTelegram(false);
  };

  const fc = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium';
  const lc = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Pinned Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">{ticket.ticket_number}</span>
              {getCategoryBadge(ticket.category)}
              {getStatusBadge(ticket.status)}
            </div>
            <h3 className="text-base font-bold mt-1 text-slate-100">{ticket.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/track-ticket/${ticket.ticket_number}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
              title="Buka Halaman Pelacakan Publik"
            >
              <span>🔗</span>
              <span>Link Publik</span>
            </Link>

            <button
              type="button"
              onClick={handleDispatch}
              disabled={sendingTelegram}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-60"
              title="Kirim notifikasi tugas ke Telegram"
            >
              <span>📢</span>
              <span>{sendingTelegram ? 'Mengirim...' : 'Telegram'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* Summary Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Teknisi Bertugas</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5">
                👷 {ticket.technician_name || 'Belum Ditentukan'}
              </p>
              <p className="text-[10px] text-slate-500">{ticket.dispatch_team || 'Tim Lapangan'}</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Titik Lokasi / ODP</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5">
                📍 {ticket.network_node?.name || 'Infrastruktur Jaringan'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">{ticket.network_node?.code || '—'}</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Waktu Terbit</span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-0.5 font-mono">
                🕒 {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
          </div>

          {ticket.description && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Instruksi Awal:</span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {/* Form Kirim Progres & Upload Foto (Bisa diisi oleh Teknisi) */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3">
            <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>✍️</span> Kirim Laporan Progres &amp; Bukti Foto Lapangan
            </h4>

            <form onSubmit={handleSendProgress} className="space-y-3">
              <div>
                <textarea
                  required
                  rows={2}
                  value={progressComment}
                  onChange={e => setProgressComment(e.target.value)}
                  placeholder="Ketik tindakan yang sedang dilakukan (misal: Sedang splicing core 2 di ODP-01, redaman aman)..."
                  className={fc}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    📸 Lampirkan Foto Bukti Pengerjaan (Opsional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="w-full text-xs text-slate-700 dark:text-slate-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Perbarui Status Tiket
                  </label>
                  <select
                    value={progressStatus}
                    onChange={e => setProgressStatus(e.target.value)}
                    className={fc}
                  >
                    <option value="Open">🟡 Open (Baru)</option>
                    <option value="In Progress">🔵 Sedang Dikerjakan (In Progress)</option>
                    <option value="Resolved">🟢 Selesai Diperbaiki (Resolved)</option>
                    <option value="Closed">⚪ Ditutup (Closed)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submittingProgress}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {submittingProgress && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  <span>{submittingProgress ? 'Mengirim...' : '+ Kirim Update Progres'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Timeline Kronologi & Foto */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>🕒</span> Riwayat Kronologi &amp; Bukti Foto Pengerjaan ({ticket.timeline_logs?.length ?? 0})
            </h4>

            {(!ticket.timeline_logs || ticket.timeline_logs.length === 0) ? (
              <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Belum ada catatan progres.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {ticket.timeline_logs.map((log, idx) => (
                  <div key={idx} className="relative space-y-1.5">
                    <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                    
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{log.user}</span>
                          <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-semibold">
                            {log.role || 'Teknisi'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{log.time}</span>
                      </div>

                      <p className="font-semibold text-slate-800 dark:text-slate-200">{log.action}</p>

                      {log.comment && (
                        <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                          "{log.comment}"
                        </p>
                      )}

                      {log.photo_url && (
                        <div className="pt-1">
                          <span className="text-[10px] font-bold text-slate-500 block mb-1">📸 Foto Bukti:</span>
                          <img
                            src={log.photo_url}
                            alt="Bukti"
                            onClick={() => setPreviewPhoto(log.photo_url)}
                            className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700 object-cover cursor-pointer hover:opacity-90 shadow-2xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Pinned Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Photo Lightbox */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md p-4 flex items-center justify-center cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewPhoto} alt="Preview" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            <button onClick={() => setPreviewPhoto(null)} className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded-xl text-xs font-bold">✕ Tutup</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE: TICKET MANAGEMENT (Jointer Focused)
══════════════════════════════════════════════════════════════════ */
export default function TicketManagement() {
  const { currentUser } = useAuth();
  const isOperatorOrAdmin = currentUser && ['Super Administrator', 'Operator Jaringan', 'NOC Operator'].includes(currentUser.role);

  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [techFilter, setTechFilter] = useState('ALL');

  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [toastMessage, setToastMessage] = useState(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadReferenceData = async () => {
    try {
      const res = await fetch('/api/tickets/reference-data');
      const json = await res.json();
      if (json.status === 'success') {
        setNodes(json.nodes || []);
        setTechnicians(json.technicians || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (techFilter !== 'ALL') params.append('technician', techFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/tickets?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'success') {
        setTickets(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, techFilter, search]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (formData) => {
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        showToast(json.message || 'Tiket jointer berhasil dibuat!');
        setShowCreateModal(false);
        fetchTickets();
        loadReferenceData();
      } else {
        setModalError(json.errors || json.message || 'Gagal membuat tiket');
      }
    } catch (err) {
      console.error(err);
      setModalError('Terjadi kesalahan jaringan');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddProgress = async (id, payload) => {
    try {
      const res = await fetch(`/api/tickets/${id}/add-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error('Server non-JSON response:', text);
        alert('Respons server:\n' + text.substring(0, 300));
        return;
      }

      if (res.ok && json.status === 'success') {
        showToast(json.message || 'Laporan progres berhasil ditambahkan!');
        setSelectedTicket(json.data);
        fetchTickets();
        loadReferenceData();
      } else {
        const errorMsg = json.errors 
          ? Object.values(json.errors).flat().join('\n') 
          : (json.message || 'Gagal mengirim laporan progres.');
        alert(errorMsg);
      }
    } catch (err) {
      console.error('Submit progress error:', err);
      alert('Terjadi kesalahan saat mengirim laporan: ' + (err.message || err));
    }
  };

  const handleQuickChangeStatus = async (ticket, newStatus) => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(`Status ${ticket.ticket_number} diubah ke ${newStatus}`);
        fetchTickets();
        loadReferenceData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispatchTelegram = async (id) => {
    try {
      const res = await fetch(`/api/tickets/${id}/dispatch-telegram`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      showToast(json.message || 'Notifikasi Telegram dikirim!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyiarkan ke Telegram.');
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    try {
      const res = await fetch(`/api/tickets/${ticketToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      showToast(json.message || 'Tiket berhasil dihapus!');
      setTicketToDelete(null);
      fetchTickets();
      loadReferenceData();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus tiket');
    }
  };

  const kanbanColumns = [
    { id: 'Open', label: '🟡 Baru (Open)', bg: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40' },
    { id: 'In Progress', label: '🔵 Sedang Dikerjakan', bg: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' },
    { id: 'Resolved', label: '🟢 Selesai (Resolved)', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' },
    { id: 'Closed', label: '⚪ Ditutup (Closed)', bg: 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800' },
  ];

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
            <span>🛠️</span> Manajemen Tiket Tim Jointer
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Penugasan teknis fiber optik, monitoring progres tindakan lapangan, dan pelacakan tiket publik
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Public Track Link */}
          <Link
            to="/track-ticket"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1.5"
          >
            <span>🔗</span>
            <span>Portal Lacak Publik</span>
          </Link>

          {/* View Mode Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              📋 Tabel
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              📊 Kanban
            </button>
          </div>

          <button
            onClick={() => { fetchTickets(); loadReferenceData(); }}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>

          {isOperatorOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>+</span>
              <span>Buat Tiket Jointer</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL' ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Tiket</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{summary?.total ?? 0}</div>
        </div>

        <div
          onClick={() => setStatusFilter('Open')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Open' ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/40 border-amber-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[10px] font-semibold text-amber-600 uppercase">Baru (Open)</div>
          <div className="text-xl font-bold text-amber-600 mt-0.5">{summary?.open ?? 0}</div>
        </div>

        <div
          onClick={() => setStatusFilter('In Progress')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'In Progress' ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/40 border-blue-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[10px] font-semibold text-blue-600 uppercase">Sedang Dikerjakan</div>
          <div className="text-xl font-bold text-blue-600 mt-0.5">{summary?.in_progress ?? 0}</div>
        </div>

        <div
          onClick={() => setStatusFilter('Resolved')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Resolved' ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[10px] font-semibold text-emerald-600 uppercase">Selesai Diperbaiki</div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">{summary?.resolved ?? 0}</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto flex-1">
          <input
            type="text"
            placeholder="🔍 Cari nomor tiket, judul, teknisi, ODP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="Open">🟡 Open (Baru)</option>
            <option value="In Progress">🔵 Sedang Dikerjakan</option>
            <option value="Resolved">🟢 Selesai</option>
            <option value="Closed">⚪ Ditutup</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Kategori</option>
            {JOINTER_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Teknisi</option>
            {technicians.map(u => (
              <option key={u.id} value={u.name}>👷 {u.name}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Total: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{tickets.length}</span> tiket
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-400 text-xs animate-pulse">
          <span>⚡</span> Memuat data tiket...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center text-slate-500 text-xs space-y-2">
          <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Tidak Ada Tiket Ditemukan</p>
          <p>Belum ada tiket penugasan jointer yang sesuai filter.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 1: OPERATIONAL TABLE VIEW
        ══════════════════════════════════════════════════════════════════ */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">No. Tiket &amp; Kategori</th>
                  <th className="px-5 py-3.5">Judul Pekerjaan</th>
                  <th className="px-5 py-3.5">Titik Lokasi / ODP</th>
                  <th className="px-5 py-3.5">Teknisi Ditugaskan</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    {/* No Tiket & Kategori */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{ticket.ticket_number}</p>
                      <div className="mt-1">{getCategoryBadge(ticket.category)}</div>
                    </td>

                    {/* Judul Pekerjaan */}
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-snug line-clamp-1">{ticket.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        🕒 {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </td>

                    {/* Titik Lokasi / ODP */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {ticket.network_node ? (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">📍 {ticket.network_node.name}</span>
                          <p className="text-[10px] text-slate-400 font-mono">[{ticket.network_node.node_type || 'NODE'}] {ticket.network_node.code}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Teknisi Tagged */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {ticket.technician_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                            {ticket.technician_name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{ticket.technician_name}</p>
                            <p className="text-[10px] text-slate-400">{ticket.dispatch_team || 'Tim Lapangan'}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold italic text-[11px]">⚠️ Belum Ditugaskan</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getStatusBadge(ticket.status)}
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                          title="Buka Kronologi & Laporan Progres"
                        >
                          <span>Detail &amp; Progres</span>
                        </button>

                        {isOperatorOrAdmin && (
                          <button
                            onClick={() => setTicketToDelete(ticket)}
                            className="px-2 py-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition-all cursor-pointer"
                            title="Hapus Tiket"
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
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           VIEW 2: KANBAN BOARD VIEW
        ══════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map(col => {
            const colTickets = tickets.filter(t => t.status === col.id);
            return (
              <div key={col.id} className={`rounded-2xl border p-3 flex flex-col gap-3 min-h-[500px] ${col.bg}`}>
                {/* Column Header */}
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{col.label}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {colTickets.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1">
                  {colTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">{ticket.ticket_number}</span>
                        {getCategoryBadge(ticket.category)}
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-2">{ticket.title}</h4>
                        {ticket.network_node && (
                          <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                            📍 [{ticket.network_node.node_type || 'NODE'}] {ticket.network_node.name}
                          </p>
                        )}
                      </div>

                      {/* Tagged Technician */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-slate-400">👷</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate text-[11px]">
                            {ticket.technician_name || 'Belum ditag'}
                          </span>
                        </div>

                        {/* Quick Status Select */}
                        <select
                          value={ticket.status}
                          onChange={e => handleQuickChangeStatus(ticket, e.target.value)}
                          className="text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>

                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-[11px] border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      >
                        Buka Detail &amp; Progres
                      </button>
                    </div>
                  ))}

                  {colTickets.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-[11px] italic">
                      Tidak ada tiket
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <CreateTicketModal
          nodes={nodes}
          technicians={technicians}
          onSave={handleCreateTicket}
          onClose={() => setShowCreateModal(false)}
          loading={modalLoading}
          error={modalError}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          currentUser={currentUser}
          technicians={technicians}
          isOperatorOrAdmin={isOperatorOrAdmin}
          onAddProgress={handleAddProgress}
          onDispatchTelegram={handleDispatchTelegram}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!ticketToDelete}
        title="Hapus Tiket Jointer"
        message={`Apakah Anda yakin ingin menghapus tiket "${ticketToDelete?.ticket_number} - ${ticketToDelete?.title}"?`}
        confirmText="Ya, Hapus Tiket"
        cancelText="Batal"
        type="danger"
        onConfirm={handleDeleteTicket}
        onClose={() => setTicketToDelete(null)}
      />
    </div>
  );
}
