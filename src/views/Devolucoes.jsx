import { useCallback, useEffect, useRef, useState } from 'react';
import { dbListDevolucoes } from '../config/supabase';
import { fmtBRL, fmtDate, CNPJ_MAP, STATUS_CFG, Badge } from '../utils.jsx';
import DetalheDrawer from '../components/DetalheDrawer.jsx';
import ModalLancamentoManual from '../components/ModalLancamentoManual.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const COLS = '88px 1fr 90px 70px 110px 108px 60px';

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

export default function Devolucoes({ user, initialFilters = {} }) {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [selectedId, setSelected]     = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '', status: initialFilters.status || '',
    cnpj_dest: '', uf: '', dt_inicio: '', dt_fim: '',
  });
  const searchRef = useRef(null);
  const PAGE_SIZE = 40;

  const load = useCallback(async (f, p) => {
    setLoading(true); setError('');
    try {
      const result = await dbListDevolucoes({ page: p, filters: f });
      setRows(result.rows); setTotal(result.total);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filters, page); }, [filters, page]); // eslint-disable-line

  const applyFilter = patch => { setFilters(f => ({ ...f, ...patch })); setPage(0); };
  const handleSearch = val => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => applyFilter({ search: val }), 350);
  };
  const clearFilters = () => applyFilter({ status: '', cnpj_dest: '', uf: '', dt_inicio: '', dt_fim: '', search: '' });
  const hasFilters = filters.status || filters.cnpj_dest || filters.uf || filters.dt_inicio || filters.dt_fim || filters.search;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Toolbar */}
      <div className="table-wrap" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}>
        <div className="table-toolbar">
          <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" color="var(--text-3)" size={15}/>
          <input type="text" placeholder="Buscar por emitente, número da NF ou município..."
            defaultValue={filters.search}
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
              className="input" style={{ width: 'auto', minWidth: 160 }}>
              {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
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
            <select value={filters.lancamento_manual || ''} onChange={e => applyFilter({ lancamento_manual: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 140 }}>
              <option value="">Todas as origens</option>
              <option value="manual">Somente Manuais</option>
            </select>
            <select value={filters.nf_venda || ''} onChange={e => applyFilter({ nf_venda: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 170 }}>
              <option value="">NF venda: todas</option>
              <option value="localizada">✓ NF venda localizada</option>
              <option value="nao_localizada">✗ NF venda não localizada</option>
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
          <span>NF Dev.</span>
          <span>Emitente</span>
          <span>NF Venda</span>
          <span>UF</span>
          <span>Emissão</span>
          <span style={{ textAlign: 'right' }}>Valor</span>
          <span style={{ textAlign: 'center' }}>Status</span>
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
          return (
            <div key={row.id} className="table-row"
              style={{ gridTemplateColumns: COLS }}
              onClick={() => setSelected(row.id)}>

              {/* NF Dev */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.nf_numero ?? '—'}
                </div>
                {row.nf_serie && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>Série {row.nf_serie}</div>
                )}
              </div>

              {/* Emitente */}
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
                    {row.nome_emitente || '—'}
                  </div>
                  {row.lancamento_manual && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--purple-dim)', color: 'var(--purple)', padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>MANUAL</span>
                  )}
                  {row.lancamento_manual === true && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--red-dim)', color: 'var(--red)', padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>TOTAL</span>
                  )}
                  {!row.lancamento_manual && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--yellow-dim)', color: 'var(--yellow)', padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>PARCIAL</span>
                  )}
                </div>
                {/* Motivo — linha separada com destaque */}
                {row.motivo_devolucao ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                      {row.motivo_devolucao}
                    </span>
                  </div>
                ) : (
                  <div className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                    {row.municipio_emitente || row.cnpj_emitente || ''}
                  </div>
                )}
              </div>

              {/* NF Venda */}
              <div>
                {row.nf_venda_localizada === true ? (
                  <>
                    <div style={{ fontSize: 12.5, color: 'var(--blue)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {row.chave_nfe_referenciada
                        ? String(parseInt(row.chave_nfe_referenciada.slice(25, 34), 10) || '')
                        : '—'}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--green)', fontWeight: 700, marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      NF venda localizada
                    </div>
                  </>
                ) : row.nf_venda_localizada === false ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.chave_nfe_referenciada
                        ? String(parseInt(row.chave_nfe_referenciada.slice(25, 34), 10) || '—')
                        : '—'}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--yellow)', fontWeight: 700, marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01"/><circle cx="12" cy="12" r="10"/></svg>
                      Sem vínculo
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>—</div>
                )}
                {row.cnpj_destinatario && (
                  <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 1, fontWeight: 600 }}>
                    {CNPJ_MAP[row.cnpj_destinatario] || ''}
                  </div>
                )}
              </div>

              {/* UF */}
              <div>
                <span style={{
                  display: 'inline-block', padding: '2px 7px',
                  background: 'var(--surface-3)', borderRadius: 4,
                  fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
                  letterSpacing: '.03em',
                }}>
                  {row.uf_emitente || '—'}
                </span>
              </div>

              {/* Emissão */}
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDate(row.dt_emissao)}
              </div>

              {/* Valor */}
              <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtBRL(row.valor)}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Badge status={row.status_portal} />
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
    </div>
  );
}
