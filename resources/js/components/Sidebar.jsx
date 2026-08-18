import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

const mainNavItems = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: 'OLT (Multi-Vendor)',
    path: '/olt-management',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    )
  },
  {
    name: 'Peta Topologi GIS',
    path: '/gis-map',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    )
  },
  {
    name: 'Tracing Putus OTDR',
    path: '/otdr-tracing',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    name: 'Manajemen Redaman BTS',
    path: '/bts-management',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.394 9.393a15 15 0 0121.213 0" />
      </svg>
    )
  },
  {
    name: 'Pemetaan Rute Kabel',
    path: '/cable-routes',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    )
  },

  {
    name: 'Manajemen Pelanggan',
    path: '/customers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    name: 'Tiket & Maintenance',
    path: '/tickets',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 001 1.732V15a2 2 0 00-1 1.732V20a2 2 0 002 2h14a2 2 0 002-2v-3.268A2 2 0 0021 15v-3a2 2 0 00-1-1.732V7a2 2 0 00-2-2H5z" />
      </svg>
    )
  },
  {
    name: 'Manajemen User',
    path: '/users',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    name: 'Audit Logs & Aktivitas',
    path: '/audit-logs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    name: 'Backup Database',
    path: '/database-backup',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    )
  },
  {
    name: 'Manajemen Notifikasi',
    path: '/broadcast-notifications',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const { canAccessRoute, currentUser, logout } = useAuth();
  const [olts, setOlts] = useState([]);
  const [loadingOlts, setLoadingOlts] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.role === 'Super Administrator';

  // Extract current active olt_id from query search
  const queryParams = new URLSearchParams(location.search);
  const activeOltId = queryParams.get('olt_id');

  // Filter menu items by RBAC permissions
  const allowedNavItems = mainNavItems.filter(item => canAccessRoute(item.path));
  const canSeeOltRegion = canAccessRoute('/network');

  // Fetch OLTs list automatically
  useEffect(() => {
    let isMounted = true;
    async function loadOlts() {
      try {
        const r = await fetch('/api/olts?per_page=100');
        const d = await r.json();
        if (isMounted) {
          const list = Array.isArray(d) ? d : (d.data || []);
          setOlts(list);
        }
      } catch (err) {
        console.error('Failed to load OLT list for sidebar:', err);
      } finally {
        if (isMounted) setLoadingOlts(false);
      }
    }
    if (canSeeOltRegion) {
      loadOlts();
    }
    return () => { isMounted = false; };
  }, [location.pathname, canSeeOltRegion]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 bg-white dark:bg-black text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-[#222222] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-5 border-b border-slate-200 dark:border-[#52525b] flex items-center justify-between box-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white tracking-wider uppercase font-sans">
              FIBER-UNMS
            </span>
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">

          {/* ── SEKSI WILAYAH / REGIONAL OLT ("KAMAR PRIBADI PER OLT") ── */}
          {canSeeOltRegion && (
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center justify-between">
                <span>Wilayah / OLT Region</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400 text-[10px] font-mono">{olts.length} OLT</span>
              </div>

              <div className="mt-1 space-y-0.5">
                {/* Global (Semua Wilayah) at top */}
                <NavLink
                  to="/network"
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                    location.pathname === '/network' && !activeOltId
                      ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="truncate">Infrastruktur (Global)</span>
                </NavLink>

                {/* OLT Rooms */}
                {loadingOlts ? (
                  <div className="px-3 py-1.5 text-xs text-slate-400 italic animate-pulse">
                    Memuat wilayah OLT...
                  </div>
                ) : olts.length === 0 ? (
                  <div className="px-3 py-1.5 text-xs text-slate-400 italic">
                    Belum ada OLT terdaftar
                  </div>
                ) : (
                  olts.map((olt) => {
                    const isCurrentOltActive = location.pathname === '/network' && String(activeOltId) === String(olt.id);
                    return (
                      <NavLink
                        key={olt.id}
                        to={`/network?olt_id=${olt.id}`}
                        onClick={onClose}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                          isCurrentOltActive
                            ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2" />
                          </svg>
                          <span className="truncate">{olt.name}</span>
                        </div>
                      </NavLink>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── MENU OPERASIONAL DOKUMENTASI & SISTEM ── */}
          <div>
            <div className="px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Menu Utama & Akses System
            </div>
            <div className="mt-1 space-y-0.5">
              {allowedNavItems.map((item) => {
                const isExactNetworkGlobal = item.path === '/network' && location.pathname === '/network' && !activeOltId;
                const isNormalActive = item.path !== '/network' && location.pathname === item.path;
                const isActive = isExactNetworkGlobal || isNormalActive;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                      isActive
                        ? 'bg-blue-50 dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
                      {item.icon}
                    </span>
                    <span className="truncate">
                      {item.path === '/audit-logs'
                        ? (isSuperAdmin ? 'Audit Logs & Security' : 'Audit Logs Aktivitas Saya')
                        : item.name}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Logout button */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#222222]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-neutral-900 hover:text-rose-600 dark:hover:text-rose-400 transition-all text-left"
            >
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </nav>

        {/* Footer / System Status */}
        <div className="p-3 border-t border-slate-200 dark:border-[#222222]">
          <div className="bg-slate-50 dark:bg-neutral-900 rounded-lg p-2.5 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">System Status</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Operational</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
