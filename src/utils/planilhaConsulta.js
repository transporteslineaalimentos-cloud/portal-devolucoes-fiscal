/* ─────────────────────────────────────────────────────────────
   Planilha de consulta de notas de devolução
   Arquivo Excel formatado para enviar a quem não tem acesso ao
   portal: aba de busca por número da NF, base de notas com filtros,
   itens e resumo. Gerado no navegador com exceljs.
───────────────────────────────────────────────────────────── */
import { calcStatusOperacional } from '../utils.jsx';

const FONT = 'Arial';
const AZUL = '1E4DB7';
const AZUL_ESC = '16336F';
const DOURADO = 'B8956A';
const CINZA_TXT = '5B6472';
const LINHA = 'E2E5EA';
const ZEBRA = 'F7F8FA';

export const STATUS_CORES = {
  'LANÇADA':                             { bg: 'DDF3E4', fg: '17663A', desc: 'Lançada no Protheus e o produto já voltou ao CD. Processo concluído.' },
  'LANÇADA SEM FÍSICO':                  { bg: 'DDF1EF', fg: '1F6F6A', desc: 'Lançada no Protheus, mas o produto não voltou ao CD.' },
  'TROCA DE NOTA':                       { bg: 'E3ECFB', fg: '1E4DB7', desc: 'Devolução total já lançada no Protheus sem retorno do produto.' },
  'ENVIAR PARA LANÇAMENTO':              { bg: 'FFF0CC', fg: '7A4E00', desc: 'O produto chegou ao CD; falta lançar a nota no Protheus.' },
  'ENVIAR PARA LANÇAMENTO - SEM FÍSICO': { bg: 'FFF7E0', fg: '7A4E00', desc: 'Liberada para lançar no Protheus sem aguardar o produto.' },
  'VALIDAR RETORNO DA NF':               { bg: 'E0F2FE', fg: '0B5C8A', desc: 'Nota nova: a assistente precisa validar se o produto volta (agendar reversa) ou não (enviar para lançamento sem físico).' },
  'AGENDAR REVERSA':                     { bg: 'FDE4E2', fg: 'A8261B', desc: 'Produto ainda no cliente: combinar com o transportador a data de retorno ao CD.' },
  'REVERSA AGENDADA':                    { bg: 'ECE7FA', fg: '5B3FA8', desc: 'Coleta do produto já agendada com o transportador.' },
  'RECUSADA SEFAZ':                      { bg: 'ECEDEF', fg: '3F4650', desc: 'Nota recusada na SEFAZ; aguardando correção pelo cliente.' },
};

const PRAZO_CORES = {
  'No prazo': { bg: 'DDF3E4', fg: '17663A' },
  'Atenção':  { bg: 'FFF0CC', fg: '7A4E00' },
  'Vencido':  { bg: 'FDE4E2', fg: 'A8261B' },
  'Lançada':  { bg: 'ECEDEF', fg: '3F4650' },
};

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CANAIS = { 'CANAL INDIRETO':'CNI - CANAL INDIRETO','CANAL DIRETO':'CND - CANAL DIRETO','FARMA KEY ACCOUNT':'FKA - FARMA KEY ACCOUNT','CASH & CARRY':'CRY - CASH & CARRY','KEY ACCOUNT':'KEY - KEY ACCOUNT','ECOMMERCE':'ECO - ECOMMERCE','NOVOS NEGÓCIOS':'NNG - NOVOS NEGÓCIOS','CANAL VERDE':'CNV - CANAL VERDE' };
const canalDe = (cc) => cc ? (CANAIS[String(cc).toUpperCase()] || String(cc).toUpperCase()) : '';

const toDate = (d) => {
  if (!d) return null;
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split('-').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(Date.UTC(y, m - 1, dd));
};
const nfVenda = (ch) => {
  if (!ch || String(ch).length < 34) return null;
  const n = parseInt(String(ch).slice(25, 34), 10);
  return isNaN(n) ? null : n;
};
const linhaDe = (r) => {
  if (r.linha_produto) return r.linha_produto;
  const cnpj = r.chave_nfe_referenciada ? String(r.chave_nfe_referenciada).slice(6, 20) : '';
  if (cnpj === '05207076000459') return 'CHOCOLATE';
  if (cnpj === '05207076000297') return 'MIX';
  return '';
};
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/* Colunas da aba Notas — a ordem define as letras usadas nas fórmulas */
const COLS = [
  { key: 'nfd',        header: 'NF Devolução',        width: 13, fmt: '0' },
  { key: 'serie',      header: 'Série',               width: 7 },
  { key: 'nfv',        header: 'NF de Venda',         width: 13, fmt: '0' },
  { key: 'status',     header: 'Status Operacional',  width: 34 },
  { key: 'prazo',      header: 'Prazo 90 dias',       width: 13 },
  { key: 'dias',       header: 'Dias restantes',      width: 10, fmt: '0;[Red]-0' },
  { key: 'emissao',    header: 'Emissão NFD',         width: 12, fmt: 'dd/mm/yyyy' },
  { key: 'dtdev',      header: 'Data Devolução',      width: 12, fmt: 'dd/mm/yyyy' },
  { key: 'dtref',      header: 'Data de Referência',  width: 12, fmt: 'dd/mm/yyyy' },
  { key: 'mesref',     header: 'Mês',                 width: 10 },
  { key: 'tipo',       header: 'Tipo',                width: 15 },
  { key: 'cliente',    header: 'Cliente',             width: 38 },
  { key: 'cnpj',       header: 'CNPJ Cliente',        width: 17 },
  { key: 'cidade',     header: 'Cidade / UF',         width: 22 },
  { key: 'linha',      header: 'Linha',               width: 11 },
  { key: 'canal',      header: 'Canal',               width: 24 },
  { key: 'valor',      header: 'Valor NF (R$)',       width: 14, fmt: '#,##0.00' },
  { key: 'motivo',     header: 'Motivo da Devolução', width: 36 },
  { key: 'area',       header: 'Área Responsável',    width: 18 },
  { key: 'vendedor',   header: 'Vendedor',            width: 30 },
  { key: 'lancada',    header: 'Lançada Protheus',    width: 10 },
  { key: 'dtlanc',     header: 'Data Lançamento',     width: 12, fmt: 'dd/mm/yyyy' },
  { key: 'cd',         header: 'Chegou ao CD',        width: 9 },
  { key: 'dtcd',       header: 'Data Chegada CD',     width: 12, fmt: 'dd/mm/yyyy' },
  { key: 'transp',     header: 'Transportador',       width: 30 },
  { key: 'obs',        header: 'Observação da NF',    width: 60 },
  { key: 'chave',      header: 'Chave de Acesso NFD', width: 46 },
];
const C = Object.fromEntries(COLS.map((c, i) => [c.key, colLetter(i + 1)]));

function linhaNota(r) {
  const manual = !!r.lancamento_manual;
  const emissao = toDate(r.dt_emissao);
  const dtdev = manual ? toDate(r.dt_devolucao) : null;
  const dtref = dtdev || emissao;
  const m = dtref ? dtref.getUTCMonth() : null;
  const y = dtref ? dtref.getUTCFullYear() : null;
  const cidade = [r.municipio_emitente, r.uf_emitente].filter(Boolean).join(' / ');
  return {
    nfd: manual ? null : (r.nf_numero ?? null),
    serie: manual ? '' : (r.nf_serie ?? ''),
    nfv: nfVenda(r.chave_nfe_referenciada),
    status: calcStatusOperacional(r) || '',
    emissao: manual ? null : emissao,
    dtdev,
    dtref,
    mesref: m == null ? '' : `${String(m + 1).padStart(2, '0')}/${y}`,
    tipo: manual ? 'Total (manual)' : 'Parcial (NFD)',
    cliente: r.nome_emitente || '',
    cnpj: r.cnpj_emitente || '',
    cidade,
    linha: linhaDe(r),
    canal: canalDe(r.centro_custo),
    valor: Number(r.valor) || 0,
    motivo: r.motivo_devolucao || 'SEM MOTIVO',
    area: r.area_responsavel || 'SEM CLASSIFICAÇÃO',
    vendedor: r.vendedor || '',
    lancada: r.lancado_protheus ? 'Sim' : 'Não',
    dtlanc: toDate(r.dt_lancamento_protheus),
    cd: r.retornou_cd ? 'Sim' : 'Não',
    dtcd: toDate(r.dt_recebimento_cd),
    transp: r.transportador_cobranca || '',
    obs: (r.inf_complementar || '').replace(/\s+/g, ' ').trim(),
    chave: manual ? '' : (r.chave_nfe || ''),
  };
}

const borda = (cor = LINHA) => ({ top: { style: 'thin', color: { argb: 'FF' + cor } }, bottom: { style: 'thin', color: { argb: 'FF' + cor } }, left: { style: 'thin', color: { argb: 'FF' + cor } }, right: { style: 'thin', color: { argb: 'FF' + cor } } });
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
const font = (o = {}) => ({ name: FONT, size: 10, color: { argb: 'FF' + (o.color || '1F2933') }, bold: !!o.bold, italic: !!o.italic, size: o.size || 10 });

function faixaTitulo(ws, ref, texto, sub) {
  ws.mergeCells(ref);
  const c = ws.getCell(ref.split(':')[0]);
  c.value = texto;
  c.font = { name: FONT, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = fill(AZUL_ESC);
  c.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(c.row).height = 34;
  if (sub) {
    const [a, b] = ref.split(':');
    const r2 = c.row + 1;
    const ref2 = `${a.replace(/\d+/, r2)}:${b.replace(/\d+/, r2)}`;
    ws.mergeCells(ref2);
    const s = ws.getCell(ref2.split(':')[0]);
    s.value = sub;
    s.font = { name: FONT, size: 9.5, color: { argb: 'FFFFFFFF' } };
    s.fill = fill(AZUL);
    s.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(r2).height = 20;
  }
}

function regrasStatus(ws, ref, colAbs) {
  ws.addConditionalFormatting({
    ref,
    rules: Object.entries(STATUS_CORES).map(([st, c], i) => ({
      type: 'expression', priority: i + 1,
      formulae: [`${colAbs}="${st}"`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + c.bg } }, font: { color: { argb: 'FF' + c.fg }, bold: true } },
    })),
  });
}
function regrasPrazo(ws, ref, colAbs) {
  ws.addConditionalFormatting({
    ref,
    rules: Object.entries(PRAZO_CORES).map(([p, c], i) => ({
      type: 'expression', priority: 20 + i,
      formulae: [`${colAbs}="${p}"`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF' + c.bg } }, font: { color: { argb: 'FF' + c.fg }, bold: true } },
    })),
  });
}

/**
 * Monta o workbook. `ExcelJS` é passado de fora para permitir import dinâmico no navegador.
 * @returns {Promise<ArrayBuffer>}
 */
export async function gerarPlanilhaConsulta(ExcelJS, rows, { periodoTxt = '', geradoEm = new Date() } = {}) {
  const notas = rows.map(linhaNota).sort((a, b) => (b.dtref?.getTime() || 0) - (a.dtref?.getTime() || 0));
  const n = notas.length;
  const ultima = n + 1;                     // última linha de dados na aba Notas
  const geradoTxt = geradoEm.toLocaleString('pt-BR');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal de Devoluções Fiscais · Linea Alimentos';
  wb.created = geradoEm;
  wb.calcProperties = { fullCalcOnLoad: true };

  /* ── 1. Consulta ─────────────────────────────────────────── */
  const wc = wb.addWorksheet('Consulta', { properties: { tabColor: { argb: 'FF' + DOURADO } }, views: [{ showGridLines: false }] });
  wc.columns = [{ width: 2 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 3 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 2 }];
  faixaTitulo(wc, 'B1:H1', 'Consulta de notas de devolução', `Linea Alimentos · gerado em ${geradoTxt}${periodoTxt ? ` · período ${periodoTxt}` : ''} · ${n} notas`);

  wc.getRow(4).height = 30;
  const lb = wc.getCell('B4');
  lb.value = 'Número da NF';
  lb.font = font({ bold: true, size: 11 });
  lb.alignment = { vertical: 'middle' };
  const inp = wc.getCell('C4');
  inp.value = null;
  inp.numFmt = '0';
  inp.font = { name: FONT, size: 14, bold: true, color: { argb: 'FF' + AZUL_ESC } };
  inp.fill = fill('FFF6D6');
  inp.border = { top: { style: 'medium', color: { argb: 'FF' + DOURADO } }, bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } }, left: { style: 'medium', color: { argb: 'FF' + DOURADO } }, right: { style: 'medium', color: { argb: 'FF' + DOURADO } } };
  inp.alignment = { horizontal: 'center', vertical: 'middle' };
  inp.protection = { locked: false };
  wc.mergeCells('D4:H4');
  const dica = wc.getCell('D4');
  dica.value = '← digite o número da NF de devolução (NFD) ou da NF de venda e tecle Enter';
  dica.font = font({ color: CINZA_TXT, italic: true });
  dica.alignment = { vertical: 'middle', indent: 1 };

  // Auxiliares (coluna J, ocultas): linha encontrada e quantidade de ocorrências
  wc.getColumn(10).hidden = true;
  wc.getColumn(11).hidden = true;
  wc.getCell('J4').value = { formula: `IF($C$4="",0,IFERROR(MATCH($C$4,Notas!$${C.nfd}$1:$${C.nfd}$${ultima},0),IFERROR(MATCH($C$4,Notas!$${C.nfv}$1:$${C.nfv}$${ultima},0),0)))` };
  wc.getCell('K4').value = { formula: `IF($C$4="",0,COUNTIF(Notas!$${C.nfd}$2:$${C.nfd}$${ultima},$C$4)+COUNTIF(Notas!$${C.nfv}$2:$${C.nfv}$${ultima},$C$4))` };

  wc.mergeCells('B5:H5');
  const msg = wc.getCell('B5');
  msg.value = { formula: `IF($C$4="","",IF($J$4=0,"Nota não encontrada nesta planilha. Confira o número ou procure na aba Notas.",IF($K$4>1,"Há "&$K$4&" notas com esse número. Mostrando a primeira; veja todas filtrando a aba Notas.","Nota encontrada.")))` };
  msg.font = font({ bold: true, color: AZUL });
  msg.alignment = { vertical: 'middle' };
  wc.getRow(5).height = 20;
  wc.addConditionalFormatting({ ref: 'B5', rules: [{ type: 'expression', priority: 1, formulae: ['$J$4=0'], style: { font: { color: { argb: 'FFA8261B' }, bold: true } } }] });

  // Cartão de resultado
  const val = (key) => ({ formula: `IF($J$4=0,"",IF(INDEX(Notas!$${C[key]}$1:$${C[key]}$${ultima},$J$4)="","—",INDEX(Notas!$${C[key]}$1:$${C[key]}$${ultima},$J$4)))` });
  const campos = [
    // [linha, labelCol, valueCol(merge até), rótulo, chave, formato]
    [7,  'B', 'C', 'D', 'Status operacional', 'status'],
    [7,  'F', 'G', 'H', 'Prazo 90 dias',      'prazo'],
    [9,  'B', 'C', 'D', 'NF de devolução',    'nfd', '0'],
    [9,  'F', 'G', 'H', 'NF de venda',        'nfv', '0'],
    [10, 'B', 'C', 'D', 'Tipo',               'tipo'],
    [10, 'F', 'G', 'H', 'Valor da NF',        'valor', '"R$" #,##0.00'],
    [11, 'B', 'C', 'D', 'Emissão da NFD',     'emissao', 'dd/mm/yyyy'],
    [11, 'F', 'G', 'H', 'Data da devolução',  'dtdev', 'dd/mm/yyyy'],
    [12, 'B', 'C', 'D', 'Cliente',            'cliente'],
    [12, 'F', 'G', 'H', 'CNPJ do cliente',    'cnpj'],
    [13, 'B', 'C', 'D', 'Cidade / UF',        'cidade'],
    [13, 'F', 'G', 'H', 'Linha / Canal',      null],
    [14, 'B', 'C', 'D', 'Motivo',             'motivo'],
    [14, 'F', 'G', 'H', 'Área responsável',   'area'],
    [15, 'B', 'C', 'D', 'Lançada no Protheus','lancada'],
    [15, 'F', 'G', 'H', 'Data do lançamento', 'dtlanc', 'dd/mm/yyyy'],
    [16, 'B', 'C', 'D', 'Chegou ao CD',       'cd'],
    [16, 'F', 'G', 'H', 'Data de chegada',    'dtcd', 'dd/mm/yyyy'],
    [17, 'B', 'C', 'D', 'Transportador',      'transp'],
    [17, 'F', 'G', 'H', 'Dias restantes',     'dias', '0'],
  ];
  wc.getCell('B8').value = '';
  for (const [r, lc, v1, v2, rot, key, fmt] of campos) {
    const l = wc.getCell(`${lc}${r}`);
    l.value = rot;
    l.font = font({ color: CINZA_TXT, size: 9.5 });
    l.fill = fill(ZEBRA);
    l.border = borda();
    l.alignment = { vertical: 'middle', indent: 1 };
    wc.mergeCells(`${v1}${r}:${v2}${r}`);
    const c = wc.getCell(`${v1}${r}`);
    c.value = key ? val(key)
      : { formula: `IF($J$4=0,"",INDEX(Notas!$${C.linha}$1:$${C.linha}$${ultima},$J$4)&" · "&INDEX(Notas!$${C.canal}$1:$${C.canal}$${ultima},$J$4))` };
    c.font = font({ bold: true, size: r === 7 ? 11 : 10 });
    c.border = borda();
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    if (fmt) c.numFmt = fmt;
    wc.getRow(r).height = r === 7 ? 28 : 21;
  }
  regrasStatus(wc, 'C7:D7', '$C$7');
  regrasPrazo(wc, 'G7:H7', '$G$7');

  wc.mergeCells('B18:B19');
  const lobs = wc.getCell('B18');
  lobs.value = 'Observação da NF';
  lobs.font = font({ color: CINZA_TXT, size: 9.5 });
  lobs.fill = fill(ZEBRA); lobs.border = borda(); lobs.alignment = { vertical: 'top', indent: 1 };
  wc.mergeCells('C18:H19');
  const obs = wc.getCell('C18');
  obs.value = val('obs');
  obs.font = font(); obs.border = borda(); obs.alignment = { vertical: 'top', wrapText: true, indent: 1 };
  wc.getRow(18).height = 30; wc.getRow(19).height = 30;

  // Legenda dos status
  let r0 = 22;
  wc.mergeCells(`B${r0}:H${r0}`);
  const tl = wc.getCell(`B${r0}`);
  tl.value = 'O que significa cada status';
  tl.font = font({ bold: true, size: 12, color: AZUL_ESC });
  tl.border = { bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } } };
  r0++;
  for (const [st, c] of Object.entries(STATUS_CORES)) {
    const a = wc.getCell(`B${r0}`);
    wc.mergeCells(`B${r0}:C${r0}`);
    a.value = st;
    a.font = { name: FONT, size: 9.5, bold: true, color: { argb: 'FF' + c.fg } };
    a.fill = fill(c.bg);
    a.alignment = { vertical: 'middle', indent: 1 };
    wc.mergeCells(`D${r0}:H${r0}`);
    const d = wc.getCell(`D${r0}`);
    d.value = c.desc;
    d.font = font({ size: 9.5 });
    d.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    wc.getRow(r0).height = 20;
    r0++;
  }
  r0++;
  wc.mergeCells(`B${r0}:H${r0}`);
  const tp = wc.getCell(`B${r0}`);
  tp.value = 'Prazo de 90 dias';
  tp.font = font({ bold: true, size: 12, color: AZUL_ESC });
  tp.border = { bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } } };
  r0++;
  const prazos = [
    ['No prazo', 'Faltam mais de 15 dias para completar 90 dias da NFD (ou da data da devolução, no lançamento manual).'],
    ['Atenção',  'Faltam 15 dias ou menos para vencer os 90 dias.'],
    ['Vencido',  'Passou de 90 dias e a nota ainda não foi lançada no Protheus.'],
    ['Lançada',  'Já lançada no Protheus; o prazo não se aplica mais.'],
  ];
  for (const [p, d] of prazos) {
    const c = PRAZO_CORES[p];
    wc.mergeCells(`B${r0}:C${r0}`);
    const a = wc.getCell(`B${r0}`);
    a.value = p; a.font = { name: FONT, size: 9.5, bold: true, color: { argb: 'FF' + c.fg } }; a.fill = fill(c.bg); a.alignment = { vertical: 'middle', indent: 1 };
    wc.mergeCells(`D${r0}:H${r0}`);
    const e = wc.getCell(`D${r0}`);
    e.value = d; e.font = font({ size: 9.5 }); e.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    wc.getRow(r0).height = 20;
    r0++;
  }
  r0++;
  wc.mergeCells(`B${r0}:H${r0 + 2}`);
  const como = wc.getCell(`B${r0}`);
  como.value = 'Para ver várias notas de uma vez, use a aba Notas: cada coluna tem filtro (clique na setinha do título). '
    + 'A aba Itens mostra os produtos de cada nota e a aba Resumo traz os totais por status, prazo, mês e área. '
    + 'Esta planilha é uma foto do portal no momento em que foi gerada; os prazos em dias se atualizam sozinhos ao abrir o arquivo.';
  como.font = font({ size: 9.5, color: CINZA_TXT });
  como.alignment = { wrapText: true, vertical: 'top' };

  /* ── 2. Notas ────────────────────────────────────────────── */
  const ws = wb.addWorksheet('Notas', { properties: { tabColor: { argb: 'FF' + AZUL } }, views: [{ state: 'frozen', xSplit: 4, ySplit: 1, showGridLines: false }] });
  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));
  const hdr = ws.getRow(1);
  COLS.forEach((c, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(AZUL_ESC);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } }, right: { style: 'thin', color: { argb: 'FF2A4A8A' } } };
  });
  hdr.height = 32;

  notas.forEach((nt, i) => {
    const r = i + 2;
    const row = ws.getRow(r);
    COLS.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      if (c.key === 'prazo') {
        cell.value = { formula: `IF(${C.lancada}${r}="Sim","Lançada",IF(${C.dtref}${r}="","",IF(90-(TODAY()-${C.dtref}${r})>15,"No prazo",IF(90-(TODAY()-${C.dtref}${r})>0,"Atenção","Vencido"))))` };
      } else if (c.key === 'dias') {
        cell.value = { formula: `IF(OR(${C.lancada}${r}="Sim",${C.dtref}${r}=""),"",90-(TODAY()-${C.dtref}${r}))` };
      } else {
        const v = nt[c.key];
        cell.value = v === '' ? null : v;
      }
      cell.font = font(c.key === 'nfd' || c.key === 'nfv' ? { bold: true } : {});
      if (c.fmt) cell.numFmt = c.fmt;
      if (i % 2 === 1) cell.fill = fill(ZEBRA);
      cell.border = { bottom: { style: 'hair', color: { argb: 'FF' + LINHA } } };
      cell.alignment = { vertical: 'middle', horizontal: ['valor', 'dias'].includes(c.key) ? 'right' : (['serie', 'lancada', 'cd', 'mesref', 'linha', 'prazo'].includes(c.key) || c.fmt === 'dd/mm/yyyy') ? 'center' : 'left', wrapText: c.key === 'obs' ? false : undefined };
    });
    row.height = 18;
  });
  ws.autoFilter = { from: 'A1', to: `${colLetter(COLS.length)}${ultima}` };
  if (n > 0) {
    regrasStatus(ws, `${C.status}2:${C.status}${ultima}`, `$${C.status}2`);
    regrasPrazo(ws, `${C.prazo}2:${C.prazo}${ultima}`, `$${C.prazo}2`);
    ws.addConditionalFormatting({ ref: `${C.lancada}2:${C.lancada}${ultima}`, rules: [{ type: 'expression', priority: 40, formulae: [`$${C.lancada}2="Sim"`], style: { font: { color: { argb: 'FF17663A' }, bold: true } } }] });
    ws.addConditionalFormatting({ ref: `${C.cd}2:${C.cd}${ultima}`, rules: [{ type: 'expression', priority: 41, formulae: [`$${C.cd}2="Sim"`], style: { font: { color: { argb: 'FF17663A' }, bold: true } } }] });
  }

  /* ── 3. Itens ────────────────────────────────────────────── */
  const wi = wb.addWorksheet('Itens', { properties: { tabColor: { argb: 'FF' + DOURADO } }, views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  const IC = [
    ['NF Devolução', 13, '0'], ['NF de Venda', 13, '0'], ['Cliente', 36], ['Data de Referência', 12, 'dd/mm/yyyy'],
    ['Código', 14], ['Produto', 44], ['Unidade', 8], ['Quantidade', 11, '#,##0.###'], ['Valor Unitário (R$)', 14, '#,##0.00'], ['Valor Total (R$)', 14, '#,##0.00'], ['Origem', 12],
  ];
  wi.columns = IC.map(([, w]) => ({ width: w }));
  IC.forEach(([h], i) => {
    const cell = wi.getRow(1).getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(AZUL_ESC);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } } };
  });
  wi.getRow(1).height = 30;
  let ri = 2;
  rows.forEach((r) => {
    const nt = linhaNota(r);
    const xml = Array.isArray(r.itens) ? r.itens : [];
    const prot = Array.isArray(r.itens_protheus) ? r.itens_protheus : [];
    const fonte = xml.length ? xml : prot;
    const origem = xml.length ? 'XML da NF' : 'Protheus';
    fonte.forEach((it) => {
      const vals = [nt.nfd, nt.nfv, nt.cliente, nt.dtref, it.codigo || it.codigo_produto || '', it.descricao || '', it.unidade || '',
        Number(it.quantidade) || 0, Number(it.valor_unitario) || 0, Number(it.valor_total) || 0, origem];
      const row = wi.getRow(ri);
      vals.forEach((v, j) => {
        const cell = row.getCell(j + 1);
        cell.value = v === '' ? null : v;
        cell.font = font();
        if (IC[j][2]) cell.numFmt = IC[j][2];
        if (ri % 2 === 1) cell.fill = fill(ZEBRA);
        cell.border = { bottom: { style: 'hair', color: { argb: 'FF' + LINHA } } };
      });
      ri++;
    });
  });
  if (ri > 2) wi.autoFilter = { from: 'A1', to: `K${ri - 1}` };
  else wb.removeWorksheet(wi.id);

  /* ── 4. Resumo ───────────────────────────────────────────── */
  const wr = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FF' + AZUL } }, views: [{ showGridLines: false }] });
  wr.columns = [{ width: 2 }, { width: 40 }, { width: 12 }, { width: 18 }, { width: 3 }, { width: 30 }, { width: 12 }, { width: 18 }, { width: 2 }];
  faixaTitulo(wr, 'B1:H1', 'Resumo das notas', `Totais calculados a partir da aba Notas · gerado em ${geradoTxt}`);
  const rngN = (k) => `Notas!$${C[k]}$2:$${C[k]}$${Math.max(ultima, 2)}`;

  const bloco = (col, linhaIni, titulo, rotulos, chave) => {
    const [cL, cQ, cV] = col === 'B' ? ['B', 'C', 'D'] : ['F', 'G', 'H'];
    wr.mergeCells(`${cL}${linhaIni}:${cV}${linhaIni}`);
    const t = wr.getCell(`${cL}${linhaIni}`);
    t.value = titulo; t.font = font({ bold: true, size: 12, color: AZUL_ESC });
    t.border = { bottom: { style: 'medium', color: { argb: 'FF' + DOURADO } } };
    const h = linhaIni + 1;
    [[cL, ''], [cQ, 'Notas'], [cV, 'Valor (R$)']].forEach(([c, txt]) => {
      const cell = wr.getCell(`${c}${h}`);
      cell.value = txt; cell.font = font({ bold: true, color: CINZA_TXT, size: 9.5 });
      cell.alignment = { horizontal: c === cL ? 'left' : 'right' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + LINHA } } };
    });
    let r = h + 1;
    const ini = r;
    rotulos.forEach((rot) => {
      const a = wr.getCell(`${cL}${r}`); a.value = rot; a.font = font({ size: 9.5 }); a.alignment = { indent: 1 };
      const q = wr.getCell(`${cQ}${r}`); q.value = { formula: `COUNTIF(${rngN(chave)},${cL}${r})` }; q.font = font(); q.numFmt = '#,##0';
      const v = wr.getCell(`${cV}${r}`); v.value = { formula: `SUMIF(${rngN(chave)},${cL}${r},${rngN('valor')})` }; v.font = font(); v.numFmt = '#,##0.00';
      [a, q, v].forEach(c => { c.border = { bottom: { style: 'hair', color: { argb: 'FF' + LINHA } } }; });
      r++;
    });
    const a = wr.getCell(`${cL}${r}`); a.value = 'Total'; a.font = font({ bold: true });
    const q = wr.getCell(`${cQ}${r}`); q.value = { formula: `SUM(${cQ}${ini}:${cQ}${r - 1})` }; q.font = font({ bold: true }); q.numFmt = '#,##0';
    const v = wr.getCell(`${cV}${r}`); v.value = { formula: `SUM(${cV}${ini}:${cV}${r - 1})` }; v.font = font({ bold: true }); v.numFmt = '#,##0.00';
    [a, q, v].forEach(c => { c.border = { top: { style: 'thin', color: { argb: 'FF' + CINZA_TXT } } }; });
    return { ini, fim: r - 1, prox: r + 2 };
  };

  const st = bloco('B', 4, 'Por status operacional', Object.keys(STATUS_CORES), 'status');
  regrasStatus(wr, `B${st.ini}:B${st.fim}`, `$B${st.ini}`);
  const pz = bloco('F', 4, 'Por prazo de 90 dias', ['No prazo', 'Atenção', 'Vencido', 'Lançada'], 'prazo');
  regrasPrazo(wr, `F${pz.ini}:F${pz.fim}`, `$F${pz.ini}`);

  const mesesLista = [...new Set(notas.map(x => x.mesref).filter(Boolean))]
    .sort((a, b) => { const [ma, ya] = a.split('/').map(Number); const [mb, yb] = b.split('/').map(Number); return ya - yb || ma - mb; });
  const mesesRot = mesesLista; // formato MM/AAAA, igual à coluna Mês
  const linhaMes = Math.max(st.prox, pz.prox);
  bloco('B', linhaMes, 'Por mês (data de referência)', mesesRot, 'mesref');
  const areas = [...new Set(notas.map(x => x.area))].sort();
  bloco('F', linhaMes, 'Por área responsável', areas, 'area');

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

export function nomeArquivoConsulta(periodoTxt) {
  const d = new Date();
  const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const p = periodoTxt ? '_' + periodoTxt.replace(/[^\w]+/g, '-').replace(/-+$/, '') : '';
  return `Consulta_Notas_Devolucao${p}_${ts}.xlsx`;
}

export async function baixarPlanilhaConsulta(rows, opts = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const buf = await gerarPlanilhaConsulta(ExcelJS, rows, opts);
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivoConsulta(opts.periodoTxt);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { MESES };
