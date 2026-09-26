import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../components/ThemeContext.jsx';
import { useAuth } from '../components/AuthContext.jsx';
import RefreshButton from '../components/RefreshButton.jsx';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.role === 'Super Administrator';

  // Live Date Time State
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

      const dayName = days[now.getDay()];
      const dayDate = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      setCurrentDateTime(`Hari ini ${dayName}, ${dayDate} ${monthName} ${year} ${hours}.${minutes}.${seconds} WIB`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Data States
  const [metrics, setMetrics] = useState(null);
  const [stats, setStats] = useState(null);
  const [olts, setOlts] = useState([]);
  const [activeAlertFilter, setActiveAlertFilter] = useState('all');

  // Mini GIS Map References & Controls
  const [mapTileType, setMapTileType] = useState('hybrid'); // 'hybrid' | 'osm'
  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const tileLayerRef = useRef(null);
  const cablesLayerGroupRef = useRef(null);
  const nodesLayerGroupRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const latestBoundsRef = useRef([]);

  // Fetch Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [resMetrics, resStats, resOlts] = await Promise.allSettled([
        fetch('/api/dashboard/metrics').then(r => r.json()),
        fetch('/api/network-nodes/stats').then(r => r.json()),
        fetch('/api/olts').then(r => r.json())
      ]);

      if (resMetrics.status === 'fulfilled' && resMetrics.value?.data) {
        setMetrics(resMetrics.value.data);
      }
      if (resStats.status === 'fulfilled' && resStats.value) {
        setStats(resStats.value);
      }
      if (resOlts.status === 'fulfilled') {
        const oltData = Array.isArray(resOlts.value) ? resOlts.value : resOlts.value?.data ?? [];
        setOlts(oltData);
      }
    } catch {
      // Fallback handled smoothly
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Hook for silent auto refresh (real-time telemetry & alerts every 5 seconds)
  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchDashboardData, {
    enablePolling: true,
    intervalMs: 5000,
  });

  // Aggregated Real-Time KPI Stats
  const totalPop = metrics?.overview?.total_pop ?? stats?.by_type?.POP ?? 0;
  const totalOdc = metrics?.overview?.total_odc ?? stats?.by_type?.ODC ?? 0;
  const totalOdp = metrics?.overview?.total_odp ?? stats?.by_type?.ODP ?? 0;
  const totalCores = metrics?.overview?.total_cores ?? 0;
  const usedCores = metrics?.overview?.used_cores ?? 0;
  const coreUtilization = metrics?.overview?.core_utilization ?? (totalCores > 0 ? Math.round((usedCores / totalCores) * 100) : 0);
  const totalOlts = metrics?.overview?.total_olts ?? olts.length ?? 0;
  const activeTicketsCount = metrics?.overview?.active_tickets ?? 0;
  const criticalTicketsCount = metrics?.overview?.critical_tickets ?? 0;
  const inProgressTicketsCount = metrics?.overview?.in_progress_tickets ?? 0;

  // 1. Customer & ODP Port Stats
  const customerStats = metrics?.customer_stats ?? {
    total_customers: 0,
    active_customers: 0,
    isolated_customers: 0,
    suspended_customers: 0,
    terminated_customers: 0,
    active_percentage: 100,
  };

  const odpPortStats = metrics?.odp_port_stats ?? {
    total_ports: 0,
    used_ports: 0,
    available_ports: 0,
    utilization_pct: 0,
  };

  const onuHealth = metrics?.onu_health ?? {
    total_registered: 0,
    online_count: 0,
    offline_count: 0,
    online_rate: 100,
  };

  // 2. Optical Signal Power Distribution Chart
  const rxPowerData = useMemo(() => {
    const rx = metrics?.rx_power;
    return {
      labels: [
        'Sangat Baik (> -19 dBm)',
        'Normal (-19~-24 dBm)',
        'Warning (-24~-27 dBm)',
        'Kritis (< -27 dBm)',
        'LOS / Offline'
      ],
      datasets: [
        {
          label: 'Jumlah Modem / ODP',
          data: [
            rx?.sangat_baik ?? 0,
            rx?.normal ?? 0,
            rx?.warning ?? 0,
            rx?.kritis ?? 0,
            rx?.los ?? 0
          ],
          backgroundColor: [
            '#10b981', // Sangat Baik (Emerald)
            '#06b6d4', // Normal (Cyan / Teal)
            '#f59e0b', // Warning (Amber)
            '#f97316', // Kritis (Orange)
            '#ef4444'  // LOS / Offline (Rose / Red)
          ],
          borderRadius: 4,
          borderWidth: 0,
        }
      ]
    };
  }, [metrics]);

  const avgPowerDbm = metrics?.rx_power?.avg_power ?? null;

  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { padding: 10, cornerRadius: 6 }
    },
    scales: {
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
        ticks: { color: isDark ? '#ffffff' : '#000000', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#ffffff' : '#000000', font: { size: 10 } }
      }
    }
  }), [isDark]);

  // 3. Weekly Incident & MTTR Trend Chart
  const weeklyTrendData = useMemo(() => {
    const trend = metrics?.weekly_incident_trend ?? {
      dates: ['19 Agu', '20 Agu', '21 Agu', '22 Agu', '23 Agu', '24 Agu', '25 Agu'],
      new_incidents: [0, 0, 0, 0, 0, 0, 0],
      resolved_incidents: [0, 0, 0, 0, 0, 0, 0],
      avg_mttr_minutes: [0, 0, 0, 0, 0, 0, 0],
    };

    return {
      labels: trend.dates,
      datasets: [
        {
          type: 'line',
          label: 'Rata-Rata Waktu MTTR (Menit)',
          data: trend.avg_mttr_minutes,
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
          fill: true,
          tension: 0.3,
          yAxisID: 'y1',
        },
        {
          type: 'bar',
          label: 'Insiden Baru',
          data: trend.new_incidents,
          backgroundColor: '#f43f5e',
          borderRadius: 4,
          borderWidth: 0,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Tiket Diselesaikan',
          data: trend.resolved_incidents,
          backgroundColor: '#10b981',
          borderRadius: 4,
          borderWidth: 0,
          yAxisID: 'y',
        }
      ]
    };
  }, [metrics]);

  const weeklyTrendOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? '#ffffff' : '#000000',
          font: { size: 10, weight: 'bold' },
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: { padding: 10, cornerRadius: 6 }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
        ticks: { color: isDark ? '#ffffff' : '#000000', font: { size: 10 }, stepSize: 1 }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: isDark ? '#ffffff' : '#000000', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#ffffff' : '#000000', font: { size: 10 } }
      }
    }
  }), [isDark]);

  // 4. Helper to Render / Update GIS Layers In-Place
  const renderGisLayers = useCallback((gisData, isInitial = false) => {
    const map = miniMapInstanceRef.current;
    const Lf = leafletRef.current;
    if (!map || !Lf || !cablesLayerGroupRef.current || !nodesLayerGroupRef.current) return;

    cablesLayerGroupRef.current.clearLayers();
    nodesLayerGroupRef.current.clearLayers();

    const rawNodes = gisData?.nodes;
    const nodes = Array.isArray(rawNodes) ? rawNodes : (rawNodes && typeof rawNodes === 'object' ? Object.values(rawNodes) : []);
    const rawCables = gisData?.cables;
    const cables = Array.isArray(rawCables) ? rawCables : (rawCables && typeof rawCables === 'object' ? Object.values(rawCables) : []);
    const markerBounds = [];

    // Render Cable Polyline
    cables.forEach(c => {
      try {
        const rawCoords = c.route_coordinates || c.coordinates;
        const coords = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : rawCoords;
        if (Array.isArray(coords) && coords.length >= 2) {
          const latLngs = coords.map(pt => [pt.lat || pt[0], pt.lng || pt[1]]);
          const isDamaged = c.status === 'damaged' || c.status === 'offline';
          Lf.polyline(latLngs, {
            color: isDamaged ? '#ef4444' : '#10b981',
            weight: 3.5,
            opacity: 0.9,
            dashArray: isDamaged ? '8, 6' : '12, 6',
          }).addTo(cablesLayerGroupRef.current);

          coords.forEach(pt => {
            const pLat = parseFloat(pt.lat || pt[0]);
            const pLng = parseFloat(pt.lng || pt[1]);
            if (!isNaN(pLat) && !isNaN(pLng)) {
              markerBounds.push([pLat, pLng]);
            }
          });
        }
      } catch {
        // ignore parsing error
      }
    });

    // Render Nodes Markers with Live Optical Power & Status
    nodes.forEach(n => {
      const lat = parseFloat(n.latitude);
      const lng = parseFloat(n.longitude);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      markerBounds.push([lat, lng]);

      let color = '#10b981'; // Green ODP
      let radius = 6.5;
      if (n.node_type === 'POP') {
        color = '#6366f1'; // Indigo POP
        radius = 9.5;
      } else if (n.node_type === 'ODC') {
        color = '#06b6d4'; // Cyan ODC
        radius = 8;
      }

      const isOff = n.status === 'damaged' || n.status === 'offline';
      if (isOff) {
        color = '#ef4444'; // Red if down / loss
      }

      const circle = Lf.circleMarker([lat, lng], {
        radius: isOff ? radius + 2.5 : radius,
        fillColor: color,
        color: isOff ? '#fca5a5' : '#ffffff',
        weight: isOff ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(nodesLayerGroupRef.current);

      const pwrText = n.core_power ? `${parseFloat(n.core_power).toFixed(1)} dBm` : 'Normal';
      circle.bindTooltip(`
        <div style="font-family: sans-serif; min-width: 140px; padding: 2px;">
          <div style="font-weight: 800; font-size: 11px; color: #0f172a;">${n.node_type}: ${n.name}</div>
          <div style="font-size: 10px; font-family: monospace; color: #64748b;">Kode: ${n.code}</div>
          <div style="font-size: 10px; font-weight: 700; color: ${isOff ? '#e11d48' : '#059669'}; margin-top: 2px;">
            ● ${isOff ? 'OFFLINE / LOS' : 'ONLINE'} (${pwrText})
          </div>
          ${n.olt_name ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 1px;">OLT: ${n.olt_name}</div>` : ''}
        </div>
      `, {
        direction: 'top',
        className: 'custom-map-tooltip',
      });
    });

    latestBoundsRef.current = markerBounds;

    if ((isInitial || !hasInitialFitRef.current) && markerBounds.length > 0) {
      map.fitBounds(markerBounds, { padding: [35, 35], maxZoom: 15 });
      hasInitialFitRef.current = true;
    }
  }, []);

  // 4a. Mini GIS Map Leaflet Initialization
  useEffect(() => {
    let map = null;

    import('leaflet').then((L) => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      if (!miniMapContainerRef.current) return;
      if (miniMapInstanceRef.current) return;

      const defaultCenter = [-0.6865, 100.6480];
      map = Lf.map(miniMapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      let tileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      let subdomains = ['0', '1', '2', '3'];
      if (mapTileType === 'osm') {
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        subdomains = ['a', 'b', 'c'];
      }

      tileLayerRef.current = Lf.tileLayer(tileUrl, { maxZoom: 20, subdomains }).addTo(map);
      Lf.control.zoom({ position: 'bottomright' }).addTo(map);

      cablesLayerGroupRef.current = Lf.layerGroup().addTo(map);
      nodesLayerGroupRef.current = Lf.layerGroup().addTo(map);

      miniMapInstanceRef.current = map;

      map.invalidateSize();
      setTimeout(() => map?.invalidateSize(), 150);
      setTimeout(() => map?.invalidateSize(), 400);

      if (metrics?.gis_preview) {
        renderGisLayers(metrics.gis_preview, true);
      }
    });

    return () => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
        cablesLayerGroupRef.current = null;
        nodesLayerGroupRef.current = null;
        tileLayerRef.current = null;
        hasInitialFitRef.current = false;
      }
    };
  }, []);

  // 4b. Ganti Tile Layer secara mulus
  useEffect(() => {
    if (!miniMapInstanceRef.current || !leafletRef.current) return;
    const Lf = leafletRef.current;
    const map = miniMapInstanceRef.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    let subdomains = ['0', '1', '2', '3'];

    if (mapTileType === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = ['a', 'b', 'c'];
    }

    tileLayerRef.current = Lf.tileLayer(tileUrl, { maxZoom: 20, subdomains }).addTo(map);
  }, [mapTileType]);

  // 4c. Update GIS Layers In-Place saat Auto-Reload
  useEffect(() => {
    if (metrics?.gis_preview && miniMapInstanceRef.current) {
      renderGisLayers(metrics.gis_preview, false);
    }
  }, [metrics?.gis_preview, renderGisLayers]);

  // 5. OLT Hardware Health & Telemetry
  const oltHardwareList = useMemo(() => {
    const raw = metrics?.olt_hardware_health;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    return [];
  }, [metrics]);

  // Regional Infrastructure List per OLT
  const regionalInfraList = useMemo(() => {
    if (metrics?.regional_infrastructure && Array.isArray(metrics.regional_infrastructure)) {
      return metrics.regional_infrastructure;
    }
    return [];
  }, [metrics]);

  // Real-Time Incident Alerts List
  const alertsList = useMemo(() => {
    if (metrics?.recent_alerts && Array.isArray(metrics.recent_alerts)) {
      return metrics.recent_alerts;
    }
    return [];
  }, [metrics]);

  const filteredAlerts = alertsList.filter(a => activeAlertFilter === 'all' || a.severity === activeAlertFilter);

  // Recent Activities List
  const recentActivities = useMemo(() => {
    if (metrics?.recent_activities && Array.isArray(metrics.recent_activities)) {
      return metrics.recent_activities;
    }
    return [];
  }, [metrics]);

  const getInitial = (userName) => {
    if (!userName) return 'SA';
    const clean = userName.replace(/\(.*?\)/g, '').trim();
    const parts = clean.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-5 w-full max-w-full font-sans transition-colors duration-200 text-black dark:text-white">
      {/* ── Top Header Banner with Live Operational Indicator & Date Time ─────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-black/20 dark:border-white/20">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-sm text-black dark:text-white uppercase tracking-wider">
              FIBER-UNMS Monitoring Center
            </span>
            <span className="text-black/30 dark:text-white/30">|</span>
            {currentDateTime && (
              <span className="text-xs text-black/70 dark:text-white/70 font-semibold font-mono">
                {currentDateTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-black/5 dark:bg-white/5 text-black dark:text-white border border-black/20 dark:border-white/20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>SNMP Daemon: <strong className="text-emerald-600 dark:text-emerald-400">AKTIF</strong></span>
          </div>
          <RefreshButton
            onRefresh={triggerRefresh}
            isRefreshing={isRefreshing}
            timeAgoText={timeAgoText}
          />
        </div>
      </div>

      {/* ── SECTION 1: 4 STAT KPI CARDS (PELANGGAN, OLT, INFRASTRUKTUR, TIKET) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 stagger-enter">
        {/* Card 1: TOTAL PELANGGAN */}
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-black/60 dark:text-white/60">
            <span className="text-[11px] font-bold uppercase tracking-wider">PELANGGAN</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400">USER</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white">{customerStats.total_customers}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {customerStats.active_customers} Online ({customerStats.active_percentage}%)
            </span>
          </div>
          <div className="pt-2 border-t border-black/10 dark:border-white/10 text-[11px] text-black/70 dark:text-white/70 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs"></span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{customerStats.active_customers}</span> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs"></span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{customerStats.offline_customers ?? (customerStats.total_customers - customerStats.active_customers)}</span> Offline
            </span>
          </div>
        </div>

        {/* Card 2: PERANGKAT OLT */}
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-black/60 dark:text-white/60">
            <span className="text-[11px] font-bold uppercase tracking-wider">PERANGKAT OLT</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-blue-600 dark:text-blue-400">OLT</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white">{totalOlts}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">100% Online</span>
          </div>
          <p className="text-[10px] text-black/60 dark:text-white/60 truncate pt-2 border-t border-black/10 dark:border-white/10 font-mono">
            SNMP Gateway &amp; Live Telemetry
          </p>
        </div>

        {/* Card 3: INFRASTRUKTUR NODES */}
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-black/60 dark:text-white/60">
            <span className="text-[11px] font-bold uppercase tracking-wider">INFRASTRUKTUR</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-purple-600 dark:text-purple-400">NODES</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white">{totalPop + totalOdc + totalOdp}</span>
            <span className="text-xs sm:text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
              {totalPop} POP · {totalOdc} ODC · {totalOdp} ODP
            </span>
          </div>
          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[10px] font-mono text-black/60 dark:text-white/60">
            <span>Utilisasi Core: <strong className="text-black dark:text-white font-bold">{coreUtilization}%</strong></span>
            <span>{usedCores}/{totalCores || '—'} Core</span>
          </div>
        </div>

        {/* Card 4: TIKET GANGGUAN */}
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-black/60 dark:text-white/60">
            <span className="text-[11px] font-bold uppercase tracking-wider">TIKET &amp; GANGGUAN</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-rose-600 dark:text-rose-400">TICKET</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white">{activeTicketsCount}</span>
            {criticalTicketsCount > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                {criticalTicketsCount} Kritis
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Normal
              </span>
            )}
          </div>
          <p className="text-[10px] text-black/60 dark:text-white/60 truncate pt-2 border-t border-black/10 dark:border-white/10 font-mono">
            {inProgressTicketsCount} Tiket Dalam Penanganan
          </p>
        </div>
      </div>

      {/* ── SECTION 2: SEBARAN INFRASTRUKTUR PER WILAYAH / OLT REGION ─────────────────────── */}
      <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/10 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">
                Sebaran - OLT Region
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400">
                {regionalInfraList.length} Wilayah
              </span>
            </div>
          </div>
          <Link
            to="/network"
            className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/30 dark:border-white/30 hover:bg-black/5 dark:hover:bg-white/10 font-bold text-xs transition-colors shrink-0 cursor-pointer"
          >
            Kelola Seluruh Infrastruktur →
          </Link>
        </div>

        {regionalInfraList.length === 0 ? (
          <div className="text-center py-8 text-xs text-black/50 dark:text-white/50 italic">
            Belum ada data infrastruktur wilayah yang terpetakan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {regionalInfraList.map((region, idx) => {
              const isOnline = ['online', 'active'].includes(String(region.status || '').toLowerCase());
              return (
                <div
                  key={region.olt_id ?? `unmapped_${idx}`}
                  className="bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-lg p-4 flex flex-col justify-between space-y-3.5 hover:border-black/50 dark:hover:border-white/50 transition-all shadow-2xs"
                >
                  {/* Region Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400">
                          {region.code}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                          isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500 shadow-xs'}`}></span>
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-black dark:text-white truncate mt-1">
                        {region.name}
                      </h4>
                      <p className="text-[11px] text-black/60 dark:text-white/60 font-mono mt-0.5 truncate">
                        {region.vendor} · {region.location} {region.ip_address !== '-' ? `(${region.ip_address})` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block font-medium">Total Node</span>
                      <span className="text-xl font-extrabold text-black dark:text-white font-mono">{region.total_nodes}</span>
                    </div>
                  </div>

                  {/* Node Type Breakdown Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-black/10 dark:border-white/10">
                    <div className="bg-white dark:bg-black rounded-md p-2 border border-black/10 dark:border-white/10">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase font-mono">POP</span>
                      <span className="text-sm font-extrabold text-black dark:text-white font-mono">{region.pop_count}</span>
                    </div>
                    <div className="bg-white dark:bg-black rounded-md p-2 border border-black/10 dark:border-white/10">
                      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 block uppercase font-mono">ODC</span>
                      <span className="text-sm font-extrabold text-black dark:text-white font-mono">{region.odc_count}</span>
                    </div>
                    <div className="bg-white dark:bg-black rounded-md p-2 border border-black/10 dark:border-white/10">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase font-mono">ODP</span>
                      <span className="text-sm font-extrabold text-black dark:text-white font-mono">{region.odp_count}</span>
                    </div>
                  </div>

                  {/* Health & Distribution Proportion Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-black/60 dark:text-white/60 font-mono">
                      <span>Kesehatan Operasional</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{region.active_nodes}/{region.total_nodes} Aktif ({region.healthy_pct}%)</span>
                    </div>
                    <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${region.healthy_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Direct Action Links */}
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                    <Link
                      to={region.olt_id ? `/gis-map?olt_id=${region.olt_id}` : '/gis-map'}
                      className="flex-1 py-1.5 px-2 bg-white dark:bg-black hover:bg-black/5 dark:hover:bg-white/10 border border-black/20 dark:border-white/20 rounded-md text-[11px] font-semibold text-center text-black dark:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 text-black/70 dark:text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>Peta Wilayah</span>
                    </Link>
                    <Link
                      to={region.olt_id ? `/network?olt_id=${region.olt_id}` : '/network'}
                      className="flex-1 py-1.5 px-2 bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 rounded-md text-[11px] font-bold text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <span>Detail Node</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: MINI LIVE GIS MAP & OPTICAL SIGNAL POWER DISTRIBUTION ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 Cols): Mini Live GIS Map Preview */}
        <div className="lg:col-span-7 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-black dark:text-white">
                  Peta Sebaran Jaringan
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  {metrics?.gis_preview?.nodes?.length ?? 0} Nodes
                </span>
              </div>
              <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                Visualisasi spasial titik POP, ODC, ODP, dan jalur kabel backbone
              </p>
            </div>
            <Link
              to="/gis-map"
              className="px-3 py-1.5 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/30 dark:border-white/30 hover:bg-black/5 dark:hover:bg-white/10 font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Buka Peta Penuh →
            </Link>
          </div>

          {/* Map Container */}
          <div className="w-full h-64 rounded-lg overflow-hidden border border-black/20 dark:border-white/20 relative">
            <div ref={miniMapContainerRef} className="w-full h-full z-0" />
            
            {/* Layer Switcher & Re-center Buttons */}
            <div className="absolute top-2.5 right-2.5 z-[999] flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (miniMapInstanceRef.current && latestBoundsRef.current?.length > 0) {
                    miniMapInstanceRef.current.fitBounds(latestBoundsRef.current, { padding: [35, 35], maxZoom: 15 });
                  }
                }}
                className="px-2.5 py-1 bg-black/85 hover:bg-black text-white rounded-md text-[10px] font-bold border border-white/30 shadow-md backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Pusatkan tampilan peta ke seluruh node"
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v2m0 12v2m8-8h-2M6 12H4m12 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Pusatkan</span>
              </button>
              <button
                type="button"
                onClick={() => setMapTileType(t => t === 'hybrid' ? 'osm' : 'hybrid')}
                className="px-2.5 py-1 bg-black/85 hover:bg-black text-white rounded-md text-[10px] font-bold border border-white/30 shadow-md backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{mapTileType === 'hybrid' ? 'Mode Satelit' : 'Mode Vektor'}</span>
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-2 left-2 z-[999] bg-white/95 dark:bg-black/95 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-black/20 dark:border-white/20 text-[10px] flex items-center gap-3">
              <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span> POP
              </span>
              <span className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-600"></span> ODC
              </span>
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> ODP
              </span>
              <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span> Loss
              </span>
            </div>
          </div>
        </div>

        {/* Right (5 Cols): Distribusi Sinyal Optical Power ONU */}
        <div className="lg:col-span-5 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-black dark:text-white">
                Distribusi Sinyal Optical Power ONU
              </h3>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Avg: {avgPowerDbm ? `${parseFloat(avgPowerDbm).toFixed(2)} dBm` : '—'}
              </span>
            </div>
            <div className="h-56 w-full">
              <Bar data={rxPowerData} options={barChartOptions} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs text-black/70 dark:text-white/70">
            <span>Rata-Rata Redaman Seluruh ONU</span>
            <span className="font-bold text-black dark:text-white font-mono">
              {avgPowerDbm ? `${parseFloat(avgPowerDbm).toFixed(2)} dBm (Real-Time)` : 'Data Belum Tersedia'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: OLT HARDWARE HEALTH & WEEKLY INCIDENT / MTTR TREND ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (6 Cols): Status Kesehatan Perangkat OLT (CPU, RAM & Suhu SNMP) */}
        <div className="lg:col-span-6 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white">
                  Kesehatan Perangkat OLT (CPU, RAM &amp; Suhu)
                </h3>
                <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                  Telemetri hardware real-time via SNMP Driver
                </p>
              </div>
              <Link
                to="/olt-management"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Detail OLT →
              </Link>
            </div>

            <div className="space-y-3">
              {oltHardwareList.length === 0 ? (
                <div className="text-center py-8 text-xs text-black/50 dark:text-white/50 italic">
                  Belum ada perangkat OLT yang terhubung.
                </div>
              ) : (
                oltHardwareList.map(olt => (
                  <div
                    key={olt.id}
                    className="p-3.5 sm:p-4 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-black dark:text-white">{olt.name}</h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400">
                            {olt.vendor} - {olt.model}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-black/60 dark:text-white/60 mt-0.5">
                          IP: {olt.ip_address} · Uptime: {olt.uptime}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {olt.temperature}°C SFP
                      </span>
                    </div>

                    {/* Hardware Metrics Gauges */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
                      {/* CPU Usage */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-black/70 dark:text-white/70 font-semibold">CPU Usage</span>
                          <span className="font-mono font-bold text-black dark:text-white">{olt.cpu_usage}%</span>
                        </div>
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${olt.cpu_usage > 80 ? 'bg-rose-500' : olt.cpu_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(4, olt.cpu_usage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-black/70 dark:text-white/70 font-semibold">Memory Usage</span>
                          <span className="font-mono font-bold text-black dark:text-white">{olt.memory_usage}%</span>
                        </div>
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${olt.memory_usage > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.max(4, olt.memory_usage)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right (6 Cols): Tren Insiden & Waktu Pemulihan (Weekly SLA & MTTR Trend) */}
        <div className="lg:col-span-6 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white">
                  Tren Insiden &amp; Waktu Pemulihan (7 Hari Terakhir)
                </h3>
                <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                  Statistik tiket gangguan masuk vs diselesaikan beserta MTTR
                </p>
              </div>
              <Link
                to="/tickets"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Daftar Tiket →
              </Link>
            </div>

            <div className="h-56 w-full">
              <Bar data={weeklyTrendData} options={weeklyTrendOptions} />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-black/60 dark:text-white/60 block font-semibold uppercase">Total Tiket 7 Hari</span>
              <span className="font-bold text-black dark:text-white font-mono">
                {metrics?.weekly_incident_trend?.new_incidents?.reduce((a, b) => a + b, 0) ?? 0} Tiket
              </span>
            </div>
            <div>
              <span className="text-[10px] text-black/60 dark:text-white/60 block font-semibold uppercase">Terselesaikan</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {metrics?.weekly_incident_trend?.resolved_incidents?.reduce((a, b) => a + b, 0) ?? 0} Tiket
              </span>
            </div>
            <div>
              <span className="text-[10px] text-black/60 dark:text-white/60 block font-semibold uppercase">Rata-Rata MTTR</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                ~32 Menit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: SERVER HEALTH & MONITORING QUICK SHORTCUT (KHUSUS SUPER ADMINISTRATOR) ── */}
      {isSuperAdmin && (
        <div className="bg-black/5 dark:bg-white/5 border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-black dark:text-white">
                  Monitoring Sumber Daya &amp; Kesehatan Server UNMS
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Realtime Active
                </span>
              </div>
              <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                Pantau grafik real-time penggunaan CPU, RAM, SSD Storage, Bandwidth Rx/Tx, serta status gateway daemon di halaman terdedikasi.
              </p>
            </div>
          </div>

          <Link
            to="/server-monitoring"
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Buka Monitoring Server</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* ── SECTION 5: INCIDENT ALERTS & REAL-TIME AUDIT ACTIVITIES ──────────────────────── */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-5`}>
        {/* Left Column: Peringatan Real-Time & Insiden Log */}
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white">
                  Log Peringatan &amp; Gangguan Real-Time
                </h3>
                <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                  Feed insiden otomatis terhubung dengan sistem tiket
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 p-0.5 rounded-md text-xs">
                <button
                  onClick={() => setActiveAlertFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${activeAlertFilter === 'all'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                    }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setActiveAlertFilter('critical')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${activeAlertFilter === 'critical'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                    }`}
                >
                  Critical
                </button>
                <button
                  onClick={() => setActiveAlertFilter('warning')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${activeAlertFilter === 'warning'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
                    }`}
                >
                  Warning
                </button>
              </div>
            </div>

            {/* List of Alerts */}
            <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-10 text-xs text-black/50 dark:text-white/50 italic">
                  Tidak ada insiden gangguan aktif saat ini.
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const isCrit = alert.severity === 'critical';
                  const isWarn = alert.severity === 'warning';
                  const dotColor = isCrit ? 'bg-rose-500' : (isWarn ? 'bg-amber-500' : 'bg-emerald-500');
                  const badgeCls = isCrit
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : isWarn
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';

                  return (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0 ${isCrit ? 'animate-ping' : ''}`}></span>
                          <span className="font-bold text-xs text-black dark:text-white truncate">
                            {alert.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${badgeCls}`}>
                            {alert.severity || 'WARNING'}
                          </span>
                        </div>
                        <p className="text-[11px] text-black/70 dark:text-white/70 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-black/50 dark:text-white/50 font-mono">
                          <span>Node: {alert.node}</span>
                          <span>•</span>
                          <span>{alert.time}</span>
                          {alert.olt && (
                            <>
                              <span>•</span>
                              <span>{alert.olt}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <Link
                        to="/otdr-tracing"
                        className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-black border border-black/30 dark:border-white/30 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Tracing OTDR
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Aktivitas Pengguna & Sistem Real-Time (Khusus Superadmin) */}
        {isSuperAdmin && (
          <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-black dark:text-white mb-1">
                Aktivitas Pengguna &amp; Sistem Real-Time
              </h3>
              <p className="text-xs text-black/70 dark:text-white/70 mb-3">
                Audit log riwayat mutasi data dan pembaruan infrastruktur jaringan
              </p>

              <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
                {recentActivities.length === 0 ? (
                  <div className="text-center py-10 text-xs text-black/50 dark:text-white/50 italic">
                    Belum ada riwayat aktivitas tercatat.
                  </div>
                ) : (
                  recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 flex items-start gap-2.5"
                    >
                      <div className="w-6 h-6 rounded bg-black/10 dark:bg-white/10 text-black dark:text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {getInitial(act.user)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[11px] text-blue-600 dark:text-blue-400 block truncate">
                          {act.action}
                        </span>
                        <p className="text-[11px] text-black/80 dark:text-white/80 truncate">
                          {act.node}
                        </p>
                        <span className="text-[10px] text-black/50 dark:text-white/50 font-mono block mt-0.5">
                          {act.user} • {act.time}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
