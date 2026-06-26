import { useEffect, useRef, useState } from 'react';
import { supabase, syncAuthToken } from '../config/supabase';
import { fmtBRL } from '../utils.jsx';

/* ── Paleta e helpers (alinhados com Dashboard) ─────────────────────────── */
const PAL = {
  accent: '#4263EB', red: '#D6494E', green: '#2F9E68',
  amber: '#C97F2B', violet: '#7D6FC0', gray: '#98A1AD',
};
const T = {
  overline: { fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' },
  value:    { fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  meta:     { fontSize: 11, fontWeight: 400, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' },
};
const fmtMes = s => {
  if (!s) return '';
  const [y, m] = s.split('-');
  const n = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${n[parseInt(m,10)-1]}/${y.slice(2)}`;
};
const nf = v => (v ?? 0).toLocaleString('pt-BR');
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/* ── Delta % ─────────────────────────────────────────────────────────────── */
function Delta({ atual, anterior, invertido = false }) {
  if (!anterior) return null;
  const diff = Math.round(((atual - anterior) / anterior) * 100);
  const positivo = invertido ? diff < 0 : diff > 0;
  const cor = diff === 0 ? 'var(--text-3)' : positivo ? PAL.green : PAL.red;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cor, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}{Math.abs(diff)}%
    </span>
  );
}

/* ── Barra fina ──────────────────────────────────────────────────────────── */
function Bar({ valor, max, color = PAL.accent }) {
  const w = max > 0 ? clamp((valor / max) * 100, 1.5, 100) : 0;
  return (
    <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, opacity: 0.75, borderRadius: 99, transition: 'width 600ms cubic-bezier(.4,0,.2,1)' }} />
    </div>
  );
}

/* ── Card container ──────────────────────────────────────────────────────── */
function Card({ title, subtitle, children, action, noPad = false }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,25,35,0.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={noPad ? { flex: 1 } : { padding: '4px 20px 20px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* ── KPI card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, hue, icon, delta, deltaInv, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'kpi-clickable' : undefined}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 2px rgba(15,25,35,0.04)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={T.overline}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: hue + '14',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ic d={icon} size={14} color={hue} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 650, color: 'var(--text)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, minHeight: 16 }}>
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{sub}</span>}
        {delta != null && <Delta atual={delta.atual} anterior={delta.anterior} invertido={deltaInv} />}
      </div>
    </div>
  );
}

/* ── Gráfico de linha (mesmo padrão do Dashboard) ────────────────────────── */
function TrendChart({ data, valueKey, labelKey, color = PAL.accent, height = 150, onPointClick }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>Sem dados</div>;

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
  const gradId = `tg-prot-${valueKey}`;

  return (
    <div style={{ position: 'relative', height, marginBottom: 22 }}>
      {[25, 50, 75].map(y => (
        <div key={y} style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, borderTop: '1px dashed var(--surface-3)' }} />
      ))}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.14" />
            <stop offset="55%"  stopColor={color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} stroke="none" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      {pts.map((p, i) => (
        <div key={i}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          onClick={onPointClick ? () => onPointClick(p.d) : undefined}
          style={{
            position: 'absolute', left: `${p.xPct}%`, top: `${p.yPct}%`,
            transform: 'translate(-50%, -50%)', cursor: onPointClick ? 'pointer' : 'default',
            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div style={{
            width: hovered === i ? 7 : 5, height: hovered === i ? 7 : 5, borderRadius: '50%',
            background: hovered === i ? color : 'var(--surface)', border: `1.5px solid ${color}`,
            transition: 'width 100ms, height 100ms, background 100ms',
          }} />
          {hovered === i && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: 7, padding: '5px 9px', borderRadius: 6,
              background: 'var(--text)', color: '#fff',
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums', boxShadow: 'var(--shadow-md)', zIndex: 3,
            }}>
              {fmtBRL(p.d[valueKey])}
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

/* ── Gráfico barras duplas (portal vs fora) ──────────────────────────────── */
function BarDual({ data, onBarClick }) {
  const [hov, setHov] = useState(null);
  if (!data?.length) return null;
  const maxV = Math.max(...data.map(d => (d.valor_no_portal || 0) + (d.valor_fora_portal || 0)), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, paddingTop: 8 }}>
      {data.map((d, i) => {
        const hP = Math.max(((d.valor_no_portal || 0) / maxV) * 90, d.valor_no_portal > 0 ? 2 : 0);
        const hF = Math.max(((d.valor_fora_portal || 0) / maxV) * 90, d.valor_fora_portal > 0 ? 2 : 0);
        const isHov = hov === i;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            onClick={() => onBarClick?.(d)}
            title={`${fmtMes(d.mes)}: Portal ${fmtBRL(d.valor_no_portal)} · Só Protheus ${fmtBRL(d.valor_fora_portal)}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: onBarClick ? 'pointer' : 'default' }}>
            {isHov && (
              <div style={{
                position: 'relative', background: 'var(--text)', color: '#fff',
                fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5,
                whiteSpace: 'nowrap', marginBottom: 2,
              }}>
                {fmtBRL(d.valor_no_portal + d.valor_fora_portal)}
              </div>
            )}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 90 }}>
              {/* barra fora portal em cima (empilhada) */}
              <div style={{ width: '100%', height: `${hF}%`, background: PAL.red, borderRadius: '3px 3px 0 0', opacity: isHov ? 1 : 0.75, transition: 'opacity 100ms', minHeight: hF > 0 ? 2 : 0 }} />
              <div style={{ width: '100%', height: `${hP}%`, background: PAL.accent, opacity: isHov ? 1 : 0.8, transition: 'opacity 100ms', minHeight: hP > 0 ? 2 : 0 }} />
            </div>
            <span style={{ fontSize: 9.5, color: isHov ? 'var(--text)' : 'var(--text-3)', fontWeight: 500, transition: 'color 100ms' }}>
              {fmtMes(d.mes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Modal drill-down: lista de notas do grupo clicado ───────────────────── */
function DrillModal({ title, items, onClose }) {
  if (!items) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: 680, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{items.length} NFDs · {fmtBRL(items.reduce((s, i) => s + (i.valor_total || 0), 0))}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-3)', lineHeight: 1, padding: '4px 8px' }}>×</button>
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['NFD Origem','Digitação','Cliente','Motivo','Itens','Valor'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Valor' || h === 'Itens' ? 'right' : 'left',
                    color: 'var(--text-3)', fontSize: 10.5, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {row.nf_origem}
                    {row.no_portal && <span style={{ marginLeft: 6, fontSize: 9, background: PAL.accent + '22',
                      color: PAL.accent, borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>portal</span>}
                  </td>
                  <td style={{ padding: '8px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {row.dt_digitacao ? new Date(row.dt_digitacao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '8px 14px', color: 'var(--text-1)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.razao_social?.trim() || '—'}
                  </td>
                  <td style={{ padding: '8px 14px', color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.motivo_descricao?.trim() || '—'}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-3)' }}>{row.qtd_itens}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtBRL(row.valor_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── View principal ──────────────────────────────────────────────────────── */
export default function Protheus() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [drill,   setDrill]   = useState(null); // { title, items }
  const [filters, setFilters] = useState({
    dt_inicio: '2026-01-01',
    dt_fim:    new Date().toISOString().slice(0, 10),
    status:    '',
  });
  const debRef = useRef(null);

  const load = async (f) => {
    setLoading(true);
    try {
      syncAuthToken();
      const { data: res, error } = await supabase.rpc('get_protheus_data', {
        p_inicio:  f.dt_inicio || null,
        p_fim:     f.dt_fim    || null,
        p_status:  f.status    || null,
        p_motivo:  null,
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

  // Drill-down: filtra a lista de NFDs por critério e abre modal
  const openDrill = (title, filterFn) => {
    const lista = data?.lista || [];
    const items = lista.filter(filterFn);
    setDrill({ title, items });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const hoje = new Date();
      const d4 = new Date(hoje); d4.setDate(d4.getDate() - 4);
      const resp = await fetch('https://opcrtjdnpgqcjlksofjw.supabase.co/functions/v1/sync-protheus', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: d4.toISOString().slice(0,10), end_date: hoje.toISOString().slice(0,10) }),
      });
      const res = await resp.json();
      alert(`Sync concluído!\n${res.atualizados} novas · ${res.ja_lancados} atualizadas · ${res.nao_encontrados_count} só no Protheus`);
      load(filters);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSyncing(false); }
  };

  const kpis     = data?.kpis          || {};
  const evolucao = (data?.evolucao     || []).map(m => ({ ...m, label: fmtMes(m.mes) }));
  const clientes = data?.top_clientes  || [];
  const motivos  = data?.por_motivo    || [];

  const ultMes  = evolucao[evolucao.length - 1];
  const pentMes = evolucao[evolucao.length - 2];
  const cobPct  = kpis.total_lancamentos > 0 ? Math.round((kpis.total_no_portal / kpis.total_lancamentos) * 100) : 0;
  const ticket  = kpis.total_lancamentos > 0 ? (kpis.total_valor / kpis.total_lancamentos) : 0;

  const rowBorder = (i, len) => i < len - 1 ? { borderBottom: '1px solid var(--border)' } : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Topbar ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '10px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={filters.dt_inicio} onChange={e => applyFilter({ dt_inicio: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text)' }} />
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>até</span>
        <input type="date" value={filters.dt_fim} onChange={e => applyFilter({ dt_fim: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text)' }} />
        <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px', fontSize: 12, color: 'var(--text)' }}>
          <option value="">Todos os lançamentos</option>
          <option value="no_portal">Vinculado ao portal</option>
          <option value="fora_portal">Somente Protheus</option>
        </select>
        <button onClick={handleSync} disabled={syncing}
          style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--text-2)', borderRadius: 6, padding: '5px 12px', fontSize: 12,
            cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', opacity: syncing ? 0.6 : 1 }}>
          <Ic d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={12} />
          {syncing ? 'Sincronizando…' : 'Sync agora'}
        </button>
      </div>

      <div style={{ padding: '18px 24px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 12 }}>Carregando…</div>
        ) : (<>

          {/* ── KPIs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard label="Total escriturado" value={fmtBRL(kpis.total_valor || 0)}
              sub={`${nf(kpis.total_lancamentos)} NFDs`} hue={PAL.accent}
              icon="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              delta={ultMes && pentMes ? { atual: ultMes.valor, anterior: pentMes.valor } : null}
              deltaInv onClick={() => openDrill('Todas as NFDs escrituradas', () => true)} />
            <KpiCard label="Ticket médio / NFD" value={fmtBRL(ticket)}
              sub={`${nf(kpis.clientes_distintos)} clientes`} hue={PAL.violet}
              icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <KpiCard label="Cobertura no portal" value={`${cobPct}%`}
              sub={`${nf(kpis.total_no_portal)} de ${nf(kpis.total_lancamentos)} NFDs`}
              hue={cobPct >= 80 ? PAL.green : cobPct >= 50 ? PAL.amber : PAL.red}
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              onClick={() => openDrill('NFDs vinculadas ao portal', r => r.no_portal)} />
            <KpiCard label="Fora do portal" value={fmtBRL(kpis.valor_fora_portal || 0)}
              sub={`${nf(kpis.total_fora_portal)} NFDs sem correspondência OOBJ`}
              hue={PAL.red} icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              onClick={() => openDrill('NFDs somente no Protheus (sem OOBJ)', r => !r.no_portal)} />
          </div>

          {/* ── Gráficos linha + barras ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>

            <Card title="Evolução mensal de lançamentos"
              subtitle="Valor total escriturado por mês de digitação no Protheus">
              <TrendChart data={evolucao} valueKey="valor" labelKey="label"
                color={PAL.accent} height={150}
                onPointClick={pt => openDrill(`Lançamentos de ${fmtMes(pt.mes)}`, r => r.mes_referencia === pt.mes)} />
              {ultMes && pentMes && (
                <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ ...T.overline, marginBottom: 4 }}>{fmtMes(pentMes.mes)}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(pentMes.valor)}</div>
                    <div style={{ ...T.meta, marginTop: 2 }}>{pentMes.qtd} NFDs</div>
                  </div>
                  <div>
                    <div style={{ ...T.overline, marginBottom: 4 }}>{fmtMes(ultMes.mes)} · atual</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(ultMes.valor)}</span>
                      <Delta atual={ultMes.valor} anterior={pentMes.valor} invertido />
                    </div>
                    <div style={{ ...T.meta, marginTop: 2 }}>{ultMes.qtd} NFDs</div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Portal vs. Somente Protheus"
              subtitle="Clique em uma barra para ver as NFDs do mês"
              action={
                <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--text-3)' }}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, background: PAL.accent, display: 'inline-block', borderRadius: 2 }} /> Portal
                  </span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, background: PAL.red, display: 'inline-block', borderRadius: 2 }} /> Só Protheus
                  </span>
                </div>
              }>
              <BarDual data={data?.evolucao || []}
                onBarClick={pt => openDrill(`Lançamentos de ${fmtMes(pt.mes)}`, r => r.mes_referencia === pt.mes)} />
            </Card>
          </div>

          {/* ── Rankings clicáveis ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <Card title="Maiores clientes" subtitle="Por valor escriturado — clique para ver as notas" noPad>
              <div style={{ padding: '0 20px 14px' }}>
                {clientes.slice(0, 8).map((c, i, arr) => {
                  const maxV = arr[0]?.valor || 1;
                  return (
                    <div key={i} className="drill-row"
                      style={{ padding: '9px 0', ...rowBorder(i, arr.length) }}
                      onClick={() => openDrill(`${c.cliente?.trim()}`, r => r.razao_social?.trim() === c.cliente?.trim())}
                      title={`Ver notas de ${c.cliente?.trim()}`}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 90px', alignItems: 'center', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.cliente?.trim()}
                          </div>
                          <Bar valor={c.valor} max={maxV} color={PAL.accent} />
                        </div>
                        <span style={{ ...T.meta, textAlign: 'right' }}>{c.qtd}×</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                          {fmtBRL(c.valor)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Por motivo de devolução" subtitle="Clique em um motivo para ver as notas" noPad>
              <div style={{ padding: '0 20px 14px' }}>
                {motivos.slice(0, 8).map((m, i, arr) => {
                  const maxV = arr[0]?.valor || 1;
                  const cor = PAL.violet;
                  return (
                    <div key={i} className="drill-row"
                      style={{ padding: '9px 0', ...rowBorder(i, arr.length) }}
                      onClick={() => openDrill(`${m.motivo}`, r => (r.motivo_descricao?.trim() || 'SEM MOTIVO') === m.motivo)}
                      title={`Ver notas: ${m.motivo}`}>
                      <div style={{ display: 'grid', gridTemplateColumns: '8px minmax(0,1fr) 44px 90px', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, opacity: 0.85, flexShrink: 0 }} />
                        <div>
                          <div className="ellipsis" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>
                            {m.motivo}
                          </div>
                          <Bar valor={m.valor} max={maxV} color={cor} />
                        </div>
                        <span style={{ ...T.meta, textAlign: 'right' }}>{m.qtd}×</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                          {fmtBRL(m.valor)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── Insight automático ── */}
          {ultMes && pentMes && (() => {
            const diff = pentMes.valor > 0 ? ((ultMes.valor - pentMes.valor) / pentMes.valor) * 100 : 0;
            const up = diff > 10; const dn = diff < -10;
            return (
              <div style={{
                background: up ? PAL.red + '12' : dn ? PAL.green + '12' : 'var(--surface)',
                border: `1px solid ${up ? PAL.red : dn ? PAL.green : 'var(--border)'}`,
                borderRadius: 10, padding: '13px 18px', fontSize: 12,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{up ? '⚠️' : dn ? '✅' : 'ℹ️'}</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 13, color: up ? PAL.red : dn ? PAL.green : 'var(--text)' }}>
                    {up ? `Alta de ${diff.toFixed(1)}% no último mês`
                      : dn ? `Queda de ${Math.abs(diff).toFixed(1)}% no último mês`
                      : 'Volume estável no último mês'}
                  </div>
                  <div style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {fmtMes(ultMes.label)}: <strong>{fmtBRL(ultMes.valor)}</strong> em <strong>{ultMes.qtd} NFDs</strong>.
                    {` Em ${fmtMes(pentMes.label)} foram ${fmtBRL(pentMes.valor)} (${pentMes.qtd} NFDs).`}
                    {clientes[0] && <> Maior cliente do período: <strong>{clientes[0].cliente?.trim()?.split(' ').slice(0,3).join(' ')}</strong> com {fmtBRL(clientes[0].valor)}.</>}
                  </div>
                </div>
              </div>
            );
          })()}

        </>)}
      </div>

      {/* ── Modal drill-down ── */}
      {drill && <DrillModal title={drill.title} items={drill.items} onClose={() => setDrill(null)} />}
    </div>
  );
}
