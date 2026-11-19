import { useEffect, useState } from 'react';
import { dbCobrancaAcao, dbGetDevolucaoDetail, dbGetXmlUrl } from '../config/supabase';
import { somenteLeitura } from '../lib/permissoes.js';
import { SITUACAO_TXT, valorACobrar } from '../utils/espelhoCobranca.js';
import { fmtBRL, fmtDate, fmtCNPJ, fmtDateTime, BadgeCobranca } from '../utils.jsx';
import { numProtheus, qtdTxt } from '../utils/notaDebito.js';
import RetornoCDSection from './RetornoCDSection.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function SectionCard({ title, icon, color = 'var(--blue)', children, action }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
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

function DataItem({ label, value, accent, full }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: accent || 'var(--text)', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

export default function ModalCobranca({ row, user, onClose, onSaved, onMontar, onAbrirLote }) {
  const [obs, setObs]           = useState(row.obs_cobranca || '');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [mode, setMode]         = useState(null); // 'isentar'
  const [verXml, setVerXml]     = useState(false);
  const leitura = somenteLeitura(user);
  const [detail, setDetail]     = useState(null);
  const [, setLoading]          = useState(true);

  const isPendente = row.status_cobranca === 'pendente_cobranca_transportador' && !row.lote_id;
  const itensCobrar = Array.isArray(row.itens_cobrar) ? row.itens_cobrar : [];

  useEffect(() => {
    let active = true;
    setLoading(true);
    dbGetDevolucaoDetail(row.id)
      .then(d => { if (active) setDetail(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [row.id]);

  const dev   = detail?.dev || row;
  const nfV   = detail?.nfVenda;
  const itens = Array.isArray(dev?.itens) ? dev.itens : [];
  const totalItens = itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);

  const handleXml = async () => {
    try { const url = await dbGetXmlUrl(dev.xml_path); if (url) window.open(url, '_blank'); }
    catch (e) { alert('Erro: ' + e.message); }
  };

  const handleIsentar = async () => {
    if (!obs.trim()) { setErr('Informe o motivo da isenção.'); return; }
    setSaving(true); setErr('');
    try {
      await dbCobrancaAcao([row.id], 'isentar', { obs: obs.trim() });
      onSaved?.(`NF ${row.nf_numero} isenta de cobrança.`);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleReabrir = async () => {
    setSaving(true); setErr('');
    try {
      await dbCobrancaAcao([row.id], 'reabrir');
      onSaved?.(`NF ${row.nf_numero} reaberta.`);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={{ width: 640 }}>

        {/* ── Cabeçalho hero ── */}
        <div className="dd-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 6 }}>
                Cobrança de transportador
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  NF-e {dev?.nf_numero ?? '—'}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Série {dev?.nf_serie ?? '—'}</span>
                <BadgeCobranca status={row.status_cobranca}/>
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', fontWeight: 500, marginTop: 8 }}>
                {dev?.nome_emitente}
                {dev?.municipio_emitente && ` · ${dev.municipio_emitente}`}
                {dev?.uf_emitente && ` / ${dev.uf_emitente}`}
              </div>
            </div>
            <button onClick={onClose} className="dd-close">
              <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
            </button>
          </div>

          {/* KPIs */}
          <div className="dd-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="dd-kpi">
              <span className="dd-kpi-label">{row.status_cobranca === 'cobrado' ? 'Valor cobrado' : 'Valor a cobrar'}</span>
              <span className="dd-kpi-value" style={{ color: '#fff' }}>
                {row.situacao && row.situacao !== 'cobrado' && row.valor_sugerido == null ? 'a definir' : fmtBRL(row.situacao ? valorACobrar(row) : dev.valor)}
              </span>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>produtos {fmtBRL(row.valor_produtos ?? dev.valor)} · nota {fmtBRL(dev.valor)}</span>
            </div>
            <div className="dd-kpi">
              <span className="dd-kpi-label">Motivo</span>
              <span className="dd-kpi-value" style={{ fontSize: 13, color: dev.motivo_devolucao ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {dev.motivo_devolucao || '—'}
              </span>
            </div>
            <div className="dd-kpi">
              <span className="dd-kpi-label">Lançada Protheus</span>
              <span className="dd-kpi-value" style={{ fontSize: 13, color: '#6EE7A8' }}>
                {dev.dt_lancamento_protheus ? fmtDate(dev.dt_lancamento_protheus) : '—'}
              </span>
            </div>
          </div>

          {dev?.xml_baixado && dev?.xml_path && (
            <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
              <button onClick={handleXml} className="dd-action">
                <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={12}/>
                Baixar XML
              </button>
            </div>
          )}
        </div>

        <div className="drawer-body" style={{ padding: '18px 22px 28px' }}>

          {row.situacao && SITUACAO_TXT[row.situacao] && (
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text)' }}>{SITUACAO_TXT[row.situacao]}.</strong>{' '}
              {row.situacao === 'cobrar_integral' && 'O produto não voltou ao CD, então cobra todos os itens da nota (só o valor dos produtos, sem impostos).'}
              {row.situacao === 'cobrar_parcial' && 'O valor sugerido é só o dos itens que o CD conferiu como avaria, falta ou impróprio (veja abaixo em Retorno ao CD).'}
              {row.situacao === 'conferir_cd' && 'Consta retorno ao CD, mas sem a conferência dos itens. Importe a planilha do CD ou informe o valor ao cobrar.'}
              {row.situacao === 'isentar' && 'Todos os itens voltaram em bom estado: não há o que cobrar.'}
              {row.situacao === 'sem_transportador' && 'Vincule o transportador na nota (aba Devoluções) antes de cobrar.'}
            </div>
          )}

          {/* ── Transportador responsável ── */}
          <SectionCard title="Transportador responsável" icon="M3 6h13l3 5v6h-3m-7 0H3V6zm10 11a2 2 0 104 0 2 2 0 00-4 0zM7 17a2 2 0 104 0 2 2 0 00-4 0z" color="var(--gold)">
            {row.transportador_cobranca ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <DataItem label="Razão social" value={row.transportador_cobranca} full/>
                <DataItem label="CNPJ" value={fmtCNPJ(row.transportador_cnpj_cobranca)}/>
                {nfV?.transportador_nome && nfV.transportador_nome !== row.transportador_cobranca && (
                  <DataItem label="Transportador na NF de venda" value={nfV.transportador_nome}/>
                )}
              </div>
            ) : (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
                Não identificado automaticamente. Verifique o transportador pela NF de venda vinculada antes de registrar a cobrança.
              </div>
            )}
          </SectionCard>

          {/* ── Itens a cobrar (código Linea, valor da NF de venda) ── */}
          <SectionCard title="Itens a cobrar" icon="M4 6h16M4 10h16M4 14h16M4 18h16" color="var(--blue)"
            action={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>código Linea · valor líquido da NF de venda</span>}>
            {itensCobrar.length > 0 ? (
              <div style={{ overflowX: 'auto', marginTop: 4 }}>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Produto</th>
                      <th style={{ textAlign: 'right' }}>Qtd</th>
                      <th style={{ textAlign: 'right' }}>Vl. unit.</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensCobrar.map((it, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{it.codigo || '—'}</td>
                        <td style={{ fontWeight: 500 }} title={it.descricao}>
                          {it.descricao}
                          {it.motivo && it.motivo !== 'Não voltou ao CD' && <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{it.motivo.toLowerCase()}</div>}
                          {it.alerta && <div style={{ fontSize: 10.5, color: '#B45309' }}>{it.alerta}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {qtdTxt(it.qtd)} <span style={{ color: 'var(--text-3)' }}>{it.unidade}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                          {it.valor_unitario != null ? numProtheus(it.valor_unitario) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.valor_total != null ? fmtBRL(it.valor_total) : 'a definir'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total a cobrar (só produtos)</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--blue)', fontSize: 13 }}>{fmtBRL(itensCobrar.reduce((s, it) => s + (Number(it.valor_total) || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                {row.situacao === 'conferir_cd' ? 'Voltou ao CD e ainda não tem conferência: importe a planilha do CD para saber o que cobrar.'
                  : row.situacao === 'isentar' ? 'Tudo voltou ao CD em bom estado: nada a cobrar.'
                  : 'Sem itens do Protheus para esta nota.'}
              </div>
            )}
            {itens.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-ghost btn-xs" onClick={() => setVerXml(v => !v)}>{verXml ? 'Esconder' : 'Ver'} itens como vieram na NFD do cliente ({itens.length})</button>
                {verXml && (
                  <table className="items-table" style={{ marginTop: 6 }}>
                    <thead><tr><th>Cód. cliente</th><th>Produto</th><th style={{ textAlign: 'right' }}>Qtd</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                    <tbody>
                      {itens.map((it, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--text-3)' }}>{it.codigo || '—'}</td>
                          <td>{it.descricao}</td>
                          <td style={{ textAlign: 'right' }}>{it.quantidade} {it.unidade}</td>
                          <td style={{ textAlign: 'right' }}>{fmtBRL(it.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={3} style={{ fontSize: 11, color: 'var(--text-3)' }}>Total na NFD do cliente</td><td style={{ textAlign: 'right' }}>{fmtBRL(totalItens)}</td></tr></tfoot>
                  </table>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── NF original de venda ── */}
          {nfV && (
            <SectionCard title="NF original de venda" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" color="var(--purple)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <DataItem label="NF / Série" value={`${nfV.nf_numero}${nfV.nf_serie ? ` · Série ${nfV.nf_serie}` : ''}`}/>
                <DataItem label="Data de entrega" value={nfV.dt_entrega ? `${fmtDate(nfV.dt_entrega)}${nfV.dt_entrega_fonte ? ` · ${nfV.dt_entrega_fonte}` : ''}` : 'sem registro'} accent={nfV.dt_entrega ? 'var(--green)' : 'var(--text-3)'}/>
                <DataItem label="Valor da venda" value={fmtBRL(nfV.valor_produtos)} accent="var(--blue)"/>
                <DataItem label="Destino" value={nfV.cidade_destino && nfV.uf_destino ? `${nfV.cidade_destino} / ${nfV.uf_destino}` : nfV.uf_destino}/>
                <DataItem label="Pedido" value={nfV.pedido}/>
              </div>
            </SectionCard>
          )}

          {/* ── Retorno ao CD ── */}
          <RetornoCDSection dev={dev}/>

          {/* ── Em NF de débito ainda não faturada ── */}
          {row.lote_id && row.situacao === 'em_lote' && (
            <SectionCard title={`Em NF de débito · lote ${row.lote_numero}`} icon="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="#6D4FC2">
              <DataItem label="Etapa" value={row.lote_pedido ? `Pedido ${row.lote_pedido} emitido · aguardando faturamento` : 'Montando (pedido ainda não registrado)'}/>
              <div style={{ paddingTop: 10 }}>
                <button onClick={() => onAbrirLote?.(row.lote_id)} className="btn btn-primary btn-sm">Abrir NF de débito</button>
              </div>
            </SectionCard>
          )}

          {/* ── Estado: já cobrado / isento ── */}
          {!isPendente && row.situacao !== 'em_lote' && (
            <SectionCard
              title={row.status_cobranca === 'cobrado' ? 'Cobrança registrada' : 'Cobrança isenta'}
              icon="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              color={row.status_cobranca === 'cobrado' ? 'var(--green)' : 'var(--text-3)'}>
              {row.nf_debito && (
                <DataItem label="NF de débito" value={<span style={{ fontWeight: 700 }}>{row.nf_debito}</span>}/>
              )}
              {row.status_cobranca === 'cobrado' && (
                <DataItem label="Valor cobrado" value={row.valor_cobrado != null ? fmtBRL(row.valor_cobrado) : `${fmtBRL(dev.valor)} (valor da nota; cobrança registrada antes de existir o campo)`}/>
              )}
              {row.obs_cobranca && <DataItem label="Observação" value={row.obs_cobranca} full/>}
              {row.data_cobranca && (
                <DataItem label="Registrado por" value={`${row.cobrado_por ? row.cobrado_por + ' · ' : ''}${fmtDateTime(row.data_cobranca)}`} full/>
              )}
              {row.lote_pedido && <DataItem label="Pedido de venda" value={row.lote_pedido}/>}
              <div style={{ paddingTop: 10, display: 'flex', gap: 8 }}>
                {row.lote_id && <button onClick={() => onAbrirLote?.(row.lote_id)} className="btn btn-outline btn-sm">Abrir NF de débito</button>}
                {!leitura && !row.lote_id && <button onClick={handleReabrir} disabled={saving} className="btn btn-outline btn-sm">Reabrir cobrança</button>}
                {!leitura && row.lote_id && row.status_cobranca === 'isento' && <button onClick={handleReabrir} disabled={saving} className="btn btn-outline btn-sm">Reabrir</button>}
              </div>
            </SectionCard>
          )}

          {/* ── Ações para pendente ── */}
          {isPendente && !leitura && (
            <SectionCard title="Cobrar ou isentar" icon="M12 8v8m-4-4h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="var(--blue)">
              <div style={{ display: 'flex', gap: 8, margin: '6px 0 4px' }}>
                <button onClick={() => onMontar?.(row)} disabled={row.valor_sugerido == null} className="btn btn-sm btn-primary" style={{ flex: 1 }}
                  title={row.valor_sugerido == null ? 'Falta a conferência do CD' : 'Abre a NF de débito com esta nota; dá para juntar outras depois na lista'}>
                  <Ic d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13}/>
                  Montar NF de débito com esta nota
                </button>
                <button onClick={() => { setMode('isentar'); setErr(''); }} className={`btn btn-sm ${mode === 'isentar' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                  Isentar
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>Para juntar até 3 notas na mesma NF de débito, marque-as na lista e use "Montar NF de débito".</div>

              {mode === 'isentar' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 10 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label className="input-label">Motivo da isenção</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} className="input" rows={2} style={{ resize: 'vertical' }} placeholder="Por que essa NF não será cobrada do transportador?"/>
                  </div>
                  {err && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setMode(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                    <button onClick={handleIsentar} disabled={saving} className="btn btn-primary btn-sm">
                      {saving ? 'Salvando...' : 'Confirmar isenção'}
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
}
