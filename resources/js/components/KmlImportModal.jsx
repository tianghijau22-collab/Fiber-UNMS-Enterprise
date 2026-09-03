import React, { useState, useRef } from 'react';

export default function KmlImportModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Processing, 4: Done
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [resultData, setResultData] = useState(null);

  // User Options in Step 2
  const [oltSolokId, setOltSolokId] = useState('');
  const [oltGuguakId, setOltGuguakId] = useState('');
  const [oltSingkarakId, setOltSingkarakId] = useState('');
  const [autoLinkNearest, setAutoLinkNearest] = useState(true);

  const fileInputRef = useRef(null);

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

      // Pre-select OLT IDs based on name matching
      const olts = data.data.available_olts || [];
      const solok = olts.find(o => o.name.toLowerCase().includes('solok')) || olts[0];
      const guguak = olts.find(o => o.name.toLowerCase().includes('guguak')) || olts[0];
      const singkarak = olts.find(o => o.name.toLowerCase().includes('singkarak')) || olts[0];

      if (solok) setOltSolokId(solok.id);
      if (guguak) setOltGuguakId(guguak.id);
      if (singkarak) setOltSingkarakId(singkarak.id);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: previewData.token,
          olt_solok_id: oltSolokId ? parseInt(oltSolokId) : null,
          olt_guguak_id: oltGuguakId ? parseInt(oltGuguakId) : null,
          olt_singkarak_id: oltSingkarakId ? parseInt(oltSingkarakId) : null,
          auto_link_nearest: autoLinkNearest,
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
                Import Data Jaringan KML / KMZ (Google Earth)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Normalisasi otomatis titik ODP, ODC, POP, dan rute kabel ke skema Fiber-UNMS
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
              STEP 1: UPLOAD FILE
          ══════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
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

                <div className="text-4xl mb-2">{file ? '📄' : '☁️'}</div>
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

              {/* Information Notes */}
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                  <span>ℹ️</span>
                  <span>Fitur Normalisasi Otomatis UNMS:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <li><strong>Pemilahan OLT Otomatis:</strong> Node berakhiran <code className="text-blue-600 font-bold">-02</code> ke OLT Guguak, <code className="text-blue-600 font-bold">-05</code> ke OLT Singkarak, dan tanpa akhiran ke OLT Solok Kota.</li>
                  <li><strong>Node Induk Otomatis:</strong> Tulisan <code className="text-emerald-600 font-bold">POWER FROM</code> pada catatan ODP otomatis menautkan ODP ke ODC induknya.</li>
                  <li><strong>Informasi Core &amp; Tube:</strong> Teks <code className="text-amber-600 font-bold">CORE</code> dan <code className="text-amber-600 font-bold">TUBE</code> otomatis masuk ke spesifikasi teknis node.</li>
                  <li><strong>Warna Asli Kabel:</strong> Garis kabel di peta akan mempertahankan warna asli yang sudah digambar di Google Earth.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 2: PREVIEW & VERIFICATION
          ══════════════════════════════════════════════════════════ */}
          {step === 2 && previewData && (
            <div className="space-y-5">
              {/* Summary Metric Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  1. Rangkuman Elemen Jaringan Terdeteksi:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">ODP Point</span>
                    <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                      {previewData.summary.odp_count}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">Terminal Akses Pelanggan</span>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">ODC Cabinet</span>
                    <span className="text-2xl font-black text-blue-800 dark:text-blue-200">
                      {previewData.summary.odc_count}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">Kabinet Distribusi Feeder</span>
                  </div>

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block">POP &amp; BTS</span>
                    <span className="text-2xl font-black text-indigo-800 dark:text-indigo-200">
                      {previewData.summary.pop_count}
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block mt-0.5">Core Headend / Tower</span>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">Joint Box (JB)</span>
                    <span className="text-2xl font-black text-amber-800 dark:text-amber-200">
                      {previewData.summary.jb_count}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">Sambungan Splicing Kabel</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">Tiang / Crossing</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
                      {previewData.summary.pole_count}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Tiang Tumpu / Rute Jalan</span>
                  </div>

                  <div className="p-3 bg-fuchsia-50 dark:bg-fuchsia-950/40 border border-fuchsia-200 dark:border-fuchsia-800 rounded-xl">
                    <span className="text-[10px] font-bold text-fuchsia-700 dark:text-fuchsia-300 block">Bentangan Kabel FO</span>
                    <span className="text-2xl font-black text-fuchsia-800 dark:text-fuchsia-200">
                      {previewData.summary.total_cables}
                    </span>
                    <span className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400 block mt-0.5">Figure-8, ADSS, Jalur</span>
                  </div>
                </div>
              </div>

              {/* OLT Mapping Setup */}
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>2. Pemilahan OLT Berdasarkan Inisial Nama:</span>
                  <span className="text-[10px] font-normal text-emerald-600 font-mono">✓ Terdeteksi Otomatis</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Tanpa Akhiran ({previewData.summary.olt_breakdown.solok_kota} Node):
                    </label>
                    <select
                      value={oltSolokId}
                      onChange={(e) => setOltSolokId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {previewData.available_olts?.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.ip_address})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Inisial <code className="text-blue-600">-02</code> ({previewData.summary.olt_breakdown.guguak_02} Node):
                    </label>
                    <select
                      value={oltGuguakId}
                      onChange={(e) => setOltGuguakId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {previewData.available_olts?.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.ip_address})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Inisial <code className="text-blue-600">-05</code> ({previewData.summary.olt_breakdown.singkarak_05} Node):
                    </label>
                    <select
                      value={oltSingkarakId}
                      onChange={(e) => setOltSingkarakId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {previewData.available_olts?.map(o => (
                        <option key={o.id} value={o.id}>{o.name} ({o.ip_address})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Node Induk Detection Banner */}
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs">
                <span className="text-emerald-600 text-base">🎯</span>
                <div className="space-y-1">
                  <p className="font-bold text-emerald-800 dark:text-emerald-200">
                    {previewData.summary.parent_detected_count} ODP memiliki catatan "POWER FROM" yang valid!
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Sistem akan langsung menghubungkan ODP tersebut ke ODC induknya secara presisi.
                  </p>
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoLinkNearest}
                      onChange={(e) => setAutoLinkNearest(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Tautkan sisa ODP yang tanpa catatan ke ODC terdekat dalam kluster yang sama (Maksimal 3 km).
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample Data Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  3. Pratinjau Sampel Node yang Akan Masuk (10 Titik Pertama):
                </h4>
                <div className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-neutral-800 font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Nama Node</th>
                        <th className="px-2 py-2">Tipe</th>
                        <th className="px-2 py-2">Inisial OLT</th>
                        <th className="px-2 py-2">Power From (Induk)</th>
                        <th className="px-2 py-2">Spesifikasi Core/Tube</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 text-slate-700 dark:text-slate-300">
                      {previewData.sample_nodes?.slice(0, 10).map((n, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                          <td className="px-3 py-1.5 font-bold">{n.name}</td>
                          <td className="px-2 py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              {n.node_type}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[10px]">
                            {n.olt_key === '02' ? 'Guguak (-02)' : n.olt_key === '05' ? 'Singkarak (-05)' : 'Solok Kota'}
                          </td>
                          <td className="px-2 py-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                            {n.power_from_raw || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-slate-500 font-mono text-[10px]">
                            {[n.tube_info, n.core_color].filter(Boolean).join(' • ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  Menyimpan &amp; Menghubungkan Topologi Jaringan...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Menyimpan ribuan ODP, ODC, POP, kabel fiber optik, dan menautkan struktur hierarki pohon jaringan secara aman.
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
                  Import KML Berhasil Disimpan!
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
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs text-emerald-600 block font-medium">Taut Induk ODC</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{resultData.stats.parents_linked}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-neutral-700">
                    <span className="text-xs text-slate-400 block font-medium">Kabel Disimpan</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{resultData.stats.cables_created + resultData.stats.cables_updated}</span>
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
                {loading ? 'Membaca File...' : '🔍 Baca & Pratinjau KML'}
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
                ↩️ Ganti File KML
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>🚀 Konfirmasi &amp; Simpan ke Database UNMS</span>
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
                🗺️ Tutup &amp; Lihat Langsung di Peta GIS
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
