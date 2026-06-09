import { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './views/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';

const Devolucoes = lazy(() => import('./views/Devolucoes'));

const PAGE_META = {
  dashboard:  { title: 'Dashboard',          sub: null },
  devolucoes: { title: 'Devoluções Fiscais',  sub: 'NF-e recebidas classificadas por CFOP · sincronizado a cada hora' },
};

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando...</div>
    </div>
  );
}

function Portal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [tabFilters, setTabFilters] = useState({});

  const changeTab = (id, filters = {}) => {
    setTab(id);
    if (Object.keys(filters).length)
      setTabFilters(prev => ({ ...prev, [id]: filters }));
  };

  const meta = PAGE_META[tab] || { title: tab, sub: null };

  return (
    <div className="app-layout">
      <Sidebar tab={tab} onChange={changeTab} user={user} onLogout={logout} />
      <div className="app-main">

        {/* Topbar */}
        <header className="topbar">
          <div style={{ flex: 1 }}>
            <div className="topbar-title">{meta.title}</div>
            {meta.sub && <div className="topbar-sub">{meta.sub}</div>}
          </div>

          {/* Breadcrumb / empresa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 10px',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--green)', flexShrink: 0,
              }}/>
              <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>
                {user?.name?.split(' ')[0] || user?.email?.split('@')[0]}
              </span>
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>
                {user?.role}
              </span>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="app-content">
          {tab === 'dashboard' && <Dashboard onGoTo={changeTab} />}
          {tab === 'devolucoes' && (
            <Suspense fallback={<Fallback />}>
              <Devolucoes user={user} initialFilters={tabFilters.devolucoes || {}} />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Conectando...</div>
    </div>
  );
  return user ? <Portal /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
