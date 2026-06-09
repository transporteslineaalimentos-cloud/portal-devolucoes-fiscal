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
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#A68B5C" fillOpacity=".15"/>
            <path d="M8 22V10h4l4 8 4-8h4v12h-3V15l-3.5 7h-3L11 15v7H8z" fill="#A68B5C"/>
          </svg>
          <div>
            <div className="login-title">Devoluções Fiscais</div>
            <div className="login-sub">Linea Alimentos</div>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="input-label">E-mail</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="seu@email.com"
            />
          </div>
          <div className="login-field">
            <label className="input-label">Senha</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="input" placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-gold" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
