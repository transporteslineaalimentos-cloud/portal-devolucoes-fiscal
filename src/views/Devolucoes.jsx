import { useCallback, useEffect, useRef, useState } from 'react';
import { dbListDevolucoes, dbExportDevolucoes, dbGetTransportadoras, dbGetDevolucoesResumo } from '../config/supabase';
import { fmtBRL, fmtDate, CNPJ_MAP, Badge, calcFarolProtheus, calcStatusOperacional } from '../utils.jsx';
import DetalheDrawer from '../components/DetalheDrawer.jsx';
import ModalLancamentoManual from '../components/ModalLancamentoManual.jsx';
import ModalImportProtheus from '../components/ModalImportProtheus.jsx';
import RetornoCDTrabalho from '../components/RetornoCDTrabalho.jsx';
import BarraSelecao from '../components/BarraSelecao.jsx';
import { exportDevolucoesToExcel } from '../utils/exportExcel.js';
import { baixarPlanilhaConsulta } from '../utils/planilhaConsulta.js';

const Ic = ({ d, size = 14, color = 'currentColor', w = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);
const ICONES = {
  busca:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  filtro:   'M4 6h16M7 12h10M10 18h4',
  recarregar:'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
  mais:     'M12 5v14M5 12h14',
  baixar:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  subir:    'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  planilha: 'M9 17v-6h13M9 7h13M3 7h.01M3 12h.01M3 17h.01',
  x:        'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  alerta:   'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  relogio:  'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  seta:     'M6 9l6 6 6-6',
  vazio:    'M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1',
};

/* Colunas: NF · Cliente e motivo · NF Venda · Emissão e prazo · Valor · Situação */
const COLS = '150px minmax(250px, 1.5fr) minmax(118px, 0.45fr) minmax(162px, 0.6fr) 132px minmax(192px, 0.65fr)';
const COLS_SEL = '30px ' + COLS;

/* Mesma paleta de status do Painel Gerencial, do drill-down e da planilha de consulta */
const STATUS_OP_CFG = {
  'LANÇADA':                             { bg: '#DDF3E4', fg: '#17663A', l: 'Lançada' },
  'LANÇADA SEM FÍSICO':                  { bg: '#DDF1EF', fg: '#1F6F6A', l: 'Lançada sem físico' },
  'TROCA DE NOTA':                       { bg: '#E3ECFB', fg: '#1E4DB7', l: 'Troca de nota' },
  'ENVIAR PARA LANÇAMENTO':              { bg: '#FFF0CC', fg: '#7A4E00', l: 'Enviar p/ lançamento' },
  'ENVIAR PARA LANÇAMENTO - SEM FÍSICO': { bg: '#FFF7E0', fg: '#7A4E00', l: 'Enviar sem físico' },
  'AGENDAR REVERSA':                     { bg: '#FDE4E2', fg: '#A8261B', l: 'Agendar reversa' },
  'REVERSA AGENDADA':                    { bg: '#ECE7FA', fg: '#5B3FA8', l: 'Reversa agendada' },
  'RECUSADA SEFAZ':                      { bg: '#ECEDEF', fg: '#3F4650', l: 'Recusada SEFAZ' },
};
const URGENCIA = { vermelho: '#DC2626', amarelo: '#D97706' };

const CNPJ_OPTIONS = [
  { v: '',               l: 'Todas' },
  { v: '05207076000297', l: 'MIX' },
  { v: '05207076000459', l: 'CHOCOLATE' },
];
const CENTROS = ['CANAL INDIRETO','CASH & CARRY','FARMA KEY ACCOUNT','KEY ACCOUNT','CANAL DIRETO','NOVOS NEGÓCIOS','ECOMMERCE','CANAL VERDE','EIC'];

const EMPTY_FILTERS = {
  search: '', status: '', cnpj_dest: '', cnpj_emitente: '', uf: '', linha_produto: '',
  dt_inicio: '', dt_fim: '', mes: '', area: '', motivo: '',
  devolucao_total: '', com_motivo: '', flag_emissao: '', lancado: '', nf_venda: '',
  centro_custo: '', transportador: '', retornou_cd: '', farol: '',
};

const titulo = (s) => !s ? '' : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/* ─── Campo rotulado ───────────────────────────────────── */
function Campo({ label, children, largura }) {
  return (
    <div className="dv-campo" style={largura ? { width: largura } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  );
}
const Opcoes = ({ itens }) => itens.map(([v, l]) => <option key={v} value={v}>{l}</option>);

/* ─── Menu de ações secundárias ────────────────────────── */
function MenuAcoes({ onImportar, onExcel, onConsulta, exportando, gerando }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [open]);
  const item = (icone, texto, acao, ocupado) => (
    <button type="button" disabled={ocupado} onClick={() => { setOpen(false); acao(); }}>
      <Ic d={icone} size={14} color="var(--text-3)"/>{ocupado || texto}
    </button>
  );
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-outline btn-sm" aria-expanded={open}
        onClick={() => setOpen(v => !v)}>
        Ações <Ic d={ICONES.seta} size={12}/>
      </button>
      {open && (
        <div className="dv-menu" role="menu">
          {item(ICONES.baixar,   'Exportar Excel',       onExcel,    exportando && 'Exportando…')}
          {item(ICONES.planilha, 'Planilha de consulta', onConsulta, gerando && 'Gerando…')}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }}/>
          {item(ICONES.subir,    'Importar Protheus',    onImportar)}
        </div>
      )}
    </div>
  );
}

/* ─── Seletor de transportadoras ───────────────────────── */
const CaixaSel = ({ marcada }) => (
  <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0,
    border: `1.5px solid ${marcada ? 'var(--blue)' : 'var(--border-2)'}`,
    background: marcada ? 'var(--blue)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {marcada && <Ic d={ICONES.check} size={9} color="#fff" w={3.5}/>}
  </span>
);

function TranspMultiSelect({ transportadoras, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);
  const sel = value === '__sem__' ? ['__sem__'] : value ? value.split('|').filter(Boolean) : [];

  useEffect(() => {
    if (!open) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [open]);

  const alterna = (nome) => {
    if (nome === '__sem__') { onChange(sel.includes('__sem__') ? '' : '__sem__'); return; }
    const prox = sel.includes(nome) ? sel.filter(s => s !== nome && s !== '__sem__')
                                    : [...sel.filter(s => s !== '__sem__'), nome];
    onChange(prox.join('|'));
  };
  const limpar = () => { onChange(''); setBusca(''); };
  const lista = transportadoras.filter(t => !busca ||
    t.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (t.nome_curto || '').toLowerCase().includes(busca.toLowerCase()));

  const rotulo = sel.length === 0 ? 'Todas'
    : sel[0] === '__sem__' ? 'Sem transportador'
    : sel.length === 1 ? (transportadoras.find(t => t.nome === sel[0])?.nome_curto || sel[0])
    : `${sel.length} selecionadas`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} className="input" aria-expanded={open}
        style={{ width: 186, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, cursor: 'pointer', fontSize: 12.5, textAlign: 'left',
          background: sel.length ? 'var(--blue-dim)' : undefined,
          borderColor: sel.length ? 'var(--blue-mid)' : undefined,
          color: sel.length ? 'var(--blue)' : undefined, fontWeight: sel.length ? 600 : 400 }}>
        <span className="ellipsis">{rotulo}</span>
        {sel.length > 0
          ? <span role="button" tabIndex={0} aria-label="Limpar transportadoras"
              onClick={e => { e.stopPropagation(); limpar(); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); limpar(); } }}
              style={{ display: 'flex', flexShrink: 0 }}><Ic d={ICONES.x} size={11}/></span>
          : <Ic d={ICONES.seta} size={11} color="var(--text-3)"/>}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow-md)', width: 290 }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar transportadora" className="input" style={{ width: '100%', height: 30, fontSize: 12 }}/>
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto', padding: 4 }}>
            <button type="button" onClick={() => alterna('__sem__')}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px',
                border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                background: sel.includes('__sem__') ? 'var(--blue-dim)' : 'transparent' }}>
              <CaixaSel marcada={sel.includes('__sem__')}/>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sem transportador</span>
            </button>
            {lista.length === 0 && (
              <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-3)' }}>Nenhuma encontrada</div>
            )}
            {lista.map(t => {
              const marcada = sel.includes(t.nome);
              return (
                <button key={t.cnpj} type="button" onClick={() => alterna(t.nome)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px',
                    border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    background: marcada ? 'var(--blue-dim)' : 'transparent' }}>
                  <CaixaSel marcada={marcada}/>
                  <span className="ellipsis" style={{ fontSize: 12, color: 'var(--text)', fontWeight: marcada ? 600 : 400 }}>
                    {t.nome_curto || t.nome}
                  </span>
                </button>
              );
            })}
          </div>
          {sel.length > 0 && (
            <div style={{ padding: '7px 10px', borderTop: '1px solid var(--border)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sel.length} selecionada{sel.length > 1 ? 's' : ''}</span>
              <button type="button" onClick={limpar}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>
                Limpar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Alertas da linha ─────────────────────────────────── */
function Alertas({ row }) {
  const itens = [];
  if (row.flag_emissao_entrega === 'divergente')
    itens.push({ d: ICONES.alerta, cor: 'var(--yellow)', t: 'Data de emissão divergente da entrega' });
  if (row.flag_emissao_entrega === 'aguardando_entrega')
    itens.push({ d: ICONES.relogio, cor: 'var(--text-3)', t: 'Aguardando entrega' });
  if (!itens.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
      {itens.map((a, i) => (
        <span key={i} title={a.t} style={{ display: 'flex', cursor: 'help' }}>
          <Ic d={a.d} size={13} color={a.cor} w={2}/>
        </span>
      ))}
    </span>
  );
}

/* ═══ Tela ═════════════════════════════════════════════ */
export default function Devolucoes({ user, initialFilters = {} }) {
  const [modo, setModo] = useState('lista');        // lista | cd
  const [selMode, setSelMode] = useState(false);
  const [marcadas, setMarcadas] = useState(() => new Set());
  const marcar = (id) => setMarcadas(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcarTodas = (lista) => setMarcadas(s => {
    const todas = lista.every(r => s.has(r.id));
    const n = new Set(s);
    lista.forEach(r => (todas ? n.delete(r.id) : n.add(r.id)));
    return n;
  });
  const { _ts, ...initFilt } = initialFilters;
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [selectedId, setSelected]   = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [gerandoConsulta, setGerandoConsulta] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...initFilt });
  const [searchInput, setSearchInput] = useState(initFilt.search || '');
  const [transportadoras, setTransportadoras] = useState([]);
  const [resumoRaw, setResumoRaw] = useState(null);
  const searchRef = useRef(null);
  const PAGE_SIZE = 40;

  useEffect(() => { dbGetTransportadoras().then(setTransportadoras).catch(() => {}); }, []);

  const initKey = JSON.stringify(initialFilters);
  useEffect(() => {
    if (Object.keys(initFilt).length) {
      setFilters({ ...EMPTY_FILTERS, ...initFilt });
      setSearchInput(initFilt.search || '');
      setPage(0);
      setShowFilters(true);
    }
  }, [initKey]); // eslint-disable-line

  const load = useCallback(async (f, p) => {
    setLoading(true); setError('');
    try {
      const r = await dbListDevolucoes({ page: p, filters: f });
      setRows(r.rows); setTotal(r.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page]); // eslint-disable-line

  // Resumo do conjunto filtrado — independe da página
  const filtrosKey = JSON.stringify(filters);
  useEffect(() => {
    let vivo = true;
    const chave = filtrosKey;
    const t = setTimeout(() => {
      dbGetDevolucoesResumo({ filters })
        .then(r => { if (vivo) setResumoRaw({ chave, dados: r }); })
        .catch(() => { if (vivo) setResumoRaw({ chave, dados: { erro: true } }); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [filtrosKey]); // eslint-disable-line
  const resumo = resumoRaw && resumoRaw.chave === filtrosKey ? resumoRaw.dados : null;

  // Setas navegam entre notas com o detalhe aberto
  useEffect(() => {
    if (!selectedId) return;
    const h = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const i = rows.findIndex(r => r.id === selectedId);
      if (i === -1) return;
      const prox = e.key === 'ArrowDown' ? rows[i + 1] : rows[i - 1];
      if (prox) setSelected(prox.id);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedId, rows]);

  const applyFilter = patch => { setFilters(f => ({ ...f, ...patch })); setPage(0); };
  const handleSearch = val => {
    setSearchInput(val);
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => applyFilter({ search: val }), 400);
  };
  const clearFilters = () => { setFilters({ ...EMPTY_FILTERS }); setSearchInput(''); setPage(0); };

  const filtrosAtivos = Object.entries(filters).filter(([k, v]) => v && k !== 'search').length;
  const hasFilters = filtrosAtivos > 0 || !!filters.search;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const todas = await dbExportDevolucoes({ filters });
      exportDevolucoesToExcel(todas, { filename: hasFilters ? 'devolucoes_fiscais_filtrado' : 'devolucoes_fiscais' });
    } catch (e) { alert('Erro ao exportar: ' + e.message); }
    finally { setExporting(false); }
  };
  const handleConsulta = async () => {
    setGerandoConsulta(true);
    try {
      const todas = await dbExportDevolucoes({ filters });
      await baixarPlanilhaConsulta(todas, { periodoTxt: hasFilters ? 'filtrado' : '' });
    } catch (e) { alert('Erro ao gerar a planilha: ' + e.message); }
    finally { setGerandoConsulta(false); }
  };

  /* Chips de filtro ativo */
  const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const dataCurta = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  const chips = [];
  if (filters.mes)  { const [y, m] = filters.mes.split('-'); chips.push({ k: 'mes', label: `Mês: ${MES_NOMES[+m - 1]}/${y.slice(2)}` }); }
  if (filters.area)          chips.push({ k: 'area',   label: `Área: ${titulo(filters.area)}` });
  if (filters.motivo)        chips.push({ k: 'motivo', label: `Motivo: ${titulo(filters.motivo)}` });
  if (filters.uf)            chips.push({ k: 'uf',     label: `UF: ${filters.uf}` });
  if (filters.cnpj_emitente) chips.push({ k: 'cnpj_emitente', label: 'Cliente filtrado' });
  if (filters.cnpj_dest)     chips.push({ k: 'cnpj_dest', label: `Empresa: ${CNPJ_OPTIONS.find(o => o.v === filters.cnpj_dest)?.l || 'destino'}` });
  if (filters.linha_produto) chips.push({ k: 'linha_produto', label: `Linha: ${titulo(filters.linha_produto)}` });
  if (filters.status)        chips.push({ k: 'status', label: filters.status === 'evidencia_anexada' ? 'Evidência anexada' : 'Evidência solicitada' });
  if (filters.devolucao_total) chips.push({ k: 'devolucao_total', label: filters.devolucao_total === 'total' ? 'Somente total' : 'Somente parcial' });
  if (filters.lancado === 'sim') chips.push({ k: 'lancado', label: 'Lançada no Protheus' });
  if (filters.lancado === 'nao') chips.push({ k: 'lancado', label: 'Fora do Protheus' });
  if (filters.farol === 'vermelho') chips.push({ k: 'farol', label: 'Prazo vencido' });
  if (filters.farol === 'amarelo')  chips.push({ k: 'farol', label: 'Últimos 15 dias' });
  if (filters.farol === 'verde')    chips.push({ k: 'farol', label: 'Dentro do prazo' });
  if (filters.com_motivo === 'sem') chips.push({ k: 'com_motivo', label: 'Sem motivo' });
  if (filters.com_motivo === 'com') chips.push({ k: 'com_motivo', label: 'Com motivo' });
  if (filters.flag_emissao === 'divergente') chips.push({ k: 'flag_emissao', label: 'Emissão divergente' });
  if (filters.flag_emissao === 'no_ato')     chips.push({ k: 'flag_emissao', label: 'Emitida no ato' });
  if (filters.flag_emissao === 'aguardando') chips.push({ k: 'flag_emissao', label: 'Aguardando entrega' });
  if (filters.nf_venda === 'nao_localizada') chips.push({ k: 'nf_venda', label: 'NF de venda não localizada' });
  if (filters.nf_venda === 'localizada')     chips.push({ k: 'nf_venda', label: 'NF de venda localizada' });
  if (filters.centro_custo === 'sem') chips.push({ k: 'centro_custo', label: 'Sem centro de custo' });
  else if (filters.centro_custo)      chips.push({ k: 'centro_custo', label: `Centro: ${titulo(filters.centro_custo)}` });
  if (filters.retornou_cd === 'sim')    chips.push({ k: 'retornou_cd', label: 'Retornou ao CD' });
  if (filters.retornou_cd === 'cobrar') chips.push({ k: 'retornou_cd', label: 'CD com itens a cobrar' });
  if (filters.retornou_cd === 'nao')    chips.push({ k: 'retornou_cd', label: 'Não retornou ao CD' });
  if (filters.transportador) {
    const n = filters.transportador === '__sem__' ? [] : filters.transportador.split('|').filter(Boolean);
    chips.push({ k: 'transportador', label: filters.transportador === '__sem__' ? 'Sem transportador'
      : n.length === 1 ? `Transportador: ${titulo(n[0].split(' ').slice(0, 2).join(' '))}` : `${n.length} transportadoras` });
  }
  if (filters.dt_inicio || filters.dt_fim)
    chips.push({ k: 'periodo', label: `Período: ${dataCurta(filters.dt_inicio) || '…'} a ${dataCurta(filters.dt_fim) || '…'}`,
      clear: { dt_inicio: '', dt_fim: '' } });

  /* Filas de trabalho da faixa de resumo */
  const filas = [
    { k: 'com_motivo', v: 'sem', cor: '#DC2626', n: resumo?.sem_motivo,  label: 'sem motivo' },
    { k: 'farol', v: 'vermelho', cor: '#DC2626', n: resumo?.prazo_vencido, label: 'com prazo vencido' },
    { k: 'farol', v: 'amarelo',  cor: '#D97706', n: resumo?.prazo_atencao, label: 'vencem em 15 dias' },
    { k: 'transportador', v: '__sem__', cor: '#9CA3AF', n: resumo?.sem_transportador, label: 'sem transportador' },
    { k: 'centro_custo', v: 'sem', cor: '#9CA3AF', n: resumo?.sem_centro_custo, label: 'sem centro de custo' },
  ];

  if (modo === 'cd') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Recebimento no CD</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Marque a chegada da nota e lance os produtos que vieram, com a condição de cada um
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <button className="btn btn-outline btn-sm" onClick={() => setModo('lista')}>Voltar para a lista</button>
        </div>
        <RetornoCDTrabalho onSair={() => setModo('lista')}/>
      </div>
    );
  }

  return (
    <div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>Filtrado por</span>
          {chips.map(c => (
            <span key={c.k} className="dv-chip">
              {c.label}
              <button type="button" aria-label={`Remover filtro ${c.label}`}
                onClick={() => applyFilter(c.clear || { [c.k]: '' })}>
                <Ic d={ICONES.x} size={11}/>
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="btn btn-ghost btn-sm">Limpar tudo</button>
        </div>
      )}

      <div className="dv-panel">
        {/* ─ Ferramentas ─ */}
        <div className="dv-toolbar">
          <div className="dv-search">
            <Ic d={ICONES.busca} size={14} color="var(--text-3)"/>
            <input type="text" value={searchInput} onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar por número da NF, cliente ou município"/>
            {searchInput && (
              <button type="button" aria-label="Limpar busca"
                onClick={() => { setSearchInput(''); clearTimeout(searchRef.current); applyFilter({ search: '' }); }}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
                <Ic d={ICONES.x} size={12}/>
              </button>
            )}
          </div>

          <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
            className={`btn btn-sm ${showFilters || filtrosAtivos ? 'btn-primary' : 'btn-outline'}`}>
            <Ic d={ICONES.filtro} size={13}/> Filtros
            {filtrosAtivos > 0 && (
              <span className="dv-count-badge"
                style={showFilters || filtrosAtivos ? { background: 'rgba(255,255,255,.25)' } : undefined}>
                {filtrosAtivos}
              </span>
            )}
          </button>

          <button onClick={() => load(filters, page)} className="btn btn-outline btn-sm"
            title="Atualizar lista" aria-label="Atualizar lista" disabled={loading}>
            <Ic d={ICONES.recarregar} size={13}/>
          </button>

          <button onClick={() => setModo('cd')} className="btn btn-outline btn-sm" title="Conferir as notas que chegaram ao CD">
            Recebimento no CD
          </button>

          <button onClick={() => { setSelMode(v => !v); setMarcadas(new Set()); }}
            className={`btn btn-sm ${selMode ? 'btn-primary' : 'btn-outline'}`} title="Marcar várias notas e alterar de uma vez">
            {selMode ? 'Sair da seleção' : 'Selecionar várias'}
          </button>

          <div className="dv-spacer"/>

          <MenuAcoes onImportar={() => setShowImport(true)} onExcel={handleExport} onConsulta={handleConsulta}
            exportando={exporting} gerando={gerandoConsulta}/>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Ic d={ICONES.mais} size={13}/> Lançar manual
          </button>
        </div>

        {/* ─ Filtros ─ */}
        {showFilters && (
          <div className="dv-filtros">
            <div className="dv-filtros-grupo">
              <div className="dv-filtros-titulo">Situação e prazo</div>
              <div className="dv-campos">
                <Campo label="Prazo de 90 dias">
                  <select value={filters.farol} onChange={e => applyFilter({ farol: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todos'], ['vermelho', 'Prazo vencido'], ['amarelo', 'Vence em até 15 dias'], ['verde', 'Dentro do prazo']]}/>
                  </select>
                </Campo>
                <Campo label="Protheus">
                  <select value={filters.lancado} onChange={e => applyFilter({ lancado: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['sim', 'Lançada'], ['nao', 'Não lançada']]}/>
                  </select>
                </Campo>
                <Campo label="Retorno ao CD">
                  <select value={filters.retornou_cd} onChange={e => applyFilter({ retornou_cd: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['sim', 'Retornou'], ['nao', 'Não retornou'], ['cobrar', 'Com itens a cobrar']]}/>
                  </select>
                </Campo>
                <Campo label="Evidência">
                  <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['evidencia_solicitada', 'Solicitada'], ['evidencia_anexada', 'Anexada']]}/>
                  </select>
                </Campo>
              </div>
            </div>

            <div className="dv-filtros-grupo">
              <div className="dv-filtros-titulo">Classificação</div>
              <div className="dv-campos">
                <Campo label="Motivo">
                  <select value={filters.com_motivo} onChange={e => applyFilter({ com_motivo: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todos'], ['com', 'Classificado'], ['sem', 'Sem motivo']]}/>
                  </select>
                </Campo>
                <Campo label="Centro de custo">
                  <select value={filters.centro_custo} onChange={e => applyFilter({ centro_custo: e.target.value })} className="input">
                    <option value="">Todos</option>
                    <option value="sem">Sem centro de custo</option>
                    {CENTROS.map(c => <option key={c} value={c}>{titulo(c)}</option>)}
                  </select>
                </Campo>
                <Campo label="NF de venda">
                  <select value={filters.nf_venda} onChange={e => applyFilter({ nf_venda: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['localizada', 'Localizada'], ['nao_localizada', 'Não localizada']]}/>
                  </select>
                </Campo>
                <Campo label="Linha">
                  <select value={filters.linha_produto} onChange={e => applyFilter({ linha_produto: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['MIX', 'Mix'], ['CHOCOLATE', 'Chocolate']]}/>
                  </select>
                </Campo>
              </div>
            </div>

            <div className="dv-filtros-grupo">
              <div className="dv-filtros-titulo">Origem e período</div>
              <div className="dv-campos">
                <Campo label="Empresa destino">
                  <select value={filters.cnpj_dest} onChange={e => applyFilter({ cnpj_dest: e.target.value })} className="input">
                    {CNPJ_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </Campo>
                <Campo label="Tipo">
                  <select value={filters.devolucao_total} onChange={e => applyFilter({ devolucao_total: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Total e parcial'], ['total', 'Somente total'], ['parcial', 'Somente parcial']]}/>
                  </select>
                </Campo>
                <Campo label="Transportador">
                  <TranspMultiSelect transportadoras={transportadoras} value={filters.transportador}
                    onChange={v => applyFilter({ transportador: v })}/>
                </Campo>
                <Campo label="Data de emissão">
                  <select value={filters.flag_emissao} onChange={e => applyFilter({ flag_emissao: e.target.value })} className="input">
                    <Opcoes itens={[['', 'Todas'], ['divergente', 'Divergente da entrega'], ['no_ato', 'No ato da entrega'], ['aguardando', 'Aguardando entrega']]}/>
                  </select>
                </Campo>
                <Campo label="UF" largura={72}>
                  <input type="text" maxLength={2} value={filters.uf} placeholder="—"
                    onChange={e => applyFilter({ uf: e.target.value.toUpperCase() })} className="input"/>
                </Campo>
                <Campo label="De" largura={148}>
                  <input type="date" value={filters.dt_inicio} onChange={e => applyFilter({ dt_inicio: e.target.value })} className="input"/>
                </Campo>
                <Campo label="Até" largura={148}>
                  <input type="date" value={filters.dt_fim} onChange={e => applyFilter({ dt_fim: e.target.value })} className="input"/>
                </Campo>
              </div>
            </div>

            <div className="dv-filtros-rodape">
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {filtrosAtivos === 0 ? 'Nenhum filtro aplicado'
                  : `${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} aplicado${filtrosAtivos > 1 ? 's' : ''}`}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={clearFilters} disabled={!hasFilters} className="btn btn-ghost btn-sm">Limpar filtros</button>
                <button onClick={() => setShowFilters(false)} className="btn btn-outline btn-sm">Fechar</button>
              </div>
            </div>
          </div>
        )}

        {/* ─ Resumo e filas ─ */}
        <div className="dv-resumo">
          <span className="dv-resumo-total">
            {loading && !rows.length ? 'Carregando…' : <><b>{total.toLocaleString('pt-BR')}</b> {total === 1 ? 'nota' : 'notas'}</>}
            {resumo && !resumo.erro && (
              <> · <b>{fmtBRL(resumo.valor)}</b>{resumo.truncado && <span style={{ color: 'var(--text-3)' }}> (parcial)</span>}</>
            )}
          </span>
          <div style={{ width: 1, height: 18, background: 'var(--border)' }}/>
          {filas.filter(f => f.n > 0).map(f => {
            const ativo = filters[f.k] === f.v;
            return (
              <button key={f.k + f.v} type="button" className="dv-fila" aria-pressed={ativo}
                title={ativo ? 'Remover este filtro' : 'Filtrar por estas notas'}
                onClick={() => applyFilter({ [f.k]: ativo ? '' : f.v })}>
                <span className="dv-fila-dot" style={{ background: f.cor }}/>
                <b>{f.n.toLocaleString('pt-BR')}</b> {f.label}
              </button>
            );
          })}
          {resumo && !resumo.erro && filas.every(f => !f.n) && (
            <span style={{ fontSize: 11.5, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Ic d={ICONES.check} size={12} w={3}/> Nada pendente nesta seleção
            </span>
          )}
        </div>

        {/* ─ Cabeçalho ─ */}
        <div className="dv-head" style={{ gridTemplateColumns: selMode ? COLS_SEL : COLS }}>
          {selMode && (
            <span>
              <input type="checkbox" aria-label="Marcar todas da página" style={{ width: 15, height: 15, accentColor: 'var(--blue)', cursor: 'pointer' }}
                checked={rows.length > 0 && rows.every(r => marcadas.has(r.id))}
                onChange={() => marcarTodas(rows)}/>
            </span>
          )}
          <span>NF devolução</span>
          <span>Cliente e motivo</span>
          <span>NF de venda</span>
          <span>Emissão e prazo</span>
          <span style={{ textAlign: 'right' }}>Valor</span>
          <span style={{ textAlign: 'right' }}>Situação</span>
        </div>

        {error && (
          <div style={{ padding: '14px 16px', color: 'var(--red)', fontSize: 12.5, display: 'flex', gap: 8,
            alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--red-dim)' }}>
            <Ic d={ICONES.alerta} size={14}/> {error}
          </div>
        )}

        {loading ? (
          <div className="table-loading">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
                style={{ animation: 'spin 0.9s linear infinite' }}>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
              </svg>
              <span>Carregando devoluções…</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="table-empty">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Ic d={ICONES.vazio} size={30} color="var(--border-2)" w={1.5}/>
              <span>{hasFilters ? 'Nenhuma devolução com esses filtros' : 'Nenhuma devolução encontrada'}</span>
              {hasFilters && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        ) : rows.map(row => {
          const nfVendaNum = row.chave_nfe_referenciada
            ? String(parseInt(row.chave_nfe_referenciada.slice(25, 34), 10) || '') : null;
          const farol  = calcFarolProtheus(row);
          const stOp   = calcStatusOperacional(row);
          const cfgOp  = STATUS_OP_CFG[stOp] || STATUS_OP_CFG['AGENDAR REVERSA'];
          const urgente = !row.lancado_protheus ? URGENCIA[farol.cor] : null;
          const consumido = farol.dias != null ? Math.max(0, Math.min(100, (farol.dias / 90) * 100)) : null;
          const empresaDest = CNPJ_MAP[row.cnpj_destinatario];
          const linha = row.linha_produto;

          return (
            <div key={row.id} className="dv-linha" role="button" tabIndex={0}
              aria-selected={selMode ? marcadas.has(row.id) : selectedId === row.id}
              style={{ gridTemplateColumns: selMode ? COLS_SEL : COLS, '--dv-urgencia': urgente || 'transparent' }}
              onClick={() => (selMode ? marcar(row.id) : setSelected(row.id))}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selMode ? marcar(row.id) : setSelected(row.id); } }}>

              {selMode && (
                <div onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={marcadas.has(row.id)} onChange={() => marcar(row.id)}
                    aria-label={`Marcar NF ${row.nf_numero}`} style={{ width: 15, height: 15, accentColor: 'var(--blue)', cursor: 'pointer' }}/>
                </div>
              )}

              {/* NF devolução */}
              <div>
                <div className="dv-l1 dv-num">{row.nf_numero ?? '—'}</div>
                <div className="dv-l2">
                  {row.nf_serie && <span>Série {row.nf_serie}</span>}
                  <span className="dv-selo" style={{
                    color: row.devolucao_total ? 'var(--red)' : 'var(--text-2)',
                    background: row.devolucao_total ? 'var(--red-dim)' : 'var(--surface-3)' }}>
                    {row.devolucao_total ? 'Total' : 'Parcial'}
                  </span>
                </div>
              </div>

              {/* Cliente e motivo */}
              <div style={{ minWidth: 0, paddingRight: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span className="dv-l1 ellipsis" title={row.nome_emitente || ''}>{row.nome_emitente || '—'}</span>
                  {row.lancamento_manual && (
                    <span className="dv-selo" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>Manual</span>
                  )}
                  {row.retornou_cd && (
                    <span className="dv-selo" title={row.tem_itens_cobrar ? 'Retornou ao CD com itens a cobrar' : 'Retornou ao CD'}
                      style={{ background: row.tem_itens_cobrar ? 'var(--red-dim)' : 'var(--green-dim)',
                               color: row.tem_itens_cobrar ? 'var(--red)' : 'var(--green)' }}>
                      {row.tem_itens_cobrar ? 'CD · cobrar' : 'CD'}
                    </span>
                  )}
                  <Alertas row={row}/>
                </div>
                <div className="dv-l2">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: row.motivo_devolucao ? 'var(--blue)' : 'var(--border-2)' }}/>
                  {row.motivo_devolucao
                    ? <span className="ellipsis" style={{ color: 'var(--text-2)', fontWeight: 500 }} title={row.motivo_devolucao}>
                        {titulo(row.motivo_devolucao)}
                      </span>
                    : <span style={{ fontStyle: 'italic' }}>Sem motivo classificado</span>}
                  {row.uf_emitente && (
                    <span style={{ marginLeft: 'auto', flexShrink: 0, fontWeight: 600, letterSpacing: '.03em' }}>
                      {row.uf_emitente}
                    </span>
                  )}
                </div>
              </div>

              {/* NF de venda */}
              <div>
                {nfVendaNum
                  ? <div className="dv-l1" style={{ fontVariantNumeric: 'tabular-nums',
                      color: row.nf_venda_localizada ? 'var(--blue)' : 'var(--text-2)', fontWeight: 700 }}>
                      {nfVendaNum}
                    </div>
                  : <div className="dv-l1" style={{ color: 'var(--text-3)', fontWeight: 400 }}>—</div>}
                {(linha || empresaDest || row.nf_venda_localizada === false) && (
                  <div className="dv-l2">
                    {linha
                      ? <span className="dv-selo" style={{
                          color: linha === 'CHOCOLATE' ? 'var(--yellow)' : 'var(--green)',
                          background: linha === 'CHOCOLATE' ? 'var(--yellow-dim)' : 'var(--green-dim)' }}>
                          {titulo(linha)}
                        </span>
                      : empresaDest
                        ? <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{titulo(empresaDest)}</span>
                        : <span>Sem vínculo</span>}
                  </div>
                )}
              </div>

              {/* Emissão e prazo */}
              <div>
                <div className="dv-l1" style={{ fontWeight: 500, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                  {fmtDate(row.dt_emissao)}
                  {row.devolucao_total && row.dt_devolucao && (
                    <span style={{ color: 'var(--text-3)' }}> · dev {fmtDate(row.dt_devolucao)}</span>
                  )}
                </div>
                <div className="dv-l2">
                  {row.lancado_protheus ? (
                    <span style={{ color: 'var(--green)', fontWeight: 600, display: 'inline-flex',
                      alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Ic d={ICONES.check} size={11} w={3}/>
                      {row.dt_lancamento_protheus ? `Lançada em ${fmtDate(row.dt_lancamento_protheus)}` : 'Lançada'}
                    </span>
                  ) : farol.cor === 'sem_data' ? (
                    <span>Sem data de referência</span>
                  ) : (
                    <>
                      <span className="dv-barra" title={`${farol.dias} de 90 dias usados`}>
                        <i style={{ width: `${consumido}%`,
                          background: farol.cor === 'vermelho' ? 'var(--red)' : farol.cor === 'amarelo' ? 'var(--yellow)' : 'var(--green)' }}/>
                      </span>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap',
                        color: farol.cor === 'vermelho' ? 'var(--red)' : farol.cor === 'amarelo' ? 'var(--yellow)' : 'var(--text-2)' }}>
                        {farol.diasRestantes > 0 ? `${farol.diasRestantes} d` : `${Math.abs(farol.diasRestantes)} d em atraso`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Valor */}
              <div className="dv-valor">{fmtBRL(row.valor)}</div>

              {/* Situação */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="dv-status" style={{ background: cfgOp.bg, color: cfgOp.fg }}>{cfgOp.l}</span>
                {(row.status_portal === 'evidencia_solicitada' || row.status_portal === 'evidencia_anexada') && (
                  <Badge status={row.status_portal}/>
                )}
              </div>
            </div>
          );
        })}

        {selMode && marcadas.size > 0 && (
          <BarraSelecao ids={[...marcadas]}
            onLimpar={() => setMarcadas(new Set())}
            onAplicado={() => { setMarcadas(new Set()); load(filters, page); }}/>
        )}
        {selMode && marcadas.size > 0 && <div aria-hidden style={{ height: 96 }}/>}

        {/* ─ Paginação ─ */}
        {totalPages > 1 && (
          <div className="dv-rodape">
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
              {((page * PAGE_SIZE) + 1).toLocaleString('pt-BR')}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(0)} className="btn btn-outline btn-xs" aria-label="Primeira página">«</button>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-xs">Anterior</button>
              <span style={{ fontSize: 11.5, color: 'var(--text-2)', padding: '0 6px', fontVariantNumeric: 'tabular-nums' }}>
                {page + 1} de {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-xs">Próxima</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="btn btn-outline btn-xs" aria-label="Última página">»</button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <DetalheDrawer id={selectedId} user={user}
          onClose={() => setSelected(null)}
          onSaved={() => load(filters, page)}/>
      )}
      {showModal && (
        <ModalLancamentoManual user={user} onClose={() => setShowModal(false)}
          onSaved={() => load(filters, page)}/>
      )}
      {showImport && (
        <ModalImportProtheus onClose={() => setShowImport(false)}
          onImported={() => load(filters, page)}/>
      )}
    </div>
  );
}
