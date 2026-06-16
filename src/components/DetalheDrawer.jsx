import { useEffect, useState } from 'react';
import { dbGetDevolucaoDetail, dbUpdateStatus, dbGetXmlUrl, dbUpdateMotivo, dbGetMotivos, dbUpdateTransportador } from '../config/supabase';
import { fmtBRL, fmtDate, fmtDateTime, fmtCNPJ, CNPJ_MAP, STATUS_CFG, STATUS_OPTIONS, Badge } from '../utils.jsx';
import AnexosSection from './AnexosSection.jsx';

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

// Autocomplete de motivo com busca por digitação
function MotivoAutocomplete({ value, onChange, motivos }) {
  const [query, setQuery]   = useState(value || '');
  const [open, setOpen]     = useState(false);
  const ref                 = useState(() => ({ current: null }))[0];

  // Sincronizar quando value muda externamente
  useEffect(() => { setQuery(value || ''); }, [value]);

  const filtrados = query.length >= 1
    ? motivos.filter(m => m.motivo.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : motivos.slice(0, 12);

  const selecionar = (m) => {
    onChange(m.motivo);
    setQuery(m.motivo);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={r => ref.current = r}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Digite para filtrar motivos..."
          className="input"
          style={{ paddingRight: 28 }}
          autoComplete="off"
        />
        {value && (
          <button onClick={() => { onChange(''); setQuery(''); }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>
      {open && filtrados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: 'var(--shadow-md)',
          maxHeight: 260, overflowY: 'auto', marginTop: 3,
        }}>
          {filtrados.map((m, i) => {
            const cfg = AREA_CORES[m.area] || { color: 'var(--text-2)', bg: 'var(--surface-3)' };
            return (
              <div key={m.motivo}
                onMouseDown={() => selecionar(m)}
                style={{
                  padding: '9px 12px', cursor: 'pointer',
                  background: m.motivo === value ? 'var(--blue-dim)' : 'transparent',
                  borderBottom: i < filtrados.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = m.motivo === value ? 'var(--blue-dim)' : 'transparent'}
              >
                <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: m.motivo === value ? 700 : 400 }}>{m.motivo}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{m.area}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

// ── Layout helpers ────────────────────────────────────────
function DataGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>{children}</div>;
}

function DataItem({ label, value, full, accent, large }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      gridColumn: full ? '1 / -1' : undefined,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: large ? 15 : 12.5, fontWeight: large ? 800 : 500, color: accent || 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.4, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function ValorLinha({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(value)}</span>
    </div>
  );
}

function SectionCard({ title, icon, color = 'var(--blue)', children, action }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic d={icon} size={13} color={color}/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '6px 16px 10px' }}>{children}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
export default function DetalheDrawer({ id, user, onClose, onSaved }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editStatus, setEdit]       = useState(false);
  const [newStatus, setNewStatus]   = useState('');
  const [obs, setObs]               = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState('');
  const [editMotivo, setEditMotivo] = useState(false);
  const [motivo, setMotivo]         = useState('');
  const [savingMotivo, setSavingMotivo] = useState(false);
  const [motivosDB, setMotivosDB]   = useState([]);

  const [editTransp, setEditTransp]     = useState(false);
  const [transpNome, setTranspNome]     = useState('');
  const [transpCnpj, setTranspCnpj]     = useState('');
  const [savingTransp, setSavingTransp] = useState(false);
  const [transpErr, setTranspErr]       = useState('');

  // Carregar motivos do banco na primeira vez
  useEffect(() => {
    dbGetMotivos().then(setMotivosDB);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setData(null); setEdit(false); setEditMotivo(false); setEditTransp(false);
    dbGetDevolucaoDetail(id).then(d => {
      setData(d);
      setNewStatus(d?.dev?.status_portal || 'pendente');
      setMotivo(d?.dev?.motivo_devolucao || '');
      setTranspNome(d?.dev?.transportador_cobranca || '');
      setTranspCnpj(d?.dev?.transportador_cnpj_cobranca || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleSaveTransp = async () => {
    setSavingTransp(true); setTranspErr('');
    try {
      await dbUpdateTransportador(id, { nome: transpNome.trim(), cnpj: transpCnpj.replace(/\D/g, '') });
      setData(prev => ({ ...prev, dev: { ...prev.dev,
        transportador_cobranca: transpNome.trim(),
        transportador_cnpj_cobranca: transpCnpj.replace(/\D/g, ''),
      }}));
      setEditTransp(false); onSaved?.();
    } catch (e) { setTranspErr(e.message); }
    finally { setSavingTransp(false); }
  };

  const handleXml = async () => {
    try { const url = await dbGetXmlUrl(data.dev.xml_path); if (url) window.open(url, '_blank'); }
    catch (e) { alert('Erro: ' + e.message); }
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
      setData(prev => ({ ...prev, dev: { ...prev.dev, motivo_devolucao: motivo, area_responsavel: areaMotivo } }));
      setEditMotivo(false); onSaved?.();
    } catch (e) { alert(e.message); }
    finally { setSavingMotivo(false); }
  };

  const handleSaveStatus = async () => {
    setSaveErr(''); setSaving(true);
    try {
      await dbUpdateStatus(id, newStatus, obs, user?.name || user?.email || '');
      setData(prev => ({ ...prev, dev: { ...prev.dev, status_portal: newStatus } }));
      setEdit(false); setObs(''); onSaved?.();
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const dev = data?.dev;
  const nfV = data?.nfVenda;
  const hist = dev?.raw_json?.obs_historico || [];

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={{ width: 648 }}>

        {/* ── Cabeçalho hero ─────────────────────────── */}
        <div className="dd-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Carregando...</div>
              ) : (
                <>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 6 }}>
                    {dev?.lancamento_manual ? 'Devolução total · lançamento manual' : 'Devolução parcial · NFD do cliente'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                      NF-e {dev?.nf_numero ?? '—'}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Série {dev?.nf_serie ?? '—'}</span>
                    <Badge status={dev?.status_portal}/>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', fontWeight: 500, marginTop: 8 }}>
                    {dev?.nome_emitente}
                    {dev?.municipio_emitente && ` · ${dev.municipio_emitente}`}
                    {dev?.uf_emitente && ` / ${dev.uf_emitente}`}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="dd-close">
              <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
            </button>
          </div>

          {/* Faixa de KPIs */}
          {!loading && dev && (
            <div className="dd-kpis">
              <div className="dd-kpi">
                <span className="dd-kpi-label">Valor devolvido</span>
                <span className="dd-kpi-value" style={{ color: '#fff' }}>{fmtBRL(dev.valor)}</span>
              </div>
              <div className="dd-kpi">
                <span className="dd-kpi-label">Motivo</span>
                <span className="dd-kpi-value" style={{ fontSize: 13, color: dev.motivo_devolucao ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                  {dev.motivo_devolucao || 'A classificar'}
                </span>
              </div>
              <div className="dd-kpi">
                <span className="dd-kpi-label">Área responsável</span>
                {dev.area_responsavel
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 20, alignSelf: 'flex-start' }}>{dev.area_responsavel}</span>
                  : <span className="dd-kpi-value" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>—</span>
                }
              </div>
              <div className="dd-kpi">
                <span className="dd-kpi-label">Protheus</span>
                {dev.lancado_protheus
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7A8' }}>✓ Lançada</span>
                  : <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Pendente</span>
                }
              </div>
            </div>
          )}

          {/* Barra de ações */}
          {!loading && dev && (
            <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => { setEditMotivo(v => !v); setEdit(false); setEditTransp(false); }}
                className={`dd-action ${editMotivo ? 'active' : ''}`}>
                <Ic d="M7 8h10M7 12h6" size={12}/>
                {dev.motivo_devolucao ? 'Editar motivo' : 'Classificar motivo'}
              </button>
              <button onClick={() => { setEditTransp(v => !v); setEdit(false); setEditMotivo(false); }}
                className={`dd-action ${editTransp ? 'active' : ''}`}>
                <Ic d="M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z" size={12}/>
                {dev.transportador_cobranca ? 'Trocar transportador' : 'Vincular transportador'}
              </button>
              <button onClick={() => document.getElementById('btn-add-anexo')?.click()}
                className="dd-action">
                <Ic d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" size={12}/>
                Anexar evidência
              </button>
              {dev.xml_baixado && dev.xml_path && (
                <button onClick={handleXml} className="dd-action">
                  <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12}/>
                  Baixar XML
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
              style={{ animation: 'spin 0.9s linear infinite' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Carregando...
          </div>
        ) : !dev ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', fontSize: 13 }}>
            Erro ao carregar os dados.
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

            {/* ── Painel de edição flutuante (sticky, não desloca o scroll) ── */}
            {(editMotivo || editTransp) && (
              <div style={{
                position: 'sticky', top: 0, zIndex: 20,
                background: 'var(--surface)',
                borderBottom: '2px solid var(--blue)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '16px 22px',
                flexShrink: 0,
              }}>

                {/* Editor motivo */}
                {editMotivo && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      <Ic d="M7 8h10M7 12h6" size={12} color="var(--blue)"/>
                      Classificar motivo da devolução
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <MotivoAutocomplete value={motivo} onChange={setMotivo} motivos={motivosDB}/>
                      {motivo && motivosDB.find(m => m.motivo === motivo) && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Área responsável:</span>
                          {(() => {
                            const area = motivosDB.find(m => m.motivo === motivo)?.area;
                            const cfg = AREA_CORES[area] || { color: 'var(--text-2)', bg: 'var(--surface-3)' };
                            return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 20 }}>{area}</span>;
                          })()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditMotivo(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                      <button onClick={handleSaveMotivo} disabled={savingMotivo || !motivo} className="btn btn-primary btn-sm">
                        {savingMotivo ? 'Salvando...' : 'Salvar motivo'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Editor transportador */}
                {editTransp && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      <Ic d="M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z" size={12} color="var(--blue)"/>
                      {dev?.transportador_cobranca ? 'Trocar transportador' : 'Vincular transportador'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label className="input-label">Razão social *</label>
                        <input type="text" value={transpNome} onChange={e => setTranspNome(e.target.value)}
                          className="input" placeholder="Ex: FAST SOLUTION LOGISTICA LTDA" autoFocus/>
                      </div>
                      <div>
                        <label className="input-label">CNPJ (só números)</label>
                        <input type="text" value={transpCnpj} onChange={e => setTranspCnpj(e.target.value)}
                          className="input" placeholder="Ex: 13407453000189" maxLength={18}/>
                      </div>
                    </div>
                    {transpErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{transpErr}</div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => { setEditTransp(false); setTranspNome(dev?.transportador_cobranca || ''); setTranspCnpj(dev?.transportador_cnpj_cobranca || ''); }} className="btn btn-ghost btn-sm">Cancelar</button>
                      <button onClick={handleSaveTransp} disabled={savingTransp || !transpNome.trim()} className="btn btn-primary btn-sm">
                        {savingTransp ? 'Salvando...' : 'Salvar transportador'}
                      </button>
                      {dev?.transportador_cobranca && (
                        <button onClick={() => { setTranspNome(''); setTranspCnpj(''); }} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }}>
                          Remover vínculo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="drawer-body" style={{ padding: '18px 22px 28px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

              {/* Devolução */}
              <SectionCard title="NF-e de Devolução" icon="M9 14l-4-4 4-4M5 10h11a4 4 0 010 8h-1" color="var(--blue)">
                <DataItem label="Número / Série" value={`${dev.nf_numero} · Série ${dev.nf_serie}`}/>
                <DataItem label="Data de emissão" value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{fmtDate(dev.dt_emissao)}</span>
                    {dev.flag_emissao_entrega === 'divergente' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.10)', padding: '2px 7px', borderRadius: 20 }}>
                        ⚠ Data divergente da entrega
                      </span>
                    )}
                    {dev.flag_emissao_entrega === 'no_ato' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 7px', borderRadius: 20 }}>
                        ✓ Emitida no ato da entrega
                      </span>
                    )}
                    {dev.flag_emissao_entrega === 'aguardando_entrega' && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-3)', padding: '2px 7px', borderRadius: 20 }}>
                        ⏳ Aguardando entrega
                      </span>
                    )}
                  </div>
                }/>
                <DataItem label="CFOPs" value={
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {(dev.cfops || []).map(c => (
                      <span key={c} style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(154,123,79,0.25)', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{c}</span>
                    ))}
                  </div>
                }/>
                <DataItem label="Natureza" value={dev.nat_operacao}/>
                <DataItem label="Empresa dest." value={CNPJ_MAP[dev.cnpj_destinatario] ? `${CNPJ_MAP[dev.cnpj_destinatario]}` : fmtCNPJ(dev.cnpj_destinatario)}/>
              </SectionCard>

              {/* Emitente */}
              <SectionCard title="Quem devolveu" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="var(--text-2)">
                <DataItem label="Razão social" value={dev.nome_emitente}/>
                <DataItem label="CNPJ" value={fmtCNPJ(dev.cnpj_emitente)}/>
                <DataItem label="Município / UF" value={dev.municipio_emitente && dev.uf_emitente ? `${dev.municipio_emitente} / ${dev.uf_emitente}` : dev.uf_emitente}/>
              </SectionCard>
            </div>

            {/* ── Bloco 2: Classificação + Valores (lado a lado) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

              {/* Classificação */}
              <SectionCard title="Classificação fiscal" icon="M7 8h10M7 12h6" color="var(--red)">
                <DataItem label="Tipo de devolução" value={
                  dev.lancamento_manual
                    ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>Total <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>(lançamento manual)</span></span>
                    : <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>Parcial <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>(NFD do cliente)</span></span>
                }/>
                <DataItem label="Situação no Protheus" value={
                  dev.lancado_protheus
                    ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Lançada</span>
                    : <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Pendente de lançamento</span>
                }/>
                {dev.lancado_protheus && dev.dt_lancamento_protheus && (
                  <DataItem label="Data do lançamento" value={fmtDate(dev.dt_lancamento_protheus)} accent="var(--green)"/>
                )}
                <DataItem label="Natureza da operação" value={dev.nat_operacao}/>
              </SectionCard>

              {/* Valores */}
              <SectionCard title="Composição de valores" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="var(--green)">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <ValorLinha label="Produtos" value={dev.valor_produtos}/>
                  <ValorLinha label="ICMS" value={dev.valor_icms}/>
                  <ValorLinha label="ICMS-ST" value={dev.valor_st}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0 4px', marginTop: 4, borderTop: '2px solid var(--border)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total da NF</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtBRL(dev.valor)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ── Observações do XML — largura total ── */}
            {dev.inf_complementar && (
              <SectionCard
                title="Observações da NFD (XML)"
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                color="var(--text-2)"
              >
                <div style={{ padding: '10px 0', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {dev.inf_complementar}
                </div>
              </SectionCard>
            )}

            {/* ── Bloco 3: NF original de venda ── */}
            {nfV ? (
              <SectionCard
                title="NF original de venda"
                icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                color="var(--purple)"
                action={
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--blue-dim)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 20 }}>
                    {nfV.fonte === 'active_webhooks' ? 'Active OnSupply' : 'Histórico'}
                  </span>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <DataItem label="NF / Série" value={`${nfV.nf_numero} · Série ${nfV.nf_serie}`}/>
                  <DataItem label="Data emissão" value={fmtDate(nfV.dt_emissao)}/>
                  <DataItem label="Data entrega" value={fmtDate(nfV.dt_entrega)} accent={nfV.dt_entrega ? 'var(--green)' : undefined}/>
                  <DataItem label="Valor da venda" value={fmtBRL(nfV.valor_produtos)} accent="var(--blue)"/>
                  <DataItem label="Destinatário" value={nfV.destinatario_nome} full/>
                  <DataItem label="CNPJ" value={fmtCNPJ(nfV.destinatario_cnpj)}/>
                  <DataItem label="Destino" value={nfV.cidade_destino && nfV.uf_destino ? `${nfV.cidade_destino} / ${nfV.uf_destino}` : nfV.uf_destino}/>
                  {/* Transportador vinculado */}
                  <div style={{ gridColumn: '1 / -1', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Transportador</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>
                      {dev.transportador_cobranca || nfV.transportador_nome || '—'}
                      {dev.transportador_cobranca && (
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>vinculado</span>
                      )}
                    </div>
                    {dev.transportador_cnpj_cobranca && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{fmtCNPJ(dev.transportador_cnpj_cobranca)}</div>
                    )}
                  </div>
                  <DataItem label="Pedido" value={nfV.pedido}/>
                  <DataItem label="Centro de custo" value={nfV.centro_custo}/>
                  {nfV.nf_chave && <DataItem label="Chave NF-e" value={<span style={{ fontFamily: 'monospace', fontSize: 9.5, wordBreak: 'break-all' }}>{nfV.nf_chave}</span>} full/>}
                </div>
              </SectionCard>
            ) : dev.chave_nfe_referenciada ? (
              <SectionCard title="NF original de venda" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" color="var(--text-3)">
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.5 }}>
                    {(() => {
                      const aamm = dev.chave_nfe_referenciada?.substring(2, 6);
                      const ano = aamm ? `20${aamm.substring(0, 2)}` : null;
                      return ano && parseInt(ano) < 2026
                        ? `NF de venda emitida em ${ano} — anterior à integração do Active OnSupply. Não disponível no sistema.`
                        : 'NF de venda não localizada no Active OnSupply. Pode estar em período de inicialização do webhook.';
                    })()}
                  </div>
                  {/* Transportador: editável via botão no hero */}
                  <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Transportador</div>
                    {dev.transportador_cobranca ? (
                      <>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {dev.transportador_cobranca}
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '1px 6px', borderRadius: 10 }}>vinculado</span>
                        </div>
                        {dev.transportador_cnpj_cobranca && (
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{fmtCNPJ(dev.transportador_cnpj_cobranca)}</div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'var(--yellow)', fontWeight: 600 }}>
                        ⚠ Não identificado — use "Vincular transportador" acima
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9.5, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 6, wordBreak: 'break-all', border: '1px solid var(--border)', letterSpacing: '.04em' }}>
                    {dev.chave_nfe_referenciada}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* ── Bloco 4: Itens devolvidos ── */}
            {Array.isArray(dev.itens) && dev.itens.length > 0 && (
              <SectionCard title="Itens devolvidos" icon="M4 6h16M4 10h16M4 14h16M4 18h16" color="var(--gold)"
                action={<span style={{ fontSize: 10, fontWeight: 700, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 20 }}>{dev.itens.length} {dev.itens.length === 1 ? 'item' : 'itens'}</span>}>
                <div style={{ overflowX: 'auto', marginTop: 4 }}>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Produto</th>
                        <th>CFOP</th>
                        <th style={{ textAlign: 'right' }}>Qtd</th>
                        <th style={{ textAlign: 'right' }}>Vl. Unit.</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dev.itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {it.codigo || '—'}
                          </td>
                          <td style={{ fontWeight: 500 }} title={it.descricao}>{it.descricao}</td>
                          <td style={{ width: 52 }}>
                            {it.cfop && <span style={{ background: 'var(--gold-dim)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>{it.cfop}</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {it.quantidade} <span style={{ color: 'var(--text-3)' }}>{it.unidade}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                            {it.valor_unitario != null ? fmtBRL(it.valor_unitario) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtBRL(it.valor_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={5} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          Total devolvido
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--blue)', fontSize: 13 }}>
                          {fmtBRL(dev.itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* ── Bloco 5: Chave de acesso ── */}
            {dev.chave_nfe && (
              <SectionCard title="Chave de acesso" icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" color="var(--text-3)">
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-2)', padding: '8px 0', wordBreak: 'break-all', letterSpacing: '.04em', lineHeight: 1.6 }}>
                  {dev.chave_nfe}
                </div>
              </SectionCard>
            )}

            {/* ── Bloco 6: Histórico ── */}
            {hist.length > 0 && (
              <SectionCard title="Histórico de status" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="var(--text-2)"
                action={<span style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-3)', padding: '2px 7px', borderRadius: 20 }}>{hist.length}</span>}>
                <div style={{ paddingTop: 8 }}>
                  {[...hist].reverse().map((h, i) => {
                    const cfg = STATUS_CFG[h.status] || {};
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot || 'var(--border-2)', flexShrink: 0, marginTop: 4, border: `2px solid ${cfg.border || 'var(--border)'}` }}/>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                            {cfg.l || h.status}
                            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 8, fontSize: 11 }}>
                              {h.user && `${h.user} · `}{fmtDateTime(h.ts)}
                            </span>
                          </div>
                          {h.obs && <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{h.obs}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* ── Bloco 7: Anexos e evidências ── */}
            <AnexosSection devolucaoId={id} user={user}/>

          </div>
          </div>
        )}
      </div>
    </div>
  );
}
