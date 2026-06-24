import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { fmtBRL, fmtDate } from '../utils.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICON_CHART  = 'M3 3v18h18M9 17V9m4 8v-5m4 5V5';
const ICON_LIST   = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
const ICON_LINK   = 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1';
const ICON_FILTER = 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z';
const ICON_SYNC   = 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

const MESES = {
  '2026-01':'Jan/26','2026-02':'Fev/26','2026-03':'Mar/26',
  '2026-04':'Abr/26','2026-05':'Mai/26','2026-06':'Jun/26',
  '2026-07':'Jul/26','2026-08':'Ago/26','2026-09':'Set/26',
  '2026-10':'Out/26','2026-11':'Nov/26','2026-12':'Dez/26',
};

const fmtMes = m => MESES[m] || m;

function KpiCard({ label, value, sub, color = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>}
    </div>
  );
}

function BarChart({ data, valueKey = 'valor', labelKey = 'mes', colorA = 'var(--accent)', colorB = '#e74c3c' }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round(((d[valueKey] || 0) / max) * 100));
        const hPortal = Math.round(((d.valor_no_portal || 0) / max) * 100);
        const hFora   = Math.round(((d.valor_fora_portal || 0) / max) * 100);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 1, height: 90 }}>
              <div title={`No portal: ${fmtBRL(d.valor_no_portal || 0)}`}
                style={{ flex:1, height: hPortal+'%', background: colorA, borderRadius: '3px 3px 0 0', minHeight: d.valor_no_portal > 0 ? 3 : 0 }} />
              <div title={`Fora do portal: ${fmtBRL(d.valor_fora_portal || 0)}`}
                style={{ flex:1, height: hFora+'%', background: colorB, borderRadius: '3px 3px 0 0', minHeight: d.valor_fora_portal > 0 ? 3 : 0 }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtMes(d[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Protheus({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView]       = useState('lista'); // 'lista' | 'grafico'

  const [filters, setFilters] = useState({
    dt_inicio: '2026-01-01',
    dt_fim: new Date().toISOString().slice(0,10),
    motivo: '',
    cliente: '',
    status: '',
  });
  const [clienteInput, setClienteInput] = useState('');
  const debounceRef = useRef(null);

  const [detalhe, setDetalhe] = useState(null);

  const load = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_protheus_data', {
        p_inicio:  f.dt_inicio || null,
        p_fim:     f.dt_fim    || null,
        p_motivo:  f.motivo    || null,
        p_cliente: f.cliente   || null,
        p_status:  f.status    || null,
      });
      if (error) throw error;
      setData(res);
    } catch(e) {
      console.error('get_protheus_data error:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const applyFilter = patch => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next);
  };

  const handleClienteInput = val => {
    setClienteInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilter({ cliente: val }), 400);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const resp = await fetch('https://opcrtjdnpgqcjlksofjw.supabase.co/functions/v1/sync-protheus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: new Date(Date.now() - 4*86400000).toISOString().slice(0,10),
          end_date:   new Date().toISOString().slice(0,10),
        }),
      });
      const res = await resp.json();
      alert(`Sync concluído!\n${res.atualizados} novas | ${res.ja_lancados} atualizadas | ${res.nao_encontrados_count} fora do portal`);
      load();
    } catch(e) {
      alert('Erro no sync: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const kpis    = data?.kpis || {};
  const lista   = data?.lista || [];
  const evolucao= data?.evolucao || [];
  const clientes= data?.top_clientes || [];
  const motivos = data?.por_motivo || [];
  const motivosDisp = data?.motivos_disponiveis || [];

  const pct = (a,b) => b > 0 ? ((a/b)*100).toFixed(1)+'%' : '—';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 20, padding: '0 0 40px' }}>

      {/* ── Header + filtros ────────────────────────────────────── */}
      <div style={{
        background:'var(--surface)', borderBottom:'1px solid var(--border)',
        padding:'16px 24px', display:'flex', flexWrap:'wrap', gap:12, alignItems:'center',
      }}>
        {/* Período */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input type="date" value={filters.dt_inicio}
            onChange={e => applyFilter({ dt_inicio: e.target.value })}
            style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
              padding:'5px 8px', fontSize:12, color:'var(--text-1)' }} />
          <span style={{ color:'var(--text-3)', fontSize:12 }}>até</span>
          <input type="date" value={filters.dt_fim}
            onChange={e => applyFilter({ dt_fim: e.target.value })}
            style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
              padding:'5px 8px', fontSize:12, color:'var(--text-1)' }} />
        </div>

        {/* Busca cliente */}
        <input type="text" placeholder="Buscar cliente…" value={clienteInput}
          onChange={e => handleClienteInput(e.target.value)}
          style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
            padding:'5px 10px', fontSize:12, color:'var(--text-1)', width: 200 }} />

        {/* Motivo */}
        <select value={filters.motivo} onChange={e => applyFilter({ motivo: e.target.value })}
          style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
            padding:'5px 8px', fontSize:12, color:'var(--text-1)' }}>
          <option value="">Todos os motivos</option>
          {motivosDisp.map(m => (
            <option key={m.codigo} value={m.codigo}>{m.descricao?.trim() || m.codigo}</option>
          ))}
        </select>

        {/* Status portal */}
        <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })}
          style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6,
            padding:'5px 8px', fontSize:12, color:'var(--text-1)' }}>
          <option value="">Todos</option>
          <option value="no_portal">Vinculado ao portal</option>
          <option value="fora_portal">Somente Protheus</option>
        </select>

        {/* Toggle view */}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button onClick={() => setView('lista')}
            style={{ background: view==='lista' ? 'var(--accent)' : 'var(--bg)',
              color: view==='lista' ? '#fff' : 'var(--text-2)',
              border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px',
              fontSize:12, cursor:'pointer', display:'flex', gap:5, alignItems:'center' }}>
            <Ic d={ICON_LIST} size={13}/> Lista
          </button>
          <button onClick={() => setView('grafico')}
            style={{ background: view==='grafico' ? 'var(--accent)' : 'var(--bg)',
              color: view==='grafico' ? '#fff' : 'var(--text-2)',
              border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px',
              fontSize:12, cursor:'pointer', display:'flex', gap:5, alignItems:'center' }}>
            <Ic d={ICON_CHART} size={13}/> Gráficos
          </button>
          <button onClick={handleSync} disabled={syncing}
            style={{ background:'var(--bg)', color:'var(--text-2)', border:'1px solid var(--border)',
              borderRadius:6, padding:'5px 10px', fontSize:12, cursor:'pointer',
              display:'flex', gap:5, alignItems:'center', opacity: syncing?0.6:1 }}>
            <Ic d={ICON_SYNC} size={13}/> {syncing ? 'Sincronizando…' : 'Sync agora'}
          </button>
        </div>
      </div>

      <div style={{ padding:'0 24px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ── KPIs ───────────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <KpiCard label="Total lançado Protheus" value={fmtBRL(kpis.total_valor||0)} sub={`${kpis.total_lancamentos||0} NFDs`} />
          <KpiCard label="Vinculado ao portal" value={fmtBRL(kpis.valor_no_portal||0)}
            sub={`${kpis.total_no_portal||0} NFDs · ${pct(kpis.total_no_portal,kpis.total_lancamentos)}`}
            color="var(--accent)" />
          <KpiCard label="Somente Protheus" value={fmtBRL(kpis.valor_fora_portal||0)}
            sub={`${kpis.total_fora_portal||0} NFDs · ${pct(kpis.total_fora_portal,kpis.total_lancamentos)}`}
            color="#e74c3c" />
          <KpiCard label="Clientes distintos" value={kpis.clientes_distintos||0} color="var(--text-2)" />
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-3)', fontSize:13 }}>
            Carregando…
          </div>
        )}

        {!loading && view === 'grafico' && (
          <>
            {/* Gráfico evolução */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>Evolução mensal — lançamentos no Protheus</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>Por data de digitação</div>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:11 }}>
                  <span style={{ display:'flex', gap:5, alignItems:'center' }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:'var(--accent)', display:'inline-block' }}/>
                    Vinculado ao portal
                  </span>
                  <span style={{ display:'flex', gap:5, alignItems:'center' }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:'#e74c3c', display:'inline-block' }}/>
                    Somente Protheus
                  </span>
                </div>
              </div>
              <BarChart data={evolucao} valueKey="valor" labelKey="mes" />
              {/* Tabela resumo */}
              <div style={{ marginTop:16, overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      {['Mês','NFDs','Valor total','No portal','Valor portal','Fora portal','Valor fora'].map(h => (
                        <th key={h} style={{ padding:'6px 10px', textAlign:'right', color:'var(--text-3)',
                          fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em',
                          ':first-child': { textAlign:'left' } }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evolucao.map((r,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'7px 10px', fontWeight:600, color:'var(--text-1)', textAlign:'left' }}>{fmtMes(r.mes)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--text-2)' }}>{r.qtd}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700 }}>{fmtBRL(r.valor)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--accent)' }}>{r.qtd_no_portal}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--accent)' }}>{fmtBRL(r.valor_no_portal)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'#e74c3c' }}>{r.qtd_fora_portal}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'#e74c3c' }}>{fmtBRL(r.valor_fora_portal)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg)' }}>
                      <td style={{ padding:'8px 10px', fontWeight:800, textAlign:'left' }}>Total</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>{kpis.total_lancamentos}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:800, color:'var(--accent)' }}>{fmtBRL(kpis.total_valor||0)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--accent)' }}>{kpis.total_no_portal}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--accent)' }}>{fmtBRL(kpis.valor_no_portal||0)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#e74c3c' }}>{kpis.total_fora_portal}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#e74c3c' }}>{fmtBRL(kpis.valor_fora_portal||0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top clientes + por motivo lado a lado */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Top clientes */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Top clientes</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {clientes.slice(0,10).map((c,i) => {
                    const maxV = clientes[0]?.valor || 1;
                    const pctBar = Math.round((c.valor/maxV)*100);
                    return (
                      <div key={i} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ color:'var(--text-1)', fontWeight:500 }}>{c.cliente?.trim()?.slice(0,30)}</span>
                          <span style={{ fontWeight:700 }}>{fmtBRL(c.valor)}</span>
                        </div>
                        <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                          <div style={{ flex:1, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width:pctBar+'%', height:'100%', background:'var(--accent)', borderRadius:3 }}/>
                          </div>
                          <span style={{ fontSize:10, color:'var(--text-3)', minWidth:60, textAlign:'right' }}>
                            {c.qtd_no_portal > 0
                              ? <span style={{ color:'var(--accent)' }}>{c.qtd_no_portal} portal</span>
                              : <span style={{ color:'#e74c3c' }}>fora</span>
                            }
                            {' '}/ {c.qtd} total
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Por motivo */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Por motivo</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {motivos.slice(0,10).map((m,i) => {
                    const maxV = motivos[0]?.valor || 1;
                    const pctBar = Math.round((m.valor/maxV)*100);
                    return (
                      <div key={i} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ color:'var(--text-1)', fontWeight:500 }}>{m.motivo?.trim()?.slice(0,35)}</span>
                          <span style={{ fontWeight:700 }}>{fmtBRL(m.valor)}</span>
                        </div>
                        <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:pctBar+'%', height:'100%', background:'#8b5cf6', borderRadius:3 }}/>
                        </div>
                        <span style={{ fontSize:10, color:'var(--text-3)' }}>{m.qtd} NFDs</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </>
        )}

        {!loading && view === 'lista' && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>
                {lista.length} lançamentos
                {lista.length === 200 && <span style={{ color:'var(--text-3)', fontWeight:400 }}> (máx. 200 — refine os filtros)</span>}
              </span>
              <div style={{ display:'flex', gap:12, fontSize:11 }}>
                <span style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', display:'inline-block' }}/>
                  Vinculado ao portal
                </span>
                <span style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#e74c3c', display:'inline-block' }}/>
                  Somente Protheus
                </span>
              </div>
            </div>

            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                    {['Status','NFD Origem','Data Digitação','Cliente','Motivo','Itens','Valor Total'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-3)',
                        fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em',
                        whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((row, i) => (
                    <tr key={i}
                      onClick={() => setDetalhe(detalhe?.nf_origem === row.nf_origem ? null : row)}
                      style={{
                        borderBottom:'1px solid var(--border)', cursor:'pointer',
                        background: detalhe?.nf_origem === row.nf_origem ? 'var(--accent-alpha)' : 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = detalhe?.nf_origem === row.nf_origem ? 'var(--accent-alpha)' : 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = detalhe?.nf_origem === row.nf_origem ? 'var(--accent-alpha)' : 'transparent'}
                    >
                      <td style={{ padding:'8px 12px' }}>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          background: row.no_portal ? '#1a7f5322' : '#e74c3c22',
                          color: row.no_portal ? 'var(--accent)' : '#e74c3c',
                          borderRadius:5, padding:'2px 7px', fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                        }}>
                          {row.no_portal ? '● Portal' : '● Protheus'}
                        </span>
                      </td>
                      <td style={{ padding:'8px 12px', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{row.nf_origem}</td>
                      <td style={{ padding:'8px 12px', color:'var(--text-2)', whiteSpace:'nowrap' }}>{fmtDate(row.dt_digitacao)}</td>
                      <td style={{ padding:'8px 12px', color:'var(--text-1)' }}>{row.razao_social?.trim()?.slice(0,32)}</td>
                      <td style={{ padding:'8px 12px', color:'var(--text-2)' }}>{row.motivo_descricao?.trim()?.slice(0,30) || '—'}</td>
                      <td style={{ padding:'8px 12px', textAlign:'center', color:'var(--text-3)' }}>{row.qtd_itens}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtBRL(row.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Detalhe da linha selecionada ───────────────────────── */}
        {detalhe && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:10, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15 }}>NFD {detalhe.nf_origem}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                  {detalhe.razao_social?.trim()} · Digitado em {fmtDate(detalhe.dt_digitacao)}
                </div>
                {detalhe.motivo_descricao && (
                  <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4 }}>
                    Motivo: {detalhe.motivo_descricao.trim()}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {detalhe.no_portal
                  ? <span style={{ fontSize:11, color:'var(--accent)', background:'#1a7f5322',
                      borderRadius:5, padding:'3px 8px', display:'flex', gap:4, alignItems:'center' }}>
                      <Ic d={ICON_LINK} size={11}/> Vinculado ao portal
                    </span>
                  : <span style={{ fontSize:11, color:'#e74c3c', background:'#e74c3c22',
                      borderRadius:5, padding:'3px 8px' }}>
                      Apenas no Protheus
                    </span>
                }
                <button onClick={() => setDetalhe(null)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:18, lineHeight:1 }}>
                  ×
                </button>
              </div>
            </div>

            {/* Itens */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                    {['#','Código','Descrição','Unid','CFOP','Qtd','Vl. Unit.','Vl. Total'].map(h => (
                      <th key={h} style={{ padding:'6px 10px', textAlign: ['Qtd','Vl. Unit.','Vl. Total'].includes(h) ? 'right' : 'left',
                        color:'var(--text-3)', fontWeight:600, fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detalhe.itens || []).map((it, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'6px 10px', color:'var(--text-3)' }}>{it.item}</td>
                      <td style={{ padding:'6px 10px', fontFamily:'monospace', color:'var(--text-2)' }}>{it.codigo_produto}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text-1)' }}>{it.descricao}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text-3)' }}>{it.unidade}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text-3)' }}>{it.cfop}</td>
                      <td style={{ padding:'6px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{it.quantidade}</td>
                      <td style={{ padding:'6px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(it.valor_unitario)}</td>
                      <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{fmtBRL(it.valor_total)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg)' }}>
                    <td colSpan={7} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>Total</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:800, color:'var(--accent)' }}>{fmtBRL(detalhe.valor_total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
