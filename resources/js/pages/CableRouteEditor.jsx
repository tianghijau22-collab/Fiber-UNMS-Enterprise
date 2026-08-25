import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthContext';

/* ══════════════════════════════════════════════════════════════════
   STREET VIEW MODAL COMPONENT
══════════════════════════════════════════════════════════════════ */
function StreetViewModal({ lat, lng, title, onClose }) {
  if (!lat || !lng) return null;
  const embedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
  const directUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
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
function RouteDrawerMap({ fromNode, toNode, waypoints, setWaypoints, activeCableId, onOpenStreetView }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersGroupRef = useRef(null);
  const lastCableKeyRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true); // Default Satelit Hybrid

  // Initialize Leaflet
  useEffect(() => {
    import('leaflet').then(L => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const centerLat = fromNode?.lat || -0.787123;
        const centerLng = fromNode?.lng || 100.654123;

        const map = Lf.map(mapRef.current, {
          center: [centerLat, centerLng],
          zoom: 16,
          zoomControl: true,
        });

        // Satelit Google Hybrid vs Street Standard
        const satUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileLayerRef.current = Lf.tileLayer(satUrl, {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        }).addTo(map);

        layersGroupRef.current = Lf.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapLoaded(true);
      }
    }).catch(err => console.error('Failed to load Leaflet map:', err));

    return () => {
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
      tileLayerRef.current = Lf.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 });
    } else {
      // Vektor OpenStreetMap
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    }
    tileLayerRef.current.addTo(map);
  };

  // Handle map click to add waypoints
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current) return;
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
  }, [mapLoaded, setWaypoints]);

  // Re-render polyline and markers when waypoints change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !layersGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;

    layerGroup.clearLayers();

    const points = [];

    // Add From Node marker
    if (fromNode && fromNode.lat && fromNode.lng) {
      points.push([fromNode.lat, fromNode.lng]);
      const fromIcon = Lf.divIcon({
        className: 'custom-node-start',
        html: `<div style="background:#059669; color:white; font-weight:800; font-size:10px; padding:4px 8px; border-radius:6px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap;">Pangkal: ${fromNode.name}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      Lf.marker([fromNode.lat, fromNode.lng], { icon: fromIcon })
        .bindPopup(`<b>Pangkal Cable</b><br/>${fromNode.name}`)
        .addTo(layerGroup);
    }

    // Include waypoints in cable route polyline without rendering individual pole markers
    waypoints.forEach((wp) => {
      if (wp && wp.lat && wp.lng) {
        points.push([wp.lat, wp.lng]);
      }
    });

    // Add To Node marker
    if (toNode && toNode.lat && toNode.lng) {
      points.push([toNode.lat, toNode.lng]);
      const toIcon = Lf.divIcon({
        className: 'custom-node-end',
        html: `<div style="background:#7c3aed; color:white; font-weight:800; font-size:10px; padding:4px 8px; border-radius:6px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap;">Tujuan: ${toNode.name}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      Lf.marker([toNode.lat, toNode.lng], { icon: toIcon })
        .bindPopup(`<b>Tujuan Cable</b><br/>${toNode.name}`)
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
    if (lastCableKeyRef.current !== cableKey && points.length >= 2) {
      lastCableKeyRef.current = cableKey;
      const bounds = Lf.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [mapLoaded, fromNode, toNode, waypoints, setWaypoints, activeCableId]);

  return (
    <div className="relative w-full h-[480px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-xs text-white px-3.5 py-2 rounded-xl text-xs shadow-lg border border-slate-700/80">
        Klik lokasi di peta untuk memilih/menambah titik tiang kabel
      </div>

      <div className="absolute top-3 right-3 z-[400] flex items-center space-x-2">
        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-lg border border-slate-700 transition-all flex items-center gap-1.5"
        >
          <span>{isSatellite ? '🗺️ Mode Peta Vektor' : '🛰️ Mode Satelit High-Res'}</span>
        </button>

        {waypoints.length > 0 && (
          <button
            onClick={() => {
              const lastWp = waypoints[waypoints.length - 1];
              onOpenStreetView(lastWp.lat, lastWp.lng, lastWp.name);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
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
export default function CableRouteEditor() {
  const { hasRole } = useAuth();
  const canCrud = hasRole('Super Administrator', 'Operator Jaringan', 'NOC Operator');
  const [cables, setCables] = useState([]);
  const [selectedCableId, setSelectedCableId] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [streetViewTarget, setStreetViewTarget] = useState(null);

  // Fetch real cables on mount
  useEffect(() => {
    fetch('/api/fault-tracing/cables')
      .then(res => res.json())
      .then(res => {
        const data = res.data || [];
        setCables(data);
        if (data.length > 0) {
          setSelectedCableId(data[0].id);
          setWaypoints(data[0].route_coordinates || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load cables:', err);
        setLoading(false);
      });
  }, []);

  const activeCable = cables.find(c => String(c.id) === String(selectedCableId)) || cables[0];

  const handleCableSelect = (id) => {
    setSelectedCableId(id);
    const selected = cables.find(c => String(c.id) === String(id));
    if (selected) {
      setWaypoints(selected.route_coordinates || []);
    }
  };

  // Calculate Haversine total length
  const calculateTotalMeters = () => {
    if (!activeCable || waypoints.length === 0) return activeCable?.length_meters || 0;

    let total = 0;
    const allPoints = [];

    if (activeCable.from_node) {
      allPoints.push({ lat: activeCable.from_node.lat, lng: activeCable.from_node.lng });
    }
    allPoints.push(...waypoints);
    if (activeCable.to_node) {
      allPoints.push({ lat: activeCable.to_node.lat, lng: activeCable.to_node.lng });
    }

    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      const earthRadius = 6371000;
      const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
      const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += earthRadius * c;
    }

    return Math.round(total);
  };

  const handleSaveRoute = () => {
    if (!selectedCableId) return;
    setSaving(true);
    const calculatedLength = calculateTotalMeters();

    fetch(`/api/network-cables/${selectedCableId}/route`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
      },
      body: JSON.stringify({
        route_coordinates: waypoints,
        length_meters: calculatedLength > 0 ? calculatedLength : activeCable.length_meters,
      }),
    })
      .then(res => res.json())
      .then(res => {
        setSaving(false);
        setNotification('Rute tiang kabel berhasil disimpan ke database!');
        setCables(prev => prev.map(c => String(c.id) === String(selectedCableId) ? { ...c, route_coordinates: waypoints, length_meters: calculatedLength } : c));
        setTimeout(() => setNotification(null), 4000);
      })
      .catch(err => {
        console.error(err);
        setSaving(false);
      });
  };

  const handleRemoveWaypoint = (index) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearWaypoints = () => {
    setWaypoints([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Pemetaan rute kabel
          </h3>

        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Panel (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Pilih Kabel Backbone / Feeder *
                </label>
                {loading ? (
                  <div className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-500 animate-pulse">
                    Memuat daftar kabel...
                  </div>
                ) : (
                  <select
                    value={selectedCableId}
                    onChange={(e) => handleCableSelect(e.target.value)}
                    className="w-full sm:w-[320px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {cables.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.length_meters}m)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {canCrud && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClearWaypoints}
                    disabled={waypoints.length === 0}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50"
                  >
                    Bersihkan Rute
                  </button>
                  <button
                    onClick={handleSaveRoute}
                    disabled={saving || !selectedCableId}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Rute Kabel'}
                  </button>
                </div>
              )}
            </div>

            {/* Map Drawer */}
            <RouteDrawerMap
              fromNode={activeCable?.from_node}
              toNode={activeCable?.to_node}
              waypoints={waypoints}
              setWaypoints={setWaypoints}
              activeCableId={selectedCableId}
              onOpenStreetView={(lat, lng, name) => setStreetViewTarget({ lat, lng, title: name })}
            />
          </div>
        </div>

        {/* Sidebar Info & Waypoints List */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
              Ringkasan Jalur Tiang Kabel
            </h3>

            {activeCable && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Nama Kabel</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{activeCable.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Pangkal (Node A)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeCable.from_node?.name || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tujuan (Node B)</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{activeCable.to_node?.name || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Total Titik Tiang</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{waypoints.length} Tiang Waypoint</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Panjang Kabel Terukur</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{calculateTotalMeters()} Meter</span>
                </div>
              </div>
            )}
          </div>

          {/* Waypoints Detail List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
              Daftar Urutan Tiang Waypoint ({waypoints.length})
            </h3>

            {waypoints.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium space-y-1">
                <p>Belum ada titik tiang yang ditambahkan.</p>
                <p className="text-[11px] text-slate-400">Klik di peta untuk mulai menggambar rute tiang.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {waypoints.map((wp, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs gap-2">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={wp.name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWaypoints(prev => {
                            const updated = [...prev];
                            updated[idx].name = val;
                            return updated;
                          });
                        }}
                        className="font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 text-xs py-0.5 w-full"
                      />
                      <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                        Lat: {wp.lat}, Lng: {wp.lng}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setStreetViewTarget({ lat: wp.lat, lng: wp.lng, title: wp.name })}
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-[10px] transition-all"
                        title="Buka Google Street View 360° untuk tiang ini"
                      >
                        👁️ SV
                      </button>
                      <button
                        onClick={() => handleRemoveWaypoint(idx)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/60 font-bold text-slate-600 dark:text-slate-300 transition-all"
                        title="Hapus tiang ini"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Street View Modal */}
      {streetViewTarget && (
        <StreetViewModal
          lat={streetViewTarget.lat}
          lng={streetViewTarget.lng}
          title={streetViewTarget.title}
          onClose={() => setStreetViewTarget(null)}
        />
      )}
    </div>
  );
}
