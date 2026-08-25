import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decimalToDms } from '../utils/coordinateParser.js';

/* ══════════════════════════════════════════════════════════════════
   CLEAN & MODERN ENTERPRISE COLOR PALETTE (MATCHING OLT-MANAGEMENT)
══════════════════════════════════════════════════════════════════ */
const TYPE_META = {
  POP: {
    label: 'POP Central',
    bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
    color: '#4f46e5',
    pillBg: '#eef2ff',
    pillText: '#3730a3',
    pillBorder: '#c7d2fe',
    size: 22,
  },
  ODC: {
    label: 'ODC Cabinet',
    bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    color: '#2563eb',
    pillBg: '#eff6ff',
    pillText: '#1d4ed8',
    pillBorder: '#bfdbfe',
    size: 19,
  },
  ODP: {
    label: 'ODP Point',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: '#059669',
    pillBg: '#ecfdf5',
    pillText: '#047857',
    pillBorder: '#a7f3d0',
    size: 16,
  },
};

const STATUS_META = {
  active: {
    label: 'Online',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    color: '#059669',
  },
  maintenance: {
    label: 'Maintenance',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    color: '#d97706',
  },
  inactive: {
    label: 'Down',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    color: '#e11d48',
  },
  damaged: {
    label: 'Loss',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse',
    color: '#e11d48',
  },
};

const getOpticalQuality = (dbm) => {
  if (dbm == null) {
    return {
      label: '—',
      color: '#64748b',
      pillBg: '#f8fafc',
      pillText: '#475569',
      pillBorder: '#e2e8f0',
      badge: 'bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-800'
    };
  }

  const num = parseFloat(dbm);
  if (num >= -24.0) {
    return {
      label: 'Prima (Bagus)',
      color: '#059669',
      lineColor: '#10b981',
      glowColor: 'rgba(16, 185, 129, 0.25)',
      pillBg: '#ecfdf5',
      pillText: '#047857',
      pillBorder: '#a7f3d0',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
    };
  }
  if (num >= -26.0) {
    return {
      label: 'Optimal',
      color: '#0284c7',
      lineColor: '#0ea5e9',
      glowColor: 'rgba(14, 165, 233, 0.25)',
      pillBg: '#f0f9ff',
      pillText: '#0369a1',
      pillBorder: '#bae6fd',
      badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
    };
  }
  if (num >= -27.5) {
    return {
      label: 'Waspada (Tinggi)',
      color: '#d97706',
      lineColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.25)',
      pillBg: '#fffbeb',
      pillText: '#b45309',
      pillBorder: '#fde68a',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    };
  }
  return {
    label: 'Loss / Kritis',
    color: '#e11d48',
    lineColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    pillBg: '#fff1f2',
    pillText: '#be123c',
    pillBorder: '#fecdd3',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
  };
};

/* ══════════════════════════════════════════════════════════════════
   STREET VIEW 360 MODAL
══════════════════════════════════════════════════════════════════ */
function StreetViewModal({ lat, lng, title, onClose }) {
  if (!lat || !lng) return null;
  const embedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`;
  const directUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>Google Street View 360°</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">{title || `Koordinat: ${lat}, ${lng}`}</p>
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
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white font-bold transition-all"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-[440px] bg-slate-950 relative">
          <iframe
            title="Street View 360"
            src={embedUrl}
            className="w-full h-full min-h-[440px] border-0"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   NODE DETAIL DRAWER / POPUP MODAL
══════════════════════════════════════════════════════════════════ */
function NodeDetailPanel({ node, onClose, onOpenStreetView }) {
  if (!node) return null;

  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
  const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
  const isLoss = node.status === 'damaged' || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')));
  const optMeta = isLoss 
    ? { label: 'Loss / Kritis', color: '#e11d48', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' }
    : getOpticalQuality(effectivePower);
  const p = node.total_ports > 0 ? Math.round((node.used_ports / node.total_ports) * 100) : 0;

  const [copied, setCopied] = useState(false);
  const dmsInfo = useMemo(() => {
    if (!node.latitude || !node.longitude) return { formattedDms: '' };
    return decimalToDms(node.latitude, node.longitude);
  }, [node.latitude, node.longitude]);

  const handleCopyCoords = () => {
    if (node.latitude && node.longitude) {
      navigator.clipboard.writeText(`${node.latitude}, ${node.longitude}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-[999] w-84 sm:w-96 bg-white/95 dark:bg-black/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-800 p-5 transition-all text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${typeMeta.bg}`}>
              {node.node_type}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
              {statusMeta.label}
            </span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
            {node.name}
          </h4>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{node.code}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all text-xs font-bold"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* Optical Telemetry Signal Box */}
        {node.node_type === 'ODP' && (
          <div className="p-3.5 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Telemetry Redaman Rx</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${optMeta.badge}`}>
                {optMeta.label}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono" style={{ color: optMeta.color }}>
                {node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${effectivePower} dBm` : '—')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {node.used_ports} Klien Terhubung
              </span>
            </div>
          </div>
        )}

        {/* GPS Coordinates & Google Earth / Maps Navigation */}
        <div className="space-y-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Posisi Geografis GPS
          </span>
          {node.latitude && node.longitude ? (
            <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Koordinat Desimal:
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="px-2.5 py-0.5 text-[10px] font-bold bg-white dark:bg-black border border-slate-200 dark:border-neutral-700 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all text-slate-700 dark:text-slate-300"
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

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-neutral-800">
                <button
                  onClick={() => onOpenStreetView(node.latitude, node.longitude, node.name)}
                  className="py-2 px-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center col-span-3 sm:col-span-1 shadow-2xs"
                >
                  <span>👁️ Street View</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
                >
                  <span>🗺️ Google Maps</span>
                </a>
                <a
                  href={`https://earth.google.com/web/search/${node.latitude},${node.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-center shadow-2xs"
                >
                  <span>🌍 Earth</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
              Belum ada koordinat GPS terdaftar.
            </div>
          )}
        </div>

        <div className="space-y-3">
          {node.total_ports > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-100 dark:border-neutral-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Kapasitas Port</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{node.used_ports}/{node.total_ports} Port ({p}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p > 90 ? 'bg-rose-600' : p > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-100 dark:border-neutral-800 text-slate-700 dark:text-slate-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">OLT &amp; Port Uplink</span>
            <p className="font-bold">{node.olt_device?.name || node.parent_node?.olt_device?.name || 'OLT Region'}</p>
            <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{node.olt_port_ref || 'PON 1/1/1'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FAST INTERACTIVE LEAFLET TOPOLOGY MAP WITH REFINED FLOW ANIMATION
══════════════════════════════════════════════════════════════════ */
function LeafletMap({ nodes, selectedNode, onSelectNode, onOpenStreetView }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersGroupRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);

  // 1. Initialize Map Instance with SVG Renderer
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

      if (!mapInstanceRef.current && mapRef.current) {
        const defaultCenter = [-0.785, 100.654];

        const map = Lf.map(mapRef.current, {
          center: defaultCenter,
          zoom: 15,
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
        }, 500);
      }
    }).catch(err => console.warn('Leaflet load failed:', err));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Toggle Satelit Hybrid vs Vektor
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
        subdomains: ['0', '1', '2', '3'],
      });
    } else {
      tileLayerRef.current = Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      });
    }
    tileLayerRef.current.addTo(map);
    map.invalidateSize();
  };

  // 3. Recenter to all nodes
  const handleRecenterMap = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const validNodes = nodes.filter(n => n.latitude && n.longitude && parseFloat(n.latitude) !== 0);
    if (validNodes.length === 0) return;

    const bounds = validNodes.map(n => [parseFloat(n.latitude), parseFloat(n.longitude)]);
    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 16);
    } else {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [nodes]);

  // 4. Synchronously Render Markers & Animated Fiber Lines via LayerGroup
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leafletRef.current || !layersGroupRef.current) return;
    const Lf = leafletRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;

    layerGroup.clearLayers();

    const nodeMap = new Map();
    nodes.forEach(n => {
      if (n.latitude && n.longitude && parseFloat(n.latitude) !== 0) {
        nodeMap.set(n.id, n);
      }
    });

    const bounds = [];

    // Draw Modern Animated Fiber Lines between Parent & Child
    nodes.forEach(node => {
      if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) return;

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
        let lineColor = '#2563eb'; // Clean Royal Blue for Feeder Backbone
        let glowColor = 'rgba(37, 99, 235, 0.22)';

        if (isOdpLine) {
          const bestPower = node.best_rx_power != null 
            ? parseFloat(node.best_rx_power) 
            : (node.optical_power_dbm != null ? parseFloat(node.optical_power_dbm) : null);

          const isLossLine = node.status === 'damaged' 
            || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')))
            || (bestPower != null && bestPower <= -27.5);

          if (isLossLine) {
            lineColor = '#e11d48'; // Clean Rose Red
            glowColor = 'rgba(225, 29, 72, 0.28)';
          } else if (bestPower != null && bestPower <= -25.9) {
            lineColor = '#d97706'; // Clean Amber
            glowColor = 'rgba(217, 119, 6, 0.25)';
          } else if (bestPower != null && bestPower <= -23.9) {
            lineColor = '#0284c7'; // Clean Sky Azure
            glowColor = 'rgba(2, 132, 199, 0.25)';
          } else if (bestPower != null && bestPower > -23.9) {
            lineColor = '#059669'; // Clean Mint Emerald
            glowColor = 'rgba(5, 150, 105, 0.25)';
          } else {
            lineColor = '#10b981';
            glowColor = 'rgba(16, 185, 129, 0.22)';
          }
        }

        const lineCoords = [[pLat, pLng], [nLat, nLng]];

        // 1. Ambient Background Halo Line
        Lf.polyline(lineCoords, {
          color: glowColor,
          weight: isOdpLine ? 6 : 8,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(layerGroup);

        // 2. Core Clean Animated Flow Line
        Lf.polyline(lineCoords, {
          color: lineColor,
          weight: isOdpLine ? 3.5 : 4.5,
          opacity: 1,
          dashArray: '12, 10',
          className: 'animated-fiber-laser-flow',
        }).addTo(layerGroup);
      }
    });

    // Draw Modern Clean Node Markers
    nodes.forEach(node => {
      if (!node.latitude || !node.longitude || parseFloat(node.latitude) === 0) return;

      const lat = parseFloat(node.latitude);
      const lng = parseFloat(node.longitude);
      bounds.push([lat, lng]);

      const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
      const isSelected = selectedNode?.id === node.id;
      const isOdp = node.node_type === 'ODP';
      const effectiveBestPower = node.best_rx_power ?? node.optical_power_dbm;
      const isLossRange = node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS'));
      const optMeta = isLossRange 
        ? { label: 'Loss / Kritis', color: '#e11d48', pillBg: '#fff1f2', pillText: '#be123c', pillBorder: '#fecdd3' } 
        : getOpticalQuality(effectiveBestPower);
      const opticalDbmText = node.rx_power_range ? node.rx_power_range : (effectiveBestPower != null ? `${effectivePower > 0 ? '+' : ''}${effectiveBestPower} dBm` : '—');

      const size = isSelected ? typeMeta.size + 4 : typeMeta.size;

      let pinBg = '#059669'; // Clean Mint Emerald
      if (node.node_type === 'POP') {
        pinBg = '#4f46e5'; // Clean Indigo
      } else if (node.node_type === 'ODC') {
        pinBg = '#2563eb'; // Clean Royal Blue
      }

      if (isLossRange || node.status === 'damaged') {
        pinBg = '#e11d48'; // Clean Rose Red
      }

      const icon = Lf.divIcon({
        className: `custom-gis-node-marker ${isSelected ? 'is-selected' : ''}`,
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            ${(isOdp && node.used_ports > 0 && (node.optical_power_dbm != null || node.rx_power_range != null)) ? `
              <div style="
                background: ${optMeta.pillBg};
                color: ${optMeta.pillText};
                border: 1.5px solid ${optMeta.pillBorder};
                font-weight: 800;
                font-size: 11px;
                padding: 2.5px 9px;
                border-radius: 9999px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.18);
                white-space: nowrap;
                margin-bottom: 4px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                letter-spacing: -0.2px;
              ">
                ${opticalDbmText}
              </div>
            ` : ''}
            <div style="
              width: ${size * 2}px;
              height: ${size * 2}px;
              border-radius: 50%;
              background: ${pinBg};
              border: 3px solid #ffffff;
              box-shadow: 0 3px 10px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: ${size >= 20 ? '12px' : size >= 17 ? '11px' : '10px'};
              letter-spacing: -0.2px;
            ">
              ${node.node_type}
            </div>
            <div style="
              background: #ffffff;
              color: #0f172a;
              padding: 2.5px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              margin-top: 3.5px;
              border: 1.5px solid #cbd5e1;
              box-shadow: 0 2px 6px rgba(0,0,0,0.16);
            ">
              ${node.name}
            </div>
          </div>
        `,
        iconSize: [180, size * 2 + 55],
        iconAnchor: [90, size * 2 + 30],
      });

      const marker = Lf.marker([lat, lng], { icon }).addTo(layerGroup);
      marker.on('click', () => onSelectNode(node));
    });

    if (bounds.length > 0) {
      map.invalidateSize();
      if (isFirstRenderRef.current) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 16);
        } else {
          try {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          } catch { }
        }
        isFirstRenderRef.current = false;
      }
    }
  }, [mapLoaded, nodes, selectedNode, onSelectNode]);

  return (
    <div className="relative w-full h-full">
      {/* CSS Animation for Smooth Fiber Flow */}
      <style>{`
        @keyframes fiberFlowAnimation {
          0% {
            stroke-dashoffset: 44;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .animated-fiber-laser-flow,
        .leaflet-overlay-pane svg path.animated-fiber-laser-flow {
          stroke-dasharray: 12 10 !important;
          animation: fiberFlowAnimation 1.1s linear infinite !important;
        }
      `}</style>

      <div
        ref={mapRef}
        className="w-full rounded-2xl overflow-hidden shadow-inner relative z-0"
        style={{ height: '620px', minHeight: '620px' }}
      />

      {/* Floating Mode Controls */}
      <div className="absolute top-4 right-4 z-[999] flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={toggleMapMode}
          className="px-3.5 py-2 bg-white/95 dark:bg-neutral-900/95 hover:bg-white text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 shadow-md backdrop-blur-md transition-all flex items-center gap-1.5"
        >
          <span>{isSatellite ? '🗺️ Mode Peta Vektor' : '🛰️ Mode Satelit High-Res'}</span>
        </button>

        {selectedNode && selectedNode.latitude && selectedNode.longitude && (
          <button
            onClick={() => onOpenStreetView(selectedNode.latitude, selectedNode.longitude, selectedNode.name)}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <span>👁️ Street View 360°</span>
          </button>
        )}
      </div>

      <button
        onClick={handleRecenterMap}
        className="absolute bottom-4 left-4 z-[999] px-3.5 py-2 bg-white/95 dark:bg-neutral-900/95 hover:bg-white text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-neutral-700 shadow-md backdrop-blur-md flex items-center gap-1.5 transition-all"
        title="Pusatkan Peta ke Lokasi Node"
      >
        <span>Fokus Lokasi Node</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS CARDS BAR (CLEAN OLT-MANAGEMENT STYLE)
══════════════════════════════════════════════════════════════════ */
function GisStatCards({ nodes }) {
  const pops = nodes.filter(n => n.node_type === 'POP');
  const odcs = nodes.filter(n => n.node_type === 'ODC');
  const odps = nodes.filter(n => n.node_type === 'ODP');

  const activeOdps = odps.filter(n => n.used_ports > 0 && n.optical_power_dbm != null);
  const odpOptValues = activeOdps.map(n => parseFloat(n.optical_power_dbm));
  const avgOdpDbm = odpOptValues.length > 0 ? (odpOptValues.reduce((a, b) => a + b, 0) / odpOptValues.length).toFixed(1) : '—';

  const cards = [
    { label: 'POP Central', value: pops.length, sub: `${pops.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Core Headend', badgeCls: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' },
    { label: 'ODC Cabinet', value: odcs.length, sub: `${odcs.filter(n => n.status === 'active').length} Aktif Normal`, badge: 'Distribution', badgeCls: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
    { label: 'ODP Point', value: odps.length, sub: `${odps.filter(n => n.status === 'active').length} Total Point ODP`, badge: 'Access Terminal', badgeCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    { label: 'Rerata Redaman ODP', value: avgOdpDbm !== '—' ? `${avgOdpDbm} dBm` : '— dBm', sub: `${activeOdps.length} ODP Ada Pelanggan`, badge: 'Modem ONU', badgeCls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 stagger-enter">
      {cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-2xs p-4 transition-colors duration-300">
          <div className="flex justify-between items-start mb-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{c.value}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeCls}`}>
              {c.badge}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{c.label}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">{c.sub}</p>
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
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-sans">
              Peta Topologi GIS Spasial (POP-ODC-ODP)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoring transmisi optik, rute feeder FO, dan sebaran ODP secara real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeView === 'map'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
          >
            Peta GIS Interaktif
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeView === 'list'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
              }`}
          >
            Tabel Telemetry Redaman
          </button>
        </div>
      </div>

      <GisStatCards nodes={allNodes} />

      {/* Main Controls Filter Bar */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-4 rounded-2xl shadow-2xs transition-colors duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama node, kode, lokasi..."
            className="px-3.5 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Tipe Node</option>
            <option value="POP">POP Central</option>
            <option value="ODC">ODC Cabinet</option>
            <option value="ODP">ODP Point</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={() => setLivePolling(!livePolling)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${livePolling
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${livePolling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{livePolling ? 'Telemetry Live' : 'Telemetry Paused'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-neutral-800 p-12 text-center text-slate-400 dark:text-slate-500 text-xs animate-pulse">
          Memuat topologi spasial GIS &amp; data redaman...
        </div>
      ) : activeView === 'map' ? (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xs overflow-hidden relative transition-colors duration-300 min-h-[620px]">
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
          />

          <LeafletMap
            nodes={nodesWithCoords}
            selectedNode={selectedNode}
            onSelectNode={node => setSelectedNode(node)}
            onOpenStreetView={(lat, lng, title) => setStreetViewTarget({ lat, lng, title })}
          />
        </div>
      ) : (
        /* Tabel Telemetry Redaman */
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xs overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Node &amp; Kode</th>
                  <th className="px-4 py-3.5">Tipe</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Port Terpakai</th>
                  <th className="px-4 py-3.5">Kualitas Redaman (Rx)</th>
                  <th className="px-4 py-3.5">Koordinat GPS</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-900 text-xs">
                {filteredNodes.map(node => {
                  const typeMeta = TYPE_META[node.node_type] ?? TYPE_META.ODC;
                  const statusMeta = STATUS_META[node.status] ?? STATUS_META.active;
                  const effectivePower = node.best_rx_power ?? node.optical_power_dbm;
                  const isLoss = node.status === 'damaged' || (node.rx_power_range && (node.rx_power_range.includes('Loss') || node.rx_power_range.includes('LOS')));
                  const optMeta = isLoss 
                    ? { label: 'Loss / Kritis', color: '#e11d48', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' }
                    : getOpticalQuality(effectivePower);

                  return (
                    <tr key={node.id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{node.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{node.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${typeMeta.bg}`}>
                          {node.node_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {node.total_ports > 0 ? `${node.used_ports}/${node.total_ports} Port` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {node.node_type === 'ODP' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold" style={{ color: optMeta.color }}>
                              {node.rx_power_range ? node.rx_power_range : (effectivePower != null ? `${effectivePower} dBm` : '—')}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${optMeta.badge}`}>
                              {optMeta.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">Headend/Distribution</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {node.latitude && node.longitude ? (
                          <span>{parseFloat(node.latitude).toFixed(5)}, {parseFloat(node.longitude).toFixed(5)}</span>
                        ) : (
                          <span className="text-slate-400 italic">Belum diset</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedNode(node);
                            setActiveView('map');
                          }}
                          className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-200 dark:border-blue-800"
                        >
                          Lihat Peta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
