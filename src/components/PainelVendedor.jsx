import { useMemo, useState } from 'react';
import { SEM_COD, FAT_MINIMO } from '../lib/pivotVendedor.js';

/* ─────────────────────────────────────────────────────────────
   Devolução por vendedor (Painel Gerencial).
   Índice = valor devolvido ÷ valor faturado para os clientes do
   vendedor, no mesmo período. O vendedor vem do cadastro de
   clientes (CNPJ exato; se a filial não estiver, a rede).
───────────────────────────────────────────────────────────── */

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ACIMA = '#D6494E';
const ABAIXO = '#1E4DB7';

const brl0 = (v) => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');
const brlK = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (Math.abs(n) >= 1e3) return 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil';
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
};
const pct = (a, b) => (b ? ((a / b) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—');

/* Barras: ranking por índice ou por valor */
export function RankingVendedor({ pv, onDrill, modoInicial = 'indice', limite = 15, alturaMax }) {
  const [modo, setModo] = useState(modoInicial);
  const [todos, setTodos] = useState(false);

  const lista = useMemo(() => {
    const base = pv.todos.filter(o => o.cod !== SEM_COD);
    if (modo === 'indice') {
      return base.filter(o => o.fatT >= FAT_MINIMO).map(o => ({ ...o, ind: o.devT / o.fatT })).sort((a, b) => b.ind - a.ind || b.devT - a.devT);
    }
    return base.filter(o => o.devT > 0).map(o => ({ ...o, ind: o.fatT ? o.devT / o.fatT : null })).sort((a, b) => b.devT - a.devT);
  }, [pv, modo]);
  const foraIndice = pv.todos.filter(o => o.cod !== SEM_COD && o.devT > 0 && o.fatT < FAT_MINIMO);

  const vis = todos ? lista : lista.slice(0, limite);
  const max = Math.max(1e-9, ...vis.map(o => (modo === 'indice' ? o.ind : o.devT)), modo === 'indice' ? pv.media : 0);
  const posMedia = modo === 'indice' && pv.media ? (pv.media / max) * 62 : null;

  const abrir = (o) => onDrill?.({ titulo: `Vendedor: ${o.nome}`, dim: 'vendedor', valor: o.cod });

  const btn = (k, l) => (
    <button key={k} onClick={() => setModo(k)} className="btn btn-sm"
      style={{ height: 28, fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: '0 10px',
        background: modo === k ? 'var(--blue)' : 'transparent', color: modo === k ? '#fff' : 'var(--text-2)',
        border: '1px solid ' + (modo === k ? 'var(--blue)' : 'var(--border)') }}>{l}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>{btn('indice', '% do faturado')}{btn('valor', 'Valor devolvido')}</div>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Média comercial da empresa no período: <b style={{ color: 'var(--text)' }}>{pct(pv.devG, pv.fatG)}</b>
          {modo === 'indice' && <> · <span style={{ color: ACIMA, fontWeight: 600 }}>vermelho</span> = acima da média</>}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', maxHeight: alturaMax, overflowY: alturaMax ? 'auto' : undefined }}>
        {vis.map((o, i) => {
          const v = modo === 'indice' ? o.ind : o.devT;
          const cor = o.ind != null && o.ind > pv.media ? ACIMA : ABAIXO;
          return (
            <div key={o.cod} className="drill-row" onClick={() => abrir(o)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && abrir(o)}
              title={`${o.nome}\nDevolvido (área Comercial): ${brl0(o.devT)} (${o.qT} NFs)\nFaturado: ${brl0(o.fatT)}\nÍndice: ${pct(o.devT, o.fatT)}\nClique para ver as notas`}
              style={{ display: 'grid', gridTemplateColumns: '22px minmax(110px, 30%) minmax(0, 1fr)', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.nome}</span>
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ height: 16, width: `${Math.max(1.5, (v / max) * 62)}%`, background: cor, borderRadius: '0 4px 4px 0', flexShrink: 0, opacity: 0.9 }}/>
                <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                  {modo === 'indice'
                    ? <><b>{pct(o.devT, o.fatT)}</b> <span style={{ color: 'var(--text-3)' }}>· {brlK(o.devT)} de {brlK(o.fatT)}</span></>
                    : <><b>{brl0(o.devT)}</b> <span style={{ color: 'var(--text-3)' }}>· {o.qT} NF{o.qT === 1 ? '' : 's'} · {o.fatT ? pct(o.devT, o.fatT) + ' do faturado' : 'sem faturamento'}</span></>}
                </span>
                {posMedia != null && (
                  <span aria-hidden style={{ position: 'absolute', left: `${posMedia}%`, top: -4, bottom: -4, borderLeft: '1.5px dashed var(--text-3)', opacity: 0.55, pointerEvents: 'none' }}/>
                )}
              </span>
            </div>
          );
        })}
        {!vis.length && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Nenhum vendedor com devolução comercial no período.</div>}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        {lista.length > limite && (
          <button className="btn btn-ghost btn-sm no-print" onClick={() => setTodos(t => !t)}>
            {todos ? `Mostrar só os ${limite} primeiros` : `Mostrar todos (${lista.length})`}
          </button>
        )}
        {modo === 'indice' && foraIndice.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {foraIndice.length} vendedor{foraIndice.length === 1 ? '' : 'es'} com faturamento abaixo de {brlK(FAT_MINIMO)} no período fica{foraIndice.length === 1 ? '' : 'm'} fora do ranking de índice (aparece{foraIndice.length === 1 ? '' : 'm'} em "Valor devolvido").
          </span>
        )}
        {pv.sem && pv.sem.devT > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => abrir(pv.sem)}
            title="Clientes que não estão no cadastro de vendedores — clique para ver as notas">
            Sem vendedor no cadastro: {brl0(pv.sem.devT)} · {pv.sem.qT} NF{pv.sem.qT === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </div>
  );
}

/* Tabela mês a mês: índice de cada vendedor em cada mês */
export function TabelaVendedor({ pv, ini, fim, onDrill, limite = 15 }) {
  const [aberto, setAberto] = useState(false);
  const [colHover, setColHover] = useState(null);
  const cols = Array.from({ length: fim - ini + 1 }, (_, i) => ini - 1 + i);
  const linhas = useMemo(() => pv.todos.filter(o => o.devT > 0).sort((a, b) => b.devT - a.devT), [pv]);
  const vis = aberto ? linhas : linhas.slice(0, limite);
  const ref = pv.media || 0.01;

  // cor pela distância da média: abaixo = neutro/azulado, acima = vermelho crescente
  const cor = (d, f) => {
    if (!d) return 'transparent';
    if (!f) return 'rgba(214,73,78,0.10)';
    const r = (d / f) / ref;
    if (r <= 1) return `rgba(30,77,183,${(0.04 + 0.10 * r).toFixed(3)})`;
    return `rgba(214,73,78,${Math.min(0.62, 0.10 + 0.17 * (r - 1)).toFixed(3)})`;
  };
  const dr = (o, mi, mf, rot) => () => onDrill?.({ titulo: `Vendedor: ${o.nome}${rot ? ' · ' + rot : ''}`, dim: 'vendedor', valor: o.cod, mesIni: mi, mesFim: mf });

  const th = { padding: '7px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 };
  const td = { padding: '6px 8px', fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', borderTop: '1px solid var(--border)' };
  const fixa = { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 };

  return (
    <>
      <div className="pg-tabela" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ ...th, ...fixa, textAlign: 'left', minWidth: 200, zIndex: 3 }}>Vendedor</th>
            {cols.map(i => (
              <th key={i} style={{ ...th, color: colHover === i ? 'var(--blue)' : th.color }} onMouseEnter={() => setColHover(i)}>{MESES[i]}</th>
            ))}
            <th style={{ ...th, color: 'var(--text)', borderLeft: '1px solid var(--border)' }} title="Só área responsável Comercial">Devolvido</th>
            <th style={{ ...th, color: 'var(--text)' }}>Faturado</th>
            <th style={{ ...th, color: 'var(--text)' }} title="Devolvido ÷ faturado no período">Índice</th>
            <th style={{ ...th, color: 'var(--text)' }}>NFs</th>
          </tr></thead>
          <tbody>
            {vis.map(o => (
              <tr key={o.cod} className="pg-linha" onMouseLeave={() => setColHover(null)}>
                <td className="drill" onClick={dr(o)} title={`${o.nome} — clique para ver as notas do período`}
                  style={{ ...td, ...fixa, textAlign: 'left', fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.nome}</td>
                {cols.map(i => {
                  const d = o.dev[i], f = o.fat[i];
                  return (
                    <td key={i} className={d ? 'drill' : undefined} onClick={d ? dr(o, i + 1, i + 1, MESES[i]) : undefined}
                      onMouseEnter={() => setColHover(i)}
                      title={`${o.nome} · ${MESES[i]}\nDevolvido (área Comercial): ${brl0(d)} (${o.qtd[i]} NFs)\nFaturado: ${brl0(f)}`}
                      style={{ ...td, background: cor(d, f), color: d ? 'var(--text)' : 'var(--text-3)',
                        boxShadow: colHover === i ? 'inset 0 0 0 1px var(--blue)' : undefined }}>
                      {d ? (f ? pct(d, f) : 'sem fat.') : '–'}
                    </td>
                  );
                })}
                <td className="drill" onClick={dr(o)} style={{ ...td, borderLeft: '1px solid var(--border)', fontWeight: 600 }}>{brl0(o.devT)}</td>
                <td style={{ ...td, color: 'var(--text-2)' }}>{brlK(o.fatT)}</td>
                <td style={{ ...td, fontWeight: 700, color: o.fatT && o.devT / o.fatT > pv.media ? ACIMA : 'var(--text)' }}>{o.fatT ? pct(o.devT, o.fatT) : '—'}</td>
                <td style={{ ...td, color: 'var(--text-2)' }}>{o.qT}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length > limite && (
        <button className="btn btn-ghost btn-sm no-print" style={{ marginTop: 8 }} onClick={() => setAberto(a => !a)}>
          {aberto ? `Mostrar só os ${limite} maiores` : `Mostrar todos (${linhas.length})`}
        </button>
      )}
    </>
  );
}

