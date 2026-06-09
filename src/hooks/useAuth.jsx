import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, refreshToken, dbGetUser, syncAuthToken } from '../config/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    async function restore() {
      try {
        const token = localStorage.getItem('df_token');
        if (!token) { setLoading(false); return; }

        syncAuthToken();
        // Tenta refresh silencioso para verificar validade
        const refreshed = await refreshToken();
        if (!refreshed) {
          localStorage.removeItem('df_token');
          localStorage.removeItem('df_refresh');
          localStorage.removeItem('df_user');
          setLoading(false);
          return;
        }

        localStorage.setItem('df_token', refreshed.token);
        localStorage.setItem('df_refresh', refreshed.refresh);
        syncAuthToken();

        const stored = localStorage.getItem('df_user');
        if (stored) setUser(JSON.parse(stored));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await apiLogin(email, password);
    localStorage.setItem('df_token', result.token);
    localStorage.setItem('df_refresh', result.refresh);
    syncAuthToken();

    // Busca perfil do usuário
    const profile = await dbGetUser(email);
    const userData = {
      email: result.user.email,
      name: profile?.nome || result.user.email,
      role: profile?.role || 'viewer',
      id:   result.user.id,
    };
    localStorage.setItem('df_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('df_token');
    localStorage.removeItem('df_refresh');
    localStorage.removeItem('df_user');
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
