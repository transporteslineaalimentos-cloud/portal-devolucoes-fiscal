import { useEffect, useState } from 'react';
import { dbGetKpis } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

const Ic = ({ d, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const KPIS_CFG = [
  {
    key: 'total',
    label: 'Total recebidas',
    accent: '#1E4DB7',
    icon: 'M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1',
    iconBg: 'rgba(30,77,183,0.10)',
    filter: null,
  },
  {
    key: 'pendente',
    label: 'Aguardando análise',
    accent: '#D97706',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    iconBg: 'rgba(217,119,6,0.10)',
    filter: 'pendente',
  },
  {
    key: 'analise',
    label: 'Em análise',
    accent: '#7C3AED',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
    iconBg: 'rgba(124,58,237,0.10)',
    filter: 'em_analise',
  },
  {
    key: 'concluida',
    label: 'Concluídas',
    accent: '#16A34A',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    iconBg: 'rgba(22,163,74,0.10)',
    filter: 'concluida',
  },
];

function KpiCard({ cfg, count, valor, onClick }) {
  return (
    <div className="kpi-card" onClick={onClick}
      style={{ '--kpi-accent': cfg.accent }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.accent + '55'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; }}>
      <div className="kpi-card-top">
        <span className="kpi-card-label">{cfg.label}</span>
        <div className="kpi-icon" style={{ background: cfg.iconBg }}>
          <Ic d={cfg.icon} size={16} color={cfg.accent} />
        </div>
      </div>
      <div className="kpi-card-value" style={{ color: cfg.accent }}>
        {count?.toLocaleString('pt-BR') ?? '—'}
      </div>
      {valor != null && valor > 0 && (
        <div className="kpi-card-sub">{fmtBRL(valor)}</div>
      )}
    </div>
  );
}

export default function Dashboard({ onGoTo }) {
  const [kpis, setKpis]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetKpis()
      .then(d => { setKpis(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const k = kpis || {};

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid">
        {loading
          ? KPIS_CFG.map(cfg => (
            <div key={cfg.key} className="kpi-card" style={{ '--kpi-accent': cfg.accent }}>
              <div className="kpi-card-top">
                <span className="kpi-card-label">{cfg.label}</span>
              </div>
              <div className="kpi-card-value" style={{ color: 'var(--border-2)', fontSize: 24 }}>—</div>
            </div>
          ))
          : KPIS_CFG.map(cfg => (
            <KpiCard key={cfg.key} cfg={cfg}
              count={cfg.key === 'total' ? k.total_count : cfg.key === 'pendente' ? k.pendente_count : cfg.key === 'analise' ? k.analise_count : k.concluida_count}
              valor={cfg.key === 'total' ? k.total_valor : cfg.key === 'pendente' ? k.pendente_valor : null}
              onClick={() => cfg.filter ? onGoTo('devolucoes', { status: cfg.filter }) : onGoTo('devolucoes')}
            />
          ))
        }
      </div>

      {/* Fluxo do sistema */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Como funciona o sistema</span>
        </div>
        <div className="section-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20 }}>
            {[
              {
                step: '01',
                color: 'var(--blue)',
                bg: 'var(--blue-dim)',
                title: 'Captura automática',
                desc: 'NF-e de devolução monitoradas via OOBJ MDe. Novas notas são detectadas e processadas a cada hora.',
              },
              {
                step: '02',
                color: 'var(--purple)',
                bg: 'var(--purple-dim)',
                title: 'Classificação por CFOP',
                desc: 'Cada nota tem seu XML analisado. Apenas CFOPs de devolução (52xx, 54xx, 62xx, 64xx) entram no sistema.',
              },
              {
                step: '03',
                color: 'var(--yellow)',
                bg: 'var(--yellow-dim)',
                title: 'Cruzamento com vendas',
                desc: 'A chave de acesso referenciada é cruzada com o Active OnSupply para vincular à NF de venda original.',
              },
              {
                step: '04',
                color: 'var(--green)',
                bg: 'var(--green-dim)',
                title: 'Fluxo de análise',
                desc: 'Pendente → Em análise → Aprovada ou Rejeitada → Concluída. Histórico de cada movimentação registrado.',
              },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: item.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: item.color, letterSpacing: '.02em' }}>
                    {item.step}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
