import { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './views/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';

const Devolucoes = lazy(() => import('./views/Devolucoes'));

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  devolucoes: 'Devoluções Fiscais',
};

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', fontSize: 13, color: 'var(--text-3)' }}>
        Carregando...
      </div>
    </div>
  );
}

function Portal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [tabFilters, setTabFilters] = useState({});

  const changeTab = (id, filters = {}) => {
    setTab(id);
    if (Object.keys(filters).length) {
      setTabFilters(prev => ({ ...prev, [id]: filters }));
    }
  };

  const renderContent = () => {
    if (tab === 'dashboard') return <Dashboard onGoTo={changeTab} />;
    if (tab === 'devolucoes') return (
      <Suspense fallback={<Fallback />}>
        <Devolucoes user={user} initialFilters={tabFilters.devolucoes || {}} />
      </Suspense>
    );
    return null;
  };

  return (
    <div className="app-layout">
      <Sidebar tab={tab} onChange={changeTab} user={user} onLogout={logout} />
      <div className="app-main">
        <header className="topbar">
          <div style={{ flex: 1 }}>
            <div className="topbar-title">{PAGE_TITLES[tab] || tab}</div>
            {tab === 'devolucoes' && (
              <div className="topbar-sub">NF-e recebidas via OOBJ · atualizado a cada hora</div>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.name || user?.email}</div>
        </header>
        <main className="app-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 22px', fontSize: 13, color: 'var(--text-3)' }}>
        Conectando...
      </div>
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
