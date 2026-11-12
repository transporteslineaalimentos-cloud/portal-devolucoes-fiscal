import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetClienteFrete } from '../config/supabase';

/* Extrato de custos de frete de um cliente no período da aba: faturamento,
   frete venda, cada custo extra separado, mês a mês, transportadores,
   lojas da rede, CT-es e NFs. */

const n = (v) => Number(v) || 0;
const brl = (v) => 'R$ ' + n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => (n(b) ? (n(a) / n(b) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '—');
const dataBR = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesBR = (ym) => ym ? `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}` : '';
const nomeT = (s) => !s ? '' : s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase())
  .replace(/\b(Ltda|S\/a|S\.a\.?|Eireli|Me|Epp)\b/gi, (m) => m.toUpperCase());
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || ''; };
const TIPO = { 'ENTREGA NORMAL': 'Entrega normal (frete venda)', DIARIA: 'Diária', DEVOLUCAO: 'Devolução', COMPLEMENTAR: 'Complementar (sem tipo)' };
const tipoT = (t) => TIPO[t] || nomeT(t);
const COR_VENDA = 'var(--blue, #2457c5)';
const COR_EXTRA = '#d9822b';

function Kpi({ l, v, s, cor }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 150, flex: '1 1 150px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {cor && <span style={{ width: 8, height: 8, borderRadius: 99, background: cor }}/>}{l}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s}</div>}
    </div>
  );
}

const th = { padding: '7px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--surface)' };
const thN = { ...th, textAlign: 'right' };
const thS = { ...th, position: 'sticky', top: 0, zIndex: 1 };
const thSN = { ...thS, textAlign: 'right' };
const td = { padding: '7px 10px', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)' };
const tdN = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const tdT = { ...tdN, fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)' };

function Secao({ titulo, children, direita }) {
  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{titulo}</h3>{direita}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>{children}</div>
    </section>
  );
}

async function baixarExtrato(r, periodo) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais';
  const BRL = '"R$" #,##0.00';
  const nome = nomeT(r.rede ? r.nome_rede : r.nome) || fmtCnpj(r.cnpj);
  const cab = (ws, cols, linha) => {
    ws.columns = cols.map(c => ({ width: c.w }));
    const row = ws.getRow(linha);
    cols.forEach((c, i) => { const cell = row.getCell(i + 1); cell.value = c.t; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4DB7' } }; });
  };
  const linhas = (ws, cols, dados, ini) => dados.forEach((d, i) => {
    const row = ws.getRow(ini + i);
    cols.forEach((c, j) => {
      let v = c.v(d);
      if (c.f === 'data') { const m = v ? String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null; v = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
      const cell = row.getCell(j + 1); cell.value = v ?? '';
      if (c.f === 'brl') cell.numFmt = BRL; if (c.f === 'data') cell.numFmt = 'dd/mm/yyyy'; if (c.f === 'pct') cell.numFmt = '0.00%';
    });
  });
  const k = r.kpis || {};
  const res = wb.addWorksheet('Resumo');
  res.getCell('A1').value = `Extrato de custos de frete · ${nome}`; res.getCell('A1').font = { bold: true, size: 14 };
  res.getCell('A2').value = `${r.rede ? 'Rede (raiz ' + String(r.cnpj).slice(0, 8) + ')' : 'CNPJ ' + fmtCnpj(r.cnpj)} · ${periodo}`;
  [['Faturamento', k.faturamento, 'brl'], ['NFs de venda', k.qtd_nfs], ['Frete venda (entrega normal)', k.frete_venda, 'brl'], ['Custo extra', k.custo_extra, 'brl'],
   ['Frete total', k.frete_total, 'brl'], ['% frete total / faturamento', n(k.faturamento) ? n(k.frete_total) / n(k.faturamento) : null, 'pct'], ['CT-es', k.qtd_ctes]]
    .forEach(([l, v, f], i) => { res.getCell(4 + i, 1).value = l; const c = res.getCell(4 + i, 2); c.value = v ?? ''; if (f === 'brl') c.numFmt = BRL; if (f === 'pct') c.numFmt = '0.00%'; });
  res.getColumn(1).width = 34; res.getColumn(2).width = 20;
  const colT = [{ t: 'Tipo de custo', w: 32, v: d => tipoT(d.tipo) }, { t: 'Categoria', w: 14, v: d => d.categoria === 'FRETE VENDA' ? 'Frete venda' : 'Custo extra' },
    { t: 'Valor', w: 16, v: d => n(d.valor), f: 'brl' }, { t: '% do faturamento', w: 16, v: d => n(k.faturamento) ? n(d.valor) / n(k.faturamento) : null, f: 'pct' },
    { t: '% do frete', w: 12, v: d => n(k.frete_total) ? n(d.valor) / n(k.frete_total) : null, f: 'pct' }, { t: 'CT-es', w: 8, v: d => d.qtd_ctes }, { t: 'NFs', w: 8, v: d => d.qtd_nfs }];
  cab(res, colT, 13); linhas(res, colT, r.por_tipo || [], 14);
  res.getColumn(1).width = 34;
  const wm = wb.addWorksheet('Mês a mês');
  const colM = [{ t: 'Mês', w: 10, v: d => mesBR(d.mes) }, { t: 'Faturamento', w: 16, v: d => n(d.faturamento), f: 'brl' }, { t: 'NFs', w: 7, v: d => d.qtd_nfs },
    { t: 'Frete venda', w: 15, v: d => n(d.frete_venda), f: 'brl' }, { t: 'Custo extra', w: 15, v: d => n(d.custo_extra), f: 'brl' },
    { t: 'Frete total', w: 15, v: d => n(d.frete_venda) + n(d.custo_extra), f: 'brl' }, { t: '% frete', w: 9, v: d => n(d.faturamento) ? (n(d.frete_venda) + n(d.custo_extra)) / n(d.faturamento) : null, f: 'pct' }];
  cab(wm, colM, 1); linhas(wm, colM, r.mensal || [], 2);
  const wt = wb.addWorksheet('Transportadores');
  const colTr = [{ t: 'Transportador', w: 40, v: d => nomeT(d.nome) }, { t: 'Frete venda', w: 15, v: d => n(d.frete_venda), f: 'brl' }, { t: 'Custo extra', w: 15, v: d => n(d.custo_extra), f: 'brl' },
    { t: 'Total', w: 15, v: d => n(d.valor), f: 'brl' }, { t: 'CT-es', w: 8, v: d => d.qtd_ctes }];
  cab(wt, colTr, 1); linhas(wt, colTr, r.por_transportador || [], 2);
  if (r.rede && (r.por_loja || []).length) {
    const wl = wb.addWorksheet('Lojas');
    const colL = [{ t: 'CNPJ', w: 20, v: d => fmtCnpj(d.cnpj) }, { t: 'Loja', w: 40, v: d => nomeT(d.nome) }, { t: 'Faturamento', w: 16, v: d => n(d.faturamento), f: 'brl' },
      { t: 'NFs', w: 7, v: d => d.qtd_nfs }, { t: 'Frete total', w: 15, v: d => n(d.frete), f: 'brl' }, { t: 'Custo extra', w: 15, v: d => n(d.custo_extra), f: 'brl' },
      { t: '% frete', w: 9, v: d => n(d.faturamento) ? n(d.frete) / n(d.faturamento) : null, f: 'pct' }];
    cab(wl, colL, 1); linhas(wl, colL, r.por_loja, 2);
  }
  const wc = wb.addWorksheet('CT-es');
  const colC = [{ t: 'CT-e', w: 11, v: d => d.cte_numero }, { t: 'Emissão CT-e', w: 12, v: d => d.dt, f: 'data' }, { t: 'Emissão NF', w: 12, v: d => d.dt_nf, f: 'data' },
    { t: 'Transportador', w: 36, v: d => nomeT(d.transp_nome) }, { t: 'Tipo de custo', w: 26, v: d => tipoT(d.tipo) }, { t: 'NFs', w: 22, v: d => d.nfs },
    ...(r.rede ? [{ t: 'CNPJ da loja', w: 20, v: d => fmtCnpj(d.dest) }] : []),
    { t: 'Valor do CT-e', w: 15, v: d => n(d.valor_cte), f: 'brl' }, { t: 'Frete deste cliente', w: 16, v: d => n(d.valor), f: 'brl' }];
  cab(wc, colC, 1); linhas(wc, colC, r.ctes || [], 2);
  const wn = wb.addWorksheet('NFs');
  const colN = [{ t: 'NF', w: 11, v: d => d.nf }, { t: 'Emissão', w: 12, v: d => d.dt, f: 'data' }, ...(r.rede ? [{ t: 'CNPJ da loja', w: 20, v: d => fmtCnpj(d.cnpj) }] : []),
    { t: 'Valor da NF', w: 15, v: d => n(d.valor), f: 'brl' }, { t: 'Frete venda', w: 14, v: d => n(d.frete_venda), f: 'brl' }, { t: 'Custo extra', w: 14, v: d => n(d.custo_extra), f: 'brl' },
    { t: 'Frete total', w: 14, v: d => n(d.frete), f: 'brl' }, { t: '% frete', w: 9, v: d => n(d.valor) ? n(d.frete) / n(d.valor) : null, f: 'pct' }];
  cab(wn, colN, 1); linhas(wn, colN, r.nfs || [], 2);

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url;
  a.download = `Extrato de frete - ${nome}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 110) + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ModalClienteFrete({ cliente, de, ate, remetente, periodoTxt, onClose }) {
  const [rede, setRede] = useState(false);
  const [r, setR] = useState(null);
  const [erro, setErro] = useState('');
  const [lista, setLista] = useState('ctes');
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    let vivo = true; setR(null); setErro('');
    dbGetClienteFrete({ de, ate, cnpj: cliente.cnpj, rede, remetente })
      .then(x => { if (vivo) setR(x); }).catch(e => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [cliente.cnpj, de, ate, rede, remetente]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  const k = r?.kpis || {};
  const fat = n(k.faturamento), ft = n(k.frete_total);
  const extras = (r?.por_tipo || []).filter(t => t.categoria !== 'FRETE VENDA');
  const venda = (r?.por_tipo || []).filter(t => t.categoria === 'FRETE VENDA');
  const linhasLista = useMemo(() => {
    const base = (lista === 'ctes' ? r?.ctes : r?.nfs) || [];
    const q = busca.trim().toLowerCase();
    return !q ? base : base.filter(x => JSON.stringify(x).toLowerCase().includes(q));
  }, [r, lista, busca]);
  const nome = nomeT(rede ? (r?.nome_rede || cliente.nome) : (r?.nome || cliente.nome));

  return createPortal((
    <div className="modal-overlay" style={{ zIndex: 600 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal cf-modal-ctes" role="dialog" aria-label={`Extrato de frete — ${nome}`}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Extrato de custos de frete</div>
              <h2 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{nome || 'Cliente'}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                {rede ? `Todas as lojas da raiz ${String(cliente.cnpj).slice(0, 8)}` : `CNPJ ${fmtCnpj(cliente.cnpj)}`} · {periodoTxt}{remetente ? ' · filtro de remetente da aba' : ''} · só NFs de venda, pela data da NF
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={rede} onChange={e => setRede(e.target.checked)}/> Toda a rede (mesma raiz)
              </label>
              <button className="btn btn-outline btn-sm" style={{ height: 32 }} disabled={!r || baixando}
                onClick={async () => { setBaixando(true); try { await baixarExtrato(r, periodoTxt); } catch (e) { alert('Erro ao gerar o Excel: ' + e.message); } setBaixando(false); }}>
                {baixando ? 'Gerando…' : 'Baixar Excel'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar" style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }}>×</button>
            </div>
          </div>
        </div>

        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0, padding: '14px 22px 22px' }}>
          {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>Não foi possível carregar: {erro}</div>}
          {!r && !erro && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Carregando extrato…</div>}
          {r && !n(k.qtd_nfs) && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Nenhuma NF de venda para este cliente no período.</div>}
          {r && n(k.qtd_nfs) > 0 && (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Kpi l="Faturamento" v={brl(fat)} s={`${k.qtd_nfs} NFs de venda`}/>
                <Kpi l="Frete venda" cor={COR_VENDA} v={brl(k.frete_venda)} s={`${pct(k.frete_venda, fat)} do faturamento`}/>
                <Kpi l="Custo extra" cor={COR_EXTRA} v={brl(k.custo_extra)} s={`${pct(k.custo_extra, fat)} do faturamento`}/>
                <Kpi l="Frete total" v={brl(ft)} s={`${pct(ft, fat)} do faturamento · ${k.qtd_ctes} CT-es`}/>
              </div>
              {n(k.qtd_nfs) > n(k.nfs_com_frete) && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
                  {n(k.qtd_nfs) - n(k.nfs_com_frete)} NF(s) do período ainda sem CT-e recebido.
                </div>
              )}

              <Secao titulo="Custos por tipo">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Tipo de custo</th><th style={thN}>Valor</th><th style={thN}>% do faturamento</th><th style={thN}>% do frete</th><th style={thN}>CT-es</th><th style={thN}>NFs</th></tr></thead>
                  <tbody>
                    {venda.map(t => (
                      <tr key={t.tipo}><td style={{ ...td, color: 'var(--text)', fontWeight: 600 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: COR_VENDA, marginRight: 6 }}/>{tipoT(t.tipo)}</td>
                        <td style={tdN}>{brl(t.valor)}</td><td style={tdN}>{pct(t.valor, fat)}</td><td style={tdN}>{pct(t.valor, ft)}</td><td style={tdN}>{t.qtd_ctes}</td><td style={tdN}>{t.qtd_nfs}</td></tr>
                    ))}
                    {extras.length > 0 && (
                      <tr><td style={{ ...td, color: 'var(--text)', fontWeight: 700 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: COR_EXTRA, marginRight: 6 }}/>Custo extra</td>
                        <td style={{ ...tdN, fontWeight: 700, color: 'var(--text)' }}>{brl(k.custo_extra)}</td><td style={{ ...tdN, fontWeight: 700 }}>{pct(k.custo_extra, fat)}</td><td style={{ ...tdN, fontWeight: 700 }}>{pct(k.custo_extra, ft)}</td><td style={tdN}/><td style={tdN}/></tr>
                    )}
                    {extras.map(t => (
                      <tr key={t.tipo}><td style={{ ...td, paddingLeft: 30 }}>{tipoT(t.tipo)}</td>
                        <td style={tdN}>{brl(t.valor)}</td><td style={tdN}>{pct(t.valor, fat)}</td><td style={tdN}>{pct(t.valor, ft)}</td><td style={tdN}>{t.qtd_ctes}</td><td style={tdN}>{t.qtd_nfs}</td></tr>
                    ))}
                    <tr><td style={{ ...td, fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)' }}>Frete total</td>
                      <td style={tdT}>{brl(ft)}</td><td style={tdT}>{pct(ft, fat)}</td><td style={tdT}>100%</td><td style={tdT}>{k.qtd_ctes}</td><td style={tdT}>{k.nfs_com_frete}</td></tr>
                  </tbody>
                </table>
              </Secao>

              {(r.mensal || []).length > 1 && (
                <Secao titulo="Mês a mês (pela data da NF)">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Mês</th><th style={thN}>Faturamento</th><th style={thN}>NFs</th><th style={thN}>Frete venda</th><th style={thN}>Custo extra</th><th style={thN}>Frete total</th><th style={thN}>% frete</th></tr></thead>
                    <tbody>{r.mensal.map(m => (
                      <tr key={m.mes}><td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{mesBR(m.mes)}</td><td style={tdN}>{brl(m.faturamento)}</td><td style={tdN}>{m.qtd_nfs}</td>
                        <td style={tdN}>{brl(m.frete_venda)}</td><td style={tdN}>{brl(m.custo_extra)}</td><td style={{ ...tdN, fontWeight: 600, color: 'var(--text)' }}>{brl(n(m.frete_venda) + n(m.custo_extra))}</td>
                        <td style={tdN}>{pct(n(m.frete_venda) + n(m.custo_extra), m.faturamento)}</td></tr>
                    ))}</tbody>
                  </table>
                </Secao>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: rede && (r.por_loja || []).length > 1 ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr', gap: '0 16px' }}>
                <Secao titulo="Transportadores">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Transportador</th><th style={thN}>Frete venda</th><th style={thN}>Custo extra</th><th style={thN}>Total</th><th style={thN}>CT-es</th></tr></thead>
                    <tbody>{(r.por_transportador || []).map(t => (
                      <tr key={t.raiz}><td style={td}>{nomeT(t.nome)}</td><td style={tdN}>{brl(t.frete_venda)}</td><td style={tdN}>{brl(t.custo_extra)}</td>
                        <td style={{ ...tdN, fontWeight: 600, color: 'var(--text)' }}>{brl(t.valor)}</td><td style={tdN}>{t.qtd_ctes}</td></tr>
                    ))}</tbody>
                  </table>
                </Secao>
                {rede && (r.por_loja || []).length > 1 && (
                  <Secao titulo={`Lojas da rede (${r.por_loja.length})`}>
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Loja</th><th style={thN}>Faturamento</th><th style={thN}>Frete</th><th style={thN}>% frete</th></tr></thead>
                        <tbody>{r.por_loja.map(l => (
                          <tr key={l.cnpj}><td style={td}><div style={{ color: 'var(--text)' }}>{nomeT(l.nome)}</div><div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{fmtCnpj(l.cnpj)} · {l.qtd_nfs} NFs</div></td>
                            <td style={tdN}>{brl(l.faturamento)}</td><td style={tdN}>{brl(l.frete)}</td><td style={tdN}>{pct(l.frete, l.faturamento)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Secao>
                )}
              </div>

              <Secao titulo="Detalhe" direita={
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className={`btn btn-sm ${lista === 'ctes' ? 'btn-primary' : 'btn-outline'}`} style={{ height: 28 }} onClick={() => setLista('ctes')}>CT-es ({(r.ctes || []).length})</button>
                  <button className={`btn btn-sm ${lista === 'nfs' ? 'btn-primary' : 'btn-outline'}`} style={{ height: 28 }} onClick={() => setLista('nfs')}>NFs ({(r.nfs || []).length})</button>
                  <input className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" style={{ width: 180, height: 28, fontSize: 12 }}/>
                </div>}>
                <div style={{ maxHeight: 420, overflow: 'auto' }}>
                  {lista === 'ctes' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                      <thead><tr><th style={thS}>CT-e</th><th style={thS}>Emissão</th><th style={thS}>Transportador</th><th style={thS}>Tipo de custo</th><th style={thS}>NFs</th>{rede && <th style={thS}>Loja</th>}<th style={thSN}>Valor do CT-e</th><th style={thSN}>Frete deste cliente</th></tr></thead>
                      <tbody>{linhasLista.slice(0, 500).map((c, i) => (
                        <tr key={c.cte_numero + '|' + i}><td style={{ ...td, fontWeight: 700, color: 'var(--text)' }}>{c.cte_numero}</td><td style={td}>{dataBR(c.dt)}</td><td style={td}>{nomeT(c.transp_nome)}</td>
                          <td style={td}><span style={{ color: c.categoria === 'FRETE VENDA' ? COR_VENDA : COR_EXTRA, fontWeight: 600 }}>{tipoT(c.tipo)}</span></td><td style={td}>{c.nfs}</td>
                          {rede && <td style={td}>{fmtCnpj(c.dest)}</td>}
                          <td style={tdN}>{brl(c.valor_cte)}</td><td style={{ ...tdN, fontWeight: 600, color: 'var(--text)' }}>{brl(c.valor)}</td></tr>
                      ))}</tbody>
                    </table>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                      <thead><tr><th style={thS}>NF</th><th style={thS}>Emissão</th>{rede && <th style={thS}>Loja</th>}<th style={thSN}>Valor da NF</th><th style={thSN}>Frete venda</th><th style={thSN}>Custo extra</th><th style={thSN}>Frete total</th><th style={thSN}>% frete</th></tr></thead>
                      <tbody>{linhasLista.slice(0, 500).map((x, i) => (
                        <tr key={x.nf + '|' + i}><td style={{ ...td, fontWeight: 700, color: 'var(--text)' }}>{x.nf}</td><td style={td}>{dataBR(x.dt)}</td>{rede && <td style={td}>{fmtCnpj(x.cnpj)}</td>}
                          <td style={tdN}>{brl(x.valor)}</td><td style={tdN}>{brl(x.frete_venda)}</td><td style={tdN}>{brl(x.custo_extra)}</td>
                          <td style={{ ...tdN, fontWeight: 600, color: n(x.frete) ? 'var(--text)' : 'var(--text-3)' }}>{n(x.frete) ? brl(x.frete) : 'sem CT-e'}</td><td style={tdN}>{pct(x.frete, x.valor)}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                  {linhasLista.length > 500 && <div style={{ padding: 10, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Mostrando 500 de {linhasLista.length}. O Excel traz todas.</div>}
                </div>
              </Secao>
            </>
          )}
        </div>
      </div>
    </div>
  ), document.fullscreenElement || document.body);
}
