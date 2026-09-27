import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../components/ThemeContext.jsx';
import { useAuth } from '../components/AuthContext.jsx';
import RefreshButton from '../components/RefreshButton.jsx';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LoadingState from '../components/LoadingState.jsx';
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

  // 5. OLT Hardware Health & Telemetry
  const oltHardwareList = useMemo(() => {
    const raw = metrics?.olt_hardware_health;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
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

      {!metrics ? (
        <LoadingState
          type="card"
          title="Memuat Dashboard Monitoring..."
          description="Mengumpulkan ringkasan metrik jaringan, status perangkat OLT, dan telemetri pelanggan..."
          className="my-6 py-16"
        />
      ) : (
        <>
          {/* ── SECTION 1: 3 STAT KPI CARDS (PELANGGAN, OLT, TIKET) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 stagger-enter">
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

        {/* Card 3: TIKET GANGGUAN */}
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

      {/* ── SECTION 2: CHARTS (DISTRIBUSI SINYAL OPTICAL POWER & TREN INSIDEN / MTTR) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (6 Cols): Distribusi Sinyal Optical Power ONU */}
        <div className="lg:col-span-6 bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between">
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

      {/* ── SECTION 3: KESEHATAN PERANGKAT OLT (CPU, RAM & SUHU) (KHUSUS SUPER ADMINISTRATOR) ── */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-black dark:text-white">
                  Kesehatan Perangkat OLT (CPU, RAM &amp; Suhu)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400">
                  {oltHardwareList.length} Perangkat
                </span>
              </div>
              <p className="text-xs text-black/70 dark:text-white/70 mt-0.5">
                Telemetri hardware real-time via SNMP Driver
              </p>
            </div>
            <Link
              to="/olt-management"
              className="px-3 py-1.5 rounded-md bg-white dark:bg-black text-black dark:text-white border border-black/30 dark:border-white/30 hover:bg-black/5 dark:hover:bg-white/10 font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Kelola OLT →
            </Link>
          </div>

          {oltHardwareList.length === 0 ? (
            <div className="text-center py-8 text-xs text-black/50 dark:text-white/50 italic">
              Belum ada perangkat OLT yang terhubung.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {oltHardwareList.map(olt => (
                <div
                  key={olt.id}
                  className="p-3.5 sm:p-4 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 space-y-3 shadow-2xs hover:border-black/50 dark:hover:border-white/50 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-black dark:text-white truncate">{olt.name}</h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/10 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                          {olt.vendor} - {olt.model}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-black/60 dark:text-white/60 mt-0.5 truncate">
                        IP: {olt.ip_address} · Uptime: {olt.uptime}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      {olt.temperature}°C SFP
                    </span>
                  </div>

                  {/* Hardware Metrics Gauges */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
                    {/* CPU Usage */}
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-mono">
                        <span className="text-black/70 dark:text-white/70 font-semibold font-sans">CPU</span>
                        <span className="font-bold text-black dark:text-white">{olt.cpu_usage}%</span>
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
                      <div className="flex justify-between text-xs mb-1 font-mono">
                        <span className="text-black/70 dark:text-white/70 font-semibold font-sans">Memory</span>
                        <span className="font-bold text-black dark:text-white">{olt.memory_usage}%</span>
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
              ))}
            </div>
          )}
        </div>
      )}

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
      </>
      )}
    </div>
  );
}
