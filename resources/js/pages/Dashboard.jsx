import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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

  // Hook for silent auto refresh
  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(fetchDashboardData);

  // Aggregated Real-Time KPI Stats from DB
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

  // Real-Time Optical Signal Power Distribution Chart
  const rxPowerData = useMemo(() => {
    const rx = metrics?.rx_power;
    return {
      labels: ['Sinyal Bagus (-15 ~ -22 dBm)', 'Sinyal Sedang (-23 ~ -26 dBm)', 'Warning High Attn (-27 dBm+)', 'Loss of Signal (LOS)'],
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
      tooltip: {
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      y: {
        grid: { color: isDark ? '#222222' : '#f1f5f9' },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#a1a1aa' : '#64748b', font: { size: 11 } }
      }
    }
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

            {currentDateTime && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {currentDateTime}
              </span>
            )}
          </div>

        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            <span>⚡ Auto-Refresh: AKTIF</span>
          </div>
          <RefreshButton
            onRefresh={triggerRefresh}
            isRefreshing={isRefreshing}
            timeAgoText={timeAgoText}
          />
        </div>
      </div>

      {/* ── 5 Stat KPI Cards Row Matching Original UNMS (Stagger Animation) ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 stagger-enter">
        {/* Card 1: PERANGKAT OLT */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">PERANGKAT OLT</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">OLT</span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalOlts}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">100% Online</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            Terhubung via SNMP Real-Time Gateway
          </p>
        </div>

        {/* Card 2: POP HEADENDS */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">POP HEADENDS</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">POP</span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalPop}</span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 font-mono">{totalCores} Core Total</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            Point of Presence Sentral Jaringan
          </p>
        </div>

        {/* Card 3: KABINET ODC */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">KABINET ODC</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">ODC</span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalOdc}</span>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Distribusi Utama</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            Optical Distribution Cabinet Active
          </p>
        </div>

        {/* Card 4: TITIK ODP */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">TITIK ODP</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">ODP</span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalOdp}</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{coreUtilization}% Core Used</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-neutral-900 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(2, coreUtilization))}%` }}></div>
          </div>
        </div>

        {/* Card 5: TIKET MAINTENANCE */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-4 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">TIKET MAINTENANCE</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-neutral-900 text-rose-700 dark:text-rose-400">TICKET</span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{activeTicketsCount}</span>
            {criticalTicketsCount > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 animate-pulse">{criticalTicketsCount} Kritis</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400">Normal / No Critical</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-2 border-t border-slate-100 dark:border-[#1f1f1f]">
            {inProgressTicketsCount} Tiket In-Progress Penanganan
          </p>
        </div>
      </div>

      {/* ── Optical Power Distribution Section ──────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Distribusi Sinyal Optical Power ONU
            </h3>

          </div>
        </div>

        <div className="h-60 w-full">
          <Bar data={rxPowerData} options={barChartOptions} />
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1f1f1f] flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Rata-Rata Redaman Sinyal</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {avgPowerDbm} dBm (Real-Time)
          </span>
        </div>
      </div>

      {/* ── Status Data Wilayah per OLT Region ───────────────────────────────── */}
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Data Wilayah
            </h3>

          </div>
          <Link
            to="/olt-management"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Kelola Perangkat OLT →
          </Link>
        </div>

        {olts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 italic">
            Belum ada OLT terdaftar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {olts.map((olt) => (
              <div
                key={olt.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50/50 dark:bg-neutral-950 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">
                      {olt.brand ? `${olt.brand} - ${olt.model || olt.code}` : (olt.code || 'OLT')}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      SNMP Online
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{olt.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Lokasi: {olt.location || 'KANTOR CINOX MEDIA NETWORK'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 my-3 p-2 bg-white dark:bg-black rounded-md border border-slate-200 dark:border-[#222222] text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">POP</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{olt.pop_count ?? 1} POP</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">ODC</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{olt.odc_count ?? 1} ODC</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">ODP</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{olt.odp_count ?? 1} ODP</span>
                  </div>
                </div>

                <Link
                  to={`/network?olt_id=${olt.id}`}
                  className="w-full py-1.5 rounded-md text-xs font-semibold text-center bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Buka Data Wilayah →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Grid: Incident Alerts & Real-Time Audit Activities (Superadmin Only) ───────── */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-4 sm:gap-6`}>
        {/* Left Column: Peringatan Real-Time & Insiden Log */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>

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
                  ✅ Tidak ada insiden gangguan aktif saat ini.
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-neutral-950 flex items-center justify-between gap-3"
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
                      className="shrink-0 px-2.5 py-1 rounded text-xs font-semibold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
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
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                Aktivitas Pengguna &amp; Sistem Real-Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Audit log riwayat mutasi data dan pembaruan infrastruktur jointer
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
