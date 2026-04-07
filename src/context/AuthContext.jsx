// ============================================================
// AuthContext — Backend JWT version
//
// Auth flow:
//   1. POST /api/auth/login  → receives JWT + user info
//   2. JWT stored in localStorage (csrl_token)
//   3. User state stored in localStorage (csrl_user) for page-refresh restore
//   4. All API calls read the JWT from localStorage via dataService.js
//
// user shape: { token, role, id, name, centerCode, stream }
//   role:       'ADMIN' | 'CENTRE' | 'STUDENT'
//   id:         'admin' | centreCode | rollKey
//   centerCode: only set for CENTRE & STUDENT
//   stream:     only set for STUDENT ('JEE' | 'NEET')
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react';

export const TOKEN_KEY = 'csrl_token';
const USER_KEY  = 'csrl_user';

const AuthContext = createContext(null);

function resolveApiBase() {
  const envBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envBase) return envBase.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app')) {
      return 'https://csrl-backend.onrender.com/api';
    }
  }

  return '/api';
}

const API_BASE = resolveApiBase();

export const AuthProvider = ({ children }) => {
  // undefined = still reading localStorage (show nothing / spinner)
  const [user, setUser] = useState(undefined);

  // Restore session synchronously from localStorage on first render
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  /**
   * login({ role, id, password })
   * Calls the backend, stores the JWT + user object, updates state.
   */
  const login = async ({ role, id, password }) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role, id, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid credentials. Please try again.');
    }

    const userState = {
      token:      data.token,
      role:       (data.role || 'student').toUpperCase(),
      name:       data.name       || id,
      id:         data.id         || id,
      centerCode: data.centerCode || null,
      stream:     data.stream     || null,
    };

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(userState));
    setUser(userState);
    return userState;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  // Show nothing while reading localStorage (avoids flash of login page)
  if (user === undefined) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
