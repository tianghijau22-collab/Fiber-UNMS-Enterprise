import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDefaultPermissionsMap, isUserAuthorizedForCrud } from '../config/navigationModules.jsx';
import { defaultSidebarPreferences, normalizeSidebarPreferences } from '../lib/sidebarPreferences';

const AuthContext = createContext();

export const DEFAULT_ROUTE_ROLES = getDefaultPermissionsMap();

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // 3 Menit (180.000 ms) Inactivity Timeout

const recordUserActivity = () => {
  try {
    localStorage.setItem('fiber_last_activity', Date.now().toString());
  } catch {
    // Ignore storage issues
  }
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [routePermissions, setRoutePermissions] = useState(DEFAULT_ROUTE_ROLES);
  const [sidebarPreferences, setSidebarPreferences] = useState(defaultSidebarPreferences);
  const permissionRequest = useRef(null);
  const navigationGeneration = useRef(0);
  const applyNavigationSettings = useCallback(data => {
    navigationGeneration.current++;
    if (data?.data && typeof data.data==='object') setRoutePermissions(data.data);
    setSidebarPreferences(normalizeSidebarPreferences(data?.sidebar));
  },[]);
  const [loading, setLoading] = useState(false);

  const fetchRoutePermissions = useCallback(async () => {
    if (permissionRequest.current) return permissionRequest.current;
    const generation=navigationGeneration.current;
    const task=(async()=>{ try {
      const res = await fetch('/api/rbac/permissions');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data && typeof json.data === 'object' && generation===navigationGeneration.current) {
        applyNavigationSettings(json);
      }
    } catch (err) {
      // Keep default fallback
    } })();
    permissionRequest.current=task;
    try { await task; } finally { if(permissionRequest.current===task)permissionRequest.current=null; }
  }, [applyNavigationSettings]);

  useEffect(() => {
    if (!currentUser) return;
    const sync=()=>{ if (!document.hidden) fetchRoutePermissions(); };
    const storage=event=>{if(event.key==='fona_navigation_revision')sync();};
    window.addEventListener('focus',sync);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',sync);
    const timer=setInterval(sync,60000);
    return()=>{clearInterval(timer);window.removeEventListener('focus',sync);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',sync);};
  },[currentUser?.id,fetchRoutePermissions]);

  useEffect(() => {
    let cancelled = false;
    const clearLocalSession = () => {
      localStorage.removeItem('fiber_user');
      localStorage.removeItem('fiber_last_activity');
      localStorage.removeItem('unms_user');
      setCurrentUser(null);
      setRoutePermissions(DEFAULT_ROUTE_ROLES);
      setSidebarPreferences(defaultSidebarPreferences());
    };
    const restoreSession = async () => {
      try {
        const lastActivity = Number(localStorage.getItem('fiber_last_activity') || 0);
        if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
          await fetch('/sanctum/csrf-cookie');
          await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'timeout' }) });
          if (!cancelled) clearLocalSession();
          return;
        }
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.user) {
          localStorage.setItem('fiber_user', JSON.stringify(data.user));
          setCurrentUser(data.user);
          await fetchRoutePermissions();
        } else {
          clearLocalSession();
        }
      } catch {
        if (!cancelled) clearLocalSession();
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    window.addEventListener('fona:session-expired', clearLocalSession);
    restoreSession();
    return () => {
      cancelled = true;
      window.removeEventListener('fona:session-expired', clearLocalSession);
    };
  }, [fetchRoutePermissions]);

  const logout = useCallback(async (reason = 'manual') => {
    const savedUser = currentUser;
    setCurrentUser(null);
    localStorage.removeItem('fiber_user');
    localStorage.removeItem('fiber_last_activity');
    sessionStorage.removeItem('fiber_session_expired');

    if (savedUser) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
          },
          body: JSON.stringify({ user_id: savedUser.id, reason })
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [currentUser]);

  // ── Inactivity Auto-Logout Tracker (3 Menit Inactivity Timeout) ──
  useEffect(() => {
    if (!currentUser) return;

    // Record initial activity if not already set
    if (!localStorage.getItem('fiber_last_activity')) {
      recordUserActivity();
    }

    let lastThrottleTime = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once every 2.5 seconds
      if (now - lastThrottleTime > 2500) {
        lastThrottleTime = now;
        recordUserActivity();
      }
    };

    const checkInactivity = () => {
      if (!currentUser) return;
      const lastActivityStr = localStorage.getItem('fiber_last_activity');
      if (!lastActivityStr) {
        recordUserActivity();
        return;
      }
      const lastActivity = parseInt(lastActivityStr, 10);
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        logout('timeout');
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Periodic check every 4 seconds
    const interval = setInterval(checkInactivity, 4000);

    // Immediate check on tab focus or visibility change
    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        checkInactivity();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Cross-tab storage sync
    const handleStorage = (e) => {
      if (e.key === 'fiber_user' && !e.newValue) {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser, logout]);

  const login = async (username, password, deferCommit = false) => {
    setLoading(true);
    try {
      const csrf = await fetch('/sanctum/csrf-cookie');
      if (!csrf.ok) throw new Error('Tidak dapat menyiapkan sesi login. Silakan coba lagi.');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login gagal');
      }

      localStorage.setItem('fiber_user', JSON.stringify(data.user));
      recordUserActivity();
      sessionStorage.removeItem('fiber_session_expired');

      if (!deferCommit) {
        setCurrentUser(data.user);
      }
      fetchRoutePermissions();
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const commitLogin = () => {
    try {
      const saved = localStorage.getItem('fiber_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
        recordUserActivity();
        sessionStorage.removeItem('fiber_session_expired');
      }
      fetchRoutePermissions();
    } catch (err) {
      console.error('Error committing login:', err);
    }
  };

  /**
   * Helper RBAC: mengecek apakah role user diizinkan mengakses path halaman tertentu
   */
  const canAccessRoute = (path) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Administrator') return true;

    // Normalize path query
    const cleanPath = path.split('?')[0];
    const allowed = routePermissions[cleanPath] || DEFAULT_ROUTE_ROLES[cleanPath];

    if (!allowed) return true;
    if (allowed.includes('*')) return true;
    return allowed.includes(currentUser.role);
  };

  /**
   * Helper RBAC: mengecek apakah user memiliki setidaknya satu dari role yang diberikan
   */
  const hasRole = (...allowedRoles) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Administrator') return true;
    return allowedRoles.flat().includes(currentUser.role);
  };

  const updateCurrentUser = (user) => {
    localStorage.setItem('fiber_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      login,
      commitLogin,
      updateCurrentUser,
      logout,
      loading,
      canAccessRoute,
      hasRole,
      canCrud: isUserAuthorizedForCrud(currentUser),
      isUserAuthorizedForCrud,
      routePermissions,
      setRoutePermissions,
      sidebarPreferences,
      setSidebarPreferences,
      applyNavigationSettings,
      fetchRoutePermissions
    }}>
      {authReady ? children : <div role="status" className="p-6 text-center">Memeriksa sesi...</div>}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
