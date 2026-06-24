import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './views/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import { dbGetCobrancasCount, dbGetPendencias } from './config/supabase';

const Devolucoes = lazy(() => import('./views/Devolucoes'));
const Cobrancas  = lazy(() => import('./views/Cobrancas'));
const Protheus   = lazy(() => import('./views/Protheus'));

const PAGE_META = {
  dashboard:  { title: 'Dashboard',          sub: null },
  devolucoes: { title: 'Devoluções Fiscais',  sub: 'NF-e recebidas classificadas por CFOP · sincronizado a cada hora' },
  cobrancas:  { title: 'Cobranças',          sub: 'Devoluções com responsabilidade do transportador já lançadas no Protheus' },
  protheus:   { title: 'Controle Protheus',  sub: 'Todos os lançamentos de devolução escriturados no Protheus via GoBi' },
};

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando...</div>
    </div>
  );
}

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function Portal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [tabFilters, setTabFilters] = useState({});
  const [counts, setCounts] = useState({});
  const [pendencias, setPendencias] = useState(null);
  const [showPendencias, setShowPendencias] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const searchRef = useRef(null);
  const pendRef = useRef(null);

  const refreshCounts = async () => {
    try {
      const n = await dbGetCobrancasCount();
      setCounts(c => ({ ...c, cobrancas: n }));
    } catch { /* ignore */ }
  };

  const refreshPendencias = async () => {
    try { setPendencias(await dbGetPendencias()); }
    catch { /* ignore */ }
  };

  useEffect(() => { refreshCounts(); refreshPendencias(); }, []);

  // Fechar painel pendências ao clicar fora
  useEffect(() => {
    if (!showPendencias) return;
    const handler = (e) => { if (pendRef.current && !pendRef.current.contains(e.target)) setShowPendencias(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPendencias]);

  // Atalho Ctrl+K para focar busca global
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const changeTab = (id, filters = {}) => {
    setTab(id);
    if (Object.keys(filters).length)
      setTabFilters(prev => ({ ...prev, [id]: { ...filters, _ts: Date.now() } }));
  };

  const handleGlobalSearch = (value) => {
    if (!value.trim()) return;
    changeTab('devolucoes', { search: value.trim(), _ts: Date.now() });
    setGlobalSearch(''); // limpa a topbar após navegar
  };

  const totalPendencias = pendencias
    ? (pendencias.sem_motivo || 0) + (pendencias.sem_transportador || 0) + (pendencias.sem_centro_custo || 0)
    : 0;

  const meta = PAGE_META[tab] || { title: tab, sub: null };

  return (
    <div className="app-layout">
      <Sidebar tab={tab} onChange={changeTab} user={user} onLogout={logout} counts={counts} />
      <div className="app-main">

        {/* Topbar */}
        <header className="topbar">
          <div style={{ flex: 1 }}>
            <div className="topbar-title">{meta.title}</div>
            {meta.sub && <div className="topbar-sub">{meta.sub}</div>}
          </div>

          {/* Busca global */}
          <div style={{ position: 'relative', flex: '0 0 320px' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={14} color="var(--text-3)"/>
            </div>
            <input
              ref={searchRef}
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleGlobalSearch(globalSearch);
                if (e.key === 'Escape') { setGlobalSearch(''); e.target.blur(); }
              }}
              placeholder="Buscar NF, emitente... (Ctrl+K)"
              style={{
                width: '100%', height: 34,
                padding: '0 36px 0 34px',
                border: '1px solid var(--border)',
                borderRadius: 8, background: 'var(--surface-2)',
                fontSize: 12.5, color: 'var(--text)',
                outline: 'none', transition: 'border-color 120ms, box-shadow 120ms',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px var(--blue-dim)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1, padding: 2 }}>
                ×
              </button>
            )}
          </div>

          {/* Painel de pendências */}
          <div ref={pendRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowPendencias(v => !v); refreshPendencias(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: totalPendencias > 0 ? 'var(--yellow-dim)' : 'var(--surface-2)',
                border: `1px solid ${totalPendencias > 0 ? 'rgba(217,119,6,0.25)' : 'var(--border)'}`,
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                transition: 'all 120ms',
              }}>
              <Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={13} color={totalPendencias > 0 ? 'var(--yellow)' : 'var(--text-3)'}/>
              <span style={{ fontSize: 11.5, color: totalPendencias > 0 ? 'var(--yellow)' : 'var(--text-2)', fontWeight: 600 }}>
                Pendências
              </span>
              {totalPendencias > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--yellow)', color: '#fff', borderRadius: 20, padding: '1px 6px' }}>
                  {totalPendencias}
                </span>
              )}
            </button>

            {showPendencias && pendencias && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '6px 0', minWidth: 340,
                boxShadow: '0 8px 24px rgba(15,25,35,0.14)',
              }}>
                <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Pendências de classificação
                  </div>
                </div>

                {[
                  { label: 'Sem motivo classificado', value: pendencias.sem_motivo, icon: '≡', cor: 'var(--red)', filtro: { com_motivo: 'sem' } },
                  { label: 'Área TRANSPORTE sem transportador', value: pendencias.sem_transportador, icon: '▣', cor: 'var(--yellow)', filtro: { area: 'TRANSPORTE', com_motivo: 'com' } },
                  { label: 'Sem centro de custo (com NF venda)', value: pendencias.sem_centro_custo, icon: '▤', cor: '#0EA5E9', filtro: { centro_custo: 'sem', nf_venda: 'localizada' } },
                  { label: 'Cobranças pendentes (transportador)', value: pendencias.cobrancas_pendentes, icon: '$', cor: 'var(--green)', aba: 'cobrancas', filtro: { status_cobranca: 'pendente_cobranca_transportador' } },
                  { label: 'Sem motivo há +30 dias', value: pendencias.nao_classificadas_30d, icon: '⏱', cor: 'var(--red)', filtro: { com_motivo: 'sem' }, alerta: true },
                ].map(item => (
                  <div key={item.label}
                    onClick={() => {
                      if (!item.value) return;
                      changeTab(item.aba || 'devolucoes', item.filtro);
                      setShowPendencias(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                      cursor: item.value ? 'pointer' : 'default',
                      opacity: item.value ? 1 : 0.45,
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={e => { if (item.value) e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: item.cor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: item.cor, fontWeight: 700 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.value > 0 ? item.cor : 'var(--text-3)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>
                      {item.value ?? '—'}
                    </div>
                  </div>
                ))}

                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <button onClick={() => { refreshPendencias(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}>
                    ↻ Atualizar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Usuário logado */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }}/>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>
              {user?.name?.split(' ')[0] || user?.email?.split('@')[0]}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {user?.role}
            </span>
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
          {tab === 'cobrancas' && (
            <Suspense fallb
          {tab === 'protheus' && (
            <Suspense fallback={<div className="loading-state">Carregando…</div>}>
              <Protheus user={user} />
            </Suspense>
          )}ack={<Fallback />}>
              <Cobrancas user={user} initialFilters={tabFilters.cobrancas || {}}
                onChanged={refreshCounts} />
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
