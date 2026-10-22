import React from 'react';

/**
 * MaintenanceInfographicCard
 * 
 * Template Infografis Pengumuman Pemeliharaan Jaringan (NOC Advisory).
 * Desain modern, profesional, dan berstandar enterprise Network Operations Center:
 * - Header Teknis Bersih (Tanpa logo kartun / informal)
 * - Identitas Node, Uplink ODC & Interface PON
 * - Informasi Pekerjaan & Notice Gangguan / Pemulihan
 * - Cakupan Wilayah & Pelanggan Terdampak
 * - Jadwal & Metrik Durasi Pengerjaan
 * - Slot Dokumentasi Teknis Lapangan (Sebelum & Sesudah)
 * - Footer Verifikasi & Kode Tiket Resmi
 */
export default function MaintenanceInfographicCard({
  node,
  action = 'start', // 'start' | 'end'
  workType = 'Pemeliharaan Terjadwal',
  notes = '',
  startTime = '',
  endTime = '',
  duration = '1 Jam',
  dateString = '',
  affectedAreas = [],
  photoBefore = null,
  photoAfter = null,
  ticketNumber = '',
  technicianName = 'Tim Jointer / Teknisi Jaringan',
  impactedCount = null,
}) {
  const isStart = action === 'start';

  // Format tanggal Indonesia
  const displayDate = dateString || new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const formatTimeNow = (d = new Date()) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}.${mm} WIB`;
  };

  const displayStartTime = startTime || formatTimeNow();
  const displayEndTime = endTime || (isStart ? 'Sesuai Estimasi' : formatTimeNow());
  const displayDuration = duration || '1 Jam';

  // Default wilayah jika tidak diinput
  const areas = (affectedAreas && affectedAreas.length > 0)
    ? affectedAreas
    : [
        node?.name ? `Area ODP ${node.name}` : 'Sektor Distribusi Node',
        node?.parent_name ? `Upstream ODC ${node.parent_name}` : 'Wilayah Distribusi Terkait',
        node?.address ? node.address.split(',')[0].trim() : 'Area Layanan Terhubung'
      ];

  // Catatan pekerjaan default
  const displayNotes = notes || (isStart
    ? `Pemeliharaan rutin, penataan splitter pasif, dan perbaikan koneksi optik pada node ${node?.name || 'ODP'} untuk menjaga kestabilan kualitas redaman jaringan.`
    : `Pekerjaan teknis pada node ${node?.name || 'ODP'} telah berhasil diselesaikan. Seluruh sambungan fiber optik dan redaman port kembali beroperasi normal.`);

  const ticketCode = ticketNumber || `MT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(node?.id || 1).padStart(3, '0')}`;
  const totalCustomers = impactedCount ?? (node?.used_ports ?? 0);

  return (
    <div
      id="maintenance-infographic-render-root"
      className="w-[800px] bg-white text-slate-800 font-sans p-7 rounded-2xl shadow-xl border border-slate-200/90 flex flex-col gap-4 relative overflow-hidden select-none"
      style={{ minWidth: '800px', maxWidth: '800px' }}
    >
      {/* ─── TOP ACCENT STRIP ─────────────────────────────────────────── */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${
        isStart
          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600'
          : 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-500'
      }`}></div>

      {/* ─── 1. HEADER SECTION (PROFESSIONAL NOC TELEMETRY) ──────────── */}
      <div className="flex flex-col gap-2 pt-1 border-b border-slate-100 pb-4">
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isStart ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isStart ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-600">
              {isStart ? 'NETWORK OPERATIONS CENTER • MAINTENANCE ADVISORY' : 'NETWORK OPERATIONS CENTER • RESTORATION NOTICE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-500">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{displayDate}</span>
          </div>
        </div>

        {/* Main Title & Action Status */}
        <div className="flex items-start justify-between mt-1">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
              isStart ? 'text-slate-900' : 'text-emerald-800'
            }`}>
              {isStart ? 'PEMBERITAHUAN PEMELIHARAAN JARINGAN' : 'PEMELIHARAAN SELESAI & JARINGAN NORMAL'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sistem Manajemen Infrastruktur Fiber Optik FTTH • Pemberitahuan Resmi Operasional
            </p>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide uppercase border shadow-2xs ${
              isStart
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {isStart ? (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{workType || 'MAINTENANCE'}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>NORMAL / RESTORED</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Technical Target Specs Grid (Monochrome Micro-Chips) */}
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Node Target</span>
            <span className="font-mono font-bold text-slate-900 block truncate">{node?.name || 'ODP Target'}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Induk Upstream</span>
            <span className="font-mono font-bold text-slate-900 block truncate">{node?.parent_name || 'ODC'}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Uplink Interface</span>
            <span className="font-mono font-bold text-indigo-700 block truncate">{node?.olt_port_ref || 'PON Link'}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">Dampak Pelanggan</span>
            <span className="font-mono font-bold text-slate-900 block truncate">
              {totalCustomers > 0 ? `${totalCustomers} Pelanggan` : 'Node Distribusi'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. CARD: INFORMASI PEKERJAAN ───────────────────────────── */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-white shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
            Informasi &amp; Ruang Lingkup Pekerjaan
          </span>
        </div>

        <p className="text-slate-800 font-medium text-xs leading-relaxed pl-7">
          {displayNotes}
        </p>

        {/* Warning / Restoration Callout */}
        <div className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs font-medium ml-7 ${
          isStart
            ? 'bg-amber-50/90 border-amber-200 text-amber-900'
            : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
        }`}>
          <span className="text-sm shrink-0 mt-0.5">
            {isStart ? '⚠️' : '✅'}
          </span>
          <div className="leading-snug">
            <strong className="block font-bold mb-0.5">
              {isStart ? 'Pemberitahuan Status Layanan:' : 'Status Pemulihan Jaringan:'}
            </strong>
            <span>
              {isStart
                ? 'Selama pekerjaan pemeliharaan fisik berlangsung, koneksi internet pelanggan pada sektor terkait dapat mengalami degradasi sinyal atau terputus sementara waktu.'
                : 'Seluruh pekerjaan pemeliharaan telah rampung diverifikasi. Kualitas redaman optik dan layanan koneksi internet pelanggan telah kembali normal.'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. CARD: CAKUPAN WILAYAH TERDAMPAK ───────────────────────── */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-white shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Cakupan Wilayah &amp; Sektor Terkait
            </span>
          </div>

          <span className="text-[10px] font-mono text-slate-500 font-semibold">
            {areas.length} Titik Area
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pl-7">
          {areas.map((area, idx) => (
            <div
              key={idx}
              className="px-3.5 py-1.5 rounded-lg bg-white text-slate-800 border border-slate-200 flex items-center gap-2 font-medium text-xs shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{area}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 4. CARD: JADWAL & METRIK WAKTU ──────────────────────────── */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-white shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
            Jadwal &amp; Estimasi Pengerjaan
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pl-7">
          <div className="bg-white p-3 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Waktu Mulai</span>
            <span className="text-lg font-black text-slate-900 font-mono tracking-tight block mt-0.5">{displayStartTime}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              {isStart ? 'Perkiraan Selesai' : 'Selesai Aktual'}
            </span>
            <span className={`text-lg font-black font-mono tracking-tight block mt-0.5 ${
              isStart ? 'text-slate-900' : 'text-emerald-700'
            }`}>
              {displayEndTime}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
              {isStart ? 'Estimasi Durasi' : 'Total Durasi'}
            </span>
            <span className="text-lg font-black text-slate-900 font-mono tracking-tight block mt-0.5">{displayDuration}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic pl-7 mt-2">
          *Durasi dan jadwal pelaksanaan dapat disesuaikan dengan kondisi cuaca dan teknis lapangan.
        </p>
      </div>

      {/* ─── 5. CARD: DOKUMENTASI & VERIFIKASI TEKNIS ─────────────────── */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-white shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Dokumentasi &amp; Verifikasi Lapangan
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Audit Visual Jointer
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pl-7">
          {/* Frame Foto 1: Pemeriksaan / Sebelum */}
          <div className="rounded-lg border border-slate-200 bg-white h-32 overflow-hidden relative flex flex-col items-center justify-center">
            {photoBefore ? (
              <>
                <img src={photoBefore} alt="Pemeriksaan" className="w-full h-full object-cover" />
                <div className="absolute bottom-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                  Sebelum Pengerjaan
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <svg className="w-6 h-6 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px] font-mono font-medium">Foto Pemeriksaan Fisik ODP</span>
              </div>
            )}
          </div>

          {/* Frame Foto 2: Perbaikan / Selesai */}
          <div className="rounded-lg border border-slate-200 bg-white h-32 overflow-hidden relative flex flex-col items-center justify-center">
            {photoAfter ? (
              <>
                <img src={photoAfter} alt="Perbaikan" className="w-full h-full object-cover" />
                <div className="absolute bottom-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                  Setelah Perbaikan
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <svg className="w-6 h-6 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-mono font-medium">Foto Hasil Ukur / Sambungan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 6. FOOTER SECTION ────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white px-5 py-3 rounded-xl flex items-center justify-between text-xs mt-1 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-bold tracking-tight">{technicianName}</span>
          <span className="text-slate-500 font-mono">•</span>
          <span className="text-slate-400 text-[11px]">NOC Field Operations</span>
        </div>

        <div className="flex items-center gap-3 text-right">
          <span className="text-[10px] text-slate-400 font-mono">Tiket Resmi:</span>
          <span className="font-mono font-bold text-amber-300 text-xs tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {ticketCode}
          </span>
        </div>
      </div>
    </div>
  );
}
