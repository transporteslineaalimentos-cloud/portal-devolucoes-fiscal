import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../config/supabase';
import { STATUS_CORES, baixarPlanilhaConsulta } from '../utils/planilhaConsulta.js';
import DetalheDrawer from './DetalheDrawer.jsx';

/* ─────────────────────────────────────────────────────────────
   Drill-down do Painel Gerencial: lista completa das notas por
   trás de qualquer número clicado, com busca, ordenação, detalhe
   da nota e download da seleção.
───────────────────────────────────────────────────────────── */

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (d) => { if (!d) return '—'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const nfv = (ch) => (ch && String(ch).length >= 34) ? String(parseInt(String(ch).slice(25, 34), 10)) : '—';

function prazo(r) {
  if (r.lancado_protheus) return { txt: 'Lançada', cor: '#3F4650', bg: '#ECEDEF', dias: null };
  if (!r.dt_ref) return { txt: '—', cor: 'var(--text-3)', bg: 'transparent', dias: null };
  const dias = 90 - Math.floor((Date.now() - new Date(r.dt_ref + 'T00:00:00').getTime()) / 86400000);
  if (dias > 15) return { txt: `${dias}d`, cor: '#17663A', bg: '#DDF3E4', dias };
  if (dias > 0)  return { txt: `${dias}d`, cor: '#7A4E00', bg: '#FFF0CC', dias };
  return { txt: `${Math.abs(dias)}d atraso`, cor: '#A8261B', bg: '#FDE4E2', dias };
}

const COLS = [
  { k: 'nf',      t: 'NF Dev.',       w: 82,  v: r => r.lancamento_manual ? '—' : (r.nf_numero ?? '—'), s: r => Number(r.nf_numero) || 0 },
  { k: 'nfv',     t: 'NF Venda',      w: 82,  v: r => nfv(r.chave_nfe_referenciada), s: r => Number(nfv(r.chave_nfe_referenciada)) || 0 },
  { k: 'data',    t: 'Data ref.',     w: 98,  v: r => dt(r.dt_ref), s: r => r.dt_ref || '' },
  { k: 'tipo',    t: 'Tipo',          w: 64,  v: r => r.tipo_dev === 'total' ? 'Total' : 'Parcial', s: r => r.tipo_dev },
  { k: 'cliente', t: 'Cliente',       w: 220, v: r => r.nome_emitente || '—', s: r => r.nome_emitente || '' },
  { k: 'vend',    t: 'Vendedor',      w: 170, v: r => r.vendedor || '—', s: r => r.vendedor || '' },
  { k: 'uf',      t: 'UF',            w: 46,  v: r => r.uf_emitente || '—', s: r => r.uf_emitente || '' },
  { k: 'valor',   t: 'Valor',         w: 124, v: r => brl(r.valor), s: r => Number(r.valor) || 0, right: true },
  { k: 'motivo',  t: 'Motivo',        w: 190, v: r => r.motivo, s: r => r.motivo },
  { k: 'area',    t: 'Área',          w: 120, v: r => r.area, s: r => r.area },
  { k: 'canal',   t: 'Canal',         w: 150, v: r => r.canal, s: r => r.canal },
  { k: 'status',  t: 'Status operacional', w: 200, v: r => r.st_op, s: r => r.st_op },
  { k: 'prazo',   t: 'Prazo 90d',     w: 84,  v: r => prazo(r).txt, s: r => prazo(r).dias ?? 9999 },
  { k: 'lanc',    t: 'Protheus',      w: 76,  v: r => r.lancado_protheus ? dt(r.dt_lancamento_protheus) : 'Não', s: r => r.dt_lancamento_protheus || '' },
  { k: 'cd',      t: 'CD',            w: 44,  v: r => r.retornou_cd ? 'Sim' : 'Não', s: r => r.retornou_cd ? 1 : 0 },
  { k: 'transp',  t: 'Transportador', w: 170, v: r => r.transp_nome, s: r => r.transp_nome },
];

export default function ModalNotasPainel({ filtro, titulo, user, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ord, setOrd] = useState({ k: 'valor', dir: -1 });
  const [selId, setSelId] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const [reload, setReload] = useState(0);
  /* em tela cheia (modo apresentação) o navegador só desenha o que está
     dentro do elemento em tela cheia, então o modal é montado lá dentro. */
  const [alvo, setAlvo] = useState(() => (typeof document !== 'undefined' ? document.fullscreenElement || document.body : null));

  useEffect(() => {
    let vivo = true;
    setErro('');
    supabase.rpc('get_painel_notas', {
      p_ano: filtro.ano, p_mes_ini: filtro.mesIni, p_mes_fim: filtro.mesFim,
      p_dim: filtro.dim || null, p_valor: filtro.valor ?? null,
    }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) setErro(error.message); else setRows(data || []);
    });
    return () => { vivo = false; };
  }, [filtro, reload]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !selId) { e.stopPropagation(); onClose(); } };
    const fs = () => setAlvo(document.fullscreenElement || document.body);
    window.addEventListener('keydown', h, true);
    document.addEventListener('fullscreenchange', fs);
    return () => { window.removeEventListener('keydown', h, true); document.removeEventListener('fullscreenchange', fs); };
  }, [onClose, selId]);

  const visiveis = useMemo(() => {
    if (!rows) return [];
    const q = busca.trim().toLowerCase();
    let r = rows;
    if (q) r = r.filter(x => [x.nf_numero, nfv(x.chave_nfe_referenciada), x.nome_emitente, x.cnpj_emitente, x.motivo, x.transp_nome, x.st_op, x.canal, x.vendedor]
      .some(v => String(v ?? '').toLowerCase().includes(q)));
    const col = COLS.find(c => c.k === ord.k);
    return [...r].sort((a, b) => { const va = col.s(a), vb = col.s(b); return (va > vb ? 1 : va < vb ? -1 : 0) * ord.dir; });
  }, [rows, busca, ord]);

  const total = visiveis.reduce((a, r) => a + (Number(r.valor) || 0), 0);
  const periodo = filtro.mesIni === filtro.mesFim ? `${MESES[filtro.mesIni - 1]}/${filtro.ano}` : `${MESES[filtro.mesIni - 1]} a ${MESES[filtro.mesFim - 1]}/${filtro.ano}`;

  const baixar = async () => {
    setBaixando(true);
    try { await baixarPlanilhaConsulta(visiveis, { periodoTxt: `${titulo} ${periodo}` }); }
    catch (e) { alert('Erro ao gerar a planilha: ' + e.message); }
    setBaixando(false);
  };

  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', zIndex: 1 };
  const td = { padding: '7px 10px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' };

  if (!alvo) return null;

  return createPortal(
    <>
      <div className="modal-overlay" style={{ zIndex: 600, padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" aria-label={titulo}
          style={{ maxWidth: 1480, width: '100%', height: 'calc(100vh - 40px)', maxHeight: 'none' }}>
          <div className="modal-header" style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  {periodo} · {rows ? `${visiveis.length} nota${visiveis.length === 1 ? '' : 's'}${busca ? ` de ${rows.length}` : ''} · ${brl(total)}` : 'carregando…'}
                </div>
              </div>
              <input className="input" placeholder="Buscar NF, cliente, CNPJ, vendedor, motivo, transportador…" value={busca}
                onChange={e => setBusca(e.target.value)} style={{ width: 320 }} autoFocus/>
              <button className="btn btn-outline btn-sm" onClick={baixar} disabled={!rows || !visiveis.length || baixando}>
                {baixando ? 'Gerando…' : 'Baixar estas notas (Excel)'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">Fechar</button>
            </div>
          </div>

          <div className="modal-body" style={{ padding: 0, overflow: 'auto' }}>
            {erro && <div style={{ padding: 20, color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar as notas: {erro}</div>}
            {!rows && !erro && <div style={{ padding: 40, color: 'var(--text-3)', fontSize: 13 }}>Carregando notas…</div>}
            {rows && (
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed', minWidth: COLS.reduce((a, c) => a + c.w, 0) }}>
                <colgroup>{COLS.map(c => <col key={c.k} style={{ width: c.w }}/>)}</colgroup>
                <thead><tr>
                  {COLS.map(c => (
                    <th key={c.k} style={{ ...th, textAlign: c.right ? 'right' : 'left', color: ord.k === c.k ? 'var(--text)' : th.color }}
                      onClick={() => setOrd(o => ({ k: c.k, dir: o.k === c.k ? -o.dir : (c.k === 'valor' ? -1 : 1) }))}>
                      {c.t}{ord.k === c.k ? (ord.dir > 0 ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {visiveis.map(r => {
                    const p = prazo(r);
                    const sc = STATUS_CORES[r.st_op];
                    return (
                      <tr key={r.id} className="drill-row" style={{ cursor: 'pointer' }} onClick={() => setSelId(r.id)} title="Clique para abrir a nota completa">
                        {COLS.map(c => {
                          if (c.k === 'status') return (
                            <td key={c.k} style={td}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: sc ? '#' + sc.bg : 'var(--surface-3)', color: sc ? '#' + sc.fg : 'var(--text-2)' }}>{r.st_op}</span>
                            </td>
                          );
                          if (c.k === 'prazo') return (
                            <td key={c.k} style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: p.bg, color: p.cor }}>{p.txt}</span></td>
                          );
                          return <td key={c.k} title={String(c.v(r))} style={{ ...td, textAlign: c.right ? 'right' : 'left', color: ['nf', 'valor', 'cliente'].includes(c.k) ? 'var(--text)' : td.color, fontWeight: ['nf', 'valor'].includes(c.k) ? 600 : 400 }}>{c.v(r)}</td>;
                        })}
                      </tr>
                    );
                  })}
                  {visiveis.length === 0 && <tr><td colSpan={COLS.length} style={{ ...td, padding: 24, color: 'var(--text-3)' }}>Nenhuma nota encontrada.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selId && (
        <DetalheDrawer id={selId} user={user} camada={700}
          onClose={() => setSelId(null)}
          onSaved={() => { setReload(x => x + 1); onChanged?.(); }}/>
      )}
    </>
  , alvo);
}
