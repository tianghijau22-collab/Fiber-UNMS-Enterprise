import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decimalToDms } from '../utils/coordinateParser.js';

/* ══════════════════════════════════════════════════════════════════
   PEKAT & VIVID COLOR DICTIONARY FOR INFRASTRUCTURE NODES
══════════════════════════════════════════════════════════════════ */
const TYPE_META = {
  POP: { label: 'POP Central', bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-800', color: '#3730a3', ring: '#6366f1', size: 22 },
  ODC: { label: 'ODC Cabinet', bg: 'bg-blue-950/80 text-blue-300 border-blue-800', color: '#1d4ed8', ring: '#3b82f6', size: 19 },
  ODP: { label: 'ODP Point', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800', color: '#047857', ring: '#10b981', size: 15 },
};

const STATUS_META = {
  active: { label: 'Aktif Normal', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800', dot: 'bg-emerald-500', color: '#047857' },
  maintenance: { label: 'Maintenance', badge: 'bg-amber-950/80 text-amber-300 border-amber-800', dot: 'bg-amber-500', color: '#d97706' },
  inactive: { label: 'Tidak Aktif', badge: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400', color: '#64748b' },
  damaged: { label: 'Rusak / Putus Loss', badge: 'bg-rose-950/80 text-rose-300 border-rose-800', dot: 'bg-rose-600', color: '#881337' },
};

const getOpticalQuality = (dbm) => {
  if (dbm == null) return { label: '—', color: '#64748b', badge: 'bg-slate-800 text-slate-400' };
  const num = parseFloat(dbm);
  if (num >= -23.9) return { label: 'Prima (Bagus)', color: '#10b981', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
  if (num >= -25.9) return { label: 'Optimal', color: '#3b82f6', badge: 'bg-blue-950/80 text-blue-300 border-blue-800' };
  if (num >= -27.4) return { label: 'Kurang Baik', color: '#f59e0b', badge: 'bg-amber-950/80 text-amber-300 border-amber-800' };
  return { label: 'Kritis (Loss/Buruk)', color: '#ef4444', badge: 'bg-rose-950/80 text-rose-300 border-rose-800' };
};

const pct = (u, t) => t ? Math.round((u / t) * 100) : 0;

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
            <h3 className="text-base font-bold">Google Street View 360° Panorama</h3>
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
   NODE DETAIL PANEL
══════════════════════════════════════════════════════════════════ */
function NodeDetailPanel({ node, onClose, onOpenStreetView }) {
  const [copied, setCopied] = useState(false);

  if (!node) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Pilih Marker Node pada Peta di Atas</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Klik salah satu titik ODP, ODC, atau POP pada peta di atas untuk membuka telemetry redaman optik live, spesifikasi port &amp; Street View 360°.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Standby Monitoring
        </span>
      </div>
    );
  }

  const meta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
  const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
  const isOdp = node.node_type === 'ODP';
  const optMeta = getOpticalQuality(node.optical_power_dbm);
  const p = pct(node.used_ports, node.total_ports);
  const dmsInfo = decimalToDms(node.latitude, node.longitude);
  const hasCoords = node.latitude && node.longitude && parseFloat(node.latitude) !== 0;

  const handleCopyCoords = () => {
    if (hasCoords) {
      navigator.clipboard.writeText(`${node.latitude}, ${node.longitude}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors duration-300">
      <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${meta.bg}`}>
            {meta.label}
          </span>
          {isOdp && (
            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${optMeta.badge}`}>
              {optMeta.label}
            </span>
          )}
          <h3 className="text-sm font-bold truncate text-white ml-1">{node.name}</h3>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 font-bold shrink-0">✕</button>
      </div>

      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Status Operasional</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dot}`} />
              <span className={`font-bold px-2 py-0.5 rounded-md border ${statusMeta.badge}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {isOdp ? (
            <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 shadow-inner">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Redaman Klien (Rx Power)</span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Realtime
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-extrabold font-mono tracking-tight text-white">
                  {node.rx_power_range ? node.rx_power_range : (node.optical_power_dbm != null ? `${node.optical_power_dbm} dBm` : '—')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: optMeta.color, color: '#ffffff' }}>
                  {optMeta.label}
                </span>
              </div>
              {node.worst_rx_power != null && node.best_rx_power != null && (
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                  <span>Terbaik: <strong className="text-emerald-400">{node.best_rx_power} dBm</strong></span>
                  <span>Kritis: <strong className="text-rose-400">{node.worst_rx_power} dBm</strong></span>
                </div>
              )}
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-600 w-[45%]" />
                  <div className="h-full bg-blue-600 w-[20%]" />
                  <div className="h-full bg-amber-600 w-[15%]" />
                  <div className="h-full bg-rose-800 w-[20%]" />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>-14 dBm (Bagus)</span>
                  <span>-24 dBm</span>
                  <span>-27 dBm (Kritis)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Informasi Perangkat ({node.node_type})</span>
              <p className="text-slate-600 dark:text-slate-300 font-semibold">{node.address || 'Lokasi terdaftar pada database UNMS.'}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {hasCoords ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                  📍 Koordinat Lokasi Node
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300"
                >
                  {copied ? 'Tersalin!' : 'Salin'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-[10px] font-sans font-semibold text-slate-400">Google Maps:</span>
                  <span className="font-bold">{parseFloat(node.latitude).toFixed(6)}, {parseFloat(node.longitude).toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span className="text-[10px] font-sans font-semibold text-slate-400">Google Earth:</span>
                  <span className="font-bold">{dmsInfo.formattedDms || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  onClick={() => onOpenStreetView(node.latitude, node.longitude, node.name)}
                  className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all text-center col-span-3 sm:col-span-1"
                >
                  <span>👁️ Street View 360°</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all text-center"
                >
                  <span>🗺️ Google Maps</span>
                </a>
                <a
                  href={`https://earth.google.com/web/search/${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all text-center"
                >
                  <span>🌍 Google Earth</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
              Belum ada koordinat GPS terdaftar. Edit node untuk memasukkan posisi peta.
            </div>
          )}
        </div>

        <div className="space-y-3">
          {node.total_ports > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Kapasitas Port</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{node.used_ports}/{node.total_ports} Port ({p}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p > 90 ? 'bg-rose-700' : p > 75 ? 'bg-amber-600' : 'bg-emerald-600'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">OLT &amp; Port Uplink</span>
            <p className="font-bold">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'OLT Utama Solok'}</p>
            <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{node.olt_port_ref || 'PON 1/1/1'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INTERACTIVE LEAFLET MAP COMPONENT (SVG RENDERER FOR LIVE FLOW ANIMATION)
══════════════════════════════════════════════════════════════════ */
function LeafletMap({ nodes, selectedNode, onSelectNode, followRoads, onOpenStreetView }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const linesRef = useRef([]);
  const leafletRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const [isSatellite, setIsSatellite] = useState(true);

  // Initialize Map with SVG Renderer (CRITICAL for CSS stroke-dashoffset animation!)
  useEffect(() => {
    if (mapInstanceRef.current) return;

    import('leaflet').then(L => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // SVG Renderer explicitly set to support animated stroke-dashoffset SVG polylines
      const map = Lf.map(mapRef.current, {
        center: [-0.785, 100.654],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: false,
        renderer: Lf.svg(),
      });

      const satUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      tileLayerRef.current = Lf.tileLayer(satUrl, {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      }).addTo(map);

      mapInstanceRef.current = map;

      // Ensure full viewport coverage immediately and after layout paint
      map.invalidateSize();
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      // ResizeObserver to handle container / viewport resize instantly
      if (window.ResizeObserver && mapRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        ro.observe(mapRef.current);
      }
    }).catch(err => console.warn('Leaflet load failed:', err));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const toggleMapMode = () => {
    if (!mapInstanceRef.current || !leafletRef.current || !tileLayerRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    map.removeLayer(tileLayerRef.current);
    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (nextMode) {
      tileLayerRef.current = Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      });
    } else {
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      });
    }
    tileLayerRef.current.addTo(map);
    map.invalidateSize();
  };

  const handleRecenterMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const validNodes = nodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
    if (validNodes.length === 0) return;

    const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 15);
    } else {
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, [nodes]);

  const topologyKey = useMemo(() => {
    return nodes.map(n => `${n.id}:${n.latitude}:${n.longitude}:${n.parent_node_id}`).join('|');
  }, [nodes]);

  // Render Animated Cable Lines with SVG stroke-dashoffset
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    linesRef.current.forEach(l => l.remove());
    linesRef.current = [];

    const nodeMap = new Map();
    nodes.forEach(n => {
      if (n.latitude && n.longitude && parseFloat(n.latitude) !== 0) {
        nodeMap.set(n.id, n);
      }
    });

    let cancelled = false;

    const renderLines = async () => {
      for (const node of nodes) {
        if (cancelled) break;
        if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) continue;

        let parent = null;
        if (node.parent_node_id && nodeMap.has(node.parent_node_id)) {
          parent = nodeMap.get(node.parent_node_id);
        } else if (node.node_type === 'ODP') {
          const potentialOdcs = nodes.filter(n => n.node_type === 'ODC' && n.latitude && n.longitude);
          if (potentialOdcs.length > 0) parent = potentialOdcs[0];
        }

        if (parent && parent.latitude && parent.longitude) {
          const pLat = parseFloat(parent.latitude);
          const pLng = parseFloat(parent.longitude);
          const nLat = parseFloat(node.latitude);
          const nLng = parseFloat(node.longitude);

          const isOdpLine = node.node_type === 'ODP';

          // Warna Garis Fiber Dinamis Berdasarkan Kualitas Redaman Nyata
          let strokeColor = '#1d4ed8'; // Feeder Backbone (Biru)

          if (isOdpLine) {
            const bestPower = node.best_rx_power != null 
              ? parseFloat(node.best_rx_power) 
              : (node.optical_power_dbm != null ? parseFloat(node.optical_power_dbm) : null);

            const isLossLine = node.status === 'damaged' 
              || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')))
              || (bestPower != null && bestPower <= -27.5);

            if (isLossLine) {
              // Kritis / Loss Total -> Garis Merah
              strokeColor = '#ef4444';
            } else if (bestPower != null && bestPower <= -25.9) {
              // Kurang Baik / Waspada -> Garis Kuning / Amber
              strokeColor = '#f59e0b';
            } else if (bestPower != null && bestPower <= -23.9) {
              // Optimal -> Garis Biru
              strokeColor = '#3b82f6';
            } else if (bestPower != null && bestPower > -23.9) {
              // Prima / Bagus -> Garis Hijau Emerald
              strokeColor = '#10b981';
            } else {
              // Belum ada klien / ODP aktif standar -> Garis Hijau
              strokeColor = '#059669';
            }
          }

          const lineCoords = [[pLat, pLng], [nLat, nLng]];

          if (cancelled) break;

          const polyline = Lf.polyline(lineCoords, {
            color: strokeColor,
            weight: isOdpLine ? 4.5 : 5.5,
            opacity: 0.95,
            dashArray: '12, 8',
            className: 'animated-fiber-line',
          }).addTo(map);

          linesRef.current.push(polyline);
        }
      }
    };

    renderLines();

    return () => { cancelled = true; };
  }, [topologyKey, followRoads]);

  // Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds = [];

    nodes.forEach(node => {
      if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) return;

      const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
      const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
      const isSelected = selectedNode?.id === node.id;
      const isOdp = node.node_type === 'ODP';
      // Deteksi Kualitas Optik Terbaik (Best Rx Power)
      const effectiveBestPower = node.best_rx_power ?? node.optical_power_dbm;
      const isLossRange = node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS'));
      const optMeta = isLossRange 
        ? { label: 'Loss / Kritis', color: '#ef4444', border: '#b91c1c' } 
        : getOpticalQuality(effectiveBestPower);
      const opticalDbmText = node.rx_power_range ? node.rx_power_range : (effectiveBestPower != null ? `${effectiveBestPower} dBm` : '—');

      const size = isSelected ? typeMeta.size + 4 : typeMeta.size;

      const icon = Lf.divIcon({
        className: `custom-gis-node-marker ${isSelected ? 'is-selected' : ''}`,
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            ${(isOdp && node.used_ports > 0 && (node.optical_power_dbm != null || node.rx_power_range != null)) ? `
              <div style="
                background: ${optMeta.color};
                color: #ffffff;
                font-weight: 900;
                font-size: 11px;
                padding: 3px 9px;
                border-radius: 9999px;
                border: 2px solid #ffffff;
                box-shadow: 0 4px 10px rgba(0,0,0,0.65);
                white-space: nowrap;
                margin-bottom: 4px;
                font-family: monospace;
                letter-spacing: -0.3px;
              ">
                ${opticalDbmText}
              </div>
            ` : ''}
            <div style="
              width: ${size * 2}px;
              height: ${size * 2}px;
              border-radius: 50%;
              background: ${typeMeta.color};
              border: 3.5px solid #ffffff;
              box-shadow: 0 5px 14px rgba(0,0,0,0.65);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 900;
              font-size: ${size >= 20 ? '12px' : size >= 17 ? '11px' : '10px'};
              letter-spacing: -0.2px;
            ">
              ${node.node_type}
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.95);
              color: #ffffff;
              padding: 3px 8px;
              border-radius: 7px;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              margin-top: 4px;
              border: 1.5px solid rgba(255,255,255,0.3);
              box-shadow: 0 3px 8px rgba(0,0,0,0.5);
            ">
              ${node.name}
            </div>
          </div>
        `,
        iconSize: [220, size * 2 + 55],
        iconAnchor: [110, size * 2 + 30],
      });

      const marker = Lf.marker([parseFloat(node.latitude), parseFloat(node.longitude)], { icon })
        .addTo(map);

      marker.on('click', () => onSelectNode(node));
      markersRef.current.push(marker);
      bounds.push([parseFloat(node.latitude), parseFloat(node.longitude)]);
    });

    if (bounds.length > 0) {
      map.invalidateSize();
      if (isFirstRenderRef.current) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 16);
        } else if (bounds.length > 1) {
          try {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
          } catch { }
        }
        isFirstRenderRef.current = false;
      }
    }
  }, [nodes, selectedNode, onSelectNode]);

  return (
    <div className="relative w-full h-full">
      {/* CSS Animation specifically targeting Leaflet SVG path elements */}
      <style>{`
        @keyframes fiberFlowMovement {
          0% {
            stroke-dashoffset: 40;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .leaflet-overlay-pane svg path.animated-fiber-line,
        path.animated-fiber-line {
          stroke-dasharray: 12 8 !important;
          animation: fiberFlowMovement 0.8s linear infinite !important;
        }
      `}</style>

      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl overflow-hidden shadow-inner"
        style={{ minHeight: '560px' }}
      />

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold rounded-xl border border-slate-700 shadow-lg backdrop-blur-xs transition-all flex items-center gap-1.5"
        >
          <span>{isSatellite ? '🗺️ Mode Peta Vektor' : '🛰️ Mode Satelit High-Res'}</span>
        </button>

        {selectedNode && selectedNode.latitude && selectedNode.longitude && (
          <button
            onClick={() => onOpenStreetView(selectedNode.latitude, selectedNode.longitude, selectedNode.name)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>👁️ Street View 360°</span>
          </button>
        )}
      </div>

      <button
        onClick={handleRecenterMap}
        className="absolute bottom-4 left-4 z-10 px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold rounded-xl border border-slate-700 shadow-lg backdrop-blur-xs flex items-center gap-1.5 transition-all"
        title="Pusatkan Peta ke Lokasi Node"
      >
        <span>Fokus Lokasi Node</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS CARDS BAR
══════════════════════════════════════════════════════════════════ */
function GisStatCards({ nodes }) {
  const pops = nodes.filter(n => n.node_type === 'POP');
  const odcs = nodes.filter(n => n.node_type === 'ODC');
  const odps = nodes.filter(n => n.node_type === 'ODP');

  const activeOdps = odps.filter(n => n.used_ports > 0 && n.optical_power_dbm != null);
  const odpOptValues = activeOdps.map(n => parseFloat(n.optical_power_dbm));
  const avgOdpDbm = odpOptValues.length > 0 ? (odpOptValues.reduce((a, b) => a + b, 0) / odpOptValues.length).toFixed(1) : '—';

  const cards = [
    { label: 'POP Central', value: pops.length, sub: `${pops.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Core Headend' },
    { label: 'ODC Cabinet', value: odcs.length, sub: `${odcs.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Distribution' },
    { label: 'ODP Point', value: odps.length, sub: `${odps.filter(n => n.status === 'active').length} Total Point ODP`, badge: 'Access Terminal' },
    { label: 'Rerata Redaman ODP', value: avgOdpDbm !== '—' ? `${avgOdpDbm} dBm` : '— dBm', sub: `${activeOdps.length} ODP Ada Pelanggan`, badge: 'Modem ONU' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 transition-colors duration-300">
          <div className="flex justify-between items-start mb-1">
            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{c.value}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {c.badge}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">{c.label}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN GIS PAGE CONTROLLER
══════════════════════════════════════════════════════════════════ */
export default function GisTopologyMap() {
  const [searchParams] = useSearchParams();
  const oltFilterParam = searchParams.get('olt_id');

  const [allNodes, setAllNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [followRoads, setFollowRoads] = useState(true);
  const [livePolling, setLivePolling] = useState(true);
  const [activeView, setActiveView] = useState('map');
  const [streetViewTarget, setStreetViewTarget] = useState(null);

  const fetchNodes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/network-nodes?per_page=500');
      const d = await r.json();
      const rawNodes = d.data ?? [];

      setAllNodes(rawNodes);
    } catch {
      if (!silent) setAllNodes([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);

  // Live polling telemetry: silent fetch dari backend API setiap 15 detik
  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      fetchNodes(true);
    }, 15000);

    return () => clearInterval(timer);
  }, [livePolling, fetchNodes]);

  useEffect(() => {
    if (selectedNode) {
      const updated = allNodes.find(n => n.id === selectedNode.id);
      if (updated && updated.optical_power_dbm !== selectedNode.optical_power_dbm) {
        setSelectedNode(updated);
      }
    }
  }, [allNodes, selectedNode]);

  const filteredNodes = useMemo(() => {
    return allNodes.filter(n => {
      if (!['POP', 'ODC', 'ODP'].includes(n.node_type)) return false;
      if (oltFilterParam) {
        if (String(n.olt_device_id) !== String(oltFilterParam) && String(n.parent_node?.olt_device_id) !== String(oltFilterParam)) {
          return false;
        }
      }
      if (typeFilter && n.node_type !== typeFilter) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = n.name?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allNodes, oltFilterParam, typeFilter, statusFilter, searchQuery]);

  const nodesWithCoords = useMemo(() => {
    return filteredNodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
  }, [filteredNodes]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            Peta POP-ODC-ODP
          </h3>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeView === 'map'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
          >
            Peta GIS Widescreen
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeView === 'list'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
          >
            Tabel Telemetry Redaman
          </button>
        </div>
      </div>

      <GisStatCards nodes={allNodes} />

      {/* Main Controls Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama node, lokasi..."
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
          />

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Tipe Node</option>
            <option value="POP">POP Central</option>
            <option value="ODC">ODC Cabinet</option>
            <option value="ODP">ODP Point</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif Normal</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Tidak Aktif</option>
            <option value="damaged">Rusak / Loss</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setFollowRoads(!followRoads)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${followRoads
              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            title="Snap garis kabel mengikuti rute jalan asli (OSRM)"
          >
            <span>{followRoads ? '🛣️ Ikuti Rute Jalan' : '📏 Garis Lurus'}</span>
          </button>

          <button
            onClick={() => setLivePolling(!livePolling)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${livePolling
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${livePolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{livePolling ? 'Telemetry Live' : 'Telemetry Paused'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500 text-xs animate-pulse">
          Memuat spasial peta satelit &amp; telemetry redaman optik ODP...
        </div>
      ) : activeView === 'map' ? (
        <div className="space-y-4">
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden h-[540px] sm:h-[620px] lg:h-[700px]">
            {nodesWithCoords.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Node dengan Koordinat GPS</p>
              </div>
            ) : (
              <LeafletMap
                nodes={nodesWithCoords}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                followRoads={followRoads}
                onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
              />
            )}
          </div>

          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors duration-300">
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="grid grid-cols-12 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <div className="col-span-3">Node</div>
              <div className="col-span-2">Tipe / Status</div>
              <div className="col-span-3">Redaman Modem (ODP Only)</div>
              <div className="col-span-2">Koordinat GPS</div>
              <div className="col-span-2 text-right">Kapasitas Port</div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNodes.length === 0 ? (
              <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-xs">Tidak ada node ditemukan</div>
            ) : (
              filteredNodes.map(node => {
                const meta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
                const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
                const isOdp = node.node_type === 'ODP';
                const effectiveBestPower = node.best_rx_power ?? node.optical_power_dbm;
                const optMeta = getOpticalQuality(effectiveBestPower);
                const p = pct(node.used_ports, node.total_ports);
                const hasCoords = node.latitude && node.longitude && parseFloat(node.latitude) !== 0;

                return (
                  <div
                    key={node.id}
                    onClick={() => { setSelectedNode(node); setActiveView('map'); }}
                    className={`grid grid-cols-12 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors items-center ${selectedNode?.id === node.id ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''
                      }`}
                  >
                    <div className="col-span-3 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{node.name}</p>
                    </div>

                    <div className="col-span-2 flex flex-col items-start gap-1">
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded border ${meta.bg}`}>
                        {node.node_type}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="col-span-3">
                      {isOdp ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-extrabold" style={{ color: optMeta.color }}>
                            {node.rx_power_range ? node.rx_power_range : (node.optical_power_dbm != null ? `${node.optical_power_dbm} dBm` : '—')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${optMeta.badge}`}>
                            {optMeta.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">—</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      {hasCoords ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300">
                            {parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStreetViewTarget({ lat: node.latitude, lng: node.longitude, title: node.name });
                            }}
                            className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded font-bold text-[9px]"
                            title="Buka Google Street View 360°"
                          >
                            👁️ SV
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
                          Tanpa GPS
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-right">
                      {node.total_ports > 0 ? (
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {node.used_ports}/{node.total_ports} ({p}%)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

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
