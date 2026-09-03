import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
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

  // 2. Optical Signal Power Distribution Chart (Sesuai Pola Customers & OLT)
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
          borderRadius: 6,
          borderWidth: 0,
        }
      ]
    };
  }, [metrics]);

  const avgPowerDbm = metrics?.rx_power?.avg_power ?? null;

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { padding: 10, cornerRadius: 8 }
    },
    scales: {
      y: {
        grid: { color: isDark ? '#222222' : '#f1f5f9' },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 10 } }
      }
    }
  };

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

  const weeklyTrendOptions = {
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
          color: isDark ? '#d4d4d8' : '#3f3f46',
          font: { size: 10, weight: 'bold' },
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: { padding: 10, cornerRadius: 8 }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: isDark ? '#222222' : '#f1f5f9' },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 10 }, stepSize: 1 }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 10 } }
      }
    }
  };

  // 4. Helper to Render / Update GIS Layers In-Place (Without Recreating Map or Resetting Zoom)
  const renderGisLayers = useCallback((gisData, isInitial = false) => {
    const map = miniMapInstanceRef.current;
    const Lf = leafletRef.current;
    if (!map || !Lf || !cablesLayerGroupRef.current || !nodesLayerGroupRef.current) return;

    // Bersihkan layer kabel & node lama tanpa menghancurkan instance map
    cablesLayerGroupRef.current.clearLayers();
    nodesLayerGroupRef.current.clearLayers();

    const nodes = gisData?.nodes ?? [];
    const cables = gisData?.cables ?? [];
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

    // HANYA fitBounds saat pertama kali dibuka! Saat polling auto-reload, jangan ubah zoom / posisi map user
    if ((isInitial || !hasInitialFitRef.current) && markerBounds.length > 0) {
      map.fitBounds(markerBounds, { padding: [35, 35], maxZoom: 15 });
      hasInitialFitRef.current = true;
    }
  }, []);

  // 4a. Mini GIS Map Leaflet Initialization (HANYA SEKALI SAAT MOUNT)
  useEffect(() => {
    let map = null;

    import('leaflet').then((L) => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      if (!miniMapContainerRef.current) return;
      if (miniMapInstanceRef.current) return; // Peta sudah aktif, jangan recreate!

      const defaultCenter = [-0.6865, 100.6480]; // fallback region center
      map = Lf.map(miniMapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Tile Layer Setup
      let tileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      let subdomains = ['0', '1', '2', '3'];
      if (mapTileType === 'osm') {
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        subdomains = ['a', 'b', 'c'];
      }

      tileLayerRef.current = Lf.tileLayer(tileUrl, { maxZoom: 20, subdomains }).addTo(map);
      Lf.control.zoom({ position: 'bottomright' }).addTo(map);

      // Inisialisasi Layer Groups untuk Polylines dan CircleMarkers
      cablesLayerGroupRef.current = Lf.layerGroup().addTo(map);
      nodesLayerGroupRef.current = Lf.layerGroup().addTo(map);

      miniMapInstanceRef.current = map;

      // Invalidate size saat pertama mount
      map.invalidateSize();
      setTimeout(() => map?.invalidateSize(), 150);
      setTimeout(() => map?.invalidateSize(), 400);

      // Render GIS data jika sudah tersedia
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
  }, []); // Mount sekali saja

  // 4b. Ganti Tile Layer secara mulus tanpa recreate map / reset zoom
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

  // 4c. Update GIS Layers In-Place saat Auto-Reload (Tanpa mengganggu posisi pan & zoom user)
  useEffect(() => {
    if (metrics?.gis_preview && miniMapInstanceRef.current) {
      renderGisLayers(metrics.gis_preview, false);
    }
  }, [metrics?.gis_preview, renderGisLayers]);

  // 5. OLT Hardware Health & Telemetry
  const oltHardwareList = metrics?.olt_hardware_health ?? [];

  // 6. Server & Gateway Health
  const serverHealth = metrics?.server_health ?? {
    snmp_daemon: { name: 'SNMP Poller Gateway', status: 'ACTIVE', detail: 'Daemon Real-Time (5s)', driver: 'HSGQ & Multi-Vendor SNMP' },
    webrtc_gateway: { name: 'WebRTC Dispatch Server', status: 'ONLINE', detail: 'STUN/TURN Protocol' },
    database: { name: 'Database Storage', status: 'HEALTHY', size_mb: 12.5 },
    disk_storage: { name: 'VPS SSD Storage', total_gb: 100, used_gb: 35, free_gb: 65, used_pct: 35 },
  };

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
    <div className="space-y-6 w-full max-w-full font-sans transition-colors duration-200">
      {/* ── Top Header Banner with Live Operational Indicator & Date Time ─────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-[#52525b]">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
              FIBER-UNMS Monitoring Center
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            {currentDateTime && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {currentDateTime}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>SNMP Daemon: AKTIF</span>
          </div>
          <RefreshButton
            onRefresh={triggerRefresh}
            isRefreshing={isRefreshing}
            timeAgoText={timeAgoText}
          />
        </div>
      </div>

      {/* ── SECTION 1: 6 STAT KPI CARDS (PELANGGAN, PORT ODP, ONU, OLT, INFRASTRUKTUR, TIKET) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 stagger-enter">
        {/* Card 1: TOTAL PELANGGAN */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">PELANGGAN</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-neutral-900 text-indigo-700 dark:text-indigo-400">USER</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{customerStats.total_customers}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">
              {customerStats.active_customers} Online ({customerStats.active_percentage}%)
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{customerStats.active_customers}</span> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs"></span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{customerStats.offline_customers ?? (customerStats.total_customers - customerStats.active_customers)}</span> Offline
            </span>
          </div>
        </div>

        {/* Card 2: KAPASITAS PORT ODP */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">PORT ODP</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">ODP</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{odpPortStats.used_ports}</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              {odpPortStats.available_ports} Kosong
            </span>
          </div>
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-[#1f1f1f]">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Utilisasi Kapasitas</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{odpPortStats.utilization_pct}% ({odpPortStats.total_ports} Total)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-neutral-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(3, odpPortStats.utilization_pct))}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 3: KESEHATAN MODEM ONU */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">MODEM ONU</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">ONT</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{onuHealth.online_count}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${onuHealth.offline_count > 0 ? 'bg-rose-100 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 animate-pulse' : 'bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400'}`}>
              {onuHealth.offline_count > 0 ? `${onuHealth.offline_count} Loss Signal` : '100% Online'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] text-[10px] text-slate-400 flex items-center justify-between font-mono">
            <span>Terdaftar: {onuHealth.total_registered} ONU</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{onuHealth.online_rate}% Normal</span>
          </div>
        </div>

        {/* Card 4: PERANGKAT OLT */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">PERANGKAT OLT</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">OLT</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{totalOlts}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">100% Online</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            SNMP Gateway &amp; Live Telemetry
          </p>
        </div>

        {/* Card 5: TOPOLOGI NODES */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">INFRASTRUKTUR</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-neutral-900 text-purple-700 dark:text-purple-400">NODES</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{totalPop + totalOdc + totalOdp}</span>
            <span className="text-xs sm:text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
              POP : {totalPop} - ODC : {totalOdc} · ODP : {totalOdp}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            {coreUtilization}% Core Distribusi Terpakai
          </p>
        </div>

        {/* Card 6: TIKET GANGGUAN */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">TIKET &amp; GANGGUAN</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-neutral-900 text-rose-700 dark:text-rose-400">TICKET</span>
          </div>
          <div className="my-2.5 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{activeTicketsCount}</span>
            {criticalTicketsCount > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 animate-pulse">
                {criticalTicketsCount} Kritis
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">
                Normal
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            {inProgressTicketsCount} Tiket Dalam Penanganan
          </p>
        </div>
      </div>

      {/* ── SECTION 2: MINI LIVE GIS MAP & OPTICAL SIGNAL POWER DISTRIBUTION ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 Cols): Mini Live GIS Map Preview */}
        <div className="lg:col-span-7 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Peta Sebaran Jaringan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {metrics?.gis_preview?.nodes?.length ?? 0} Nodes Terpasang
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualisasi spasial titik POP, ODC, ODP, dan jalur kabel backbone
              </p>
            </div>
            <Link
              to="/gis-map"
              className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-neutral-800 font-bold text-xs transition-colors shrink-0"
            >
              Buka Peta Penuh →
            </Link>
          </div>

          {/* Map Container */}
          <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-[#222222] relative">
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
                className="px-2.5 py-1 bg-slate-900/85 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold border border-slate-700 shadow-md backdrop-blur-xs transition-all flex items-center gap-1 cursor-pointer"
                title="Pusatkan tampilan peta ke seluruh node"
              >
                🎯 Pusatkan
              </button>
              <button
                type="button"
                onClick={() => setMapTileType(t => t === 'hybrid' ? 'osm' : 'hybrid')}
                className="px-2.5 py-1 bg-slate-900/85 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold border border-slate-700 shadow-md backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {mapTileType === 'hybrid' ? '🛰️ Mode Satelit' : '🗺️ Mode Vektor'}
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-2 left-2 z-[999] bg-white/90 dark:bg-black/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#333333] text-[10px] flex items-center gap-3">
              <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> POP
              </span>
              <span className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span> ODC
              </span>
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> ODP
              </span>
              <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Loss / Offline
              </span>
            </div>
          </div>
        </div>

        {/* Right (5 Cols): Distribusi Sinyal Optical Power ONU */}
        <div className="lg:col-span-5 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
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
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1f1f1f] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Redaman Seluruh ONU</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {avgPowerDbm ? `${parseFloat(avgPowerDbm).toFixed(2)} dBm (Real-Time)` : 'Data Belum Tersedia'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: OLT HARDWARE HEALTH & WEEKLY INCIDENT / MTTR TREND ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (6 Cols): Status Kesehatan Perangkat OLT (CPU, RAM & Suhu SNMP) */}
        <div className="lg:col-span-6 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Kesehatan Perangkat OLT (CPU, RAM &amp; Suhu)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Telemetri hardware real-time via SNMP Driver
                </p>
              </div>
              <Link
                to="/olt-management"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Detail OLT →
              </Link>
            </div>

            <div className="space-y-3">
              {oltHardwareList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  Belum ada perangkat OLT yang terhubung.
                </div>
              ) : (
                oltHardwareList.map(olt => (
                  <div
                    key={olt.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{olt.name}</h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">
                            {olt.vendor} - {olt.model}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          IP: {olt.ip_address} · Uptime: {olt.uptime}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {olt.temperature}°C SFP
                      </span>
                    </div>

                    {/* Hardware Metrics Gauges */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-[#1f1f1f]">
                      {/* CPU Usage */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">CPU Usage</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{olt.cpu_usage}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-neutral-900 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${olt.cpu_usage > 80 ? 'bg-rose-500' : olt.cpu_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(4, olt.cpu_usage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Memory Usage</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{olt.memory_usage}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-neutral-900 rounded-full h-2 overflow-hidden">
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
        <div className="lg:col-span-6 bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tren Insiden &amp; Waktu Pemulihan (7 Hari Terakhir)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Statistik tiket gangguan masuk vs diselesaikan beserta MTTR
                </p>
              </div>
              <Link
                to="/tickets"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Daftar Tiket →
              </Link>
            </div>

            <div className="h-56 w-full">
              <Bar data={weeklyTrendData} options={weeklyTrendOptions} />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1f1f1f] grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Total Tiket 7 Hari</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics?.weekly_incident_trend?.new_incidents?.reduce((a, b) => a + b, 0) ?? 0} Tiket
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Terselesaikan</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {metrics?.weekly_incident_trend?.resolved_incidents?.reduce((a, b) => a + b, 0) ?? 0} Tiket
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Rata-Rata MTTR</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                ~32 Menit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: SERVER HEALTH & MONITORING QUICK SHORTCUT (KHUSUS SUPER ADMINISTRATOR) ── */}
      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-indigo-900/10 via-slate-50 to-white dark:from-indigo-950/20 dark:via-neutral-950 dark:to-neutral-900 border border-slate-200 dark:border-[#222222] rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Monitoring Sumber Daya &amp; Kesehatan Server UNMS
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  Realtime Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pantau grafik real-time penggunaan CPU, RAM, SSD Storage, Bandwidth Rx/Tx, serta status gateway daemon di halaman terdedikasi.
              </p>
            </div>
          </div>

          <Link
            to="/server-monitoring"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 shrink-0"
          >
            <span>Buka Monitoring Server</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* ── SECTION 5: INCIDENT ALERTS & REAL-TIME AUDIT ACTIVITIES ──────────────────────── */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-5`}>
        {/* Left Column: Peringatan Real-Time & Insiden Log */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Log Peringatan &amp; Gangguan Real-Time
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Feed insiden otomatis terhubung dengan sistem tiket
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-900 p-0.5 rounded-md text-xs">
                <button
                  onClick={() => setActiveAlertFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${activeAlertFilter === 'all'
                    ? 'bg-white dark:bg-black text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setActiveAlertFilter('critical')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${activeAlertFilter === 'critical'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Critical
                </button>
                <button
                  onClick={() => setActiveAlertFilter('warning')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${activeAlertFilter === 'warning'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Warning
                </button>
              </div>
            </div>

            {/* List of Alerts */}
            <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 italic">
                  Tidak ada insiden gangguan aktif saat ini.
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const isCrit = alert.severity === 'critical';
                  const isWarn = alert.severity === 'warning';
                  const cardBorder = isCrit
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20'
                    : isWarn
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-blue-300 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20';
                  const dotColor = isCrit ? 'bg-rose-500' : (isWarn ? 'bg-amber-500' : 'bg-emerald-500');
                  const badgeCls = isCrit
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                    : isWarn
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800';

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border ${cardBorder} flex items-center justify-between gap-3 transition-all`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0 ${isCrit ? 'animate-ping' : ''}`}></span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {alert.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeCls}`}>
                            {alert.severity || 'WARNING'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
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
                        className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
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
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Aktivitas Pengguna &amp; Sistem Real-Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Audit log riwayat mutasi data dan pembaruan infrastruktur jaringan
              </p>

              <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
                {recentActivities.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 italic">
                    Belum ada riwayat aktivitas tercatat.
                  </div>
                ) : (
                  recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 flex items-start gap-2.5"
                    >
                      <div className="w-6 h-6 rounded bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {getInitial(act.user)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[11px] text-blue-600 dark:text-blue-400 block truncate">
                          {act.action}
                        </span>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {act.node}
                        </p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
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
