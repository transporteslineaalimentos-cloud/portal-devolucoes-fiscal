import { useEffect, useState } from 'react';
import { dbGetKpis, dbGetDashboard } from '../config/supabase';
import { fmtBRL, fmtCNPJ } from '../utils.jsx';

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
const pct = (a, b) => b === 0 ? null : Math.round(((a - b) / b) * 100);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const CFOP_DESC = {
  '5201': 'Dev. venda p/ industrialização (estadual)',
  '5202': 'Dev. venda p/ comercialização (estadual)',
  '5410': 'Dev. de compra com ST (estadual)',
  '5411': 'Dev. de venda com ST (estadual)',
  '6201': 'Dev. venda p/ industrialização (interestadual)',
  '6202': 'Dev. venda p/ comercialização (interestadual)',
  '6410': 'Dev. de compra com ST (interestadual)',
  '6411': 'Dev. de venda com ST (interestadual)',
};

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
        background: 'var(--surface)',
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

// ─── Gráfico de barras verticais SVG ─────────────────────
function BarChart({ data, valueKey, labelKey, color = 'var(--blue)', colorAlt, height = 140 }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const barW = 100 / data.length;
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block', overflow: 'visible' }}>
        {data.map((d, i) => {
          const barH = (d[valueKey] / maxVal) * (height - 20);
          const x = i * barW + barW * 0.15;
          const w = barW * 0.7;
          const y = height - 16 - barH;
          const isPior = data.indexOf(data.slice().sort((a,b) => b[valueKey]-a[valueKey])[0]) === i;
          const fill = colorAlt && isPior ? colorAlt : color;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={x} y={y} width={w} height={barH}
                fill={fill} rx="2" opacity={hovered === i ? 1 : 0.85}
                style={{ transition: 'opacity 120ms, y 400ms, height 400ms' }}/>
              <text x={x + w/2} y={height - 3} textAnchor="middle"
                fontSize="4.5" fill="var(--text-3)" fontFamily="Inter,sans-serif">
                {d[labelKey]}
              </text>
              {hovered === i && (
                <text x={x + w/2} y={y - 3} textAnchor="middle"
                  fontSize="4.5" fill={fill} fontWeight="700" fontFamily="Inter,sans-serif">
                  {typeof d[valueKey] === 'number' && d[valueKey] > 1000
                    ? `R$${(d[valueKey]/1000).toFixed(0)}k`
                    : d[valueKey]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Linha de tendência SVG ───────────────────────────────
function LineChart({ data, valueKey, labelKey, color = 'var(--blue)', height = 100 }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const minVal = Math.min(...data.map(d => d[valueKey]), 0);
  const range = maxVal - minVal || 1;
  const pad = 8;
  const W = 200, H = height;

  const pts = data.map((d, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (W - pad*2),
    y: pad + (1 - (d[valueKey] - minVal) / range) * (H - pad*2),
    d,
  }));

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lg1)"/>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 3 : 2}
            fill={color} stroke="white" strokeWidth="1"
            style={{ cursor: 'pointer', transition: 'r 120ms' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}/>
        ))}
        {hovered != null && pts[hovered] && (
          <text x={pts[hovered].x} y={pts[hovered].y - 5} textAnchor="middle"
            fontSize="7" fill={color} fontWeight="700" fontFamily="Inter,sans-serif">
            {typeof pts[hovered].d[valueKey] === 'number' && pts[hovered].d[valueKey] > 1000
              ? `R$${(pts[hovered].d[valueKey]/1000).toFixed(0)}k`
              : pts[hovered].d[valueKey]}
          </text>
        )}
      </svg>
      {/* Labels no eixo X */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 500, flex: 1, textAlign: 'center' }}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── DASHBOARD PRINCIPAL ─────────────────────────────────
export default function Dashboard({ onGoTo }) {
  const [kpis, setKpis]     = useState(null);
  const [dash, setDash]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dbGetKpis(), dbGetDashboard()])
      .then(([k, d]) => { setKpis(k); setDash(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: 'var(--text-3)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
        style={{ animation: 'spin 0.9s linear infinite' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
      </svg>
      Carregando dashboard...
    </div>
  );

  const k = kpis || {};
  const d = dash || {};
  const ev = d.evolucao || [];
  const evComLabel = ev.map(m => ({ ...m, label: fmtMes(m.mes) }));
  const mesAtual = d.mesAtual;
  const mesAnt   = d.mesAnterior;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
          label="Pior mês — valor"
          value={d.piorMesValor ? fmtMes(d.piorMesValor.mes) : '—'}
          sub={d.piorMesValor ? `${fmtBRL(d.piorMesValor.valor)} · ${d.piorMesValor.qtd} NFs` : null}
          color="var(--red)"
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </div>

      {/* ── Linha 2: Gráficos de evolução ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <Card
          title="Evolução mensal — Valor devolvido"
          subtitle="R$ por mês de emissão da NF de devolução"
          accent="var(--blue)"
        >
          <LineChart data={evComLabel} valueKey="valor" labelKey="label" color="var(--blue)" height={110}/>
          {mesAtual && mesAnt && (
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
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
          <BarChart data={evComLabel} valueKey="qtd" labelKey="label" color="var(--purple)" colorAlt="var(--red)" height={110}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
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

      {/* ── Linha 3: Top clientes + Top UFs ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <Card title="Top 10 clientes por valor devolvido" subtitle="Acumulado 2026" noPad>
          {(d.topClientes || []).map((c, i) => {
            const maxVal = d.topClientes[0]?.valor || 1;
            const pctShare = Math.round((c.valor / (d.totais?.valor || 1)) * 100);
            return (
              <div key={c.cnpj} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 18px', borderBottom: i < 9 ? '1px solid var(--border)' : 'none',
              }}>
                {/* Rank */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: i < 3 ? ['var(--red-dim)','var(--yellow-dim)','var(--blue-dim)'][i] : 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  color: i < 3 ? ['var(--red)','var(--yellow)','var(--blue)'][i] : 'var(--text-3)',
                }}>
                  {i + 1}
                </div>
                {/* Nome + barra */}
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
              {(d.topUfs || []).map((u, i) => {
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

          {/* CFOPs */}
          <Card title="Distribuição por CFOP" subtitle="Tipo de operação de devolução">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(d.cfops || []).map((c, i) => {
                const maxQtd = d.cfops[0]?.qtd || 1;
                return (
                  <div key={c.cfop} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      background: 'var(--gold-dim)', color: 'var(--gold)',
                      border: '1px solid rgba(154,123,79,0.25)',
                      padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      flexShrink: 0, minWidth: 44, textAlign: 'center',
                    }}>{c.cfop}</span>
                    <Bar valor={c.qtd} max={maxQtd} color="var(--gold)" height={5}/>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>{c.qtd}x</span>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Linha 4: Detalhe mensal + status ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>

        <Card title="Detalhe por mês" subtitle="Quantidade, valor total e clientes distintos por mês de 2026" noPad>
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
                <td style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--text)', fontSize: 12 }}>Total 2026</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{d.totais?.qtd}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.valor)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>{d.totais?.clientes}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(d.totais?.ticket_medio)}</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </Card>

        {/* Status */}
        <Card title="Por status" subtitle="Situação atual">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
            {[
              { label: 'Pendente',    count: k.pendente_count,  color: '#9CA3AF', bg: '#F3F4F6' },
              { label: 'Em análise',  count: k.analise_count,   color: '#D97706', bg: '#FFFBEB' },
              { label: 'Concluídas',  count: k.concluida_count, color: '#16A34A', bg: '#F0FDF4' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: s.bg, border: `1px solid ${s.color}22`,
                gap: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                  {(s.count ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 4, padding: '10px 14px', background: 'var(--blue-dim)', borderRadius: 8, border: '1px solid var(--blue-mid)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{k.total_count?.toLocaleString('pt-BR') ?? '—'}</div>
            </div>
          </div>
        </Card>

      </div>

    </div>
  );
}
