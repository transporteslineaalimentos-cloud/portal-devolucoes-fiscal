import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { fmtBRL, fmtCNPJ } from '../utils.jsx';

const MOTIVOS = [
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

const CNPJ_OPTIONS = [
  { v: '05207076000297', l: 'Linea MIX' },
  { v: '05207076000459', l: 'Linea CHOCOLATE' },
];

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', minWidth: 120, textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--text)' : 'var(--text-2)', wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  );
}

export default function ModalLancamentoManual({ onClose, onSaved, user }) {
  const [chave, setChave]       = useState('');
  const [nfVenda, setNfVenda]   = useState(null);
  const [lookupErr, setLookupErr] = useState('');
  const [buscando, setBuscando] = useState(false);

  const [motivo, setMotivo]     = useState('');
  const [dtDev, setDtDev]       = useState(new Date().toISOString().slice(0, 10));
  const [cnpjDest, setCnpjDest] = useState('05207076000297');
  const [obs, setObs]           = useState('');
  const [motivoCustom, setMotivoCustom] = useState('');

  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Lookup automático quando chave atinge 44 dígitos
  useEffect(() => {
    const raw = chave.replace(/\D/g, '');
    if (raw.length !== 44) { setNfVenda(null); setLookupErr(''); return; }
    setBuscando(true); setLookupErr(''); setNfVenda(null);
    supabase
      .from('active_webhooks')
      .select('*')
      .eq('chave_nfe', raw)
      .eq('tipo', 'nota_fiscal')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        setBuscando(false);
        if (error || !data) {
          setLookupErr('NF não encontrada na base de dados do Active OnSupply.');
        } else {
          setNfVenda(data);
          // Auto-preencher empresa destinatária com base no CNPJ remetente da NF
          if (data.remetente_cnpj === '05207076000459') setCnpjDest('05207076000459');
          else setCnpjDest('05207076000297');
        }
      });
  }, [chave]);

  const handleSubmit = async () => {
    if (!nfVenda) { setError('Aguarde o preenchimento automático com a chave da NF.'); return; }
    if (!motivo)  { setError('Informe o motivo da devolução.'); return; }
    setSaving(true); setError('');

    try {
      const payload = nfVenda.payload_raw || {};
      const dest    = payload.DESTINATARIO || {};
      const motivoFinal = motivo === 'Outros' ? motivoCustom : motivo;

      const row = {
        chave_nfe:              `MANUAL-${nfVenda.chave_nfe}-${Date.now()}`,
        cnpj_destinatario:      cnpjDest,
        cnpj_emitente:          nfVenda.destinatario_cnpj,
        nome_emitente:          nfVenda.destinatario_nome,
        municipio_emitente:     dest.CIDADE || null,
        uf_emitente:            dest.UF || null,
        dt_emissao:             dtDev,
        dt_recebimento_oobj:    new Date().toISOString(),
        valor:                  parseFloat(nfVenda.valor_mercadoria) || 0,
        valor_produtos:         parseFloat(nfVenda.valor_mercadoria) || 0,
        nat_operacao:           'DEVOLUCAO TOTAL - LANCAMENTO MANUAL',
        cfops:                  ['6202'],
        tipo:                   'devolucao',
        status_portal:          'pendente',
        devolucao_total:        true,
        lancamento_manual:      true,
        motivo_devolucao:       motivoFinal,
        inf_complementar:       obs || null,
        chave_nfe_referenciada: nfVenda.chave_nfe,
        xml_baixado:            false,
        raw_json: {
          nf_venda_numero:      nfVenda.numero,
          nf_venda_serie:       nfVenda.serie,
          transportador:        nfVenda.transportador_nome,
          transportador_cnpj:   nfVenda.transportador_cnpj,
          pedido:               nfVenda.pedido,
          centro_custo:         nfVenda.observacao,
          lancado_por:          user?.name || user?.email,
          lancado_em:           new Date().toISOString(),
        },
      };

      const { error: err } = await supabase.from('oobj_nfe_recebidas').insert(row);
      if (err) throw new Error(err.message);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const rawChave = chave.replace(/\D/g, '');
  const chaveOk  = rawChave.length === 44;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic d="M12 5v14M5 12h14" size={16} color="var(--purple)"/>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Lançamento Manual</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Devolução total sem NFD emitida pelo cliente</div>
            </div>
          </div>
          <div style={{ background: 'var(--purple-dim)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, color: 'var(--purple)', lineHeight: 1.5 }}>
            Cole a chave de acesso da NF de venda — todos os dados serão preenchidos automaticamente. Informe apenas a data da devolução e o motivo.
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Input da chave */}
          <div>
            <label className="input-label">Chave de acesso da NF de venda *</label>
            <div style={{ position: 'relative' }}>
              <input type="text" value={chave}
                onChange={e => setChave(e.target.value.replace(/\D/g, ''))}
                placeholder="Cole aqui os 44 dígitos da chave de acesso"
                maxLength={44}
                className="input"
                style={{
                  fontFamily: 'monospace', fontSize: 11, letterSpacing: '.05em',
                  paddingRight: 36,
                  borderColor: chaveOk && nfVenda ? 'var(--green)' : chaveOk && lookupErr ? 'var(--red)' : undefined,
                }}
              />
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                {buscando && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                  </svg>
                )}
                {chaveOk && nfVenda && !buscando && (
                  <Ic d="M20 6L9 17l-5-5" size={14} color="var(--green)"/>
                )}
                {chaveOk && lookupErr && !buscando && (
                  <Ic d="M18 6L6 18M6 6l12 12" size={14} color="var(--red)"/>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {rawChave.length}/44 dígitos
              {rawChave.length === 44 && !nfVenda && !buscando && lookupErr && (
                <span style={{ color: 'var(--red)', marginLeft: 8 }}>{lookupErr}</span>
              )}
            </div>
          </div>

          {/* Dados preenchidos automaticamente */}
          {nfVenda && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.06)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ic d="M20 6L9 17l-5-5" size={13} color="var(--green)"/>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', letterSpacing: '.04em', textTransform: 'uppercase' }}>NF encontrada — dados preenchidos automaticamente</span>
              </div>
              <div style={{ padding: '8px 14px' }}>
                <InfoRow label="NF / Série"    value={`${nfVenda.numero} · Série ${nfVenda.serie}`} highlight/>
                <InfoRow label="Cliente"       value={nfVenda.destinatario_nome} highlight/>
                <InfoRow label="CNPJ cliente"  value={fmtCNPJ(nfVenda.destinatario_cnpj)}/>
                <InfoRow label="Destino"       value={`${nfVenda.payload_raw?.DESTINATARIO?.CIDADE || ''} / ${nfVenda.payload_raw?.DESTINATARIO?.UF || ''}`}/>
                <InfoRow label="Transportador" value={nfVenda.transportador_nome}/>
                <InfoRow label="Pedido"        value={nfVenda.pedido}/>
                <InfoRow label="Centro custo"  value={nfVenda.observacao}/>
                <InfoRow label="Valor total"   value={fmtBRL(nfVenda.valor_mercadoria)} highlight/>
              </div>
            </div>
          )}

          {/* Campos manuais — só aparecem depois de localizar a NF */}
          {nfVenda && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="input-label">Empresa destinatária *</label>
                <select value={cnpjDest} onChange={e => setCnpjDest(e.target.value)} className="input">
                  {CNPJ_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Data da devolução *</label>
                <input type="date" value={dtDev} onChange={e => setDtDev(e.target.value)} className="input"/>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Motivo da devolução *</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} className="input">
                  <option value="">— Selecionar —</option>
                  {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {motivo === 'Outros' && (
                  <input type="text" placeholder="Descreva o motivo..." value={motivoCustom}
                    onChange={e => setMotivoCustom(e.target.value)}
                    className="input" style={{ marginTop: 6 }}/>
                )}
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Observações adicionais</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)}
                  className="input" rows={2} style={{ resize: 'vertical' }}
                  placeholder="Informações complementares sobre a devolução..."/>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !nfVenda || !motivo}
            className="btn btn-sm"
            style={{ background: nfVenda && motivo ? 'var(--purple)' : 'var(--border-2)', color: nfVenda && motivo ? '#fff' : 'var(--text-3)', cursor: nfVenda && motivo ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Registrando...' : 'Registrar devolução'}
          </button>
        </div>
      </div>
    </div>
  );
}
