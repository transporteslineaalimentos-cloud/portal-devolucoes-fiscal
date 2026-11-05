/* ─────────────────────────────────────────────────────────────
   Excel dos fretes (aba Custos de Frete): uma aba com um CT-e por
   linha e outra com as NFs de cada CT-e e o frete rateado para cada uma.
───────────────────────────────────────────────────────────── */
const FONT = 'Arial';
const AZUL = '1E4DB7';
const LINHA = 'E2E5EA';
const ZEBRA = 'F7F8FA';
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const OPERACAO = { VENDA: 'Venda', TRANSFERENCIA: 'Transferência' };
const opLabel = (o) => String(o || '').split(',').filter(Boolean).map(x => OPERACAO[x] || x).join(' + ');
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || ''; };
const dataUTC = (s) => {
  const m = s ? String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
const pausa = () => new Promise(r => setTimeout(r, 0));

async function aba(wb, nome, tituloTxt, sub, colunas, linhas) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  ws.columns = colunas.map(c => ({ width: c.w }));
  ws.mergeCells(1, 1, 1, colunas.length);
  ws.getCell(1, 1).value = tituloTxt;
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  ws.getRow(1).height = 22;
  ws.mergeCells(2, 1, 2, colunas.length);
  ws.getCell(2, 1).value = sub;
  ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF5B6472' } };

  const cab = ws.getRow(4);
  colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.t;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(AZUL);
    cell.alignment = { vertical: 'middle', horizontal: c.fmt === 'brl' || c.fmt === 'int' ? 'right' : 'left' };
  });
  cab.height = 20;

  let desde = Date.now();
  for (let li = 0; li < linhas.length; li++) {
    if (Date.now() - desde > 60) { await pausa(); desde = Date.now(); }   // não congela a tela em recortes grandes
    const r = linhas[li];
    const row = ws.getRow(5 + li);
    colunas.forEach((c, i) => {
      let v = c.v(r);
      if (c.fmt === 'data') v = dataUTC(v);
      else if (c.fmt === 'brl' || c.fmt === 'int') v = v == null || v === '' ? null : Number(v);
      else if (v == null) v = '';
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 10 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + LINHA } } };
      if (c.fmt === 'brl') cell.numFmt = BRL;
      if (c.fmt === 'data') cell.numFmt = 'dd/mm/yyyy';
      if (li % 2) cell.fill = fill(ZEBRA);
    });
  }
  if (linhas.length) {
    const tot = ws.getRow(5 + linhas.length);
    tot.getCell(1).value = 'Total';
    tot.getCell(1).font = { name: FONT, size: 10, bold: true };
    colunas.forEach((c, i) => {
      if (c.fmt !== 'brl' && !c.somar) return;
      const L = ws.getColumn(i + 1).letter;
      const cell = tot.getCell(i + 1);
      cell.value = { formula: `SUBTOTAL(9,${L}5:${L}${4 + linhas.length})` };
      cell.font = { name: FONT, size: 10, bold: true };
      if (c.fmt === 'brl') cell.numFmt = BRL;
    });
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + linhas.length, column: colunas.length } };
}

/** linhas: o que vem de get_custos_frete_ctes (um CT-e por linha, com a lista de NFs). */
export async function baixarExcelFrete(linhas, { titulo = 'Custos de frete', sub = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais';
  const gerado = `Gerado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const subTxt = [sub, `${linhas.length.toLocaleString('pt-BR')} CT-es`, gerado].filter(Boolean).join('  ·  ');
  const origem = (l) => (l.origem === 'planilha' ? 'Planilha importada' : 'Recebimento automático');

  await aba(wb, 'CT-es', titulo, subTxt, [
    { t: 'CT-e', w: 11, v: l => l.cte_numero },
    { t: 'Emissão', w: 11, v: l => l.dt, fmt: 'data' },
    { t: 'Transportador', w: 38, v: l => l.transp_nome },
    { t: 'CNPJ transportador', w: 20, v: l => fmtCnpj(l.transp_cnpj) },
    { t: 'Tipo', w: 14, v: l => l.tipo },
    { t: 'Operação', w: 14, v: l => opLabel([...new Set((l.nfs || []).map(n => n.operacao))].join(',')) },
    { t: 'Destinatário', w: 38, v: l => l.dest_nome },
    { t: 'Cidade', w: 22, v: l => l.cidade },
    { t: 'UF', w: 5, v: l => l.uf },
    { t: 'NFs', w: 26, v: l => (l.nfs || []).map(n => n.nf).join(', ') },
    { t: 'Qtd NFs', w: 8, v: l => (l.nfs || []).length, fmt: 'int', somar: true },
    { t: 'Valor das NFs', w: 15, v: l => l.valor_nfs, fmt: 'brl' },
    { t: 'Valor total do CT-e', w: 15, v: l => l.valor_cte, fmt: 'brl' },
    { t: 'Frete considerado', w: 15, v: l => l.valor, fmt: 'brl' },
    { t: '% frete / NFs', w: 10, v: l => (Number(l.valor_nfs) ? ((Number(l.valor) / Number(l.valor_nfs)) * 100).toFixed(2).replace('.', ',') + '%' : '') },
    { t: 'Origem', w: 20, v: origem },
  ], linhas);

  const nfs = [];
  linhas.forEach(l => (l.nfs || []).forEach(n => nfs.push({ l, n })));
  await aba(wb, 'NFs', `${titulo} · por NF`, subTxt, [
    { t: 'NF', w: 11, v: x => x.n.nf },
    { t: 'Emissão da NF', w: 12, v: x => x.n.dt, fmt: 'data' },
    { t: 'Chave da NF', w: 46, v: x => x.n.chave },
    { t: 'Operação', w: 14, v: x => OPERACAO[x.n.operacao] || x.n.operacao },
    { t: 'Valor da NF', w: 15, v: x => x.n.valor_nf, fmt: 'brl' },
    { t: 'Frete rateado', w: 15, v: x => x.n.rateio, fmt: 'brl' },
    { t: 'CT-e', w: 11, v: x => x.l.cte_numero },
    { t: 'Emissão do CT-e', w: 12, v: x => x.l.dt, fmt: 'data' },
    { t: 'Transportador', w: 38, v: x => x.l.transp_nome },
    { t: 'Tipo', w: 14, v: x => x.l.tipo },
    { t: 'Destinatário', w: 38, v: x => x.l.dest_nome },
    { t: 'Cidade', w: 22, v: x => x.l.cidade },
    { t: 'UF', w: 5, v: x => x.l.uf },
  ], nfs);

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}${sub ? ' - ' + sub : ''}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
