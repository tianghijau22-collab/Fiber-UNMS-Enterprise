import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDefaultPermissionsMap, isUserAuthorizedForCrud } from '../config/navigationModules.jsx';

const AuthContext = createContext();

export const DEFAULT_ROUTE_ROLES = getDefaultPermissionsMap();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('fiber_user');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.error('Error loading user session:', err);
      localStorage.removeItem('fiber_user');
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
      }
      fetchRoutePermissions();
    } catch (err) {
      console.error('Error committing login:', err);
    }
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? ''
          },
          body: JSON.stringify({ user_id: currentUser.id })
        });
      } catch (err) {
        console.error(err);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('fiber_user');
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
