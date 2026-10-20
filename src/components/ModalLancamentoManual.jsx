import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { dbGetMotivos } from '../config/supabase';
import { fmtBRL, fmtCNPJ } from '../utils.jsx';

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

  // Busca alternativa por número + série da NF de venda
  const [numBusca, setNumBusca]     = useState('');
  const [serieBusca, setSerieBusca] = useState('');
  const [opcoes, setOpcoes]         = useState([]);
  const [buscaMsg, setBuscaMsg]     = useState('');
  const [buscandoNum, setBuscandoNum] = useState(false);

  const buscarPorNumero = async () => {
    const n = numBusca.replace(/\D/g, '').replace(/^0+/, '');
    const sr = serieBusca.replace(/\D/g, '');
    setOpcoes([]); setBuscaMsg('');
    if (!n) { setBuscaMsg('Informe o número da NF.'); return; }
    setBuscandoNum(true);
    try {
      const achados = new Map();
      const { data: aw } = await supabase.from('active_webhooks')
        .select('chave_nfe,numero,serie,data_emissao,destinatario_nome,remetente_cnpj')
        .eq('tipo', 'nota_fiscal').eq('numero', n).order('created_at', { ascending: false }).limit(50);
      (aw || []).forEach(r => achados.set(r.chave_nfe, {
        chave: r.chave_nfe, numero: r.numero, serie: r.serie || String(parseInt(r.chave_nfe.slice(22, 25), 10)),
        dt: r.data_emissao, cliente: r.destinatario_nome, rem: r.remetente_cnpj,
      }));
      const { data: hist } = await supabase.from('historico_nfs')
        .select('nf_chave,nf_numero,nf_serie,dt_emissao,destinatario_nome,remetente_cnpj')
        .eq('nf_numero', n).limit(20);
      (hist || []).forEach(r => r.nf_chave && !achados.has(r.nf_chave) && achados.set(r.nf_chave, {
        chave: r.nf_chave, numero: r.nf_numero, serie: r.nf_serie || String(parseInt(r.nf_chave.slice(22, 25), 10)),
        dt: r.dt_emissao, cliente: r.destinatario_nome, rem: r.remetente_cnpj,
      }));
      let lista = [...achados.values()];
      if (sr) lista = lista.filter(x => String(parseInt(x.serie, 10)) === String(parseInt(sr, 10)));
      if (lista.length === 0) setBuscaMsg('Nenhuma NF de venda encontrada com esse número' + (sr ? ' e série.' : '.'));
      else if (lista.length === 1) setChave(lista[0].chave);
      else setOpcoes(lista);
    } catch (e) { setBuscaMsg('Erro na busca: ' + e.message); }
    setBuscandoNum(false);
  };

  const [motivo, setMotivo]     = useState('');
  const [motivosDB, setMotivosDB] = useState([]);
  const [dtDev, setDtDev]       = useState(new Date().toISOString().slice(0, 10));
  const [cnpjDest, setCnpjDest] = useState('05207076000297');
  const [obs, setObs]           = useState('');

  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { dbGetMotivos().then(setMotivosDB); }, []);

  // Lookup automático quando chave atinge 44 dígitos
  useEffect(() => {
    const raw = chave.replace(/\D/g, '');
    if (raw.length !== 44) { setNfVenda(null); setLookupErr(''); return; }
    setBuscando(true); setLookupErr(''); setNfVenda(null);

    (async () => {
      // 1) tenta active_webhooks (fonte primária)
      const { data: aw } = await supabase
        .from('active_webhooks')
        .select('*')
        .eq('chave_nfe', raw)
        .eq('tipo', 'nota_fiscal')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aw) {
        setBuscando(false);
        setNfVenda(aw);
        if (aw.remetente_cnpj === '05207076000459') setCnpjDest('05207076000459');
        else setCnpjDest('05207076000297');
        return;
      }

      // 2) fallback: historico_nfs (cobre NFs não capturadas pelo webhook)
      const { data: hist } = await supabase
        .from('historico_nfs')
        .select('*')
        .eq('nf_chave', raw)
        .limit(1)
        .maybeSingle();

      setBuscando(false);

      if (hist) {
        // normaliza para o mesmo formato usado pelo restante do componente
        const normalizado = {
          chave_nfe:          hist.nf_chave,
          numero:             hist.nf_numero,
          serie:              hist.nf_serie,
          destinatario_cnpj:  hist.destinatario_cnpj,
          destinatario_nome:  hist.destinatario_nome,
          remetente_cnpj:     hist.remetente_cnpj,
          valor_mercadoria:   hist.valor_produtos,
          transportador_nome: hist.transportador_nome,
          transportador_cnpj: hist.transportador_cnpj,
          pedido:             hist.pedido,
          observacao:         hist.centro_custo,
          payload_raw: {
            DESTINATARIO: { CIDADE: hist.cidade_destino, UF: hist.uf_destino },
          },
        };
        setNfVenda(normalizado);
        if (hist.remetente_cnpj === '05207076000459') setCnpjDest('05207076000459');
        else setCnpjDest('05207076000297');
      } else {
        setLookupErr('NF não encontrada no Active OnSupply nem no histórico de notas.');
      }
    })();
  }, [chave]);

  const handleSubmit = async () => {
    if (!nfVenda) { setError('Aguarde o preenchimento automático com a chave da NF.'); return; }
    if (!motivo)  { setError('Informe o motivo da devolução.'); return; }
    // Valida data
    const anoDigitado = dtDev?.split('-')[0];
    if (!dtDev || anoDigitado?.length !== 4 || parseInt(anoDigitado) < 2020 || parseInt(anoDigitado) > 2030) {
      setError(`Data inválida: "${dtDev}". Verifique o ano digitado.`); return;
    }
    if (new Date(dtDev) > new Date()) {
      setError('A data da devolução não pode ser uma data futura.'); return;
    }
    setSaving(true); setError('');

    try {
      const payload = nfVenda.payload_raw || {};
      const dest    = payload.DESTINATARIO || {};
      const motivoFinal = motivo;
      const areaMotivo = motivosDB.find(m => m.motivo === motivoFinal)?.area || null;

      // Trava: verifica se já existe devolução total para essa NF de venda
      const { data: existente } = await supabase
        .from('oobj_nfe_recebidas')
        .select('id, nf_numero')
        .eq('chave_nfe_referenciada', nfVenda.chave_nfe)
        .eq('devolucao_total', true)
        .limit(1);
      if (existente && existente.length > 0) {
        throw new Error(`Já existe uma devolução TOTAL registrada para a NF de venda ${nfVenda.numero}. Uma NF de venda só pode ter uma devolução total.`);
      }

      // dt_emissao = data de emissão da NF de venda (já vem do lookup)
      const dtEmissaoNF = nfVenda.dt_emissao
        ? nfVenda.dt_emissao.slice(0, 10)
        : (nfVenda.data_emissao ? nfVenda.data_emissao.slice(0, 10) : null);

      const row = {
        chave_nfe:              `MANUAL-${nfVenda.chave_nfe}-${Date.now()}`,
        nf_numero:              parseInt(nfVenda.numero, 10) || null,
        nf_serie:               nfVenda.serie || null,
        cnpj_destinatario:      cnpjDest,
        cnpj_emitente:          nfVenda.destinatario_cnpj,
        nome_emitente:          nfVenda.destinatario_nome,
        municipio_emitente:     dest.CIDADE || nfVenda.cidade_destino || null,
        uf_emitente:            dest.UF || nfVenda.uf_destino || null,
        dt_emissao:             dtEmissaoNF,       // data de emissão da NF de venda
        dt_devolucao:           dtDev,             // data em que ocorreu a devolução
        dt_recebimento_oobj:    new Date().toISOString(),
        valor:                  parseFloat(nfVenda.valor_mercadoria) || parseFloat(nfVenda.valor_produtos) || 0,
        valor_produtos:         parseFloat(nfVenda.valor_mercadoria) || parseFloat(nfVenda.valor_produtos) || 0,
        nat_operacao:           'DEVOLUCAO TOTAL - LANCAMENTO MANUAL',
        cfops:                  ['6202'],
        tipo:                   'devolucao',
        status_portal:          'pendente',
        devolucao_total:        true,
        lancamento_manual:      true,
        motivo_devolucao:       motivoFinal,
        area_responsavel:       areaMotivo,
        nf_venda_localizada:    true,
        inf_complementar:       obs || null,
        chave_nfe_referenciada: nfVenda.chave_nfe,
        xml_baixado:            false,
        raw_json: {
          nf_venda_numero:      nfVenda.numero,
          nf_venda_serie:       nfVenda.serie,
          dt_devolucao:         dtDev,            // data em que ocorreu a devolução
          transportador:        nfVenda.transportador_nome,
          transportador_cnpj:   nfVenda.transportador_cnpj,
          pedido:               nfVenda.pedido,
          centro_custo:         nfVenda.observacao || nfVenda.centro_custo,
          lancado_por:          user?.name || user?.email,
          lancado_em:           new Date().toISOString(),
        },
      };

      const { error: err } = await supabase.from('oobj_nfe_recebidas').insert(row);
      if (err) throw new Error(`Erro ao salvar: ${err.message} (código: ${err.code})`);
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
                onChange={e => { setChave(e.target.value.replace(/\D/g, '')); setOpcoes([]); setBuscaMsg(''); }}
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

          {/* Busca por número + série */}
          <div>
            <label className="input-label">Ou busque pelo número e série da NF de venda</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 2 }} inputMode="numeric" placeholder="Número da NF (ex.: 238657)"
                value={numBusca} onChange={e => setNumBusca(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && buscarPorNumero()}/>
              <input className="input" style={{ flex: 1 }} inputMode="numeric" placeholder="Série" maxLength={3}
                value={serieBusca} onChange={e => setSerieBusca(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && buscarPorNumero()}/>
              <button type="button" className="btn btn-primary btn-sm" onClick={buscarPorNumero} disabled={buscandoNum}>
                {buscandoNum ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {buscaMsg && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{buscaMsg}</div>}
            {opcoes.length > 0 && (
              <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, padding: '6px 10px', background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                  Mais de uma NF encontrada — escolha:
                </div>
                {opcoes.map(o => (
                  <button key={o.chave} type="button" onClick={() => { setChave(o.chave); setOpcoes([]); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 0, borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}>
                    NF {o.numero} · Série {o.serie} · {o.dt ? String(o.dt).slice(0, 10).split('-').reverse().join('/') : '—'} · {o.cliente || '—'}
                    {o.rem === '05207076000459' ? ' · CHOCOLATE' : ' · MIX'}
                  </button>
                ))}
              </div>
            )}
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
                <label className="input-label">Data em que o cliente devolveu *</label>
                <input type="date" value={dtDev}
                  min="2020-01-01" max={new Date().toISOString().slice(0,10)}
                  onChange={e => {
                    const v = e.target.value;
                    if (v && v.split('-')[0].length <= 4) setDtDev(v);
                  }}
                  className="input"/>
                {dtDev && new Date(dtDev) > new Date() && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ Data futura — verifique</div>
                )}
                {dtDev && dtDev.split('-')[0] !== '2026' && dtDev.split('-')[0] !== '2025' && dtDev.split('-')[0] !== '2024' && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ Ano inválido: {dtDev.split('-')[0]}</div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
                  A data de emissão da NF de venda é preenchida automaticamente pela chave de acesso
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Motivo da devolução *</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} className="input">
                  <option value="">Selecione o motivo...</option>
                  {(() => {
                    const areas = [...new Set(motivosDB.map(m => m.area))].sort();
                    return areas.map(area => (
                      <optgroup key={area} label={area}>
                        {motivosDB.filter(m => m.area === area).map(m => (
                          <option key={m.motivo} value={m.motivo}>{m.motivo}</option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
                {motivo && motivosDB.find(m => m.motivo === motivo) && (
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Área responsável:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-dim)', padding: '1px 8px', borderRadius: 20 }}>
                      {motivosDB.find(m => m.motivo === motivo)?.area}
                    </span>
                  </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {!nfVenda && chaveOk && !buscando && (
              <div style={{ fontSize: 10.5, color: 'var(--red)' }}>NF de venda não localizada</div>
            )}
            {nfVenda && !motivo && (
              <div style={{ fontSize: 10.5, color: 'var(--yellow)' }}>Selecione o motivo da devolução</div>
            )}
            <button onClick={handleSubmit} disabled={saving || !nfVenda || !motivo}
              className="btn btn-sm"
              title={!nfVenda ? 'Aguarde o carregamento da NF de venda' : !motivo ? 'Selecione o motivo' : ''}
              style={{ background: nfVenda && motivo ? 'var(--purple)' : 'var(--border-2)', color: nfVenda && motivo ? '#fff' : 'var(--text-3)', cursor: nfVenda && motivo ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Registrando...' : 'Registrar devolução'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
