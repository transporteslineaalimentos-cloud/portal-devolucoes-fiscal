import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, refreshToken, dbGetUser, syncAuthToken } from '../config/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const token = localStorage.getItem('df_token');
        if (!token) { setLoading(false); return; }
        syncAuthToken();
        const refreshed = await refreshToken();
        if (!refreshed) {
          ['df_token', 'df_refresh', 'df_user'].forEach(k => localStorage.removeItem(k));
          setLoading(false);
          return;
        }
        localStorage.setItem('df_token', refreshed.token);
        localStorage.setItem('df_refresh', refreshed.refresh);
        syncAuthToken();
        const stored = localStorage.getItem('df_user');
        if (stored) setUser(JSON.parse(stored));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    // 1. Autentica no Supabase Auth
    const result = await apiLogin(email, password);

    // 2. Verifica se o email está na tabela EXCLUSIVA do portal fiscal
    //    (faz isso ANTES de salvar o token — auth já foi validado acima)
    localStorage.setItem('df_token', result.token);
    localStorage.setItem('df_refresh', result.refresh);
    syncAuthToken();

    const profile = await dbGetUser(email);
    if (!profile) {
      // Remove o token imediatamente — acesso negado a este portal
      ['df_token', 'df_refresh', 'df_user'].forEach(k => localStorage.removeItem(k));
      throw new Error('Acesso não autorizado para este portal. Solicite ao administrador.');
    }

    const userData = {
      email:  result.user.email,
      name:   profile.nome,
      role:   profile.role,
      id:     result.user.id,
    };
    localStorage.setItem('df_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    ['df_token', 'df_refresh', 'df_user'].forEach(k => localStorage.removeItem(k));
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
