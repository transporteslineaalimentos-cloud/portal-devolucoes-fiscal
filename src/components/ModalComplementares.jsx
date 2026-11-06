import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetComplementares, dbClassificarComplementar } from '../config/supabase';

/* CT-es complementares: o portal lê o motivo na observação do CT-e e troca
   "complementar" pelo custo de verdade (dedicado, descarga, diária...).
   Aqui ficam os que a leitura não identificou e a correção manual. */

export const TIPOS_COMPLEMENTAR = [
  { v: 'DEDICADO', l: 'Dedicado' },
  { v: 'DESCARGA', l: 'Descarga' },
  { v: 'PALLET', l: 'Pallet' },
  { v: 'DIARIA', l: 'Diária' },
  { v: 'REENTREGA', l: 'Reentrega' },
  { v: 'DEVOLUCAO', l: 'Devolução' },
  { v: 'TRANSFERENCIA CHOCOLATE', l: 'Transferência chocolate' },
  { v: 'TAXA DE ENTREGA', l: 'Taxa de entrega (TDE/TDA)' },
  { v: 'ARMAZENAGEM', l: 'Armazenagem' },
  { v: 'AJUDANTE', l: 'Ajudante' },
  { v: 'ENTREGA NORMAL', l: 'Frete normal (diferença de frete)' },
  { v: 'OUTROS', l: 'Outros' },
];
const ROTULO = Object.fromEntries(TIPOS_COMPLEMENTAR.map(t => [t.v, t.l]));
const rotulo = (v) => ROTULO[v] || (v === 'COMPLEMENTAR' ? 'Sem tipo' : v || '');

const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeT = (s) => !s ? '' : s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());

const FILAS = [
  { k: 'pendente', l: 'Sem tipo', f: r => r.tipo_custo === 'COMPLEMENTAR' },
  { k: 'auto', l: 'Classificados pela observação', f: r => !r.tipo_manual && r.tipo_auto },
  { k: 'manual', l: 'Classificados à mão', f: r => !!r.tipo_manual },
  { k: 'todos', l: 'Todos', f: () => true },
];

export default function ModalComplementares({ de, ate, podeEditar, onClose, onAlterado }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [fila, setFila] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [tipo, setTipo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState(null);

  const carregar = () => dbGetComplementares(de, ate).then(setLista).catch(e => setErro(e.message));
  useEffect(() => { carregar(); }, [de, ate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  const contagem = useMemo(() => Object.fromEntries(FILAS.map(q => [q.k, (lista || []).filter(q.f)])), [lista]);
  const linhas = useMemo(() => {
    const q = semAcento(busca.trim());
    const base = contagem[fila] || [];
    return !q ? base : base.filter(r => semAcento([r.cte_numero, r.transp_nome, r.nfs, r.cliente, r.observacao, rotulo(r.tipo_custo)].join(' ')).includes(q));
  }, [contagem, fila, busca]);

  const todosMarcados = linhas.length > 0 && linhas.every(r => sel.has(r.cte_key));
  const marcar = (k) => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const marcarTodos = () => setSel(s => {
    const n = new Set(s);
    if (todosMarcados) linhas.forEach(r => n.delete(r.cte_key)); else linhas.forEach(r => n.add(r.cte_key));
    return n;
  });

  const aplicar = async (keys, novoTipo) => {
    if (!keys.length) return;
    setSalvando(true); setAviso('');
    try {
      const n = await dbClassificarComplementar(keys, novoTipo || null);
      setAviso(`${n} CT-e${n === 1 ? '' : 's'} ${novoTipo ? `marcado${n === 1 ? '' : 's'} como ${rotulo(novoTipo)}` : 'voltaram para a leitura automática'}. Os números da aba se atualizam em até 2 minutos.`);
      setSel(new Set()); setTipo('');
      await carregar();
      onAlterado?.();
    } catch (e) { setAviso('Erro: ' + e.message); }
    setSalvando(false);
  };

  const totalSel = (lista || []).filter(r => sel.has(r.cte_key)).reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const th = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 };
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

  return createPortal((
    <div className="modal-overlay" style={{ zIndex: 600 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal cf-modal-ctes" role="dialog" aria-label="CT-es complementares">
        <div style={{ padding: '18px 22px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CT-es complementares</div>
              <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Tipo de custo dos complementares</h2>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, maxWidth: 720 }}>
                O portal lê o motivo na observação do CT-e (dedicado, descarga, diária, pallet…) e usa esse tipo no lugar de "complementar".
                O que não deu para identificar fica em <b>Sem tipo</b>. A escolha manual vale mais que a leitura automática. {dataBR(de)} a {dataBR(ate)}.
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar" style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {FILAS.map(q => {
              const itens = contagem[q.k] || [];
              const v = itens.reduce((s, r) => s + (Number(r.valor) || 0), 0);
              return (
                <button key={q.k} className={`btn btn-sm ${fila === q.k ? 'btn-primary' : 'btn-outline'}`} style={{ height: 30 }}
                  onClick={() => { setFila(q.k); setSel(new Set()); }}>
                  {q.l} · {lista ? itens.length : '…'}{lista && itens.length ? ` · ${brl(v).replace(/,\d\d$/, '')}` : ''}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            <input className="input" placeholder="Buscar CT-e, transportador, NF, observação…" value={busca}
              onChange={e => setBusca(e.target.value)} style={{ flex: '1 1 260px', height: 32, fontSize: 12.5 }}/>
            {podeEditar && (
              <>
                <select className="input" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 230, height: 32, fontSize: 12.5 }} aria-label="Tipo de custo">
                  <option value="">Escolha o tipo…</option>
                  {TIPOS_COMPLEMENTAR.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" style={{ height: 32 }} disabled={!sel.size || !tipo || salvando}
                  onClick={() => aplicar([...sel], tipo)}>
                  {salvando ? 'Salvando…' : `Aplicar em ${sel.size} selecionado${sel.size === 1 ? '' : 's'}`}
                </button>
              </>
            )}
          </div>
          {sel.size > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>{sel.size} selecionado{sel.size === 1 ? '' : 's'} · {brl(totalSel)}</div>}
          {aviso && <div style={{ fontSize: 12, marginTop: 8, color: aviso.startsWith('Erro') ? 'var(--red)' : 'var(--green)' }}>{aviso}</div>}
        </div>

        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {erro && <div style={{ padding: 22, color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar: {erro}</div>}
          {!lista && !erro && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Carregando…</div>}
          {lista && !linhas.length && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Nenhum CT-e aqui.</div>}
          {lista && linhas.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr>
                  {podeEditar && <th style={{ ...th, width: 30 }}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} aria-label="Selecionar todos"/></th>}
                  <th style={th}>CT-e</th><th style={th}>Emissão</th><th style={th}>Transportador</th><th style={th}>NFs</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={th}>Tipo de custo</th><th style={{ ...th, width: '38%' }}>Observação do CT-e</th>
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 400).map(r => {
                  const open = aberto === r.cte_key;
                  const obs = String(r.observacao || '').trim();
                  return (
                    <tr key={r.cte_key} style={{ background: sel.has(r.cte_key) ? 'var(--surface-2)' : undefined }}>
                      {podeEditar && <td style={td}><input type="checkbox" checked={sel.has(r.cte_key)} onChange={() => marcar(r.cte_key)} aria-label={`Selecionar CT-e ${r.cte_numero}`}/></td>}
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.cte_numero}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataBR(r.dt)}</td>
                      <td style={td}>{nomeT(r.transp_nome)}</td>
                      <td style={td}>{r.nfs}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{brl(r.valor)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {podeEditar ? (
                          <select className="input" value={r.tipo_manual || ''} disabled={salvando}
                            onChange={e => aplicar([r.cte_key], e.target.value)} style={{ height: 30, padding: '2px 8px', fontSize: 12, width: 210 }}
                            aria-label={`Tipo do CT-e ${r.cte_numero}`}>
                            <option value="">{r.tipo_auto ? `Automático: ${rotulo(r.tipo_auto)}` : 'Sem tipo'}</option>
                            {TIPOS_COMPLEMENTAR.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                          </select>
                        ) : <b style={{ color: 'var(--text)' }}>{rotulo(r.tipo_custo)}</b>}
                        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>
                          {r.tipo_manual ? `À mão · ${r.usuario_manual || ''} · ${dataBR(r.dt_manual)}` : r.tipo_auto ? 'Pela observação' : 'Sem tipo identificado'}
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: 11.5, wordBreak: 'break-word' }}>
                        {!obs ? <span style={{ color: 'var(--text-3)' }}>Sem observação</span> : (
                          <span onClick={() => setAberto(open ? null : r.cte_key)} style={{ cursor: obs.length > 180 ? 'pointer' : 'default' }}
                            title={obs.length > 180 ? (open ? 'Clique para recolher' : 'Clique para ver tudo') : undefined}>
                            {open || obs.length <= 180 ? obs : obs.slice(0, 180) + '…'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {linhas.length > 400 && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Mostrando 400 de {linhas.length}. Use a busca para achar os outros.</div>}
        </div>
      </div>
    </div>
  ), document.fullscreenElement || document.body);
}
