/* ─────────────────────────────────────────────────────────────
   NF de débito contra o transportador (lote de cobrança)
   - texto da observação do pedido de venda no Protheus
   - itens por nota ou somados por produto
   - Excel de relação para mandar ao transportador junto com a NF
───────────────────────────────────────────────────────────── */

export const ETAPAS = [
  { k: 'montando', l: 'Montando',              curto: 'Montando',              cor: '#6D4FC2', bg: '#F0EBFB' },
  { k: 'pedido',   l: 'Pedido emitido',        curto: 'Aguardando faturamento', cor: '#B45309', bg: '#FEF3E2' },
  { k: 'faturado', l: 'NF de débito faturada', curto: 'Faturada',              cor: '#1E4DB7', bg: '#E8EEFB' },
  { k: 'enviado',  l: 'Enviada ao transportador', curto: 'Enviada',            cor: '#2F855A', bg: '#E6F4EC' },
];
export const ETAPA = Object.fromEntries(ETAPAS.map(e => [e.k, e]));
export const FILIAL_NOME = { '05207076000297': 'Anápolis', '05207076000459': 'Extrema' };

/** Campos fixos do pedido de venda da NF de débito no Protheus. */
export const PROTHEUS = { operacao: '50', prcLista: '0', tipoSaida: '627', armazem: '50', ambiente: '05', diasEntrega: 10 };

/** Filial do Protheus em que o pedido deve ser lançado (a mesma da NF de venda). */
export const FILIAL_PROTHEUS = { '05207076000297': '0102', '05207076000459': '0106' };

/** Dt. Entrega do pedido: hoje + 10 dias corridos, no formato do Protheus (dd/mm/aaaa). */
export function dataEntregaProtheus(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + PROTHEUS.diasEntrega);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Número no formato do Protheus (vírgula decimal, sem separador de milhar), sem zeros à direita. */
export function numProtheus(v, maxDec = 6) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(maxDec).replace(/\.?0+$/, '').replace('.', ',');
}
export const qtdTxt = (v) => numProtheus(v, 4);

/** Notas do lote com os itens a cobrar: os congelados no pedido (se já houver) ou os calculados agora. */
export function notasDoLote(lote) {
  const snap = Array.isArray(lote?.itens) ? lote.itens : null;
  const vivas = lote?.notas || [];
  if (snap && snap.length) {
    return snap.map(s => {
      const viva = vivas.find(n => n.id === s.id) || {};
      return { ...viva, id: s.id, nf_numero: s.nf_numero ?? viva.nf_numero, nf_venda: s.nf_venda ?? viva.nf_venda,
        lancamento_manual: s.lancamento_manual ?? viva.lancamento_manual, nome_emitente: s.nome_emitente ?? viva.nome_emitente,
        motivo_devolucao: s.motivo ?? viva.motivo_devolucao, valor_lote: Number(s.valor), itens_lote: s.itens || [] };
    });
  }
  return vivas.map(n => ({ ...n, valor_lote: n.valor_sugerido == null ? null : Number(n.valor_sugerido), itens_lote: n.itens_cobrar || [] }));
}

export const refNota = (n) => n.lancamento_manual || !n.nf_numero ? `NF venda ${n.nf_venda || '—'} (devolução total)` : `NFD ${n.nf_numero}`;

/** Observação do pedido: "Cobrança referente a avaria de transporte - NFD 185612, 255920". */
/** Nome curto do motivo para a observação da NF (o campo do Protheus é limitado). */
const MOTIVO_CURTO = {
  'AVARIA DE TRANSPORTE': 'Avaria',
  'FALTA DE PRODUTO NO ATO DA ENTREGA': 'Falta',
  'ERRO OPERACIONAL TRANSPORTADOR': 'Erro Operacional',
  'ERRO DE CARREGAMENTO': 'Erro Carregamento',
  'INVERSÃO DE PRODUTO': 'Inversao',
};
const motivoCurto = (m) => MOTIVO_CURTO[String(m || '').toUpperCase().trim()]
  || String(m || '').toLowerCase().split(/\s+/).filter(p => p.length > 2 && !['de', 'do', 'da', 'no', 'na'].includes(p)).slice(0, 2)
    .map(p => p[0].toUpperCase() + p.slice(1)).join(' ');

/** Observação do pedido, no padrão curto: "Ref Cob Avaria NFD 1132199;1132200;1132201". */
export function textoObservacao(lote, notas) {
  const motivos = [...new Set(notas.map(n => n.motivo_devolucao).filter(Boolean))];
  const motivo = motivos.length === 1 ? motivoCurto(motivos[0]) : '';
  const nfds = notas.filter(n => !(n.lancamento_manual || !n.nf_numero)).map(n => n.nf_numero);
  const totais = notas.filter(n => n.lancamento_manual || !n.nf_numero).map(n => n.nf_venda);
  const partes = [];
  if (nfds.length) partes.push(`NFD ${nfds.join(';')}`);
  if (totais.length) partes.push(`NF Venda ${totais.join(';')}`);
  return ['Ref Cob', motivo, partes.join(' ')].filter(Boolean).join(' ');
}

/** Linhas do pedido somadas por produto. */
export function somarPorProduto(notas) {
  const m = new Map();
  notas.forEach(n => (n.itens_lote || []).forEach(it => {
    const k = it.codigo || `sem-codigo-${it.descricao}`;
    const g = m.get(k) || { codigo: it.codigo, descricao: it.descricao, unidade: it.unidade, qtd: 0, valor_total: 0, nfs: [], alerta: null };
    g.qtd += Number(it.qtd) || 0; g.valor_total += Number(it.valor_total) || 0;
    g.nfs.push(refNota(n)); if (it.alerta) g.alerta = it.alerta;
    if (it.valor_total == null) g.semValor = true;
    m.set(k, g);
  }));
  return [...m.values()].map(g => ({ ...g, valor_total: Math.round(g.valor_total * 100) / 100,
    valor_unitario: g.qtd ? g.valor_total / g.qtd : null }));
}

const FONT = 'Arial';
const AZUL = '1E4DB7';
const BRL = '"R$" #,##0.00';
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
const dataUTC = (s) => { const m = s ? String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/) : null; return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || ''; };

function tabela(ws, ini, cols, linhas) {
  const cab = ws.getRow(ini);
  cols.forEach((c, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = c.t; cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = fill(AZUL);
    cell.alignment = { vertical: 'middle', horizontal: ['brl', 'num', 'qtd'].includes(c.fmt) ? 'right' : 'left' };
    ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width || 0, c.w);
  });
  linhas.forEach((r, li) => {
    const row = ws.getRow(ini + 1 + li);
    cols.forEach((c, i) => {
      let v = c.v(r);
      if (c.fmt === 'data') v = dataUTC(v);
      else if (['brl', 'num', 'qtd'].includes(c.fmt)) v = v == null || v === '' ? null : Number(v);
      const cell = row.getCell(i + 1);
      cell.value = v ?? '';
      cell.font = { name: FONT, size: 10, bold: !!r._total };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E5EA' } } };
      if (c.fmt === 'brl') cell.numFmt = BRL;
      if (c.fmt === 'num') cell.numFmt = '#,##0.00####';
      if (c.fmt === 'qtd') cell.numFmt = '#,##0.####';
      if (c.fmt === 'data') cell.numFmt = 'dd/mm/yyyy';
      if (r._total) cell.fill = fill('F1F3F7');
    });
  });
  return ini + linhas.length + 1;
}

/** Excel para o transportador: qual NFD foi cobrada em qual NF de débito, com os itens. */
export async function baixarRelacaoLotes(lotes, nomeArquivo) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Linea Alimentos';
  lotes = [...lotes].sort((a, b) => String(a.transportador_nome).localeCompare(String(b.transportador_nome)) || String(a.nf_debito || '').localeCompare(String(b.nf_debito || ''), 'pt-BR', { numeric: true }));
  // resumo: uma linha por NF de débito
  const transpR = [...new Set(lotes.map(l => l.transportador_nome))];
  const wr = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  wr.getCell(1, 1).value = 'NFs de débito enviadas';
  wr.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  wr.getCell(2, 1).value = `${transpR.length === 1 ? `${transpR[0]} · CNPJ ${fmtCnpj(lotes[0].transportador_cnpj)}  ·  ` : ''}${lotes.length} NFs de débito · Linea Alimentos · gerado em ${new Date().toLocaleDateString('pt-BR')}`;
  wr.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF5B6472' } };
  const resumo = lotes.map(l => { const ns = notasDoLote(l); return { l, ns, total: ns.reduce((a, n) => a + (Number(n.valor_lote) || 0), 0) }; });
  tabela(wr, 4, [
    { t: 'NF de débito', w: 13, v: x => x.l.nf_debito || '(a faturar)' },
    { t: 'Emissão', w: 12, v: x => x.l.dt_nf_debito, fmt: 'data' },
    ...(transpR.length > 1 ? [{ t: 'Transportador', w: 34, v: x => x.l.transportador_nome }] : []),
    { t: 'Motivo', w: 32, v: x => x.l.motivo },
    { t: 'Qtd NFDs', w: 9, v: x => x.ns.length, fmt: 'qtd' },
    { t: 'NFs de devolução cobradas', w: 44, v: x => x._total ? '' : x.ns.map(n => n.lancamento_manual || !n.nf_numero ? `venda ${n.nf_venda} (dev. total)` : n.nf_numero).join(', ') },
    { t: 'Valor', w: 15, v: x => x.total, fmt: 'brl' },
  ], [...resumo, { _total: true, l: { nf_debito: 'Total' }, ns: resumo.flatMap(x => x.ns), total: resumo.reduce((a, x) => a + x.total, 0) }]);

  const ws = wb.addWorksheet('Relação', { views: [{ showGridLines: false }] });
  ws.getCell(1, 1).value = 'Relação de devoluções cobradas por NF de débito';
  ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  const transp = [...new Set(lotes.map(l => l.transportador_nome))];
  ws.getCell(2, 1).value = `${transp.length === 1 ? `${transp[0]} · CNPJ ${fmtCnpj(lotes[0].transportador_cnpj)}  ·  ` : ''}Linea Alimentos · gerado em ${new Date().toLocaleDateString('pt-BR')}`;
  ws.getCell(2, 1).font = { name: FONT, size: 10, color: { argb: 'FF5B6472' } };

  const linhas = [];
  lotes.forEach(l => notasDoLote(l).forEach(n => linhas.push({ l, n })));
  let r = tabela(ws, 4, [
    { t: 'NF de débito', w: 13, v: x => x._total ? '' : (x.l.nf_debito || '(a faturar)') },
    { t: 'Emissão NF débito', w: 13, v: x => x.l.dt_nf_debito, fmt: 'data' },
    ...(transp.length > 1 ? [{ t: 'Transportador', w: 34, v: x => x.l.transportador_nome }] : []),
    { t: 'NF de devolução', w: 14, v: x => x._total ? '' : (x.n.lancamento_manual || !x.n.nf_numero ? 'Dev. total' : x.n.nf_numero) },
    { t: 'NF de venda', w: 12, v: x => x.n.nf_venda },
    { t: 'Cliente', w: 38, v: x => x.n.nome_emitente },
    { t: 'Chave da NFD', w: 47, v: x => x.n.chave_nfe },
    { t: 'Motivo', w: 32, v: x => x.n.motivo_devolucao },
    { t: 'Valor cobrado', w: 15, v: x => x.n.valor_lote, fmt: 'brl' },
  ], [...linhas, { _total: true, l: {}, n: { nome_emitente: 'Total', valor_lote: linhas.reduce((a, x) => a + (Number(x.n.valor_lote) || 0), 0) } }]);

  const wi = wb.addWorksheet('Itens', { views: [{ showGridLines: false }] });
  wi.getCell(1, 1).value = 'Itens cobrados (código Linea, valor da NF de venda)';
  wi.getCell(1, 1).font = { name: FONT, size: 14, bold: true };
  const its = [];
  lotes.forEach(l => notasDoLote(l).forEach(n => (n.itens_lote || []).forEach(it => its.push({ l, n, it }))));
  tabela(wi, 3, [
    { t: 'NF de débito', w: 13, v: x => x.l.nf_debito || '(a faturar)' },
    { t: 'NF de devolução', w: 14, v: x => x.n.lancamento_manual || !x.n.nf_numero ? 'Dev. total' : x.n.nf_numero },
    { t: 'NF de venda', w: 12, v: x => x.n.nf_venda },
    { t: 'Código', w: 12, v: x => x.it.codigo },
    { t: 'Produto', w: 42, v: x => x.it.descricao },
    { t: 'Un', w: 6, v: x => x.it.unidade },
    { t: 'Qtd', w: 9, v: x => x.it.qtd, fmt: 'qtd' },
    { t: 'Valor unitário', w: 14, v: x => x.it.valor_unitario, fmt: 'num' },
    { t: 'Valor total', w: 14, v: x => x.it.valor_total, fmt: 'brl' },
    { t: 'Ocorrência', w: 18, v: x => x.it.motivo },
  ], its);
  void r;

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(nomeArquivo || 'Relação NF de débito').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
