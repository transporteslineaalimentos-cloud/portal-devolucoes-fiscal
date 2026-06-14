import { useEffect, useState } from 'react';
import { dbGetKpis, dbGetDashboard } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

/* ───────────────────────────────────────────────────────────
   Paleta de dados — tons dessaturados, harmonizados entre si.
   Identidade visual vem dos ícones e acentos sutis, nunca de
   blocos de cor pura.
─────────────────────────────────────────────────────────── */
const PAL = {
  accent:  '#4263EB',   // azul primário (gráficos)
  red:     '#D6494E',   // alerta / pior mês
  green:   '#2F9E68',   // positivo
  amber:   '#C97F2B',   // transporte
  violet:  '#7D6FC0',   // qualidade
  gray:    '#98A1AD',   // neutro / sem classificação
};

const AREA_CORES = {
  'COMERCIAL':         PAL.accent,
  'TRANSPORTE':        PAL.amber,
  'QUALIDADE':         PAL.violet,
  'FISCAL':            PAL.red,
  'CONTROLADORIA':     '#5B7A99',
  'LOGÍSTICA REVERSA': PAL.green,
  'LOGÍSTICA':         PAL.green,
  'TI':                '#0EA5E9',
  'CUSTOMER SERVICE':  '#DB2777',
  'A VALIDAR':         PAL.gray,
  'SEM CLASSIFICAÇÃO': PAL.gray,
};

/* ─── Helpers ─────────────────────────────────────────────── */
const fmtMes = (s) => {
  if (!s) return '';
  const [y, m] = s.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m,10)-1]}/${y.slice(2)}`;
};
const pct = (a, b) => b === 0 ? null : Math.round(((a - b) / b) * 100);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nf = (v) => (v ?? 0).toLocaleString('pt-BR');

const Ic = ({ d, size = 15, color = 'currentColor', stroke = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

/* ─── Tipografia utilitária ───────────────────────────────── */
const T = {
  overline: { fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' },
  label:    { fontSize: 12, fontWeight: 500, color: 'var(--text-2)' },
  value:    { fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  meta:     { fontSize: 11, fontWeight: 400, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' },
};

/* ─── Barra de progresso fina ─────────────────────────────── */
function Bar({ valor, max, color = PAL.accent, height = 4 }) {
  const w = max > 0 ? clamp((valor / max) * 100, 1.5, 100) : 0;
  return (
    <div style={{ height, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, opacity: 0.75, borderRadius: 99, transition: 'width 600ms cubic-bezier(.4,0,.2,1)' }}/>
    </div>
  );
}

/* ─── Variação percentual — texto puro, sem chip pesado ───── */
function Delta({ atual, anterior, invertido = false }) {
  if (anterior == null || anterior === 0) return null;
  const diff = pct(atual, anterior);
  if (diff == null) return null;
  const positivo = invertido ? diff < 0 : diff > 0;
  const cor = diff === 0 ? 'var(--text-3)' : positivo ? PAL.green : PAL.red;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}{Math.abs(diff)}%
    </span>
  );
}

/* ─── Card ────────────────────────────────────────────────── */
function Card({ title, subtitle, children, action, noPad = false }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,25,35,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '16px 20px 14px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, fontWeight: 400 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={noPad ? { flex: 1 } : { padding: '4px 20px 20px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── KPI — borda neutra, identidade só no ícone ──────────── */
function KpiMini({ label, value, sub, hue, icon, delta, deltaInv, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'kpi-clickable' : undefined}
      style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '18px 20px',
      boxShadow: '0 1px 2px rgba(15,25,35,0.04)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={T.overline}>{label}</span>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: hue + '14',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Ic d={icon} size={14} color={hue}/>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 650, color: 'var(--text)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, minHeight: 16 }}>
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
        {delta != null && <Delta atual={delta.atual} anterior={delta.anterior} invertido={deltaInv}/>}
      </div>
    </div>
  );
}

/* ─── Gráfico de linha — gridlines + gradiente fade-out ───── */
function TrendChart({ data, valueKey, labelKey, color = PAL.accent, height = 150, formatValue = fmtBRL, onPointClick }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <Empty height={height}/>;

  const vals = data.map(d => d[valueKey]);
  const maxVal = Math.max(...vals, 1);
  const minVal = Math.min(...vals, 0);
  const range = (maxVal - minVal) || 1;
  const padTop = 14, padBottom = 4;

  const pts = data.map((d, i) => ({
    xPct: data.length > 1 ? (i / (data.length - 1)) * 100 : 50,
    yPct: padTop + (1 - (d[valueKey] - minVal) / range) * (100 - padTop - padBottom),
    d,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPct}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].xPct} 100 L ${pts[0].xPct} 100 Z`;
  const gradId = `tg-${valueKey}`;

  return (
    <div style={{ position: 'relative', height, marginBottom: 22 }}>
      {/* Gridlines horizontais */}
      {[25, 50, 75].map(y => (
        <div key={y} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, borderTop: '1px dashed var(--surface-3)' }}/>
      ))}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={color} stopOpacity="0.14"/>
            <stop offset="55%" stopColor={color} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} stroke="none"/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          strokeLinejoin="round" strokeLinecap="round"/>
      </svg>

      {pts.map((p, i) => (
        <div key={i}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          onClick={onPointClick ? () => onPointClick(p.d, i) : undefined}
          style={{
            position: 'absolute', left: `${p.xPct}%`, top: `${p.yPct}%`,
            transform: 'translate(-50%, -50%)', cursor: onPointClick ? 'pointer' : 'default',
            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div style={{
            width: hovered === i ? 7 : 5, height: hovered === i ? 7 : 5, borderRadius: '50%',
            background: hovered === i ? color : 'var(--surface)', border: `1.5px solid ${color}`,
            transition: 'width 100ms, height 100ms, background 100ms',
          }}/>
          {hovered === i && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: 7, padding: '5px 9px', borderRadius: 6,
              background: 'var(--text)', color: '#fff',
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
              boxShadow: 'var(--shadow-md)', zIndex: 3,
            }}>
              {formatValue(p.d[valueKey])}
              <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>{p.d[labelKey]}</span>
            </div>
          )}
        </div>
      ))}

      <div style={{ position: 'absolute', bottom: -22, left: 0, right: 0, display: 'flex', justifyContent: 'space-between' }}>
        {data.map((d, i) => (
          <span key={i} style={{
            fontSize: 10.5, color: hovered === i ? 'var(--text)' : 'var(--text-3)',
            fontWeight: 500, flex: 1, textAlign: 'center', transition: 'color 100ms',
          }}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Gráfico de colunas — tons suaves, pior mês destacado ── */
function ColumnChart({ data, valueKey, labelKey, color = PAL.accent, highlightColor = PAL.red, height = 150, formatValue = (v) => v, onColumnClick }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <Empty height={height}/>;

  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const maxIdx = data.reduce((best, d, i) => d[valueKey] > data[best][valueKey] ? i : best, 0);

  return (
    <div style={{ position: 'relative', height, paddingBottom: 22 }}>
      {[25, 50, 75].map(y => (
        <div key={y} style={{ position: 'absolute', left: 0, right: 0, top: `${y * (height - 22) / 100}px`, borderTop: '1px dashed var(--surface-3)' }}/>
      ))}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '8%', position: 'relative' }}>
        {data.map((d, i) => {
          const h = Math.max((d[valueKey] / maxVal) * 100, 2);
          const isWorst = i === maxIdx;
          const fill = isWorst ? highlightColor : color;
          return (
            <div key={i}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              onClick={onColumnClick ? () => onColumnClick(d, i) : undefined}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative', cursor: onColumnClick ? 'pointer' : 'default' }}>
              {hovered === i && (
                <div style={{
                  position: 'absolute', bottom: `calc(${h}% + 9px)`, left: '50%', transform: 'translateX(-50%)',
                  padding: '5px 9px', borderRadius: 6, background: 'var(--text)', color: '#fff',
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  boxShadow: 'var(--shadow-md)', zIndex: 3,
                }}>
                  {formatValue(d[valueKey])}
                  <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>{d[labelKey]}</span>
                </div>
              )}
              <div style={{
                width: '100%', height: `${h}%`, borderRadius: '3px 3px 0 0',
                background: fill,
                opacity: hovered === i ? 0.95 : isWorst ? 0.8 : 0.6,
                transition: 'height 500ms cubic-bezier(.4,0,.2,1), opacity 120ms',
              }}/>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '8%' }}>
        {data.map((d, i) => (
          <span key={i} style={{
            flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: 500,
            color: hovered === i ? 'var(--text)' : 'var(--text-3)', transition: 'color 100ms',
          }}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty({ height = 120 }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>
      Sem dados no período
    </div>
  );
}

/* ─── Linha divisória de listas ───────────────────────────── */
const rowBorder = (i, len) => ({ borderBottom: i < len - 1 ? '1px solid var(--surface-3)' : 'none' });

/* ─── Filtro de período — segmented control ───────────────── */
function shiftMonths(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function PeriodFilter({ value, onChange }) {
  const presets = [
    { key: '2026', label: '2026',    inicio: '2026-01-01',  fim: todayISO() },
    { key: '6m',   label: '6 meses', inicio: shiftMonths(-6), fim: todayISO() },
    { key: '3m',   label: '3 meses', inicio: shiftMonths(-3), fim: todayISO() },
    { key: 'mes',  label: 'Mês atual', inicio: startOfMonth(), fim: todayISO() },
  ];
  const activeKey = presets.find(p => p.inicio === value.inicio && p.fim === value.fim)?.key;

  const dateInputStyle = {
    width: 126, fontSize: 12, padding: '6px 9px',
    border: '1px solid var(--border)', borderRadius: 7,
    background: 'var(--surface)', color: 'var(--text-2)',
    fontVariantNumeric: 'tabular-nums', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{
        display: 'inline-flex', gap: 2, padding: 3,
        background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9,
      }}>
        {presets.map(p => {
          const active = activeKey === p.key;
          return (
            <button key={p.key}
              onClick={() => onChange({ inicio: p.inicio, fim: p.fim })}
              style={{
                padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: 'inherit',
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-3)',
                boxShadow: active ? '0 1px 3px rgba(15,25,35,0.10)' : 'none',
                transition: 'all 120ms',
              }}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <input type="date" value={value.inicio} max={value.fim}
          onChange={e => onChange({ ...value, inicio: e.target.value })}
          style={dateInputStyle}/>
        <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>—</span>
        <input type="date" value={value.fim} min={value.inicio} max={todayISO()}
          onChange={e => onChange({ ...value, fim: e.target.value })}
          style={dateInputStyle}/>
      </div>
    </div>
  );
}

/* ═══ DASHBOARD ════════════════════════════════════════════ */
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

  // Drill-down: abre Devoluções com período atual + filtro específico
  const goDev = (extra = {}) => {
    const base = { dt_inicio: periodo.inicio, dt_fim: periodo.fim };
    // Se filtra por mês específico, ignora o range do período (o mês é mais preciso)
    if (extra.mes) { delete base.dt_inicio; delete base.dt_fim; }
    onGoTo?.('devolucoes', { ...base, ...extra });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filtro de período ────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PeriodFilter value={periodo} onChange={setPeriodo}/>
        <span style={{
          fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6,
          opacity: loading ? 1 : 0, transition: 'opacity 200ms',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ animation: 'spin 0.9s linear infinite' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
          </svg>
          Atualizando
        </span>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiMini
          label="Devoluções"
          value={nf(k.total_count)}
          sub={fmtBRL(k.total_valor)}
          hue={PAL.accent}
          icon="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1"
          delta={mesAtual && mesAnt ? { atual: mesAtual.qtd, anterior: mesAnt.qtd } : null}
          deltaInv
          onClick={() => goDev()}
        />
        <KpiMini
          label="Pendentes de análise"
          value={nf(k.pendente_count)}
          sub={fmtBRL(k.pendente_valor)}
          hue={PAL.amber}
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          onClick={() => goDev({ status: 'pendente' })}
        />
        <KpiMini
          label="Ticket médio"
          value={d.totais?.ticket_medio ? fmtBRL(d.totais.ticket_medio) : '—'}
          sub={`${nf(d.totais?.clientes)} clientes distintos`}
          hue={PAL.violet}
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          onClick={() => goDev()}
        />
        <KpiMini
          label="Cobrança transportador"
          value={nf(cob.pendente_count)}
          sub={`${fmtBRL(cob.pendente_valor)} pendente`}
          hue={PAL.red}
          icon="M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z"
          onClick={() => onGoTo?.('cobrancas', { status_cobranca: 'pendente_cobranca_transportador' })}
        />
      </div>

      {/* ── Evolução ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <Card title="Valor devolvido" subtitle="R$ por mês de emissão da NF de devolução">
          <TrendChart data={evComLabel} valueKey="valor" labelKey="label" color={PAL.accent} height={150} formatValue={fmtBRL}
            onPointClick={(pt) => goDev({ mes: pt.mes })}/>
          {mesAtual && mesAnt && (
            <div style={{ display: 'flex', gap: 20, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--surface-3)' }}>
              <div>
                <div style={{ ...T.overline, marginBottom: 4 }}>{fmtMes(mesAnt.mes)}</div>
                <div style={{ ...T.value, fontSize: 14 }}>{fmtBRL(mesAnt.valor)}</div>
              </div>
              <div>
                <div style={{ ...T.overline, marginBottom: 4 }}>{fmtMes(mesAtual.mes)} · atual</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ ...T.value, fontSize: 14 }}>{fmtBRL(mesAtual.valor)}</span>
                  <Delta atual={mesAtual.valor} anterior={mesAnt.valor} invertido/>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Quantidade de NFs" subtitle="Devoluções emitidas por mês">
          <ColumnChart data={evComLabel} valueKey="qtd" labelKey="label" color={PAL.accent} highlightColor={PAL.red} height={150} formatValue={(v) => `${v} NFs`}
            onColumnClick={(c) => goDev({ mes: c.mes })}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--surface-3)' }}>
            {[
              { label: 'Pior mês · qtd',   value: d.piorMesQtd ? `${fmtMes(d.piorMesQtd.mes)} — ${d.piorMesQtd.qtd} NFs` : '—' },
              { label: 'Pior mês · valor', value: d.piorMesValor ? `${fmtMes(d.piorMesValor.mes)} — ${fmtBRL(d.piorMesValor.valor)}` : '—' },
              { label: 'Média mensal',     value: ev.length ? `${Math.round(ev.reduce((s,m)=>s+m.qtd,0)/ev.length)} NFs` : '—' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ ...T.overline, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Rankings ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Top clientes — grid rígido: rank | nome+barra | NFs | valor */}
        <Card title="Top 10 clientes" subtitle="Por valor devolvido no período" noPad>
          <div style={{ padding: '0 20px 14px' }}>
            {(d.topClientes || []).map((c, i, arr) => {
              const maxVal = arr[0]?.valor || 1;
              const share = Math.round((c.valor / (d.totais?.valor || 1)) * 100);
              return (
                <div key={c.cnpj} className="drill-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0,1fr) 64px 104px',
                  alignItems: 'center', columnGap: 12,
                  padding: '9px 0', ...rowBorder(i, arr.length),
                }}
                onClick={() => goDev({ cnpj_emitente: c.cnpj })}
                title={`Ver devoluções de ${c.nome}`}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: i < 3 ? 'var(--text-2)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>
                      {c.nome}
                    </div>
                    <Bar valor={c.valor} max={maxVal} color={PAL.accent} height={3}/>
                  </div>
                  <span style={{ ...T.meta, textAlign: 'right' }}>{c.qtd} NFs · {c.uf}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ ...T.value, fontSize: 12.5 }}>{fmtBRL(c.valor)}</span>
                    <span style={{ ...T.meta, marginLeft: 6 }}>{share}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Top UFs — grid rígido: UF | barra | valor | NFs */}
          <Card title="Estados" subtitle="Origem das devoluções, por valor" noPad>
            <div style={{ padding: '0 20px 14px' }}>
              {(d.topUfs || []).map((u, i, arr) => {
                const maxVal = arr[0]?.valor || 1;
                return (
                  <div key={u.uf} className="drill-row" style={{
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0,1fr) 100px 56px',
                    alignItems: 'center', columnGap: 12,
                    padding: '8px 0', ...rowBorder(i, arr.length),
                  }}
                  onClick={() => goDev({ uf: u.uf })}
                  title={`Ver devoluções de ${u.uf}`}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.02em' }}>{u.uf}</span>
                    <Bar valor={u.valor} max={maxVal} color={PAL.accent} height={4}/>
                    <span style={{ ...T.value, fontSize: 12.5, textAlign: 'right' }}>{fmtBRL(u.valor)}</span>
                    <span style={{ ...T.meta, textAlign: 'right' }}>{u.qtd} NFs</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Cobranças a transportadores */}
          <Card title="Cobranças a transportadores" subtitle="Responsabilidade do transporte · lançadas no Protheus" noPad
            action={
              <button onClick={() => onGoTo?.('cobrancas')}
                style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)', fontFamily: 'inherit',
                }}>
                Ver tudo →
              </button>
            }>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--surface-3)' }}>
              <div className="drill-row" style={{ padding: '12px 20px', borderRight: '1px solid var(--surface-3)' }}
                onClick={() => onGoTo?.('cobrancas', { status_cobranca: 'pendente_cobranca_transportador' })}>
                <div style={{ ...T.overline, marginBottom: 5 }}>Pendentes</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: 17, fontWeight: 650, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtBRL(cob.pendente_valor)}</span>
                  <span style={T.meta}>{nf(cob.pendente_count)} NFs</span>
                </div>
              </div>
              <div className="drill-row" style={{ padding: '12px 20px' }}
                onClick={() => onGoTo?.('cobrancas', { status_cobranca: 'cobrado' })}>
                <div style={{ ...T.overline, marginBottom: 5 }}>Já cobradas</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: 17, fontWeight: 650, color: PAL.green, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtBRL(cob.cobrado_valor)}</span>
                  <span style={T.meta}>{nf(cob.cobrado_count)} NFs</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 20px 14px' }}>
              {(cob.top_transportadores || []).length === 0 && (
                <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)' }}>Nenhuma cobrança pendente no período.</div>
              )}
              {(cob.top_transportadores || []).map((t, i, arr) => {
                const maxVal = arr[0]?.valor || 1;
                return (
                  <div key={t.transportador} className="drill-row" style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,42%) minmax(0,1fr) 96px 40px',
                    alignItems: 'center', columnGap: 12,
                    padding: '8px 0', ...rowBorder(i, arr.length),
                  }}
                  onClick={() => onGoTo?.('cobrancas', { status_cobranca: 'pendente_cobranca_transportador', transportador: t.transportador })}
                  title={`Ver cobranças de ${t.transportador}`}>
                    <span className="ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{t.transportador}</span>
                    <Bar valor={t.valor} max={maxVal} color={PAL.amber} height={4}/>
                    <span style={{ ...T.value, fontSize: 12.5, textAlign: 'right' }}>{fmtBRL(t.valor)}</span>
                    <span style={{ ...T.meta, textAlign: 'right' }}>{t.qtd}×</span>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Detalhe mensal ───────────────────────────────── */}
      <Card title="Detalhe por mês" subtitle="Quantidade, valor e clientes distintos no período selecionado" noPad>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Mês','NFs','Valor total','Clientes','Ticket médio','Variação'].map((h, i) => (
                <th key={h} style={{
                  padding: '8px 20px', textAlign: i > 0 ? 'right' : 'left',
                  ...T.overline, fontSize: 10,
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.map((m, i) => {
              const ant = ev[i - 1];
              const isMax = m.valor === Math.max(...ev.map(e => e.valor));
              const ticket = m.qtd > 0 ? m.valor / m.qtd : 0;
              const cell = { padding: '10px 20px', textAlign: 'right', borderBottom: '1px solid var(--surface-3)', fontVariantNumeric: 'tabular-nums' };
              return (
                <tr key={m.mes} className="drill-row" style={{ cursor: 'pointer' }}
                  onClick={() => goDev({ mes: m.mes })} title={`Ver devoluções de ${fmtMes(m.mes)}`}>
                  <td style={{ ...cell, textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {fmtMes(m.mes)}
                      {isMax && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PAL.red, display: 'inline-block' }} title="Pior mês em valor"/>
                      )}
                    </span>
                  </td>
                  <td style={{ ...cell, fontWeight: 500, color: 'var(--text-2)' }}>{m.qtd}</td>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--text)' }}>{fmtBRL(m.valor)}</td>
                  <td style={{ ...cell, color: 'var(--text-2)' }}>{m.clientes}</td>
                  <td style={{ ...cell, color: 'var(--text-2)' }}>{fmtBRL(ticket)}</td>
                  <td style={cell}>
                    {ant
                      ? <Delta atual={m.valor} anterior={ant.valor} invertido/>
                      : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface-2)' }}>
              <td style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>Total do período</td>
              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d.totais?.qtd}</td>
              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 650, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.valor)}</td>
              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 500, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{d.totais?.clientes}</td>
              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 500, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.ticket_medio)}</td>
              <td/>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* ── Áreas + Motivos ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <Card title="Áreas responsáveis" subtitle="Valor e participação no período" noPad>
          <div style={{ padding: '0 20px 14px' }}>
            {(d.porArea || []).map((a, i, arr) => {
              const cor = AREA_CORES[a.area] || PAL.gray;
              const maxVal = arr[0]?.valor || 1;
              const share = Math.round((a.valor / (d.totais?.valor || 1)) * 100);
              return (
                <div key={a.area} className="drill-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '8px minmax(0,1fr) 80px 104px',
                  alignItems: 'center', columnGap: 12,
                  padding: '10px 0', ...rowBorder(i, arr.length),
                }}
                onClick={() => goDev({ area: a.area })}
                title={`Ver devoluções da área ${a.area}`}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, opacity: 0.85 }}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>{a.area}</div>
                    <Bar valor={a.valor} max={maxVal} color={cor} height={3}/>
                  </div>
                  <span style={{ ...T.meta, textAlign: 'right' }}>{share}% · {a.qtd} NFs</span>
                  <span style={{ ...T.value, fontSize: 12.5, textAlign: 'right' }}>{fmtBRL(a.valor)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Motivos de devolução" subtitle="Por valor devolvido no período" noPad>
          <div style={{ padding: '0 20px 14px' }}>
            {(d.topMotivos || []).map((m, i, arr) => {
              const cor = AREA_CORES[m.area] || PAL.gray;
              const maxVal = arr[0]?.valor || 1;
              return (
                <div key={i} className="drill-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '8px minmax(0,1fr) 44px 104px',
                  alignItems: 'center', columnGap: 12,
                  padding: '8px 0', ...rowBorder(i, arr.length),
                }}
                onClick={() => goDev(m.motivo === 'SEM MOTIVO' ? { com_motivo: 'sem' } : { motivo: m.motivo })}
                title={`Ver devoluções: ${m.motivo}`}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, opacity: 0.85 }}/>
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>{m.motivo}</div>
                    <Bar valor={m.valor} max={maxVal} color={cor} height={3}/>
                  </div>
                  <span style={{ ...T.meta, textAlign: 'right' }}>{m.qtd}×</span>
                  <span style={{ ...T.value, fontSize: 12.5, textAlign: 'right' }}>{fmtBRL(m.valor)}</span>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

    </div>
  );
}
