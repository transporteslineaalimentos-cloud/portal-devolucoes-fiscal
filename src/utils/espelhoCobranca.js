/* ─────────────────────────────────────────────────────────────
   Espelho de cobrança: Excel para mandar ao transportador (ou usar
   na emissão da NF de débito). Resumo por transportador, notas e
   itens que voltaram ao CD com avaria / falta / impróprio.
───────────────────────────────────────────────────────────── */
const FONT = 'Arial';
const AZUL = '1E4DB7';
const LINHA = 'E2E5EA';
const ZEBRA = 'F7F8FA';
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const COBRAR = new Set(['AVARIA', 'FALTA', 'IMPROPRIO', 'IMPRÓPRIO']);

const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
const dataUTC = (s) => {
  const m = s ? String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};

export const SITUACAO_TXT = {
  cobrar_integral:   'Não voltou ao CD · cobrar valor da nota',
  cobrar_parcial:    'Voltou com avaria/falta · cobrar itens',
  conferir_cd:       'Voltou ao CD · falta conferência',
  isentar:           'Voltou em bom estado · nada a cobrar',
  sem_transportador: 'Sem transportador',
  cobrado:           'Cobrado',
  isento:            'Isento',
};

export const valorACobrar = (r) =>
  r.situacao === 'cobrado' ? Number(r.valor_cobrado ?? r.valor) || 0
  : r.situacao === 'isento' ? 0
  : Number(r.valor_sugerido) || 0;

function tabela(ws, linhaIni, colunas, linhas) {
  ws.columns = colunas.map(c => ({ width: c.w }));
  const cab = ws.getRow(linhaIni);
  colunas.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.t;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(AZUL);
    cell.alignment = { vertical: 'middle', horizontal: c.fmt === 'brl' || c.fmt === 'num' ? 'right' : 'left' };
  });
  cab.height = 20;
  linhas.forEach((r, li) => {
    const row = ws.getRow(linhaIni + 1 + li);
    colunas.forEach((c, i) => {
      let v = c.v(r);
      if (c.fmt === 'data') v = dataUTC(v);
      else if (c.fmt === 'brl' || c.fmt === 'num') v = v == null || v === '' ? null : Number(v);
      else if (v == null) v = '';
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 10 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + LINHA } } };
      if (c.fmt === 'brl') cell.numFmt = BRL;
      if (c.fmt === 'data') cell.numFmt = 'dd/mm/yyyy';
      if (li % 2) cell.fill = fill(ZEBRA);
    });
  });
  // total nas colunas de valor
  if (linhas.length) {
    const tot = ws.getRow(linhaIni + 1 + linhas.length);
    tot.getCell(1).value = 'Total';
    tot.getCell(1).font = { name: FONT, size: 10, bold: true };
    colunas.forEach((c, i) => {
      if (c.fmt !== 'brl' && !c.somar) return;
      const L = ws.getColumn(i + 1).letter;
      const cell = tot.getCell(i + 1);
      cell.value = { formula: `SUBTOTAL(9,${L}${linhaIni + 1}:${L}${linhaIni + linhas.length})` };
      cell.font = { name: FONT, size: 10, bold: true };
      if (c.fmt === 'brl') cell.numFmt = BRL;
    });
  }
  ws.autoFilter = { from: { row: linhaIni, column: 1 }, to: { row: linhaIni + linhas.length, column: colunas.length } };
  ws.views = [{ state: 'frozen', ySplit: linhaIni, showGridLines: false }];
}

function titulo(ws, texto, sub, ncol) {
  ws.mergeCells(1, 1, 1, ncol);
  ws.getCell(1, 1).value = texto;
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  ws.getRow(1).height = 22;
  ws.mergeCells(2, 1, 2, ncol);
  ws.getCell(2, 1).value = sub;
  ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF5B6472' } };
}

export async function baixarEspelhoCobranca(rows, { nomeArquivo = 'Espelho de cobrança', subtitulo = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais';
  const gerado = `Gerado em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

  // Resumo por transportador
  const grupos = new Map();
  rows.forEach(r => {
    const k = r.transportador_cobranca || 'SEM TRANSPORTADOR';
    const g = grupos.get(k) || { nome: k, cnpj: r.transportador_cnpj_cobranca || '', qtd: 0, valor: 0, cobrar: 0 };
    g.qtd += 1; g.valor += Number(r.valor) || 0; g.cobrar += valorACobrar(r);
    grupos.set(k, g);
  });
  const wr = wb.addWorksheet('Resumo');
  titulo(wr, 'Espelho de cobrança · devoluções por responsabilidade do transportador', [subtitulo, `${rows.length} notas`, gerado].filter(Boolean).join('  ·  '), 5);
  tabela(wr, 4, [
    { t: 'Transportador', w: 46, v: g => g.nome },
    { t: 'CNPJ', w: 20, v: g => g.cnpj },
    { t: 'Notas', w: 9, v: g => g.qtd, fmt: 'num', somar: true },
    { t: 'Valor das notas', w: 17, v: g => g.valor, fmt: 'brl' },
    { t: 'Valor a cobrar', w: 17, v: g => g.cobrar, fmt: 'brl' },
  ], [...grupos.values()].sort((a, b) => b.cobrar - a.cobrar));

  // Notas
  const wn = wb.addWorksheet('Notas');
  titulo(wn, 'Notas de devolução', gerado, 15);
  tabela(wn, 4, [
    { t: 'Transportador', w: 36, v: r => r.transportador_cobranca },
    { t: 'NF Dev.', w: 11, v: r => r.lancamento_manual ? '' : r.nf_numero },
    { t: 'NF Venda', w: 11, v: r => r.nf_venda },
    { t: 'Cliente', w: 36, v: r => r.nome_emitente },
    { t: 'UF', w: 5, v: r => r.uf_emitente },
    { t: 'Emissão', w: 11, v: r => r.dt_emissao, fmt: 'data' },
    { t: 'Lançada no Protheus', w: 12, v: r => r.dt_lancamento_protheus, fmt: 'data' },
    { t: 'Motivo', w: 28, v: r => r.motivo_devolucao },
    { t: 'Retorno ao CD', w: 12, v: r => r.retornou_cd ? 'Sim' : 'Não' },
    { t: 'Data retorno CD', w: 12, v: r => r.dt_recebimento_cd, fmt: 'data' },
    { t: 'Situação', w: 34, v: r => SITUACAO_TXT[r.situacao] || r.situacao },
    { t: 'Valor da nota', w: 15, v: r => r.valor, fmt: 'brl' },
    { t: 'Valor a cobrar', w: 15, v: r => valorACobrar(r), fmt: 'brl' },
    { t: 'NF de débito', w: 12, v: r => r.nf_debito },
    { t: 'Observação', w: 40, v: r => r.obs_cobranca },
  ], rows);

  // Itens do CD que entram na cobrança
  const itens = [];
  rows.forEach(r => (r.itens_cd || []).forEach(it => {
    if (COBRAR.has(String(it.destino || '').toUpperCase())) itens.push({ r, it });
  }));
  if (itens.length) {
    const wi = wb.addWorksheet('Itens a cobrar');
    titulo(wi, 'Itens que voltaram ao CD com avaria, falta ou impróprios', gerado, 8);
    tabela(wi, 4, [
      { t: 'Transportador', w: 36, v: x => x.r.transportador_cobranca },
      { t: 'NF Dev.', w: 11, v: x => x.r.lancamento_manual ? '' : x.r.nf_numero },
      { t: 'Cliente', w: 34, v: x => x.r.nome_emitente },
      { t: 'Código', w: 12, v: x => x.it.codigo },
      { t: 'Produto', w: 44, v: x => x.it.descricao },
      { t: 'Lote', w: 10, v: x => x.it.lote },
      { t: 'Qtd', w: 7, v: x => x.it.qtd, fmt: 'num', somar: true },
      { t: 'Ocorrência', w: 12, v: x => x.it.destino },
    ], itens);
  }

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
