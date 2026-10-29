import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbGetPainelGerencial, dbExportDevolucoes, dbInfoClientesVendedor, dbVendedorPorCnpj } from '../config/supabase';
import { exportPainelGerencialExcel } from '../utils/exportExcel.js';
import { baixarPlanilhaConsulta } from '../utils/planilhaConsulta.js';
import ModalNotasPainel from '../components/ModalNotasPainel.jsx';
import Apresentacao from '../components/Apresentacao.jsx';
import { gerarPainelDevolucoes } from '../lib/painelDevolucoes';
import { RankingVendedor, TabelaVendedor } from '../components/PainelVendedor.jsx';
import { usePivotVendedor } from '../lib/pivotVendedor.js';
import ModalImportVendedores from '../components/ModalImportVendedores.jsx';

/* ─────────────────────────────────────────────────────────────
   Painel Gerencial — substitui o dash montado no Excel
   (Geração de Retorno e Devolução). Tudo vem da RPC
   get_painel_gerencial, calculada no banco em tempo real.
───────────────────────────────────────────────────────────── */

const COR_PARCIAL = '#1E4DB7';
const COR_TOTAL   = '#D6494E';
const HEAT_RGB    = '214,73,78';      // mesma matiz do "Total", só que em intensidade
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const brl0 = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');
const brlK = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (Math.abs(n) >= 1e3) return 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil';
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
};
const pctFmt = (v) => v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

/* ─── Blocos de layout ─────────────────────────────────────── */
function Card({ title, sub, children, right, style }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-xs)', overflow: 'hidden', ...style }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '14px 18px 10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </header>
      <div style={{ padding: '0 18px 16px' }}>{children}</div>
    </section>
  );
}

function Kpi({ label, value, note, accent, onClick }) {
  return (
    <div className={onClick ? 'drill-card' : undefined} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={onClick ? (e => (e.key === 'Enter' || e.key === ' ') && onClick()) : undefined}
      title={onClick ? 'Clique para ver as notas' : undefined}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-xs)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>
        {accent && <span style={{ width: 8, height: 8, borderRadius: 99, background: accent, flexShrink: 0 }}/>}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 6, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{note}</div>}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}>
          <span style={{ width: 14, height: 2, background: i.color, borderRadius: 2 }}/>{i.label}
        </span>
      ))}
    </div>
  );
}

/* ─── Gráfico de linhas mensal (Parcial x Total) ───────────── */
function LinhaMensal({ meses, ini, fim, onDrill, altura }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const dados = meses.slice(ini - 1, fim);
  const H = altura || 240, padL = 56, padR = 72, padT = 16, padB = 28;
  const max = Math.max(1, ...dados.map(d => Math.max(d.parcial, d.total)));
  const niceMax = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const x = (i) => padL + (dados.length === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (dados.length - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - v / niceMax);
  const path = (k) => dados.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * niceMax);
  const last = dados.length - 1;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg width={w} height={H} role="img" aria-label="Devoluções por mês, parcial e total" style={{ display: 'block', cursor: onDrill ? 'pointer' : 'default' }}
        onMouseLeave={() => setHover(null)}
        onClick={() => { if (onDrill && hover != null) { const m = dados[hover].mes; onDrill({ titulo: `Todas as devoluções · ${MESES[m - 1]}`, mesIni: m, mesFim: m }); } }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - r.left;
          let best = 0, bd = Infinity;
          dados.forEach((_, i) => { const d = Math.abs(x(i) - mx); if (d < bd) { bd = d; best = i; } });
          setHover(best);
        }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--surface-3)" strokeWidth="1"/>
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-3)">{brlK(t).replace('R$ ', '')}</text>
          </g>
        ))}
        {dados.map((d, i) => (w < 560 && i % 2 === 1 && i !== last) ? null : (
          <text key={d.mes} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-3)">{MESES[d.mes - 1]}</text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--border)" strokeWidth="1"/>}
        <path d={path('parcial')} fill="none" stroke={COR_PARCIAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        <path d={path('total')}   fill="none" stroke={COR_TOTAL}   strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {dados.map((d, i) => (
          <g key={'p' + d.mes}>
            <circle cx={x(i)} cy={y(d.parcial)} r={hover === i ? 5 : 3.5} fill={COR_PARCIAL} stroke="var(--surface)" strokeWidth="2"/>
            <circle cx={x(i)} cy={y(d.total)}   r={hover === i ? 5 : 3.5} fill={COR_TOTAL}   stroke="var(--surface)" strokeWidth="2"/>
          </g>
        ))}
        {/* rótulo só no último ponto de cada série */}
        {last >= 0 && (() => {
          let yp = y(dados[last].parcial) + 4, yt = y(dados[last].total) + 4;
          if (Math.abs(yp - yt) < 13) { const mid = (yp + yt) / 2; const sgn = dados[last].total >= dados[last].parcial ? 1 : -1; yt = mid - 7 * sgn; yp = mid + 7 * sgn; }
          return (
            <>
              <text x={x(last) + 9} y={yp} fontSize="11" fontWeight="600" fill="var(--text-2)">{brlK(dados[last].parcial)}</text>
              <text x={x(last) + 9} y={yt} fontSize="11" fontWeight="600" fill="var(--text-2)">{brlK(dados[last].total)}</text>
            </>
          );
        })()}
      </svg>
      {hover != null && (() => {
        const d = dados[hover];
        const left = Math.min(Math.max(x(hover) + 12, 0), w - 210);
        return (
          <div style={{ position: 'absolute', top: 8, left, width: 196, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-sm)', padding: '8px 10px', fontSize: 11.5, pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{MESES[d.mes - 1]}</div>
            <Row cor={COR_PARCIAL} label={`Parcial (${d.qtd_parcial})`} valor={brl0(d.parcial)}/>
            <Row cor={COR_TOTAL}   label={`Total (${d.qtd_total})`}     valor={brl0(d.total)}/>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
              <span>% sobre faturamento</span><b style={{ color: 'var(--text)' }}>{pctFmt(d.faturamento ? (d.parcial + d.total) / d.faturamento : null)}</b>
            </div>
            {onDrill && <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-3)' }}>Clique para ver as notas do mês</div>}
          </div>
        );
      })()}
    </div>
  );
}
const Row = ({ cor, label, valor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-2)', padding: '1px 0' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: cor }}/>{label}</span>
    <b style={{ color: 'var(--text)' }}>{valor}</b>
  </div>
);

/* ─── Tabela mensal (visão em tabela do gráfico) ───────────── */
function TabelaMensal({ meses, ini, fim, onDrill, ano }) {
  const [colHover, setColHover] = useState(null);
  const dados = meses.slice(ini - 1, fim);
  const tot = dados.reduce((a, d) => ({ parcial: a.parcial + d.parcial, total: a.total + d.total, fat: a.fat + (Number(d.faturamento) || 0) }), { parcial: 0, total: 0, fat: 0 });
  const th = { padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap' };
  const td = { padding: '6px 8px', fontSize: 11.5, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--border)' };
  const linhas = [
    { k: 'Parcial', cor: COR_PARCIAL, f: d => brl0(d.parcial), t: brl0(tot.parcial), drill: { dim: 'tipo', valor: 'parcial', rot: 'Devolução parcial' } },
    { k: 'Total',   cor: COR_TOTAL,   f: d => brl0(d.total),   t: brl0(tot.total),   drill: { dim: 'tipo', valor: 'total', rot: 'Devolução total' } },
    { k: 'Soma',    f: d => brl0(d.parcial + d.total), t: brl0(tot.parcial + tot.total), bold: true, drill: { rot: 'Todas as devoluções' } },
    { k: '% sobre faturamento', f: d => pctFmt(d.faturamento ? (d.parcial + d.total) / d.faturamento : null), t: pctFmt(tot.fat ? (tot.parcial + tot.total) / tot.fat : null), bold: true },
    { k: 'Faturamento', f: d => d.faturamento ? brlK(d.faturamento) : '—', t: brlK(tot.fat), muted: true },
  ];
  return (
    <div className="pg-tabela" style={{ overflowX: 'auto', marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 }}/>
          {dados.map((d, i) => (
            <th key={d.mes} style={{ ...th, color: colHover === i ? 'var(--blue)' : th.color }}
              onMouseEnter={() => setColHover(i)}>
              {MESES[d.mes - 1]}<span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/{String(ano).slice(2)}</span>
            </th>
          ))}
          <th style={{ ...th, color: 'var(--text)', borderLeft: '1px solid var(--border)' }}>Período</th>
        </tr></thead>
        <tbody onMouseLeave={() => setColHover(null)}>
          {linhas.map(l => (
            <tr key={l.k} className="pg-linha">
              <td style={{ ...td, textAlign: 'left', color: 'var(--text)', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {l.cor && <span style={{ width: 8, height: 8, borderRadius: 99, background: l.cor }}/>}{l.k}
                </span>
              </td>
              {dados.map((d, i) => <td key={d.mes} className={l.drill && onDrill ? 'drill' : undefined}
                onClick={l.drill && onDrill ? () => onDrill({ titulo: `${l.drill.rot} · ${MESES[d.mes - 1]}`, dim: l.drill.dim, valor: l.drill.valor, mesIni: d.mes, mesFim: d.mes }) : undefined}
                onMouseEnter={() => setColHover(i)}
                style={{ ...td, fontWeight: l.bold ? 600 : 400, color: l.muted ? 'var(--text-3)' : l.bold ? 'var(--text)' : 'var(--text-2)',
                  boxShadow: colHover === i ? 'inset 0 0 0 1px var(--blue)' : undefined }}>{l.f(d)}</td>)}
              <td className={l.drill && onDrill ? 'drill' : undefined}
                onClick={l.drill && onDrill ? () => onDrill({ titulo: l.drill.rot, dim: l.drill.dim, valor: l.drill.valor }) : undefined}
                style={{ ...td, fontWeight: 700, color: l.muted ? 'var(--text-3)' : 'var(--text)', borderLeft: '1px solid var(--border)' }}>{l.t}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tabela de calor (Área / Motivo / Canal × mês) ────────── */
function TabelaCalor({ linhas, ini, fim, fatMesVig, fatPeriodo, limite, rotuloDim, dimKey, onDrill }) {
  const dr = (valor, mi, mf, rot) => onDrill ? () => onDrill({ titulo: `${rotuloDim}: ${valor}${rot ? ' · ' + rot : ''}`, dim: dimKey, valor, mesIni: mi, mesFim: mf }) : undefined;
  const dc = onDrill ? 'drill' : undefined;
  const mesVig = fim;
  const [aberto, setAberto] = useState(false);
  const [colHover, setColHover] = useState(null);
  const pivot = useMemo(() => {
    const m = new Map();
    for (const r of linhas) {
      if (!m.has(r.dim)) m.set(r.dim, { dim: r.dim, meses: Array(12).fill(0), qtd: Array(12).fill(0), tt: 0 });
      const o = m.get(r.dim);
      if (r.mes < ini || r.mes > fim) continue;
      o.meses[r.mes - 1] += Number(r.valor) || 0;
      o.qtd[r.mes - 1] += Number(r.qtd) || 0;
      o.tt += Number(r.valor) || 0;
    }
    return [...m.values()].filter(o => o.tt !== 0).sort((a, b) => b.tt - a.tt);
  }, [linhas, ini, fim]);

  const visiveis = limite && !aberto ? pivot.slice(0, limite) : pivot;
  const cols = Array.from({ length: fim - ini + 1 }, (_, i) => ini - 1 + i);
  const maxCel = Math.max(1, ...pivot.flatMap(p => cols.map(i => p.meses[i])));
  const maxTT  = Math.max(1, ...pivot.map(p => p.tt));
  const heat = (v, max) => v > 0 ? `rgba(${HEAT_RGB},${(0.06 + 0.5 * Math.sqrt(v / max)).toFixed(3)})` : 'transparent';

  const th = { padding: '7px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 };
  const td = { padding: '6px 8px', fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', borderTop: '1px solid var(--border)' };
  const fixa = { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 };

  return (
    <>
      <div className="pg-tabela" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ ...th, ...fixa, textAlign: 'left', minWidth: 200, zIndex: 3 }}>{rotuloDim}</th>
            {cols.map(i => (
              <th key={i} style={{ ...th, color: colHover === i ? 'var(--blue)' : th.color }}
                onMouseEnter={() => setColHover(i)}>{MESES[i]}</th>
            ))}
            <th style={{ ...th, color: 'var(--text)', borderLeft: '1px solid var(--border)' }}>Período</th>
            <th style={{ ...th, color: 'var(--text)' }} title="Valor do período sobre o faturamento do período">% fat.</th>
            {ini !== fim && <>
              <th style={{ ...th, borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>Último mês ({MESES[mesVig - 1]})</th>
              <th style={{ ...th, color: 'var(--text)' }} title="Valor do mês sobre o faturamento do mês">% fat.</th>
            </>}
          </tr></thead>
          <tbody>
            {visiveis.map(p => {
              const vig = p.meses[mesVig - 1] || 0;
              return (
                <tr key={p.dim} className="pg-linha" onMouseLeave={() => setColHover(null)}>
                  <td className={dc} onClick={dr(p.dim)} style={{ ...td, ...fixa, textAlign: 'left', color: 'var(--text)', fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${p.dim} — clique para ver as notas do período`}>{p.dim}</td>
                  {cols.map(i => (
                    <td key={i} className={p.meses[i] ? dc : undefined} onClick={p.meses[i] ? dr(p.dim, i + 1, i + 1, MESES[i]) : undefined}
                      onMouseEnter={() => setColHover(i)}
                      style={{ ...td, background: heat(p.meses[i], maxCel), color: p.meses[i] ? 'var(--text)' : 'var(--text-3)',
                        boxShadow: colHover === i ? 'inset 0 0 0 1px var(--blue)' : undefined }}
                      title={`${p.dim} · ${MESES[i]}: ${brl0(p.meses[i])} (${p.qtd[i]} NFs)`}>
                      {p.meses[i] ? brl0(p.meses[i]) : '–'}
                    </td>
                  ))}
                  <td className={dc} onClick={dr(p.dim)} style={{ ...td, fontWeight: 700, background: heat(p.tt, maxTT) }}>{brl0(p.tt)}</td>
                  <td style={td}>{fatPeriodo ? pctFmt(p.tt / fatPeriodo) : '—'}</td>
                  {ini !== fim && <>
                    <td className={vig ? dc : undefined} onClick={vig ? dr(p.dim, mesVig, mesVig, MESES[mesVig - 1]) : undefined} style={{ ...td, borderLeft: '1px solid var(--border)', color: vig ? 'var(--text)' : 'var(--text-3)' }}>{vig ? brl0(vig) : '–'}</td>
                    <td style={{ ...td, color: vig ? 'var(--text)' : 'var(--text-3)' }}>{fatMesVig ? pctFmt(vig / fatMesVig) : '—'}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limite && pivot.length > limite && (
        <button className="btn btn-ghost btn-sm no-print" style={{ marginTop: 8 }} onClick={() => setAberto(a => !a)}>
          {aberto ? `Mostrar só os ${limite} maiores` : `Mostrar todos (${pivot.length})`}
        </button>
      )}
    </>
  );
}

/* ─── Barras horizontais (status / transportador) ──────────── */
function BarrasH({ itens, labelKey, cor = COR_PARCIAL, onClick }) {
  const max = Math.max(1, ...itens.map(i => Number(i.valor) || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {itens.map(i => {
        const v = Number(i.valor) || 0;
        return (
          <div key={i[labelKey]} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 36%) minmax(0, 1fr)', gap: 10, alignItems: 'center', cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick ? () => onClick(i) : undefined} title={`${i[labelKey]}: ${brl0(v)} · ${i.qtd} NFs`}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{i[labelKey]}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 2 }}>
              <div style={{ height: 16, width: `${Math.max(1.5, (v / max) * 60)}%`, background: cor, borderRadius: '0 4px 4px 0', flexShrink: 0 }}/>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {brl0(v)} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>· {i.qtd} NF{i.qtd === 1 ? '' : 's'}</span>
              </span>
            </div>
          </div>
        );
      })}
      {itens.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nada pendente.</div>}
    </div>
  );
}

/* ─── Página ───────────────────────────────────────────────── */
export default function PainelGerencial({ onGoTo, user }) {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const [ano, setAno] = useState(anoAtual);
  const [ini, setIni] = useState(1);
  const [fim, setFim] = useState(mesAtual);
  const [baixando, setBaixando] = useState('');
  const [drill, setDrill] = useState(null);
  const [apresentar, setApresentar] = useState(false);
  const sairApresentacao = useCallback(() => setApresentar(false), []);
  const abrir = useCallback(({ titulo, dim = null, valor = null, mesIni, mesFim }) => {
    setDrill({ titulo, filtro: { ano, mesIni: mesIni ?? ini, mesFim: mesFim ?? fim, dim, valor } });
  }, [ano, ini, fim]);
  const [data, setData] = useState(null);
  const [erro, setErro] = useState('');
  const [infoVend, setInfoVend] = useState(null);
  const [importVend, setImportVend] = useState(false);
  const carregarInfoVend = useCallback(() => { dbInfoClientesVendedor().then(setInfoVend).catch(() => {}); }, []);
  useEffect(() => { carregarInfoVend(); }, [carregarInfoVend]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try { setData(await dbGetPainelGerencial(ano, ini, fim)); }
    catch (e) { setErro(e.message); }
    setLoading(false);
  }, [ano, ini, fim]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(carregar, 5 * 60 * 1000); return () => clearInterval(t); }, [carregar]);

  const meses = useMemo(() => (data?.meses || []).map(m => ({ ...m, parcial: Number(m.parcial) || 0, total: Number(m.total) || 0, faturamento: m.faturamento == null ? null : Number(m.faturamento) })), [data]);
  const maxMes = ano === anoAtual ? mesAtual : 12;
  const mesVig = fim;
  const fatMesVig = meses[mesVig - 1]?.faturamento || null;
  const noPeriodo = meses.filter(m => m.mes >= ini && m.mes <= fim);
  const periodoTxt = ini === fim ? `${MESES[ini - 1]}/${ano}` : `${MESES[ini - 1]} a ${MESES[fim - 1]}/${ano}`;

  const mudarAno = (a) => { setAno(a); setIni(1); setFim(a === anoAtual ? mesAtual : 12); };

  const baixarExcel = async () => {
    setBaixando('excel');
    try {
      const ult = new Date(ano, fim, 0).getDate();
      const notas = await dbExportDevolucoes({ filters: {
        dt_inicio: `${ano}-${String(ini).padStart(2, '0')}-01`,
        dt_fim:    `${ano}-${String(fim).padStart(2, '0')}-${String(ult).padStart(2, '0')}`,
      } });
      exportPainelGerencialExcel(data, notas, { ano, mesIni: ini, mesFim: fim });
    } catch (e) { alert('Erro ao gerar o Excel: ' + e.message); }
    setBaixando('');
  };
  const baixarConsulta = async () => {
    setBaixando('consulta');
    try {
      const ult = new Date(ano, fim, 0).getDate();
      const notas = await dbExportDevolucoes({ filters: {
        dt_inicio: `${ano}-${String(ini).padStart(2, '0')}-01`,
        dt_fim:    `${ano}-${String(fim).padStart(2, '0')}-${String(ult).padStart(2, '0')}`,
      } });
      await baixarPlanilhaConsulta(notas, { periodoTxt });
    } catch (e) { alert('Erro ao gerar a planilha: ' + e.message); }
    setBaixando('');
  };
  /* Painel interativo: um .html que abre offline e continua clicável. */
  const exportarPainel = async () => {
    setBaixando('painel');
    try {
      const ult = new Date(ano, fim, 0).getDate();
      const notas = await dbExportDevolucoes({ filters: {
        dt_inicio: `${ano}-${String(ini).padStart(2, '0')}-01`,
        dt_fim:    `${ano}-${String(fim).padStart(2, '0')}-${String(ult).padStart(2, '0')}`,
      } });
      const vendPorCnpj = await dbVendedorPorCnpj(ano, ini, fim).catch(() => new Map());
      for (const n of notas) n.vendedor = vendPorCnpj.get(String(n.cnpj_emitente || '').replace(/\D/g, '')) || 'SEM VENDEDOR NO CADASTRO';
      const html = gerarPainelDevolucoes({ dados: data, notas, periodo: periodoTxt, ano, mesIni: ini, mesFim: fim,
        geradoPor: user?.name || user?.email || '' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      a.download = `Painel de devoluções ${periodoTxt.replace(/\//g, '-')}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { alert('Não foi possível gerar o painel: ' + e.message); }
    setBaixando('');
  };

  const pv = usePivotVendedor(data?.vendedor, ini, fim);
  const tot = noPeriodo.reduce((a, m) => ({ p: a.p + m.parcial, t: a.t + m.total, qp: a.qp + (m.qtd_parcial || 0), qt: a.qt + (m.qtd_total || 0), f: a.f + (m.faturamento || 0) }), { p: 0, t: 0, qp: 0, qt: 0, f: 0 });
  const vig = meses[mesVig - 1] || { parcial: 0, total: 0 };
  const status = data?.status || [];
  const pend = data?.pendente_transp || [];

  const alturaSlide = Math.max(260, Math.min(540, (typeof window !== 'undefined' ? window.innerHeight : 900) - 320));
  const slides = !data ? [] : [
    { id: 'resumo', titulo: `Geração de retorno e devoluções · ${periodoTxt}`,
      corpo: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="painel-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Kpi label="Retorno e devolução" value={brl0(tot.p + tot.t)} note={`${tot.qp + tot.qt} notas`} onClick={() => abrir({ titulo: 'Todas as devoluções' })}/>
            <Kpi label="Devolução parcial" accent={COR_PARCIAL} value={brl0(tot.p)} note={`${tot.qp} NFDs`} onClick={() => abrir({ titulo: 'Devolução parcial', dim: 'tipo', valor: 'parcial' })}/>
            <Kpi label="Devolução total" accent={COR_TOTAL} value={brl0(tot.t)} note={`${tot.qt} lançamentos manuais`} onClick={() => abrir({ titulo: 'Devolução total', dim: 'tipo', valor: 'total' })}/>
            <Kpi label="% sobre o faturamento" value={pctFmt(tot.f ? (tot.p + tot.t) / tot.f : null)} note={`Faturamento ${brlK(tot.f)}`}/>
          </div>
          <div><LinhaMensal meses={meses} ini={ini} fim={fim} onDrill={abrir} altura={alturaSlide - 160}/>
            <TabelaMensal meses={meses} ini={ini} fim={fim} onDrill={abrir} ano={ano}/></div>
        </div>
      ) },
    { id: 'area', titulo: 'Abertura por área de responsabilidade',
      corpo: <TabelaCalor linhas={data.area} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} rotuloDim="Área" dimKey="area" onDrill={abrir}/> },
    { id: 'motivo', titulo: 'Abertura por motivo',
      corpo: <TabelaCalor linhas={data.motivo} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} limite={15} rotuloDim="Motivo" dimKey="motivo" onDrill={abrir}/> },
    { id: 'canal', titulo: 'Abertura por canal',
      corpo: <TabelaCalor linhas={data.canal} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} rotuloDim="Canal" dimKey="canal" onDrill={abrir}/> },
    { id: 'vendedor', titulo: 'Devolução comercial por vendedor · % do faturado',
      corpo: <RankingVendedor pv={pv} onDrill={abrir} limite={12}/> },
    { id: 'vendedor-mes', titulo: 'Devolução comercial por vendedor · mês a mês',
      corpo: <TabelaVendedor pv={pv} ini={ini} fim={fim} onDrill={abrir} limite={14}/> },
    { id: 'status', titulo: 'Status operacional e pendências',
      corpo: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-2)' }}>Status operacional</div>
            <BarrasH itens={status} labelKey="status" onClick={i => abrir({ titulo: `Status: ${i.status}`, dim: 'status', valor: i.status })}/></div>
          <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-2)' }}>Pendente de retorno por transportador</div>
            <BarrasH itens={pend} labelKey="transportador" cor={COR_TOTAL} onClick={i => abrir({ titulo: `Pendente de retorno: ${i.transportador}`, dim: 'transp', valor: i.key })}/></div>
        </div>
      ) },
  ];

  return (
    <div className="painel-root" style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1600 }}>
      {/* Cabeçalho só para impressão / PDF */}
      <div className="print-only" style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Geração de retorno e devolução · {periodoTxt}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Linea Alimentos · Portal de Devoluções Fiscais · gerado em {new Date().toLocaleString('pt-BR')}</div>
      </div>

      {/* Controles */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select className="input" value={ano} onChange={e => mudarAno(Number(e.target.value))} style={{ width: 96 }} aria-label="Ano">
          {[anoAtual, anoAtual - 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          De
          <select className="input" value={ini} onChange={e => { const v = Number(e.target.value); setIni(v); if (v > fim) setFim(v); }} style={{ width: 82 }}>
            {Array.from({ length: maxMes }, (_, i) => <option key={i} value={i + 1}>{MESES[i]}</option>)}
          </select>
          até
          <select className="input" value={fim} onChange={e => { const v = Number(e.target.value); setFim(v); if (v < ini) setIni(v); }} style={{ width: 82 }}>
            {Array.from({ length: maxMes }, (_, i) => <option key={i} value={i + 1}>{MESES[i]}</option>)}
          </select>
        </label>
        <button className="btn btn-outline btn-sm" onClick={carregar} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-outline btn-sm" onClick={() => setApresentar(true)} disabled={!data}
          title="Tela cheia, um bloco por vez, para apresentar">Apresentar</button>
        <button className="btn btn-outline btn-sm" onClick={exportarPainel} disabled={!data || !!baixando}
          title="Gera um arquivo que abre sozinho e continua clicável">
          {baixando === 'painel' ? 'Gerando painel…' : 'Exportar painel'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={baixarConsulta} disabled={!data || !!baixando}
          title="Planilha formatada para enviar a quem não tem acesso ao portal: busca por número da NF, base de notas com filtros, itens e resumo">
          {baixando === 'consulta' ? 'Gerando planilha…' : 'Planilha de consulta de notas'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={baixarExcel} disabled={!data || !!baixando}>
          {baixando === 'excel' ? 'Gerando Excel…' : 'Baixar Excel (painel + notas)'}
        </button>
      </div>
      <div className="no-print" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: -8 }}>
        {data?.atualizado_em ? `Dados do portal em ${new Date(data.atualizado_em).toLocaleString('pt-BR')} · atualiza sozinho a cada 5 min` : ''}
      </div>

      {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar o painel: {erro}</div>}
      {!data && loading && <div style={{ fontSize: 13, color: 'var(--text-3)', padding: 40 }}>Carregando…</div>}

      {data && (
        <>
          <div className="no-print" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: -6 }}>
            Clique em qualquer valor (destaques, gráfico, tabelas e barras) para abrir a lista completa das notas.
          </div>
          {/* KPIs */}
          <div className="painel-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Kpi label={`Retorno e devolução · ${periodoTxt}`} value={brl0(tot.p + tot.t)} note={`${tot.qp + tot.qt} notas`} onClick={() => abrir({ titulo: 'Todas as devoluções' })}/>
            <Kpi label="Devolução parcial" accent={COR_PARCIAL} value={brl0(tot.p)} note={`${tot.qp} NFDs`} onClick={() => abrir({ titulo: 'Devolução parcial', dim: 'tipo', valor: 'parcial' })}/>
            <Kpi label="Devolução total" accent={COR_TOTAL} value={brl0(tot.t)} note={`${tot.qt} lançamentos manuais`} onClick={() => abrir({ titulo: 'Devolução total', dim: 'tipo', valor: 'total' })}/>
            <Kpi label="% sobre o faturamento" value={pctFmt(tot.f ? (tot.p + tot.t) / tot.f : null)} note={`Faturamento ${brlK(tot.f)}`}/>
            <Kpi label={`Último mês do período (${MESES[mesVig - 1]})`} value={brl0(vig.parcial + vig.total)} note={`${pctFmt(fatMesVig ? (vig.parcial + vig.total) / fatMesVig : null)} do faturamento do mês`} onClick={() => abrir({ titulo: `Todas as devoluções · ${MESES[mesVig - 1]}`, mesIni: mesVig, mesFim: mesVig })}/>
          </div>

          {/* Gráfico mensal */}
          <Card title={`Geração de retorno e devoluções · ${periodoTxt}`}
            sub="Parcial pela data de emissão da NFD; total pela data da devolução"
            right={<Legend items={[{ label: 'Devolução parcial', color: COR_PARCIAL }, { label: 'Devolução total', color: COR_TOTAL }]}/>}>
            <LinhaMensal meses={meses} ini={ini} fim={fim} onDrill={abrir}/>
            <TabelaMensal meses={meses} ini={ini} fim={fim} onDrill={abrir} ano={ano}/>
          </Card>

          <Card title="Abertura por área de responsabilidade" sub="Quanto mais forte a cor, maior o valor no mês">
            <TabelaCalor linhas={data.area} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} rotuloDim="Área" dimKey="area" onDrill={abrir}/>
          </Card>

          <Card title="Abertura por motivo" sub="Os 15 maiores motivos do período">
            <TabelaCalor linhas={data.motivo} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} limite={15} rotuloDim="Motivo" dimKey="motivo" onDrill={abrir}/>
          </Card>

          <Card title="Abertura por canal">
            <TabelaCalor linhas={data.canal} ini={ini} fim={fim} fatMesVig={fatMesVig} fatPeriodo={tot.f} rotuloDim="Canal" dimKey="canal" onDrill={abrir}/>
          </Card>

          <Card title="Devolução comercial por vendedor"
            sub="Só devoluções com área responsável Comercial ou Customer Service · índice = valor devolvido ÷ valor faturado para os clientes do vendedor, no mesmo período"
            right={
              <button className="btn btn-ghost btn-sm no-print" onClick={() => setImportVend(true)}
                title={infoVend?.clientes ? `${infoVend.clientes.toLocaleString('pt-BR')} clientes · atualizado em ${new Date(infoVend.atualizado_em).toLocaleDateString('pt-BR')}` : 'Carregar o cadastro de vendedores'}>
                Atualizar cadastro de vendedores
              </button>
            }>
            <RankingVendedor pv={pv} onDrill={abrir}/>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', margin: '22px 0 8px' }}>Mês a mês</div>
            <TabelaVendedor pv={pv} ini={ini} fim={fim} onDrill={abrir}/>
          </Card>

          {/* Status operacional */}
          <div className="painel-bloco" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            <Card title="Status operacional" sub={`Notas do período (${periodoTxt}) em cada situação`}>
              <BarrasH itens={status} labelKey="status" onClick={i => abrir({ titulo: `Status: ${i.status}`, dim: 'status', valor: i.status })}/>
            </Card>
            <Card title="Pendente de retorno por transportador" sub="Notas em AGENDAR REVERSA">
              <BarrasH itens={pend} labelKey="transportador" cor={COR_TOTAL} onClick={i => abrir({ titulo: `Pendente de retorno: ${i.transportador}`, dim: 'transp', valor: i.key })}/>
            </Card>
          </div>
        </>
      )}

      {apresentar && data && (
        <Apresentacao titulo="Devoluções" periodo={periodoTxt} filtros={[]}
          slides={slides} onSair={sairApresentacao} carregando={loading}/>
      )}

      {importVend && (
        <ModalImportVendedores info={infoVend} onClose={() => setImportVend(false)}
          onImportado={() => { carregarInfoVend(); carregar(); }}/>
      )}

      {drill && (
        <ModalNotasPainel filtro={drill.filtro} titulo={drill.titulo} user={user}
          onClose={() => setDrill(null)} onChanged={carregar}/>
      )}
    </div>
  );
}
