import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import OdpWatermarkCamera from '../components/OdpWatermarkCamera';
import ConfirmDialog from '../components/ConfirmDialog';

/* ── Minimalist Clean SVG Icons ── */
const IconCamera = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconLocation = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconTelegram = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconRefresh = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);

export default function OdpCheckManagement() {
  const { currentUser } = useAuth();

  // State Data & Stats
  const [measurements, setMeasurements] = useState([]);
  const [stats, setStats] = useState({
    total_all: 0,
    total_today: 0,
    good_count: 0,
    warning_count: 0,
    critical_count: 0,
  });
  const [odpOptions, setOdpOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forwardingId, setForwardingId] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('input'); // 'input' | 'history'

  // Form State Pengukuran Lapangan
  const [formData, setFormData] = useState({
    odp_code: '',
    odp_name: '',
    odp_node_id: null,
    port_number: 'Port 1',
    power_measurement_dbm: '',
    odp_condition: 'Normal & Bersih',
    latitude: '',
    longitude: '',
    address_location: '',
    notes: '',
    odp_photo: null, // Base64 Data URL
    opm_photo: null, // Base64 Data URL
    forward_telegram: false,
    technician_name: currentUser?.name || '',
  });

  // Modal Camera State
  const [cameraModal, setCameraModal] = useState({
    isOpen: false,
    targetField: 'odp_photo', // 'odp_photo' | 'opm_photo'
    title: '',
    subtitle: '',
  });

  // Modal Photo Viewer
  const [viewingPhoto, setViewingPhoto] = useState(null);

  // Custom Confirm Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Notifikasi Banner
  const [alert, setAlert] = useState(null);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4500);
  };

  // ── Fetch ODP Autocomplete Options ──
  const fetchOdpOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/odp-checks/odp-options');
      const json = await res.json();
      if (json.success) setOdpOptions(json.data || []);
    } catch (e) {
      console.error('Error fetching ODP options:', e);
    }
  }, []);

  // ── Fetch Measurements History & Stats ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (periodFilter) params.append('period', periodFilter);
      params.append('page', currentPage);

      const [resData, resStats] = await Promise.all([
        fetch(`/api/odp-checks?${params.toString()}`),
        fetch('/api/odp-checks/stats'),
      ]);

      const jsonData = await resData.json();
      const jsonStats = await resStats.json();

      if (jsonData.success) {
        setMeasurements(jsonData.data.data || []);
        setTotalPages(jsonData.data.last_page || 1);
      }
      if (jsonStats.success) {
        setStats(jsonStats.data || {});
      }
    } catch (e) {
      console.error('Error fetching ODP measurements:', e);
      showAlert('Gagal memuat data histori pengukuran.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, periodFilter, currentPage]);

  useEffect(() => {
    fetchOdpOptions();
  }, [fetchOdpOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Geolocation Auto-Detect ──
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showAlert('Geolocation tidak didukung pada browser ini.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        showAlert('Koordinat GPS berhasil didapatkan!');
      },
      (err) => {
        showAlert(`Gagal mengambil GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Auto Calculate Power Status Preview ──
  const getPowerStatusPreview = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return { label: 'Belum Diukur', color: 'neutral' };
    if (num < -27.0 || num > -10.0) return { label: 'Kritis / LOS', color: 'rose' };
    if (num < -24.0) return { label: 'Peringatan / Sedang', color: 'amber' };
    return { label: 'Baik / Ideal', color: 'emerald' };
  };

  const powerPreview = getPowerStatusPreview(formData.power_measurement_dbm);

  // ── Handle ODP Select ──
  const handleSelectOdp = (odpId) => {
    const selected = odpOptions.find((o) => String(o.id) === String(odpId));
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        odp_node_id: selected.id,
        odp_code: selected.code,
        odp_name: selected.name || '',
        latitude: selected.latitude ? String(selected.latitude) : prev.latitude,
        longitude: selected.longitude ? String(selected.longitude) : prev.longitude,
        address_location: selected.address || prev.address_location,
      }));
    }
  };

  // ── Open Camera Modal ──
  const openCamera = (field, title, subtitle) => {
    setCameraModal({
      isOpen: true,
      targetField: field,
      title,
      subtitle,
    });
  };

  // ── On Capture from Camera ──
  const handleCameraCapture = (base64Img) => {
    setFormData((prev) => ({
      ...prev,
      [cameraModal.targetField]: base64Img,
    }));
    showAlert('Foto berhasil diambil & watermark diterapkan!');
  };

  // ── Submit Measurement ──
  const handleSubmit = async (forwardToTg = false) => {
    if (!formData.odp_code) {
      showAlert('Kode ODP wajib diisi.', 'error');
      return;
    }
    if (!formData.power_measurement_dbm) {
      showAlert('Nilai redaman OPM (dBm) wajib diisi.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        forward_telegram: forwardToTg,
      };

      const res = await fetch('/api/odp-checks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan data.');
      }

      showAlert(json.message);
      
      // Reset form
      setFormData({
        odp_code: '',
        odp_name: '',
        odp_node_id: null,
        port_number: 'Port 1',
        power_measurement_dbm: '',
        odp_condition: 'Normal & Bersih',
        latitude: '',
        longitude: '',
        address_location: '',
        notes: '',
        odp_photo: null,
        opm_photo: null,
        forward_telegram: false,
        technician_name: currentUser?.name || '',
      });

      fetchData();
      setActiveTab('history');
    } catch (e) {
      showAlert(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Forward to Telegram ──
  const handleForwardTelegram = async (id, odpCode) => {
    setForwardingId(id);
    try {
      const res = await fetch(`/api/odp-checks/${id}/forward-telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal meneruskan ke Telegram.');
      }

      showAlert(`Laporan ODP '${odpCode}' berhasil dikirimkan ke Telegram!`);
      fetchData();
    } catch (e) {
      showAlert(e.message, 'error');
    } finally {
      setForwardingId(null);
    }
  };

  // ── Delete Measurement ──
  const handleDelete = (id, odpCode) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Data Pengukuran',
      message: `Apakah Anda yakin ingin menghapus data pengukuran untuk ODP "${odpCode}"?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/odp-checks/${id}`, {
            method: 'DELETE',
            headers: {
              'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
          });
          const json = await res.json();
          if (json.success) {
            showAlert(json.message);
            fetchData();
          }
        } catch (e) {
          showAlert('Gagal menghapus data.', 'error');
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const fc = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs text-black dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white font-medium";
  const lc = "block text-[11px] font-bold text-black dark:text-white uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
            <IconCamera />
            <span>Pengecekan Redaman ODP &amp; OPM</span>
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Pendataan redaman ODP lapangan, pengambilan foto bukti ber-watermark timestamp &amp; forward laporan ke Telegram NOC
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'input'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                : 'border border-slate-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900'
            }`}
          >
            <IconPlus />
            <span>Form Input Lapangan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                : 'border border-slate-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900'
            }`}
          >
            <IconRefresh />
            <span>Riwayat Pengukuran</span>
          </button>
        </div>
      </div>

      {/* ── Alert Notification ── */}
      {alert && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border transition-all ${
            alert.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Total Dicek</div>
          <div className="text-xl font-bold text-black dark:text-white font-mono">{stats.total_all || 0}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500">Cek Hari Ini</div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">{stats.total_today || 0}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Baik (-14 s.d -24)</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{stats.good_count || 0}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Peringatan (-24.1 s.d -27)</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">{stats.warning_count || 0}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 space-y-1 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Kritis (&gt; -27 dBm)</div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">{stats.critical_count || 0}</div>
        </div>
      </div>

      {/* ── TAB 1: FORM INPUT PENGUKURAN LAPANGAN ── */}
      {activeTab === 'input' && (
        <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 space-y-6 shadow-xs">
          
          <div className="border-b border-slate-200 dark:border-neutral-800 pb-4">
            <h2 className="text-base font-bold text-black dark:text-white">Formulir Verifikasi Redaman Lapangan</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Isi parameter ODP, port, hasil ukur OPM, dan lampirkan foto fisik &amp; display OPM dengan watermark otomatis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* ODP Autocomplete Dropdown */}
            <div className="space-y-1">
              <label className={lc}>Pilih ODP dari Database</label>
              <select
                value={formData.odp_node_id || ''}
                onChange={(e) => handleSelectOdp(e.target.value)}
                className={fc}
              >
                <option value="">-- Pilih ODP Terdaftar atau Ketik Manual --</option>
                {odpOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} {o.name ? `- ${o.name}` : ''} ({o.total_ports || 8} Port)
                  </option>
                ))}
              </select>
            </div>

            {/* Kode ODP Manual */}
            <div className="space-y-1">
              <label className={lc}>Kode ODP *</label>
              <input
                type="text"
                value={formData.odp_code}
                onChange={(e) => setFormData({ ...formData, odp_code: e.target.value.toUpperCase() })}
                placeholder="ODP-SLK-01/04"
                className={fc + ' font-mono uppercase font-bold'}
                required
              />
            </div>

            {/* Nama / Wilayah ODP */}
            <div className="space-y-1">
              <label className={lc}>Nama / Label ODP</label>
              <input
                type="text"
                value={formData.odp_name}
                onChange={(e) => setFormData({ ...formData, odp_name: e.target.value })}
                placeholder="ODP Simpang Rumbio"
                className={fc}
              />
            </div>

            {/* Port ODP */}
            <div className="space-y-1">
              <label className={lc}>Port yang Diukur *</label>
              <select
                value={formData.port_number}
                onChange={(e) => setFormData({ ...formData, port_number: e.target.value })}
                className={fc}
              >
                <option value="Port In / Uplink">Port In / Uplink Splitter</option>
                {[...Array(16)].map((_, i) => (
                  <option key={i + 1} value={`Port ${i + 1}`}>Port {i + 1} (Distribusi)</option>
                ))}
                <option value="Port Backbone">Port Backbone</option>
              </select>
            </div>

            {/* Nilai Redaman OPM */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={lc}>Nilai Redaman OPM (dBm) *</label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    powerPreview.color === 'emerald'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      : powerPreview.color === 'amber'
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                      : powerPreview.color === 'rose'
                      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {powerPreview.label}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={formData.power_measurement_dbm}
                  onChange={(e) => setFormData({ ...formData, power_measurement_dbm: e.target.value })}
                  placeholder="-18.50"
                  className={fc + ' font-mono text-sm font-bold'}
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-neutral-500 font-bold">dBm</span>
              </div>
            </div>

            {/* Kondisi Fisik ODP */}
            <div className="space-y-1">
              <label className={lc}>Kondisi Fisik ODP *</label>
              <select
                value={formData.odp_condition}
                onChange={(e) => setFormData({ ...formData, odp_condition: e.target.value })}
                className={fc}
              >
                <option value="Normal & Bersih">Normal &amp; Bersih</option>
                <option value="Kotor / Perlu Cleaning Adaptor">Kotor / Perlu Cleaning Adaptor</option>
                <option value="Kunci / Box Pecah / Rusak">Kunci / Box Pecah / Rusak</option>
                <option value="Kabel Tertekuk / Terjepit">Kabel Tertekuk / Terjepit</option>
                <option value="Pigtail / Tray Patah">Pigtail / Tray Patah</option>
                <option value="Sarang Serangga / Air Masuk">Sarang Serangga / Air Masuk</option>
              </select>
            </div>

            {/* Geolocation GPS */}
            <div className="space-y-1 lg:col-span-2">
              <div className="flex items-center justify-between">
                <label className={lc}>Koordinat GPS Geotagging</label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <IconLocation />
                  <span>Ambil GPS Saat Ini</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="Latitude (misal: -0.793214)"
                  className={fc + ' font-mono'}
                />
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Longitude (misal: 100.654321)"
                  className={fc + ' font-mono'}
                />
              </div>
            </div>

            {/* Nama Teknisi */}
            <div className="space-y-1">
              <label className={lc}>Nama Teknisi / Petugas</label>
              <input
                type="text"
                value={formData.technician_name}
                onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                placeholder="Nama Teknisi"
                className={fc}
              />
            </div>

            {/* Catatan Lapangan */}
            <div className="space-y-1 lg:col-span-3">
              <label className={lc}>Catatan Teknis / Rekomendasi</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan kondisi redaman, port kosong, atau perbaikan yang dilakukan..."
                className={fc}
              />
            </div>

          </div>

          {/* ── DUAL WATERMARKED PHOTO SECTION ── */}
          <div className="border-t border-slate-200 dark:border-neutral-800 pt-6 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
                <IconCamera />
                <span>Dokumentasi Foto Bukti Lapangan (Watermarked)</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Ambil foto fisik ODP dan foto display alat OPM. Timestamp &amp; geotagging akan otomatis tertempel di foto.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card Foto 1: Fisik Box ODP */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center space-y-3 min-h-[220px]">
                <div className="text-center">
                  <div className="font-bold text-xs text-black dark:text-white">1. Foto Fisik Box ODP</div>
                  <div className="text-[11px] text-neutral-500">Kondisi box, kerapian kabel &amp; adaptor</div>
                </div>

                {formData.odp_photo ? (
                  <div className="relative group">
                    <img
                      src={formData.odp_photo}
                      alt="Foto Fisik ODP"
                      className="w-full max-h-48 object-cover rounded-xl border border-neutral-700 shadow-md"
                    />
                    <div className="flex items-center gap-2 mt-2 justify-center">
                      <button
                        type="button"
                        onClick={() => openCamera('odp_photo', 'Foto Fisik Box ODP', 'Foto ulang kondisi box ODP')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-neutral-700 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        Foto Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, odp_photo: null })}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCamera('odp_photo', 'Foto Fisik Box ODP', 'Arahkan kamera ke box ODP dan splitter')}
                    className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-black dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <IconCamera />
                    <span>Buka Kamera Fisik ODP</span>
                  </button>
                )}
              </div>

              {/* Card Foto 2: Display Hasil OPM */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center space-y-3 min-h-[220px]">
                <div className="text-center">
                  <div className="font-bold text-xs text-black dark:text-white">2. Foto Display Alat Ukur OPM</div>
                  <div className="text-[11px] text-neutral-500">Angka redaman (dBm) &amp; panjang gelombang (1310/1490/1550nm)</div>
                </div>

                {formData.opm_photo ? (
                  <div className="relative group">
                    <img
                      src={formData.opm_photo}
                      alt="Foto Display OPM"
                      className="w-full max-h-48 object-cover rounded-xl border border-neutral-700 shadow-md"
                    />
                    <div className="flex items-center gap-2 mt-2 justify-center">
                      <button
                        type="button"
                        onClick={() => openCamera('opm_photo', 'Foto Display OPM', 'Foto ulang layar alat ukur OPM')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-neutral-700 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        Foto Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, opm_photo: null })}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCamera('opm_photo', 'Foto Display OPM', 'Arahkan kamera ke layar alat ukur OPM')}
                    className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-black dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <IconCamera />
                    <span>Buka Kamera Layar OPM</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* ── Submit Action Buttons ── */}
          <div className="border-t border-slate-200 dark:border-neutral-800 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 font-bold text-xs text-black dark:text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <IconCheck />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Data Pengukuran'}</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold text-xs text-white dark:text-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <IconTelegram />
              <span>{submitting ? 'Mengirim...' : 'Simpan &amp; Forward ke Telegram'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ── TAB 2: RIWAYAT & TABEL PENGUKURAN ── */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 space-y-4 shadow-xs">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari ODP, teknisi, lokasi..."
                className={fc}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={fc + ' w-auto'}
              >
                <option value="">Semua Status</option>
                <option value="good">Baik (-14 s.d -24)</option>
                <option value="warning">Peringatan (-24.1 s.d -27)</option>
                <option value="critical">Kritis (&gt; -27 dBm)</option>
              </select>

              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className={fc + ' w-auto'}
              >
                <option value="">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="this_week">Minggu Ini</option>
                <option value="this_month">Bulan Ini</option>
              </select>

              <button
                type="button"
                onClick={fetchData}
                className="p-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-900 text-black dark:text-white transition-colors cursor-pointer"
                title="Segarkan Data"
              >
                <IconRefresh />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs text-black dark:text-white">
              <thead className="bg-slate-50 dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">ODP &amp; Port</th>
                  <th className="py-3 px-4">Redaman OPM</th>
                  <th className="py-3 px-4">Kondisi Fisik</th>
                  <th className="py-3 px-4">Foto Watermark</th>
                  <th className="py-3 px-4">Teknisi Lapangan</th>
                  <th className="py-3 px-4">Telegram</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-900">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-500 italic">
                      Memuat data histori pengukuran...
                    </td>
                  </tr>
                ) : measurements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-500 italic">
                      Belum ada data pengukuran redaman ODP yang tersimpan.
                    </td>
                  </tr>
                ) : (
                  measurements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-neutral-950/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold font-mono">{m.odp_code}</div>
                        <div className="text-[11px] text-neutral-500">{m.port_number}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                            m.power_status === 'good'
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                              : m.power_status === 'warning'
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                              : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {m.power_measurement_dbm} dBm
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {m.odp_condition}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {m.odp_photo_url && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: m.odp_photo_url, title: `Foto ODP - ${m.odp_code}` })}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer flex items-center gap-1"
                            >
                              <IconEye /> ODP
                            </button>
                          )}
                          {m.opm_photo_url && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: m.opm_photo_url, title: `Foto OPM - ${m.odp_code}` })}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer flex items-center gap-1"
                            >
                              <IconEye /> OPM
                            </button>
                          )}
                          {!m.odp_photo_url && !m.opm_photo_url && (
                            <span className="text-neutral-400 text-[11px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] whitespace-nowrap">
                        {m.technician_name || 'Teknisi Lapangan'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.forwarded_to_telegram ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <IconCheck /> Terkirim
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={forwardingId === m.id}
                            onClick={() => handleForwardTelegram(m.id, m.odp_code)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Forward Laporan ke Telegram"
                          >
                            <IconTelegram />
                            <span>{forwardingId === m.id ? 'Mengirim...' : 'Kirim'}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id, m.odp_code)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                          title="Hapus Data"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-500">
                Halaman {currentPage} dari {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-neutral-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── MODAL CAMERA WATERMARK ── */}
      <OdpWatermarkCamera
        isOpen={cameraModal.isOpen}
        title={cameraModal.title}
        subtitle={cameraModal.subtitle}
        metaData={{
          odp_code: formData.odp_code,
          port_number: formData.port_number,
          power_measurement_dbm: formData.power_measurement_dbm,
          power_status: powerPreview.label,
          technician_name: formData.technician_name,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }}
        onCapture={handleCameraCapture}
        onClose={() => setCameraModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ── MODAL PHOTO VIEWER ── */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between py-2 text-white text-xs font-bold">
              <span>{viewingPhoto.title}</span>
              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="text-neutral-400 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕ Tutup
              </button>
            </div>
            <img
              src={viewingPhoto.url}
              alt="Foto Watermark Preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl border border-neutral-700 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ── */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
