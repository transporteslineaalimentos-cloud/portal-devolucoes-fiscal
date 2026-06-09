import { useEffect, useState } from 'react';
import { dbGetDevolucaoDetail, dbUpdateStatus, dbGetXmlUrl } from '../config/supabase';
import { fmtBRL, fmtDate, fmtDateTime, fmtCNPJ, CNPJ_MAP, STATUS_CFG, STATUS_OPTIONS, Badge } from '../utils.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function Row({ label, value }) {
  return (
    <div className="drawer-row">
      <span className="drawer-row-label">{label}</span>
      <span className="drawer-row-value">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">{title}</div>
      {children}
    </div>
  );
}

export default function DetalheDrawer({ id, user, onClose, onSaved }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editStatus, setEdit]   = useState(false);
  const [newStatus, setNewStatus]= useState('');
  const [obs, setObs]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true); setData(null); setEdit(false);
    dbGetDevolucaoDetail(id).then(d => {
      setData(d);
      setNewStatus(d?.dev?.status_portal || 'pendente');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleXml = async () => {
    try {
      const url = await dbGetXmlUrl(data.dev.xml_path);
      if (url) window.open(url, '_blank');
    } catch (e) { alert('Erro ao gerar link: ' + e.message); }
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
        {/* Head */}
        <div className="drawer-head">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {loading ? 'Carregando...' : `NF-e Devolução ${dev?.nf_numero ?? '—'}/${dev?.nf_serie ?? ''}`}
            </div>
            {dev && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{dev.nome_emitente}</div>}
          </div>
          <button onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }}>
            <Ic d="M18 6L6 18M6 6l12 12" />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            Carregando...
          </div>
        ) : !dev ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
            Erro ao carregar.
          </div>
        ) : (
          <div className="drawer-body">

            {/* Badges + ações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <Badge status={dev.status_portal} />
              <div style={{ flex: 1 }} />
              {dev.xml_baixado && dev.xml_path && (
                <button onClick={handleXml} className="btn btn-outline btn-sm">
                  <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  XML
                </button>
              )}
              <button onClick={() => setEdit(v => !v)} className="btn btn-gold btn-sm">
                <Ic d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                Atualizar status
              </button>
            </div>

            {/* Editor de status */}
            {editStatus && (
              <div style={{ margin: '12px 20px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 14 }}>
                <label className="input-label" style={{ marginBottom: 6 }}>Novo status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input" style={{ marginBottom: 8 }}>
                  {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <label className="input-label" style={{ marginBottom: 6 }}>Observação</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)}
                  placeholder="Opcional..." className="input" rows={2}
                  style={{ resize: 'vertical', marginBottom: 8 }} />
                {saveErr && <div style={{ color: 'var(--red)', fontSize: 11, marginBottom: 6 }}>{saveErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEdit(false)} className="btn btn-outline btn-sm">Cancelar</button>
                  <button onClick={handleSaveStatus} disabled={saving} className="btn btn-gold btn-sm">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* NF de Devolução */}
            <Section title="NF-e de Devolução">
              <Row label="Número / Série" value={`${dev.nf_numero} / ${dev.nf_serie}`} />
              <Row label="Data emissão"   value={fmtDate(dev.dt_emissao)} />
              <Row label="Natureza op."   value={dev.nat_operacao} />
              <Row label="CFOPs"          value={(dev.cfops || []).join(', ')} />
              <Row label="CNPJ dest."     value={`${CNPJ_MAP[dev.cnpj_destinatario] || ''} — ${fmtCNPJ(dev.cnpj_destinatario)}`} />
              <Row label="Chave NF-e"     value={
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', wordBreak: 'break-all' }}>{dev.chave_nfe}</span>
              } />
            </Section>

            {/* Emitente (quem devolveu) */}
            <Section title="Emitente — quem devolveu">
              <Row label="Nome"       value={dev.nome_emitente} />
              <Row label="CNPJ"       value={fmtCNPJ(dev.cnpj_emitente)} />
              <Row label="Município"  value={`${dev.municipio_emitente || '—'} / ${dev.uf_emitente || '—'}`} />
            </Section>

            {/* Valores da devolução */}
            <Section title="Valores da devolução">
              <Row label="Total NF"    value={<strong style={{ color: 'var(--gold)' }}>{fmtBRL(dev.valor)}</strong>} />
              <Row label="Produtos"    value={fmtBRL(dev.valor_produtos)} />
              <Row label="ICMS"        value={fmtBRL(dev.valor_icms)} />
              <Row label="ICMS-ST"     value={fmtBRL(dev.valor_st)} />
            </Section>

            {/* NF Original de Venda */}
            {nfV ? (
              <Section title="NF original de venda (Active)">
                <Row label="NF / Série"    value={`${nfV.nf_numero} / ${nfV.nf_serie}`} />
                <Row label="Data emissão"  value={fmtDate(nfV.dt_emissao)} />
                <Row label="Data entrega"  value={fmtDate(nfV.dt_entrega)} />
                <Row label="Destinatário"  value={nfV.destinatario_nome} />
                <Row label="Destino"       value={`${nfV.cidade_destino || '—'} / ${nfV.uf_destino || '—'}`} />
                <Row label="Transportador" value={nfV.transportador_nome} />
                <Row label="Pedido"        value={nfV.pedido} />
                <Row label="Centro de custo" value={nfV.centro_custo} />
                <Row label="Valor venda"   value={fmtBRL(nfV.valor_produtos)} />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 4 }}>Chave NF-e de venda</div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--blue)', background: 'var(--surface-3)', padding: '6px 8px', borderRadius: 5, wordBreak: 'break-all' }}>
                    {nfV.nf_chave}
                  </div>
                </div>
              </Section>
            ) : dev.chave_nfe_referenciada ? (
              <Section title="NF original de venda">
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                  Não encontrada em historico_nfs. Chave referenciada:
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                  {dev.chave_nfe_referenciada}
                </div>
              </Section>
            ) : null}

            {/* Itens devolvidos */}
            {Array.isArray(dev.itens) && dev.itens.length > 0 && (
              <Section title={`Itens devolvidos (${dev.itens.length})`}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>CFOP</th>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th style={{ textAlign: 'right' }}>Vl. Unit.</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dev.itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-3)' }}>{it.item}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{it.cfop}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.descricao}>{it.descricao}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{it.quantidade} {it.unidade}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(it.valor_unitario)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text)' }}>{fmtBRL(it.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Histórico de status */}
            {hist.length > 0 && (
              <Section title="Histórico">
                {[...hist].reverse().map((h, i) => (
                  <div key={i} className="hist-entry">
                    <div className="hist-bar" />
                    <div>
                      <div className="hist-meta">
                        <strong style={{ color: 'var(--text)' }}>{STATUS_CFG[h.status]?.l || h.status}</strong>
                        {' · '}{h.user}{' · '}{fmtDateTime(h.ts)}
                      </div>
                      {h.obs && <div className="hist-obs">{h.obs}</div>}
                    </div>
                  </div>
                ))}
              </Section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
