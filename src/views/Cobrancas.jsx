import { useCallback, useEffect, useRef, useState } from 'react';
import { dbListCobrancas } from '../config/supabase';
import { fmtBRL, fmtDate, fmtCNPJ, BadgeCobranca } from '../utils.jsx';
import ModalCobranca from '../components/ModalCobranca.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const COLS = '88px 1fr 1fr 90px 110px 120px 80px';

const STATUS_OPTIONS = [
  { v: '',                                  l: 'Todos os status' },
  { v: 'pendente_cobranca_transportador',   l: 'Pendente cobrança' },
  { v: 'cobrado',                           l: 'Cobrado' },
  { v: 'isento',                            l: 'Isento' },
];

export default function Cobrancas({ user, initialFilters = {}, onChanged }) {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '', status_cobranca: initialFilters.status_cobranca ?? 'pendente_cobranca_transportador',
    transportador: '',
  });
  const searchRef = useRef(null);
  const PAGE_SIZE = 40;

  const load = useCallback(async (f, p) => {
    setLoading(true); setError('');
    try {
      const result = await dbListCobrancas({ page: p, filters: f });
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
  const clearFilters = () => applyFilter({ status_cobranca: '', transportador: '', search: '' });
  const hasFilters = filters.status_cobranca || filters.transportador || filters.search;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Toolbar */}
      <div className="table-wrap" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}>
        <div className="table-toolbar">
          <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" color="var(--text-3)" size={15}/>
          <input type="text" placeholder="Buscar por emitente, número da NF ou transportador..."
            defaultValue={filters.search}
            onChange={e => handleSearch(e.target.value)}
            className="table-search-input"
          />
          {hasFilters && (
            <button onClick={clearFilters} className="btn btn-ghost btn-sm">
              <Ic d="M6 18L18 6M6 6l12 12" size={12}/> Limpar
            </button>
          )}
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
            <select value={filters.status_cobranca} onChange={e => applyFilter({ status_cobranca: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 180 }}>
              {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <input type="text" placeholder="Transportador"
              value={filters.transportador}
              onChange={e => applyFilter({ transportador: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 200 }}/>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <div className="table-head" style={{ gridTemplateColumns: COLS }}>
          <span>NF Dev.</span>
          <span>Emitente / Motivo</span>
          <span>Transportador</span>
          <span>Emissão</span>
          <span style={{ textAlign: 'right' }}>Valor</span>
          <span>NF Débito</span>
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
              <span>Carregando cobranças...</span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="table-empty">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="1.5"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Nenhuma cobrança encontrada</span>
              {hasFilters && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        ) : rows.map(row => {
          const statusCor = {
            pendente_cobranca_transportador: 'var(--yellow)',
            cobrado: 'var(--green)',
            isento:  'var(--text-3)',
          }[row.status_cobranca] || 'var(--text-3)';
          return (
          <div key={row.id} className="dev-row"
            style={{ gridTemplateColumns: COLS, '--row-accent': statusCor }}
            onClick={() => setSelectedRow(row)}>

            {/* NF Dev */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {row.nf_numero ?? '—'}
              </div>
              {row.nf_serie && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>Série {row.nf_serie}</div>
              )}
            </div>

            {/* Emitente / Motivo */}
            <div style={{ overflow: 'hidden' }}>
              <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
                {row.nome_emitente || '—'}
              </div>
              {row.motivo_devolucao && (
                <div style={{ marginTop: 3 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                    {row.motivo_devolucao}
                  </span>
                </div>
              )}
            </div>

            {/* Transportador */}
            <div style={{ overflow: 'hidden' }}>
              {row.transportador_cobranca ? (
                <>
                  <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                    {row.transportador_cobranca}
                  </div>
                  {row.transportador_cnpj_cobranca && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                      {fmtCNPJ(row.transportador_cnpj_cobranca)}
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Não identificado
                </span>
              )}
            </div>

            {/* Emissão */}
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtDate(row.dt_emissao)}
            </div>

            {/* Valor */}
            <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBRL(row.valor)}
            </div>

            {/* NF Débito */}
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
              {row.nf_debito || '—'}
            </div>

            {/* Status */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <BadgeCobranca status={row.status_cobranca} />
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

      {selectedRow && (
        <ModalCobranca row={selectedRow} user={user}
          onClose={() => setSelectedRow(null)}
          onSaved={() => { load(filters, page); onChanged?.(); }}
        />
      )}
    </div>
  );
}
