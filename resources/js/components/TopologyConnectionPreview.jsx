import React, { useEffect, useMemo, useRef, useState } from 'react';
import RefreshButton from './RefreshButton';
import { CANDIDATE_LABELS, REVIEW_LABELS, reviewExport } from '../lib/topologyCandidates';
import { formatMeters } from '../lib/cableRoutes';
import { nearbyNodes } from '../lib/topologyNeighborhood';
import TopologyConnectionRegistry from './TopologyConnectionRegistry';

const panel = 'bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4';
const button = 'px-3 py-2 text-xs font-semibold rounded-md border border-black/70 dark:border-white/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';
const field = 'bg-white dark:bg-black border border-black/40 dark:border-white/40 rounded-md px-3 py-2 text-xs';

function ConnectionMap({ result, candidate }) {
  const container = useRef(null), mapRef = useRef(null), leaflet = useRef(null), layers = useRef(null), context = useRef([]);
  const surroundings = useRef([]), nodeMarkers = useRef(new Map());
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  const [radius, setRadius] = useState(250), [showNames, setShowNames] = useState(true);
  const neighbors = useMemo(() => nearbyNodes(result.nodes, candidate, radius), [result.nodes, candidate, radius]);
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(module => {
      if (cancelled || !container.current) return;
      const L = module.default || module;
      leaflet.current = L;
      const map = L.map(container.current, { center: [-0.787, 100.654], zoom: 15 });
      mapRef.current = map;
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: '© Google Maps' }).addTo(map);
      layers.current = L.layerGroup().addTo(map);
      setReady(true);
      map.invalidateSize();
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current || !candidate) return;
    const L = leaflet.current, group = layers.current, map = mapRef.current;
    group.clearLayers();
    nodeMarkers.current.clear();
    const all = [];
    const popup = text => { const element = document.createElement('div'); element.textContent = text; return element; };
    result.cables.filter(c => candidate.cable_ids.some(id => String(id) === String(c.id))).forEach(cable => {
      const points = cable.route.map(p => [p.lat, p.lng]);
      all.push(...points);
      L.polyline(points, { color: cable.cable_color || '#2563eb', weight: 5, opacity: 1 }).addTo(group).bindPopup(popup(cable.label));
    });
    L.polyline([[candidate.a.lat, candidate.a.lng], [candidate.b.lat, candidate.b.lng]], { color: '#ea580c', weight: 4, dashArray: '6 6' }).addTo(group);
    for (const p of [candidate.a, candidate.b]) L.circleMarker([p.lat,p.lng], { radius: 7, color: '#ea580c', fillColor: '#fff', fillOpacity: 1 }).addTo(group);
    for (const { node, distance, selected } of neighbors) {
      const color = { ODP:'#2563eb', ODC:'#7c3aed', OLT:'#dc2626', CLOSURE:'#0f766e', POLE:'#475569' }[String(node.node_type).toUpperCase()] || '#475569';
      const title = [node.node_type || 'Node', node.code, node.name || `Node ${node.id}`].filter(Boolean).join(' · ');
      const marker = L.circleMarker([node.point.lat, node.point.lng], { radius: selected ? 10 : 7, color: selected ? '#d97706' : '#fff', fillColor: selected ? '#fbbf24' : color, fillOpacity: 1, weight: 2 })
        .addTo(group).bindTooltip(popup(title), { permanent: showNames || selected, direction: 'top', offset:[0,-8] })
        .bindPopup(popup(`${title} · ${formatMeters(distance)} dari titik calon terdekat${selected ? ' · Node calon sambungan' : ''}`));
      nodeMarkers.current.set(String(node.id), marker);
    }
    context.current = all;
    surroundings.current = [[candidate.a.lat,candidate.a.lng], [candidate.b.lat,candidate.b.lng], ...neighbors.map(({node}) => [node.point.lat,node.point.lng])];
    map.invalidateSize();
    map.fitBounds(surroundings.current, { padding: [55,55], maxZoom: 18 });
  }, [ready, result, candidate, neighbors, showNames]);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-2">Radius node sekitar<select aria-label="Radius node sekitar" className={field} value={radius} onChange={e => setRadius(Number(e.target.value))}>{[100,250,500].map(value => <option key={value} value={value}>{value} meter</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showNames} onChange={e => setShowNames(e.target.checked)}/>Tampilkan nama node</label>
    </div>
    <div className="relative h-[420px] rounded-md border border-black/40 dark:border-white/40 overflow-hidden">
      <div ref={container} className="w-full h-full"/>
      {error && <div role="alert" className="absolute inset-0 z-[500] bg-white dark:bg-black p-6 text-xs">Peta gagal dimuat. Daftar calon hubungan tetap tersedia.</div>}
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-black/60 dark:text-white/60"><span>Peta satelit · warna garis mengikuti data kabel · jingga putus-putus: jarak calon sambungan.</span><button className={button} disabled={!ready || !candidate} onClick={() => { if (context.current.length) mapRef.current.fitBounds(context.current, { padding:[35,35], maxZoom:17 }); }}>Lihat seluruh rute</button></div>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={!ready || !candidate} onClick={() => { if (surroundings.current.length) mapRef.current.fitBounds(surroundings.current, { padding:[55,55], maxZoom:18 }); }}>Lihat node sekitar</button><button className={button} disabled={!ready || !candidate} onClick={() => mapRef.current.fitBounds([[candidate.a.lat,candidate.a.lng],[candidate.b.lat,candidate.b.lng]], { padding:[55,55], maxZoom:18 })}>Fokus calon hubungan</button></div>
    <ul aria-label="Warna kabel pada peta" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {result.cables.filter(c => candidate?.cable_ids.some(id => String(id) === String(c.id))).map(cable => <li key={cable.id} className="flex items-center gap-2 min-w-0"><span aria-hidden="true" className="inline-block w-6 shrink-0 border-t-4" style={{ borderColor: cable.cable_color || '#2563eb' }}/><span className="break-words">{cable.label}{!cable.cable_color && ' (warna bawaan)'}</span></li>)}
    </ul>
    <details open className="rounded-md border border-black/20 dark:border-white/20 p-3 text-xs">
      <summary className="font-semibold cursor-pointer">Node sekitar ({neighbors.length})</summary>
      <p className="text-[11px] text-black/60 dark:text-white/60 mt-2">Jarak ke titik A/B terdekat, bukan panjang kabel. Warna marker membedakan jenis node; kuning menandai node calon sambungan.</p>
      <ul aria-label="Daftar node sekitar" className="mt-2 max-h-48 overflow-auto divide-y divide-black/10 dark:divide-white/10">
        {neighbors.map(({node,distance,selected}) => <li key={node.id}><button className="w-full text-left flex items-start justify-between gap-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50" disabled={!ready} onClick={() => { const marker=nodeMarkers.current.get(String(node.id)); if (marker) { mapRef.current.setView(marker.getLatLng(),18); marker.openPopup(); } }}><span className="min-w-0 break-words"><b>{node.name || `Node ${node.id}`}</b><span className="block text-[11px] text-black/60 dark:text-white/60">{node.node_type || 'Node'}{node.code ? ` · ${node.code}` : ''}{selected ? ' · Calon sambungan' : ''}{distance > radius ? ' · Di luar radius' : ''}</span></span><span className="font-mono whitespace-nowrap">{formatMeters(distance)}</span></button></li>)}
      </ul>
      {!neighbors.length && <p className="mt-2 text-black/60 dark:text-white/60">Tidak ada node dengan koordinat valid dalam radius ini. Coba perbesar radius.</p>}
    </details>
  </div>;
}

export default function TopologyConnectionPreview({ onBack }) {
  const [bundle, setBundle] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [tolerance, setTolerance] = useState(10), [reviews, setReviews] = useState({}), [pending, setPending] = useState(null);
  const [query, setQuery] = useState(''), [kind, setKind] = useState('all'), [decision, setDecision] = useState('all'), [cableId, setCableId] = useState('all');
  const [selectedId, setSelectedId] = useState(''), [page, setPage] = useState(1);
  const [registryBusy, setRegistryBusy] = useState(false);
  const [registryDraft, setRegistryDraft] = useState(false);
  const snapshot = useRef(null), job = useRef(0), worker = useRef(null), request = useRef(null), timer = useRef(null), busyRef = useRef(false);
  const hasDraft = Object.values(reviews).some(r => r.decision !== 'pending' || r.note);
  const result = bundle?.result;
  const selection = result?.candidates.find(c => c.id === selectedId);

  const analyse = (data, distance) => new Promise((resolve, reject) => {
    const task = new Worker(new URL('../lib/topologyCandidates.worker.js', import.meta.url), { type: 'module' });
    worker.current = task;
    const finish = () => { task.terminate(); if (worker.current === task) worker.current = null; clearTimeout(timer.current); };
    task.onmessage = event => { finish(); event.data.result ? resolve(event.data.result) : reject(Error(event.data.error)); };
    task.onerror = () => { finish(); reject(Error('Pratinjau gagal dihitung. Muat ulang halaman dan coba lagi.')); };
    timer.current = setTimeout(() => { finish(); reject(Error('Analisis melewati batas waktu. Kurangi jumlah rute atau periksa data koordinat.')); }, 20000);
    task.postMessage({ data, tolerance: distance });
  });

  const run = async action => {
    if (action.type === 'back') { onBack(); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setPending(null);
    const token = ++job.current;
    try {
      let source = snapshot.current;
      const nextTolerance = action.type === 'tolerance' ? action.value : tolerance;
      if (action.type === 'refresh' || !source) {
        request.current = new AbortController();
        const response = await fetch('/api/gis/map-data', { signal: request.current.signal, headers:{ Accept:'application/json' } });
        if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Akses ditolak. Periksa sesi login dan hak akses.' : 'Data pratinjau gagal dimuat. Hasil sebelumnya tetap dipertahankan.');
        const json = await response.json();
        if (!Array.isArray(json.data?.nodes) || !Array.isArray(json.data?.cables)) throw Error('Respons koordinat tidak lengkap. Coba muat ulang data.');
        source = { data: json.data, loadedAt: new Date().toISOString() };
      }
      if (token !== job.current) return;
      const calculated = await analyse(source.data, nextTolerance);
      if (token !== job.current) return;
      snapshot.current = source;
      setBundle({ result: calculated, loadedAt: source.loadedAt });
      setTolerance(nextTolerance); setReviews({}); setSelectedId(calculated.candidates[0]?.id || ''); setPage(1);
    } catch (err) { if (token === job.current && err.name !== 'AbortError') setError(err.message); }
    finally { if (token === job.current) { busyRef.current = false; setBusy(false); } }
  };
  const ask = action => { if (registryBusy || registryDraft) { setError('Selesaikan atau batalkan formulir hubungan terlebih dahulu.'); return; } if (hasDraft) setPending(action); else run(action); };
  useEffect(() => { if (!registryDraft && !registryBusy) setError(previous => previous === 'Selesaikan atau batalkan formulir hubungan terlebih dahulu.' ? '' : previous); }, [registryDraft, registryBusy]);
  useEffect(() => {
    run({ type:'refresh' });
    return () => { job.current++; worker.current?.terminate(); request.current?.abort(); clearTimeout(timer.current); busyRef.current = false; };
  }, []);
  useEffect(() => {
    if (!hasDraft) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [hasDraft]);
  const filtered = useMemo(() => (result?.candidates || []).filter(c => {
    const value = c.existing ? 'existing' : reviews[c.id]?.decision || 'pending';
    return (kind === 'all' || c.kind === kind) && (decision === 'all' || value === decision)
      && (cableId === 'all' || c.cable_ids.some(id => String(id) === cableId))
      && `${c.title} ${c.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [result, kind, decision, cableId, query, reviews]);
  useEffect(() => { setPage(1); }, [kind, decision, cableId, query]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / 25)), currentPage = Math.min(page, maxPage);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const reviewed = Object.values(reviews).filter(r => r.decision !== 'pending').length;
  const draftCount = Object.values(reviews).filter(r => r.decision !== 'pending' || r.note).length;
  const changeReview = patch => setReviews(previous => ({ ...previous, [selectedId]: { decision:'pending', note:'', ...previous[selectedId], ...patch } }));
  const exportReview = () => {
    const payload = reviewExport(result, reviews, bundle.loadedAt);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], { type:'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `Validasi_Topologi_FONA_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="space-y-4 text-black dark:text-white">
    <div className={`${panel} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
      <div><h1 className="text-xl font-bold">Pratinjau Hubungan Kabel & Node</h1><p className="text-xs text-black/60 dark:text-white/60 mt-1">Periksa calon sambungan dari koordinat yang sudah tersimpan.</p></div>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || registryBusy} onClick={() => ask({type:'back'})}>Kembali ke Rute Kabel</button><RefreshButton isRefreshing={busy || registryBusy} label="Muat Ulang Data" onRefresh={() => ask({type:'refresh'})}/></div>
    </div>
    <div className="rounded-md border border-amber-400 p-3 text-xs space-y-1 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
      <p className="font-semibold">Pratinjau — belum mengubah topologi aktif.</p><p>Kedekatan koordinat belum membuktikan sambungan fiber. Konfirmasi node sambung, core, splitter, dan PON sesuai kondisi lapangan.</p><p>Penilaian dan catatan berlaku untuk sesi ini. Ekspor untuk menyimpan draf, atau gunakan bagian Hubungan Tervalidasi untuk menyimpan sambungan yang sudah diperiksa. Deteksi gangguan belum memakai hubungan tersebut.</p>
    </div>
    {pending && <div role="alert" className={`${panel} text-xs space-y-3`}><p>Penilaian sesi ini belum disimpan ke berkas. Ekspor hasil dahulu bila diperlukan. Melanjutkan akan menghapus penilaian sesi ini.</p><div className="flex gap-2 flex-wrap"><button className={button} disabled={registryBusy || registryDraft} onClick={() => { const action=pending;setPending(null);run(action); }}>Lanjutkan dan Hapus Penilaian Sesi</button><button className={button} onClick={() => setPending(null)}>Batal</button></div></div>}
    {error && <div role="alert" className="text-xs border border-red-400 text-red-700 dark:text-red-300 rounded-md p-3">{error}<button className="ml-3 underline" disabled={busy || registryBusy} onClick={() => ask({type:'refresh'})}>Coba Lagi</button></div>}
    {busy && <p role="status" className="text-xs text-indigo-600 dark:text-indigo-400">Memuat dan menghitung calon hubungan dari data tersimpan...</p>}
    {result && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Node dengan GPS',result.coverage.valid_nodes],['Rute dapat diperiksa',result.coverage.valid_cables],['Calon hubungan',result.candidates.length],['Dinilai dalam sesi ini',reviewed]].map(([label,value]) => <div className={panel} key={label}><p className="text-xs text-black/60 dark:text-white/60">{label}</p><p className="text-xl font-bold mt-2">{value.toLocaleString('id-ID')}</p></div>)}</div>
      <div className={`${panel} space-y-3`}>
        <div className="flex gap-3 flex-wrap items-end">
          <label className="text-xs">Toleransi koordinat<select aria-label="Toleransi koordinat" className={`${field} block mt-1`} value={tolerance} disabled={busy || registryBusy} onChange={e => ask({type:'tolerance',value:Number(e.target.value)})}>{[5,10,20,50,100].map(n => <option key={n} value={n}>{n} meter</option>)}</select></label>
          <label className="text-xs flex-1 min-w-[180px]">Cari kabel atau node<input aria-label="Cari kabel atau node" className={`${field} block w-full mt-1`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama atau kode..."/></label>
          <label className="text-xs">Jenis calon<select aria-label="Jenis calon hubungan" className={`${field} block mt-1`} value={kind} onChange={e => setKind(e.target.value)}><option value="all">Semua jenis</option>{Object.entries(CANDIDATE_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-xs">Penilaian<select aria-label="Filter penilaian" className={`${field} block mt-1`} value={decision} onChange={e => setDecision(e.target.value)}><option value="all">Semua penilaian</option>{Object.entries(REVIEW_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}<option value="existing">Sudah tercatat</option></select></label>
          <label className="text-xs">Kabel<select aria-label="Filter kabel pratinjau" className={`${field} block mt-1 max-w-[260px]`} value={cableId} onChange={e => setCableId(e.target.value)}><option value="all">Semua kabel</option>{result.cables.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <button className={button} disabled={busy || registryBusy || !hasDraft} onClick={exportReview}>Ekspor Hasil Validasi ({draftCount})</button>
        </div>
        <p className="text-[11px] text-black/60 dark:text-white/60">Data dimuat {new Date(bundle.loadedAt).toLocaleString('id-ID')} · toleransi {result.tolerance} m. Toleransi adalah batas pencarian, bukan ketepatan lokasi sambungan.</p>
        <details className="text-xs"><summary className="cursor-pointer">Kelengkapan data: {result.coverage.invalid_node_gps} node tanpa GPS valid · {result.coverage.skipped_cables} kabel belum dapat diperiksa</summary><div className="max-h-32 overflow-auto mt-2 space-y-1">{result.skipped.map(c => <p key={c.id}>{c.label}: {c.reason}</p>)}<p>Perpotongan dua garis tanpa node atau ujung kabel tidak dianggap calon sambungan. Penilaian ini belum membuktikan arah aliran optik.</p></div></details>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${panel} min-w-0`}>
          <h2 className="font-semibold text-sm mb-3">Daftar Calon Hubungan ({filtered.length.toLocaleString('id-ID')})</h2>
          <div className="overflow-auto max-h-[560px] rounded-md border border-black/20 dark:border-white/20"><table className="w-full text-xs text-left min-w-[580px]"><thead className="sticky top-0 z-10 bg-white dark:bg-black border-b border-black/30 dark:border-white/30"><tr><th className="p-3">Calon hubungan</th><th className="p-3">Jarak</th><th className="p-3">Penilaian</th><th className="p-3">Aksi</th></tr></thead><tbody className="divide-y divide-black/15 dark:divide-white/15">{rows.map(c => <tr key={c.id} className={selectedId === c.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}><td className="p-3"><p className="text-[10px] text-black/60 dark:text-white/60 mb-1">{CANDIDATE_LABELS[c.kind]}</p><p className="font-semibold">{c.title}</p>{c.warnings.length > 0 && <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">Perlu perhatian ({c.warnings.length})</p>}</td><td className="p-3 whitespace-nowrap font-mono">{formatMeters(c.distance_meters)}</td><td className="p-3">{c.existing ? 'Sudah tercatat' : REVIEW_LABELS[reviews[c.id]?.decision || 'pending']}</td><td className="p-3"><button className={button} disabled={busy || registryBusy} onClick={() => setSelectedId(c.id)}>Periksa</button></td></tr>)}{!rows.length && <tr><td className="p-8 text-center text-black/60 dark:text-white/60" colSpan={4}>Tidak ada calon hubungan untuk filter dan toleransi ini. Ini belum memastikan seluruh topologi lengkap.</td></tr>}</tbody></table></div>
          <div className="flex justify-between items-center gap-2 mt-3 text-xs"><span>Halaman {currentPage} dari {maxPage}</span><div className="flex gap-2"><button className={button} disabled={currentPage <= 1} onClick={() => setPage(currentPage-1)}>Sebelumnya</button><button className={button} disabled={currentPage >= maxPage} onClick={() => setPage(currentPage+1)}>Berikutnya</button></div></div>
        </div>
        <div className={`${panel} min-w-0 space-y-3`}>
          <h2 className="font-semibold text-sm">Pemeriksaan Calon Sambungan</h2>
          {selection ? <>
            <p className="text-xs font-semibold">{selection.title}</p><p className="text-xs text-black/60 dark:text-white/60">{selection.reason}</p>
            <div className="flex flex-wrap gap-3 text-xs"><span>Jarak koordinat: <b>{formatMeters(selection.distance_meters)}</b></span>{selection.position_meters !== undefined && <span>Posisi di rute dari titik pertama: {formatMeters(selection.position_meters)}</span>}</div>
            {selection.warnings.map(w => <p key={w} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>)}
            <ConnectionMap result={result} candidate={selection}/>
            <p className="text-[11px] font-mono text-black/60 dark:text-white/60 break-all">A: {selection.a.lat.toFixed(7)}, {selection.a.lng.toFixed(7)} · B: {selection.b.lat.toFixed(7)}, {selection.b.lng.toFixed(7)}</p>
            {selection.existing ? <p className="text-xs">Hubungan node ini sudah tercatat pada data kabel. Tetap periksa kecocokan koordinat dan sambungan fisiknya.</p> : <>
              <label className="block text-xs">Penilaian manual<select aria-label="Penilaian manual" className={`${field} block w-full mt-1`} value={reviews[selection.id]?.decision || 'pending'} disabled={busy || registryBusy} onChange={e => changeReview({decision:e.target.value})}>{Object.entries(REVIEW_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="block text-xs">Catatan pemeriksaan<textarea aria-label="Catatan pemeriksaan" className={`${field} block w-full mt-1`} rows={3} maxLength={1000} value={reviews[selection.id]?.note || ''} disabled={busy || registryBusy} onChange={e => changeReview({note:e.target.value})} placeholder="Contoh: tersambung di closure, core biru; perlu verifikasi lapangan."/></label>
            </>}
          </> : <p className="text-xs text-black/60 dark:text-white/60">Pilih calon hubungan dari daftar untuk melihat rute dan memberi penilaian.</p>}
        </div>
      </div>
      <TopologyConnectionRegistry candidate={selection} tolerance={tolerance} accepted={reviews[selectedId]?.decision === 'accepted'} note={reviews[selectedId]?.note || ''} onBusyChange={setRegistryBusy} onDraftChange={setRegistryDraft}/>
    </>}
  </div>;
}
