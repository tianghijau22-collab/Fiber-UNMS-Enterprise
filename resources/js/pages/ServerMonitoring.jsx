import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useTheme } from '../components/ThemeContext.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ServerMonitoring() {
  const { isDark } = useTheme();

  // State data server
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Polling settings
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000); // 3 detik default
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/server-monitoring/metrics', {
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
        },
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();

      if (json.status === 'success' && json.data) {
        setMetrics(json.data);
        setError(null);
        setLastUpdated(new Date());

        // Update historical points untuk chart kontinu
        const newPoint = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu_pct: json.data.cpu?.usage_pct ?? 0,
          ram_pct: json.data.memory?.used_pct ?? 0,
          rx_kbps: json.data.network?.primary_rx_kbps ?? 0,
          tx_kbps: json.data.network?.primary_tx_kbps ?? 0,
          vpn_latency_ms: json.data.vpn?.peer_latency_ms ?? 0,
        };

        setHistory((prev) => {
          const list = prev.length > 0 ? [...prev, newPoint] : (json.data.history || [newPoint]);
          return list.slice(-25); // Simpan 25 titik data terakhir
        });
      }
    } catch (err) {
      console.error('Error fetching server metrics:', err);
      setError(err.message || 'Gagal memuat telemetri server');
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 400);
      }
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchMetrics();
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval]);

  // Styling helper warna Chart
  const chartColors = useMemo(() => ({
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    gridBorder: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipTitle: isDark ? '#ffffff' : '#0f172a',
    tooltipBody: isDark ? '#cbd5e1' : '#334155',
  }), [isDark]);

  // Konfigurasi Chart CPU
  const cpuChartData = useMemo(() => ({
    labels: history.map((h) => h.time),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: history.map((h) => h.cpu_pct),
        borderColor: '#6366f1',
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: '#6366f1',
      },
    ],
  }), [history, isDark]);

  // Konfigurasi Chart RAM
  const ramChartData = useMemo(() => ({
    labels: history.map((h) => h.time),
    datasets: [
      {
        label: 'RAM Usage (%)',
        data: history.map((h) => h.ram_pct),
        borderColor: '#10b981',
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: '#10b981',
      },
    ],
  }), [history, isDark]);

  // Konfigurasi Chart Bandwidth (Rx/Tx)
  const bandwidthChartData = useMemo(() => ({
    labels: history.map((h) => h.time),
    datasets: [
      {
        label: 'Download / Rx (KB/s)',
        data: history.map((h) => h.rx_kbps),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        pointRadius: 2,
      },
      {
        label: 'Upload / Tx (KB/s)',
        data: history.map((h) => h.tx_kbps),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        pointRadius: 2,
      },
    ],
  }), [history]);

  // Konfigurasi Chart Latensi VPN Tunnel
  const vpnLatencyChartData = useMemo(() => ({
    labels: history.map((h) => h.time),
    datasets: [
      {
        label: 'Latensi VPN Peer (ms)',
        data: history.map((h) => h.vpn_latency_ms),
        borderColor: '#8b5cf6',
        backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#8b5cf6',
      },
    ],
  }), [history, isDark]);

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        grid: { color: chartColors.gridBorder },
        ticks: { color: chartColors.textSecondary, font: { size: 10 }, maxRotation: 0 },
      },
      y: {
        min: 0,
        grid: { color: chartColors.gridBorder },
        ticks: { color: chartColors.textSecondary, font: { size: 10 } },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: chartColors.textPrimary, font: { size: 11, weight: 'bold' }, boxWidth: 12 },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      },
    },
  };

  const percentageChartOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        max: 100,
        ticks: {
          color: chartColors.textSecondary,
          font: { size: 10 },
          callback: (val) => `${val}%`,
        },
      },
    },
  };

  const latencyChartOptions = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        ticks: {
          color: chartColors.textSecondary,
          font: { size: 10 },
          callback: (val) => `${val} ms`,
        },
      },
    },
  };

  // Disk Doughnut Data
  const diskDoughnutData = useMemo(() => {
    const used = metrics?.disk?.used_gb ?? 5;
    const free = metrics?.disk?.free_gb ?? 50;
    return {
      labels: ['Terpakai', 'Tersedia'],
      datasets: [
        {
          data: [used, free],
          backgroundColor: [
            (metrics?.disk?.used_pct ?? 0) > 85 ? '#f43f5e' : '#6366f1',
            isDark ? '#1e293b' : '#e2e8f0',
          ],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  }, [metrics, isDark]);

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Menghubungkan ke daemon telemetri server VPS &amp; VPN Tunnel...
        </p>
      </div>
    );
  }

  const cpu = metrics?.cpu || {};
  const mem = metrics?.memory || {};
  const disk = metrics?.disk || {};
  const net = metrics?.network || {};
  const vpn = metrics?.vpn || {};
  const sys = metrics?.system || {};
  const gateway = metrics?.gateway || {};
  const topProcesses = metrics?.top_processes || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ── HEADER & CONTROLS HUD ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
                  Monitoring Server &amp; Resource UNMS
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Host: <strong className="font-mono text-slate-800 dark:text-slate-200">{sys.hostname}</strong> ({sys.os}) • Uptime: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{sys.uptime_human}</strong>
                {lastUpdated && (
                  <span className="ml-2 text-slate-400 dark:text-slate-500">
                    • Terakhir diperbarui: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Polling & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl text-xs">
            <span className="text-slate-600 dark:text-slate-400 pl-1 font-semibold text-[11px]">Auto Refresh:</span>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                autoRefresh
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </button>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg px-2 py-0.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={2000}>2 detik</option>
                <option value={3000}>3 detik</option>
                <option value={5000}>5 detik</option>
                <option value={10000}>10 detik</option>
                <option value={30000}>30 detik</option>
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => fetchMetrics(true)} className="underline font-bold hover:text-rose-900 dark:hover:text-rose-100">Coba Lagi</button>
        </div>
      )}

      {/* ── 5 KARTU STATISTIK UTAMA (CPU, RAM, STORAGE, BANDWIDTH, VPN LATENCY) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* 1. CPU Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CPU Usage</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white font-mono tracking-tight">
                {cpu.usage_pct ?? 0}%
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ({cpu.cores ?? 1} Core)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  (cpu.usage_pct ?? 0) > 80 ? 'bg-rose-500' : (cpu.usage_pct ?? 0) > 50 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.max(5, cpu.usage_pct ?? 0)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Load:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {cpu.load_avg_1m} • {cpu.load_avg_5m}
            </span>
          </div>
        </div>

        {/* 2. RAM Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Memory (RAM)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white font-mono tracking-tight">
                {mem.used_pct ?? 0}%
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {mem.used_gb ?? 0} / {mem.total_gb ?? 0} GB
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  (mem.used_pct ?? 0) > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(5, mem.used_pct ?? 0)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Free: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{mem.free_gb} GB</strong></span>
            <span>Cache: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{mem.cached_gb} GB</strong></span>
          </div>
        </div>

        {/* 3. Disk Storage Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SSD Storage</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white font-mono tracking-tight">
                {disk.used_pct ?? 0}%
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {disk.used_gb ?? 0} / {disk.total_gb ?? 0} GB
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  (disk.used_pct ?? 0) > 85 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.max(5, disk.used_pct ?? 0)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Sisa: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{disk.free_gb} GB</strong></span>
            <span>DB: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{disk.db_size_mb} MB</strong></span>
          </div>
        </div>

        {/* 4. Bandwidth Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Network Traffic</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/40">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </div>
          <div className="my-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <span className="text-cyan-500 font-bold">↓</span> Rx:
              </span>
              <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-400">
                {net.primary_rx_kbps ?? 0} KB/s
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <span className="text-amber-500 font-bold">↑</span> Tx:
              </span>
              <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                {net.primary_tx_kbps ?? 0} KB/s
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>NIC:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {net.interfaces?.map((i) => i.name).join(', ') || 'eth0'}
            </span>
          </div>
        </div>

        {/* 5. VPN Tunnel Latency Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Latensi VPN</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight">
                {vpn.peer_latency_ms ? `${vpn.peer_latency_ms} ms` : '—'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {vpn.status || 'CONNECTED'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{vpn.quality_text || 'Latensi Normal'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Peer: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{vpn.peer_ip}</strong></span>
            <span>Loss: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{vpn.packet_loss_pct ?? 0}%</strong></span>
          </div>
        </div>
      </div>

      {/* ── GRAFIK REALTIME: CPU, RAM, DAN LATENSI VPN TUNNEL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Realtime CPU Line Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Grafik CPU Usage (%)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Utilisasi prosesor ({cpu.cores} Core)
              </p>
            </div>
            <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
              {cpu.usage_pct ?? 0}%
            </span>
          </div>
          <div className="h-60 w-full">
            <Line data={cpuChartData} options={percentageChartOptions} />
          </div>
        </div>

        {/* Realtime RAM Line Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Grafik RAM Usage (%)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Memori {mem.used_gb} GB / {mem.total_gb} GB
              </p>
            </div>
            <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              {mem.used_pct ?? 0}%
            </span>
          </div>
          <div className="h-60 w-full">
            <Line data={ramChartData} options={percentageChartOptions} />
          </div>
        </div>

        {/* Realtime VPN Latency Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                Grafik Latensi VPN Tunnel (ms)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ping ke MikroTik Gateway ({vpn.peer_ip})
              </p>
            </div>
            <span className="font-mono text-xs font-black text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800">
              {vpn.peer_latency_ms ? `${vpn.peer_latency_ms} ms` : '—'}
            </span>
          </div>
          <div className="h-60 w-full">
            <Line data={vpnLatencyChartData} options={latencyChartOptions} />
          </div>
        </div>
      </div>

      {/* ── GRAFIK BANDWIDTH & DETAIL STORAGE DISK ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Realtime Network Traffic Bandwidth Chart (2 Columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                Grafik Real-Time Bandwidth (Rx / Tx KB/s)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kecepatan lalu lintas data masuk (Download) dan keluar (Upload) pada antarmuka jaringan
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono font-bold">
              <span className="text-cyan-600 dark:text-cyan-400">Rx: {net.primary_rx_kbps} KB/s</span>
              <span className="text-amber-600 dark:text-amber-400">Tx: {net.primary_tx_kbps} KB/s</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <Line data={bandwidthChartData} options={baseChartOptions} />
          </div>
        </div>

        {/* Disk Usage Breakdown & Doughnut (1 Column) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Kapasitas Partisi SSD Disk
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Mount point utama <code className="text-slate-800 dark:text-slate-200 font-bold font-mono">/</code>
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <Doughnut
              data={diskDoughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: chartColors.tooltipBg,
                    titleColor: chartColors.tooltipTitle,
                    bodyColor: chartColors.tooltipBody,
                    borderColor: chartColors.tooltipBorder,
                    borderWidth: 1,
                  },
                },
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black font-mono text-slate-950 dark:text-white">
                {disk.used_pct ?? 0}%
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Terpakai</span>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Total Kapasitas:
              </span>
              <span className="font-mono font-bold text-slate-950 dark:text-white">{disk.total_gb} GB</span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Tersedia:
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{disk.free_gb} GB</span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Database Storage:
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{disk.db_size_mb} MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PANEL KHUSUS: DETAIL KESEHATAN & LATENSI VPN TUNNEL KE OLT ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Status &amp; Diagnostik Latensi VPN Tunnel</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Koneksi tunnel Point-to-Point dari VPS ke MikroTik Router &amp; Jalur Routing ke Subnet OLT
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
              vpn.status === 'CONNECTED'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
            }`}>
              Tunnel {vpn.status || 'CONNECTED'} ({vpn.interface || 'ppp0'})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: IP Tunnel Link */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">IP Tunnel (Local ➔ Peer)</span>
            <div className="font-mono text-xs font-black text-slate-950 dark:text-white truncate">
              {vpn.local_ip} ➔ {vpn.peer_ip}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Interface: {vpn.interface} (PPTP/L2TP)</p>
          </div>

          {/* Card 2: Latensi & Jitter */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Latensi RTT &amp; Jitter</span>
            <div className="font-mono text-xs font-black text-purple-600 dark:text-purple-400">
              {vpn.peer_latency_ms ? `${vpn.peer_latency_ms} ms` : '—'} <span className="text-slate-500 dark:text-slate-400 font-normal">(±{vpn.jitter_ms || 0} ms)</span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{vpn.quality_text}</p>
          </div>

          {/* Card 3: Packet Loss */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Packet Loss</span>
            <div className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
              {vpn.packet_loss_pct ?? 0}% Loss
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Koneksi Sangat Stabil</p>
          </div>

          {/* Card 4: Subnet OLT Terhubung */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Subnet OLT Ter-Routing</span>
            <div className="font-mono text-xs font-black text-slate-950 dark:text-white truncate">
              {vpn.routes?.join(', ') || '10.11.0.0/16'}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">via dev {vpn.interface}</p>
          </div>
        </div>

        {/* End-to-End Latency Target OLTs */}
        {vpn.olt_targets && vpn.olt_targets.length > 0 && (
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
              Uji Latensi Langsung ke Setiap Perangkat OLT Terdaftar:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {vpn.olt_targets.map((target) => (
                <div
                  key={target.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-950 dark:text-white">{target.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{target.ip} ({target.vendor})</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                      target.latency_ms !== null && target.latency_ms < 50
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {target.latency_ms !== null ? `${target.latency_ms} ms` : 'Unreachable'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── STATUS GATEWAY & LAYANAN UNMS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Status Gateway &amp; Kesehatan Layanan UNMS
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Status gateway daemon, worker telemetri OLT, audio dispatch WebRTC, dan database engine
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Service 1: SNMP Daemon */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-950 dark:text-white">
                {gateway.snmp_daemon?.name || 'SNMP Poller Gateway'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {gateway.snmp_daemon?.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{gateway.snmp_daemon?.detail}</p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{gateway.snmp_daemon?.driver}</p>
          </div>

          {/* Service 2: WebRTC Gateway */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-950 dark:text-white">
                {gateway.webrtc_gateway?.name || 'WebRTC Audio & Dispatch'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {gateway.webrtc_gateway?.status || 'ONLINE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{gateway.webrtc_gateway?.detail}</p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{gateway.webrtc_gateway?.protocol}</p>
          </div>

          {/* Service 3: Database Engine */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-950 dark:text-white">
                {gateway.database?.name || 'PostgreSQL Engine'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {gateway.database?.status || 'HEALTHY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Latensi Kueri: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{gateway.database?.latency_ms} ms</strong>
            </p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Ukuran Data: {gateway.database?.size_mb} MB</p>
          </div>

          {/* Service 4: Telegram Gateway */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-950 dark:text-white">
                {gateway.telegram_gateway?.name || 'Telegram Gateway'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                {gateway.telegram_gateway?.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{gateway.telegram_gateway?.detail}</p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Dispatch Bot &amp; Group Alarm</p>
          </div>
        </div>
      </div>

      {/* ── TOP PROCESSES & NETWORK INTERFACES TABLE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Processes Table */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Top Proses Konsumsi Server</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar proses sistem dengan utilisasi CPU &amp; RAM tertinggi
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">ps aux --sort=-%cpu</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-2.5">User</th>
                  <th className="pb-2.5">PID</th>
                  <th className="pb-2.5">CPU %</th>
                  <th className="pb-2.5">RAM %</th>
                  <th className="pb-2.5">Waktu</th>
                  <th className="pb-2.5">Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                {topProcesses.map((proc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 text-slate-800 dark:text-slate-200 font-sans font-semibold">{proc.user}</td>
                    <td className="py-2.5 text-indigo-600 dark:text-indigo-400 font-bold">{proc.pid}</td>
                    <td className="py-2.5 text-slate-950 dark:text-white font-bold">{proc.cpu_pct}%</td>
                    <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{proc.mem_pct}%</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400 text-[11px]">{proc.time}</td>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={proc.full_cmd}>
                      {proc.command}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Network Interfaces Detail */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">Daftar Antarmuka Jaringan (NIC)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Statistik akumulasi data dan tipe link jaringan VPS
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {net.interfaces?.map((iface, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs border border-indigo-100 dark:border-indigo-900/40">
                      {iface.name}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-950 dark:text-white flex items-center gap-2">
                        <span>{iface.type}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Packets Rx: {iface.rx_packets?.toLocaleString()} • Tx: {iface.tx_packets?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      ↓ {iface.rx_total_gb > 1 ? `${iface.rx_total_gb} GB` : `${iface.rx_total_mb} MB`}
                    </div>
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      ↑ {iface.tx_total_gb > 1 ? `${iface.tx_total_gb} GB` : `${iface.tx_total_mb} MB`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Kernel: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{sys.kernel}</strong></span>
            <span>PHP: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{sys.php_version}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
