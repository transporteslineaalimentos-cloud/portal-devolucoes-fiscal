import { useCallback, useEffect, useRef, useState } from 'react';
import { dbListDevolucoes, dbExportDevolucoes, dbGetTransportadoras } from '../config/supabase';
import { fmtBRL, fmtDate, CNPJ_MAP, STATUS_CFG, Badge } from '../utils.jsx';
import DetalheDrawer from '../components/DetalheDrawer.jsx';
import ModalLancamentoManual from '../components/ModalLancamentoManual.jsx';
import ModalImportProtheus from '../components/ModalImportProtheus.jsx';
import { exportDevolucoesToExcel } from '../utils/exportExcel.js';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const COLS = '108px 1fr 132px 96px 132px 150px';

const STATUS_OPTIONS = [
  { v: '',           l: 'Todos os status' },
  { v: 'pendente',   l: 'Pendente' },
  { v: 'em_analise', l: 'Em análise' },
  { v: 'aprovada',   l: 'Aprovada' },
  { v: 'rejeitada',  l: 'Rejeitada' },
  { v: 'concluida',  l: 'Concluída' },
];
const CNPJ_OPTIONS = [
  { v: '',               l: 'Todas as empresas' },
  { v: '05207076000297', l: 'MIX' },
  { v: '05207076000459', l: 'CHOCOLATE' },
];

const EMPTY_FILTERS = {
  search: '', status: '', cnpj_dest: '', cnpj_emitente: '', uf: '',
  dt_inicio: '', dt_fim: '', mes: '', area: '', motivo: '',
  devolucao_total: '', com_motivo: '', flag_emissao: '', lancado: '', nf_venda: '',
  centro_custo: '', transportador: '',
};

export default function Devolucoes({ user, initialFilters = {} }) {
  const { _ts, ...initFilt } = initialFilters; // _ts só força re-render
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [selectedId, setSelected]     = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, ...initFilt });
  const [transportadoras, setTransportadoras] = useState([]);
  const searchRef = useRef(null);
  const PAGE_SIZE = 40;

  useEffect(() => { dbGetTransportadoras().then(setTransportadoras).catch(() => {}); }, []);

  // Reagir a drill-down vindo do dashboard (initialFilters muda)
  const initKey = JSON.stringify(initialFilters);
  useEffect(() => {
    if (Object.keys(initFilt).length) {
      setFilters({ ...EMPTY_FILTERS, ...initFilt });
      setPage(0);
      setShowFilters(true);
    }
  }, [initKey]); // eslint-disable-line

  const load = useCallback(async (f, p) => {
    setLoading(true); setError('');
    try {
      const result = await dbListDevolucoes({ page: p, filters: f });
      setRows(result.rows); setTotal(result.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // Atalhos de teclado: setas navegam entre notas quando drawer está aberto
  useEffect(() => {
    if (!selectedId) return;
    const handler = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const idx = rows.findIndex(r => r.id === selectedId);
      if (idx === -1) return;
      const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
      if (next) setSelected(next.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, rows]);

  useEffect(() => { load(filters, page); }, [filters, page]); // eslint-disable-line

  const applyFilter = patch => { setFilters(f => ({ ...f, ...patch })); setPage(0); };
  const handleSearch = val => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => applyFilter({ search: val }), 350);
  };
  const clearFilters = () => { setFilters({ ...EMPTY_FILTERS }); setPage(0); };
  const hasFilters = Object.entries(filters).some(([k, v]) => v && k !== 'search') || filters.search;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const allRows = await dbExportDevolucoes({ filters });
      exportDevolucoesToExcel(allRows, { filename: hasFilters ? 'devolucoes_fiscais_filtrado' : 'devolucoes_fiscais' });
    } catch (e) {
      alert('Erro ao exportar: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // Rótulo amigável do filtro de drill-down ativo
  const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const activeChips = [];
  if (filters.mes)  { const [y,m] = filters.mes.split('-'); activeChips.push({ k: 'mes', label: `Mês: ${MES_NOMES[+m-1]}/${y.slice(2)}` }); }
  if (filters.area)          activeChips.push({ k: 'area', label: `Área: ${filters.area}` });
  if (filters.motivo)        activeChips.push({ k: 'motivo', label: `Motivo: ${filters.motivo}` });
  if (filters.uf)            activeChips.push({ k: 'uf', label: `UF: ${filters.uf}` });
  if (filters.cnpj_emitente) activeChips.push({ k: 'cnpj_emitente', label: `Cliente filtrado` });
  if (filters.cnpj_dest)     activeChips.push({ k: 'cnpj_dest', label: `Empresa: ${CNPJ_OPTIONS.find(o=>o.v===filters.cnpj_dest)?.l || 'destino'}` });
  if (filters.status)        activeChips.push({ k: 'status', label: `Status: ${STATUS_OPTIONS.find(o=>o.v===filters.status)?.l || filters.status}` });
  if (filters.lancado === 'sim') activeChips.push({ k: 'lancado', label: 'Lançada no Protheus' });
  if (filters.lancado === 'nao') activeChips.push({ k: 'lancado', label: 'Fora do Protheus' });
  if (filters.com_motivo === 'sem') activeChips.push({ k: 'com_motivo', label: 'Sem motivo classificado' });
  if (filters.flag_emissao === 'divergente') activeChips.push({ k: 'flag_emissao', label: 'Emissão divergente' });
  if (filters.nf_venda === 'nao_localizada') activeChips.push({ k: 'nf_venda', label: 'NF venda não localizada' });
  if (filters.centro_custo === 'sem') activeChips.push({ k: 'centro_custo', label: 'Sem centro de custo' });
  else if (filters.centro_custo) activeChips.push({ k: 'centro_custo', label: `CC: ${filters.centro_custo}` });
  if (filters.transportador === '__sem__') activeChips.push({ k: 'transportador', label: 'Sem transportador' });
  else if (filters.transportador) activeChips.push({ k: 'transportador', label: `Transp: ${filters.transportador}` });
  if (filters.dt_inicio || filters.dt_fim) {
    const fmt = s => { if (!s) return ''; const [y,m,dd] = s.split('-'); return `${dd}/${m}/${y.slice(2)}`; };
    activeChips.push({ k: 'periodo', label: `Período: ${fmt(filters.dt_inicio) || '...'} – ${fmt(filters.dt_fim) || '...'}`, clear: { dt_inicio: '', dt_fim: '' } });
  }

  return (
    <div>
      {/* Chips de filtro ativo (drill-down do dashboard) */}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>Filtrado por:</span>
          {activeChips.map(chip => (
            <span key={chip.k} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, fontWeight: 600, color: 'var(--blue)',
              background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)',
              padding: '4px 10px', borderRadius: 20,
            }}>
              {chip.label}
              <button onClick={() => applyFilter(chip.clear || { [chip.k]: '' })}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0 }}>
                <Ic d="M18 6L6 18M6 6l12 12" size={11}/>
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="btn btn-ghost btn-sm">Limpar tudo</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="table-wrap" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}>
        <div className="table-toolbar">
          <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" color="var(--text-3)" size={15}/>
          <input type="text" placeholder="Buscar por emitente, número da NF ou município..."
            value={filters.search}
            onChange={e => handleSearch(e.target.value)}
            className="table-search-input"
          />
          {hasFilters && (
            <button onClick={clearFilters} className="btn btn-ghost btn-sm">
              <Ic d="M6 18L18 6M6 6l12 12" size={12}/> Limpar
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-sm"
            style={{ background: 'var(--purple)', color: '#fff', flexShrink: 0 }}>
            <Ic d="M12 5v14M5 12h14" size={13}/>
            Lançar manual
          </button>
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm" title="Importar lançamentos do Protheus">
            <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" size={13}/>
            Importar Protheus
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn btn-outline btn-sm" title="Exportar para Excel">
            {exporting
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
              : <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={13}/>
            }
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button onClick={() => setShowFilters(v => !v)}
            className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
            <Ic d="M4 6h16M7 12h10M10 18h4" size={13}/>
            Filtros
          </button>
          <button onClick={() => load(filters, page)} className="btn btn-outline btn-sm" title="Atualizar">
            <Ic d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" size={13}/>
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} registro${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {showFilters && (
          <div className="table-filters-row">
            <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 200 }}>
              <option value="">Todos os status</option>
              <option value="evidencia_solicitada">🟡 Evidência solicitada</option>
              <option value="evidencia_anexada">🟢 Evidência anexada</option>
            </select>
            <select value={filters.cnpj_dest} onChange={e => applyFilter({ cnpj_dest: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 150 }}>
              {CNPJ_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={filters.devolucao_total || ''} onChange={e => applyFilter({ devolucao_total: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 140 }}>
              <option value="">Total e Parcial</option>
              <option value="total">Somente Total</option>
              <option value="parcial">Somente Parcial</option>
            </select>
            <select value={filters.transportador || ''} onChange={e => applyFilter({ transportador: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 200 }}>
              <option value="">Transportador: todos</option>
              <option value="__sem__">✗ Sem transportador</option>
              {transportadoras.map(t => (
                <option key={t.cnpj} value={t.nome}>{t.nome_curto || t.nome}</option>
              ))}
            </select>
            <select value={filters.com_motivo || ''} onChange={e => applyFilter({ com_motivo: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 170 }}>
              <option value="">Motivo: todos</option>
              <option value="com">✓ Com motivo classificado</option>
              <option value="sem">✗ Sem motivo (pendente)</option>
            </select>
            <select value={filters.flag_emissao || ''} onChange={e => applyFilter({ flag_emissao: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 190 }}>
              <option value="">Data emissão: todas</option>
              <option value="divergente">⚠ Emissão divergente da entrega</option>
              <option value="no_ato">✓ Emitida no ato da entrega</option>
              <option value="aguardando">⏳ Aguardando entrega</option>
            </select>
            <select value={filters.lancado || ''} onChange={e => applyFilter({ lancado: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 190 }}>
              <option value="">Protheus: todas</option>
              <option value="sim">✓ Lançada no Protheus</option>
              <option value="nao">✗ Não lançada no Protheus</option>
            </select>
            <select value={filters.nf_venda || ''} onChange={e => applyFilter({ nf_venda: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 170 }}>
              <option value="">NF venda: todas</option>
              <option value="localizada">✓ NF venda localizada</option>
              <option value="nao_localizada">✗ NF venda não localizada</option>
            </select>
            <select value={filters.centro_custo || ''} onChange={e => applyFilter({ centro_custo: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 180 }}>
              <option value="">Centro de custo: todos</option>
              <option value="sem">✗ Sem centro de custo</option>
              <option value="CANAL INDIRETO">Canal Indireto</option>
              <option value="CASH & CARRY">Cash & Carry</option>
              <option value="FARMA KEY ACCOUNT">Farma Key Account</option>
              <option value="KEY ACCOUNT">Key Account</option>
              <option value="CANAL DIRETO">Canal Direto</option>
              <option value="NOVOS NEGÓCIOS">Novos Negócios</option>
              <option value="ECOMMERCE">E-commerce</option>
              <option value="CANAL VERDE">Canal Verde</option>
              <option value="EIC">EIC</option>
            </select>
            <input type="text" placeholder="UF" maxLength={2}
              value={filters.uf}
              onChange={e => applyFilter({ uf: e.target.value.toUpperCase() })}
              className="input" style={{ width: 68 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={filters.dt_inicio}
                onChange={e => applyFilter({ dt_inicio: e.target.value })}
                className="input" style={{ width: 'auto' }}/>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>até</span>
              <input type="date" value={filters.dt_fim}
                onChange={e => applyFilter({ dt_fim: e.target.value })}
                className="input" style={{ width: 'auto' }}/>
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {/* Cabeçalho */}
        <div className="table-head" style={{ gridTemplateColumns: COLS }}>
          <span>NF Devolução</span>
          <span>Emitente · Motivo</span>
          <span>NF Venda</span>
          <span>Emissão</span>
          <span style={{ textAlign: 'right' }}>Valor devolvido</span>
          <span style={{ textAlign: 'right' }}>Situação</span>
        </div>

        {error && (
          <div style={{ padding: '14px 16px', color: 'var(--red)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--red-dim)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
            {error}
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
              <span>Carregando devoluções...</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="table-empty">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="1.5"><path d="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1"/></svg>
              <span>Nenhuma devolução encontrada</span>
              {hasFilters && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        ) : rows.map(row => {
          const nfVendaNum = row.chave_nfe_referenciada
            ? String(parseInt(row.chave_nfe_referenciada.slice(25, 34), 10) || '')
            : null;
          const statusCor = {
            pendente:   'var(--text-3)',
            em_analise: 'var(--yellow)',
            aprovada:   'var(--green)',
            rejeitada:  'var(--red)',
            concluida:  'var(--blue)',
          }[row.status_portal] || 'var(--text-3)';
          const empresaDest = CNPJ_MAP[row.cnpj_destinatario];

          return (
            <div key={row.id} className="dev-row"
              style={{ gridTemplateColumns: COLS, '--row-accent': statusCor }}
              onClick={() => setSelected(row.id)}>

              {/* NF Dev + tipo */}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                  {row.nf_numero ?? '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  {row.nf_serie && (
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Sér. {row.nf_serie}</span>
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.03em',
                    color: row.lancamento_manual ? 'var(--red)' : 'var(--yellow)',
                    background: row.lancamento_manual ? 'var(--red-dim)' : 'var(--yellow-dim)',
                    padding: '1px 5px', borderRadius: 4,
                  }}>
                    {row.lancamento_manual ? 'TOTAL' : 'PARCIAL'}
                  </span>
                </div>
              </div>

              {/* Emitente · Motivo */}
              <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="ellipsis" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                    {row.nome_emitente || '—'}
                  </span>
                  {row.lancamento_manual && (
                    <span style={{ fontSize: 8.5, fontWeight: 700, background: 'var(--purple-dim)', color: 'var(--purple)', padding: '1px 5px', borderRadius: 4, flexShrink: 0, letterSpacing: '.03em' }}>MANUAL</span>
                  )}
                </div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {row.motivo_devolucao ? (
                    <>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }}/>
                      <span className="ellipsis" style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>
                        {row.motivo_devolucao}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        Sem motivo classificado
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* NF Venda */}
              <div>
                {row.nf_venda_localizada === true ? (
                  <>
                    <div style={{ fontSize: 12.5, color: 'var(--blue)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {nfVendaNum || '—'}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--green)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      Vinculada
                    </div>
                  </>
                ) : row.nf_venda_localizada === false ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                      {nfVendaNum || '—'}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>
                      Sem vínculo
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                )}
                {empresaDest && (
                  <div style={{ fontSize: 9.5, color: 'var(--gold)', marginTop: 2, fontWeight: 700, letterSpacing: '.03em' }}>
                    {empresaDest}
                  </div>
                )}
              </div>

              {/* Emissão + UF */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {fmtDate(row.dt_emissao)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em' }}>
                    {row.uf_emitente || '—'}
                  </span>
                  {row.flag_emissao_entrega === 'divergente' && (
                    <span title="Data de emissão divergente da entrega" style={{ display: 'inline-flex' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    </span>
                  )}
                  {row.flag_emissao_entrega === 'aguardando_entrega' && (
                    <span title="Aguardando entrega" style={{ display: 'inline-flex' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    </span>
                  )}
                  {row.flag_emissao_entrega === 'no_ato' && (
                    <span title="Emitida no ato da entrega" style={{ display: 'inline-flex' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </span>
                  )}
                </div>
              </div>

              {/* Valor */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                  {fmtBRL(row.valor)}
                </div>
              </div>

              {/* Situação: status + Protheus */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <Badge status={row.status_portal} />
                {row.lancado_protheus
                  ? <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      Protheus
                    </span>
                  : <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-3)' }}>Fora do Protheus</span>
                }
              </div>
            </div>
          );
        })}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {((page * PAGE_SIZE) + 1).toLocaleString('pt-BR')}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(0)}
                className="btn btn-outline btn-xs" style={{ opacity: page === 0 ? 0.4 : 1 }}>
                «
              </button>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="btn btn-outline btn-xs" style={{ opacity: page === 0 ? 0.4 : 1 }}>
                ‹ Anterior
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '0 4px' }}>
                {page + 1} / {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="btn btn-outline btn-xs" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                Próxima ›
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}
                className="btn btn-outline btn-xs" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <DetalheDrawer id={selectedId} user={user}
          onClose={() => setSelected(null)}
          onSaved={() => load(filters, page)}
        />
      )}

      {showModal && (
        <ModalLancamentoManual
          user={user}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(filters, page); }}
        />
      )}

      {showImport && (
        <ModalImportProtheus
          onClose={() => setShowImport(false)}
          onImported={() => load(filters, page)}
        />
      )}
    </div>
  );
}
