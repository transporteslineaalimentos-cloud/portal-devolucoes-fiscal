import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetCustosFreteCtes } from '../config/supabase';

/* Lista dos CT-es por trás de um número da aba Custos de Frete.
   Recebe os mesmos filtros da aba já combinados com o recorte clicado
   (mês, tipo, transportador, destinatário, UF...). */

const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
const titulo = (s) => !s ? '' : s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase())
  .replace(/\b(Ltda|S\/a|S\.a\.?|Eireli|Me|Epp)\b/gi, (m) => m.toUpperCase());
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || ''; };
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const OPERACAO = { VENDA: 'Venda', TRANSFERENCIA: 'Transferência' };
const opLabel = (o) => String(o || '').split(',').map(x => OPERACAO[x] || x).join(' + ');

export default function ModalCtesFrete({ titulo: tit, sub, params, filtrar, onFiltrar, onClose }) {
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('valor');
  const [aberto, setAberto] = useState(null);
  const [mostrar, setMostrar] = useState(150);   // a tabela cresce sob demanda: 3 mil linhas de uma vez travam a tela
  const [baixando, setBaixando] = useState(false);
  /* em tela cheia o navegador só desenha o que está dentro do elemento em
     tela cheia, então o modal precisa ser montado lá dentro. */
  const [alvo, setAlvo] = useState(() => (typeof document !== 'undefined' ? document.fullscreenElement || document.body : null));

  useEffect(() => {
    let vivo = true;
    dbGetCustosFreteCtes(params)
      .then(r => { if (vivo) setRes(r); })
      .catch(e => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [params]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const fs = () => setAlvo(document.fullscreenElement || document.body);
    window.addEventListener('keydown', esc, true);
    document.addEventListener('fullscreenchange', fs);
    return () => { window.removeEventListener('keydown', esc, true); document.removeEventListener('fullscreenchange', fs); };
  }, [onClose]);

  const linhas = useMemo(() => {
    const todas = res?.linhas || [];
    const q = semAcento(busca.trim());
    const filtradas = !q ? todas : todas.filter(l =>
      semAcento([l.cte_numero, l.transp_nome, l.transp_cnpj, l.dest_nome, l.cidade, l.uf, l.tipo, ...(l.nfs || []).map(n => n.nf)].join(' ')).includes(q));
    const ord = [...filtradas];
    if (ordem === 'data') ord.sort((a, b) => String(b.dt).localeCompare(String(a.dt)) || b.valor - a.valor);
    else ord.sort((a, b) => b.valor - a.valor);
    return ord;
  }, [res, busca, ordem]);

  const totalVisivel = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const totalNfs = (res?.linhas || []).reduce((s, l) => s + (Number(l.valor_nfs) || 0), 0);
  const truncado = res && res.qtd > (res.linhas || []).length;

  /* O arquivo é montado em pedaços, devolvendo o controle ao navegador entre
     eles, para a tela não congelar em recortes grandes. */
  const baixar = async () => {
    setBaixando(true);
    await new Promise(r => setTimeout(r, 30));
    const cab = ['CT-e', 'Emissão do CT-e', 'Transportador', 'CNPJ transportador', 'Tipo', 'Operação', 'Destinatário', 'Cidade', 'UF',
      'NF', 'Emissão da NF', 'Chave da NF', 'Valor da NF', 'Frete rateado para a NF',
      'Valor total do CT-e', 'Frete considerado no painel', 'Valor das NFs do CT-e', 'Origem'];
    const num = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
    const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [cab.join(';')];
    let desde = Date.now();
    for (const l of linhas) {
      if (Date.now() - desde > 60) { await new Promise(r => setTimeout(r, 0)); desde = Date.now(); }
      for (const n of (l.nfs || [])) {
      out.push([l.cte_numero, dataBR(l.dt), l.transp_nome, fmtCnpj(l.transp_cnpj), l.tipo, OPERACAO[n.operacao] || n.operacao,
        l.dest_nome, l.cidade, l.uf, n.nf, dataBR(n.dt), n.chave, num(n.valor_nf), num(n.rateio),
        num(l.valor_cte), num(l.valor), num(l.valor_nfs),
        l.origem === 'planilha' ? 'Planilha importada' : 'Recebimento automático'].map(esc).join(';'));
      }
    }
    const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CT-es ${tit}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setBaixando(false);
  };

  const th = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 };
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
  const tdN = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  if (!alvo) return null;
  return createPortal((
    <div className="modal-overlay" style={{ zIndex: 600 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal cf-modal-ctes" role="dialog" aria-label={`CT-es — ${tit}`}>
        <div style={{ padding: '18px 22px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CT-es</div>
              <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{tit}</h2>
              {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar" style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }}>×</button>
          </div>
          {res && (
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>Frete considerado</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{brl(res.total)}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>CT-es</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{Number(res.qtd).toLocaleString('pt-BR')}</div></div>
              {totalNfs > 0 && (
                <div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>% sobre o valor das NFs</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                    {((Number(res.total) / totalNfs) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </div></div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <input className="input" placeholder="Buscar CT-e, NF, transportador, cliente, cidade…" value={busca}
              onChange={e => { setBusca(e.target.value); setMostrar(150); }} style={{ flex: '1 1 260px', height: 32, fontSize: 12.5 }}/>
            <select className="input" value={ordem} onChange={e => { setOrdem(e.target.value); setMostrar(150); }} style={{ width: 150, height: 32, fontSize: 12.5 }} aria-label="Ordenar">
              <option value="valor">Maior valor</option>
              <option value="data">Mais recentes</option>
            </select>
            <button className="btn btn-outline btn-sm" style={{ height: 32 }} onClick={baixar} disabled={!linhas.length || baixando}>
              {baixando ? 'Gerando…' : 'Baixar planilha'}
            </button>
            {filtrar && onFiltrar && (
              <button className="btn btn-primary btn-sm" style={{ height: 32 }} onClick={() => { onFiltrar(); onClose(); }}>{filtrar}</button>
            )}
          </div>
        </div>

        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {erro && <div style={{ padding: 22, color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar os CT-es: {erro}</div>}
          {!res && !erro && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Carregando CT-es…</div>}
          {res && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={th}>CT-e</th><th style={th} title="Data em que o CT-e foi emitido; o custo entra no mês da NF">Emissão CT-e</th><th style={th}>Transportador</th><th style={th}>Tipo</th>
                  <th style={th}>Destino</th><th style={th}>NFs</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor do CT-e</th>
                  <th style={{ ...th, textAlign: 'right' }} title="Valor das notas fiscais transportadas neste CT-e">Valor das NFs</th>
                  <th style={{ ...th, textAlign: 'right' }} title="Frete dividido pelo valor das notas">% da NF</th>
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, mostrar).map((l, i) => {
                  const k = l.transp_cnpj + '|' + l.cte_numero + '|' + i;
                  const open = aberto === k;
                  const nfs = l.nfs || [];
                  const parcial = Number(l.valor_cte) - Number(l.valor) > 0.01;
                  return (
                    <Fragment key={k}>
                      <tr className="cf-cte-linha" onClick={() => setAberto(open ? null : k)} style={{ cursor: 'pointer', background: open ? 'var(--surface-2)' : undefined }}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', width: 12, color: 'var(--text-3)', fontWeight: 400 }}>{open ? '▾' : '▸'}</span>{l.cte_numero}
                          {l.origem === 'planilha' && <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text-3)', marginLeft: 12 }}>planilha importada</div>}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataBR(l.dt)}</td>
                        <td style={td}><div style={{ color: 'var(--text)' }}>{titulo(l.transp_nome)}</div><div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{fmtCnpj(l.transp_cnpj)}</div></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {titulo(l.tipo)}
                          {String(l.operacao).includes('TRANSFERENCIA') && <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{opLabel(l.operacao)}</div>}
                        </td>
                        <td style={td}><div style={{ color: 'var(--text)' }}>{titulo(l.dest_nome)}</div><div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{[titulo(l.cidade), l.uf].filter(Boolean).join(' / ')}</div></td>
                        <td style={{ ...td, maxWidth: 160 }}>
                          {nfs.slice(0, 3).map(n => n.nf).join(', ')}{nfs.length > 3 ? ` +${nfs.length - 3}` : ''}
                        </td>
                        <td style={{ ...tdN, fontWeight: 700, color: 'var(--text)' }}>
                          {brl(l.valor_cte)}
                          {parcial && (
                            <div style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text-3)' }}
                              title="Parte do CT-e é de NFs que não entram no painel (remessa, bonificação etc.)">
                              no painel {brl(l.valor)}
                            </div>
                          )}
                        </td>
                        <td style={tdN}>{brl(l.valor_nfs)}</td>
                        <td style={{ ...tdN, fontWeight: 600, color: 'var(--text)' }}>
                          {Number(l.valor_nfs) > 0 ? ((Number(l.valor) / Number(l.valor_nfs)) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—'}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={9} style={{ padding: '4px 10px 12px 32px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 760 }}>
                              <thead>
                                <tr>
                                  {['NF', 'Emissão', 'Operação', 'Chave de acesso', 'Valor da NF', 'Frete rateado'].map((h, j) => (
                                    <th key={h} style={{ padding: '6px 8px', fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textAlign: j >= 4 ? 'right' : 'left' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {nfs.map(n => (
                                  <tr key={n.chave}>
                                    <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.nf}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{dataBR(n.dt)}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-2)' }}>{OPERACAO[n.operacao] || n.operacao}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{n.chave}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(n.valor_nf)}</td>
                                    <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text)' }}>{brl(n.rateio)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {parcial && (
                              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, paddingLeft: 8 }}>
                                O CT-e também leva NFs que não entram no painel (remessa, bonificação etc.); só a parte rateada para as NFs acima foi considerada.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {linhas.length === 0 && (
                  <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: 30, color: 'var(--text-3)' }}>Nenhum CT-e encontrado.</td></tr>
                )}
                {linhas.length > mostrar && (
                  <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: 14 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setMostrar(m => m + 300)}>
                      Mostrar mais {Math.min(300, linhas.length - mostrar).toLocaleString('pt-BR')} de {(linhas.length - mostrar).toLocaleString('pt-BR')} restantes
                    </button>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {res && (
          <div style={{ padding: '10px 22px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>{linhas.length.toLocaleString('pt-BR')} CT-e{linhas.length === 1 ? '' : 's'} na lista · {brl(totalVisivel)}{busca ? ' (busca aplicada)' : ''}
              {linhas.length > mostrar ? ` · mostrando ${mostrar.toLocaleString('pt-BR')}` : ''} · a planilha traz tudo</span>
            {truncado && <span>Mostrando os {res.linhas.length.toLocaleString('pt-BR')} de maior valor; use um período menor para ver todos.</span>}
            <span>O período segue a emissão da NF · clique em um CT-e para ver as NFs e o rateio.</span>
          </div>
        )}
      </div>
    </div>
  ), alvo);
}
