import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(email.trim(), password); }
    catch (err) { setError(err.message || 'Credenciais inválidas.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* Marca */}
        <div className="login-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 17V5h3l5 9 5-9h3v12h-2.5V9.5l-4.5 7.5h-3L5 9.5V17H3z" fill="#A68B5C"/>
          </svg>
        </div>

        <div className="login-eyebrow">Linea Alimentos</div>
        <div className="login-title">Devoluções Fiscais</div>
        <div className="login-sub">Acesso restrito a usuários autorizados</div>

        <div className="login-divider" />

        {error && (
          <div className="login-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="input-label">E-mail corporativo</label>
            <input type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="nome@lineaalimentos.com.br"
            />
          </div>
          <div className="login-field">
            <label className="input-label">Senha</label>
            <input type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••••"
            />
          </div>
          <button type="submit" disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center', padding: '10px 14px', fontSize: 13 }}>
            {loading
              ? <><Spinner /> Entrando...</>
              : 'Entrar no sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
    </svg>
  );
}
