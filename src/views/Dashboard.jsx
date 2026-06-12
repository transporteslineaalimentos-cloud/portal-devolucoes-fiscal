import { useEffect, useState } from 'react';
import { dbGetKpis, dbGetDashboard } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

// ─── Ícone SVG inline ────────────────────────────────────
const Ic = ({ d, size = 16, color = 'currentColor', stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

// ─── Helpers ─────────────────────────────────────────────
const fmtMes = (s) => {
  if (!s) return '';
  const [y, m] = s.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m,10)-1]}/${y.slice(2)}`;
};
const fmtBRLk = (v) => {
  if (v == null) return '—';
  if (Math.abs(v) >= 1000) return `R$ ${(v/1000).toFixed(0)}k`;
  return fmtBRL(v);
};
const pct = (a, b) => b === 0 ? null : Math.round(((a - b) / b) * 100);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Barra horizontal simples ────────────────────────────
function Bar({ valor, max, color = 'var(--blue)', height = 6 }) {
  const w = max > 0 ? clamp((valor / max) * 100, 1, 100) : 0;
  return (
    <div style={{ height, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 99, transition: 'width 600ms ease' }}/>
    </div>
  );
}

// ─── Chip de variação ────────────────────────────────────
function Delta({ atual, anterior, invertido = false }) {
  if (anterior == null || anterior === 0) return null;
  const diff = pct(atual, anterior);
  if (diff == null) return null;
  const positivo = invertido ? diff < 0 : diff > 0;
  const neutro = diff === 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10.5, fontWeight: 700,
      color: neutro ? 'var(--text-3)' : positivo ? 'var(--green)' : 'var(--red)',
      background: neutro ? 'var(--surface-3)' : positivo ? 'var(--green-dim)' : 'var(--red-dim)',
      padding: '2px 7px', borderRadius: 20,
    }}>
      {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff)}%
    </span>
  );
}

// ─── Card container ──────────────────────────────────────
function Card({ title, subtitle, children, action, noPad = false, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-xs)',
      display: 'flex', flexDirection: 'column',
      borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={noPad ? {} : { padding: '16px 18px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

// ─── KPI mini card ───────────────────────────────────────
function KpiMini({ label, value, sub, color, icon, delta, deltaInv }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
      boxShadow: 'var(--shadow-xs)',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.01em' }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ic d={icon} size={15} color={color}/>
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{sub}</span>}
        {delta != null && <Delta atual={delta.atual} anterior={delta.anterior} invertido={deltaInv}/>}
      </div>
    </div>
  );
}

// ─── Gráfico de linha (HTML overlay, sem distorção) ──────
function TrendChart({ data, valueKey, labelKey, color = 'var(--blue)', height = 130, formatValue = fmtBRLk }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>Sem dados</div>;

  const vals = data.map(d => d[valueKey]);
  const maxVal = Math.max(...vals, 1);
  const minVal = Math.min(...vals, 0);
  const range = (maxVal - minVal) || 1;
  const padTop = 12; // % de respiro no topo para o tooltip não cortar

  const pts = data.map((d, i) => ({
    xPct: data.length > 1 ? (i / (data.length - 1)) * 100 : 50,
    yPct: padTop + (1 - (d[valueKey] - minVal) / range) * (100 - padTop - 6),
    d,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPct}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].xPct} 100 L ${pts[0].xPct} 100 Z`;
  const gradId = `grad-${color.replace(/[^a-zA-Z]/g, '')}`;

  return (
    <div style={{ position: 'relative', height, marginTop: 4 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} stroke="none"/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke"
          strokeLinejoin="round" strokeLinecap="round"/>
      </svg>

      {/* Pontos + tooltip — HTML, não distorce */}
      {pts.map((p, i) => (
        <div key={i}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          style={{
            position: 'absolute', left: `${p.xPct}%`, top: `${p.yPct}%`,
            transform: 'translate(-50%, -50%)', cursor: 'pointer',
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div style={{
            width: hovered === i ? 8 : 6, height: hovered === i ? 8 : 6, borderRadius: '50%',
            background: color, border: '2px solid var(--surface)',
            boxShadow: '0 0 0 1px ' + color + '40',
            transition: 'width 120ms, height 120ms',
          }}/>
          {hovered === i && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: 6, padding: '4px 8px', borderRadius: 6,
              background: 'var(--text)', color: 'var(--surface)',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none',
              boxShadow: 'var(--shadow-sm)', zIndex: 2,
            }}>
              {formatValue(p.d[valueKey])}
            </div>
          )}
        </div>
      ))}

      {/* Eixo X */}
      <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
        {data.map((d, i) => (
          <span key={i} style={{
            fontSize: 10, color: hovered === i ? color : 'var(--text-3)',
            fontWeight: hovered === i ? 700 : 500, flex: 1, textAlign: 'center',
            transition: 'color 120ms',
          }}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Gráfico de barras verticais (HTML, sem distorção) ───
function ColumnChart({ data, valueKey, labelKey, color = 'var(--purple)', highlightColor, height = 130, formatValue = (v) => v }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>Sem dados</div>;

  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const maxIdx = data.reduce((best, d, i) => d[valueKey] > data[best][valueKey] ? i : best, 0);

  return (
    <div style={{ position: 'relative', height, marginTop: 4, paddingBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '6%' }}>
        {data.map((d, i) => {
          const h = Math.max((d[valueKey] / maxVal) * 100, 2);
          const isHighlight = highlightColor && i === maxIdx;
          const fill = isHighlight ? highlightColor : color;
          return (
            <div key={i}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative', cursor: 'pointer' }}>
              {hovered === i && (
                <div style={{
                  position: 'absolute', bottom: `calc(${h}% + 8px)`, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 8px', borderRadius: 6, background: 'var(--text)', color: 'var(--surface)',
                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none',
                  boxShadow: 'var(--shadow-sm)', zIndex: 2,
                }}>
                  {formatValue(d[valueKey])}
                </div>
              )}
              <div style={{
                width: '100%', height: `${h}%`, borderRadius: '4px 4px 0 0',
                background: fill, opacity: hovered === i ? 1 : 0.85,
                transition: 'height 500ms ease, opacity 120ms',
              }}/>
            </div>
          );
        })}
      </div>
      {/* Eixo X */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '6%' }}>
        {data.map((d, i) => (
          <span key={i} style={{
            flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 500,
            color: hovered === i ? color : 'var(--text-3)',
          }}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

const AREA_CORES = {
  'COMERCIAL':         '#1E4DB7',
  'TRANSPORTE':        '#D97706',
  'QUALIDADE':         '#7C3AED',
  'FISCAL':            '#DC2626',
  'LOGÍSTICA REVERSA': '#16A34A',
  'LOGÍSTICA':         '#16A34A',
  'SEM CLASSIFICAÇÃO': '#9CA3AF',
};

function shiftMonths(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

// ─── Filtro de período ────────────────────────────────────
function PeriodFilter({ value, onChange }) {
  const presets = [
    { key: '2026', label: '2026',            inicio: '2026-01-01', fim: todayISO() },
    { key: '6m',   label: 'Últimos 6 meses', inicio: shiftMonths(-6), fim: todayISO() },
    { key: '3m',   label: 'Últimos 3 meses', inicio: shiftMonths(-3), fim: todayISO() },
    { key: 'mes',  label: 'Mês atual',       inicio: startOfMonth(),  fim: todayISO() },
  ];

  const activePreset = presets.find(p => p.inicio === value.inicio && p.fim === value.fim);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {presets.map(p => (
        <button key={p.key}
          onClick={() => onChange({ inicio: p.inicio, fim: p.fim })}
          className={`btn btn-sm ${activePreset?.key === p.key ? 'btn-primary' : 'btn-outline'}`}>
          {p.label}
        </button>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="date" value={value.inicio} max={value.fim}
          onChange={e => onChange({ ...value, inicio: e.target.value })}
          className="input" style={{ width: 130, fontSize: 11.5, padding: '5px 8px' }}/>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>até</span>
        <input type="date" value={value.fim} min={value.inicio} max={todayISO()}
          onChange={e => onChange({ ...value, fim: e.target.value })}
          className="input" style={{ width: 130, fontSize: 11.5, padding: '5px 8px' }}/>
      </div>
    </div>
  );
}

// ─── DASHBOARD PRINCIPAL ─────────────────────────────────
export default function Dashboard({ onGoTo }) {
  const [kpis, setKpis]     = useState(null);
  const [dash, setDash]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState({ inicio: '2026-01-01', fim: todayISO() });

  useEffect(() => {
    setLoading(true);
    Promise.all([dbGetKpis(periodo), dbGetDashboard(periodo)])
      .then(([k, d]) => { setKpis(k); setDash(d); })
      .finally(() => setLoading(false));
  }, [periodo]);

  const k = kpis || {};
  const d = dash || {};
  const ev = d.evolucao || [];
  const evComLabel = ev.map(m => ({ ...m, label: fmtMes(m.mes) }));
  const mesAtual = d.mesAtual;
  const mesAnt   = d.mesAnterior;
  const cob = d.cobrancas || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Filtro de período ───────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PeriodFilter value={periodo} onChange={setPeriodo}/>
        {loading && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
              style={{ animation: 'spin 0.9s linear infinite' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Atualizando...
          </span>
        )}
      </div>

      {/* ── Linha 1: KPIs principais ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiMini
          label="Total de devoluções"
          value={k.total_count?.toLocaleString('pt-BR') ?? '—'}
          sub={fmtBRL(k.total_valor)}
          color="var(--blue)"
          icon="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1"
          delta={mesAtual && mesAnt ? { atual: mesAtual.qtd, anterior: mesAnt.qtd } : null}
          deltaInv
        />
        <KpiMini
          label="Pendentes de análise"
          value={k.pendente_count?.toLocaleString('pt-BR') ?? '—'}
          sub={fmtBRL(k.pendente_valor)}
          color="var(--yellow)"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiMini
          label="Ticket médio por NF"
          value={d.totais?.ticket_medio ? fmtBRL(d.totais.ticket_medio) : '—'}
          sub={`${d.totais?.clientes ?? 0} clientes distintos`}
          color="var(--purple)"
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiMini
          label="Pendente cobrança transportador"
          value={cob.pendente_count?.toLocaleString('pt-BR') ?? '—'}
          sub={fmtBRL(cob.pendente_valor)}
          color="var(--red)"
          icon="M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z"
        />
      </div>

      {/* ── Linha 2: Gráficos de evolução ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <Card
          title="Evolução mensal — Valor devolvido"
          subtitle="R$ por mês de emissão da NF de devolução"
          accent="var(--blue)"
        >
          <TrendChart data={evComLabel} valueKey="valor" labelKey="label" color="var(--blue)" height={130} formatValue={fmtBRL}/>
          {mesAtual && mesAnt && (
            <div style={{ display: 'flex', gap: 16, marginTop: 32, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{fmtMes(mesAnt.mes)}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(mesAnt.valor)}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{fmtMes(mesAtual.mes)} (atual)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(mesAtual.valor)}</div>
                  <Delta atual={mesAtual.valor} anterior={mesAnt.valor} invertido/>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Evolução mensal — Quantidade de NFs"
          subtitle="Número de devoluções por mês"
          accent="var(--purple)"
        >
          <ColumnChart data={evComLabel} valueKey="qtd" labelKey="label" color="var(--purple)" highlightColor="var(--red)" height={130} formatValue={(v) => `${v} NFs`}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 32, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Pior mês (qtd)', value: d.piorMesQtd ? `${fmtMes(d.piorMesQtd.mes)} · ${d.piorMesQtd.qtd} NFs` : '—', color: 'var(--red)' },
              { label: 'Pior mês (valor)', value: d.piorMesValor ? `${fmtMes(d.piorMesValor.mes)} · ${fmtBRL(d.piorMesValor.valor)}` : '—', color: 'var(--red)' },
              { label: 'Média mensal', value: ev.length ? `${Math.round(ev.reduce((s,m)=>s+m.qtd,0)/ev.length)} NFs` : '—', color: 'var(--text-2)' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Linha 3: Top clientes + Top UFs / Cobranças ─────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <Card title="Top 10 clientes por valor devolvido" subtitle="Acumulado no período" noPad>
          {(d.topClientes || []).map((c, i) => {
            const maxVal = d.topClientes[0]?.valor || 1;
            const pctShare = Math.round((c.valor / (d.totais?.valor || 1)) * 100);
            return (
              <div key={c.cnpj} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 18px', borderBottom: i < 9 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: i < 3 ? ['var(--red-dim)','var(--yellow-dim)','var(--blue-dim)'][i] : 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  color: i < 3 ? ['var(--red)','var(--yellow)','var(--blue)'][i] : 'var(--text-3)',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {c.nome}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)' }}>{pctShare}%</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.valor)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bar valor={c.valor} max={maxVal} color={i < 3 ? ['var(--red)','var(--yellow)','var(--blue)'][i] : 'var(--border-2)'} height={4}/>
                    <span style={{ fontSize: 9.5, color: 'var(--text-3)', flexShrink: 0 }}>{c.qtd} NFs · {c.uf}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top UFs */}
          <Card title="Top 8 estados por valor" subtitle="Origem das devoluções">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(d.topUfs || []).map((u) => {
                const maxVal = d.topUfs[0]?.valor || 1;
                return (
                  <div key={u.uf} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, fontSize: 11, fontWeight: 800, color: 'var(--text-2)', letterSpacing: '.03em', flexShrink: 0 }}>{u.uf}</span>
                    <Bar valor={u.valor} max={maxVal} color="var(--blue)" height={6}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>{fmtBRL(u.valor)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{u.qtd} NFs</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Cobranças a transportadores */}
          <Card title="Cobranças a transportadores" subtitle="Devoluções de responsabilidade do transporte, já lançadas no Protheus" noPad
            action={
              <button onClick={() => onGoTo?.('cobrancas')} className="btn btn-outline btn-sm">
                Ver tudo
              </button>
            }>
            <div style={{ display: 'flex', gap: 1, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pendentes</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(cob.pendente_valor)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{cob.pendente_count ?? 0} NFs</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }}/>
              <div style={{ flex: 1, paddingLeft: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Já cobradas</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(cob.cobrado_valor)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{cob.cobrado_count ?? 0} NFs</div>
              </div>
            </div>
            <div style={{ padding: '10px 0' }}>
              {(cob.top_transportadores || []).length === 0 && (
                <div style={{ padding: '10px 18px', fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic' }}>Nenhuma cobrança pendente no período.</div>
              )}
              {(cob.top_transportadores || []).map((t) => {
                const maxVal = cob.top_transportadores[0]?.valor || 1;
                return (
                  <div key={t.transportador} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 18px' }}>
                    <span className="ellipsis" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', flex: '0 0 38%' }}>{t.transportador}</span>
                    <Bar valor={t.valor} max={maxVal} color="var(--gold)" height={5}/>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>{fmtBRL(t.valor)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, minWidth: 34, textAlign: 'right' }}>{t.qtd}x</span>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Linha 4: Detalhe mensal ──────────────────────── */}
      <Card title="Detalhe por mês" subtitle="Quantidade, valor total e clientes distintos por mês, no período selecionado" noPad>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Mês','NFs','Valor total','Clientes','Ticket médio','vs mês anterior'].map((h, i) => (
                <th key={h} style={{
                  padding: '9px 16px', textAlign: i > 0 ? 'right' : 'left',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '.07em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.map((m, i) => {
              const ant = ev[i - 1];
              const varV = ant ? pct(m.valor, ant.valor) : null;
              const isMax = m.valor === Math.max(...ev.map(e => e.valor));
              const ticket = m.qtd > 0 ? m.valor / m.qtd : 0;
              return (
                <tr key={m.mes} style={{ background: isMax ? 'rgba(220,38,38,0.04)' : undefined }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {fmtMes(m.mes)}
                      {isMax && (
                        <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--red-dim)', color: 'var(--red)', padding: '1px 6px', borderRadius: 20 }}>PIOR</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{m.qtd}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{fmtBRL(m.valor)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{m.clientes}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{fmtBRL(ticket)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    {varV != null
                      ? <Delta atual={m.valor} anterior={ant.valor} invertido/>
                      : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface-2)' }}>
              <td style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--text)', fontSize: 12 }}>Total do período</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{d.totais?.qtd}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.valor)}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>{d.totais?.clientes}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.ticket_medio)}</td>
              <td/>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* ── Linha 5: Por área + Top motivos ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Por área responsável */}
        <Card title="Devoluções por área responsável" subtitle="Valor e quantidade no período" noPad>
          {(d.porArea || []).map((a, i) => {
            const cor = AREA_CORES[a.area] || '#9CA3AF';
            const maxVal = d.porArea[0]?.valor || 1;
            const pctV = Math.round((a.valor / (d.totais?.valor || 1)) * 100);
            return (
              <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < (d.porArea?.length||0)-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{a.area}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>{pctV}% · {a.qtd} NFs</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(a.valor)}</span>
                    </div>
                  </div>
                  <Bar valor={a.valor} max={maxVal} color={cor} height={5}/>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Top motivos */}
        <Card title="Top motivos de devolução" subtitle="Por valor devolvido no período" noPad>
          {(d.topMotivos || []).map((m, i) => {
            const cor = AREA_CORES[m.area] || '#9CA3AF';
            const maxVal = d.topMotivos[0]?.valor || 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: i < (d.topMotivos?.length||0)-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: cor, flexShrink: 0 }}/>
                      <span className="ellipsis" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{m.motivo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: cor + '18', padding: '1px 6px', borderRadius: 20 }}>{m.area?.split(' ')[0]}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{m.qtd}x</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(m.valor)}</span>
                    </div>
                  </div>
                  <Bar valor={m.valor} max={maxVal} color={cor} height={4}/>
                </div>
              </div>
            );
          })}
        </Card>

      </div>

    </div>
  );
}
