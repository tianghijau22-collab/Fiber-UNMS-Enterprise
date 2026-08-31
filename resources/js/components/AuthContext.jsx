import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const ROUTE_ROLES = {
  '/dashboard': ['*'],
  '/server-monitoring': ['Super Administrator', 'Operator Jaringan', 'NOC Operator'],
  '/olt-management': ['Super Administrator', 'Operator Jaringan', 'NOC Operator'],
  '/network-bridge-setup': ['Super Administrator'],
  '/otdr-tracing': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/cable-routes': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/field-tech': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/odp-checks': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/bts-management': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/network': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/gis-map': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/core-matrix': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer'],
  '/customers': ['Super Administrator', 'Customer Service', 'Finance & Billing'],
  '/tickets': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer', 'Customer Service'],
  '/inventory': ['Super Administrator', 'Operator Jaringan', 'NOC Operator', 'Teknisi Jointer', 'Finance & Billing'],
  '/users': ['Super Administrator'],
  '/database-backup': ['Super Administrator'],
  '/audit-logs': ['*'],
  '/broadcast-notifications': ['Super Administrator', 'Operator Jaringan', 'NOC Operator'],
};

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

  const [loading, setLoading] = useState(false);

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
    const allowed = ROUTE_ROLES[path];
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
    <AuthContext.Provider value={{ currentUser, login, commitLogin, updateCurrentUser, logout, loading, canAccessRoute, hasRole }}>
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
