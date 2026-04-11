import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearGuestSession } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/me');
      setUser(data);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post('/login', { email, password });
    localStorage.setItem('token', data.token);
    clearGuestSession();
    setUser(data.user);
    return data.user;
  };

  const register = async (body) => {
    const { data } = await api.post('/register', body);
    localStorage.setItem('token', data.token);
    clearGuestSession();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch {
      /* ignore */
    }
    localStorage.removeItem('token');
    clearGuestSession();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      isSubscribed: !!user?.is_subscribed,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth outside provider');
  }
  return ctx;
}
