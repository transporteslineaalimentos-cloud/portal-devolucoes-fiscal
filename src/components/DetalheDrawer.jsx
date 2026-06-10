import { useEffect, useState } from 'react';
import { dbGetDevolucaoDetail, dbUpdateStatus, dbGetXmlUrl, dbUpdateMotivo, dbGetMotivos } from '../config/supabase';
import { fmtBRL, fmtDate, fmtDateTime, fmtCNPJ, CNPJ_MAP, STATUS_CFG, STATUS_OPTIONS, Badge } from '../utils.jsx';

const AREA_CORES = {
  'COMERCIAL':         { color: 'var(--blue)',   bg: 'var(--blue-dim)' },
  'TRANSPORTE':        { color: 'var(--yellow)',  bg: 'var(--yellow-dim)' },
  'QUALIDADE':         { color: 'var(--purple)',  bg: 'var(--purple-dim)' },
  'FISCAL':            { color: 'var(--red)',     bg: 'var(--red-dim)' },
  'LOGÍSTICA REVERSA': { color: 'var(--green)',   bg: 'var(--green-dim)' },
  'LOGÍSTICA':         { color: 'var(--green)',   bg: 'var(--green-dim)' },
};

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

function SectionCard({ title, icon, color = 'var(--blue)', children, action }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic d={icon} size={12} color={color}/>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '4px 16px 8px' }}>{children}</div>
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

  // Carregar motivos do banco na primeira vez
  useEffect(() => {
    dbGetMotivos().then(setMotivosDB);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setData(null); setEdit(false); setEditMotivo(false);
    dbGetDevolucaoDetail(id).then(d => {
      setData(d);
      setNewStatus(d?.dev?.status_portal || 'pendente');
      setMotivo(d?.dev?.motivo_devolucao || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

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
      <div className="drawer" style={{ width: 600 }}>

        {/* ── Cabeçalho ─────────────────────────── */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Carregando...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      NF-e {dev?.nf_numero ?? '—'} · Série {dev?.nf_serie ?? '—'}
                    </span>
                    <Badge status={dev?.status_portal}/>
                    {dev?.lancamento_manual && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--purple-dim)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 20 }}>MANUAL</span>
                    )}
                    {dev?.lancamento_manual === true && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--red-dim)', color: 'var(--red)', padding: '2px 7px', borderRadius: 20 }}>TOTAL</span>
                    )}
                    {!dev?.lancamento_manual && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--yellow-dim)', color: 'var(--yellow)', padding: '2px 7px', borderRadius: 20 }}>PARCIAL</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                    {dev?.nome_emitente}
                    {dev?.municipio_emitente && ` · ${dev.municipio_emitente}`}
                    {dev?.uf_emitente && ` / ${dev.uf_emitente}`}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6, borderRadius: 6, flexShrink: 0 }}>
              <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
            </button>
          </div>

          {/* Barra de ações */}
          {!loading && dev && (
            <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={() => { setEditMotivo(v => !v); setEdit(false); }}
                className={`btn btn-sm ${editMotivo ? 'btn-primary' : 'btn-outline'}`}>
                <Ic d="M7 8h10M7 12h6" size={12}/>
                {dev.motivo_devolucao ? 'Editar motivo' : 'Classificar motivo'}
              </button>
              <button onClick={() => { setEdit(v => !v); setEditMotivo(false); }}
                className={`btn btn-sm ${editStatus ? 'btn-primary' : 'btn-outline'}`}>
                <Ic d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" size={12}/>
                Atualizar status
              </button>
              {dev.xml_baixado && dev.xml_path && (
                <button onClick={handleXml} className="btn btn-outline btn-sm">
                  <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12}/>
                  XML
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
          <div className="drawer-body" style={{ padding: '16px 20px' }}>

            {/* ── Editor motivo ──────────────────── */}
            {editMotivo && (
              <div style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Classificar motivo da devolução</div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Motivo</label>
                  <select value={motivo} onChange={e => setMotivo(e.target.value)} className="input">
                    <option value="">— Selecionar —</option>
                    {/* Agrupar por área */}
                    {Object.entries(
                      motivosDB.reduce((acc, m) => {
                        if (!acc[m.area]) acc[m.area] = [];
                        acc[m.area].push(m.motivo);
                        return acc;
                      }, {})
                    ).sort(([a],[b]) => a.localeCompare(b)).map(([area, motivos]) => (
                      <optgroup key={area} label={`── ${area}`}>
                        {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                    ))}
                  </select>
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
                    {savingMotivo ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Editor status ──────────────────── */}
            {editStatus && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Atualizar status</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="input-label">Novo status</label>
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input">
                      {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Observação (opcional)</label>
                  <textarea value={obs} onChange={e => setObs(e.target.value)} className="input" rows={2} style={{ resize: 'vertical' }} placeholder="Motivo ou ação tomada..."/>
                </div>
                {saveErr && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{saveErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEdit(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                  <button onClick={handleSaveStatus} disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Bloco 1: Devolução + Emitente (lado a lado) ── */}
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

            {/* ── Bloco 2: Motivo + Valores (lado a lado) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

              {/* Motivo */}
              <SectionCard title="Classificação" icon="M7 8h10M7 12h6" color="var(--red)">
                <DataItem label="Motivo" value={
                  dev.motivo_devolucao
                    ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>{dev.motivo_devolucao}</span>
                    : <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 11.5 }}>Não classificado — clique em "Classificar motivo"</span>
                }/>
                {dev.area_responsavel && (() => {
                  const cfg = AREA_CORES[dev.area_responsavel] || { color: 'var(--text-2)', bg: 'var(--surface-3)' };
                  return (
                    <DataItem label="Área responsável" value={
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
                        {dev.area_responsavel}
                      </span>
                    }/>
                  );
                })()}
                <DataItem label="Tipo" value={
                  dev.lancamento_manual
                    ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>● Total <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>(lançamento manual)</span></span>
                    : <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>◐ Parcial <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)' }}>(NFD emitida pelo cliente)</span></span>
                }/>
              </SectionCard>

              {/* Valores */}
              <SectionCard title="Valores" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="var(--green)">
                <DataItem label="Total da NF" value={fmtBRL(dev.valor)} accent="var(--text)" large/>
                <DataItem label="Valor dos produtos" value={fmtBRL(dev.valor_produtos)}/>
                <DataItem label="ICMS" value={fmtBRL(dev.valor_icms)}/>
                <DataItem label="ICMS-ST" value={fmtBRL(dev.valor_st)}/>
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
                  <DataItem label="Transportador" value={nfV.transportador_nome} full/>
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
                        <th>#</th>
                        <th>CFOP</th>
                        <th>Produto</th>
                        <th style={{ textAlign: 'right' }}>Qtd</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dev.itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-3)', width: 28 }}>{it.item}</td>
                          <td style={{ width: 56 }}>
                            <span style={{ background: 'var(--gold-dim)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>{it.cfop}</span>
                          </td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={it.descricao}>{it.descricao}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{it.quantidade} <span style={{ color: 'var(--text-3)' }}>{it.unidade}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(it.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
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

          </div>
        )}
      </div>
    </div>
  );
}
