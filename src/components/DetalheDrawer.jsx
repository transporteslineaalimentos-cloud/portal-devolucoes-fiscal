import { useEffect, useState } from 'react';
import { dbGetDevolucaoDetail, dbUpdateStatus, dbGetXmlUrl, dbUpdateMotivo } from '../config/supabase';
import { fmtBRL, fmtDate, fmtDateTime, fmtCNPJ, CNPJ_MAP, STATUS_CFG, STATUS_OPTIONS, Badge } from '../utils.jsx';

const MOTIVOS_PADRAO = [
  'Avaria no recebimento',
  'Falta no recebimento',
  'Mercadoria não solicitada',
  'Desacordo com o pedido',
  'Produto fora da validade',
  'Desvio de qualidade',
  'Erro de faturamento',
  'Recusa na entrega',
  'Outros',
];

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function Field({ label, value, fullWidth = false, mono = false }) {
  return (
    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)', gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word', fontFamily: mono ? "'Courier New', monospace" : undefined, fontSize: mono ? 10 : undefined }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function SectionHead({ title, count, badge }) {
  return (
    <div style={{
      padding: '10px 22px', background: 'var(--surface-2)',
      borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.10em', color: 'var(--text-3)' }}>
        {title}
      </span>
      {count != null && (
        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--blue-dim)', color: 'var(--blue)', padding: '1px 7px', borderRadius: 20 }}>
          {count}
        </span>
      )}
      {badge && (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--blue-dim)', color: badge.color || 'var(--blue)', padding: '1px 7px', borderRadius: 20, letterSpacing: '.03em', marginLeft: 2 }}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

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
  const [devTotal, setDevTotal]     = useState(null);
  const [savingMotivo, setSavingMotivo] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setData(null); setEdit(false); setEditMotivo(false);
    dbGetDevolucaoDetail(id).then(d => {
      setData(d);
      setNewStatus(d?.dev?.status_portal || 'pendente');
      setMotivo(d?.dev?.motivo_devolucao || '');
      setDevTotal(d?.dev?.devolucao_total ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleXml = async () => {
    try {
      const url = await dbGetXmlUrl(data.dev.xml_path);
      if (url) window.open(url, '_blank');
    } catch (e) { alert('Erro ao gerar link: ' + e.message); }
  };

  const handleSaveMotivo = async () => {
    setSavingMotivo(true);
    try {
      await dbUpdateMotivo(id, { motivo_devolucao: motivo, devolucao_total: devTotal });
      setData(prev => ({ ...prev, dev: { ...prev.dev, motivo_devolucao: motivo, devolucao_total: devTotal } }));
      setEditMotivo(false);
      onSaved?.();
    } catch (e) { alert(e.message); }
    finally { setSavingMotivo(false); }
  };

  const handleSaveStatus = async () => {
    setSaveErr(''); setSaving(true);
    try {
      await dbUpdateStatus(id, newStatus, obs, user?.name || user?.email || '');
      setData(prev => ({ ...prev, dev: { ...prev.dev, status_portal: newStatus } }));
      setEdit(false); setObs('');
      onSaved?.();
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const dev  = data?.dev;
  const nfV  = data?.nfVenda;
  const hist = dev?.raw_json?.obs_historico || [];

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer">

        {/* Cabeçalho */}
        <div className="drawer-head">
          <div>
            <div className="drawer-head-title">
              {loading ? 'Carregando...' : `NF-e ${dev?.nf_numero ?? '—'} · Série ${dev?.nf_serie ?? '—'}`}
            </div>
            {dev && (
              <div className="drawer-head-sub">
                {dev.nome_emitente}
                {dev.uf_emitente ? ` · ${dev.municipio_emitente || ''} / ${dev.uf_emitente}` : ''}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px', borderRadius: 6 }}>
            <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
              style={{ animation: 'spin 0.9s linear infinite' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Carregando detalhe...
          </div>
        ) : !dev ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', fontSize: 13 }}>
            Erro ao carregar os dados.
          </div>
        ) : (
          <div className="drawer-body">

            {/* Status bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface)', flexWrap: 'wrap',
            }}>
              <Badge status={dev.status_portal} />
              <div style={{ flex: 1 }}/>
              {dev.xml_baixado && dev.xml_path && (
                <button onClick={handleXml} className="btn btn-outline btn-sm">
                  <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12}/>
                  XML
                </button>
              )}
              <button onClick={() => setEditMotivo(v => !v)}
                className={`btn btn-sm ${editMotivo ? 'btn-primary' : 'btn-outline'}`}>
                <Ic d="M7 8h10M7 12h6m-6 4h10M5 3h14a2 2 0 012 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" size={12}/>
                Motivo
              </button>
              <button onClick={() => setEdit(v => !v)}
                className={`btn btn-sm ${editStatus ? 'btn-primary' : 'btn-outline'}`}>
                <Ic d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" size={12}/>
                Atualizar status
              </button>
            </div>

            {/* Editor de motivo */}
            {editMotivo && (
              <div style={{ padding: '14px 22px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <label className="input-label">Motivo da devolução</label>
                    <select value={motivo} onChange={e => setMotivo(e.target.value)} className="input">
                      <option value="">— Selecionar —</option>
                      {MOTIVOS_PADRAO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {motivo === 'Outros' && (
                      <input type="text" placeholder="Descreva o motivo..." className="input" style={{ marginTop: 6 }}
                        onChange={e => setMotivo(e.target.value)}/>
                    )}
                  </div>
                  <div>
                    <label className="input-label">Tipo de devolução</label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {[{ v: true, l: 'Total' }, { v: false, l: 'Parcial' }, { v: null, l: 'Não definido' }].map(opt => (
                        <button key={String(opt.v)} onClick={() => setDevTotal(opt.v)}
                          className={`btn btn-sm ${devTotal === opt.v ? 'btn-primary' : 'btn-outline'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditMotivo(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                  <button onClick={handleSaveMotivo} disabled={savingMotivo} className="btn btn-primary btn-sm">
                    {savingMotivo ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Editor de status */}
            {editStatus && (
              <div style={{ padding: '14px 22px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <label className="input-label">Novo status</label>
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input">
                      {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="input-label">Observação (opcional)</label>
                  <textarea value={obs} onChange={e => setObs(e.target.value)}
                    placeholder="Descreva o motivo ou ação tomada..."
                    className="input" rows={2} style={{ resize: 'vertical' }}/>
                </div>
                {saveErr && (
                  <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Ic d="M12 8v4m0 4h.01" size={12} color="var(--red)"/> {saveErr}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEdit(false)} className="btn btn-ghost btn-sm">Cancelar</button>
                  <button onClick={handleSaveStatus} disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}

            {/* NF de Devolução */}
            <SectionHead title="NF-e de Devolução" />
            <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Número / Série" value={`${dev.nf_numero} · Série ${dev.nf_serie}`}/>
              <Field label="Data de emissão" value={fmtDate(dev.dt_emissao)}/>
              <Field label="Natureza da operação" value={dev.nat_operacao} fullWidth/>
              <Field label="CFOPs" value={
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(dev.cfops || []).map(c => (
                    <span key={c} style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(154,123,79,0.25)', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{c}</span>
                  ))}
                </span>
              } fullWidth/>
              {/* Motivo e tipo de devolução */}
              <Field label="Motivo da devolução" value={
                dev.motivo_devolucao
                  ? <span style={{ fontWeight: 600, color: 'var(--red)' }}>{dev.motivo_devolucao}</span>
                  : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Não informado — clique em "Motivo" para classificar</span>
              } fullWidth/>
              <Field label="Tipo" value={
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 700,
                  color: dev.devolucao_total === true ? 'var(--red)' : dev.devolucao_total === false ? 'var(--yellow)' : 'var(--text-3)',
                  background: dev.devolucao_total === true ? 'var(--red-dim)' : dev.devolucao_total === false ? 'var(--yellow-dim)' : 'var(--surface-3)',
                  padding: '2px 8px', borderRadius: 20,
                }}>
                  {dev.devolucao_total === true ? '● Devolução Total' : dev.devolucao_total === false ? '◐ Devolução Parcial' : '— Não definido'}
                </span>
              }/>
              {dev.lancamento_manual && (
                <Field label="Origem" value={
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', background: 'var(--purple-dim)', padding: '2px 8px', borderRadius: 20 }}>
                    ✎ Lançamento Manual
                  </span>
                }/>
              )}
              {dev.inf_complementar && (
                <Field label="Informações complementares (XML)" value={
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {dev.inf_complementar}
                  </div>
                } fullWidth/>
              )}
              <Field label="Empresa destinatária" value={CNPJ_MAP[dev.cnpj_destinatario] ? `${CNPJ_MAP[dev.cnpj_destinatario]} · ${fmtCNPJ(dev.cnpj_destinatario)}` : fmtCNPJ(dev.cnpj_destinatario)} fullWidth/>
              {dev.chave_nfe && (
                <Field label="Chave de acesso" value={dev.chave_nfe} mono fullWidth/>
              )}
            </div>

            {/* Emitente */}
            <SectionHead title="Emitente — quem devolveu" />
            <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Razão social" value={dev.nome_emitente} fullWidth/>
              <Field label="CNPJ" value={fmtCNPJ(dev.cnpj_emitente)}/>
              <Field label="Município / UF" value={dev.municipio_emitente && dev.uf_emitente ? `${dev.municipio_emitente} / ${dev.uf_emitente}` : dev.uf_emitente || '—'}/>
            </div>

            {/* Valores */}
            <SectionHead title="Valores" />
            <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Total da NF" value={
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {fmtBRL(dev.valor)}
                </span>
              }/>
              <Field label="Valor dos produtos" value={fmtBRL(dev.valor_produtos)}/>
              <Field label="ICMS" value={fmtBRL(dev.valor_icms)}/>
              <Field label="ICMS-ST" value={fmtBRL(dev.valor_st)}/>
            </div>

            {/* NF Original de Venda */}
            {nfV ? (
              <>
                <SectionHead
                  title="NF original de venda"
                  badge={nfV.fonte === 'active_webhooks' ? { label: 'Active OnSupply', color: 'var(--blue)' } : { label: 'Histórico', color: 'var(--text-3)' }}
                />
                <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <Field label="NF / Série" value={`${nfV.nf_numero} · Série ${nfV.nf_serie}`}/>
                  <Field label="Data emissão" value={fmtDate(nfV.dt_emissao)}/>
                  <Field label="Destinatário (cliente)" value={nfV.destinatario_nome} fullWidth/>
                  <Field label="CNPJ destinatário" value={fmtCNPJ(nfV.destinatario_cnpj)}/>
                  {/* active_webhooks não tem cidade separada; historico_nfs tem */}
                  {(nfV.cidade_destino || nfV.uf_destino) && (
                    <Field label="Destino" value={[nfV.cidade_destino, nfV.uf_destino].filter(Boolean).join(' / ')}/>
                  )}
                  <Field label="Data entrega" value={fmtDate(nfV.dt_entrega)}/>
                  <Field label="Transportador" value={nfV.transportador_nome || '—'}/>
                  <Field label="Pedido" value={nfV.pedido || '—'}/>
                  {nfV.centro_custo && <Field label="Centro de custo" value={nfV.centro_custo}/>}
                  {nfV.nat_operacao && <Field label="Natureza op." value={nfV.nat_operacao}/>}
                  <Field label="Valor da venda" value={fmtBRL(nfV.valor_produtos)}/>
                  {nfV.nf_chave && (
                    <Field label="Chave NF-e de venda" value={nfV.nf_chave} mono fullWidth/>
                  )}
                </div>
              </>
            ) : dev.chave_nfe_referenciada ? (
              <>
                <SectionHead title="NF original de venda" />
                <div style={{ padding: '14px 22px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    Chave referenciada não localizada no Active OnSupply. A NF de venda pode ser anterior à integração do webhook.
                  </div>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, wordBreak: 'break-all', border: '1px solid var(--border)' }}>
                    {dev.chave_nfe_referenciada}
                  </div>
                </div>
              </>
            ) : null}

            {/* Itens */}
            {Array.isArray(dev.itens) && dev.itens.length > 0 && (
              <>
                <SectionHead title="Itens devolvidos" count={dev.itens.length} />
                <div style={{ overflowX: 'auto' }}>
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
                          <td style={{ color: 'var(--text-3)', width: 32 }}>{it.item}</td>
                          <td style={{ width: 60 }}>
                            <span style={{ background: 'var(--gold-dim)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                              {it.cfop}
                            </span>
                          </td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={it.descricao}>
                            {it.descricao}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {it.quantidade} <span style={{ color: 'var(--text-3)' }}>{it.unidade}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text)' }}>
                            {fmtBRL(it.valor_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Histórico */}
            {hist.length > 0 && (
              <>
                <SectionHead title="Histórico de status" count={hist.length} />
                <div style={{ padding: '16px 22px' }}>
                  {[...hist].reverse().map((h, i) => {
                    const cfg = STATUS_CFG[h.status] || {};
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, position: 'relative' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: cfg.dot || 'var(--border-2)',
                          flexShrink: 0, marginTop: 3,
                          border: `2px solid ${cfg.border || 'var(--border)'}`,
                        }}/>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                            {cfg.l || h.status}
                            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
                              {h.user && `por ${h.user} · `}{fmtDateTime(h.ts)}
                            </span>
                          </div>
                          {h.obs && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 2 }}>
                              {h.obs}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
