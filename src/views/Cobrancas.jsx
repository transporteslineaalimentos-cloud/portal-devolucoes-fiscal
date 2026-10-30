import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetCobrancas, dbCobrancaAcao } from '../config/supabase';
import { fmtBRL, fmtDate } from '../utils.jsx';
import { somenteLeitura } from '../lib/permissoes.js';
import ModalCobranca from '../components/ModalCobranca.jsx';
import ModalImportRetornoCD from '../components/ModalImportRetornoCD.jsx';
import { baixarEspelhoCobranca, valorACobrar } from '../utils/espelhoCobranca.js';

/* ─────────────────────────────────────────────────────────────
   Cobranças de transportador
   Fila de trabalho: cada nota de responsabilidade do transportador
   já lançada no Protheus cai numa situação que diz o que fazer
   (cobrar a nota inteira, cobrar só o que voltou avariado, conferir
   o retorno, isentar). O valor sugerido vem do banco (get_cobrancas).
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
  cobrado:           { l: 'Cobradas',               curto: 'Cobrado',                cor: '#2F855A', bg: '#E6F4EC', faz: 'Cobrança registrada com NF de débito.' },
  isento:            { l: 'Isentas',                curto: 'Isento',                 cor: '#6B7280', bg: '#F1F2F4', faz: 'Não serão cobradas do transportador.' },
};
const PENDENTES = ['cobrar_integral', 'cobrar_parcial', 'conferir_cd', 'isentar', 'sem_transportador'];
const FILAS = [{ k: 'pendentes', l: 'Todas pendentes' }, ...PENDENTES.map(k => ({ k, l: SIT[k].l })), { k: 'cobrado', l: 'Cobradas' }, { k: 'isento', l: 'Isentas' }, { k: 'todas', l: 'Todas' }];
const ehPendente = (r) => PENDENTES.includes(r.situacao);

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
function ModalCobrar({ notas, onClose, onFeito }) {
  const [nfDebito, setNfDebito] = useState('');
  const [obs, setObs] = useState('');
  const [valores, setValores] = useState(() => Object.fromEntries(notas.map(r => [r.id, r.valor_sugerido != null ? Number(r.valor_sugerido).toFixed(2) : ''])));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const transps = new Set(notas.map(chaveTransp));
  const total = notas.reduce((a, r) => a + (Number(String(valores[r.id]).replace(',', '.')) || 0), 0);
  const semValor = notas.filter(r => valores[r.id] === '' || valores[r.id] == null).length;

  const confirmar = async () => {
    if (!nfDebito.trim()) { setErro('Informe o número da NF de débito.'); return; }
    setSalvando(true); setErro('');
    try {
      const v = {};
      notas.forEach(r => { const n = Number(String(valores[r.id]).replace(',', '.')); if (valores[r.id] !== '' && Number.isFinite(n)) v[r.id] = n; });
      await dbCobrancaAcao(notas.map(r => r.id), 'cobrar', { nf_debito: nfDebito.trim(), obs: obs.trim() || null, valores: v });
      onFeito(`${plural(notas.length, 'nota cobrada', 'notas cobradas')} na NF de débito ${nfDebito.trim()}.`);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 650 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <div className="modal" role="dialog" aria-label="Registrar cobrança" style={{ maxWidth: 720, width: '100%' }}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar cobrança</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{plural(notas.length, 'nota', 'notas')} · uma NF de débito para todas</div>
        </div>
        <div className="modal-body">
          {transps.size > 1 && (
            <div className="cob-aviso">
              <Ic d={I.info} size={14} color="#B45309"/>
              As notas selecionadas são de {transps.size} transportadores diferentes. Normalmente cada transportador recebe a sua NF de débito.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="input-label" htmlFor="cob-nfd">NF de débito *</label>
              <input id="cob-nfd" className="input" value={nfDebito} onChange={e => setNfDebito(e.target.value)} placeholder="Ex.: 12345" autoFocus/>
            </div>
            <div>
              <label className="input-label" htmlFor="cob-obs">Observação</label>
              <input id="cob-obs" className="input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional"/>
            </div>
          </div>
          <div className="cob-mini-tabela">
            <table>
              <thead><tr><th>NF Dev.</th><th>Cliente</th><th>Situação</th><th style={{ textAlign: 'right' }}>Valor da nota</th><th style={{ textAlign: 'right', width: 150 }}>Valor a cobrar</th></tr></thead>
              <tbody>
                {notas.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.lancamento_manual ? `NF venda ${r.nf_venda || '—'}` : r.nf_numero}</td>
                    <td className="ellipsis" style={{ maxWidth: 200 }} title={r.nome_emitente}>{r.nome_emitente}</td>
                    <td><ChipSituacao s={r.situacao}/></td>
                    <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmtBRL(r.valor)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input className="input" inputMode="decimal" aria-label={`Valor a cobrar da NF ${r.nf_numero}`}
                        value={valores[r.id]} onChange={e => setValores(v => ({ ...v, [r.id]: e.target.value }))}
                        style={{ textAlign: 'right', padding: '4px 8px', fontSize: 12 }} placeholder="Informe"/>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>Total a cobrar</td><td style={{ textAlign: 'right' }}>{fmtBRL(total)}</td></tr></tfoot>
            </table>
          </div>
          {semValor > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>{plural(semValor, 'nota está', 'notas estão')} sem valor (retorno sem conferência). Informe o valor ou deixe em branco.</div>}
          {erro && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{erro}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={confirmar} disabled={salvando}>
            {salvando ? 'Salvando…' : `Confirmar cobrança · ${fmtBRL(total)}`}
          </button>
        </div>
      </div>
    </div>, document.body);
}

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
function BarraAcoes({ sel, onCobrar, onIsentar, onReabrir, onEspelho, onLimpar, leitura }) {
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
  const pend = sel.filter(ehPendente), fech = sel.filter(r => !ehPendente(r));
  const aCobrar = pend.reduce((a, r) => a + (Number(r.valor_sugerido) || 0), 0);
  return createPortal(
    <div className="cob-barra" style={{ left: pos.left, right: pos.right }} role="region" aria-label="Ações nas notas selecionadas">
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <strong style={{ fontSize: 13 }}>{plural(sel.length, 'nota selecionada', 'notas selecionadas')}</strong>
        <span style={{ fontSize: 11.5, opacity: 0.75 }}>{pend.length ? `${fmtBRL(aCobrar)} a cobrar` : 'já cobradas ou isentas'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
        {!leitura && pend.length > 0 && <button className="btn btn-sm cob-btn-claro" onClick={() => onCobrar(pend)}>Registrar cobrança{fech.length ? ` (${pend.length})` : ''}</button>}
        {!leitura && pend.length > 0 && <button className="btn btn-sm cob-btn-escuro" onClick={() => onIsentar(pend)}>Isentar{fech.length ? ` (${pend.length})` : ''}</button>}
        {!leitura && fech.length > 0 && <button className="btn btn-sm cob-btn-escuro" onClick={() => onReabrir(fech)}>Reabrir{pend.length ? ` (${fech.length})` : ''}</button>}
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
  { k: 'dias',   t: 'Lançada há',     s: r => r._dias ?? -1 },
  { k: 'cd',     t: 'Retorno ao CD',  s: r => (r.retornou_cd ? 1 : 0) + (r.conferido ? 1 : 0) },
  { k: 'valor',  t: 'Valor da nota',  s: r => Number(r.valor) || 0, right: true },
  { k: 'cobrar', t: 'A cobrar',       s: r => valorACobrar(r), right: true },
  { k: 'sit',    t: 'Situação',       s: r => r.situacao },
];

export default function Cobrancas({ user, initialFilters = {}, onChanged }) {
  const leitura = somenteLeitura(user);
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState('');
  const [fila, setFila] = useState('pendentes');
  const [transp, setTransp] = useState(null);
  const [busca, setBusca] = useState('');
  const [ord, setOrd] = useState({ k: 'dias', dir: -1 });
  const [selIds, setSelIds] = useState(() => new Set());
  const [acao, setAcao] = useState(null);      // { tipo: 'cobrar'|'isentar', notas }
  const [detalhe, setDetalhe] = useState(null);
  const [importCD, setImportCD] = useState(false);
  const [aviso, setAviso] = useState('');
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const d = await dbGetCobrancas();
      setRows(d.map(r => ({ ...r, _dias: diasDesde(r.dt_lancamento_protheus) })));
    } catch (e) { setErro(e.message); setRows(r => r || []); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

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

  const todas = useMemo(() => rows || [], [rows]);
  const naFila = (r, f = fila) => f === 'todas' || (f === 'pendentes' ? ehPendente(r) : r.situacao === f);

  /* Números do topo (sempre sobre tudo, sem filtro) */
  const resumo = useMemo(() => {
    const z = () => ({ q: 0, v: 0, nf: 0 });
    const o = { pend: z(), velhas: z(), cobrado: z(), isento: z() };
    const por = Object.fromEntries(Object.keys(SIT).map(k => [k, z()]));
    todas.forEach(r => {
      const p = por[r.situacao]; if (p) { p.q++; p.v += valorACobrar(r); p.nf += Number(r.valor) || 0; }
      if (ehPendente(r)) {
        o.pend.q++; o.pend.v += Number(r.valor_sugerido) || 0;
        if ((r._dias ?? 0) > 60) { o.velhas.q++; o.velhas.v += Number(r.valor_sugerido) || 0; }
      }
      if (r.situacao === 'cobrado') { o.cobrado.q++; o.cobrado.v += valorACobrar(r); }
      if (r.situacao === 'isento') { o.isento.q++; o.isento.v += Number(r.valor) || 0; }
    });
    const maisVelha = Math.max(0, ...todas.filter(ehPendente).map(r => r._dias || 0));
    return { ...o, por, maisVelha };
  }, [todas]);

  /* Transportadores (na fila atual) */
  const transportadores = useMemo(() => {
    const m = new Map();
    todas.filter(r => naFila(r)).forEach(r => {
      const k = chaveTransp(r);
      const g = m.get(k) || { k, nomes: {}, q: 0, v: 0, velha: 0 };
      const n = r.transportador_cobranca || 'Sem transportador';
      g.nomes[n] = (g.nomes[n] || 0) + 1; g.q++; g.v += valorACobrar(r); g.velha = Math.max(g.velha, r._dias || 0);
      m.set(k, g);
    });
    return [...m.values()].map(g => ({ ...g, nome: Object.entries(g.nomes).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0] }))
      .sort((a, b) => b.v - a.v || b.q - a.q);
  }, [todas, fila]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxT = Math.max(1, ...transportadores.map(t => t.v));

  /* Lista */
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let r = todas.filter(x => naFila(x) && (!transp || chaveTransp(x) === transp));
    if (q) r = r.filter(x => [x.nf_numero, x.nf_venda, x.nome_emitente, x.cnpj_emitente, x.transportador_cobranca, x.motivo_devolucao, x.nf_debito, x.uf_emitente]
      .some(v => String(v ?? '').toLowerCase().includes(q)));
    const col = COLS.find(c => c.k === ord.k) || COLS[4];
    return [...r].sort((a, b) => { const va = col.s(a), vb = col.s(b); return (va > vb ? 1 : va < vb ? -1 : 0) * ord.dir; });
  }, [todas, fila, transp, busca, ord]); // eslint-disable-line react-hooks/exhaustive-deps

  const totVis = visiveis.reduce((a, r) => ({ v: a.v + (Number(r.valor) || 0), c: a.c + valorACobrar(r) }), { v: 0, c: 0 });
  const sel = todas.filter(r => selIds.has(r.id));
  const todasMarcadas = visiveis.length > 0 && visiveis.every(r => selIds.has(r.id));
  const alternar = (id) => setSelIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const marcarTodas = () => setSelIds(s => { const n = new Set(s); if (todasMarcadas) visiveis.forEach(r => n.delete(r.id)); else visiveis.forEach(r => n.add(r.id)); return n; });

  const mudarFila = (f) => { setFila(f); setTransp(null); setSelIds(new Set()); };
  const depoisDeAcao = (msg) => { setAcao(null); setSelIds(new Set()); setAviso(msg); carregar(); onChanged?.(); };

  const reabrir = async (notas) => {
    if (!window.confirm(`Reabrir ${plural(notas.length, 'nota', 'notas')}? A NF de débito e o valor cobrado serão apagados e as notas voltam para pendentes.`)) return;
    try { await dbCobrancaAcao(notas.map(r => r.id), 'reabrir'); depoisDeAcao(`${plural(notas.length, 'nota reaberta', 'notas reabertas')}.`); }
    catch (e) { alert(e.message); }
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

  return (
    <div className="cob" style={{ paddingBottom: sel.length ? 84 : 0 }}>
      {/* ── Números ── */}
      <div className="cob-kpis">
        <Kpi rotulo="A cobrar" cor="#C2413B" valor={fmtK(resumo.pend.v)} onClick={() => mudarFila('pendentes')}
          nota={`${plural(resumo.pend.q, 'nota pendente', 'notas pendentes')} · valor sugerido`}/>
        <Kpi rotulo="Pendentes há mais de 60 dias" cor="#B45309" valor={plural(resumo.velhas.q, 'nota', 'notas')}
          nota={resumo.pend.q ? `${fmtK(resumo.velhas.v)} · a mais antiga tem ${resumo.maisVelha} dias` : 'nada pendente'}
          onClick={resumo.velhas.q ? () => { mudarFila('pendentes'); setOrd({ k: 'dias', dir: -1 }); } : undefined}/>
        <Kpi rotulo="Cobrado" cor="#2F855A" valor={fmtK(resumo.cobrado.v)} onClick={() => mudarFila('cobrado')}
          nota={`${plural(resumo.cobrado.q, 'nota', 'notas')} com NF de débito`}/>
        <Kpi rotulo="Isento" cor="#6B7280" valor={plural(resumo.isento.q, 'nota', 'notas')} onClick={() => mudarFila('isento')}
          nota={`${fmtK(resumo.isento.v)} em notas não cobradas`}/>
      </div>

      {/* ── Filas ── */}
      <div className="cob-filas" role="tablist" aria-label="Situação da cobrança">
        {FILAS.map(f => {
          const n = f.k === 'pendentes' ? resumo.pend.q : f.k === 'todas' ? todas.length : resumo.por[f.k]?.q || 0;
          const cor = SIT[f.k]?.cor;
          return (
            <button key={f.k} role="tab" aria-selected={fila === f.k} className={`cob-fila${fila === f.k ? ' ativa' : ''}`} onClick={() => mudarFila(f.k)}
              style={fila === f.k && cor ? { boxShadow: `inset 0 -2px 0 ${cor}` } : undefined}>
              {cor && <span className="cob-dot" style={{ background: cor }}/>}
              {f.l}<span className="cob-fila-n">{n}</span>
            </button>
          );
        })}
      </div>
      {fila === 'pendentes' && (
        <div className="cob-guia" style={{ borderLeftColor: 'var(--text)' }}>
          <strong style={{ color: 'var(--text)' }}>Como funciona:</strong> notas da área TRANSPORTE já lançadas no Protheus entram aqui. Cada uma cai numa fila conforme o retorno ao CD, com o valor a cobrar já sugerido. Marque as notas de um transportador e registre a cobrança com uma única NF de débito.
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
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar NF, cliente, transportador, motivo, NF de débito…" aria-label="Buscar"/>
              {busca && <button onClick={() => setBusca('')} aria-label="Limpar busca"><Ic d={I.x} size={12}/></button>}
            </div>
            <div className="cob-toolbar-info">
              {rows ? <>{plural(visiveis.length, 'nota', 'notas')}{nomeTransp ? ` de ${nomeTransp}` : ''} · <b>{fmtBRL(totVis.c)}</b> {fila === 'cobrado' ? 'cobrado' : fila === 'isento' ? '' : 'a cobrar'}</> : 'Carregando…'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-outline btn-sm" onClick={() => espelho(visiveis)} disabled={!visiveis.length || gerando} title="Excel com o resumo por transportador, as notas e os itens a cobrar">
                <Ic d={I.baixar} size={13}/>{gerando ? 'Gerando…' : 'Espelho de cobrança'}
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
                  <th key={c.k} className={c.right ? 'dir' : undefined} aria-sort={ord.k === c.k ? (ord.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button onClick={() => setOrd(o => ({ k: c.k, dir: o.k === c.k ? -o.dir : (['valor', 'cobrar', 'dias'].includes(c.k) ? -1 : 1) }))}>
                      {c.t}{ord.k === c.k ? (ord.dir > 0 ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {rows === null && <tr><td colSpan={cols.length + 1} className="cob-vazio"><Spinner/> Carregando cobranças…</td></tr>}
                {rows && visiveis.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="cob-vazio">
                    {busca || transp ? 'Nenhuma nota com esse filtro.' : fila === 'pendentes' ? 'Nenhuma cobrança pendente. 🎉' : 'Nenhuma nota nesta situação.'}
                  </td></tr>
                )}
                {visiveis.map(r => {
                  const marcado = selIds.has(r.id);
                  const sit = SIT[r.situacao];
                  return (
                    <tr key={r.id} className={marcado ? 'sel' : undefined} onClick={() => setDetalhe(r)} style={{ '--cob-cor': sit?.cor }}>
                      {!leitura && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={marcado} onChange={() => alternar(r.id)} aria-label={`Selecionar NF ${r.nf_numero}`}/></td>}
                      <td>
                        <div className="cob-nf">{r.lancamento_manual ? '—' : r.nf_numero}</div>
                        <div className="cob-sub">{r.nf_venda ? `Venda ${r.nf_venda}` : 'sem NF de venda'}</div>
                      </td>
                      <td style={{ maxWidth: 210 }}>
                        <div className="ellipsis" title={r.nome_emitente} style={{ fontWeight: 500, color: 'var(--text)' }}>{r.nome_emitente || '—'}</div>
                        <div className="cob-sub">{[r.municipio_emitente, r.uf_emitente].filter(Boolean).join(' / ')}</div>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {r.transportador_cobranca
                          ? <div className="ellipsis" title={r.transportador_cobranca}>{r.transportador_cobranca}</div>
                          : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Não identificado</span>}
                        <div className="cob-sub ellipsis" title={r.motivo_devolucao}>{r.motivo_devolucao || 'sem motivo'}</div>
                      </td>
                      <td>
                        <Idade dias={r._dias}/>
                        <div className="cob-sub">{fmtDate(r.dt_lancamento_protheus)}</div>
                      </td>
                      <td style={{ maxWidth: 150 }}><RetornoCD r={r}/></td>
                      <td className="dir" style={{ color: 'var(--text-2)' }}>{fmtBRL(r.valor)}</td>
                      <td className="dir">
                        {r.situacao === 'isento' ? <span style={{ color: 'var(--text-3)' }}>—</span>
                          : r.situacao !== 'cobrado' && r.valor_sugerido == null ? <span style={{ color: '#1E4DB7', fontSize: 11.5 }}>a definir</span>
                          : <>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtBRL(valorACobrar(r))}</div>
                              {r.situacao === 'cobrado' && <div className="cob-sub">NF déb. {r.nf_debito}</div>}
                              {r.situacao === 'cobrar_parcial' && Number(r.valor) > 0 && valorACobrar(r) < Number(r.valor) - 0.005 && <div className="cob-sub">{Math.round(valorACobrar(r) / Number(r.valor) * 100)}% da nota</div>}
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

      {aviso && createPortal(<div className="cob-toast" role="status"><Ic d={I.check} size={14} color="#6EE7A8" sw={2.4}/>{aviso}</div>, document.body)}

      {sel.length > 0 && (
        <BarraAcoes sel={sel} leitura={leitura}
          onCobrar={notas => setAcao({ tipo: 'cobrar', notas })}
          onIsentar={notas => setAcao({ tipo: 'isentar', notas })}
          onReabrir={reabrir}
          onEspelho={lista => espelho(lista, 'selecionadas')}
          onLimpar={() => setSelIds(new Set())}/>
      )}
      {acao?.tipo === 'cobrar' && <ModalCobrar notas={acao.notas} onClose={() => setAcao(null)} onFeito={depoisDeAcao}/>}
      {acao?.tipo === 'isentar' && <ModalIsentar notas={acao.notas} onClose={() => setAcao(null)} onFeito={depoisDeAcao}/>}

      {detalhe && (
        <ModalCobranca row={detalhe} user={user}
          onClose={() => setDetalhe(null)}
          onSaved={(msg) => { setDetalhe(null); if (msg) setAviso(msg); carregar(); onChanged?.(); }}/>
      )}
      {importCD && <ModalImportRetornoCD onClose={() => setImportCD(false)} onDone={() => carregar()}/>}
    </div>
  );
}

function ehPendenteFila(f) { return f === 'pendentes' || PENDENTES.includes(f); }
