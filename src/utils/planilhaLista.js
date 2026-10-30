/* ─────────────────────────────────────────────────────────────
   Excel de uma lista do Painel Gerencial: exatamente as notas que
   estão abertas na tela (mesmo filtro, mesma busca, mesma ordem),
   com as mesmas colunas. Gerado no navegador com exceljs.
───────────────────────────────────────────────────────────── */
const FONT = 'Arial';
const AZUL = '1E4DB7';
const LINHA = 'E2E5EA';
const ZEBRA = 'F7F8FA';

const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
const bordaInf = { bottom: { style: 'thin', color: { argb: 'FF' + LINHA } } };

const FORMATOS = {
  brl: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  data: 'dd/mm/yyyy',
  int: '0',
};

function limparNome(t) {
  return String(t || 'notas').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * colunas: [{ t: título, w: largura (caracteres), v: (linha) => valor bruto, fmt?: 'brl' | 'data' | 'int' }]
 * Datas podem vir como 'AAAA-MM-DD' (viram data de verdade no Excel).
 */
export async function baixarListaNotas({ titulo, periodo, colunas, linhas, filtroBusca }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais';
  const ws = wb.addWorksheet('Notas', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });

  ws.columns = colunas.map(c => ({ width: c.w || 14 }));
  const ultimaCol = colunas.length;

  ws.mergeCells(1, 1, 1, ultimaCol);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { name: FONT, size: 14, bold: true, color: { argb: 'FF1F2933' } };
  ws.getRow(1).height = 22;

  const total = linhas.reduce((a, r) => a + (Number(r.valor) || 0), 0);
  ws.mergeCells(2, 1, 2, ultimaCol);
  const info = ws.getCell(2, 1);
  info.value = [
    periodo,
    `${linhas.length} nota${linhas.length === 1 ? '' : 's'}`,
    `Total ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    filtroBusca ? `Busca: "${filtroBusca}"` : null,
    `Gerado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  ].filter(Boolean).join('  ·  ');
  info.font = { name: FONT, size: 10, color: { argb: 'FF5B6472' } };

  const cab = ws.getRow(4);
  colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.t;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(AZUL);
    cell.alignment = { vertical: 'middle', horizontal: c.fmt === 'brl' || c.fmt === 'int' ? 'right' : 'left' };
  });
  cab.height = 20;

  linhas.forEach((r, li) => {
    const row = ws.getRow(5 + li);
    colunas.forEach((c, i) => {
      let v = c.v(r);
      if (c.fmt === 'data') {
        // exceljs grava a data em UTC: meia-noite UTC = a data certa, sem hora
        const m = v ? String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
        v = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
      } else if (c.fmt === 'brl' || c.fmt === 'int') {
        v = v === null || v === undefined || v === '' ? null : Number(v);
      } else if (v === null || v === undefined) {
        v = '';
      }
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 10, color: { argb: 'FF1F2933' } };
      cell.border = bordaInf;
      if (FORMATOS[c.fmt]) cell.numFmt = FORMATOS[c.fmt];
      if (li % 2 === 1) cell.fill = fill(ZEBRA);
    });
  });

  // linha de total
  const iValor = colunas.findIndex(c => c.fmt === 'brl');
  if (linhas.length && iValor >= 0) {
    const r = ws.getRow(5 + linhas.length);
    r.getCell(1).value = 'Total';
    r.getCell(1).font = { name: FONT, size: 10, bold: true };
    const L = ws.getColumn(iValor + 1).letter;
    const c = r.getCell(iValor + 1);
    c.value = { formula: `SUBTOTAL(9,${L}5:${L}${4 + linhas.length})`, result: total };
    c.numFmt = FORMATOS.brl;
    c.font = { name: FONT, size: 10, bold: true };
  }

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + linhas.length, column: ultimaCol } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${limparNome(`${titulo} - ${periodo}`)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
