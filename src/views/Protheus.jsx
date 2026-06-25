import { useEffect, useRef, useState } from 'react';
import { supabase, syncAuthToken } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

// ── Ícones inline ──────────────────────────────────────────────────────────
const Ic = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IC_SYNC   = 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
const IC_UP     = 'M5 10l7-7m0 0l7 7m-7-7v18';
const IC_DOWN   = 'M19 14l-7 7m0 0l-7-7m7 7V3';
const IC_FLAT   = 'M5 12h14';
const IC_FILTER = 'M3 4h18M7 8h10M11 12h2';

const fmtMes = m => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(mo)-1]}/${y.slice(2)}`;
};

const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—';

const variacao = (atual, anterior) => {
  if (!anterior || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
};

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'var(--accent)', delta, deltaLabel }) {
  const deltaOk = delta !== null && delta !== undefined;
  const up = deltaOk && delta > 0;
  const down = deltaOk && delta < 0;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6,
      borderTop: `3px solid ${color}`,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>}
        {deltaOk && (
          <span style={{
            fontSize: 11, fontWeight: 700, display: 'flex', gap: 3, alignItems: 'center',
            color: up ? '#22c55e' : down ? '#ef4444' : 'var(--text-3)',
          }}>
            <Ic d={up ? IC_UP : down ? IC_DOWN : IC_FLAT} size={10} />
            {Math.abs(delta).toFixed(1)}% {deltaLabel || 'vs mês ant.'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Gráfico de linha SVG ───────────────────────────────────────────────────
function LineChart({ data, valueKey = 'valor', labelKey = 'mes', color = 'var(--accent)', height = 140 }) {
  if (!data?.length) return null;
  const W = 600, H = height;
  const PAD = { t: 10, r: 20, b: 28, l: 56 };
  const vals = data.map(d => d[valueKey] || 0);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;

  const x = i => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - (v - minV) / range) * (H - PAD.t - PAD.b);

  const pts = data.map((d, i) => `${x(i)},${y(d[valueKey] || 0)}`).join(' ');
  const area = `M${x(0)},${y(0)} ` + data.map((d, i) => `L${x(i)},${y(d[valueKey] || 0)}`).join(' ') +
    ` L${x(data.length-1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;

  // grades horizontais
  const ticks = 4;
  const grades = Array.from({ length: ticks + 1 }, (_, i) => minV + (range * i / ticks));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grades */}
      {grades.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)}
            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end"
            style={{ fontSize: 9, fill: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
            {v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* área */}
      <path d={area} fill="url(#lg)" />

      {/* linha */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

      {/* pontos e labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d[valueKey] || 0)} r={3.5} fill={color} />
          <text x={x(i)} y={H - PAD.b + 14} textAnchor="middle"
            style={{ fontSize: 9, fill: 'var(--text-3)' }}>
            {fmtMes(d[labelKey])}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Gráfico barras duplas SVG ──────────────────────────────────────────────
function BarDualChart({ data, height = 130 }) {
  if (!data?.length) return null;
  const W = 600, H = height;
  const PAD = { t: 10, r: 16, b: 28, l: 56 };
  const maxV = Math.max(...data.map(d => (d.valor_no_portal || 0) + (d.valor_fora_portal || 0)), 1);
  const bw = ((W - PAD.l - PAD.r) / data.length) * 0.72;
  const gap = ((W - PAD.l - PAD.r) / data.length) * 0.28;
  const bh = H - PAD.t - PAD.b;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {/* grade */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const yy = PAD.t + (1 - f) * bh;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={PAD.l - 6} y={yy + 3.5} textAnchor="end"
              style={{ fontSize: 9, fill: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {`${((maxV * f) / 1000).toFixed(0)}k`}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const slotW = (W - PAD.l - PAD.r) / data.length;
        const cx = PAD.l + i * slotW + slotW / 2;
        const hP = ((d.valor_no_portal || 0) / maxV) * bh;
        const hF = ((d.valor_fora_portal || 0) / maxV) * bh;
        const yBase = PAD.t + bh;
        const half = bw / 2 - 1;

        return (
          <g key={i}>
            {/* barra portal */}
            <rect x={cx - half - 1} y={yBase - hP} width={half} height={Math.max(hP, 1)}
              fill="var(--accent)" rx={2} opacity={0.85} />
            {/* barra fora portal */}
            <rect x={cx + 1} y={yBase - hF} width={half} height={Math.max(hF, 1)}
              fill="#e74c3c" rx={2} opacity={0.75} />
            <text x={cx} y={H - PAD.b + 14} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--text-3)' }}>
              {fmtMes(d.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Ranking horizontal ─────────────────────────────────────────────────────
function HBar({ items, valueKey = 'valor', labelKey = 'cliente', color = 'var(--accent)', limit = 8 }) {
  if (!items?.length) return <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '12px 0' }}>Sem dados</div>;
  const top = items.slice(0, limit);
  const maxV = top[0]?.[valueKey] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top.map((item, i) => {
        const w = Math.round((item[valueKey] / maxV) * 100);
        const label = (item[labelKey] || '—').trim().slice(0, 32);
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{label}</span>
              <span style={{ color: 'var(--text-2)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmtBRL(item[valueKey])}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: w + '%', height: '100%', background: color, borderRadius: 4,
                transition: 'width 0.4s ease' }} />
            </div>
            {item.qtd !== undefined && (
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                {item.qtd} NF{item.qtd !== 1 ? 'Ds' : 'D'}
                {item.qtd_no_portal !== undefined && (
                  <span style={{ marginLeft: 8, color: 'var(--accent)' }}>
                    {item.qtd_no_portal} no portal
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tabela evolução compacta ───────────────────────────────────────────────
function EvolucaoTable({ data }) {
  if (!data?.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Mês', 'NFDs', 'Valor total', 'No portal', 'Só Protheus', 'Variação'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Mês' ? 'left' : 'right',
                color: 'var(--text-3)', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const prev = data[i - 1];
            const v = variacao(r.valor, prev?.valor);
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '7px 10px', fontWeight: 700 }}>{fmtMes(r.mes)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)' }}>{r.qtd}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtBRL(r.valor)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--accent)' }}>{fmtBRL(r.valor_no_portal)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e74c3c' }}>{fmtBRL(r.valor_fora_portal)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  {v === null ? <span style={{ color: 'var(--text-3)' }}>—</span> : (
                    <span style={{ color: v > 0 ? '#ef4444' : '#22c55e', fontWeight: 700, fontSize: 11 }}>
                      {v > 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Card container ─────────────────────────────────────────────────────────
function Card({ title, sub, children, span = 1 }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '18px 20px', gridColumn: `span ${span}`,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ── View principal ─────────────────────────────────────────────────────────
export default function Protheus() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({
    dt_inicio: '2026-01-01',
    dt_fim: new Date().toISOString().slice(0, 10),
    status: '',
  });
  const debRef = useRef(null);

  const load = async (f) => {
    setLoading(true);
    try {
      syncAuthToken();
      const { data: res, error } = await supabase.rpc('get_protheus_data', {
        p_inicio: f.dt_inicio || null,
        p_fim:    f.dt_fim    || null,
        p_status: f.status    || null,
        p_motivo: null,
        p_cliente: null,
      });
      if (error) throw error;
      setData(res);
    } catch (e) {
      console.error('get_protheus_data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filters); }, []); // eslint-disable-line

  const applyFilter = patch => {
    const next = { ...filters, ...patch };
    setFilters(next);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(next), 300);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const hoje = new Date();
      const d4 = new Date(hoje); d4.setDate(d4.getDate() - 4);
      const resp = await fetch('https://opcrtjdnpgqcjlksofjw.supabase.co/functions/v1/sync-protheus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: d4.toISOString().slice(0, 10),
          end_date:   hoje.toISOString().slice(0, 10),
        }),
      });
      const res = await resp.json();
      alert(`Sync concluído!\n${res.atualizados} novas · ${res.ja_lancados} atualizadas · ${res.nao_encontrados_count} fora do portal`);
      load(filters);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const kpis    = data?.kpis     || {};
  const evolucao= data?.evolucao  || [];
  const clientes= data?.top_clientes || [];
  const motivos = data?.por_motivo   || [];

  // Calcula variação do último mês vs penúltimo
  const ultMes  = evolucao[evolucao.length - 1];
  const pentMes = evolucao[evolucao.length - 2];
  const deltaUlt = variacao(ultMes?.valor, pentMes?.valor);

  // Cobertura portal
  const coberturaPortal = kpis.total_lancamentos > 0
    ? (kpis.total_no_portal / kpis.total_lancamentos) * 100 : 0;

  // Ticket médio
  const ticketMedio = kpis.total_lancamentos > 0
    ? kpis.total_valor / kpis.total_lancamentos : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Topbar filtros ── */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Ic d={IC_FILTER} size={13} />
        <input type="date" value={filters.dt_inicio}
          onChange={e => applyFilter({ dt_inicio: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text-1)' }} />
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>até</span>
        <input type="date" value={filters.dt_fim}
          onChange={e => applyFilter({ dt_fim: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text-1)' }} />

        <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text-1)' }}>
          <option value="">Todos</option>
          <option value="no_portal">Vinculado ao portal</option>
          <option value="fora_portal">Somente Protheus</option>
        </select>

        <button onClick={handleSync} disabled={syncing}
          style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--text-2)', borderRadius: 6, padding: '5px 12px', fontSize: 12,
            cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', opacity: syncing ? 0.6 : 1 }}>
          <Ic d={IC_SYNC} size={12} /> {syncing ? 'Sincronizando…' : 'Sync agora'}
        </button>
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 13 }}>
            Carregando dados…
          </div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <KpiCard
                label="Total lançado Protheus"
                value={fmtBRL(kpis.total_valor || 0)}
                sub={`${kpis.total_lancamentos || 0} NFDs`}
                color="var(--accent)"
                delta={deltaUlt}
                deltaLabel="vs mês ant."
              />
              <KpiCard
                label="Ticket médio / NFD"
                value={fmtBRL(ticketMedio)}
                sub={`${kpis.clientes_distintos || 0} clientes`}
                color="#8b5cf6"
              />
              <KpiCard
                label="Cobertura no portal"
                value={`${coberturaPortal.toFixed(1)}%`}
                sub={`${kpis.total_no_portal || 0} de ${kpis.total_lancamentos || 0} NFDs`}
                color="var(--accent)"
              />
              <KpiCard
                label="Fora do portal"
                value={fmtBRL(kpis.valor_fora_portal || 0)}
                sub={`${kpis.total_fora_portal || 0} NFDs sem correspondência OOBJ`}
                color="#e74c3c"
              />
            </div>

            {/* ── Evolução mensal — gráfico de linha ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <Card title="Evolução mensal de lançamentos no Protheus"
                sub="Valor total escriturado por mês de digitação — linha cheia = total">
                <LineChart data={evolucao} valueKey="valor" labelKey="mes" height={150} />
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 11, color: 'var(--text-3)' }}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 12, height: 3, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }}/>
                    Total escriturado
                  </span>
                </div>
              </Card>
            </div>

            {/* ── Barras empilhadas + tabela ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <Card title="Portal vs. Somente Protheus por mês"
                sub="Azul = vinculado ao portal · Vermelho = só no Protheus (sem NFD no OOBJ)">
                <BarDualChart data={evolucao} height={120} />
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)' }}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }}/>
                    Vinculado ao portal
                  </span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, background: '#e74c3c', display: 'inline-block', borderRadius: 2 }}/>
                    Somente Protheus
                  </span>
                </div>
              </Card>

              <Card title="Detalhe mensal" sub="Variação ▲ ruim (mais devoluções) · ▼ bom">
                <EvolucaoTable data={evolucao} />
              </Card>
            </div>

            {/* ── Rankings ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card title="Maiores clientes por valor escriturado"
                sub="Top 8 — baseado no valor lançado no Protheus no período">
                <HBar items={clientes} valueKey="valor" labelKey="cliente" color="var(--accent)" />
              </Card>

              <Card title="Por motivo de devolução"
                sub="Distribuição do valor escriturado por motivo">
                <HBar items={motivos} valueKey="valor" labelKey="motivo" color="#8b5cf6" limit={8} />
              </Card>
            </div>

            {/* ── Insight automático ── */}
            {evolucao.length >= 2 && (
              <div style={{
                background: deltaUlt > 15 ? '#ef444418' : deltaUlt < -15 ? '#22c55e18' : 'var(--surface)',
                border: `1px solid ${deltaUlt > 15 ? '#ef4444' : deltaUlt < -15 ? '#22c55e' : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 18px', fontSize: 12,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18 }}>
                  {deltaUlt > 15 ? '⚠️' : deltaUlt < -15 ? '✅' : 'ℹ️'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                    {deltaUlt > 15
                      ? `Alta de ${deltaUlt.toFixed(1)}% no último mês`
                      : deltaUlt < -15
                      ? `Queda de ${Math.abs(deltaUlt).toFixed(1)}% no último mês`
                      : 'Estável no último mês'}
                  </div>
                  <div style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {fmtMes(ultMes?.mes)}: <strong>{fmtBRL(ultMes?.valor)}</strong> em{' '}
                    <strong>{ultMes?.qtd} NFDs</strong> escrituradas.
                    {pentMes && ` Em ${fmtMes(pentMes.mes)} foram ${fmtBRL(pentMes.valor)} (${pentMes.qtd} NFDs).`}
                    {' '}O maior cliente do período é{' '}
                    <strong>{clientes[0]?.cliente?.trim()?.split(' ').slice(0, 3).join(' ')}</strong>{' '}
                    com {fmtBRL(clientes[0]?.valor)}.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
