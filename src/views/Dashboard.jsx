import { useEffect, useState } from 'react';
import { dbGetKpis } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

const Ic = ({ d, size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function KpiCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="kpi-card-label">{label}</span>
        {icon}
      </div>
      <div className="kpi-card-value" style={{ color }}>{value}</div>
      {sub && <div className="kpi-card-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ onGoTo }) {
  const [kpis, setKpis]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetKpis().then(d => { setKpis(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>Carregando KPIs...</div>
  );

  const k = kpis || {};

  return (
    <div>
      {/* KPI cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <KpiCard
          label="Total de devoluções"
          value={k.total_count?.toLocaleString('pt-BR') ?? '—'}
          sub={fmtBRL(k.total_valor)}
          color="var(--gold)"
          icon={<Ic d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" size={16} color="var(--gold)" />}
          onClick={() => onGoTo('devolucoes')}
        />
        <KpiCard
          label="Pendentes de análise"
          value={k.pendente_count?.toLocaleString('pt-BR') ?? '—'}
          sub={fmtBRL(k.pendente_valor)}
          color="var(--yellow)"
          icon={<Ic d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" size={16} color="var(--yellow)" />}
          onClick={() => onGoTo('devolucoes', { status: 'pendente' })}
        />
        <KpiCard
          label="Em análise"
          value={k.analise_count?.toLocaleString('pt-BR') ?? '—'}
          color="var(--blue)"
          icon={<Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" size={16} color="var(--blue)" />}
          onClick={() => onGoTo('devolucoes', { status: 'em_analise' })}
        />
        <KpiCard
          label="Concluídas"
          value={k.concluida_count?.toLocaleString('pt-BR') ?? '—'}
          color="var(--green)"
          icon={<Ic d="M20 6L9 17l-5-5" size={16} color="var(--green)" />}
          onClick={() => onGoTo('devolucoes', { status: 'concluida' })}
        />
      </div>

      {/* Info sobre o sistema */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '20px 24px', marginTop: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Como funciona
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { icon: '📥', title: 'Recebimento automático', desc: 'NF-e de devolução capturadas via OOBJ Monitor DFe a cada hora.' },
            { icon: '🔗', title: 'Cruzamento com Active', desc: 'Cada devolução é vinculada automaticamente à NF original de venda via chave de acesso.' },
            { icon: '📦', title: 'Itens detalhados', desc: 'Produtos, quantidades e valores de cada devolução extraídos do XML fiscal.' },
            { icon: '✅', title: 'Gestão de status', desc: 'Fluxo de análise: Pendente → Em análise → Aprovada / Rejeitada → Concluída.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
