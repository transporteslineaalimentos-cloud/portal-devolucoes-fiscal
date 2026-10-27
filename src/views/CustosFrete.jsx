import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbGetCustosFrete, dbGetCustosFreteCtes, dbRefreshCustosFrete } from '../config/supabase';
import ModalCtesFrete from '../components/ModalCtesFrete.jsx';
import ApresentacaoFrete from '../components/ApresentacaoFrete.jsx';
import { gerarPainelFrete } from '../lib/painelFrete';

/* ─────────────────────────────────────────────────────────────
   Custos de Frete — substitui o dash do Power BI.
   Tudo vem da RPC get_custos_frete, que lê os CT-es e as NFs
   recebidos do Active (cópia atualizada a cada 30 min).
   Regras:
   Só SAÍDA:
   • Faturamento = NFs de venda da Linea (0297 e 0459) para clientes, sem duplicadas e sem canceladas
     (transferência para Linea 0297, 0459 ou 0106 não é faturamento; 0530 e 0610 seguem a regra normal)
   • Frete = parte de cada CT-e rateada para as NFs de venda e de transferência
     (frete × valor da NF ÷ soma das NFs do CT-e)
   • O custo entra no mês de emissão da NF, mesmo que o CT-e seja emitido depois
   • Frete venda = CT-e ENTREGA NORMAL; custo extra = demais tipos, abertos por tipo
   • Todo número de frete é clicável e abre a lista de CT-es por trás dele
───────────────────────────────────────────────────────────── */

const COR_VENDA = '#1E4DB7';
const COR_EXTRA = '#D9822B';
const INICIO_BASE = '2026-01-01';        // a base de frete começa em janeiro/2026
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const REMETENTES = [
  { v: '',               l: 'Todos' },
  { v: '05207076000297', l: 'Linea Anápolis/GO' },
  { v: '05207076000459', l: 'Linea Extrema/MG' },
];

const brl0 = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');
const brlK = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (Math.abs(n) >= 1e3) return 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil';
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
};
const pctFmt = (v) => v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const div = (a, b) => (b ? a / b : null);
const nomeDest = (i) => titulo(i.nome);
const titulo = (s) => !s ? '' : s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase())
  .replace(/\b(Ltda|S\/a|S\.a\.?|Eireli|Me|Epp)\b/gi, (m) => m.toUpperCase());
const mesLabel = (ym) => { const [y, m] = ym.split('-'); return `${MESES[Number(m) - 1]}/${y.slice(2)}`; };
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dataBR = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';

/* ─── Blocos ───────────────────────────────────────────────── */
function Card({ title, sub, right, children, style }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-xs)', overflow: 'hidden', minWidth: 0, ...style }}>
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

function Kpi({ label, value, note, accent, destaque, onClick }) {
  const clic = onClick ? {
    role: 'button', tabIndex: 0, className: 'cf-clicavel', onClick, title: 'Ver os CT-es',
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } },
  } : {};
  return (
    <div {...clic} style={{ background: destaque ? 'linear-gradient(145deg, #1C2130 0%, #272F44 100%)' : 'var(--surface)',
      border: '1px solid ' + (destaque ? 'transparent' : 'var(--border)'), borderRadius: 12, padding: '14px 16px',
      boxShadow: 'var(--shadow-xs)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 500,
        color: destaque ? 'rgba(255,255,255,0.65)' : 'var(--text-2)' }}>
        {accent && <span style={{ width: 8, height: 8, borderRadius: 99, background: accent, flexShrink: 0 }}/>}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: destaque ? '#fff' : 'var(--text)' }}>{value}</div>
      {note && <div style={{ fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums',
        color: destaque ? 'rgba(255,255,255,0.5)' : 'var(--text-3)' }}>{note}</div>}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}>
          <span style={{ width: 10, height: 10, background: i.color, borderRadius: 2 }}/>{i.label}
        </span>
      ))}
    </div>
  );
}

function Filtro({ label, value, onChange, children, width = 170 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
      {label}
      <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ width, height: 32, fontSize: 12.5 }}>
        {children}
      </select>
    </label>
  );
}

/* ─── Colunas mensais empilhadas + % sobre o faturamento ───── */
function GraficoMensal({ meses, onMes, altura = 260 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const H = altura, padL = 58, padR = 12, padT = 26, padB = 28;
  const max = Math.max(1, ...meses.map(m => m.frete_venda + m.custo_extra));
  const niceMax = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const n = Math.max(1, meses.length);
  const slot = (w - padL - padR) / n;
  const bw = Math.min(64, slot * 0.58);
  const x = (i) => padL + slot * i + slot / 2;
  const y = (v) => padT + (H - padT - padB) * (1 - v / niceMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * niceMax);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg width={w} height={H} role="img" aria-label="Custo de frete por mês" style={{ display: 'block' }}
        onMouseLeave={() => setHover(null)}
        onClick={() => { if (onMes && hover != null && meses[hover]) onMes(meses[hover]); }}
        cursor={onMes ? 'pointer' : undefined}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((e.clientX - r.left - padL) / slot);
          setHover(i >= 0 && i < meses.length ? i : null);
        }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--surface-3)" strokeWidth="1"/>
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-3)">{brlK(t).replace('R$ ', '')}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const tot = m.frete_venda + m.custo_extra;
          const pct = div(tot, m.faturamento);
          const yV = y(m.frete_venda), yT = y(tot);
          return (
            <g key={m.mes} opacity={hover == null || hover === i ? 1 : 0.55}>
              {hover === i && <rect x={x(i) - slot / 2 + 2} y={padT - 22} width={slot - 4} height={H - padT - padB + 22} fill="var(--surface-2)" rx="6"/>}
              <rect x={x(i) - bw / 2} y={yV} width={bw} height={Math.max(0, y(0) - yV)} fill={COR_VENDA} rx="2"/>
              <rect x={x(i) - bw / 2} y={yT} width={bw} height={Math.max(0, yV - yT)} fill={COR_EXTRA} rx="2"/>
              {tot > 0 && (
                <text x={x(i)} y={yT - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{pctFmt(pct)}</text>
              )}
              {(w >= 560 || i % 2 === 0 || i === meses.length - 1) && (
                <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--text-3)">{mesLabel(m.mes)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && meses[hover] && (() => {
        const m = meses[hover];
        const tot = m.frete_venda + m.custo_extra;
        const left = Math.min(Math.max(x(hover) + bw / 2 + 8, 0), w - 236);
        return (
          <div style={{ position: 'absolute', top: 8, left, width: 224, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-sm)', padding: '9px 11px', fontSize: 11.5, pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{mesLabel(m.mes)} · {m.qtd_ctes} CT-es</div>
            <Linha cor={COR_VENDA} label="Frete venda" valor={brl0(m.frete_venda)} pct={pctFmt(div(m.frete_venda, m.faturamento))}/>
            <Linha cor={COR_EXTRA} label="Custo extra" valor={brl0(m.custo_extra)} pct={pctFmt(div(m.custo_extra, m.faturamento))}/>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 5, paddingTop: 5 }}>
              <Linha label="Frete total" valor={brl0(tot)} pct={pctFmt(div(tot, m.faturamento))} forte/>
              <Linha label="Faturamento" valor={brlK(m.faturamento)}/>
              {m.transferencia > 0 && <div style={{ color: 'var(--text-3)', marginTop: 3 }}>Inclui {brl0(m.transferencia)} de transferência</div>}
              {onMes && <div style={{ color: 'var(--blue)', marginTop: 4 }}>Clique para ver os CT-es</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
const Linha = ({ cor, label, valor, pct, forte }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-2)', padding: '1px 0', whiteSpace: 'nowrap' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: forte ? 700 : 400 }}>
      {cor && <span style={{ width: 8, height: 8, borderRadius: 2, background: cor }}/>}{label}
    </span>
    <span><b style={{ color: 'var(--text)' }}>{valor}</b>{pct && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{pct}</span>}</span>
  </div>
);

/* ─── Tabela mensal (os percentuais da 2ª página do BI) ────── */
function TabelaMensal({ meses, onAbrir }) {
  const th = { padding: '7px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const td = { padding: '7px 10px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const tot = meses.reduce((a, m) => ({ f: a.f + m.faturamento, v: a.v + m.frete_venda, e: a.e + m.custo_extra }), { f: 0, v: 0, e: 0 });
  const cel = (mes, cat) => onAbrir ? {
    className: 'cf-celula', title: 'Ver os CT-es', onClick: (ev) => { ev.stopPropagation(); onAbrir(mes, cat); },
  } : {};
  const linha = (k, lab, f, v, e, forte, mes) => (
    <tr key={k} style={forte ? { background: 'var(--surface-2)' } : undefined}>
      <td style={{ ...td, textAlign: 'left', fontWeight: forte ? 700 : 600, color: 'var(--text)' }}>{lab}</td>
      <td style={{ ...td, color: 'var(--text-2)' }}>{brlK(f)}</td>
      <td style={{ ...td, color: COR_VENDA }} {...cel(mes, 'FRETE VENDA')}>{brl0(v)}</td>
      <td style={{ ...td, color: COR_EXTRA }} {...cel(mes, 'CUSTO EXTRA')}>{brl0(e)}</td>
      <td style={{ ...td, fontWeight: 700 }} {...cel(mes, null)}>{brl0(v + e)}</td>
      <td style={{ ...td, fontWeight: 700 }}>{pctFmt(div(v + e, f))}</td>
      <td style={{ ...td, color: COR_VENDA, fontWeight: 600 }}>{pctFmt(div(v, f))}</td>
      <td style={{ ...td, color: COR_EXTRA, fontWeight: 600 }}>{pctFmt(div(e, f))}</td>
    </tr>
  );
  return (
    <div style={{ overflowX: 'auto', marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Mês</th>
            <th style={th}>Faturamento</th><th style={th}>Frete venda</th><th style={th}>Custo extra</th>
            <th style={th}>Frete total</th><th style={th}>% total</th><th style={th}>% venda</th><th style={th}>% extra</th>
          </tr>
        </thead>
        <tbody>
          {meses.map(m => linha(m.mes, mesLabel(m.mes), m.faturamento, m.frete_venda, m.custo_extra, false, m.mes))}
          {meses.length > 1 && linha('tot', 'Período', tot.f, tot.v, tot.e, true, '')}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Barras horizontais (clique abre os CT-es) ────────────── */
function Barras({ itens, rotulo, empilhado, cor = COR_VENDA, total, onClick, limite = 12, ativo, modoPct = 'nf' }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? itens : itens.slice(0, limite);
  const max = Math.max(1, ...itens.map(i => Number(i.valor) || 0));
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(i => {
          const v = Number(i.valor) || 0;
          const fv = Number(i.frete_venda) || 0;
          const ce = Number(i.custo_extra) || 0;
          const base = Number(i.base_nf) || 0;
          const sel = ativo && ativo === (i.raiz ?? i.uf ?? i.tipo);
          return (
            <div key={(i.raiz ?? '') + rotulo(i)} className={onClick ? 'cf-barra' : undefined}
              onClick={onClick ? () => onClick(i) : undefined}
              title={onClick ? 'Clique para ver os CT-es' : undefined}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 30%) minmax(0, 1fr)', gap: 10, alignItems: 'center',
                cursor: onClick ? 'pointer' : 'default', borderRadius: 6, padding: '3px 4px',
                background: sel ? 'var(--blue-dim)' : undefined }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.25, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: sel ? 700 : 400 }} title={rotulo(i)}>{rotulo(i)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 2 }}>
                  <div style={{ display: 'flex', height: 15, width: `${Math.max(1.5, (v / max) * 48)}%`, flexShrink: 0, borderRadius: '0 3px 3px 0', overflow: 'hidden' }}>
                    {empilhado ? (
                      <>
                        <div style={{ width: `${v ? (fv / v) * 100 : 0}%`, background: COR_VENDA }}/>
                        <div style={{ flex: 1, background: COR_EXTRA }}/>
                      </>
                    ) : <div style={{ flex: 1, background: typeof cor === 'function' ? cor(i) : cor }}/>}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {brl0(v)}
                    <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>
                      {modoPct === 'nf' && base > 0 ? ` · ${pctFmt(v / base)} da NF`
                        : total ? ` · ${pctFmt(v / total)} do frete` : ''}
                    </span>
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                  {empilhado && <>Venda {brl0(fv)} · Extra {brl0(ce)} · </>}
                  {(i.qtd || 0).toLocaleString('pt-BR')} CT-e{i.qtd === 1 ? '' : 's'}
                  {base > 0 && <> · NFs {brlK(base)}</>}
                </div>
              </div>
            </div>
          );
        })}
        {itens.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sem CT-es no filtro atual.</div>}
      </div>
      {itens.length > limite && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTodos(t => !t)}>
          {todos ? 'Mostrar menos' : `Ver todos (${itens.length})`}
        </button>
      )}
    </div>
  );
}


/* ─── Colunas por UF ───────────────────────────────────────── */
function ColunasUF({ itens, total, ativo, onClick, modo, altura = 220 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = altura, padT = 22, padB = 24;
  const pctUF = (i) => (Number(i.base_nf) > 0 ? Number(i.valor) / Number(i.base_nf) : null);
  const vis = modo === 'pct' ? itens.filter(i => pctUF(i) != null).sort((a, b) => pctUF(b) - pctUF(a)) : itens;
  const alt = (i) => (modo === 'pct' ? pctUF(i) : Number(i.valor) || 0);
  const max = Math.max(modo === 'pct' ? 0.0001 : 1, ...vis.map(alt));
  const slot = w / Math.max(1, vis.length);
  const bw = Math.min(34, slot * 0.66);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const COR = modo === 'pct' ? COR_EXTRA : COR_VENDA;
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg width={w} height={H} role="img" aria-label="Custo de frete por UF de destino" style={{ display: 'block' }}
        onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--border)"/>
        {vis.map((i, k) => {
          const v = alt(i);
          const cx = slot * k + slot / 2;
          const sel = ativo === i.uf;
          return (
            <g key={i.uf} style={{ cursor: onClick ? 'pointer' : 'default' }}
              onMouseEnter={() => setHover(k)} onClick={onClick ? () => onClick(i) : undefined}>
              <rect x={slot * k} y={padT - 18} width={slot} height={H - padT + 18} fill={hover === k ? 'var(--surface-2)' : 'transparent'}/>
              <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} rx="2"
                fill={sel ? '#0F2C73' : COR} opacity={ativo && !sel ? 0.45 : 1}/>
              {(k < 9 || hover === k) && (
                <text x={cx} y={y(v) - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text-2)">
                  {modo === 'pct' ? pctFmt(v) : brlK(v).replace('R$ ', '')}
                </text>
              )}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="11" fontWeight={sel ? 700 : 500} fill="var(--text-2)">{i.uf}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && vis[hover] && (() => {
        const i = vis[hover];
        const left = Math.min(Math.max(slot * hover + slot / 2 + 10, 0), Math.max(0, w - 244));
        return (
          <div style={{ position: 'absolute', top: 4, left, width: 232, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-sm)', padding: '8px 10px', fontSize: 11.5, pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{i.uf}</div>
            <Linha cor={COR_VENDA} label="Frete venda" valor={brl0(i.frete_venda)}/>
            <Linha cor={COR_EXTRA} label="Custo extra" valor={brl0(i.custo_extra)}/>
            <Linha label="Frete total" valor={brl0(i.valor)} pct={pctFmt(div(Number(i.valor), total))} forte/>
            {Number(i.base_nf) > 0 && <Linha label="Valor das NFs" valor={brlK(i.base_nf)} pct={pctFmt(pctUF(i))}/>}
            <div style={{ color: 'var(--text-3)', marginTop: 3 }}>{i.qtd} CT-es{onClick ? ' · clique para ver' : ''}</div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Página ───────────────────────────────────────────────── */
const FILTROS_PADRAO = { remetente: '', tipo: '', canal: '', uf: '', transportador: '', operacao: 'VENDA' };
const OPERACOES = [
  { v: '',              l: 'Venda + transferência' },
  { v: 'VENDA',         l: 'Só venda' },
  { v: 'TRANSFERENCIA', l: 'Só transferência' },
];
const fimDoMes = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export default function CustosFrete({ user }) {
  const [de, setDe] = useState(INICIO_BASE);
  const [ate, setAte] = useState(hojeISO());
  const [f, setF] = useState(FILTROS_PADRAO);
  const [data, setData] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [ufModo, setUfModo] = useState('valor');
  const [apresentar, setApresentar] = useState(false);
  const [exportando, setExportando] = useState(false);
  const req = useRef(0);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: prev[k] === v ? '' : v }));
  const setSelect = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));

  const carregar = useCallback(async () => {
    if (!de || !ate || de > ate) return;
    const id = ++req.current;
    setLoading(true); setErro('');
    try {
      const r = await dbGetCustosFrete({ de, ate, ...f });
      if (id === req.current) setData(r);
    } catch (e) { if (id === req.current) setErro(e.message); }
    if (id === req.current) setLoading(false);
  }, [de, ate, f]);

  useEffect(() => { const t = setTimeout(carregar, 200); return () => clearTimeout(t); }, [carregar]);

  /* O recálculo roda no banco (leva ~30 s) e é feito por uma rotina que confere
     o pedido a cada minuto; aqui só pedimos e esperamos a data de atualização mudar. */
  const aguardarRecalculo = async (pedir = true) => {
    setAtualizando(true);
    try {
      const antes = data?.cobertura?.atualizado_em || null;
      if (pedir) await dbRefreshCustosFrete();
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const r = await dbGetCustosFrete({ de, ate, ...f });
        if (r?.cobertura?.atualizado_em !== antes) { setData(r); break; }
      }
    } catch (e) { alert('Não foi possível atualizar: ' + e.message); }
    setAtualizando(false);
  };
  const atualizarAgora = () => aguardarRecalculo(true);

  const k = data?.kpis || {};
  const fat = Number(k.faturamento) || 0;
  const fv = Number(k.frete_venda) || 0;
  const ce = Number(k.custo_extra) || 0;
  const ft = fv + ce;
  const meses = useMemo(() => (data?.mensal || []).map(m => ({
    mes: m.mes, faturamento: Number(m.faturamento) || 0, frete_venda: Number(m.frete_venda) || 0,
    custo_extra: Number(m.custo_extra) || 0, transferencia: Number(m.transferencia) || 0, qtd_ctes: m.qtd_ctes || 0,
  })), [data]);
  const op = data?.opcoes || {};
  const nomeTransp = (raiz) => (op.transportadores || []).find(t => t.raiz === raiz)?.nome || raiz;

  const chips = [
    f.remetente && { k: 'remetente', l: REMETENTES.find(r => r.v === f.remetente)?.l },
    f.tipo && { k: 'tipo', l: titulo(f.tipo) },
    f.canal && { k: 'canal', l: titulo(f.canal) },
    f.uf && { k: 'uf', l: 'UF ' + f.uf },
    f.transportador && { k: 'transportador', l: titulo(nomeTransp(f.transportador)) },
    f.operacao && f.operacao !== FILTROS_PADRAO.operacao && { k: 'operacao', l: OPERACOES.find(o => o.v === f.operacao)?.l },
  ].filter(Boolean);
  const fatNaoFiltra = f.tipo || f.transportador || f.operacao === 'TRANSFERENCIA';
  const periodoTxt = `${dataBR(de)} a ${dataBR(ate)}`;

  /* Abre a lista de CT-es por trás de um número: filtros da aba + o recorte clicado.
     `filtrar` (opcional) vira um botão no modal para aplicar o recorte na aba toda. */
  const abrir = (tit, extra = {}, filtrar = null) => {
    const params = { de, ate, ...f, ...extra };
    const rec = [
      params.de === de && params.ate === ate ? periodoTxt : `${dataBR(params.de)} a ${dataBR(params.ate)}`,
      ...chips.filter(c => !(c.k in extra)).map(c => c.l),
    ];
    setDetalhe({ titulo: tit, sub: rec.join(' · '), params, filtrar });
  };
  const abrirMes = (ym, categoria) => {
    const lab = ym ? mesLabel(ym) : 'Período';
    const nome = categoria === 'FRETE VENDA' ? 'Frete venda' : categoria === 'CUSTO EXTRA' ? 'Custo extra' : 'Frete total';
    const extra = ym ? { de: `${ym}-01` < de ? de : `${ym}-01`, ate: fimDoMes(ym) > ate ? ate : fimDoMes(ym) } : {};
    if (categoria) extra.tipo = categoria;
    abrir(`${nome} · ${lab}`, extra);
  };
  const abrirKpi = (nome, tipo) => abrir(nome, tipo ? { tipo } : {});

  /* Painel interativo: um .html que abre offline e continua clicável. */
  const exportarPainel = async () => {
    setExportando(true);
    try {
      const r = await dbGetCustosFreteCtes({ de, ate, ...f, limite: 20000 });
      const html = gerarPainelFrete({
        data, ctes: r?.linhas || [], periodo: periodoTxt,
        filtros: chips.map(c => c.l), geradoPor: user?.nome || user?.email || '',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      a.download = `Custos de frete ${periodoTxt.replace(/\//g, '-')}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { alert('Não foi possível gerar o painel: ' + e.message); }
    setExportando(false);
  };

  /* Blocos montados uma vez e reaproveitados na tela e na apresentação. */
  const blocoKpis = !data ? null : (
    <>
          <div className="cf-kpis">
        <Kpi label="Faturamento" value={brlK(fat)} note={`${(k.qtd_nfs || 0).toLocaleString('pt-BR')} NFs de venda`}/>
        <Kpi label="Frete venda" accent={COR_VENDA} value={brlK(fv)} note="CT-es de entrega normal"
          onClick={() => abrirKpi('Frete venda', 'FRETE VENDA')}/>
        <Kpi label="Custo extra" accent={COR_EXTRA} value={brlK(ce)} note="Dedicado, descarga, pallet, complementar e demais"
          onClick={() => abrirKpi('Custo extra', 'CUSTO EXTRA')}/>
        <Kpi destaque label="% Frete total × faturamento" value={pctFmt(div(ft, fat))}
          note={`${brlK(ft)} · ${(k.qtd_ctes || 0).toLocaleString('pt-BR')} CT-es` + (Number(k.transferencia) > 0 && !f.operacao ? ` · ${brlK(k.transferencia)} de transferência` : '')}
          onClick={() => abrirKpi('Frete total')}/>
        <Kpi label="% Frete venda × faturamento" accent={COR_VENDA} value={pctFmt(div(fv, fat))}
          onClick={() => abrirKpi('Frete venda', 'FRETE VENDA')}/>
        <Kpi label="% Custo extra × faturamento" accent={COR_EXTRA} value={pctFmt(div(ce, fat))}
          onClick={() => abrirKpi('Custo extra', 'CUSTO EXTRA')}/>
      </div>
      {fatNaoFiltra && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: -8 }}>
          O faturamento não muda com os filtros de tipo de custo, transportador e operação; os percentuais mostram o peso desse recorte no faturamento total.
        </div>
      )}

    </>
  );

  const blocoMensal = (altura) => !data ? null : (
    <>
      <GraficoMensal meses={meses} onMes={m => abrirMes(m.mes)} altura={altura}/>
      <TabelaMensal meses={meses} onAbrir={abrirMes}/>
    </>
  );

  const blocoTransp = !data ? null : (
    <Barras itens={data.por_transportador || []} rotulo={i => titulo(i.nome)} empilhado total={ft} limite={14}
      ativo={f.transportador} onClick={i => abrir(titulo(i.nome), { transportador: i.raiz || null },
        i.raiz && f.transportador !== i.raiz ? { label: 'Filtrar a aba por este transportador', run: () => set('transportador', i.raiz) } : null)}/>
  );

  const blocoTipo = !data ? null : (
    <Barras itens={data.por_tipo || []} rotulo={i => titulo(i.tipo)} total={ft} limite={20} modoPct="frete"
      cor={i => i.categoria === 'FRETE VENDA' ? COR_VENDA : COR_EXTRA}
      ativo={f.tipo} onClick={i => {
        const t = i.tipo === 'ENTREGA NORMAL' ? 'FRETE VENDA' : i.tipo;
        abrir(titulo(i.tipo), { tipo: i.tipo }, f.tipo !== t ? { label: 'Filtrar a aba por este tipo', run: () => set('tipo', t) } : null);
      }}/>
  );

  const blocoDest = !data ? null : (
    <Barras itens={data.por_destinatario || []} rotulo={nomeDest} empilhado total={ft} limite={14}
      onClick={i => abrir(nomeDest(i), { destinatario: i.raiz || null })}/>
  );

  const blocoExtraDest = !data ? null : (
    <Barras itens={data.extra_por_destinatario || []} rotulo={nomeDest} cor={COR_EXTRA} total={ce} modoPct="frete" limite={14}
      onClick={i => abrir(`Custo extra · ${nomeDest(i)}`, { destinatario: i.raiz || null, tipo: f.tipo && f.tipo !== 'FRETE VENDA' ? f.tipo : 'CUSTO EXTRA' })}/>
  );

  const blocoUf = (altura) => !data ? null : (
    <ColunasUF itens={(data.por_uf || []).filter(i => i.uf !== '—')} total={ft} modo={ufModo} altura={altura}
      ativo={f.uf} onClick={i => abrir(`UF ${i.uf}`, { uf: i.uf },
        f.uf !== i.uf ? { label: 'Filtrar a aba por esta UF', run: () => set('uf', i.uf) } : null)}/>
  );

  const seletorUf = (
    <div style={{ display: 'flex', gap: 6 }}>
      {[['valor', 'R$'], ['pct', '% da NF']].map(([v, l]) => (
        <button key={v} className={'btn btn-sm ' + (ufModo === v ? 'btn-primary' : 'btn-outline')}
          style={{ height: 28 }} onClick={() => setUfModo(v)}>{l}</button>
      ))}
    </div>
  );

  const legendaVE = <Legend items={[{ label: 'Venda', color: COR_VENDA }, { label: 'Extra', color: COR_EXTRA }]}/>;

  const sairApresentacao = useCallback(() => setApresentar(false), []);
  const alturaSlide = Math.max(260, Math.min(520, (typeof window !== 'undefined' ? window.innerHeight : 900) - 330));

  const slides = [
    { id: 'resumo', titulo: 'Resumo do período', sub: `Faturamento de ${brlK(fat)} e frete de ${brlK(ft)}`,
      corpo: <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{blocoKpis}<div>{blocoMensal(300)}</div></div> },
    { id: 'transp', titulo: 'Frete pago por transportador', sub: 'O percentual é o frete sobre o valor das notas que cada um levou',
      corpo: blocoTransp },
    { id: 'tipo', titulo: 'Custo por tipo de CT-e', sub: 'Entrega normal é o frete da venda; os demais tipos são custo extra',
      corpo: blocoTipo },
    { id: 'dest', titulo: 'Frete por destinatário', sub: 'Clientes agrupados pela raiz do CNPJ, com todas as lojas juntas',
      corpo: blocoDest },
    { id: 'extra', titulo: 'Custo extra por destinatário', sub: 'Descarga, pallet, dedicado, complementar e demais',
      corpo: blocoExtraDest },
    { id: 'uf', titulo: 'Frete por UF de destino', sub: ufModo === 'pct' ? 'Frete dividido pelo valor das notas entregues naquela UF' : 'Valor do frete por UF',
      corpo: <div><div style={{ marginBottom: 14 }}>{seletorUf}</div>{blocoUf(alturaSlide)}</div> },
  ];

  return (
    <div className="painel-root" style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1600 }}>
      <div className="print-only" style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Custos de frete · {periodoTxt}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Linea Alimentos · {chips.length ? 'Filtros: ' + chips.map(c => c.l).join(' · ') + ' · ' : ''}gerado em {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Filtros */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
          Período
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="input" value={de} max={ate} onChange={e => setDe(e.target.value)} style={{ width: 132, height: 32, fontSize: 12.5 }}/>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>até</span>
            <input type="date" className="input" value={ate} min={de} onChange={e => setAte(e.target.value)} style={{ width: 132, height: 32, fontSize: 12.5 }}/>
          </span>
        </label>
        <Filtro label="Remetente" value={f.remetente} onChange={setSelect('remetente')} width={172}>
          {REMETENTES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
        </Filtro>
        <Filtro label="Tipo de custo" value={f.tipo} onChange={setSelect('tipo')} width={172}>
          <option value="">Total</option>
          <option value="FRETE VENDA">Frete venda</option>
          <option value="CUSTO EXTRA">Custo extra (todos)</option>
          <optgroup label="Custo extra por tipo">
            {(op.tipos || []).filter(t => t !== 'ENTREGA NORMAL').sort().map(t => <option key={t} value={t}>{titulo(t)}</option>)}
          </optgroup>
        </Filtro>
        <Filtro label="Operação" value={f.operacao} onChange={setSelect('operacao')} width={176}>
          {OPERACOES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </Filtro>
        <Filtro label="Canal" value={f.canal} onChange={setSelect('canal')} width={150}>
          <option value="">Todos</option>
          {(op.canais || []).slice().sort().map(c => <option key={c} value={c}>{titulo(c)}</option>)}
        </Filtro>
        <Filtro label="UF destino" value={f.uf} onChange={setSelect('uf')} width={84}>
          <option value="">Todas</option>
          {(op.ufs || []).slice().sort().map(u => <option key={u} value={u}>{u}</option>)}
        </Filtro>
        <Filtro label="Transportador" value={f.transportador} onChange={setSelect('transportador')} width={200}>
          <option value="">Todos</option>
          {(op.transportadores || []).map(t => <option key={t.raiz} value={t.raiz}>{titulo(t.nome)}</option>)}
        </Filtro>
        {chips.length > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ height: 32 }} onClick={() => setF(FILTROS_PADRAO)}>Limpar filtros</button>
        )}
        <div style={{ flex: 1 }}/>
        <button className="btn btn-outline btn-sm" style={{ height: 32 }} onClick={() => setApresentar(a => !a)}
          title="Tela cheia, sem menu, com números maiores">
          {apresentar ? 'Sair da apresentação' : 'Apresentar'}
        </button>
        <button className="btn btn-outline btn-sm" style={{ height: 32 }} onClick={atualizarAgora} disabled={atualizando}>
          {atualizando ? 'Recalculando… (até 2 min)' : 'Atualizar agora'}
        </button>
        <button className="btn btn-primary btn-sm" style={{ height: 32 }} onClick={exportarPainel} disabled={!data || exportando}
          title="Gera um arquivo que abre sozinho e continua clicável, para enviar à diretoria">
          {exportando ? 'Gerando…' : 'Exportar painel'}
        </button>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: -6, fontSize: 11.5, color: 'var(--text-3)' }}>
        {chips.map(c => (
          <button key={c.k} className="dv-chip" onClick={() => setF(prev => ({ ...prev, [c.k]: '' }))} title="Remover filtro">
            {c.l} <span aria-hidden="true">×</span>
          </button>
        ))}
        <span>
          {data?.cobertura?.atualizado_em ? `CT-es recebidos até ${dataBR(data.cobertura.ultimo_cte)} · cópia atualizada em ${new Date(data.cobertura.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} (a cada 30 min)` : ''}
          {loading && data ? ' · carregando…' : ''}
        </span>
      </div>

      {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar: {erro}</div>}
      {!data && loading && <div style={{ fontSize: 13, color: 'var(--text-3)', padding: 40 }}>Carregando…</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
          {blocoKpis}
          {/* Evolução mensal */}
          <Card title="Custo de frete por mês e % sobre o faturamento"
            sub="Cada mês traz o frete das notas emitidas nele, mesmo que o CT-e tenha vindo depois. O número acima da coluna é o frete sobre o faturamento. Clique para ver os CT-es"
            right={<Legend items={[{ label: 'Frete venda', color: COR_VENDA }, { label: 'Custo extra', color: COR_EXTRA }]}/>}>
            {blocoMensal(260)}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16 }}>
            <Card title="Frete pago por transportador"
              sub="Filiais do mesmo CNPJ já vêm somadas · clique para ver os CT-es" right={legendaVE}>
              {blocoTransp}
            </Card>
            <Card title="Custo por tipo de CT-e" sub="Clique em um tipo para ver os CT-es">
              {blocoTipo}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16 }}>
            <Card title="Custo total de frete por destinatário" sub="Clientes agrupados pela raiz do CNPJ (todas as lojas juntas) · clique para ver os CT-es"
              right={legendaVE}>
              {blocoDest}
            </Card>
            <Card title="Custo extra por destinatário" sub="Descarga, pallet, dedicado, complementar e demais · clique para ver os CT-es">
              {blocoExtraDest}
            </Card>
          </div>

          <Card title="Frete por UF de destino"
            sub={ufModo === 'pct'
              ? 'Frete dividido pelo valor das notas entregues naquela UF · clique para ver os CT-es'
              : 'Valor do frete por UF · clique para ver os CT-es'}
            right={seletorUf}>
            {blocoUf(220)}
          </Card>
        </div>
      )}

      {apresentar && data && (
        <ApresentacaoFrete titulo="Custos de Frete" periodo={periodoTxt} filtros={chips.map(c => c.l)}
          slides={slides} onSair={sairApresentacao}/>
      )}

      {detalhe && (
        <ModalCtesFrete titulo={detalhe.titulo} sub={detalhe.sub} params={detalhe.params}
          filtrar={detalhe.filtrar?.label} onFiltrar={detalhe.filtrar?.run} onClose={() => setDetalhe(null)}/>
      )}
    </div>
  );
}
