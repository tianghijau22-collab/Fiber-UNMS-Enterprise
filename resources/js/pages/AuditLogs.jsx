import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../components/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/RefreshButton';

/* ══════════════════════════════════════════════════════════════════
   BADGE HELPERS
══════════════════════════════════════════════════════════════════ */
const getActionBadge = (action) => {
  switch (action) {
    case 'CREATE':
      return <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold rounded-full font-mono">CREATE</span>;
    case 'UPDATE':
      return <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold rounded-full font-mono">UPDATE</span>;
    case 'DELETE':
      return <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold rounded-full font-mono">DELETE</span>;
    case 'OTDR_TRACE':
      return <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold rounded-full font-mono">⚡ OTDR TRACE</span>;
    case 'PROVISIONING':
      return <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold rounded-full font-mono">⚙️ PROVISIONING</span>;
    case 'LOGIN':
      return <span className="px-2.5 py-0.5 bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold rounded-full font-mono">🔑 LOGIN</span>;
    default:
      return <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold rounded-full font-mono">{action}</span>;
  }
};

const getRoleBadge = (role) => {
  switch (role) {
    case 'Super Administrator':
      return <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold rounded">👑 Admin</span>;
    case 'NOC Operator':
    case 'Operator Jaringan':
      return <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold rounded">🖥️ Operator</span>;
    case 'Teknisi Jointer':
      return <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold rounded">🧰 Jointer</span>;
    case 'Customer Service':
      return <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold rounded">🎧 CS</span>;
    default:
      return <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded">{role}</span>;
  }
};

/* ══════════════════════════════════════════════════════════════════
   MODAL DETAIL LOG DIFF & METADATA
══════════════════════════════════════════════════════════════════ */
function LogDetailModal({ log, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[88vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-indigo-400 font-bold">#LOG-{log.id}</span>
              {getActionBadge(log.action)}
            </div>
            <h3 className="text-base font-bold mt-0.5">Detail Log Aktivitas &amp; Metadata Diff</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 font-bold">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div>Deskripsi: <span className="font-bold text-slate-800 dark:text-slate-100">{log.description}</span></div>
            <div>Eksekutor: <span className="font-bold text-slate-800 dark:text-slate-100">{log.user_name}</span> ({log.user_role})</div>
            <div>Modul Terpengaruh: <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.module}</span></div>
            <div>Waktu Kejadian: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{log.created_at}</span></div>
            <div>Alamat IP: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{log.ip_address || '—'}</span></div>
            {log.user_agent && <div className="text-[11px] text-slate-400 font-mono truncate">User Agent: {log.user_agent}</div>}
          </div>

          {log.old_values && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nilai Sebelum Diubah (Old Values)</label>
              <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(log.old_values, null, 2)}
              </pre>
            </div>
          )}

          {log.new_values && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nilai Setelah Diubah (New Values / Payload)</label>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(log.new_values, null, 2)}
              </pre>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl">Tutup</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN AUDIT LOGS COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function AuditLogs() {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'Super Administrator';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = useCallback((p = 1, silent = false) => {
    if (!silent) setLoading(true);
    let url = `/api/audit-logs?page=${p}&`;
    if (!isSuperAdmin && currentUser?.id) {
      url += `user_id=${encodeURIComponent(currentUser.id)}&`;
    }
    if (moduleFilter) url += `module=${encodeURIComponent(moduleFilter)}&`;
    if (actionFilter) url += `action=${encodeURIComponent(actionFilter)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    return fetch(url)
      .then(res => res.json())
      .then(res => {
        if (res.data) setLogs(res.data);
        setPage(res.current_page || 1);
        setLastPage(res.last_page || 1);
        setTotalLogs(res.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [isSuperAdmin, currentUser, moduleFilter, actionFilter, search]);

  useEffect(() => {
    fetchLogs(1, false);
  }, [fetchLogs]);

  const { isRefreshing, triggerRefresh, timeAgoText } = useAutoRefresh(() => fetchLogs(page, true));

  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ["ID", "Waktu", "Eksekutor", "Role", "Aksi", "Modul", "Deskripsi", "IP Address"];
    const rows = logs.map(l => [
      l.id,
      new Date(l.created_at).toLocaleString('id-ID'),
      `"${l.user_name || ''}"`,
      `"${l.user_role || ''}"`,
      l.action,
      `"${l.module || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      l.ip_address || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Logs_${isSuperAdmin ? 'System' : 'Saya'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
            {isSuperAdmin ? 'Audit Logs & Jejak Aktivitas Sistem' : 'Audit Logs Aktivitas Saya'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isSuperAdmin
              ? 'Audit trail real-time pencatatan setiap aksi pengguna, eksekusi OTDR, perubahan kabel, & aktivitas sistem'
              : `Pencatatan riwayat aktivitas & jejak tindakan pengguna (${currentUser?.name || 'User'}) di dalam sistem`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshButton
            isRefreshing={isRefreshing}
            onRefresh={triggerRefresh}
            lastUpdatedText={timeAgoText}
            label="Segarkan Log"
          />
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <span>📥 Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <span>🖨️ Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Record Log Aktivitas</div>
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100 font-mono">{totalLogs}</div>
          <div className="text-xs text-slate-500 font-medium">Tercatat di sistem</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Eksekusi OTDR Tracing</div>
          <div className="text-3xl font-black text-purple-800 dark:text-purple-300 font-mono">{logs.filter(l => l.action === 'OTDR_TRACE').length}</div>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Simulasi &amp; tembak laser</div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-wider">Perubahan Data (CRUD)</div>
          <div className="text-3xl font-black text-indigo-800 dark:text-indigo-300 font-mono">{logs.filter(l => l.action === 'CREATE' || l.action === 'UPDATE' || l.action === 'DELETE').length}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Infrastruktur, tiket, customer</div>
        </div>

        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="text-xs text-sky-700 dark:text-sky-400 font-bold uppercase tracking-wider">Otentikasi &amp; Login</div>
          <div className="text-3xl font-black text-sky-800 dark:text-sky-300 font-mono">{logs.filter(l => l.action === 'LOGIN').length}</div>
          <div className="text-xs text-sky-600 dark:text-sky-400 font-medium">Aktivitas sesi pengguna</div>
        </div>
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari eksekutor, deskripsi, modul, IP address..."
            className="w-full sm:w-72 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="w-full sm:w-48 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="">— Semua Modul —</option>
            <option value="OTDR Tracing">OTDR Tracing</option>
            <option value="Ticketing & Work Order">Ticketing &amp; Work Order</option>
            <option value="Customer Management">Customer Management</option>
            <option value="OLT & Telemetry Engine">OLT &amp; Telemetry Engine</option>
            <option value="Authentication">Authentication</option>
            <option value="User & Access Control">User &amp; Access Control</option>
          </select>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="w-full sm:w-40 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="">— Semua Jenis Aksi —</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="OTDR_TRACE">OTDR_TRACE</option>
            <option value="PROVISIONING">PROVISIONING</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>
      </div>

      {/* Desktop Table Audit Logs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Waktu Kejadian</th>
                <th className="p-4">Eksekutor / User</th>
                <th className="p-4">Jenis Aksi</th>
                <th className="p-4">Modul Terkait</th>
                <th className="p-4">Deskripsi Aktivitas</th>
                <th className="p-4">IP Address</th>
                <th className="p-4 text-right">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">Memuat log aktivitas sistem...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">Tidak ada log aktivitas ditemukan</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{log.user_name}</div>
                      <div>{getRoleBadge(log.user_role)}</div>
                    </td>
                    <td className="p-4">{getActionBadge(log.action)}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded text-[11px]">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-4 max-w-xs">
                      <p className="text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">{log.description}</p>
                    </td>
                    <td className="p-4 font-mono text-slate-500 text-[11px]">{log.ip_address || '—'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg text-xs transition-all"
                      >
                        Detail Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Halaman <span className="font-bold text-slate-800 dark:text-slate-200">{page}</span> dari <span className="font-bold text-indigo-600 dark:text-indigo-400">{lastPage}</span> (Total {totalLogs} log)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              <button
                onClick={() => fetchLogs(Math.min(lastPage, page + 1))}
                disabled={page === lastPage}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-40"
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL LOG MODAL */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
