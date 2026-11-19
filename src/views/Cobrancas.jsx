import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetCobrancas, dbCobrancaAcao, dbGetCobrancaLotes, dbCobrancaLoteCriar, dbCobrancaLoteAcao, dbGetMeusCanais, dbSalvarMeusCanais } from '../config/supabase';
import { fmtBRL, fmtDate } from '../utils.jsx';
import { somenteLeitura } from '../lib/permissoes.js';
import ModalCobranca from '../components/ModalCobranca.jsx';
import ModalImportRetornoCD from '../components/ModalImportRetornoCD.jsx';
import { baixarEspelhoCobranca, valorACobrar } from '../utils/espelhoCobranca.js';
import ModalLote from '../components/ModalLote.jsx';
import ModalTutorialNFDebito from '../components/ModalTutorialNFDebito.jsx';
import { ETAPA, ETAPAS, FILIAL_NOME, baixarRelacaoLotes, refNota } from '../utils/notaDebito.js';

/* ─────────────────────────────────────────────────────────────
   Cobranças de transportador
   Fila de trabalho: cada nota de responsabilidade do transportador
   já lançada no Protheus cai numa situação que diz o que fazer
   (cobrar a nota inteira, cobrar só o que voltou avariado, conferir
   o retorno, isentar). O valor sugerido vem do banco (get_cobrancas).
   As notas cobradas juntas formam uma NF de débito (lote): pedido de
   venda no Protheus → faturamento pelo financeiro → envio ao transportador.
───────────────────────────────────────────────────────────── */

const Ic = ({ d, size = 14, color = 'currentColor', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d}/>
  </svg>
);
const I = {
  busca: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  baixar: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  importar: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  atualizar: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  caminhao: 'M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
};

const fmtK = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (Math.abs(n) >= 1e4) return 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil';
  return fmtBRL(n);
};
const plural = (n, s, p) => `${n.toLocaleString('pt-BR')} ${n === 1 ? s : p}`;
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diasDesde = (s) => s ? Math.max(0, Math.round((hoje() - new Date(String(s).slice(0, 10) + 'T00:00:00')) / 86400000)) : null;

/* Situações (filas). A ordem é a ordem das abas. */
const SIT = {
  cobrar_integral:   { l: 'Cobrar valor da nota',   curto: 'Não voltou ao CD',       cor: '#C2413B', bg: '#FDECEA',
                       faz: 'O produto não voltou ao CD. Cobre o valor da nota do transportador.' },
  cobrar_parcial:    { l: 'Cobrar itens avariados', curto: 'Voltou com avaria/falta', cor: '#B45309', bg: '#FEF3E2',
                       faz: 'Voltou ao CD, mas com itens avariados, em falta ou impróprios. Cobre só esses itens (o valor já vem calculado pela conferência do CD).' },
  conferir_cd:       { l: 'Conferir retorno',       curto: 'Voltou sem conferência', cor: '#1E4DB7', bg: '#E8EEFB',
                       faz: 'Consta que voltou ao CD, mas a conferência dos itens não foi importada. Importe a planilha do CD para saber o que cobrar.' },
  isentar:           { l: 'Isentar',                curto: 'Voltou em bom estado',   cor: '#2F855A', bg: '#E6F4EC',
                       faz: 'Tudo voltou ao CD em bom estado. Não há o que cobrar: isente.' },
  sem_transportador: { l: 'Sem transportador',      curto: 'Sem transportador',      cor: '#6B7280', bg: '#F1F2F4',
                       faz: 'Não foi possível identificar o transportador pela NF de venda. Vincule o transportador na nota (aba Devoluções).' },
  em_lote:           { l: 'Em NF de débito',        curto: 'Em NF de débito',        cor: '#6D4FC2', bg: '#F0EBFB',
                       faz: 'Já estão numa NF de débito que ainda não foi faturada. Abra a NF de débito (aba NFs de débito) para registrar o pedido ou o faturamento.' },
  cobrado:           { l: 'Cobradas',               curto: 'Cobrado',                cor: '#2F855A', bg: '#E6F4EC', faz: 'Cobrança registrada com NF de débito.' },
  isento:            { l: 'Isentas',                curto: 'Isento',                 cor: '#6B7280', bg: '#F1F2F4', faz: 'Não serão cobradas do transportador.' },
};
const PENDENTES = ['cobrar_integral', 'cobrar_parcial', 'conferir_cd', 'isentar', 'sem_transportador'];
const CURTO_FILA = { pendentes: 'Pendentes', cobrar_integral: 'Valor da nota', cobrar_parcial: 'Itens avariados', conferir_cd: 'Conferir CD', sem_transportador: 'Sem transp.', em_lote: 'Em NF débito' };
const FILAS = [{ k: 'pendentes', l: 'Todas pendentes' }, ...PENDENTES.map(k => ({ k, l: SIT[k].l })), { k: 'em_lote', l: 'Em NF de débito' }, { k: 'cobrado', l: 'Cobradas' }, { k: 'isento', l: 'Isentas' }, { k: 'todas', l: 'Todas' }]
  .map(f => ({ ...f, c: CURTO_FILA[f.k] || f.l }));
const ehPendente = (r) => PENDENTES.includes(r.situacao);
const aCobrarAinda = (r) => ehPendente(r) || r.situacao === 'em_lote';

const MOTIVOS_ISENCAO = [
  'Produto voltou ao CD em bom estado',
  'Acordo com o transportador',
  'Responsabilidade não é do transportador',
  'Valor irrelevante para cobrança',
];

/* Transportadores agrupados pela raiz do CNPJ (o mesmo transportador aparece com nomes diferentes) */
const chaveTransp = (r) => {
  const c = String(r.transportador_cnpj_cobranca || '').replace(/\D/g, '');
  return c.length === 14 ? c.slice(0, 8) : (r.transportador_cobranca || '—').toUpperCase();
};

/* ─── Peças visuais ─────────────────────────────────────────── */
function Kpi({ rotulo, valor, nota, cor, onClick }) {
  return (
    <button type="button" className="cob-kpi" onClick={onClick} disabled={!onClick}>
      <span className="cob-kpi-rot"><span style={{ background: cor }}/>{rotulo}</span>
      <span className="cob-kpi-val">{valor}</span>
      <span className="cob-kpi-nota">{nota}</span>
    </button>
  );
}

function ChipSituacao({ s }) {
  const c = SIT[s]; if (!c) return null;
  return <span className="cob-chip" style={{ color: c.cor, background: c.bg }}><span style={{ background: c.cor }}/>{c.curto}</span>;
}

function Idade({ dias }) {
  if (dias == null) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const [cor, bg] = dias > 60 ? ['#A8261B', '#FDE4E2'] : dias > 30 ? ['#7A4E00', '#FFF0CC'] : ['var(--text-2)', 'var(--surface-3)'];
  return <span className="cob-idade" style={{ color: cor, background: bg }}>{dias === 0 ? 'hoje' : `${dias} d`}</span>;
}

function RetornoCD({ r }) {
  if (!r.retornou_cd) return <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Não voltou</span>;
  if (!r.conferido) return <span style={{ fontSize: 11.5, color: '#1E4DB7', fontWeight: 600 }}>Voltou · sem conferência</span>;
  const soma = {};
  (r.itens_cd || []).forEach(i => { const d = String(i.destino || '').toUpperCase(); soma[d] = (soma[d] || 0) + (Number(i.qtd) || 0); });
  const ordem = ['AVARIA', 'FALTA', 'IMPROPRIO', 'BOM'];
  const cores = { AVARIA: '#C2413B', FALTA: '#B45309', IMPROPRIO: '#6D4FC2', BOM: '#2F855A' };
  const nomes = { AVARIA: 'avaria', FALTA: 'falta', IMPROPRIO: 'impróprio', BOM: 'bom' };
  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
      {ordem.filter(d => soma[d]).map(d => (
        <span key={d} style={{ color: cores[d], fontWeight: d === 'BOM' ? 500 : 650, whiteSpace: 'nowrap' }}>{soma[d]} {nomes[d]}</span>
      ))}
    </span>
  );
}

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" className="cob-spin" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── Modais de ação em lote ───────────────────────────────── */
function ModalIsentar({ notas, onClose, onFeito }) {
  const [obs, setObs] = useState(notas.every(r => r.situacao === 'isentar') ? MOTIVOS_ISENCAO[0] : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const confirmar = async () => {
    if (!obs.trim()) { setErro('Informe o motivo da isenção.'); return; }
    setSalvando(true); setErro('');
    try {
      await dbCobrancaAcao(notas.map(r => r.id), 'isentar', { obs: obs.trim() });
      onFeito(`${plural(notas.length, 'nota isenta', 'notas isentas')} de cobrança.`);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 650 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal" role="dialog" aria-label="Isentar cobrança" style={{ maxWidth: 520, width: '100%' }}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Isentar de cobrança</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{plural(notas.length, 'nota', 'notas')} · {fmtBRL(notas.reduce((a, r) => a + (Number(r.valor) || 0), 0))} em notas</div>
        </div>
        <div className="modal-body">
          <label className="input-label">Motivo da isenção *</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {MOTIVOS_ISENCAO.map(m => (
              <button key={m} type="button" className={`btn btn-xs ${obs === m ? 'btn-primary' : 'btn-outline'}`} onClick={() => setObs(m)}>{m}</button>
            ))}
          </div>
          <textarea className="input" rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ou escreva o motivo"/>
          {erro && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar isenção'}</button>
        </div>
      </div>
    </div>, document.body);
}

/* ─── Barra de ações (presa no rodapé) ─────────────────────── */
function BarraAcoes({ sel, onMontar, onIsentar, onReabrir, onEspelho, onLimpar, leitura }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const medir = () => {
      const r = document.querySelector('.app-content')?.getBoundingClientRect();
      setPos(r ? { left: r.left + 16, right: window.innerWidth - r.right + 16 } : { left: 16, right: 16 });
    };
    medir(); window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  if (!pos) return null;
  const pend = sel.filter(ehPendente), fech = sel.filter(r => !ehPendente(r) && r.situacao !== 'em_lote');
  const aCobrar = pend.reduce((a, r) => a + (Number(r.valor_sugerido) || 0), 0);
  return createPortal(
    <div className="cob-barra" style={{ left: pos.left, right: pos.right }} role="region" aria-label="Ações nas notas selecionadas">
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <strong style={{ fontSize: 13 }}>{plural(sel.length, 'nota selecionada', 'notas selecionadas')}</strong>
        <span style={{ fontSize: 11.5, opacity: 0.75 }}>{pend.length ? `${fmtBRL(aCobrar)} a cobrar` : 'já cobradas ou isentas'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
        {!leitura && pend.length > 0 && <button className="btn btn-sm cob-btn-claro" onClick={() => onMontar(pend)}>Montar NF de débito{fech.length ? ` (${pend.length})` : ''}</button>}
        {!leitura && pend.length > 0 && <button className="btn btn-sm cob-btn-escuro" onClick={() => onIsentar(pend)}>Isentar{fech.length ? ` (${pend.length})` : ''}</button>}
        {!leitura && fech.filter(r => !r.lote_id).length > 0 && <button className="btn btn-sm cob-btn-escuro" onClick={() => onReabrir(fech.filter(r => !r.lote_id))}>Reabrir{pend.length ? ` (${fech.filter(r => !r.lote_id).length})` : ''}</button>}
        <button className="btn btn-sm cob-btn-escuro" onClick={() => onEspelho(sel)}><Ic d={I.baixar} size={13}/> Espelho (Excel)</button>
        <button className="btn btn-sm cob-btn-escuro" onClick={onLimpar} aria-label="Limpar seleção"><Ic d={I.x} size={13}/></button>
      </div>
    </div>, document.body);
}

/* ─── Tela ─────────────────────────────────────────────────── */
const COLS = [
  { k: 'nf',     t: 'NF Dev.',        s: r => Number(r.nf_numero) || 0 },
  { k: 'cli',    t: 'Cliente',        s: r => r.nome_emitente || '' },
  { k: 'transp', t: 'Transportador · motivo', s: r => r.transportador_cobranca || '' },
  { k: 'ent',    t: 'Entregue em',    s: r => r.dt_entrega || '', cls: 'cob-col-ent' },
  { k: 'dias',   t: 'Lançada há',     s: r => r._dias ?? -1 },
  { k: 'cd',     t: 'Retorno ao CD',  cls: 'cob-col-cd',  s: r => (r.retornou_cd ? 1 : 0) + (r.conferido ? 1 : 0) },
  { k: 'valor',  t: 'Valor produtos', s: r => Number(r.valor_produtos) || 0, right: true, cls: 'cob-col-valor' },
  { k: 'cobrar', t: 'A cobrar',       s: r => valorACobrar(r), right: true },
  { k: 'sit',    t: 'Situação',       s: r => r.situacao },
];

/* ─── Canais (centro de custo da NF de venda) ──────────────── */
function FiltroCanais({ canais, sel, salvos, onMudar, onSalvar, salvando }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (!e.target.closest?.('.cob-canais')) setAberto(false); };
    document.addEventListener('mousedown', fechar); return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);
  const igual = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const ehMeus = salvos.length > 0 && igual(sel, salvos);
  const rotulo = sel.length === 0 ? 'Todos os canais' : sel.length <= 2 ? sel.join(', ') : `${sel.length} canais`;
  const alternar = (c) => onMudar(sel.includes(c) ? sel.filter(x => x !== c) : [...sel, c]);
  return (
    <div className="cob-canais">
      <button type="button" className={`cob-canais-btn${sel.length ? ' on' : ''}`} onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
        <span className="cob-canais-rot">{ehMeus ? 'Meus canais' : 'Canais'}</span>
        <b>{rotulo}</b><span aria-hidden="true">▾</span>
      </button>
      {aberto && (
        <div className="cob-canais-pop" role="dialog" aria-label="Escolher canais">
          <div className="cob-canais-tit">Canal (centro de custo da NF de venda)</div>
          <div className="cob-canais-lista">
            {canais.map(c => (
              <label key={c.canal} className={sel.includes(c.canal) ? 'on' : ''}>
                <input type="checkbox" checked={sel.includes(c.canal)} onChange={() => alternar(c.canal)}/>
                <span>{c.canal}</span><small>{c.pend} pend.</small>
              </label>
            ))}
          </div>
          <div className="cob-canais-acoes">
            <button className="btn btn-ghost btn-xs" onClick={() => onMudar([])}>Ver todos</button>
            {salvos.length > 0 && !ehMeus && <button className="btn btn-ghost btn-xs" onClick={() => onMudar(salvos)}>Voltar aos meus canais</button>}
            <button className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }} disabled={salvando || igual(sel, salvos)}
              onClick={() => onSalvar(sel)} title="O portal passa a abrir sempre com estes canais">
              {salvando ? 'Salvando…' : sel.length ? 'Salvar como meus canais' : 'Abrir sempre com todos'}
            </button>
          </div>
          <div className="cob-canais-dica">{salvos.length ? `Seus canais salvos: ${salvos.join(', ')}.` : 'Escolha os seus canais e salve: a aba Cobranças passa a abrir sempre com eles.'}</div>
        </div>
      )}
    </div>
  );
}

export default function Cobrancas({ user, initialFilters = {}, onChanged }) {
  const leitura = somenteLeitura(user);
  const [rows, setRows] = useState(null);
  const [lotes, setLotes] = useState(null);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState('notas');   // 'notas' | 'nfs'
  const [fila, setFila] = useState('pendentes');
  const [transp, setTransp] = useState(null);
  const [busca, setBusca] = useState('');
  const [fMotivo, setFMotivo] = useState('');
  const [fFilial, setFFilial] = useState('');
  const [ord, setOrd] = useState({ k: 'dias', dir: -1 });
  const [selIds, setSelIds] = useState(() => new Set());
  const [acao, setAcao] = useState(null);      // { tipo: 'isentar', notas }
  const [detalhe, setDetalhe] = useState(null);
  const [loteAberto, setLoteAberto] = useState(null);
  const [importCD, setImportCD] = useState(false);
  const [aviso, setAviso] = useState('');
  const [gerando, setGerando] = useState(false);
  const [montando, setMontando] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [fCanais, setFCanais] = useState([]);       // [] = todos
  const [canaisSalvos, setCanaisSalvos] = useState([]);
  const [salvandoCanais, setSalvandoCanais] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const [d, l] = await Promise.all([dbGetCobrancas(), dbGetCobrancaLotes()]);
      setRows(d.map(r => ({ ...r, _dias: diasDesde(r.dt_lancamento_protheus) })));
      setLotes(l);
    } catch (e) { setErro(e.message); setRows(r => r || []); setLotes(l => l || []); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  // abre com os canais salvos da analista
  useEffect(() => {
    dbGetMeusCanais().then(c => { setCanaisSalvos(c); setFCanais(c); }).catch(() => {});
  }, []);
  const salvarCanais = async (c) => {
    setSalvandoCanais(true);
    try { await dbSalvarMeusCanais(c); setCanaisSalvos(c); setAviso(c.length ? 'Canais salvos: a aba vai abrir sempre com eles.' : 'Pronto: a aba vai abrir sempre com todos os canais.'); }
    catch (e) { alert(e.message); }
    setSalvandoCanais(false);
  };

  // atalhos vindos de outras telas (ex.: painel de pendências)
  const initKey = JSON.stringify(initialFilters);
  useEffect(() => {
    const st = initialFilters.status_cobranca;
    if (st === 'pendente_cobranca_transportador') setFila('pendentes');
    else if (st === 'cobrado') setFila('cobrado');
    else if (st === 'isento') setFila('isento');
    if (initialFilters.transportador) setBusca(initialFilters.transportador === '__sem_transportador__' ? '' : initialFilters.transportador);
    if (initialFilters.transportador === '__sem_transportador__') setFila('sem_transportador');
  }, [initKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);

  const todasSemFiltro = useMemo(() => rows || [], [rows]);
  const lotesFiltrados = useMemo(() => !fCanais.length ? (lotes || []) : (lotes || []).filter(l => (l.notas || []).some(n => fCanais.includes(n.canal || 'Sem canal'))), [lotes, fCanais]);
  const canaisDisp = useMemo(() => {
    const m = new Map();
    todasSemFiltro.forEach(r => { const k = r.canal || 'Sem canal'; const g = m.get(k) || { canal: k, pend: 0 }; if (ehPendente(r)) g.pend++; m.set(k, g); });
    return [...m.values()].sort((a, b) => b.pend - a.pend || a.canal.localeCompare(b.canal));
  }, [todasSemFiltro]);
  const todas = useMemo(() => fCanais.length ? todasSemFiltro.filter(r => fCanais.includes(r.canal || 'Sem canal')) : todasSemFiltro, [todasSemFiltro, fCanais]);
  const naFila = (r, f = fila) => f === 'todas' || (f === 'pendentes' ? ehPendente(r) : r.situacao === f);
  const motivos = useMemo(() => [...new Set(todas.map(r => r.motivo_devolucao).filter(Boolean))].sort(), [todas]);

  /* Números do topo (sempre sobre tudo, sem filtro) */
  const resumo = useMemo(() => {
    const z = () => ({ q: 0, v: 0, nf: 0 });
    const o = { pend: z(), velhas: z(), cobrado: z(), isento: z(), aguard: z() };
    const por = Object.fromEntries(Object.keys(SIT).map(k => [k, z()]));
    todas.forEach(r => {
      const p = por[r.situacao]; if (p) { p.q++; p.v += valorACobrar(r); p.nf += Number(r.valor) || 0; }
      if (aCobrarAinda(r)) {
        o.pend.q++; o.pend.v += Number(r.valor_sugerido) || 0;
        if (ehPendente(r) && (r._dias ?? 0) > 60) { o.velhas.q++; o.velhas.v += Number(r.valor_sugerido) || 0; }
      }
      if (r.situacao === 'cobrado') { o.cobrado.q++; o.cobrado.v += valorACobrar(r); }
      if (r.situacao === 'isento') { o.isento.q++; o.isento.v += Number(r.valor) || 0; }
    });
    let maisVelhaPedido = 0;
    lotesFiltrados.filter(l => l.etapa === 'pedido').forEach(l => { o.aguard.q++; o.aguard.v += Number(l.valor_total) || 0; maisVelhaPedido = Math.max(maisVelhaPedido, l.dias_etapa || 0); });
    const maisVelha = Math.max(0, ...todas.filter(ehPendente).map(r => r._dias || 0));
    return { ...o, por, maisVelha, maisVelhaPedido };
  }, [todas, lotesFiltrados]);

  const filtrada = (x) => (!fMotivo || x.motivo_devolucao === fMotivo) && (!fFilial || x.filial === fFilial);

  /* Transportadores (na fila atual) */
  const transportadores = useMemo(() => {
    const m = new Map();
    todas.filter(r => naFila(r) && filtrada(r)).forEach(r => {
      const k = chaveTransp(r);
      const g = m.get(k) || { k, nomes: {}, q: 0, v: 0, velha: 0 };
      const n = r.transportador_cobranca || 'Sem transportador';
      g.nomes[n] = (g.nomes[n] || 0) + 1; g.q++; g.v += valorACobrar(r); g.velha = Math.max(g.velha, r._dias || 0);
      m.set(k, g);
    });
    return [...m.values()].map(g => ({ ...g, nome: Object.entries(g.nomes).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0] }))
      .sort((a, b) => b.v - a.v || b.q - a.q);
  }, [todas, fila, fMotivo, fFilial]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxT = Math.max(1, ...transportadores.map(t => t.v));

  /* Lista */
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let r = todas.filter(x => naFila(x) && filtrada(x) && (!transp || chaveTransp(x) === transp));
    if (q) r = r.filter(x => [x.nf_numero, x.nf_venda, x.nome_emitente, x.cnpj_emitente, x.transportador_cobranca, x.motivo_devolucao, x.nf_debito, x.lote_pedido, x.uf_emitente]
      .some(v => String(v ?? '').toLowerCase().includes(q)));
    const col = COLS.find(c => c.k === ord.k) || COLS[4];
    return [...r].sort((a, b) => { const va = col.s(a), vb = col.s(b); return (va > vb ? 1 : va < vb ? -1 : 0) * ord.dir; });
  }, [todas, fila, transp, busca, ord, fMotivo, fFilial]); // eslint-disable-line react-hooks/exhaustive-deps

  const totVis = visiveis.reduce((a, r) => ({ v: a.v + (Number(r.valor_produtos) || 0), c: a.c + valorACobrar(r) }), { v: 0, c: 0 });
  const sel = todas.filter(r => selIds.has(r.id));
  const todasMarcadas = visiveis.length > 0 && visiveis.every(r => selIds.has(r.id));
  const alternar = (id) => setSelIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const marcarTodas = () => setSelIds(s => { const n = new Set(s); if (todasMarcadas) visiveis.forEach(r => n.delete(r.id)); else visiveis.forEach(r => n.add(r.id)); return n; });

  const mudarFila = (f) => { setModo('notas'); setFila(f); setTransp(null); setSelIds(new Set()); };
  const depoisDeAcao = (msg) => { setAcao(null); setSelIds(new Set()); if (msg) setAviso(msg); carregar(); onChanged?.(); };

  const reabrir = async (notas) => {
    if (!window.confirm(`Reabrir ${plural(notas.length, 'nota', 'notas')}? A NF de débito e o valor cobrado serão apagados e as notas voltam para pendentes.`)) return;
    try { await dbCobrancaAcao(notas.map(r => r.id), 'reabrir'); depoisDeAcao(`${plural(notas.length, 'nota reaberta', 'notas reabertas')}.`); }
    catch (e) { alert(e.message); }
  };

  /* Montar uma NF de débito com as notas marcadas */
  const montar = async (notas) => {
    if (montando) return;
    const transps = new Set(notas.map(chaveTransp));
    if (transps.size > 1) { alert('As notas marcadas são de transportadores diferentes. Cada NF de débito é de um transportador só: filtre por transportador e marque de novo.'); return; }
    const filiais = new Set(notas.map(r => r.filial || '?'));
    if (filiais.size > 1) { alert('As notas marcadas são de filiais diferentes (Anápolis e Extrema). A NF de débito sai pela filial que vendeu: separe por filial.'); return; }
    if (notas.length > 3 && !window.confirm(`Você marcou ${notas.length} notas. Normalmente vocês juntam até 3 numa NF de débito. Montar com as ${notas.length} mesmo assim?`)) return;
    setMontando(true);
    try {
      let id;
      try { id = await dbCobrancaLoteCriar(notas.map(r => r.id)); }
      catch (e) {
        if (!String(e.message).includes('MOTIVOS_DIFERENTES')) throw e;
        const ms = [...new Set(notas.map(r => r.motivo_devolucao || 'sem motivo'))];
        if (!window.confirm(`As notas têm motivos diferentes (${ms.join(', ')}). O combinado é juntar só notas do mesmo motivo. Juntar mesmo assim?`)) { setMontando(false); return; }
        id = await dbCobrancaLoteCriar(notas.map(r => r.id), true);
      }
      setSelIds(new Set());
      await carregar(); onChanged?.();
      setLoteAberto(id);
    } catch (e) { alert(e.message); }
    setMontando(false);
  };

  const espelho = async (lista, rotulo) => {
    setGerando(true);
    try {
      const nomeT = transp ? transportadores.find(t => t.k === transp)?.nome : null;
      await baixarEspelhoCobranca(lista, {
        nomeArquivo: `Espelho de cobrança - ${rotulo || nomeT || FILAS.find(f => f.k === fila)?.l} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
        subtitulo: [nomeT, FILAS.find(f => f.k === fila)?.l].filter(Boolean).join(' · '),
      });
    } catch (e) { alert('Erro ao gerar o Excel: ' + e.message); }
    setGerando(false);
  };

  const sitAtual = SIT[fila];
  const verSit = fila === 'pendentes' || fila === 'todas';
  const cols = verSit ? COLS : COLS.filter(c => c.k !== 'sit');
  const nomeTransp = transp ? transportadores.find(t => t.k === transp)?.nome : null;
  const nLotesAbertos = lotesFiltrados.filter(l => l.meu && ['montando', 'pedido', 'faturado'].includes(l.etapa)).length;

  return (
    <div className="cob" style={{ paddingBottom: sel.length ? 84 : 0 }}>
      {/* ── Números ── */}
      <div className="cob-kpis">
        <Kpi rotulo="A cobrar" cor="#C2413B" valor={fmtK(resumo.pend.v)} onClick={() => mudarFila('pendentes')}
          nota={`${plural(resumo.pend.q, 'nota', 'notas')} ainda não faturadas · só produtos`}/>
        <Kpi rotulo="Pendentes há mais de 60 dias" cor="#B45309" valor={plural(resumo.velhas.q, 'nota', 'notas')}
          nota={resumo.velhas.q ? `${fmtK(resumo.velhas.v)} · a mais antiga tem ${resumo.maisVelha} dias` : 'nada atrasado'}
          onClick={resumo.velhas.q ? () => { mudarFila('pendentes'); setOrd({ k: 'dias', dir: -1 }); } : undefined}/>
        <Kpi rotulo="Aguardando faturamento" cor={ETAPA.pedido.cor} valor={plural(resumo.aguard.q, 'pedido', 'pedidos')}
          nota={resumo.aguard.q ? `${fmtK(resumo.aguard.v)} · o mais antigo há ${resumo.maisVelhaPedido} dias` : 'nenhum pedido parado no financeiro'}
          onClick={() => setModo('nfs')}/>
        <Kpi rotulo="Cobrado" cor="#2F855A" valor={fmtK(resumo.cobrado.v)} onClick={() => mudarFila('cobrado')}
          nota={`${plural(resumo.cobrado.q, 'nota', 'notas')} com NF de débito`}/>
      </div>

      <div className="cob-linha-modo">
      <div className="cob-modo" role="tablist" aria-label="Ver">
        <button role="tab" aria-selected={modo === 'notas'} className={modo === 'notas' ? 'on' : ''} onClick={() => setModo('notas')}>Notas a cobrar</button>
        <button role="tab" aria-selected={modo === 'nfs'} className={modo === 'nfs' ? 'on' : ''} onClick={() => setModo('nfs')}>
          NFs de débito{nLotesAbertos > 0 && <span className="cob-fila-n">{nLotesAbertos} {nLotesAbertos === 1 ? 'sua em andamento' : 'suas em andamento'}</span>}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm cob-tutorial-btn" onClick={() => setTutorial(true)} title="Passo a passo do portal ao Protheus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 014 4v13a3 3 0 00-3-3H2z"/><path d="M22 4h-6a4 4 0 00-4 4v13a3 3 0 013-3h7z"/></svg>
          Como lançar NF de débito
        </button>
        <FiltroCanais canais={canaisDisp} sel={fCanais} salvos={canaisSalvos} onMudar={(c) => { setFCanais(c); setSelIds(new Set()); setTransp(null); }} onSalvar={salvarCanais} salvando={salvandoCanais}/>
      </div>
      </div>

      {modo === 'nfs' && <ListaLotes key={user?.email} lotes={lotes === null ? null : lotesFiltrados} onAbrir={setLoteAberto} onAviso={setAviso} onRecarregar={() => { carregar(); onChanged?.(); }} leitura={leitura}/>}

      {modo === 'notas' && <>
      {/* ── Filas ── */}
      <div className="cob-filas" role="tablist" aria-label="Situação da cobrança">
        {FILAS.map(f => {
          const n = f.k === 'pendentes' ? todas.filter(ehPendente).length : f.k === 'todas' ? todas.length : resumo.por[f.k]?.q || 0;
          const cor = SIT[f.k]?.cor;
          return (
            <button key={f.k} role="tab" aria-selected={fila === f.k} className={`cob-fila${fila === f.k ? ' ativa' : ''}`} onClick={() => mudarFila(f.k)}
              style={fila === f.k && cor ? { boxShadow: `inset 0 -2px 0 ${cor}` } : undefined}>
              {cor && <span className="cob-dot" style={{ background: cor }}/>}
              <span className="so-largo">{f.l}</span><span className="so-curto">{f.c}</span><span className="cob-fila-n">{n}</span>
            </button>
          );
        })}
      </div>
      {fila === 'pendentes' && (
        <div className="cob-guia cob-como">
          <strong style={{ color: 'var(--text)' }}>Como emitir:</strong>&nbsp;marque até 3 notas do <b>mesmo transportador, filial e motivo</b> e clique em <b>Montar NF de débito</b>. A tela seguinte mostra o que digitar no Protheus.
          <button className="cob-link" onClick={() => setTutorial(true)}>Ver o passo a passo com as telas →</button>
        </div>
      )}
      {sitAtual && (
        <div className="cob-guia" style={{ borderLeftColor: sitAtual.cor }}>
          <strong style={{ color: sitAtual.cor }}>O que fazer:</strong> {sitAtual.faz}
          {fila === 'conferir_cd' && !leitura && <button className="btn btn-outline btn-xs" style={{ marginLeft: 10 }} onClick={() => setImportCD(true)}>Importar conferência do CD</button>}
        </div>
      )}

      <div className="cob-corpo">
        {/* ── Transportadores ── */}
        <aside className="cob-transps" aria-label="Transportadores">
          <div className="cob-transps-tit">
            <span>Transportadores</span>
            {transp && <button className="btn btn-ghost btn-xs" onClick={() => setTransp(null)}>Ver todos</button>}
          </div>
          <div className="cob-transps-lista">
            {rows === null && <div style={{ padding: 16 }}><Spinner/></div>}
            {rows && transportadores.length === 0 && <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text-3)' }}>Nenhuma nota nesta fila.</div>}
            {transportadores.map(t => (
              <button key={t.k} className={`cob-transp${transp === t.k ? ' ativo' : ''}`} onClick={() => { setTransp(transp === t.k ? null : t.k); setSelIds(new Set()); }}>
                <span className="cob-transp-nome" title={t.nome}>{t.nome}</span>
                <span className="cob-transp-num"><b>{fmtK(t.v)}</b> · {plural(t.q, 'nota', 'notas')}</span>
                {ehPendenteFila(fila) && t.velha > 60 ? <span className="cob-transp-velha">mais antiga: {t.velha} d</span> : <span/>}
                <span className="cob-transp-barra"><span style={{ width: `${Math.max(2, (t.v / maxT) * 100)}%` }}/></span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Lista ── */}
        <section className="cob-lista">
          <div className="cob-toolbar">
            <div className="cob-busca">
              <Ic d={I.busca} size={14} color="var(--text-3)"/>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar NF, cliente, transportador, pedido, NF de débito…" aria-label="Buscar"/>
              {busca && <button onClick={() => setBusca('')} aria-label="Limpar busca"><Ic d={I.x} size={12}/></button>}
            </div>
            <select className="cob-filtro cob-transp-sel" value={transp || ''} onChange={e => { setTransp(e.target.value || null); setSelIds(new Set()); }} aria-label="Filtrar por transportador">
              <option value="">Todos os transportadores ({transportadores.length})</option>
              {transportadores.map(t => <option key={t.k} value={t.k}>{t.nome} · {fmtK(t.v)} · {plural(t.q, 'nota', 'notas')}{ehPendenteFila(fila) && t.velha > 60 ? ` · mais antiga ${t.velha} d` : ''}</option>)}
            </select>
            <select className="cob-filtro" value={fMotivo} onChange={e => setFMotivo(e.target.value)} aria-label="Filtrar por motivo">
              <option value="">Todos os motivos</option>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="cob-filtro" value={fFilial} onChange={e => setFFilial(e.target.value)} aria-label="Filtrar por filial">
              <option value="">Anápolis e Extrema</option>
              <option value="Anápolis">Anápolis</option>
              <option value="Extrema">Extrema</option>
            </select>
            <div className="cob-toolbar-info">
              {rows ? <>{plural(visiveis.length, 'nota', 'notas')}{nomeTransp ? ` de ${nomeTransp}` : ''} · <b>{fmtBRL(totVis.c)}</b> {fila === 'cobrado' ? 'cobrado' : fila === 'isento' ? '' : 'a cobrar'}</> : 'Carregando…'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-outline btn-sm" onClick={() => espelho(visiveis)} disabled={!visiveis.length || gerando} title="Excel com o resumo por transportador, as notas e os itens a cobrar">
                <Ic d={I.baixar} size={13}/>{gerando ? 'Gerando…' : <><span className="so-largo">Espelho de cobrança</span><span className="so-curto">Espelho</span></>}
              </button>
              {!leitura && <button className="btn btn-outline btn-sm" onClick={() => setImportCD(true)} title="Importar a planilha de conferência do retorno ao CD">
                <Ic d={I.importar} size={13}/>Importar CD
              </button>}
              <button className="btn btn-outline btn-sm" onClick={carregar} aria-label="Atualizar"><Ic d={I.atualizar} size={13}/></button>
            </div>
          </div>

          {erro && <div className="cob-erro">Não foi possível carregar as cobranças: {erro}</div>}

          <div className="cob-tabela-wrap">
            <table className="cob-tabela">
              <thead><tr>
                {!leitura && <th style={{ width: 36 }}><input type="checkbox" checked={todasMarcadas} onChange={marcarTodas} aria-label="Selecionar todas as notas da lista"/></th>}
                {cols.map(c => (
                  <th key={c.k} className={[c.right && 'dir', c.cls].filter(Boolean).join(' ') || undefined} aria-sort={ord.k === c.k ? (ord.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button onClick={() => setOrd(o => ({ k: c.k, dir: o.k === c.k ? -o.dir : (['valor', 'cobrar', 'dias', 'ent'].includes(c.k) ? -1 : 1) }))}>
                      {c.t}{ord.k === c.k ? (ord.dir > 0 ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {rows === null && <tr><td colSpan={cols.length + 1} className="cob-vazio"><Spinner/> Carregando cobranças…</td></tr>}
                {rows && visiveis.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="cob-vazio">
                    {busca || transp || fMotivo || fFilial ? 'Nenhuma nota com esse filtro.' : fila === 'pendentes' ? 'Nenhuma cobrança pendente. 🎉' : 'Nenhuma nota nesta situação.'}
                  </td></tr>
                )}
                {visiveis.map(r => {
                  const marcado = selIds.has(r.id);
                  const sit = SIT[r.situacao];
                  return (
                    <tr key={r.id} className={marcado ? 'sel' : undefined} onClick={() => setDetalhe(r)} style={{ '--cob-cor': sit?.cor }}>
                      {!leitura && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={marcado} onChange={() => alternar(r.id)} aria-label={`Selecionar NF ${r.nf_numero}`}/></td>}
                      <td>
                        <div className="cob-nf">{r.lancamento_manual ? 'Dev. total' : r.nf_numero}</div>
                        <div className="cob-sub">{r.nf_venda ? `Venda ${r.nf_venda}` : 'sem NF de venda'}</div>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <div className="ellipsis" title={r.nome_emitente} style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nome_emitente || '—'}</div>
                        <div className="cob-sub">
                          {[r.municipio_emitente, r.uf_emitente].filter(Boolean).join(' / ')}
                          {r.filial && <span className="cob-filial" style={r.filial === 'Extrema' ? { background: '#EDE7FB', color: '#5B3FB0' } : { background: 'var(--surface-3)', color: 'var(--text-2)' }}>{r.filial}</span>}
                        </div>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        {r.transportador_cobranca
                          ? <div className="ellipsis" title={r.transportador_cobranca}>{r.transportador_cobranca}</div>
                          : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Não identificado</span>}
                        <div className="cob-sub ellipsis" title={[r.motivo_devolucao, r.canal && `Canal: ${r.canal}`].filter(Boolean).join(' · ')}>{r.motivo_devolucao || 'sem motivo'}{r.canal ? ` · ${r.canal}` : ''}</div>
                      </td>
                      <td className="cob-col-ent" title={r.dt_entrega_fonte ? `Fonte: ${r.dt_entrega_fonte}` : 'Sem registro de entrega da NF de venda'}>
                        {r.dt_entrega ? <span style={{ color: 'var(--text)' }}>{fmtDate(r.dt_entrega)}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        {r.dt_entrega && r.dt_emissao && <div className="cob-sub">NFD {fmtDate(r.dt_emissao)}</div>}
                      </td>
                      <td>
                        <Idade dias={r._dias}/>
                        <div className="cob-sub">{fmtDate(r.dt_lancamento_protheus)}</div>
                      </td>
                      <td className="cob-col-cd" style={{ maxWidth: 150 }}><RetornoCD r={r}/></td>
                      <td className="dir cob-col-valor" style={{ color: 'var(--text-2)' }}>{fmtBRL(r.valor_produtos)}</td>
                      <td className="dir">
                        {r.situacao === 'isento' ? <span style={{ color: 'var(--text-3)' }}>—</span>
                          : r.situacao !== 'cobrado' && r.valor_sugerido == null ? <span style={{ color: '#1E4DB7', fontSize: 11.5 }}>a definir</span>
                          : <>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtBRL(valorACobrar(r))}</div>
                              {r.situacao === 'cobrado' && <div className="cob-sub">NF déb. {r.nf_debito}</div>}
                              {r.situacao === 'em_lote' && <div className="cob-sub">{r.lote_pedido ? `Pedido ${r.lote_pedido}` : `Lote ${r.lote_numero} · sem pedido`}</div>}
                              {r.situacao === 'cobrar_parcial' && Number(r.valor_produtos) > 0 && valorACobrar(r) < Number(r.valor_produtos) - 0.005 && <div className="cob-sub">{Math.round(valorACobrar(r) / Number(r.valor_produtos) * 100)}% da nota</div>}
                            </>}
                      </td>
                      {verSit && <td><ChipSituacao s={r.situacao}/></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </>}

      {aviso && createPortal(<div className="cob-toast" role="status"><Ic d={I.check} size={14} color="#6EE7A8" sw={2.4}/>{aviso}</div>, document.body)}

      {modo === 'notas' && sel.length > 0 && (
        <BarraAcoes sel={sel} leitura={leitura}
          onMontar={montar}
          onIsentar={notas => setAcao({ tipo: 'isentar', notas })}
          onReabrir={reabrir}
          onEspelho={lista => espelho(lista, 'selecionadas')}
          onLimpar={() => setSelIds(new Set())}/>
      )}
      {acao?.tipo === 'isentar' && <ModalIsentar notas={acao.notas} onClose={() => setAcao(null)} onFeito={depoisDeAcao}/>}

      {detalhe && (
        <ModalCobranca row={detalhe} user={user}
          onClose={() => setDetalhe(null)}
          onMontar={(r) => { setDetalhe(null); montar([r]); }}
          onAbrirLote={(id) => { setDetalhe(null); setLoteAberto(id); }}
          onSaved={(msg) => { setDetalhe(null); if (msg) setAviso(msg); carregar(); onChanged?.(); }}/>
      )}
      {loteAberto && (
        <ModalLote loteId={loteAberto} user={user}
          onClose={() => { setLoteAberto(null); carregar(); }}
          onChanged={(msg) => { if (msg) setAviso(msg); onChanged?.(); }}/>
      )}
      {importCD && <ModalImportRetornoCD onClose={() => setImportCD(false)} onDone={() => carregar()}/>}
      {tutorial && <ModalTutorialNFDebito onClose={() => setTutorial(false)}/>}
    </div>
  );
}

function ehPendenteFila(f) { return f === 'pendentes' || PENDENTES.includes(f); }

/* ─── NFs de débito ────────────────────────────────────────── */
const RAPIDOS = [
  { k: 'montando', l: 'Abertas, sem pedido',            d: 'Montadas, falta digitar o pedido no Protheus' },
  { k: 'pedido',   l: 'Com pedido, sem NF de débito',   d: 'Aguardando o financeiro faturar' },
  { k: 'faturado', l: 'NF de débito emitida',           d: 'Falta enviar ao transportador' },
  { k: 'enviado',  l: 'Enviadas ao transportador',      d: 'Processo concluído' },
];

function ListaLotes({ lotes, onAbrir, onAviso, onRecarregar, leitura }) {
  const temMinhas = (lotes || []).some(l => l.meu);
  const [escopo, setQuem] = useState('minhas');    // sempre abre em "Minhas NFs de débito"
  const [etapa, setEtapa] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const base = useMemo(() => (lotes || []).filter(l => escopo === 'todas' || l.meu), [lotes, escopo]);
  const naEtapa = (l, k) => k === 'todas' || (k === 'abertas' ? ['montando', 'pedido', 'faturado'].includes(l.etapa) : l.etapa === k);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return base.filter(l => naEtapa(l, etapa)
      && (!q || [l.transportador_nome, l.pedido, l.nf_debito, l.motivo, l.numero, l.criado_por, ...(l.notas || []).flatMap(n => [n.nf_numero, n.nf_venda, n.nome_emitente])]
        .some(v => String(v ?? '').toLowerCase().includes(q))));
  }, [base, etapa, busca]);
  const conta = (k) => base.filter(l => naEtapa(l, k)).length;
  const marcados = (lotes || []).filter(l => sel.has(l.id));
  const [dtEnvio, setDtEnvio] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);
  const relacao = async () => {
    const ts = [...new Set(marcados.map(l => l.transportador_nome))];
    const nome = `Relação NFs de débito - ${ts.length === 1 ? ts[0] + ' - ' : ''}${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
    try { await baixarRelacaoLotes(marcados, nome); onAviso(`Relação única gerada com ${plural(marcados.length, 'NF de débito', 'NFs de débito')}.`); }
    catch (e) { alert(e.message); }
  };
  const aEnviar = marcados.filter(l => l.etapa === 'faturado');
  const aFaturar = marcados.filter(l => l.etapa === 'pedido');
  const [registrando, setRegistrando] = useState(false);
  const marcarEnviadas = async () => {
    if (!aEnviar.length) return;
    if (!window.confirm(`Marcar ${plural(aEnviar.length, 'NF de débito', 'NFs de débito')} como enviada${aEnviar.length > 1 ? 's' : ''} ao transportador em ${dtEnvio.split('-').reverse().join('/')}?`)) return;
    setEnviando(true);
    let ok = 0; const erros = [];
    for (const l of aEnviar) {
      try { await dbCobrancaLoteAcao(l.id, 'enviar', { data: dtEnvio }); ok++; }
      catch (e) { erros.push(`NF ${l.nf_debito}: ${e.message}`); }
    }
    setEnviando(false); setSel(new Set());
    onAviso(`${plural(ok, 'NF de débito marcada', 'NFs de débito marcadas')} como enviada${ok > 1 ? 's' : ''}.${erros.length ? ' Falhou: ' + erros.join('; ') : ''}`);
    onRecarregar?.();
  };
  const selecionarTransp = (nome) => setSel(new Set(lista.filter(l => l.transportador_nome === nome).map(l => l.id)));
  const mudar = (k) => { setEtapa(etapa === k ? 'abertas' : k); setSel(new Set()); };
  return (
    <>
      <div className="ld-topo">
        <div className="cob-modo" role="tablist" aria-label="De quem">
          <button role="tab" aria-selected={escopo === 'minhas'} className={escopo === 'minhas' ? 'on' : ''} onClick={() => setQuem('minhas')}>Minhas NFs de débito</button>
          <button role="tab" aria-selected={escopo === 'todas'} className={escopo === 'todas' ? 'on' : ''} onClick={() => setQuem('todas')}>De todos</button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {escopo === 'minhas' ? 'Só as que você criou. Os outros também conseguem ver o andamento delas.' : 'Todas as NFs de débito, de qualquer pessoa.'}
        </span>
      </div>
      <div className="ld-rapidos">
        {RAPIDOS.map(r => {
          const e = ETAPA[r.k];
          return (
            <button key={r.k} className={`ld-rapido${etapa === r.k ? ' on' : ''}`} style={{ '--c': e.cor }} onClick={() => mudar(r.k)} aria-pressed={etapa === r.k}>
              <span className="ld-rapido-rot"><i/>{r.l}</span>
              <span className="ld-rapido-n">{conta(r.k)}</span>
              <span className="ld-rapido-d">{r.d}</span>
            </button>
          );
        })}
      </div>
      {etapa === 'pedido' && lista.length > 0 && !leitura && (
        <div className="cob-guia" style={{ borderLeftColor: ETAPA.pedido.cor }}>
          <span><strong style={{ color: ETAPA.pedido.cor }}>O financeiro faturou vários?</strong> Marque as NFs de débito e clique em <b>Registrar NFs de débito</b> na barra de baixo para digitar todos os números de uma vez.</span>
        </div>
      )}
      {etapa === 'faturado' && lista.length > 0 && (
        <div className="cob-guia" style={{ borderLeftColor: ETAPA.faturado.cor }}>
          <span><strong style={{ color: ETAPA.faturado.cor }}>Para enviar ao transportador:</strong> marque as NFs de débito dele (ou use os atalhos abaixo), baixe <b>uma relação única em Excel</b> com todas e depois marque todas como enviadas.</span>
          <div className="ld-atalhos">
            {[...new Set(lista.map(l => l.transportador_nome))].map(t => (
              <button key={t} className="btn btn-outline btn-xs" onClick={() => selecionarTransp(t)}>
                Marcar todas de {t} ({lista.filter(l => l.transportador_nome === t).length})
              </button>
            ))}
          </div>
        </div>
      )}
      <section className="cob-lista">
        <div className="cob-toolbar">
          <div className="cob-busca">
            <Ic d={I.busca} size={14} color="var(--text-3)"/>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar transportador, pedido, NF de débito, NFD, cliente, quem criou…" aria-label="Buscar NF de débito"/>
          </div>
          <div className="cob-toolbar-info">
            {etapa === 'abertas' ? 'Em andamento' : etapa === 'todas' ? 'Todas' : RAPIDOS.find(r => r.k === etapa)?.l} · {plural(lista.length, 'NF de débito', 'NFs de débito')}
            {' · '}<b>{fmtBRL(lista.reduce((a, l) => a + (Number(l.valor_total) || (l.notas || []).reduce((s, n) => s + (Number(n.valor_sugerido) || 0), 0)), 0))}</b>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className={`btn btn-sm ${etapa === 'todas' ? 'btn-primary' : 'btn-outline'}`} onClick={() => mudar('todas')}>Ver todas as etapas</button>

          </div>
        </div>
        <div className="cob-tabela-wrap">
          <table className="cob-tabela">
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" aria-label="Marcar todas" checked={lista.length > 0 && lista.every(l => sel.has(l.id))}
                onChange={() => setSel(s => lista.every(l => s.has(l.id)) ? new Set() : new Set(lista.map(l => l.id)))}/></th>
              {['Lote', 'Transportador', 'Notas', 'Valor', 'Etapa', 'Pedido', 'NF de débito', 'Na etapa há', 'Criada por'].map((t, i) => <th key={t} className={i === 3 ? 'dir' : undefined}><button>{t}</button></th>)}
            </tr></thead>
            <tbody>
              {lotes === null && <tr><td colSpan={10} className="cob-vazio"><Spinner/> Carregando…</td></tr>}
              {lotes && lista.length === 0 && <tr><td colSpan={10} className="cob-vazio">
                {escopo === 'minhas' && !temMinhas ? 'Você ainda não criou nenhuma NF de débito. Monte uma em "Notas a cobrar".' : 'Nenhuma NF de débito neste filtro.'}
              </td></tr>}
              {lista.map(l => {
                const e = ETAPA[l.etapa] || ETAPAS[0];
                const valor = l.valor_total != null ? Number(l.valor_total) : (l.notas || []).reduce((s, n) => s + (Number(n.valor_sugerido) || 0), 0);
                return (
                  <tr key={l.id} onClick={() => onAbrir(l.id)} style={{ '--cob-cor': e.cor }} className={sel.has(l.id) ? 'sel' : undefined}>
                    <td onClick={ev => ev.stopPropagation()}><input type="checkbox" checked={sel.has(l.id)} aria-label={`Marcar lote ${l.numero}`}
                      onChange={() => setSel(s => { const n = new Set(s); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })}/></td>
                    <td><div className="cob-nf">{l.numero}</div><div className="cob-sub">{FILIAL_NOME[l.filial] || '—'}</div></td>
                    <td style={{ maxWidth: 170 }}><div className="ellipsis" style={{ fontWeight: 500, color: 'var(--text)' }} title={l.transportador_nome}>{l.transportador_nome}</div>
                      <div className="cob-sub ellipsis" title={l.motivo}>{l.motivo}</div></td>
                    <td style={{ maxWidth: 190 }}>
                      <div className="ellipsis" title={(l.notas || []).map(refNota).join(', ')}>{(l.notas || []).map(n => n.lancamento_manual ? `Venda ${n.nf_venda}` : `NFD ${n.nf_numero}`).join(', ')}</div>
                      <div className="cob-sub ellipsis">{[...new Set((l.notas || []).map(n => n.nome_emitente))].join(', ')}</div>
                    </td>
                    <td className="dir" style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtBRL(valor)}</td>
                    <td><span className="cob-chip" style={{ color: e.cor, background: e.bg }}><span style={{ background: e.cor }}/>{e.curto}</span></td>
                    <td>{l.pedido || <span style={{ color: 'var(--text-3)' }}>—</span>}{l.dt_pedido && <div className="cob-sub">{fmtDate(l.dt_pedido)}</div>}</td>
                    <td>{l.nf_debito ? <b style={{ color: 'var(--text)' }}>{l.nf_debito}</b> : <span style={{ color: 'var(--text-3)' }}>—</span>}{l.dt_nf_debito && <div className="cob-sub">{fmtDate(l.dt_nf_debito)}</div>}</td>
                    <td>{l.etapa === 'enviado' ? <span style={{ color: 'var(--text-3)' }}>—</span> : <Idade dias={l.dias_etapa}/>}</td>
                    <td><span className={`ld-dono${l.meu ? ' meu' : ''}`}>{l.meu ? 'Você' : (l.criado_por || '—')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {marcados.length > 0 && createPortal(
        <div className="cob-barra ld-barra" role="region" aria-label="Ações nas NFs de débito marcadas">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 13 }}>{plural(marcados.length, 'NF de débito marcada', 'NFs de débito marcadas')}</strong>
            <span style={{ fontSize: 11.5, opacity: 0.75 }}>
              {fmtBRL(marcados.reduce((a, l) => a + (Number(l.valor_total) || 0), 0))} · {[...new Set(marcados.map(l => l.transportador_nome))].join(', ')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            {!leitura && aFaturar.length > 0 && <button className="btn btn-sm cob-btn-claro" onClick={() => setRegistrando(true)}>Registrar NFs de débito ({aFaturar.length})</button>}
            <button className="btn btn-sm cob-btn-claro" onClick={relacao}><Ic d={I.baixar} size={13}/> Baixar relação única (Excel)</button>
            {!leitura && aEnviar.length > 0 && <>
              <input type="date" className="input ld-data" value={dtEnvio} onChange={e => setDtEnvio(e.target.value)} aria-label="Data do envio"/>
              <button className="btn btn-sm cob-btn-escuro" disabled={enviando} onClick={marcarEnviadas}>
                {enviando ? 'Marcando…' : `Marcar ${aEnviar.length === marcados.length ? 'todas' : aEnviar.length} como enviadas`}
              </button>
            </>}
            <button className="btn btn-sm cob-btn-escuro" onClick={() => setSel(new Set())} aria-label="Limpar seleção"><Ic d={I.x} size={13}/></button>
          </div>
        </div>, document.body)}
      {registrando && <ModalRegistrarNFs lotes={aFaturar} onClose={() => setRegistrando(false)}
        onFeito={(msg) => { setRegistrando(false); setSel(new Set()); onAviso(msg); onRecarregar?.(); }}/>}
    </>
  );
}

/* Registrar de uma vez o nº da NF de débito de vários pedidos que o financeiro já faturou. */
function ModalRegistrarNFs({ lotes, onClose, onFeito }) {
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [nums, setNums] = useState({});
  const [data, setData] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const preenchidos = lotes.filter(l => String(nums[l.id] || '').trim());
  const salvar = async () => {
    if (!preenchidos.length) { setErro('Digite o número de pelo menos uma NF de débito.'); return; }
    setSalvando(true); setErro('');
    let ok = 0; const falhas = [];
    for (const l of preenchidos) {
      try { await dbCobrancaLoteAcao(l.id, 'faturar', { numero: String(nums[l.id]).trim(), data }); ok++; }
      catch (e) { falhas.push(`pedido ${l.pedido}: ${e.message}`); }
    }
    setSalvando(false);
    if (falhas.length && !ok) { setErro('Não foi possível registrar: ' + falhas.join('; ')); return; }
    onFeito(`${plural(ok, 'NF de débito registrada', 'NFs de débito registradas')}. As notas ficaram como cobradas.${falhas.length ? ' Falhou: ' + falhas.join('; ') : ''}`);
  };
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 680 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal" role="dialog" aria-label="Registrar NFs de débito" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar NFs de débito</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>Digite o nº da NF que o Protheus gerou para cada pedido. Os que ficarem em branco continuam aguardando.</div>
        </div>
        <div className="modal-body">
          <div className="cob-mini-tabela" style={{ maxHeight: '52vh' }}>
            <table>
              <thead><tr><th>Pedido</th><th>Transportador</th><th style={{ textAlign: 'right' }}>Valor</th><th>Nº da NF de débito</th></tr></thead>
              <tbody>{lotes.map((l, i) => (
                <tr key={l.id}>
                  <td><b>{l.pedido}</b><div className="cob-sub">lote {l.numero}</div></td>
                  <td style={{ maxWidth: 220 }}><div className="ellipsis" title={l.transportador_nome}>{l.transportador_nome}</div></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtBRL(l.valor_total)}</td>
                  <td><input className="input" style={{ width: 140, padding: '5px 8px' }} value={nums[l.id] || ''} autoFocus={i === 0} inputMode="numeric"
                    onChange={e => setNums(n => ({ ...n, [l.id]: e.target.value }))} placeholder="Ex.: 245310" aria-label={`NF de débito do pedido ${l.pedido}`}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, color: 'var(--text-2)' }}>
            Emissão das NFs<input type="date" className="input" style={{ width: 160, padding: '5px 8px' }} value={data} onChange={e => setData(e.target.value)}/>
          </label>
          {erro && <div className="nd-erro" style={{ marginTop: 10 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando || !preenchidos.length}>
            {salvando ? 'Registrando…' : `Registrar ${preenchidos.length || ''} ${preenchidos.length === 1 ? 'NF' : 'NFs'}`}
          </button>
        </div>
      </div>
    </div>, document.body);
}
