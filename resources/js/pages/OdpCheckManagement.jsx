import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import OdpWatermarkCamera from '../components/OdpWatermarkCamera';
import ConfirmDialog from '../components/ConfirmDialog';
import { scanOpmPowerReading } from '../utils/opmOcrScanner';

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

const IconSparkles = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forwardingId, setForwardingId] = useState(null);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrMessage, setOcrMessage] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('input'); // 'input' | 'history'

  // ── Form State Ringkas (Hanya 5 Elemen Utama) ──
  const [formData, setFormData] = useState({
    odp_name: '',
    power_measurement_dbm: '',
    latitude: '',
    longitude: '',
    technician_name: currentUser?.name || '',
    odp_photo: null, // Base64 Data URL (Foto Fisik)
    opm_photo: null, // Base64 Data URL (Foto OPM)
  });

  // Modal Camera State
  const [cameraModal, setCameraModal] = useState({
    isOpen: false,
    targetField: 'odp_photo',
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

  // ── Auto-Detect Geolocation on Mount ──
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData((prev) => ({
            ...prev,
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6),
          }));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
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
    fetchData();
  }, [fetchData]);

  // ── Refresh Geolocation Manually ──
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
        showAlert('Koordinat GPS berhasil diperbarui!');
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
    if (isNaN(num)) return { label: 'Belum Terbaca', color: 'neutral' };
    if (num < -27.0 || num > -10.0) return { label: 'Kritis / Redaman Tinggi', color: 'rose' };
    if (num < -24.0) return { label: 'Peringatan / Sedang', color: 'amber' };
    return { label: 'Baik / Ideal', color: 'emerald' };
  };

  const powerPreview = getPowerStatusPreview(formData.power_measurement_dbm);

  // ── Open Camera Modal ──
  const openCamera = (field, title, subtitle) => {
    setCameraModal({
      isOpen: true,
      targetField: field,
      title,
      subtitle,
    });
  };

  // ── On Capture from Camera & Trigger Auto-OCR Scanner ──
  const handleCameraCapture = async (base64Img) => {
    const field = cameraModal.targetField;
    setFormData((prev) => ({
      ...prev,
      [field]: base64Img,
    }));

    // Jika foto yang diambil adalah Foto OPM, jalankan OCR Otomatis!
    if (field === 'opm_photo') {
      setIsScanningOcr(true);
      setOcrMessage('Sedang memindai angka redaman dari foto OPM...');
      
      try {
        const ocrResult = await scanOpmPowerReading(base64Img);
        if (ocrResult.success && ocrResult.dbmValue !== null) {
          setFormData((prev) => ({
            ...prev,
            power_measurement_dbm: String(ocrResult.dbmValue),
          }));
          setOcrMessage(`Terdeteksi otomatis dari foto: ${ocrResult.dbmValue} dBm`);
          showAlert(`Nilai redaman ${ocrResult.dbmValue} dBm berhasil terbaca otomatis dari foto OPM!`);
        } else {
          setOcrMessage('Angka tidak terbaca otomatis. Silakan masukkan nilai redaman secara manual.');
        }
      } catch (err) {
        console.warn('OCR error:', err);
        setOcrMessage('Gagal memindai otomatis. Masukkan nilai redaman manual.');
      } finally {
        setIsScanningOcr(false);
      }
    } else {
      showAlert('Foto fisik ODP berhasil diambil & watermark diterapkan!');
    }
  };

  // ── Submit Measurement ──
  const handleSubmit = async (forwardToTg = false) => {
    if (!formData.odp_name) {
      showAlert('Nama / Label ODP wajib diisi.', 'error');
      return;
    }
    if (!formData.power_measurement_dbm) {
      showAlert('Nilai redaman OPM (dBm) belum terisi.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        odp_code: formData.odp_name,
        odp_name: formData.odp_name,
        power_measurement_dbm: formData.power_measurement_dbm,
        port_number: 'Port Distribusi',
        odp_condition: 'Normal',
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        technician_name: formData.technician_name || currentUser?.name || 'Teknisi Lapangan',
        odp_photo: formData.odp_photo,
        opm_photo: formData.opm_photo,
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
      setFormData((prev) => ({
        odp_name: '',
        power_measurement_dbm: '',
        latitude: prev.latitude,
        longitude: prev.longitude,
        technician_name: currentUser?.name || '',
        odp_photo: null,
        opm_photo: null,
      }));
      setOcrMessage(null);

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

      showAlert(`Laporan ODP '${odpCode}' berhasil diteruskan ke Telegram!`);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight flex items-center gap-2">
            <IconCamera />
            <span>Pengecekan Redaman ODP Lapangan</span>
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Pendataan cepat redaman ODP, auto-scan nilai dBm dari foto OPM &amp; kirim laporan ke Telegram
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
            <IconCamera />
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
            <span>Riwayat ({stats.total_all || 0})</span>
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

      {/* ── TAB 1: FORM INPUT SUPER RINGKAS ── */}
      {activeTab === 'input' && (
        <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 space-y-6 shadow-xs">
          
          <div className="border-b border-slate-200 dark:border-neutral-800 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-black dark:text-white">Verifikasi Redaman Cepat</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Ambil foto layar OPM untuk membaca angka redaman otomatis tanpa ketik manual
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-neutral-700 flex items-center gap-1">
              <IconSparkles /> Auto-Scan OCR Aktif
            </span>
          </div>

          {/* ── DUAL WATERMARKED PHOTO SECTION (BAGIAN UTAMA) ── */}
          <div className="space-y-3">
            <label className={lc}>Dokumentasi Foto Bukti Lapangan (Watermarked) *</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Foto 1: Fisik ODP */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center space-y-3 min-h-[220px]">
                <div className="text-center">
                  <div className="font-bold text-xs text-black dark:text-white">1. Foto Fisik Box ODP</div>
                  <div className="text-[11px] text-neutral-500">Kondisi fisik luar/dalam box ODP</div>
                </div>

                {formData.odp_photo ? (
                  <div className="relative group w-full flex flex-col items-center">
                    <img
                      src={formData.odp_photo}
                      alt="Foto Fisik ODP"
                      className="w-full max-h-44 object-cover rounded-xl border border-neutral-700 shadow-sm"
                    />
                    <div className="flex items-center gap-2 mt-2">
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
                    onClick={() => openCamera('odp_photo', 'Foto Fisik Box ODP', 'Arahkan kamera ke box ODP')}
                    className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-black dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <IconCamera />
                    <span>Ambil Foto Fisik ODP</span>
                  </button>
                )}
              </div>

              {/* Foto 2: Layar OPM (Memicu OCR) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center space-y-3 min-h-[220px]">
                <div className="text-center">
                  <div className="font-bold text-xs text-black dark:text-white flex items-center justify-center gap-1.5">
                    <span>2. Foto Display Alat Ukur OPM</span>
                    <IconSparkles />
                  </div>
                  <div className="text-[11px] text-neutral-500">Angka redaman akan terbaca otomatis dari foto</div>
                </div>

                {formData.opm_photo ? (
                  <div className="relative group w-full flex flex-col items-center">
                    <img
                      src={formData.opm_photo}
                      alt="Foto Display OPM"
                      className="w-full max-h-44 object-cover rounded-xl border border-neutral-700 shadow-sm"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => openCamera('opm_photo', 'Foto Display OPM', 'Foto ulang layar alat ukur OPM')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-neutral-700 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        Foto Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, opm_photo: null, power_measurement_dbm: '' });
                          setOcrMessage(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCamera('opm_photo', 'Foto Display OPM', 'Arahkan kamera tegak lurus ke layar LCD alat OPM')}
                    className="px-5 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <IconCamera />
                    <span>Ambil Foto Layar OPM (Scan dBm)</span>
                  </button>
                )}
              </div>

            </div>

            {/* OCR Banner Status */}
            {isScanningOcr && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-neutral-700 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-2 animate-pulse">
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Memindai angka redaman dari layar OPM...</span>
              </div>
            )}

            {ocrMessage && !isScanningOcr && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs font-bold text-black dark:text-white flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <IconSparkles />
                  <span>{ocrMessage}</span>
                </div>
                {formData.power_measurement_dbm && (
                  <span className="font-mono text-sm px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {formData.power_measurement_dbm} dBm
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── 4 ELEMEN INPUT LAINNYA ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-neutral-800 pt-5">
            
            {/* 1. Nama / Label ODP */}
            <div className="space-y-1 sm:col-span-2">
              <label className={lc}>1. Nama / Label ODP *</label>
              <input
                type="text"
                value={formData.odp_name}
                onChange={(e) => setFormData({ ...formData, odp_name: e.target.value })}
                placeholder="Contoh: ODP-01 / ODP Simpang Rumbio / ODP Belakang Kantor"
                className={fc + ' text-sm font-bold'}
                required
              />
            </div>

            {/* 2. Nilai Redaman OPM (dBm) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={lc}>2. Nilai Redaman OPM (dBm) *</label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    powerPreview.color === 'emerald'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                      : powerPreview.color === 'amber'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                      : powerPreview.color === 'rose'
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
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
                  placeholder="-23.54 (Terisi otomatis via scan foto OPM)"
                  className={fc + ' font-mono text-sm font-bold'}
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-neutral-500 font-bold">dBm</span>
              </div>
            </div>

            {/* 3. Nama Teknisi */}
            <div className="space-y-1">
              <label className={lc}>3. Nama Teknisi / Petugas</label>
              <input
                type="text"
                value={formData.technician_name}
                onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                placeholder="Nama Teknisi"
                className={fc}
              />
            </div>

            {/* 4. Koordinat GPS Geotagging */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className={lc}>4. Koordinat GPS Geotagging</label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <IconLocation />
                  <span>Ambil / Refresh GPS</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="Latitude (GPS Otomatis)"
                  className={fc + ' font-mono text-xs'}
                />
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Longitude (GPS Otomatis)"
                  className={fc + ' font-mono text-xs'}
                />
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
                placeholder="Cari ODP, teknisi, tanggal..."
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
                  <th className="py-3 px-4">Nama / Label ODP</th>
                  <th className="py-3 px-4">Redaman OPM</th>
                  <th className="py-3 px-4">Foto Watermark</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4">Telegram</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-900">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500 italic">
                      Memuat data histori pengukuran...
                    </td>
                  </tr>
                ) : measurements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500 italic">
                      Belum ada data pengukuran redaman ODP.
                    </td>
                  </tr>
                ) : (
                  measurements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-neutral-950/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })} WIB
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold">{m.odp_name || m.odp_code}</div>
                        {m.latitude && m.longitude && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            GPS: {Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
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
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {m.odp_photo_url && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: m.odp_photo_url, title: `Foto Fisik ODP - ${m.odp_name || m.odp_code}` })}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-800 cursor-pointer flex items-center gap-1"
                            >
                              <IconEye /> ODP
                            </button>
                          )}
                          {m.opm_photo_url && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: m.opm_photo_url, title: `Foto Display OPM - ${m.odp_name || m.odp_code}` })}
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
                            onClick={() => handleForwardTelegram(m.id, m.odp_name || m.odp_code)}
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
                          onClick={() => handleDelete(m.id, m.odp_name || m.odp_code)}
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
          odp_code: formData.odp_name || 'ODP-LAPANGAN',
          port_number: 'Distribusi',
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
