import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetCobrancaLotes, dbCobrancaLoteAcao, dbCobrancaLoteTransferir, dbGetUsuarios } from '../config/supabase';
import { fmtBRL, fmtDate, fmtCNPJ } from '../utils.jsx';
import { somenteLeitura } from '../lib/permissoes.js';
import ModalTutorialNFDebito from './ModalTutorialNFDebito.jsx';
import { ETAPAS, ETAPA, FILIAL_NOME, FILIAL_PROTHEUS, PROTHEUS, dataEntregaProtheus, notasDoLote, textoObservacao, numProtheus, qtdTxt, refNota, baixarRelacaoLotes } from '../utils/notaDebito.js';

/* ─────────────────────────────────────────────────────────────
   NF de débito (lote de cobrança) em forma de passo a passo:
   1. cabeçalho do pedido de venda no Protheus (cliente, operação, observação)
   2. uma linha por produto (código, qtd, preço; Prc lista, tipo de saída e armazém fixos)
   3. nº do pedido · 4. nº da NF de débito quando o financeiro faturar · 5. envio ao transportador
   Feita para quem nunca emitiu uma NF de débito conseguir seguir sozinho.
───────────────────────────────────────────────────────────── */

const hojeISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const ORDEM = { montando: 0, pedido: 1, faturado: 2, enviado: 3 };

function Copiar({ texto, rotulo, grande }) {
  const [ok, setOk] = useState(false);
  if (texto == null || texto === '') return null;
  const copiar = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(String(texto)); setOk(true); setTimeout(() => setOk(false), 1200); }
    catch { window.prompt('Copie o valor:', String(texto)); }
  };
  return (
    <button type="button" className={`nd-copiar${ok ? ' ok' : ''}${grande ? ' grande' : ''}`} onClick={copiar} aria-label={`Copiar ${rotulo || texto}`} title={`Copiar ${rotulo || ''}`.trim()}>
      {ok ? '✓ copiado' : (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>{grande && ' copiar'}</>
      )}
    </button>
  );
}

/** Linha "campo do Protheus → o que digitar". */
function CampoProtheus({ campo, dica, valor, copiar, fixo, children }) {
  return (
    <div className="nd-cp">
      <div className="nd-cp-campo">{campo}{dica && <span>{dica}</span>}</div>
      <div className={`nd-cp-valor${fixo ? ' fixo' : ''}`}>
        {children ?? <span className="nd-cp-txt">{valor}</span>}
        {copiar !== false && <Copiar texto={copiar ?? valor} rotulo={campo} grande/>}
      </div>
    </div>
  );
}

function Passo({ n, titulo, estado, resumo, children, aberto, onAlternar }) {
  // estado: 'feito' | 'atual' | 'depois'
  return (
    <section className={`nd-p ${estado}`}>
      <button type="button" className="nd-p-cab" onClick={onAlternar} disabled={!onAlternar} aria-expanded={aberto}>
        <span className="nd-p-n">{estado === 'feito' ? '✓' : n}</span>
        <span className="nd-p-tit">{titulo}</span>
        {resumo && <span className="nd-p-res">{resumo}</span>}
        {onAlternar && <span className="nd-p-seta" aria-hidden="true">{aberto ? '▾' : '▸'}</span>}
      </button>
      {aberto && <div className="nd-p-corpo">{children}</div>}
    </section>
  );
}

export default function ModalLote({ loteId, user, onClose, onChanged }) {
  const leitura = somenteLeitura(user);
  const [lote, setLote] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [obs, setObs] = useState('');
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(hojeISO());
  const [editando, setEditando] = useState(null);   // 'pedido' | 'nf_debito'
  const [abertos, setAbertos] = useState({});        // passos já feitos que a pessoa reabriu
  const [usuarios, setUsuarios] = useState(null);    // para passar a NF de débito para outra pessoa
  const [tutorial, setTutorial] = useState(null);    // passo do tutorial aberto (índice) ou null

  const carregar = useCallback(async () => {
    try {
      const ls = await dbGetCobrancaLotes();
      const l = ls.find(x => x.id === loteId);
      if (!l) { setErro('NF de débito não encontrada (pode ter sido cancelada).'); setLote(null); return; }
      setLote(l); setNumero(''); setData(hojeISO()); setEditando(null);
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
  const fase = ORDEM[lote.etapa] ?? 0;
  const total = notas.reduce((a, n) => a + (Number(n.valor_lote) || 0), 0);
  const semValor = notas.filter(n => n.valor_lote == null);
  const linhas = notas.flatMap(n => (n.itens_lote || []).map(it => ({ ...it, nota: n })));
  const alertas = [];
  if (notas.length > 3) alertas.push(`Esta NF de débito tem ${notas.length} notas. O normal é juntar até 3.`);
  semValor.forEach(n => alertas.push(`${refNota(n)} voltou ao CD e ainda não tem conferência, então não há itens para cobrar. Tire a nota desta NF ou importe a conferência do CD.`));
  linhas.forEach(it => it.alerta && alertas.push(`${refNota(it.nota)}, produto ${it.codigo || 'sem código'}: ${it.alerta}`));
  const podeMexer = !leitura && fase <= 1;
  const nomeArq = `NF de débito ${lote.nf_debito || 'lote ' + lote.numero} - ${lote.transportador_nome || ''}`;
  const cnpjDig = String(lote.transportador_cnpj || '').replace(/\D/g, '');
  const vePasso = (k, padrao) => abertos[k] ?? padrao;
  const alterna = (k, padrao) => () => setAbertos(a => ({ ...a, [k]: !(a[k] ?? padrao) }));

  const acao = async (tipo, extra = {}, msg) => {
    setSalvando(true); setErro('');
    try { await dbCobrancaLoteAcao(lote.id, tipo, extra); onChanged?.(msg); await carregar(); }
    catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const remover = (n) => {
    if (!window.confirm(`Tirar ${refNota(n)} desta NF de débito? Ela volta para as notas a cobrar.`)) return;
    acao('remover', { ids: [n.id] }, `${refNota(n)} voltou para as notas a cobrar.`);
  };
  const cancelar = () => {
    const txt = fase >= 2
      ? `Cancelar a NF de débito ${lote.nf_debito}? As ${notas.length} notas voltam a ficar pendentes de cobrança.`
      : `Cancelar esta NF de débito? As ${notas.length} notas voltam para as notas a cobrar.`;
    if (window.confirm(txt)) acao('cancelar', {}, 'NF de débito cancelada.').then(() => onClose());
  };
  const voltar = () => {
    const txt = { pedido: `Desfazer o registro do pedido ${lote.pedido}?`, faturado: `Desfazer o registro da NF ${lote.nf_debito}? As notas voltam a ficar como não cobradas.`, enviado: 'Desfazer o registro do envio?' }[lote.etapa];
    if (txt && window.confirm(txt)) acao('voltar', {}, 'Etapa desfeita.');
  };
  const iniciarEdicao = (campo) => { setEditando(campo); setNumero(campo === 'pedido' ? lote.pedido : lote.nf_debito); setData((campo === 'pedido' ? lote.dt_pedido : lote.dt_nf_debito) || hojeISO()); };
  const salvarEdicao = () => numero.trim() ? acao('editar', { numero: numero.trim(), data, obs: editando }, 'Número corrigido.') : setErro('Informe o número.');

  const formEdicao = () => (
    <div className="nd-form">
      <label>{editando === 'pedido' ? 'Nº do pedido' : 'Nº da NF de débito'}<input className="input" value={numero} onChange={e => setNumero(e.target.value)} autoFocus/></label>
      <label>Data<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
      <button className="btn btn-primary btn-sm" disabled={salvando} onClick={salvarEdicao}>Salvar correção</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
    </div>
  );

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 660 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal nd" role="dialog" aria-label={`NF de débito, lote ${lote.numero}`}>
        {/* ── Topo ── */}
        <div className="nd-topo">
          <div style={{ minWidth: 0 }}>
            <div className="nd-sobre">NF de débito · lote {lote.numero}</div>
            <div className="nd-titulo">
              <span className="ellipsis">{lote.transportador_nome || 'Transportador'}</span>
              <span className="nd-etapa" style={{ color: et.cor, background: et.bg }}>{et.curto}</span>
            </div>
            <div className="nd-resumo">
              <span><em>Filial</em>{FILIAL_NOME[lote.filial] || '—'}</span>
              <span><em>Motivo</em>{lote.motivo || '—'}</span>
              <span><em>Notas</em>{notas.length}</span>
              <span><em>Total a cobrar</em><b>{fmtBRL(total)}</b></span>
              <span><em>Criada por</em>{lote.meu ? 'Você' : (lote.criado_por || '—')}</span>
            </div>
          </div>
          <button className="dd-close nd-fechar" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="nd-corpo">
          {/* ── Notas desta NF ── */}
          <div className="nd-sec-tit">Notas cobradas nesta NF de débito</div>
          <div className="nd-notas">
            {notas.map(n => (
              <div key={n.id} className="nd-nota">
                <div className="nd-nota-topo">
                  <div>
                    <div className="nd-nota-rot">{n.lancamento_manual || !n.nf_numero ? 'Devolução total' : 'NF de devolução (NFD)'}</div>
                    <div className="nd-nota-num">{n.lancamento_manual || !n.nf_numero ? `Venda ${n.nf_venda}` : n.nf_numero}</div>
                  </div>
                  <div className="nd-nota-valor">{n.valor_lote == null ? <span className="nd-tag-aviso">sem conferência</span> : fmtBRL(n.valor_lote)}</div>
                </div>
                <dl className="nd-nota-dados">
                  <div><dt>Cliente</dt><dd className="ellipsis" title={n.nome_emitente}>{n.nome_emitente}</dd></div>
                  {!(n.lancamento_manual || !n.nf_numero) && <div><dt>NF de venda</dt><dd>{n.nf_venda || '—'}</dd></div>}
                  {n.dt_entrega && <div><dt>Entregue em</dt><dd>{fmtDate(n.dt_entrega)}</dd></div>}
                </dl>
                {podeMexer && notas.length > 1 && <button className="nd-nota-tirar" onClick={() => remover(n)}>Tirar desta NF</button>}
              </div>
            ))}
          </div>

          {/* ── Passo a passo ── */}
          <div className="nd-sec-tit nd-sec-tit-linha" style={{ marginTop: 6 }}>
            <span>Passo a passo no Protheus</span>
            <button type="button" className="cob-link" onClick={() => setTutorial(2)}>Ver o tutorial com as telas do Protheus →</button>
          </div>

          <Passo n={1} titulo="Abra um pedido de venda e preencha o cabeçalho" estado={fase >= 1 ? 'feito' : 'atual'}
            resumo={fase >= 1 ? 'Filial, cliente, operação, entrega e mensagem' : null}
            aberto={vePasso('p1', fase < 1)} onAlternar={fase >= 1 ? alterna('p1', false) : null}>
            <div className="nd-cps">
              {FILIAL_PROTHEUS[lote.filial] && <CampoProtheus campo="Filial ao entrar" dica={`${FILIAL_NOME[lote.filial]} · Grupo 01 · Ambiente ${PROTHEUS.ambiente}`} valor={FILIAL_PROTHEUS[lote.filial]} fixo/>}
              <CampoProtheus campo="Cliente" dica="Na lupa, pesquise pelo CNPJ e escolha o transportador" valor={fmtCNPJ(lote.transportador_cnpj)} copiar={cnpjDig}/>
              <CampoProtheus campo="Operacao" dica="Sempre 50" valor={PROTHEUS.operacao} fixo/>
              <CampoProtheus campo="Dt. Entrega" dica={`Hoje + ${PROTHEUS.diasEntrega} dias corridos`} valor={dataEntregaProtheus()}/>
              <CampoProtheus campo="Mens.p/ Nota" dica="Cole aqui o texto. Não use o campo OBSERVACAO" copiar={obs}>
                <textarea className="input nd-cp-obs" rows={2} value={obs} onChange={e => setObs(e.target.value)} readOnly={!podeMexer || fase > 0} aria-label="Mens.p/ Nota"/>
              </CampoProtheus>
            </div>
          </Passo>

          <Passo n={2} titulo="Inclua uma linha para cada produto" estado={fase >= 1 ? 'feito' : 'atual'}
            resumo={`${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'} · ${fmtBRL(total)}`}
            aberto={vePasso('p2', fase < 1)} onAlternar={fase >= 1 ? alterna('p2', false) : null}>
            <div className="nd-fixos">
              <span className="nd-fixos-tit">Em todas as linhas:</span>
              <span className="nd-fixo"><em>Prc lista</em><b>{PROTHEUS.prcLista}</b><small>vem o preço de tabela: apague</small></span>
              <span className="nd-fixo"><em>Tipo de saída</em><b>{PROTHEUS.tipoSaida}</b><small>vem 531: troque</small></span>
              <span className="nd-fixo"><em>Armazém</em><b>{PROTHEUS.armazem}</b><small>confira no fim da linha</small></span>
            </div>
            <div className="nd-tabela-wrap">
              <table className="nd-tabela">
                <thead><tr>
                  <th className="n">Linha</th><th>Produto</th><th className="dir">Quantidade</th><th className="dir">Preço unitário</th>
                  <th className="fixo">Prc lista</th><th className="fixo">Tipo saída</th><th className="fixo">Armazém</th><th className="dir">Total</th><th>Da nota</th>
                </tr></thead>
                <tbody>
                  {linhas.map((it, i) => (
                    <tr key={i} className={it.alerta ? 'alerta' : undefined}>
                      <td className="n">{i + 1}</td>
                      <td>
                        <span className="nd-cel"><b className="mono">{it.codigo || <i>sem código</i>}</b><Copiar texto={it.codigo} rotulo="código do produto"/></span>
                        <div className="nd-linha-sub ellipsis" title={it.descricao}>{it.descricao}</div>
                      </td>
                      <td className="dir"><span className="nd-cel dir"><b>{qtdTxt(it.qtd)}</b><span className="nd-un">{it.unidade}</span><Copiar texto={qtdTxt(it.qtd)} rotulo="quantidade"/></span></td>
                      <td className="dir"><span className="nd-cel dir"><b>{it.valor_unitario == null ? '—' : numProtheus(it.valor_unitario)}</b><Copiar texto={it.valor_unitario == null ? '' : numProtheus(it.valor_unitario)} rotulo="preço unitário"/></span></td>
                      <td className="fixo">{PROTHEUS.prcLista}</td>
                      <td className="fixo">{PROTHEUS.tipoSaida}</td>
                      <td className="fixo">{PROTHEUS.armazem}</td>
                      <td className="dir" style={{ fontWeight: 650, color: 'var(--text)' }}>{it.valor_total == null ? 'a definir' : fmtBRL(it.valor_total)}</td>
                      <td><span className="nd-tag-nota">{it.nota.lancamento_manual || !it.nota.nf_numero ? `Venda ${it.nota.nf_venda}` : `NFD ${it.nota.nf_numero}`}</span></td>
                    </tr>
                  ))}
                  {linhas.length === 0 && <tr><td colSpan={9} style={{ color: 'var(--text-3)', fontStyle: 'italic', padding: 14 }}>Nenhum item para cobrar.</td></tr>}
                </tbody>
                <tfoot><tr><td colSpan={7}>Confira no Protheus: o total do pedido deve dar</td><td className="dir">{fmtBRL(total)}</td><td/></tr></tfoot>
              </table>
            </div>
            {alertas.length > 0 && (
              <div className="nd-alertas">
                <b>Atenção antes de salvar o pedido</b>
                <ul>{alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </Passo>

          <Passo n={3} titulo="Salve e libere o pedido. Anote aqui o número dele" estado={fase >= 1 ? 'feito' : 'atual'}
            resumo={lote.pedido ? `Pedido ${lote.pedido} · ${fmtDate(lote.dt_pedido)}` : null} aberto>
            {fase >= 1 ? (
              editando === 'pedido' ? formEdicao() : (
                <div className="nd-feito">Pedido <b>{lote.pedido}</b> registrado em {fmtDate(lote.dt_pedido)}.
                  {!leitura && <button className="btn btn-ghost btn-xs" onClick={() => iniciarEdicao('pedido')}>corrigir</button>}</div>
              )
            ) : leitura ? <div className="nd-nota-txt">Aguardando o registro do pedido.</div> : (
              <>
                <div className="nd-form">
                  <label>Nº do pedido de venda<input className="input" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: 054321"/></label>
                  <label>Data<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                  <button className="btn btn-primary btn-sm" disabled={salvando || !numero.trim() || semValor.length > 0}
                    onClick={() => acao('pedido', { numero: numero.trim(), data, obs: obs.trim() || null }, `Pedido ${numero.trim()} registrado. Agora é aguardar o financeiro faturar.`)}>
                    {salvando ? 'Salvando…' : 'Registrar pedido'}
                  </button>
                </div>
                {semValor.length > 0 && <div className="nd-nota-txt">Antes, tire a nota sem conferência desta NF (no quadro de notas acima).</div>}
                <div className="nd-nota-txt">Para liberar: <b>Pedidos › Liberação de Pedidos de Venda</b>, pesquise o número, <b>Liberar</b> e <b>Salvar</b>.</div>
              </>
            )}
          </Passo>

          <Passo n={4} titulo="Quando o financeiro faturar, registre o número da NF de débito" estado={fase >= 2 ? 'feito' : fase === 1 ? 'atual' : 'depois'}
            resumo={lote.nf_debito ? `NF ${lote.nf_debito} · ${fmtDate(lote.dt_nf_debito)}` : fase === 1 && lote.dias_etapa > 0 ? `aguardando há ${lote.dias_etapa} ${lote.dias_etapa === 1 ? 'dia' : 'dias'}` : null}
            aberto={fase >= 1}>
            {fase >= 2 ? (
              editando === 'nf_debito' ? formEdicao() : (
                <div className="nd-feito">NF de débito <b>{lote.nf_debito}</b> emitida em {fmtDate(lote.dt_nf_debito)}. As notas ficaram como cobradas.
                  {!leitura && <button className="btn btn-ghost btn-xs" onClick={() => iniciarEdicao('nf_debito')}>corrigir</button>}</div>
              )
            ) : !leitura && (<>
              {fase === 1 && <div className="nd-nota-txt" style={{ marginTop: 0, marginBottom: 8 }}>Em <b>Pedidos de Venda</b>, bolinha branca no pedido = regra de crédito: peça a liberação ao financeiro. Liberado, use <b>Prep.doc.saída</b> para gerar o nº da NF.</div>}
              <div className="nd-form">
                <label>Nº da NF de débito<input className="input" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: 245310"/></label>
                <label>Emissão<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando || !numero.trim()}
                  onClick={() => acao('faturar', { numero: numero.trim(), data }, `NF de débito ${numero.trim()} registrada. As notas ficaram como cobradas.`)}>
                  {salvando ? 'Salvando…' : 'Registrar NF de débito'}
                </button>
              </div>
            </>)}
          </Passo>

          <Passo n={5} titulo="Envie ao transportador a NF de débito com a relação das notas" estado={fase >= 3 ? 'feito' : fase === 2 ? 'atual' : 'depois'}
            resumo={lote.dt_envio ? `Enviada em ${fmtDate(lote.dt_envio)}` : null} aberto={fase >= 2}>
            <div className="nd-nota-txt" style={{ marginTop: 0, marginBottom: 8 }}>Vai mandar várias NFs de débito juntas para o mesmo transportador? Na aba <b>NFs de débito</b>, filtre "NF de débito emitida", marque todas dele e baixe <b>uma relação única</b>.</div>
            <div className="nd-form">
              <button className="btn btn-outline btn-sm" onClick={() => baixarRelacaoLotes([lote], nomeArq).catch(e => alert(e.message))}>Baixar relação só desta NF (Excel)</button>
              {fase === 2 && !leitura && <>
                <label>Enviada em<input className="input" type="date" value={data} onChange={e => setData(e.target.value)}/></label>
                <button className="btn btn-primary btn-sm" disabled={salvando} onClick={() => acao('enviar', { data }, 'Envio ao transportador registrado.')}>Marcar como enviada</button>
              </>}
            </div>
          </Passo>

          {erro && <div className="nd-erro">{erro}</div>}
        </div>

        <div className="modal-footer nd-rodape">
          {!leitura && <button className="btn btn-ghost btn-sm nd-perigo" onClick={cancelar} disabled={salvando}>Cancelar NF de débito</button>}
          {!leitura && fase > 0 && <button className="btn btn-ghost btn-sm" onClick={voltar} disabled={salvando}>Desfazer última etapa</button>}
          {!leitura && fase < 3 && (usuarios ? (
            <select className="cob-filtro" defaultValue="" aria-label="Passar para outra pessoa" disabled={salvando}
              onChange={async e => {
                const u = usuarios.find(x => x.email === e.target.value); if (!u) return;
                if (!window.confirm(`Passar esta NF de débito para ${u.nome}? Ela vai aparecer em "Minhas NFs de débito" de ${u.nome}.`)) { e.target.value = ''; return; }
                setSalvando(true);
                try { await dbCobrancaLoteTransferir(lote.id, u.email); onChanged?.(`NF de débito passada para ${u.nome}.`); await carregar(); setUsuarios(null); }
                catch (er) { setErro(er.message); }
                setSalvando(false);
              }}>
              <option value="">Passar para…</option>
              {usuarios.filter(u => u.ativo && u.role !== 'visualizador' && u.email !== lote.criado_por_email).map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>
          ) : <button className="btn btn-ghost btn-sm" onClick={() => dbGetUsuarios().then(setUsuarios).catch(e => setErro(e.message))}>Passar para outra pessoa</button>)}
          <span style={{ flex: 1 }}/>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
      {tutorial != null && <ModalTutorialNFDebito inicio={tutorial} onClose={() => setTutorial(null)}/>}
    </div>, document.body);
}
