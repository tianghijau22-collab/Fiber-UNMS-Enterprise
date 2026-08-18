import React, { useState, useEffect } from 'react';

export default function CallDirectoryModal({ isOpen, onClose, onCallUser }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'history'
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calls/directory');
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/calls/history');
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectory();
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.division && u.division.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
    );
  });

  const formatDuration = (sec) => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#3f3f46] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              📞
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-sans">
                Direktori Panggilan Suara Tim
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Panggilan WebRTC langsung antar-staf operasional jaringan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab & Search Navigation */}
        <div className="p-4 border-b border-slate-100 dark:border-[#1f1f1f] space-y-3 bg-slate-50/50 dark:bg-black">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#3f3f46] shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-950'
              }`}
            >
              👥 Kontak Pengguna ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#3f3f46] shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-950'
              }`}
            >
              📋 Riwayat Panggilan ({history.length})
            </button>
          </div>

          {activeTab === 'users' && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama pegawai, role, divisi (NOC, Jointer, CS)..."
              className="w-full px-3 py-2 bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              Memuat data pengguna...
            </div>
          ) : activeTab === 'users' ? (
            filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Tidak ada pengguna yang cocok dengan pencarian.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-lg flex items-center justify-between gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-[#3f3f46] text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black ${
                          user.is_online ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        title={user.is_online ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {user.role} · Divisi {user.division || 'Umum'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onCallUser(user);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <span>📞 Panggil</span>
                  </button>
                </div>
              ))
            )
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada riwayat panggilan.
            </div>
          ) : (
            history.map((call) => (
              <div
                key={call.id}
                className="p-3 bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {call.caller?.name} ➔ {call.receiver?.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Durasi: {formatDuration(call.duration_seconds)} · Status: {call.status}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    call.status === 'ended' || call.status === 'in_call'
                      ? 'bg-emerald-50 dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                      : 'bg-rose-50 dark:bg-neutral-900 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                  }`}
                >
                  {call.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
