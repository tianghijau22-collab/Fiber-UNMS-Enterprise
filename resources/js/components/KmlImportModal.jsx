import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthContext';

export default function KmlImportModal({
  isOpen,
  onClose,
  onSuccess,
  initialTarget = 'all',
  scopedOltId = null,
  scopedOltName = null,
  lockOlt = false,
}) {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'Super Administrator';

  const [step, setStep] = useState(1); // 1: Upload & Target, 2: Preview, 3: Processing, 4: Done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [resultData, setResultData] = useState(null);

  // User Options
  const [importTarget, setImportTarget] = useState(initialTarget); // 'all' | 'odp' | 'odc' | 'cable'
  const [targetOltId, setTargetOltId] = useState(scopedOltId ? String(scopedOltId) : '');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setImportTarget(initialTarget || 'all');
      if (scopedOltId) {
        setTargetOltId(String(scopedOltId));
      } else {
        setTargetOltId('');
      }
      setStep(1);
      setFile(null);
      setError(null);
      setPreviewData(null);
      setResultData(null);
    }
  }, [isOpen, initialTarget, scopedOltId]);

  if (!isOpen || !isSuperAdmin) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  // Step 1: Upload & Fetch Preview
  const handlePreviewUpload = async () => {
    if (!file) {
      setError('Silakan pilih file KML atau KMZ terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('import_target', importTarget);

    try {
      const res = await fetch('/api/kml-import/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membaca isi file KML.');
      }

      setPreviewData(data.data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Execute Import into DB
  const handleExecuteImport = async () => {
    if (!previewData?.token) return;

    setStep(3);
    setLoading(true);
    setError(null);

    const finalOltId = lockOlt && scopedOltId ? scopedOltId : (targetOltId ? parseInt(targetOltId) : null);

    try {
      const res = await fetch('/api/kml-import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({
          token: previewData.token,
          import_target: importTarget,
          target_olt_id: finalOltId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan data KML ke database.');
      }

      setResultData(data);
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
      setStep(2); // return to preview so user can retry
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setResultData(null);
    setError(null);
  };

  const TARGET_OPTIONS = [
    {
      id: 'all',
      title: 'Semua Data (Otomatis)',
      desc: 'Import ODP, ODC, POP, dan Garis Kabel sekaligus',
      iconSvg: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'odp',
      title: 'Hanya ODP',
      desc: 'Semua titik lokasi (point) diimpor sebagai node ODP',
      iconSvg: (
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'odc',
      title: 'Hanya ODC',
      desc: 'Semua titik lokasi (point) diimpor sebagai kabinet ODC',
      iconSvg: (
        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: 'cable',
      title: 'Hanya Kabel Fiber',
      desc: 'Semua garis rute (LineString) diimpor sebagai bentangan kabel',
      iconSvg: (
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-black rounded-lg sm:rounded-xl shadow-2xl border border-black/70 dark:border-white/70 my-auto max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/20 dark:border-white/20 flex items-center justify-between bg-white dark:bg-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/10 dark:bg-white/10 text-black dark:text-white rounded-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-black dark:text-white tracking-tight">
                  Import KML / KMZ
                </h3>
                {scopedOltName && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-black/10 dark:bg-white/10 text-black dark:text-white border border-black/20 dark:border-white/20">
                    {scopedOltName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-black/70 dark:text-white/70 font-medium">
                {lockOlt && scopedOltName
                  ? `Data yang diimpor akan diisolasi khusus untuk OLT ${scopedOltName}`
                  : 'Import data titik ODP, ODC, POP dan kabel dari file Google Earth'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* OLT Scope Banner */}
          {lockOlt && scopedOltName && (
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Target OLT Aktif: {scopedOltName}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Semua node ODC, ODP, POP dan kabel akan tersimpan khusus untuk OLT ini.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-slate-700 dark:text-slate-300 font-bold">
                OLT ID #{scopedOltId}
              </span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 1: UPLOAD FILE & PILIH TARGET
          ══════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Target Selection Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  1. Pilih Kategori Data yang Diimport:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TARGET_OPTIONS.map((opt) => {
                    const isSelected = importTarget === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setImportTarget(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'border-neutral-900 bg-neutral-100/90 dark:border-white dark:bg-neutral-800/90 ring-1 ring-neutral-900 dark:ring-white'
                            : 'border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/60'
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">{opt.iconSvg}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                              {opt.title}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-white shrink-0"></span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  2. Pilih File KML / KMZ:
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                    file
                      ? 'border-neutral-900 bg-neutral-100/50 dark:border-white dark:bg-neutral-800/40'
                      : 'border-slate-300 dark:border-neutral-700 hover:border-neutral-600 dark:hover:border-neutral-400 bg-slate-50/50 dark:bg-neutral-900/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".kml,.kmz"
                    className="hidden"
                  />

                  <div className="flex justify-center mb-2 text-slate-400 dark:text-slate-500">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • Klik untuk ganti file
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Tarik &amp; Lepaskan file .kml atau .kmz ke sini
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        atau klik di sini untuk memilih file dari komputer
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clean Import Info Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Logika Import Bersih &amp; Praktis:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Sistem mengekstrak koordinat geografis dan nama node secara akurat. Jika nama ODC induk tertera pada nama atau deskripsi ODP, sistem akan menghubungkannya secara otomatis ke ODC dalam OLT yang sama.
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 2: PREVIEW & OPSIONAL OLT
          ══════════════════════════════════════════════════════════ */}
          {step === 2 && previewData && (
            <div className="space-y-5">
              {/* Target Mode Badge */}
              <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Target Import: {TARGET_OPTIONS.find(o => o.id === importTarget)?.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {TARGET_OPTIONS.find(o => o.id === importTarget)?.desc}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-2.5 py-1 text-[11px] font-bold text-neutral-900 dark:text-white underline cursor-pointer"
                >
                  Ubah Kategori
                </button>
              </div>

              {/* Summary Metric Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Rangkuman Elemen di File KML:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className={`p-3 rounded-xl border ${importTarget === 'odp' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white' : 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800'}`}>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Titik ODP</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {importTarget === 'odp' ? previewData.summary.total_nodes : previewData.summary.odp_count}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Terminal Akses</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${importTarget === 'odc' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white' : 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800'}`}>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Titik ODC</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {importTarget === 'odc' ? previewData.summary.total_nodes : previewData.summary.odc_count}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Kabinet Feeder</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${importTarget === 'cable' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-900 dark:border-white' : 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800'}`}>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Garis Kabel FO</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {previewData.summary.total_cables}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Bentangan Jalur</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Total Node Titik</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {previewData.summary.total_nodes}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Semua Point</span>
                  </div>
                </div>
              </div>

              {/* OLT Mapping Setup */}
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Hubungkan ke Perangkat OLT:
                </label>
                {lockOlt && scopedOltName ? (
                  <div className="flex items-center gap-2 p-2.5 bg-neutral-200/70 dark:bg-neutral-800/80 rounded-xl text-xs font-bold text-slate-900 dark:text-white">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Terkunci ke: {scopedOltName} (OLT #{scopedOltId})</span>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Jika dipilih, semua node yang diimpor akan otomatis terafiliasi ke OLT ini. Boleh dikosongkan jika ingin diatur nanti.
                    </p>
                    <select
                      value={targetOltId}
                      onChange={(e) => setTargetOltId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="">— Kosongkan / Tetapkan Nanti —</option>
                      {previewData.available_olts?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.ip_address ? `(${o.ip_address})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Sample Data Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Pratinjau Sampel Data (10 Item Pertama):
                </h4>
                <div className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {importTarget === 'cable' ? (
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-neutral-800 font-bold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2">Nama Kabel</th>
                          <th className="px-2 py-2">Warna Garis</th>
                          <th className="px-2 py-2">Estimasi Panjang</th>
                          <th className="px-2 py-2">Titik Koordinat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 text-slate-700 dark:text-slate-300">
                        {previewData.sample_cables?.slice(0, 10).map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                            <td className="px-3 py-1.5 font-bold">{c.name}</td>
                            <td className="px-2 py-1.5">
                              <span className="inline-flex items-center gap-1.5 font-mono text-[10px]">
                                <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: c.color }} />
                                {c.color}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 font-mono text-[10px]">
                              {c.length_meters ? `${c.length_meters.toLocaleString()} m` : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-slate-500 font-mono text-[10px]">
                              {c.coordinates?.length || 0} titik rute
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-neutral-800 font-bold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2">Nama Node</th>
                          <th className="px-2 py-2">Tipe Target</th>
                          <th className="px-2 py-2">Latitude</th>
                          <th className="px-2 py-2">Longitude</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 text-slate-700 dark:text-slate-300">
                        {previewData.sample_nodes?.slice(0, 10).map((n, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                            <td className="px-3 py-1.5 font-bold">{n.name}</td>
                            <td className="px-2 py-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700">
                                {importTarget === 'odp' ? 'ODP' : importTarget === 'odc' ? 'ODC' : n.node_type}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                              {n.lat}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                              {n.lng}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 3: PROCESSING
          ══════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Menyimpan Data KML ke Database...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Memproses titik node dan bentangan rute kabel ke dalam database OLT {scopedOltName || ''}.
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 4: SUCCESS / DONE
          ══════════════════════════════════════════════════════════ */}
          {step === 4 && resultData && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full flex items-center justify-center mx-auto shadow-md">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Import KML Selesai!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 max-w-md mx-auto">
                  {resultData.message}
                </p>
              </div>

              {resultData.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto pt-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700">
                    <span className="text-xs text-slate-400 block font-medium">Node Baru</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{resultData.stats.nodes_created}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700">
                    <span className="text-xs text-slate-400 block font-medium">Node Diperbarui</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{resultData.stats.nodes_updated}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700">
                    <span className="text-xs text-slate-400 block font-medium">Kabel Baru</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{resultData.stats.cables_created}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700">
                    <span className="text-xs text-slate-400 block font-medium">Kabel Diperbarui</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{resultData.stats.cables_updated}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3.5 border-t border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 flex items-center justify-between shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-md border border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handlePreviewUpload}
                disabled={!file || loading}
                className={`px-5 py-2 text-xs font-bold rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                  file && !loading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                    : 'bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Membaca File...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Lanjut ke Pratinjau KML</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold rounded-md border border-black/20 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Ganti File / Kategori</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Simpan Data ke Database</span>
              </button>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm cursor-pointer transition-colors"
              >
                Tutup Selesai
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
