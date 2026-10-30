/* ─────────────────────────────────────────────────────────────
   Planilha de controle (assistentes de controle): só as colunas que
   elas usam no dia a dia, mais o status operacional.
───────────────────────────────────────────────────────────── */
import { calcStatusOperacional } from '../utils.jsx';

const FONT = 'Calibri';
const AZUL = '1F4E78';
const ZEBRA = 'EEF3F9';

const dataUTC = (s) => {
  const m = s ? String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
const dtRef = (r) => (r.lancamento_manual && r.devolucao_total) ? (r.dt_devolucao || r.dt_emissao) : r.dt_emissao;

const COLUNAS = [
  { t: 'NF Devolução',       w: 13, v: r => r.nf_numero != null ? Number(r.nf_numero) : null },
  { t: 'Série',              w: 7,  v: r => r.nf_serie ?? '' },
  { t: 'Chave NF-e',         w: 47, v: r => (r.chave_nfe && !String(r.chave_nfe).startsWith('MANUAL')) ? String(r.chave_nfe) : '' },
  { t: 'Emitente',           w: 42, v: r => r.nome_emitente || '' },
  { t: 'CNPJ Emitente',      w: 17, v: r => r.cnpj_emitente || '' },
  { t: 'Município',          w: 22, v: r => r.municipio_emitente || '' },
  { t: 'UF',                 w: 6,  v: r => r.uf_emitente || '' },
  { t: 'Linha Produto',      w: 13, v: r => r.linha_produto || '' },
  { t: 'Data Emissão',       w: 13, v: r => dataUTC(r.dt_emissao), fmt: 'dd/mm/yyyy' },
  { t: 'Motivo Devolução',   w: 36, v: r => r.motivo_devolucao || '' },
  { t: 'Mês de referência',  w: 14, v: r => { const d = dtRef(r); return d ? `${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : ''; } },
  { t: 'Valor Total',        w: 14, v: r => r.valor != null ? Number(r.valor) : null, fmt: '#,##0.00' },
  { t: 'Valor Produtos',     w: 14, v: r => r.valor_produtos != null ? Number(r.valor_produtos) : null, fmt: '#,##0.00' },
  { t: 'Status operacional', w: 36, v: r => r.status_op || calcStatusOperacional(r) || '' },
];

export async function baixarPlanilhaControle(rows, { sufixo = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais';
  const ws = wb.addWorksheet('Devoluções', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUNAS.map(c => ({ width: c.w }));

  const cab = ws.getRow(1);
  COLUNAS.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.t;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  cab.height = 20;

  rows.forEach((r, li) => {
    const row = ws.getRow(li + 2);
    COLUNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.v(r);
      cell.font = { name: FONT, size: 11 };
      if (c.fmt) cell.numFmt = c.fmt;
      if (li % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ZEBRA } };
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: COLUNAS.length } };

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Controle de devoluções${sufixo ? ' - ' + sufixo : ''} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
