import { useEffect, useRef, useState } from 'react';
import { dbGetDevolucaoDetail, dbUpdateStatus, dbGetXmlUrl, dbUpdateMotivo, dbGetMotivos, dbUpdateTransportador, dbSetCentroCustoCliente, dbGetTransportadoras, dbSalvarTransportadora, dbRegistrarHistorico } from '../config/supabase';
import { fmtBRL, fmtDate, fmtDateTime, fmtCNPJ, CNPJ_MAP, STATUS_CFG, Badge, calcFarolProtheus, calcStatusOperacional } from '../utils.jsx';
import AnexosSection from './AnexosSection.jsx';
import HistoricoSection from './HistoricoSection.jsx';
import RetornoCDSection from './RetornoCDSection.jsx';
import StatusOperacionalCard from './StatusOperacionalCard.jsx';

const AREA_CORES = {
  'COMERCIAL':         { color: 'var(--blue)',   bg: 'var(--blue-dim)' },
  'TRANSPORTE':        { color: 'var(--yellow)',  bg: 'var(--yellow-dim)' },
  'QUALIDADE':         { color: 'var(--purple)',  bg: 'var(--purple-dim)' },
  'FISCAL':            { color: 'var(--red)',     bg: 'var(--red-dim)' },
  'LOGÍSTICA REVERSA': { color: 'var(--green)',   bg: 'var(--green-dim)' },
  'LOGÍSTICA':         { color: 'var(--green)',   bg: 'var(--green-dim)' },
  'CONTROLADORIA':     { color: '#0891B2',        bg: 'rgba(8,145,178,0.10)' },
  'TI':                { color: '#0EA5E9',        bg: 'rgba(14,165,233,0.10)' },
  'CUSTOMER SERVICE':  { color: '#DB2777',        bg: 'rgba(219,39,119,0.10)' },
  'A VALIDAR':         { color: 'var(--text-3)',  bg: 'var(--surface-3)' },
};
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

const Ic = ({ d, size = 14, color = 'currentColor', w = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);
const ICO = {
  x:        'M18 6L6 18M6 6l12 12',
  check:    'M20 6L9 17l-5-5',
  alerta:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  relogio:  'M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clipe:    'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
  alvo:     'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  baixar:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  etiqueta: 'M7 8h10M7 12h6',
  caminhao: 'M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z',
  predio:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  seta:     'M9 18l6-6-6-6',
};

const titulo = (s) => !s ? '' : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/* ─── Autocomplete de motivo ───────────────────────────── */
function MotivoAutocomplete({ value, onChange, motivos }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen]   = useState(false);

  const filtrados = query.length >= 1
    ? motivos.filter(m => m.motivo.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : motivos.slice(0, 12);

  return (
    <div style={{ position: 'relative' }}>
      <input type="text" value={query} autoComplete="off" className="input" style={{ paddingRight: 28 }}
        placeholder="Digite para filtrar os motivos"
        onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}/>
      {value && (
        <button onClick={() => { onChange(''); setQuery(''); }} aria-label="Limpar motivo"
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
          <Ic d={ICO.x} size={12}/>
        </button>
      )}
      {open && filtrados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, marginTop: 3,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-md)', maxHeight: 260, overflowY: 'auto' }}>
          {filtrados.map((m, i) => {
            const cfg = AREA_CORES[m.area] || { color: 'var(--text-2)', bg: 'var(--surface-3)' };
            return (
              <div key={m.motivo} onMouseDown={() => { onChange(m.motivo); setQuery(m.motivo); setOpen(false); }}
                style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 10,
                  background: m.motivo === value ? 'var(--blue-dim)' : 'transparent',
                  borderBottom: i < filtrados.length - 1 ? '1px solid var(--border)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = m.motivo === value ? 'var(--blue-dim)' : 'transparent'}>
                <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: m.motivo === value ? 700 : 400 }}>{m.motivo}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
                  padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{m.area}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Blocos de leitura ────────────────────────────────── */
function Bloco({ titulo: t, acao, children, aberto }) {
  if (aberto !== undefined) {
    return (
      <details className="dd-bloco dd-detalhes" open={aberto}>
        <summary>
          <Ic d={ICO.seta} size={12} color="var(--text-3)" />
          {t}
        </summary>
        <div className="dd-bloco-corpo">{children}</div>
      </details>
    );
  }
  return (
    <section className="dd-bloco">
      <div className="dd-bloco-topo">
        <span className="dd-bloco-titulo">{t}</span>
        {acao}
      </div>
      <div className="dd-bloco-corpo">{children}</div>
    </section>
  );
}
function Linha({ label, children, onEditar, editarLabel = 'Editar' }) {
  return (
    <div className="dd-linha">
      <dt>{label}</dt>
      <dd>
        {children}
        {onEditar && <button className="dd-editar" onClick={onEditar}>{editarLabel}</button>}
      </dd>
    </div>
  );
}
const Vazio = ({ children = 'Não informado' }) => <span className="dd-vazio">{children}</span>;

function ValorLinha({ label, value, forte }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: forte ? '11px 0 2px' : '7px 0',
      borderBottom: forte ? 'none' : '1px solid var(--border)',
      borderTop: forte ? '2px solid var(--border)' : 'none', marginTop: forte ? 4 : 0 }}>
      <span style={{ fontSize: forte ? 12 : 11.5, color: forte ? 'var(--text-2)' : 'var(--text-3)', fontWeight: forte ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: forte ? 17 : 12.5, color: 'var(--text)', fontWeight: forte ? 800 : 600,
        fontVariantNumeric: 'tabular-nums', letterSpacing: forte ? '-0.01em' : undefined }}>{fmtBRL(value)}</span>
    </div>
  );
}

/* ═══ Componente principal ═════════════════════════════ */
export default function DetalheDrawer({ id, user, onClose, onSaved }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba]         = useState('resumo');
  const [nAnexos, setNAnexos] = useState(null);

  const [editStatus, setEdit]     = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [obs, setObs]             = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');

  const [editMotivo, setEditMotivo]     = useState(false);
  const [motivo, setMotivo]             = useState('');
  const [savingMotivo, setSavingMotivo] = useState(false);
  const [motivosDB, setMotivosDB]       = useState([]);

  const [editTransp, setEditTransp]     = useState(false);
  const [transpNome, setTranspNome]     = useState('');
  const [transpCnpj, setTranspCnpj]     = useState('');
  const [savingTransp, setSavingTransp] = useState(false);
  const [transpErr, setTranspErr]       = useState('');
  const [transportadoras, setTransportadoras] = useState([]);
  const [transpSearch, setTranspSearch] = useState('');
  const [transpCustom, setTranspCustom] = useState(false);

  const [editCC, setEditCC]     = useState(false);
  const [ccValor, setCcValor]   = useState('');
  const [savingCC, setSavingCC] = useState(false);
  const [ccErr, setCcErr]       = useState('');
  const [ccResult, setCcResult] = useState(null);

  const editorRef = useRef(null);
  const editando = editStatus || editMotivo || editTransp || editCC;
  const fecharEditores = () => { setEdit(false); setEditMotivo(false); setEditTransp(false); setEditCC(false); };
  const abrirEditor = (qual) => {
    fecharEditores(); setCcResult(null);
    if (qual === 'status') setEdit(true);
    if (qual === 'motivo') setEditMotivo(true);
    if (qual === 'transp') setEditTransp(true);
    if (qual === 'cc')     setEditCC(true);
    setTimeout(() => editorRef.current?.scrollIntoView({ block: 'nearest' }), 30);
  };

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { if (editando) fecharEditores(); else onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, editando]);

  useEffect(() => {
    dbGetMotivos().then(setMotivosDB);
    dbGetTransportadoras().then(setTransportadoras);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setData(null); setAba('resumo'); setNAnexos(null); fecharEditores(); // eslint-disable-line react-hooks/set-state-in-effect
    dbGetDevolucaoDetail(id).then(d => {
      setData(d);
      setNewStatus(d?.dev?.status_portal || '');
      setMotivo(d?.dev?.motivo_devolucao || '');
      setTranspNome(d?.dev?.transportador_cobranca || '');
      setTranspCnpj(d?.dev?.transportador_cnpj_cobranca || '');
      setCcValor(d?.dev?.centro_custo || '');
      setCcResult(null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const dev  = data?.dev;
  const nfV  = data?.nfVenda;
  const hist = dev?.raw_json?.obs_historico || [];

  const handleSaveTransp = async () => {
    setSavingTransp(true); setTranspErr('');
    try {
      const cnpjClean = transpCnpj.replace(/\D/g, '');
      await dbUpdateTransportador(id, { nome: transpNome.trim(), cnpj: cnpjClean });
      await dbRegistrarHistorico(id, {
        tipo: 'transportador', campo: 'transportador_cobranca',
        valor_anterior: dev?.transportador_cobranca || null,
        valor_novo: transpNome.trim(),
        usuario: user?.name || user?.email,
      });
      if (cnpjClean && !transportadoras.find(t => t.cnpj === cnpjClean)) {
        await dbSalvarTransportadora({ cnpj: cnpjClean, nome: transpNome.trim() });
        setTransportadoras(await dbGetTransportadoras());
      }
      setData(prev => ({ ...prev, dev: { ...prev.dev,
        transportador_cobranca: transpNome.trim(), transportador_cnpj_cobranca: cnpjClean } }));
      setEditTransp(false); setTranspSearch(''); setTranspCustom(false); onSaved?.();
    } catch (e) { setTranspErr(e.message); }
    finally { setSavingTransp(false); }
  };

  const handleSaveCC = async (apenasEsta = false) => {
    setSavingCC(true); setCcErr(''); setCcResult(null);
    try {
      const res = await dbSetCentroCustoCliente({
        cnpj_emitente: dev.cnpj_emitente, nome_emitente: dev.nome_emitente,
        centro_custo: ccValor, usuario: user?.name || user?.email || '',
        apenas_esta_nfd: apenasEsta ? id : null,
      });
      await dbRegistrarHistorico(id, {
        tipo: 'centro_custo', campo: 'centro_custo',
        valor_anterior: dev?.centro_custo || null,
        valor_novo: ccValor + (res.regra_salva ? ` (aplicado a ${res.nfds_atualizadas} notas)` : ''),
        usuario: user?.name || user?.email,
      });
      setData(prev => ({ ...prev, dev: { ...prev.dev, centro_custo: ccValor } }));
      setCcResult(res); onSaved?.();
    } catch (e) { setCcErr(e.message); }
    finally { setSavingCC(false); }
  };

  const handleSaveMotivo = async () => {
    setSavingMotivo(true);
    try {
      const areaMotivo = motivosDB.find(m => m.motivo === motivo)?.area || null;
      await dbUpdateMotivo(id, {
        motivo_devolucao: motivo,
        devolucao_total: dev?.lancamento_manual ? true : false,
        area_responsavel: areaMotivo,
      });
      await dbRegistrarHistorico(id, {
        tipo: 'motivo', campo: 'motivo_devolucao',
        valor_anterior: dev?.motivo_devolucao || null,
        valor_novo: motivo + (areaMotivo ? ` (${areaMotivo})` : ''),
        usuario: user?.name || user?.email,
      });
      setData(prev => ({ ...prev, dev: { ...prev.dev, motivo_devolucao: motivo, area_responsavel: areaMotivo } }));
      setEditMotivo(false); onSaved?.();
    } catch (e) { alert(e.message); }
    finally { setSavingMotivo(false); }
  };

  const handleSaveStatus = async () => {
    setSaveErr(''); setSaving(true);
    try {
      await dbUpdateStatus(id, newStatus || null, obs, user?.name || user?.email || '');
      await dbRegistrarHistorico(id, {
        tipo: 'status', campo: 'status_portal',
        valor_anterior: dev?.status_portal || null,
        valor_novo: newStatus || null,
        usuario: user?.name || user?.email,
      });
      setData(prev => ({ ...prev, dev: { ...prev.dev, status_portal: newStatus || null } }));
      setEdit(false); setObs(''); onSaved?.();
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const handleXml = async () => {
    try { const url = await dbGetXmlUrl(dev.xml_path); if (url) window.open(url, '_blank'); }
    catch (e) { alert('Erro ao abrir o XML: ' + e.message); }
  };

  const farol  = dev ? calcFarolProtheus(dev) : null;
  const stOp   = dev ? calcStatusOperacional(dev) : null;
  const cfgOp  = STATUS_OP_CFG[stOp] || STATUS_OP_CFG['AGENDAR REVERSA'];
  const cfgArea = AREA_CORES[dev?.area_responsavel] || { color: 'var(--text-3)', bg: 'var(--surface-3)' };
  const nItens = Array.isArray(dev?.itens) ? dev.itens.length : 0;

  const ABAS = [
    { k: 'resumo',    l: 'Resumo' },
    { k: 'itens',     l: 'Itens',      n: nItens || null },
    { k: 'cd',        l: 'Retorno ao CD' },
    { k: 'anexos',    l: 'Anexos',     n: nAnexos || null },
    { k: 'historico', l: 'Histórico' },
  ];

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={{ width: 720 }} role="dialog" aria-label="Detalhe da devolução">

        {/* ── Cabeçalho ───────────────────────────────── */}
        <div className="dd-topo">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Carregando…</div>
              ) : (
                <>
                  <div className="dd-eyebrow">
                    {dev?.lancamento_manual ? 'Devolução total · lançamento manual' : 'Devolução parcial · NFD do cliente'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '5px 0 6px' }}>
                    <span className="dd-titulo">NF-e {dev?.nf_numero ?? '—'}</span>
                    {dev?.nf_serie && <span className="dd-sub-2">Série {dev.nf_serie}</span>}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                      background: cfgOp.bg, color: cfgOp.fg }}>{cfgOp.l}</span>
                  </div>
                  <div className="dd-sub">{dev?.nome_emitente}</div>
                  <div className="dd-sub-2" style={{ marginTop: 2 }}>
                    {[dev?.municipio_emitente && `${dev.municipio_emitente} / ${dev.uf_emitente || ''}`,
                      dev?.cnpj_emitente && fmtCNPJ(dev.cnpj_emitente)].filter(Boolean).join(' · ')}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="dd-close" aria-label="Fechar">
              <Ic d={ICO.x} size={16}/>
            </button>
          </div>

          {!loading && dev && (
            <div className="dd-fatos">
              <div className="dd-fato">
                <span className="dd-fato-label">Valor devolvido</span>
                <span className="dd-fato-valor" style={{ fontSize: 16 }}>{fmtBRL(dev.valor)}</span>
              </div>
              <div className="dd-fato" style={{ flex: 1 }}>
                <span className="dd-fato-label">Motivo</span>
                <span className="dd-fato-valor" style={{ fontWeight: 600, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  color: dev.motivo_devolucao ? '#fff' : 'rgba(255,255,255,0.40)' }}
                  title={dev.motivo_devolucao || ''}>
                  {dev.motivo_devolucao ? titulo(dev.motivo_devolucao) : 'A classificar'}
                </span>
              </div>
              <div className="dd-fato">
                <span className="dd-fato-label">Prazo de 90 dias</span>
                <span className="dd-fato-valor" style={{ whiteSpace: 'nowrap',
                  color: dev.lancado_protheus ? '#6EE7A8'
                    : farol.cor === 'vermelho' ? '#FCA5A5'
                    : farol.cor === 'amarelo' ? '#FCD34D' : 'rgba(255,255,255,0.85)' }}>
                  {dev.lancado_protheus ? 'Encerrado'
                    : farol.cor === 'sem_data' ? '—'
                    : farol.diasRestantes > 0 ? `${farol.diasRestantes} dias` : `${Math.abs(farol.diasRestantes)} d em atraso`}
                </span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            color: 'var(--text-3)', fontSize: 13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
              style={{ animation: 'spin 0.9s linear infinite' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Carregando…
          </div>
        ) : !dev ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--red)', fontSize: 13 }}>Não foi possível carregar os dados desta nota.</div>
        ) : (
          <>
            {/* ── Abas ─────────────────────────────────── */}
            <div className="dd-abas" role="tablist">
              {ABAS.map(a => (
                <button key={a.k} role="tab" aria-selected={aba === a.k} className="dd-aba"
                  onClick={() => setAba(a.k)}>
                  {a.l}{a.n ? <span className="dd-aba-n">{a.n}</span> : null}
                </button>
              ))}
            </div>

            {/* ── Editor ───────────────────────────────── */}
            {editando && (
              <div className="dd-editor" ref={editorRef}>
                {editStatus && (
                  <div>
                    <div className="dd-editor-titulo"><Ic d={ICO.alvo} size={12}/> Status da evidência</div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      {[{ v: 'evidencia_solicitada', l: 'Evidência solicitada', dot: '#D97706', bg: '#FFFBEB', cor: '#92400E' },
                        { v: 'evidencia_anexada',    l: 'Evidência anexada',    dot: '#16A34A', bg: '#F0FDF4', cor: '#14532D' }].map(opt => (
                        <button key={opt.v} onClick={() => setNewStatus(opt.v)}
                          style={{ flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                            border: `2px solid ${newStatus === opt.v ? opt.dot : 'var(--border)'}`,
                            background: newStatus === opt.v ? opt.bg : 'var(--surface-2)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.dot }}/>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: newStatus === opt.v ? opt.cor : 'var(--text-2)' }}>{opt.l}</span>
                        </button>
                      ))}
                    </div>
                    {saveErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{saveErr}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEdit(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                      <button onClick={handleSaveStatus} disabled={saving || !newStatus} className="btn btn-primary btn-sm">
                        {saving ? 'Salvando…' : 'Confirmar'}
                      </button>
                      {dev.status_portal && (
                        <button onClick={async () => { setNewStatus(''); await handleSaveStatus(); }}
                          className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>
                          Limpar status
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {editMotivo && (
                  <div>
                    <div className="dd-editor-titulo"><Ic d={ICO.etiqueta} size={12}/> Motivo da devolução</div>
                    <div style={{ marginBottom: 12 }}>
                      <MotivoAutocomplete key={dev.id} value={motivo} onChange={setMotivo} motivos={motivosDB}/>
                      {motivo && motivosDB.find(m => m.motivo === motivo) && (() => {
                        const area = motivosDB.find(m => m.motivo === motivo)?.area;
                        const cfg = AREA_CORES[area] || { color: 'var(--text-2)', bg: 'var(--surface-3)' };
                        return (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Área responsável</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
                              padding: '2px 8px', borderRadius: 20 }}>{area}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditMotivo(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                      <button onClick={handleSaveMotivo} disabled={savingMotivo || !motivo} className="btn btn-primary btn-sm">
                        {savingMotivo ? 'Salvando…' : 'Salvar motivo'}
                      </button>
                    </div>
                  </div>
                )}

                {editTransp && (
                  <div>
                    <div className="dd-editor-titulo">
                      <Ic d={ICO.caminhao} size={12}/>
                      {dev.transportador_cobranca ? 'Trocar transportador' : 'Vincular transportador'}
                    </div>
                    {!transpCustom ? (
                      <>
                        <input type="text" autoFocus value={transpSearch} onChange={e => setTranspSearch(e.target.value)}
                          className="input" placeholder="Buscar transportadora pelo nome" style={{ marginBottom: 10 }}/>
                        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)',
                          borderRadius: 8, marginBottom: 10 }}>
                          {transportadoras
                            .filter(t => !transpSearch || t.nome.toLowerCase().includes(transpSearch.toLowerCase()) || (t.nome_curto || '').toLowerCase().includes(transpSearch.toLowerCase()))
                            .map(t => (
                              <div key={t.cnpj} onClick={() => { setTranspNome(t.nome); setTranspCnpj(t.cnpj); setTranspSearch(''); }}
                                style={{ padding: '9px 13px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                  background: transpNome === t.nome ? 'var(--blue-dim)' : 'transparent' }}
                                onMouseEnter={e => { if (transpNome !== t.nome) e.currentTarget.style.background = 'var(--surface-2)'; }}
                                onMouseLeave={e => { if (transpNome !== t.nome) e.currentTarget.style.background = 'transparent'; }}>
                                <div style={{ fontSize: 12.5, fontWeight: transpNome === t.nome ? 700 : 500, color: 'var(--text)',
                                  display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {t.nome}
                                  {transpNome === t.nome && <Ic d={ICO.check} size={12} color="var(--blue)" w={3}/>}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{fmtCNPJ(t.cnpj)}</div>
                              </div>
                            ))}
                          {transportadoras.filter(t => !transpSearch || t.nome.toLowerCase().includes(transpSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-3)' }}>Nenhuma transportadora encontrada.</div>
                          )}
                        </div>
                        {transpNome && (
                          <div style={{ padding: '8px 12px', background: 'var(--blue-dim)', borderRadius: 8,
                            marginBottom: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--blue)' }}>
                            Selecionada: {transpNome}
                          </div>
                        )}
                        {transpErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{transpErr}</div>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => { setEditTransp(false); setTranspSearch('');
                              setTranspNome(dev.transportador_cobranca || ''); setTranspCnpj(dev.transportador_cnpj_cobranca || ''); }}>
                            Cancelar
                          </button>
                          <button onClick={handleSaveTransp} disabled={savingTransp || !transpNome.trim()} className="btn btn-primary btn-sm">
                            {savingTransp ? 'Salvando…' : 'Confirmar'}
                          </button>
                          <button onClick={() => setTranspCustom(true)} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                            Cadastrar nova
                          </button>
                          {dev.transportador_cobranca && (
                            <button onClick={() => { setTranspNome(''); setTranspCnpj(''); handleSaveTransp(); }}
                              className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}>Remover vínculo</button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginBottom: 10, padding: '8px 12px',
                          background: 'var(--surface-2)', borderRadius: 8, lineHeight: 1.5 }}>
                          A transportadora cadastrada aqui fica disponível para todas as notas.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label className="input-label">Razão social</label>
                            <input type="text" autoFocus value={transpNome} onChange={e => setTranspNome(e.target.value)}
                              className="input" placeholder="Ex.: Fast Solution Logística Ltda"/>
                          </div>
                          <div>
                            <label className="input-label">CNPJ</label>
                            <input type="text" value={transpCnpj} onChange={e => setTranspCnpj(e.target.value)}
                              className="input" placeholder="Só números" maxLength={14}/>
                          </div>
                        </div>
                        {transpErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{transpErr}</div>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setTranspCustom(false)} className="btn btn-ghost btn-sm">Voltar</button>
                          <button onClick={handleSaveTransp} disabled={savingTransp || !transpNome.trim() || !transpCnpj.trim()}
                            className="btn btn-primary btn-sm">
                            {savingTransp ? 'Salvando…' : 'Cadastrar e vincular'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {editCC && (
                  <div>
                    <div className="dd-editor-titulo"><Ic d={ICO.predio} size={12}/> Centro de custo</div>
                    {ccResult ? (
                      <div style={{ padding: '12px 14px', background: 'var(--green-dim)', borderRadius: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', marginBottom: 4,
                          display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Ic d={ICO.check} size={13} w={3}/> Centro de custo salvo: {titulo(ccValor)}
                        </div>
                        {ccResult.regra_salva && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                            Aplicado em <strong>{ccResult.nfds_atualizadas}</strong> {ccResult.nfds_atualizadas === 1 ? 'nota' : 'notas'} de <strong>{dev.nome_emitente}</strong>.
                            As próximas devoluções deste cliente entram classificadas.
                          </div>
                        )}
                        <button onClick={() => { setEditCC(false); setCcResult(null); }} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>Fechar</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <label className="input-label">Centro de custo</label>
                          <select value={ccValor} onChange={e => setCcValor(e.target.value)} className="input" autoFocus>
                            <option value="">Selecione</option>
                            {['CANAL INDIRETO','CASH & CARRY','FARMA KEY ACCOUNT','KEY ACCOUNT','CANAL DIRETO','NOVOS NEGÓCIOS','ECOMMERCE','CANAL VERDE','EIC']
                              .map(cc => <option key={cc} value={cc}>{titulo(cc)}</option>)}
                          </select>
                        </div>
                        {ccErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{ccErr}</div>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => setEditCC(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                          <button onClick={() => handleSaveCC(false)} disabled={savingCC || !ccValor} className="btn btn-primary btn-sm">
                            {savingCC ? 'Salvando…' : 'Salvar para todas as notas deste cliente'}
                          </button>
                          <button onClick={() => handleSaveCC(true)} disabled={savingCC || !ccValor} className="btn btn-outline btn-sm">
                            Só esta nota
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Corpo ────────────────────────────────── */}
            <div className="dd-corpo">

              {aba === 'resumo' && (
                <>
                  <StatusOperacionalCard key={dev.id + (dev.status_operacional || '')} dev={dev} user={user}
                    onChanged={(v) => { setData(d => ({ ...d, dev: { ...d.dev, status_operacional: v,
                      status_operacional_por: user?.name || user?.email, status_operacional_em: new Date().toISOString() } })); onSaved?.(); }}/>

                  {dev.validacao_fiscal?.status === 'divergente' && (
                    <section className="dd-bloco" style={{ borderColor: 'rgba(220,38,38,0.35)' }}>
                      <div className="dd-bloco-topo" style={{ color: 'var(--red)' }}>
                        <span className="dd-bloco-titulo" style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Ic d={ICO.alerta} size={13} color="var(--red)"/>
                          {dev.validacao_fiscal.issues?.length === 1 ? 'Divergência fiscal nos valores' : `${dev.validacao_fiscal.issues?.length} divergências fiscais nos valores`}
                        </span>
                      </div>
                      <div className="dd-bloco-corpo">
                        {dev.validacao_fiscal.issues?.map((iss, i) => (
                          <div key={i} style={{ padding: '9px 0', borderBottom: i < dev.validacao_fiscal.issues.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{iss.descricao}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                              Esperado {fmtBRL(iss.esperado)} · encontrado {fmtBRL(iss.encontrado)}
                            </div>
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 10, lineHeight: 1.5 }}>
                          Conferência automática da consistência interna do XML. Não substitui a análise do time fiscal.
                        </div>
                      </div>
                    </section>
                  )}

                  <Bloco titulo="Classificação">
                    <dl style={{ margin: 0 }}>
                      <Linha label="Motivo" onEditar={() => abrirEditor('motivo')}
                        editarLabel={dev.motivo_devolucao ? 'Editar' : 'Classificar'}>
                        {dev.motivo_devolucao ? titulo(dev.motivo_devolucao) : <Vazio>Sem motivo classificado</Vazio>}
                      </Linha>
                      <Linha label="Área responsável">
                        {dev.area_responsavel
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: cfgArea.color, background: cfgArea.bg,
                              padding: '2px 9px', borderRadius: 20 }}>{dev.area_responsavel}</span>
                          : <Vazio>Definida pelo motivo</Vazio>}
                      </Linha>
                      <Linha label="Centro de custo" onEditar={() => abrirEditor('cc')}
                        editarLabel={dev.centro_custo ? 'Mudar' : 'Vincular'}>
                        {dev.centro_custo ? titulo(dev.centro_custo) : <Vazio/>}
                      </Linha>
                      <Linha label="Transportador" onEditar={() => abrirEditor('transp')}
                        editarLabel={dev.transportador_cobranca ? 'Trocar' : 'Vincular'}>
                        {dev.transportador_cobranca
                          ? <span>{dev.transportador_cobranca}
                              {dev.transportador_cnpj_cobranca && (
                                <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {fmtCNPJ(dev.transportador_cnpj_cobranca)}</span>
                              )}
                            </span>
                          : <Vazio>Não identificado</Vazio>}
                      </Linha>
                      <Linha label="Linha de produto">
                        {dev.linha_produto
                          ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                              color: dev.linha_produto === 'CHOCOLATE' ? 'var(--yellow)' : 'var(--green)',
                              background: dev.linha_produto === 'CHOCOLATE' ? 'var(--yellow-dim)' : 'var(--green-dim)' }}>
                              {titulo(dev.linha_produto)}
                            </span>
                          : <Vazio/>}
                      </Linha>
                      <Linha label="Evidência" onEditar={() => abrirEditor('status')}
                        editarLabel={dev.status_portal ? 'Alterar' : 'Marcar'}>
                        {dev.status_portal ? <Badge status={dev.status_portal}/> : <Vazio>Nada marcado</Vazio>}
                      </Linha>
                    </dl>
                  </Bloco>

                  <Bloco titulo="Valores da nota">
                    <ValorLinha label="Produtos" value={dev.valor_produtos}/>
                    <ValorLinha label="ICMS" value={dev.valor_icms}/>
                    <ValorLinha label="ICMS-ST" value={dev.valor_st}/>
                    <ValorLinha label="Total da NF" value={dev.valor} forte/>
                  </Bloco>

                  <Bloco titulo="Prazo e lançamento no Protheus">
                    <dl style={{ margin: 0 }}>
                      <Linha label="Emissão da NFD">
                        {fmtDate(dev.dt_emissao)}
                        {dev.flag_emissao_entrega === 'divergente' && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--yellow)',
                            background: 'var(--yellow-dim)', padding: '2px 8px', borderRadius: 20 }}>
                            Divergente da entrega
                          </span>
                        )}
                        {dev.flag_emissao_entrega === 'no_ato' && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)',
                            background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 20 }}>
                            No ato da entrega
                          </span>
                        )}
                        {dev.flag_emissao_entrega === 'aguardando_entrega' && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)',
                            background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 20 }}>
                            Aguardando entrega
                          </span>
                        )}
                      </Linha>
                      {dev.lancamento_manual && dev.dt_devolucao && (
                        <Linha label="Data da devolução">
                          <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmtDate(dev.dt_devolucao)}</span>
                        </Linha>
                      )}
                      <Linha label="Lançada no Protheus">
                        {dev.lancado_protheus
                          ? <span style={{ color: 'var(--green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Ic d={ICO.check} size={13} w={3}/>
                              {dev.dt_lancamento_protheus ? `Sim, em ${fmtDate(dev.dt_lancamento_protheus)}` : 'Sim'}
                            </span>
                          : <Vazio>Ainda não lançada</Vazio>}
                      </Linha>
                      {!dev.lancado_protheus && farol.cor !== 'sem_data' && (
                        <Linha label="Prazo de 90 dias">
                          <span className="dv-barra" style={{ width: 90 }}>
                            <i style={{ display: 'block', height: '100%', borderRadius: 2,
                              width: `${Math.max(0, Math.min(100, (farol.dias / 90) * 100))}%`,
                              background: farol.cor === 'vermelho' ? 'var(--red)' : farol.cor === 'amarelo' ? 'var(--yellow)' : 'var(--green)' }}/>
                          </span>
                          <span style={{ fontWeight: 700,
                            color: farol.cor === 'vermelho' ? 'var(--red)' : farol.cor === 'amarelo' ? 'var(--yellow)' : 'var(--text-2)' }}>
                            {farol.diasRestantes > 0 ? `${farol.diasRestantes} dias restantes` : `${Math.abs(farol.diasRestantes)} dias em atraso`}
                          </span>
                          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {farol.dias} de 90 usados</span>
                        </Linha>
                      )}
                    </dl>
                  </Bloco>

                  {nfV ? (
                    <Bloco titulo="NF original de venda" acao={
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--blue-dim)', color: 'var(--blue)',
                        padding: '2px 8px', borderRadius: 20 }}>
                        {nfV.fonte === 'active_webhooks' ? 'Active OnSupply' : 'Histórico de NFs'}
                      </span>
                    }>
                      <dl style={{ margin: 0 }}>
                        <Linha label="NF / série">{`${nfV.nf_numero ?? '—'}${nfV.nf_serie ? ` · série ${nfV.nf_serie}` : ''}`}</Linha>
                        <Linha label="Emissão e entrega">
                          {fmtDate(nfV.dt_emissao)}
                          {nfV.dt_entrega && <span style={{ color: 'var(--green)', fontWeight: 600 }}>entregue em {fmtDate(nfV.dt_entrega)}</span>}
                        </Linha>
                        <Linha label="Valor da venda">
                          <span style={{ fontWeight: 700 }}>{fmtBRL(nfV.valor_produtos)}</span>
                        </Linha>
                        <Linha label="Destinatário">
                          {nfV.destinatario_nome}
                          {nfV.destinatario_cnpj && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {fmtCNPJ(nfV.destinatario_cnpj)}</span>}
                        </Linha>
                        <Linha label="Destino">{[nfV.cidade_destino, nfV.uf_destino].filter(Boolean).join(' / ') || <Vazio/>}</Linha>
                        <Linha label="Pedido">{nfV.pedido || <Vazio/>}</Linha>
                        {nfV.nf_chave && <Linha label="Chave da NF de venda"><span className="dd-chave" style={{ padding: '5px 8px' }}>{nfV.nf_chave}</span></Linha>}
                      </dl>
                    </Bloco>
                  ) : dev.chave_nfe_referenciada ? (
                    <Bloco titulo="NF original de venda">
                      <div style={{ padding: '10px 0 12px', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
                        {(() => {
                          const aamm = dev.chave_nfe_referenciada?.substring(2, 6);
                          const ano = aamm ? `20${aamm.substring(0, 2)}` : null;
                          return ano && parseInt(ano) < 2026
                            ? `A NF de venda foi emitida em ${ano}, antes da integração com o Active OnSupply, por isso não está no portal.`
                            : 'A NF de venda não foi localizada no Active OnSupply.';
                        })()}
                      </div>
                      <div className="dd-chave">{dev.chave_nfe_referenciada}</div>
                    </Bloco>
                  ) : null}

                  {dev.inf_complementar && (
                    <Bloco titulo="Observação da NFD (XML)">
                      <div style={{ padding: '8px 0 4px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {dev.inf_complementar}
                      </div>
                    </Bloco>
                  )}

                  <Bloco titulo="Dados fiscais da nota" aberto={false}>
                    <dl style={{ margin: 0 }}>
                      <Linha label="Natureza da operação">{dev.nat_operacao || <Vazio/>}</Linha>
                      <Linha label="CFOPs">
                        {(dev.cfops || []).length
                          ? (dev.cfops || []).map(c => (
                              <span key={c} style={{ background: 'var(--gold-dim)', color: 'var(--gold)',
                                border: '1px solid rgba(154,123,79,0.25)', padding: '1px 7px', borderRadius: 4,
                                fontSize: 11.5, fontWeight: 700 }}>{c}</span>
                            ))
                          : <Vazio/>}
                      </Linha>
                      <Linha label="Tipo de devolução">
                        {dev.lancamento_manual
                          ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>Total — lançamento manual</span>
                          : <span style={{ color: 'var(--text)', fontWeight: 600 }}>Parcial — NFD do cliente</span>}
                      </Linha>
                      <Linha label="Empresa destino">
                        {CNPJ_MAP[dev.cnpj_destinatario] || fmtCNPJ(dev.cnpj_destinatario) || <Vazio/>}
                      </Linha>
                      <Linha label="Emitente">
                        {dev.nome_emitente}
                        {dev.cnpj_emitente && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {fmtCNPJ(dev.cnpj_emitente)}</span>}
                      </Linha>
                      {dev.chave_nfe && !String(dev.chave_nfe).startsWith('MANUAL-') && (
                        <Linha label="Chave de acesso"><span className="dd-chave" style={{ padding: '5px 8px' }}>{dev.chave_nfe}</span></Linha>
                      )}
                    </dl>
                  </Bloco>
                </>
              )}

              {aba === 'itens' && (
                nItens > 0 ? (
                  <Bloco titulo={`Itens devolvidos`} acao={
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                      Total {fmtBRL(dev.itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0))}
                    </span>
                  }>
                    <div style={{ overflowX: 'auto', marginTop: 4 }}>
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th>Código</th><th>Produto</th><th>CFOP</th>
                            <th style={{ textAlign: 'right' }}>Qtd</th>
                            <th style={{ textAlign: 'right' }}>Vl. unit.</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dev.itens.map((it, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{it.codigo || '—'}</td>
                              <td style={{ fontWeight: 500 }} title={it.descricao}>{it.descricao}</td>
                              <td style={{ width: 54 }}>
                                {it.cfop && <span style={{ background: 'var(--gold-dim)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>{it.cfop}</span>}
                              </td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {it.quantidade} <span style={{ color: 'var(--text-3)' }}>{it.unidade}</span>
                              </td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                                {it.valor_unitario != null ? fmtBRL(it.valor_unitario) : '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(it.valor_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: 'var(--surface-2)' }}>
                            <td colSpan={5} style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>Total devolvido</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--blue)', fontSize: 13 }}>
                              {fmtBRL(dev.itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Bloco>
                ) : (
                  <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    Esta nota não tem itens detalhados.
                    {!dev.xml_baixado && <div style={{ marginTop: 6, fontSize: 12 }}>O XML ainda não foi lido pelo portal.</div>}
                  </div>
                )
              )}

              {aba === 'cd' && <RetornoCDSection dev={dev}/>}
              {aba === 'anexos' && <AnexosSection devolucaoId={id} user={user} onCount={setNAnexos}/>}

              {aba === 'historico' && (
                <>
                  <HistoricoSection devolucaoId={id}/>
                  {hist.length > 0 && (
                    <Bloco titulo="Histórico de evidência">
                      <div style={{ paddingTop: 8 }}>
                        {[...hist].reverse().map((h, i) => {
                          const cfg = STATUS_CFG[h.status] || {};
                          return (
                            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                                background: cfg.dot || 'var(--border-2)', border: `2px solid ${cfg.border || 'var(--border)'}` }}/>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                                  {cfg.l || h.status}
                                  <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 8, fontSize: 11.5 }}>
                                    {h.user && `${h.user} · `}{fmtDateTime(h.ts)}
                                  </span>
                                </div>
                                {h.obs && <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 2 }}>{h.obs}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Bloco>
                  )}
                </>
              )}
            </div>

            {/* ── Ações ────────────────────────────────── */}
            <div className="dd-rodape">
              <button onClick={() => { setAba('anexos'); setTimeout(() => document.getElementById('btn-add-anexo')?.click(), 120); }}
                className="btn btn-primary btn-sm">
                <Ic d={ICO.clipe} size={13}/> Anexar evidência
              </button>
              <button onClick={() => abrirEditor('status')} className={`btn btn-sm ${editStatus ? 'btn-primary' : 'btn-outline'}`}>
                <Ic d={ICO.alvo} size={13}/> {dev.status_portal ? 'Alterar evidência' : 'Marcar evidência'}
              </button>
              {!dev.motivo_devolucao && (
                <button onClick={() => abrirEditor('motivo')} className={`btn btn-sm ${editMotivo ? 'btn-primary' : 'btn-outline'}`}>
                  <Ic d={ICO.etiqueta} size={13}/> Classificar motivo
                </button>
              )}
              <div style={{ flex: 1 }}/>
              {dev.xml_path && (
                <button onClick={handleXml} className="btn btn-ghost btn-sm" title="Abrir o XML da NFD">
                  <Ic d={ICO.baixar} size={13}/> XML
                </button>
              )}
              <button onClick={onClose} className="btn btn-ghost btn-sm">Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
