import { useEffect, useRef, useState } from 'react';
import { supabase, syncAuthToken } from '../config/supabase';
import { fmtDateTime } from '../utils.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

// Traduz nomes técnicos de campos para labels legíveis
const CAMPO_LABEL = {
  status_portal:          'Status',
  motivo_devolucao:       'Motivo da devolução',
  area_responsavel:       'Área responsável',
  centro_custo:           'Centro de custo',
  transportador_cobranca: 'Transportador (cobrança)',
  status_cobranca:        'Status de cobrança',
  nf_debito:              'NF de débito',
  lancado_protheus:       'Lançado no Protheus',
  dt_lancamento_protheus: 'Data lançamento Protheus',
  dt_devolucao:           'Data da devolução',
  dt_emissao:             'Data de emissão',
  devolucao_total:        'Devolução total',
  linha_produto:          'Linha de produto',
  retornou_cd:            'Retornou ao CD',
  valor:                  'Valor',
  valor_produtos:         'Valor dos produtos',
  ativo:                  'Ativo',
  role:                   'Perfil de acesso',
  nome:                   'Nome',
  email:                  'E-mail',
  descricao:              'Descrição',
};

const TABELA_LABEL = {
  oobj_nfe_recebidas: 'Devoluções',
  dev_fiscal_anexos:  'Anexos',
  dev_fiscal_usuarios:'Usuários do portal',
};

const ACAO_CFG = {
  insert: { label: 'Criou',   color: '#22c55e', bg: '#22c55e15' },
  update: { label: 'Alterou', color: '#4263EB', bg: '#4263EB15' },
  delete: { label: 'Removeu', color: '#ef4444', bg: '#ef444415' },
};

function fmtValor(v) {
  if (v === null || v === undefined || v === 'null') return <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>vazio</span>;
  if (v === 'true')  return 'Sim';
  if (v === 'false') return 'Não';
  return String(v);
}

function CampoAlterado({ campo, de, para }) {
  const label = CAMPO_LABEL[campo] || campo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-3)', minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-2)', textDecoration: 'line-through', opacity: 0.7 }}>{fmtValor(de)}</span>
      <Ic d="M13 7l5 5m0 0l-5 5m5-5H6" size={11} color="var(--text-3)"/>
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtValor(para)}</span>
    </div>
  );
}

export default function Historico() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dt_inicio: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dt_fim:    new Date().toISOString().slice(0, 10),
    usuario:   '',
    nf_numero: '',
    tabela:    '',
    incluir_sistema: false,
  });
  const [page, setPage] = useState(0);
  const debRef = useRef(null);
  const LIMIT = 60;

  const load = async (f, p = 0) => {
    setLoading(true);
    try {
      syncAuthToken();
      const { data: res, error } = await supabase.rpc('get_audit_log', {
        p_inicio:          f.dt_inicio ? new Date(f.dt_inicio + 'T00:00:00').toISOString() : null,
        p_fim:             f.dt_fim    ? new Date(f.dt_fim    + 'T23:59:59').toISOString() : null,
        p_usuario:         f.usuario   || null,
        p_nf_numero:       f.nf_numero ? parseInt(f.nf_numero, 10) : null,
        p_tabela:          f.tabela    || null,
        p_incluir_sistema: f.incluir_sistema,
        p_limit:           LIMIT,
        p_offset:          p * LIMIT,
      });
      if (error) throw error;
      setData(res);
    } catch (e) {
      console.error('get_audit_log:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filters, 0); }, []); // eslint-disable-line

  const applyFilter = patch => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(0);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(next, 0), 300);
  };

  const goPage = p => { setPage(p); load(filters, p); };

  const kpis    = data?.kpis || {};
  const lista   = data?.lista || [];
  const usuarios= data?.usuarios_disponiveis || [];
  const total   = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Topbar filtros */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={filters.dt_inicio} onChange={e => applyFilter({ dt_inicio: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)' }}/>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>até</span>
        <input type="date" value={filters.dt_fim} onChange={e => applyFilter({ dt_fim: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)' }}/>

        <select value={filters.usuario} onChange={e => applyFilter({ usuario: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)' }}>
          <option value="">Todos os usuários</option>
          {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome || u.email}</option>)}
        </select>

        <select value={filters.tabela} onChange={e => applyFilter({ tabela: e.target.value })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)' }}>
          <option value="">Todas as áreas</option>
          <option value="oobj_nfe_recebidas">Devoluções</option>
          <option value="dev_fiscal_anexos">Anexos</option>
          <option value="dev_fiscal_usuarios">Usuários do portal</option>
        </select>

        <input type="text" placeholder="Nº da NF" value={filters.nf_numero}
          onChange={e => applyFilter({ nf_numero: e.target.value.replace(/\D/g,'') })}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', width: 100 }}/>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', marginLeft: 4 }}>
          <input type="checkbox" checked={filters.incluir_sistema}
            onChange={e => applyFilter({ incluir_sistema: e.target.checked })}/>
          Incluir sincronizações automáticas
        </label>
      </div>

      <div style={{ padding: '18px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ações no período</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{kpis.total_acoes ?? '—'}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Usuários ativos</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{kpis.usuarios_ativos ?? '—'}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>NFDs alteradas</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{kpis.nfds_alteradas ?? '—'}</div>
          </div>
        </div>

        {/* Lista */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
            {total} registro{total !== 1 ? 's' : ''}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Carregando…</div>
          ) : lista.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Nenhuma alteração encontrada no período.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lista.map(item => {
                const acao = ACAO_CFG[item.acao] || ACAO_CFG.update;
                const isSistema = !item.usuario_email;
                return (
                  <div key={item.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 14 }}>
                    <div style={{ flexShrink: 0, width: 110, fontSize: 11, color: 'var(--text-3)', paddingTop: 2 }}>
                      {fmtDateTime(item.criado_em)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          background: acao.bg, color: acao.color,
                        }}>
                          {acao.label}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: isSistema ? 'var(--text-3)' : 'var(--text)' }}>
                          {isSistema ? 'Sistema (sync automático)' : item.usuario_nome}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          em {TABELA_LABEL[item.tabela] || item.tabela}
                        </span>
                        {item.nf_numero && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-alpha)', padding: '1px 7px', borderRadius: 4 }}>
                            NF {item.nf_numero}
                          </span>
                        )}
                      </div>
                      {item.campos_alterados && Object.keys(item.campos_alterados).length > 0 ? (
                        <div style={{ marginTop: 4 }}>
                          {Object.entries(item.campos_alterados).map(([campo, v]) => (
                            <CampoAlterado key={campo} campo={campo} de={v.de} para={v.para}/>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.descricao}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => goPage(Math.max(0, page - 1))} disabled={page === 0}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}>
                ← Anterior
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Página {page + 1} de {totalPages}</span>
              <button onClick={() => goPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1 }}>
                Próxima →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
