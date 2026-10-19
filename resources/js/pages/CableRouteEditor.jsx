import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import RefreshButton from '../components/RefreshButton';
import TopologyConnectionPreview from '../components/TopologyConnectionPreview';
import { normalizeCable, validPoint, routeDistance, routePayload, escapeMapLabel, formatMeters } from '../lib/cableRoutes';

/* ══════════════════════════════════════════════════════════════════
   STREET VIEW MODAL COMPONENT
══════════════════════════════════════════════════════════════════ */
function StreetViewModal({ lat, lng, title, onClose }) {
  if (!validPoint({ lat, lng })) return null;
  const embedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
  const directUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-black rounded-lg shadow-2xl w-full max-w-4xl border border-black/70 dark:border-white/70 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold">Google Street View 360°</h3>
            <p className="text-xs text-slate-300">{title || `Koordinat: ${lat}, ${lng}`}</p>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all"
            >
              Buka di Tab Baru ↗
            </a>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 font-bold">✕</button>
          </div>
        </div>
        <div className="flex-1 min-h-[420px] bg-slate-950 relative">
          <iframe
            title="Street View 360"
            src={embedUrl}
            className="w-full h-full min-h-[420px] border-0"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INTERACTIVE LEAFLET ROUTE DRAWER MAP
══════════════════════════════════════════════════════════════════ */
function RouteDrawerMap({ fromNode, toNode, waypoints, setWaypoints, activeCableId, onOpenStreetView, editable }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersGroupRef = useRef(null);
  const lastCableKeyRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true); // Default Satelit Hybrid
  const [mapError, setMapError] = useState(false);

  // Initialize Leaflet
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(L => {
      if (cancelled) return;
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const centerLat = validPoint(fromNode) ? fromNode.lat : -0.787123;
        const centerLng = validPoint(fromNode) ? fromNode.lng : 100.654123;

        const map = Lf.map(mapRef.current, {
          center: [centerLat, centerLng],
          zoom: 16,
          zoomControl: true,
        });

        // Satelit Google Hybrid vs Street Standard
        const satUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileLayerRef.current = Lf.tileLayer(satUrl, {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3'],
        }).addTo(map);

        layersGroupRef.current = Lf.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapLoaded(true);

        map.invalidateSize();
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 450);
      }
    }).catch(() => setMapError(true));

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Toggle Map Mode (Satelit / Vektor)
  const toggleMapMode = () => {
    if (!mapInstanceRef.current || !leafletRef.current || !tileLayerRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    map.removeLayer(tileLayerRef.current);

    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (nextMode) {
      // Satelit Google Hybrid
      tileLayerRef.current = Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      });
    } else {
      // Vektor OpenStreetMap
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      });
    }
    tileLayerRef.current.addTo(map);
    map.invalidateSize();
  };

  // Handle map click to add waypoints
  useEffect(() => {
    if (!editable || !mapLoaded || !mapInstanceRef.current || !leafletRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      setWaypoints(prev => {
        const idx = prev.length + 1;
        const newPoint = {
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
          name: `Tiang #${String(idx).padStart(2, '0')}`,
        };
        return [...prev, newPoint];
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapLoaded, setWaypoints, editable]);

  // Re-render polyline and markers when waypoints change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !layersGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;

    layerGroup.clearLayers();

    const points = [];

    // Add From Node marker
    if (validPoint(fromNode)) {
      points.push([fromNode.lat, fromNode.lng]);
      const fromIcon = Lf.divIcon({
        className: 'custom-node-start',
        html: `<div style="background:#059669; color:white; font-weight:800; font-size:10px; padding:4px 8px; border-radius:6px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap;">Pangkal: ${escapeMapLabel(fromNode.name)}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      Lf.marker([fromNode.lat, fromNode.lng], { icon: fromIcon })
        .bindPopup(`<b>Pangkal kabel</b><br/>${escapeMapLabel(fromNode.name)}`)
        .addTo(layerGroup);
    }

    waypoints.forEach((wp, index) => {
      if (validPoint(wp)) {
        points.push([wp.lat, wp.lng]);
        const icon = Lf.divIcon({ className: 'route-waypoint', html: `<span style="display:block;background:#2563eb;color:white;text-align:center;border:2px solid white;border-radius:50%;font:bold 11px/22px sans-serif">${index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
        Lf.marker([wp.lat, wp.lng], { icon, keyboard: true, title: wp.name || `Tiang ${index + 1}` })
          .bindPopup(escapeMapLabel(wp.name || `Tiang ${index + 1}`)).addTo(layerGroup);
      }
    });

    // Add To Node marker
    if (validPoint(toNode)) {
      points.push([toNode.lat, toNode.lng]);
      const toIcon = Lf.divIcon({
        className: 'custom-node-end',
        html: `<div style="background:#7c3aed; color:white; font-weight:800; font-size:10px; padding:4px 8px; border-radius:6px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap;">Tujuan: ${escapeMapLabel(toNode.name)}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      Lf.marker([toNode.lat, toNode.lng], { icon: toIcon })
        .bindPopup(`<b>Tujuan kabel</b><br/>${escapeMapLabel(toNode.name)}`)
        .addTo(layerGroup);
    }

    // Draw Cable Polyline
    if (points.length >= 2) {
      Lf.polyline(points, {
        color: '#fbbf24',
        weight: 4,
        opacity: 0.95,
      }).addTo(layerGroup);
    }

    // Only auto-fit bounds ONCE when switching cable
    const cableKey = `${fromNode?.id}-${toNode?.id}-${activeCableId}`;
    if (lastCableKeyRef.current !== cableKey && points.length > 0) {
      lastCableKeyRef.current = cableKey;
      const bounds = Lf.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }, [mapLoaded, fromNode, toNode, waypoints, setWaypoints, activeCableId]);

  return (
    <div className="relative w-full h-[480px] rounded-lg overflow-hidden border border-black/70 dark:border-white/70">
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[400] bg-black/80 text-white px-3 py-2 rounded-md text-xs">
        {mapError ? 'Peta gagal dimuat. Segarkan halaman untuk mencoba lagi.' : editable ? 'Klik peta untuk menambah tiang sesuai urutan jalur.' : 'Mode lihat rute'}
      </div>

      <div className="absolute top-3 right-3 z-[400] flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs rounded-md shadow-lg border border-slate-700 transition-all flex items-center gap-1.5"
        >
          <span>{isSatellite ? '🗺️ Mode Peta Vektor' : '🛰️ Mode Satelit High-Res'}</span>
        </button>

        {waypoints.length > 0 && (
          <button
            onClick={() => {
              const lastWp = waypoints[waypoints.length - 1];
              onOpenStreetView(lastWp.lat, lastWp.lng, lastWp.name);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-md shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>👁️ Street View 360°</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CABLE ROUTE EDITOR PAGE COMPONENT
══════════════════════════════════════════════════════════════════ */
const panel = 'bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5';
const button = 'px-3 py-2 text-xs font-semibold rounded-md border border-black/70 dark:border-white/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';
const input = 'w-full bg-white dark:bg-black border border-black/40 dark:border-white/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function CableRouteEditor() {
  const { currentUser } = useAuth();
  const canEdit = ['Super Administrator', 'Operator Jaringan'].includes(currentUser?.role);
  const [params, setParams] = useSearchParams();
  const initialId = useRef(params.get('cable_id'));
  const selectedRef = useRef('');
  const requestRef = useRef(0);
  const [cables, setCables] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [useEstimate, setUseEstimate] = useState(false);
  const [streetViewTarget, setStreetViewTarget] = useState(null);
  const [showConnections, setShowConnections] = useState(false);
  const active = cables.find(cable => String(cable.id) === String(selectedId));
  const dirty = !!active && (useEstimate || JSON.stringify(waypoints) !== JSON.stringify(active.route_coordinates || []));
  const estimated = routeDistance(active, waypoints);
  const complete = validPoint(active?.from_node) && validPoint(active?.to_node);
  const invalidPoints = waypoints.some(point => !validPoint(point));

  const selectCable = (cable, updateUrl = true) => {
    const id = cable ? String(cable.id) : '';
    selectedRef.current = id;
    setSelectedId(id);
    setWaypoints(cable?.route_coordinates || []);
    setUseEstimate(false);
    setPendingId(null);
    setError('');
    setNotice('');
    if (updateUrl) setParams(previous => {
      const next = new URLSearchParams(previous);
      if (id) next.set('cable_id', id); else next.delete('cable_id');
      return next;
    }, { replace: true });
  };

  const loadCables = async () => {
    if (saving) return;
    if (dirty) { setError('Simpan atau buang perubahan rute sebelum menyegarkan data.'); return; }
    const request = ++requestRef.current;
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/network-cables', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? 'Akses data kabel ditolak. Periksa sesi login dan hak akses Anda.' : 'Data kabel gagal dimuat. Coba segarkan kembali.');
      const body = await response.json();
      if (!Array.isArray(body.data)) throw new Error('Respons daftar kabel tidak valid.');
      if (request !== requestRef.current) return;
      const next = body.data.map(normalizeCable);
      const wanted = selectedRef.current || initialId.current;
      const target = next.find(cable => String(cable.id) === String(wanted));
      setCables(next);
      selectCable(target || (!wanted ? next[0] : null));
      if (wanted && !target) setError('Kabel yang dipilih tidak ditemukan. Pilih kabel lain dari daftar.');
    } catch (err) {
      if (request === requestRef.current) setError(err.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };
  useEffect(() => { loadCables(); return () => { requestRef.current++; }; }, []);
  useEffect(() => { if (dirty) setNotice(''); }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  const handleSelect = id => {
    if (saving || id === selectedId) return;
    if (dirty) { setPendingId(id); return; }
    selectCable(cables.find(cable => String(cable.id) === String(id)));
  };
  const save = async () => {
    if (!canEdit || saving || loading || !active || !dirty) return;
    let payload;
    try { payload = routePayload(active, waypoints, useEstimate); }
    catch (err) { setError(err.message); return; }
    const id = String(active.id);
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/network-cables/${id}/route`, {
        method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.status !== 'success') throw new Error(body?.message || 'Rute gagal disimpan. Perubahan tetap tersedia untuk dicoba lagi.');
      if (String(body.data?.id) !== id || !Array.isArray(body.data?.route_coordinates)) throw new Error('Respons penyimpanan tidak lengkap. Segarkan setelah memeriksa perubahan.');
      // Keep node relations from the shared list; updateRoute returns the saved model attributes.
      const saved = normalizeCable({ ...active, ...body.data, from_node: active.from_node, to_node: active.to_node });
      setCables(previous => previous.map(cable => String(cable.id) === id ? saved : cable));
      setWaypoints(saved.route_coordinates); setUseEstimate(false); setPendingId(null);
      setNotice('Rute berhasil disimpan. Data yang sama tersedia di Cable Management dan GIS.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const move = (index, direction) => setWaypoints(previous => {
    const next = [...previous];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    return next;
  });

  if (showConnections) return <TopologyConnectionPreview onBack={() => setShowConnections(false)}/>;

  return <div className="space-y-5 text-black dark:text-white">
    <div className={`${panel} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div><h1 className="text-xl font-bold">Pemetaan Rute Kabel</h1><p className="text-xs text-black/60 dark:text-white/60 mt-1">Susun jalur tiang dari kabel yang tercatat di Cable Management.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={dirty || saving || loading} title={dirty ? 'Simpan atau buang perubahan rute terlebih dahulu.' : 'Periksa calon sambungan kabel dan node dari koordinat tersimpan.'} onClick={() => setShowConnections(true)}>Pratinjau Hubungan</button>
        {!dirty && !saving && <Link className={button} to="/cable-management">Manajemen Kabel</Link>}
        <RefreshButton isRefreshing={loading || saving} onRefresh={loadCables}/>
      </div>
    </div>
    {error && <div role="alert" className="p-3 text-xs rounded-md border border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">{error}{!dirty && !loading && <button className="ml-3 underline font-semibold" onClick={loadCables}>Coba lagi</button>}</div>}
    {notice && <div role="status" className="p-3 text-xs rounded-md border border-emerald-400 text-emerald-700 dark:text-emerald-300">{notice}</div>}
    {pendingId !== null && <div role="alert" className="p-3 text-xs rounded-md border border-amber-400 space-y-2"><p>Perubahan belum disimpan. Beralih kabel akan membuang perubahan rute ini.</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => selectCable(cables.find(cable => String(cable.id) === String(pendingId)))}>Ganti dan buang perubahan</button><button className={button} onClick={() => setPendingId(null)}>Tetap di kabel ini</button></div></div>}
    <div className={panel}>
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div className="flex-1 max-w-xl"><label htmlFor="route-cable" className="block text-xs font-semibold mb-2">Pilih kabel ({cables.length})</label><select id="route-cable" className={input} value={selectedId} disabled={loading || saving || !cables.length} onChange={event => handleSelect(event.target.value)}><option value="">Pilih kabel</option>{cables.map(cable => <option key={cable.id} value={cable.id}>{cable.code || 'Tanpa kode'} · {cable.name} · {formatMeters(cable.length_meters)}</option>)}</select></div>
        <div className="flex items-center gap-2 flex-wrap"><span className={`text-xs ${dirty ? 'text-amber-600 dark:text-amber-400' : 'text-black/50 dark:text-white/50'}`}>{dirty ? 'Perubahan belum disimpan' : active ? 'Rute tersimpan' : loading ? 'Memuat daftar kabel...' : 'Belum ada kabel dipilih'}</span>{canEdit && <><button className={button} disabled={!dirty || saving || loading} onClick={() => selectCable(active)}>Buang Perubahan</button><button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50" disabled={!active || !dirty || saving || loading || invalidPoints} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan Rute'}</button></>}</div>
      </div>
      {!loading && !cables.length && !error && <p className="text-sm py-6 text-center text-black/60 dark:text-white/60">Belum ada kabel. Tambahkan kabel melalui Manajemen Kabel.</p>}
    </div>
    {active && <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={panel}><p className="text-xs text-black/60 dark:text-white/60">Identitas kabel</p><p className="font-mono text-xs text-indigo-600 dark:text-indigo-400 mt-2">{active.code || 'Tanpa kode'}</p><p className="font-semibold text-sm mt-1">{active.name}</p><p className="text-xs mt-2 text-black/60 dark:text-white/60">{active.core_count_total} core · {active.installation_type} · {({active:'Aktif',maintenance:'Perawatan',damaged:'Rusak',inactive:'Nonaktif'})[active.status] || active.status}</p></div>
        <div className={panel}><p className="text-xs text-black/60 dark:text-white/60">Panjang tersimpan</p><p className="text-xl font-bold mt-2">{formatMeters(active.length_meters)}</p><p className="text-xs text-black/60 dark:text-white/60 mt-2">Panjang kabel dari Cable Management.</p></div>
        <div className={panel}><p className="text-xs text-black/60 dark:text-white/60">Estimasi jalur peta{!complete ? ' (sebagian)' : ''}</p><p className="text-xl font-bold mt-2">{formatMeters(estimated)}</p><p className="text-xs text-black/60 dark:text-white/60 mt-2">{waypoints.length} tiang · jarak antartitik, belum termasuk cadangan kabel.</p></div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${panel} xl:col-span-2 space-y-4 min-w-0`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"><div><p className="text-black/60 dark:text-white/60">Pangkal (Node A)</p><p className="font-semibold mt-1">{active.from_node?.name || 'Belum dihubungkan'}</p></div><div><p className="text-black/60 dark:text-white/60">Tujuan (Node B)</p><p className="font-semibold mt-1">{active.to_node?.name || 'Belum dihubungkan'}</p></div></div>
          {!complete && <p className="text-xs text-amber-700 dark:text-amber-400">Koordinat pangkal atau tujuan belum lengkap. Lengkapi hubungan node melalui Manajemen Kabel; rute tiang tetap dapat disimpan.</p>}
          {invalidPoints && <p role="alert" className="text-xs text-red-600">Ada titik dengan koordinat tidak valid. Hapus titik tersebut atau buang perubahan sebelum menyimpan.</p>}
          <RouteDrawerMap fromNode={active.from_node} toNode={active.to_node} waypoints={waypoints} setWaypoints={setWaypoints} activeCableId={selectedId} editable={canEdit && !saving && !loading} onOpenStreetView={(lat,lng,title) => setStreetViewTarget({lat,lng,title})}/>
        </div>
        <div className={`${panel} space-y-4 min-w-0`}>
          <div className="flex justify-between items-center gap-2"><h2 className="text-sm font-semibold">Urutan Tiang ({waypoints.length})</h2>{canEdit && <button className={button} disabled={!waypoints.length || saving || loading} onClick={() => setWaypoints([])}>Bersihkan Rute</button>}</div>
          <p className="text-xs text-black/60 dark:text-white/60">Urutan dari pangkal ke tujuan. Nomor tiang sesuai penanda di peta.</p>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-md border border-black/20 dark:border-white/20">
            <table className="w-full text-xs text-left"><thead className="sticky top-0 bg-white dark:bg-black border-b border-black/30 dark:border-white/30"><tr><th className="p-2">No.</th><th className="p-2">Tiang & Koordinat</th><th className="p-2">Aksi</th></tr></thead><tbody className="divide-y divide-black/15 dark:divide-white/15">{waypoints.map((point,index) => <tr key={index}><td className="p-2 align-top">{index + 1}</td><td className="p-2 min-w-[160px]"><input aria-label={`Nama tiang ${index + 1}`} maxLength={160} readOnly={!canEdit || saving || loading} value={point?.name || ''} className="w-full bg-transparent font-semibold border-b border-black/20 dark:border-white/20 py-1" onChange={event => { const name = event.target.value; setWaypoints(previous => previous.map((item,i) => i === index ? {...item,name} : item)); }}/><p className="font-mono text-[10px] text-black/60 dark:text-white/60 mt-1">{point?.lat ?? 'N/A'}, {point?.lng ?? 'N/A'}</p></td><td className="p-2"><div className="flex gap-1 flex-wrap"><button className={button} disabled={!validPoint(point)} title="Lihat Street View" onClick={() => setStreetViewTarget({lat:point.lat,lng:point.lng,title:point.name})}>SV</button>{canEdit && <><button aria-label={`Naikkan tiang ${index + 1}`} className={button} disabled={!index || saving || loading} onClick={() => move(index,-1)}>↑</button><button aria-label={`Turunkan tiang ${index + 1}`} className={button} disabled={index === waypoints.length - 1 || saving || loading} onClick={() => move(index,1)}>↓</button><button aria-label={`Hapus tiang ${index + 1}`} className={button} disabled={saving || loading} onClick={() => setWaypoints(previous => previous.filter((_,i) => i !== index))}>×</button></>}</div></td></tr>)}{!waypoints.length && <tr><td colSpan={3} className="p-6 text-center text-black/60 dark:text-white/60">Belum ada tiang.{canEdit ? ' Klik peta untuk menambahkan.' : ''}</td></tr>}</tbody></table>
          </div>
          {canEdit && <label className="flex gap-2 items-start text-xs"><input type="checkbox" className="mt-0.5" checked={useEstimate} disabled={!complete || !estimated || saving || loading || invalidPoints} onChange={event => setUseEstimate(event.target.checked)}/><span>Gunakan estimasi peta sebagai panjang kabel.<span className="block text-black/60 dark:text-white/60 mt-1">Jika dicentang, panjang di Cable Management ikut diperbarui saat disimpan. Secara bawaan panjang tersimpan dipertahankan.</span></span></label>}
          {!canEdit && <p className="text-xs text-black/60 dark:text-white/60">Akses baca saja. Perubahan rute hanya untuk administrator dan operator jaringan.</p>}
        </div>
      </div>
    </>}
    {streetViewTarget && <StreetViewModal {...streetViewTarget} onClose={() => setStreetViewTarget(null)}/>}
  </div>;
}
