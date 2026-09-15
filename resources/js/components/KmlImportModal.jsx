import React, { useState, useRef, useEffect } from 'react';

export default function KmlImportModal({ isOpen, onClose, onSuccess, initialTarget = 'all' }) {
  const [step, setStep] = useState(1); // 1: Upload & Target, 2: Preview, 3: Processing, 4: Done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [resultData, setResultData] = useState(null);

  // User Options
  const [importTarget, setImportTarget] = useState(initialTarget); // 'all' | 'odp' | 'odc' | 'cable'
  const [targetOltId, setTargetOltId] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setImportTarget(initialTarget || 'all');
    }
  }, [isOpen, initialTarget]);

  if (!isOpen) return null;

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
          target_olt_id: targetOltId ? parseInt(targetOltId) : null,
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
      icon: '🌐',
      badgeColor: 'border-slate-300 dark:border-neutral-700'
    },
    {
      id: 'odp',
      title: 'Hanya ODP',
      desc: 'Semua titik lokasi (point) diimpor sebagai node ODP',
      icon: '📍',
      badgeColor: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
    },
    {
      id: 'odc',
      title: 'Hanya ODC',
      desc: 'Semua titik lokasi (point) diimpor sebagai kabinet ODC',
      icon: '📦',
      badgeColor: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
    },
    {
      id: 'cable',
      title: 'Hanya Kabel Fiber',
      desc: 'Semua garis rute (LineString) diimpor sebagai bentangan kabel',
      icon: '〰️',
      badgeColor: 'border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
    },
  ];

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl text-lg">
              📥
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Import KML / KMZ (Google Earth)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Pilih kategori data yang ingin diimpor secara spesifik atau sekaligus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold text-lg p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
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
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                            : 'border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/60'
                        }`}
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                              {opt.title}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
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
                      ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-neutral-700 hover:border-blue-500 bg-slate-50/50 dark:bg-neutral-900/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".kml,.kmz"
                    className="hidden"
                  />

                  <div className="text-3xl mb-1.5">{file ? '📄' : '☁️'}</div>
                  {file ? (
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • Klik untuk ganti file
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
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
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <span>💡</span>
                  <span>Logika Import Bersih &amp; Praktis:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Sistem akan mengekstrak nama dan koordinat geografis secara langsung tanpa pembacaan catatan berbelit. Penentuan node induk (ODC / MS / POP) dapat Anda atur secara leluasa dan presisi nanti melalui form edit node.
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
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Target Import: {TARGET_OPTIONS.find(o => o.id === importTarget)?.title}
                    </span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-400 block">
                      {TARGET_OPTIONS.find(o => o.id === importTarget)?.desc}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-300 underline"
                >
                  Ubah Target
                </button>
              </div>

              {/* Summary Metric Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Rangkuman Elemen di File KML:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className={`p-3 rounded-xl border ${importTarget === 'odp' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-500/20' : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700'}`}>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">Titik ODP</span>
                    <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                      {importTarget === 'odp' ? previewData.summary.total_nodes : previewData.summary.odp_count}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Terminal Akses</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${importTarget === 'odc' ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 ring-2 ring-blue-500/20' : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700'}`}>
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">Titik ODC</span>
                    <span className="text-2xl font-black text-blue-800 dark:text-blue-200">
                      {importTarget === 'odc' ? previewData.summary.total_nodes : previewData.summary.odc_count}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Kabinet Feeder</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${importTarget === 'cable' ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-400 ring-2 ring-violet-500/20' : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700'}`}>
                    <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 block">Garis Kabel FO</span>
                    <span className="text-2xl font-black text-violet-800 dark:text-violet-200">
                      {previewData.summary.total_cables}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Bentangan Jalur</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Total Node Titik</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
                      {previewData.summary.total_nodes}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Semua Point</span>
                  </div>
                </div>
              </div>

              {/* OLT Mapping Setup (Simplified Single Dropdown) */}
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Hubungkan ke Perangkat OLT (Opsional):
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Jika dipilih, semua node yang diimpor akan otomatis terafiliasi ke OLT ini. Boleh dikosongkan jika Anda ingin mengaturnya nanti.
                </p>
                <select
                  value={targetOltId}
                  onChange={(e) => setTargetOltId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="">— Kosongkan / Tetapkan Nanti —</option>
                  {previewData.available_olts?.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.ip_address ? `(${o.ip_address})` : ''}
                    </option>
                  ))}
                </select>
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
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
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
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Menyimpan Data KML ke Database...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Memproses titik node dan bentangan rute kabel sesuai kategori yang Anda pilih.
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 4: SUCCESS / DONE
          ══════════════════════════════════════════════════════════ */}
          {step === 4 && resultData && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
                ✓
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
        <div className="px-6 py-4 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950 flex items-center justify-between">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handlePreviewUpload}
                disabled={!file || loading}
                className={`px-5 py-2 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  file && !loading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                    : 'bg-slate-200 dark:bg-neutral-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Membaca File...' : '🔍 Lanjut ke Pratinjau KML'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ↩️ Ganti File / Kategori
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🚀 Simpan Data ke Database</span>
              </button>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
              >
                Tutup Selesai
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
