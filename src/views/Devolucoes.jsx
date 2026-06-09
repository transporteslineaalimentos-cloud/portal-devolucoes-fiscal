import { useCallback, useEffect, useRef, useState } from 'react';
import { dbListDevolucoes } from '../config/supabase';
import { fmtBRL, fmtDate, CNPJ_MAP, STATUS_CFG, Badge } from '../utils.jsx';
import DetalheDrawer from '../components/DetalheDrawer.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const COLS = '90px 1fr 100px 80px 70px 120px 100px 70px';

const STATUS_OPTIONS = [
  { v: '',           l: 'Todos os status' },
  { v: 'pendente',   l: 'Pendente' },
  { v: 'em_analise', l: 'Em análise' },
  { v: 'aprovada',   l: 'Aprovada' },
  { v: 'rejeitada',  l: 'Rejeitada' },
  { v: 'concluida',  l: 'Concluída' },
];

const CNPJ_OPTIONS = [
  { v: '',               l: 'Todos os CNPJs' },
  { v: '05207076000297', l: 'MIX' },
  { v: '05207076000459', l: 'CHOCOLATE' },
];

export default function Devolucoes({ user, initialFilters = {} }) {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [selectedId, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    status: initialFilters.status || '',
    cnpj_dest: '',
    uf: '',
    dt_inicio: '',
    dt_fim: '',
  });

  const searchRef = useRef(null);
  const PAGE_SIZE = 40;

  const load = useCallback(async (f, p) => {
    setLoading(true); setError('');
    try {
      const result = await dbListDevolucoes({ page: p, filters: f });
      setRows(result.rows);
      setTotal(result.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters, page);
  }, [filters, page]); // eslint-disable-line

  const applyFilter = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(0);
  };

  const handleSearch = (val) => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => applyFilter({ search: val }), 350);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Filtros */}
      <div className="filter-wrap">
        <div className="filter-search-row">
          <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" color="var(--text-3)" />
          <input
            type="text"
            placeholder="Buscar por emitente ou número da NF..."
            defaultValue={filters.search}
            onChange={e => handleSearch(e.target.value)}
            className="filter-search-input"
          />
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn btn-sm ${showFilters ? 'btn-gold' : 'btn-outline'}`}
          >
            <Ic d="M4 6h16M7 12h10M10 18h4" />
            Filtros
          </button>
          <button onClick={() => load(filters, page)} className="btn btn-outline btn-sm">
            <Ic d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </button>
        </div>

        {showFilters && (
          <div className="filter-expanded">
            <select value={filters.status} onChange={e => applyFilter({ status: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 150 }}>
              {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={filters.cnpj_dest} onChange={e => applyFilter({ cnpj_dest: e.target.value })}
              className="input" style={{ width: 'auto', minWidth: 130 }}>
              {CNPJ_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <input type="text" placeholder="UF (ex: SP)" maxLength={2}
              value={filters.uf}
              onChange={e => applyFilter({ uf: e.target.value.toUpperCase() })}
              className="input" style={{ width: 72 }}
            />
            <input type="date" value={filters.dt_inicio}
              onChange={e => applyFilter({ dt_inicio: e.target.value })}
              className="input" style={{ width: 'auto' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>até</span>
            <input type="date" value={filters.dt_fim}
              onChange={e => applyFilter({ dt_fim: e.target.value })}
              className="input" style={{ width: 'auto' }}
            />
            <button onClick={() => applyFilter({ status: '', cnpj_dest: '', uf: '', dt_inicio: '', dt_fim: '', search: '' })}
              className="btn btn-outline btn-sm">
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        {/* Cabeçalho das colunas */}
        <div className="table-col-head" style={{ gridTemplateColumns: COLS }}>
          <span>NF Dev.</span>
          <span>Emitente</span>
          <span>NF Venda</span>
          <span>Destinatário</span>
          <span>UF</span>
          <span>Emissão</span>
          <span style={{ textAlign: 'right' }}>Valor</span>
          <span style={{ textAlign: 'center' }}>Status</span>
        </div>

        {error && (
          <div style={{ padding: '16px 14px', color: 'var(--red)', fontSize: 12 }}>
            Erro: {error}
          </div>
        )}

        {loading ? (
          <div className="table-loading">Carregando devoluções...</div>
        ) : rows.length === 0 ? (
          <div className="table-empty">
            {total === 0 && !loading
              ? 'Nenhuma devolução fiscal encontrada para os filtros selecionados.'
              : 'Carregando...'}
          </div>
        ) : rows.map((row, idx) => {
          // Extrai número da NF de venda da chave referenciada (pos 26-34 sem zeros à esquerda)
          const nfVendaNum = row.chave_nfe_referenciada
            ? String(parseInt(row.chave_nfe_referenciada.slice(25, 34), 10) || '')
            : null;

          return (
            <div
              key={row.id}
              className="table-row"
              style={{ gridTemplateColumns: COLS }}
              onClick={() => setSelected(row.id)}
            >
              {/* NF Devolução */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.nf_numero}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Série {row.nf_serie}</div>
              </div>

              {/* Emitente */}
              <div style={{ overflow: 'hidden' }}>
                <div className="ellipsis" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                  {row.nome_emitente || '—'}
                </div>
                <div className="ellipsis" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {row.municipio_emitente}
                </div>
              </div>

              {/* NF de Venda */}
              <div>
                {nfVendaNum ? (
                  <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {nfVendaNum}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>—</div>
                )}
                {row.cnpj_destinatario && (
                  <div style={{ fontSize: 10, color: 'var(--gold)' }}>
                    {CNPJ_MAP[row.cnpj_destinatario] || ''}
                  </div>
                )}
              </div>

              {/* Destinatário — vem do Active (preenchido no drawer) */}
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                ver detalhe
              </div>

              {/* UF */}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                {row.uf_emitente || '—'}
              </div>

              {/* Emissão */}
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                {fmtDate(row.dt_emissao)}
              </div>

              {/* Valor */}
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtBRL(row.valor)}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Badge status={row.status_portal} size="sm" />
              </div>
            </div>
          );
        })}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {total.toLocaleString('pt-BR')} registros · Página {page + 1} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="btn btn-outline btn-sm" style={{ padding: '4px 8px', opacity: page === 0 ? 0.4 : 1 }}>
                <Ic d="M15 18l-6-6 6-6" />
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="btn btn-outline btn-sm" style={{ padding: '4px 8px', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                <Ic d="M9 18l6-6-6-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer de detalhe */}
      {selectedId && (
        <DetalheDrawer
          id={selectedId}
          user={user}
          onClose={() => setSelected(null)}
          onSaved={() => load(filters, page)}
        />
      )}
    </div>
  );
}
