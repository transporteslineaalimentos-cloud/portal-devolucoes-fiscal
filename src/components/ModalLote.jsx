import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetCobrancaLotes, dbCobrancaLoteAcao } from '../config/supabase';
import { fmtBRL, fmtDate, fmtCNPJ } from '../utils.jsx';
import { somenteLeitura } from '../lib/permissoes.js';
import { ETAPAS, ETAPA, FILIAL_NOME, notasDoLote, textoObservacao, somarPorProduto, numProtheus, qtdTxt, refNota, baixarRelacaoLotes } from '../utils/notaDebito.js';

/* ─────────────────────────────────────────────────────────────
   NF de débito (lote de cobrança)
   Tela montada na ordem do pedido de venda do Protheus: cliente
   (CNPJ do transportador), observação e itens com código Linea,
   quantidade e valor unitário. Depois registra o nº do pedido,
   o nº da NF de débito quando o financeiro faturar e o envio.
───────────────────────────────────────────────────────────── */

const hojeISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function Copiar({ texto, rotulo }) {
  const [ok, setOk] = useState(false);
  if (texto == null || texto === '') return null;
  const copiar = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(String(texto)); setOk(true); setTimeout(() => setOk(false), 1200); }
    catch { window.prompt('Copie o valor:', String(texto)); }
  };
  return (
    <button type="button" className={`nd-copiar${ok ? ' ok' : ''}`} onClick={copiar} title={`Copiar ${rotulo || ''}`.trim()} aria-label={`Copiar ${rotulo || texto}`}>
      {ok ? 'copiado' : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
    </button>
  );
}

function Campo({ rotulo, valor, copiar, children, dica }) {
  return (
    <div className="nd-campo">
      <div className="nd-campo-rot">{rotulo}{dica && <span> · {dica}</span>}</div>
      <div className="nd-campo-val">{children ?? valor}{copiar !== false && <Copiar texto={copiar ?? valor} rotulo={rotulo}/>}</div>
    </div>
  );
}

function Passos({ lote }) {
  const idx = ETAPAS.findIndex(e => e.k === lote.etapa);
  const det = {
    montando: `Criada ${fmtDate(String(lote.criado_em).slice(0, 10))}`,
    pedido: lote.pedido ? `Pedido ${lote.pedido} · ${fmtDate(lote.dt_pedido)}` : null,
    faturado: lote.nf_debito ? `NF ${lote.nf_debito} · ${fmtDate(lote.dt_nf_debito)}` : null,
    enviado: lote.dt_envio ? fmtDate(lote.dt_envio) : null,
  };
  return (
    <ol className="nd-passos">
      {ETAPAS.map((e, i) => (
        <li key={e.k} className={i < idx ? 'feito' : i === idx ? 'atual' : ''} style={i === idx ? { '--c': e.cor } : undefined}>
          <span className="nd-passo-n">{i < idx ? '✓' : i + 1}</span>
          <span className="nd-passo-t">{e.l}</span>
          {det[e.k] && i <= idx && <span className="nd-passo-d">{det[e.k]}</span>}
        </li>
      ))}
    </ol>
  );
}

export default function ModalLote({ loteId, user, onClose, onChanged }) {
  const leitura = somenteLeitura(user);
  const [lote, setLote] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [somado, setSomado] = useState(false);
  const [obs, setObs] = useState('');
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(hojeISO());
  const [editando, setEditando] = useState(null);   // 'pedido' | 'nf_debito'

  const carregar = useCallback(async () => {
    try {
      const ls = await dbGetCobrancaLotes();
      const l = ls.find(x => x.id === loteId);
      if (!l) { setErro('NF de débito não encontrada (pode ter sido cancelada).'); setLote(null); return; }
      setLote(l);
      setNumero(''); setData(hojeISO()); setEditando(null);
    } catch (e) { setErro(e.message); }
  }, [loteId]);
  useEffect(() => { carregar(); }, [carregar]);

  const notas = useMemo(() => lote ? notasDoLote(lote) : [], [lote]);
  useEffect(() => { if (lote) setObs(lote.observacao || textoObservacao(lote, notas)); }, [lote]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !salvando && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [salvando, onClose]);

  if (!lote) {
    return createPortal(
      <div className="modal-overlay" style={{ zIndex: 660 }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 420, width: '100%' }}>
          <div className="modal-body" style={{ padding: 24, fontSize: 13, color: erro ? 'var(--red)' : 'var(--text-3)' }}>{erro || 'Carregando NF de débito…'}</div>
          {erro && <div className="modal-footer"><button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button></div>}
        </div>
      </div>, document.body);
  }

  const et = ETAPA[lote.etapa] || ETAPAS[0];
  const total = notas.reduce((a, n) => a + (Number(n.valor_lote) || 0), 0);
  const semValor = notas.filter(n => n.valor_lote == null);
  const linhasSomadas = somarPorProduto(notas);
  const alertas = [];
  if (notas.length > 3) alertas.push(`${notas.length} notas nesta NF de débito. Normalmente vocês juntam até 3.`);
  semValor.forEach(n => alertas.push(`${refNota(n)} voltou ao CD e ainda não tem conferência: sem itens para cobrar.`));
  notas.forEach(n => (n.itens_lote || []).forEach(it => it.alerta && alertas.push(`${refNota(n)} · ${it.codigo || 'sem código'}: ${it.alerta}`)));
  const podeMexer = !leitura && (lote.etapa === 'montando' || lote.etapa === 'pedido');
  const nomeArq = `NF de débito ${lote.nf_debito || 'lote ' + lote.numero} - ${lote.transportador_nome || ''}`;

  const acao = async (tipo, extra = {}, msg) => {
    setSalvando(true); setErro('');
    try {
      await dbCobrancaLoteAcao(lote.id, tipo, extra);
      onChanged?.(msg);
      await carregar();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const remover = (n) => {
    if (!window.confirm(`Tirar ${refNota(n)} desta NF de débito? Ela volta para as pendentes.`)) return;
    acao('remover', { ids: [n.id] }, `${refNota(n)} voltou para as pendentes.`);
  };
  const cancelar = () => {
    const txt = lote.etapa === 'faturado' || lote.etapa === 'enviado'
      ? `Cancelar a NF de débito ${lote.nf_debito}? As ${notas.length} notas voltam a ficar pendentes de cobrança.`
      : `Cancelar esta NF de débito? As ${notas.length} notas voltam para as pendentes.`;
    if (!window.confirm(txt)) return;
    acao('cancelar', {}, 'NF de débito cancelada.').then(() => onClose());
  };
  const voltar = () => {
    const txt = { pedido: `Desfazer o pedido ${lote.pedido}?`, faturado: `Desfazer o faturamento da NF ${lote.nf_debito}? As notas voltam a ficar como não cobradas.`, enviado: 'Desfazer o envio?' }[lote.etapa];
    if (txt && window.confirm(txt)) acao('voltar', {}, 'Etapa desfeita.');
  };
  const salvarEdicao = () => {
    if (!numero.trim()) { setErro('Informe o número.'); return; }
    acao('editar', { numero: numero.trim(), data, obs: editando }, 'Número corrigido.');
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 660 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal nd" role="dialog" aria-label={`NF de débito, lote ${lote.numero}`}>
        <div className="nd-topo">
          <div style={{ minWidth: 0 }}>
            <div className="nd-sobre">NF de débito · lote {lote.numero}</div>
            <div className="nd-titulo">
              <span className="ellipsis">{lote.transportador_nome || 'Transportador'}</span>
              <span className="nd-etapa" style={{ color: et.cor, background: et.bg }}>{et.curto}</span>
            </div>
            <div className="nd-sub">
              Filial {FILIAL_NOME[lote.filial] || lote.filial || '—'} · {lote.motivo || '—'} · {notas.length} {notas.length === 1 ? 'nota' : 'notas'} · <b>{fmtBRL(total)}</b> em produtos
            </div>
          </div>
          <button className="dd-close nd-fechar" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <Passos lote={lote}/>

        <div className="nd-corpo">
          {/* ── Pedido de venda ── */}
          <section className="nd-bloco">
            <div className="nd-bloco-tit">
              <span>Pedido de venda no Protheus</span>
              <span className="nd-bloco-dica">Copie cada campo para o pedido</span>
            </div>
            <div className="nd-grade">
              <Campo rotulo="Cliente (CNPJ do transportador)" valor={fmtCNPJ(lote.transportador_cnpj)} copiar={String(lote.transportador_cnpj || '').replace(/\D/g, '')}
                dica={lote.transportador_nome}/>
              <Campo rotulo="Filial que emite" valor={`${FILIAL_NOME[lote.filial] || '—'} · ${fmtCNPJ(lote.filial)}`} copiar={false}/>
            </div>
            <div className="nd-campo" style={{ marginTop: 10 }}>
              <div className="nd-campo-rot">Observação</div>
              <div className="nd-obs">
                <textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)} readOnly={!podeMexer || lote.etapa !== 'montando'}/>
                <Copiar texto={obs} rotulo="observação"/>
              </div>
            </div>

            <div className="nd-itens-topo">
              <div className="nd-itens-tit">Itens <span>· só o valor dos produtos, com o mesmo desconto da NF de venda</span></div>
              <div className="nd-seg" role="group" aria-label="Como mostrar os itens">
                <button className={!somado ? 'on' : ''} onClick={() => setSomado(false)}>Por nota</button>
                <button className={somado ? 'on' : ''} onClick={() => setSomado(true)}>Somado por produto</button>
              </div>
            </div>
            <div className="nd-tabela-wrap">
              <table className="nd-tabela">
                <thead><tr>
                  <th>Código</th><th>Produto</th><th>Un</th><th className="dir">Qtd</th><th className="dir">Valor unitário</th><th className="dir">Total</th>
                </tr></thead>
                <tbody>
                  {!somado && notas.map(n => (
                    <FragmentNota key={n.id} n={n} podeRemover={podeMexer && notas.length > 1} onRemover={() => remover(n)}/>
                  ))}
                  {somado && linhasSomadas.map((it, i) => <LinhaItem key={i} it={it} sub={it.nfs.join(', ')}/>)}
                </tbody>
                <tfoot><tr><td colSpan={5}>Total da NF de débito</td><td className="dir">{fmtBRL(total)}</td></tr></tfoot>
              </table>
            </div>
            {alertas.length > 0 && (
              <ul className="nd-alertas">
                {alertas.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </section>

          {/* ── Registro ── */}
          <section className="nd-bloco">
            <div className="nd-bloco-tit"><span>Registro</span></div>
            {lote.pedido && (
              <div className="nd-reg-linha">
                <span>Pedido de venda</span><b>{lote.pedido}</b><span className="nd-reg-dt">{fmtDate(lote.dt_pedido)}</span>
                {!leitura && editando !== 'pedido' && <button className="btn btn-ghost btn-xs" onClick={() => { setEditando('pedido'); setNumero(lote.pedido); setData(lote.dt_pedido || hojeISO()); }}>corrigir</button>}
              </div>
            )}
            {lote.nf_debito && (
              <div className="nd-reg-linha">
                <span>NF de débito</span><b>{lote.nf_debito}</b><span className="nd-reg-dt">{fmtDate(lote.dt_nf_debito)}</span>
                {!leitura && editando !== 'nf_debito' && <button className="btn btn-ghost btn-xs" onClick={() => { setEditando('nf_debito'); setNumero(lote.nf_debito); setData(lote.dt_nf_debito || hojeISO()); }}>corrigir</button>}
              </div>
            )}
            {lote.dt_envio && <div className="nd-reg-linha"><span>Enviada ao transportador</span><b>{fmtDate(lote.dt_envio)}</b></div>}

            {!leitura && editando && (
              <div className="nd-form">
                <label>{editando === 'pedido' ? 'Nº do pedido' : 'Nº da NF de débito'}<input className="input" value={numero} onChange={e => setNumero(e.target.value)} autoFocus/></label>
                <label>Data<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando} onClick={salvarEdicao}>Salvar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            )}

            {!leitura && !editando && lote.etapa === 'montando' && (
              <div className="nd-form">
                <label>Nº do pedido de venda<input className="input" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: 054321"/></label>
                <label>Data<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando || !numero.trim() || semValor.length > 0}
                  onClick={() => acao('pedido', { numero: numero.trim(), data, obs: obs.trim() || null }, `Pedido ${numero.trim()} registrado. Agora é aguardar o faturamento.`)}>
                  {salvando ? 'Salvando…' : 'Registrar pedido'}
                </button>
              </div>
            )}
            {!leitura && !editando && lote.etapa === 'pedido' && (
              <div className="nd-form">
                <label>Nº da NF de débito<input className="input" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Quando o financeiro faturar"/></label>
                <label>Emissão<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando || !numero.trim()}
                  onClick={() => acao('faturar', { numero: numero.trim(), data }, `NF de débito ${numero.trim()} registrada. As notas ficaram como cobradas.`)}>
                  {salvando ? 'Salvando…' : 'Registrar faturamento'}
                </button>
              </div>
            )}
            {!leitura && !editando && lote.etapa === 'faturado' && (
              <div className="nd-form">
                <label>Enviada em<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando} onClick={() => acao('enviar', { data }, 'Envio ao transportador registrado.')}>
                  Marcar como enviada ao transportador
                </button>
              </div>
            )}
            {semValor.length > 0 && lote.etapa === 'montando' && <div className="nd-nota">Para registrar o pedido, tire a nota sem conferência ou importe a conferência do CD.</div>}
            {lote.etapa === 'pedido' && lote.dias_etapa > 0 && <div className="nd-nota">Aguardando o faturamento há {lote.dias_etapa} {lote.dias_etapa === 1 ? 'dia' : 'dias'}.</div>}
            {erro && <div className="nd-erro">{erro}</div>}
          </section>
        </div>

        <div className="modal-footer nd-rodape">
          {!leitura && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={cancelar} disabled={salvando}>Cancelar NF de débito</button>}
          {!leitura && lote.etapa !== 'montando' && <button className="btn btn-ghost btn-sm" onClick={voltar} disabled={salvando}>Desfazer última etapa</button>}
          <span style={{ flex: 1 }}/>
          <button className="btn btn-outline btn-sm" onClick={() => baixarRelacaoLotes([lote], nomeArq).catch(e => alert(e.message))}>Relação para o transportador (Excel)</button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>, document.body);
}

function LinhaItem({ it, sub }) {
  return (
    <tr className={it.alerta ? 'alerta' : undefined}>
      <td className="mono"><span className="nd-cel">{it.codigo || <i>sem código</i>}<Copiar texto={it.codigo} rotulo="código"/></span></td>
      <td><div className="ellipsis" style={{ maxWidth: 300 }} title={it.descricao}>{it.descricao}</div>{sub && <div className="nd-linha-sub">{sub}</div>}</td>
      <td>{it.unidade}</td>
      <td className="dir"><span className="nd-cel dir">{qtdTxt(it.qtd)}<Copiar texto={qtdTxt(it.qtd)} rotulo="quantidade"/></span></td>
      <td className="dir"><span className="nd-cel dir">{it.valor_unitario == null ? '—' : numProtheus(it.valor_unitario)}<Copiar texto={it.valor_unitario == null ? '' : numProtheus(it.valor_unitario)} rotulo="valor unitário"/></span></td>
      <td className="dir" style={{ fontWeight: 650, color: 'var(--text)' }}>{it.valor_total == null ? 'a definir' : fmtBRL(it.valor_total)}</td>
    </tr>
  );
}

function FragmentNota({ n, podeRemover, onRemover }) {
  return (
    <>
      <tr className="nd-nota-linha">
        <td colSpan={5}>
          <b>{refNota(n)}</b>{!n.lancamento_manual && n.nf_venda ? ` · NF venda ${n.nf_venda}` : ''} · {n.nome_emitente}
          {n.dt_entrega && <span className="nd-linha-sub"> · entregue em {fmtDate(n.dt_entrega)}</span>}
          {podeRemover && <button className="btn btn-ghost btn-xs" style={{ marginLeft: 8 }} onClick={onRemover}>tirar da NF</button>}
        </td>
        <td className="dir">{n.valor_lote == null ? 'sem conferência' : fmtBRL(n.valor_lote)}</td>
      </tr>
      {(n.itens_lote || []).map((it, i) => <LinhaItem key={i} it={it} sub={it.motivo && it.motivo !== 'Não voltou ao CD' ? it.motivo.toLowerCase() : null}/>)}
      {(!n.itens_lote || n.itens_lote.length === 0) && (
        <tr><td colSpan={6} style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Sem itens para cobrar nesta nota.</td></tr>
      )}
    </>
  );
}
