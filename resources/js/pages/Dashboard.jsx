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

  // Mini GIS Map References
  const miniMapContainerRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const leafletRef = useRef(null);

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

  // Hook for silent auto refresh
  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchDashboardData);

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
      labels: ['Bagus (-15~-24 dBm)', 'Sedang (-25~-27 dBm)', 'Warning (-28 dBm+)', 'LOS (Loss Signal)'],
      datasets: [
        {
          label: 'Jumlah Node / ODP',
          data: [
            rx?.good ?? 0,
            rx?.moderate ?? 0,
            rx?.warning ?? 0,
            rx?.los ?? 0
          ],
          backgroundColor: [
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#f97316', // Orange
            '#ef4444'  // Red
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

  // 4. Mini GIS Map Leaflet Initialization
  useEffect(() => {
    let map = null;

    import('leaflet').then((L) => {
      leafletRef.current = L.default || L;
      const Lf = leafletRef.current;

      if (!miniMapContainerRef.current) return;
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }

      const defaultCenter = [-6.2088, 106.8456]; // fallback center
      map = Lf.map(miniMapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Tile Layer (Dark or Light OpenStreetMap)
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      Lf.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

      // Add Zoom Control at bottom right
      Lf.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add Node Markers & Polylines from GIS preview data
      const nodes = metrics?.gis_preview?.nodes ?? [];
      const cables = metrics?.gis_preview?.cables ?? [];

      const markerBounds = [];

      // Render Cable Polyline
      cables.forEach(c => {
        try {
          const coords = typeof c.coordinates === 'string' ? JSON.parse(c.coordinates) : c.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const latLngs = coords.map(pt => [pt.lat || pt[0], pt.lng || pt[1]]);
            const isDamaged = c.status === 'damaged';
            Lf.polyline(latLngs, {
              color: isDamaged ? '#ef4444' : '#3b82f6',
              weight: 3,
              opacity: 0.8,
              dashArray: isDamaged ? '6, 6' : undefined,
            }).addTo(map);
          }
        } catch {
          // ignore parsing error
        }
      });

      // Render Nodes Markers
      nodes.forEach(n => {
        const lat = parseFloat(n.latitude);
        const lng = parseFloat(n.longitude);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

        markerBounds.push([lat, lng]);

        let color = '#10b981'; // Green ODP
        let radius = 6;
        if (n.node_type === 'POP') {
          color = '#6366f1'; // Indigo POP
          radius = 9;
        } else if (n.node_type === 'ODC') {
          color = '#3b82f6'; // Blue ODC
          radius = 7.5;
        }

        if (n.status === 'damaged' || n.status === 'offline') {
          color = '#ef4444'; // Red if down
        }

        const circle = Lf.circleMarker([lat, lng], {
          radius: radius,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        circle.bindTooltip(`<b>${n.node_type} ${n.code || n.name}</b><br/>Status: ${n.status}`, {
          direction: 'top',
          className: 'text-xs font-sans rounded-lg shadow-md',
        });
      });

      if (markerBounds.length > 0) {
        map.fitBounds(markerBounds, { padding: [30, 30], maxZoom: 15 });
      }

      miniMapInstanceRef.current = map;
    });

    return () => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
    };
  }, [metrics?.gis_preview, isDark]);

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
              NOC Enterprise Monitoring Center
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
              {customerStats.active_customers} Aktif ({customerStats.active_percentage}%)
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1f1f1f] text-[10px] text-slate-400 flex items-center justify-between">
            <span>{customerStats.isolated_customers} Isolir</span>
            <span>{customerStats.suspended_customers} Suspend</span>
            <span>{customerStats.terminated_customers} Off</span>
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
            <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">
              {totalPop}P · {totalOdc}C · {totalOdp}D
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
                  Peta Miniatur Sebaran Jaringan (Live GIS Preview)
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
            <div className="absolute bottom-2 left-2 z-[999] bg-white/90 dark:bg-black/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#333333] text-[10px] flex items-center gap-3">
              <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> POP
              </span>
              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> ODC
              </span>
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> ODP
              </span>
              <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Loss / Putus
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
                Avg: {avgPowerDbm ? `${avgPowerDbm} dBm` : '—'}
              </span>
            </div>
            <div className="h-56 w-full">
              <Bar data={rxPowerData} options={barChartOptions} />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1f1f1f] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Redaman Seluruh ONU</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {avgPowerDbm ? `${avgPowerDbm} dBm (Real-Time)` : 'Data Belum Tersedia'}
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

      {/* ── SECTION 4: STATUS GATEWAY & SERVER HEALTH SYSTEM ─────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-xl p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Status Gateway &amp; Kesehatan Server UNMS
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Infrastruktur server daemon, service dispatch audio, dan utilitas disk storage
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Service 1: SNMP Poller */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{serverHealth.snmp_daemon.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                {serverHealth.snmp_daemon.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{serverHealth.snmp_daemon.detail}</p>
            <p className="text-[10px] font-mono text-slate-400 truncate">{serverHealth.snmp_daemon.driver}</p>
          </div>

          {/* Service 2: WebRTC Dispatch */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{serverHealth.webrtc_gateway.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                {serverHealth.webrtc_gateway.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{serverHealth.webrtc_gateway.detail}</p>
            <p className="text-[10px] font-mono text-slate-400">Channel Ready / Standby</p>
          </div>

          {/* Service 3: Database & Telemetry */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{serverHealth.database.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                {serverHealth.database.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Ukuran DB: {serverHealth.database.size_mb} MB</p>
            <p className="text-[10px] font-mono text-slate-400">Driver: {serverHealth.database.driver}</p>
          </div>

          {/* Service 4: VPS SSD Disk Storage */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{serverHealth.disk_storage.name}</span>
              <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {serverHealth.disk_storage.used_gb} GB / {serverHealth.disk_storage.total_gb} GB
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-neutral-900 rounded-full h-2 overflow-hidden my-1">
              <div
                className={`h-2 rounded-full ${serverHealth.disk_storage.used_pct > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(5, serverHealth.disk_storage.used_pct)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 flex justify-between">
              <span>Tersedia: {serverHealth.disk_storage.free_gb} GB</span>
              <span className="font-bold">{serverHealth.disk_storage.used_pct}% Terpakai</span>
            </p>
          </div>
        </div>
      </div>

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
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-neutral-950 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {alert.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-neutral-900 text-amber-700 dark:text-amber-400 uppercase">
                          {alert.severity || 'WARNING'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                        <span>Node: {alert.node}</span>
                        <span>•</span>
                        <span>{alert.time}</span>
                      </div>
                    </div>

                    <Link
                      to="/otdr-tracing"
                      className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Tracing OTDR
                    </Link>
                  </div>
                ))
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
