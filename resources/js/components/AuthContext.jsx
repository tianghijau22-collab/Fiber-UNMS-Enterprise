import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDefaultPermissionsMap, isUserAuthorizedForCrud } from '../config/navigationModules.jsx';

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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('fiber_user');
      const lastAct = localStorage.getItem('fiber_last_activity');
      if (saved) {
        if (lastAct && (Date.now() - parseInt(lastAct, 10) > INACTIVITY_TIMEOUT_MS)) {
          localStorage.removeItem('fiber_user');
          localStorage.removeItem('fiber_last_activity');
          return null;
        }
        return JSON.parse(saved);
      }
      return null;
    } catch (err) {
      console.error('Error loading user session:', err);
      localStorage.removeItem('fiber_user');
      localStorage.removeItem('fiber_last_activity');
      return null;
    }
  });

  const [routePermissions, setRoutePermissions] = useState(DEFAULT_ROUTE_ROLES);
  const [loading, setLoading] = useState(false);

  const fetchRoutePermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/rbac/permissions');
      const json = await res.json();
      if (json?.data && typeof json.data === 'object') {
        setRoutePermissions(json.data);
      }
    } catch (err) {
      // Keep default fallback
    }
  }, []);

  useEffect(() => {
    fetchRoutePermissions();
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
      fetchRoutePermissions
    }}>
      {children}
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
