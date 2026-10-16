import { calcStatusOperacional } from '../utils.jsx';
const CANAIS = { 'CANAL INDIRETO':'CNI - CANAL INDIRETO','CANAL DIRETO':'CND - CANAL DIRETO','FARMA KEY ACCOUNT':'FKA - FARMA KEY ACCOUNT','CASH & CARRY':'CRY - CASH & CARRY','KEY ACCOUNT':'KEY - KEY ACCOUNT','ECOMMERCE':'ECO - ECOMMERCE','NOVOS NEGÓCIOS':'NNG - NOVOS NEGÓCIOS','CANAL VERDE':'CNV - CANAL VERDE' };
const canalDe = (cc) => cc ? (CANAIS[String(cc).toUpperCase()] || String(cc).toUpperCase()) : '';
import * as XLSX from 'xlsx';
import { CNPJ_MAP } from '../utils.jsx';

const fmtDateCell = (d) => {
  if (!d) return '';
  try {
    // Aceita 'YYYY-MM-DD' ou ISO datetime — converte para 'DD/MM/AAAA'
    const s = String(d).slice(0, 10); // pega só a parte da data
    const [y, m, dia] = s.split('-');
    if (!y || !m || !dia) return d;
    return `${dia.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  } catch { return d; }
};

const STATUS_LABELS = {
  pendente:   'Pendente',
  em_analise: 'Em análise',
  aprovada:   'Aprovada',
  rejeitada:  'Rejeitada',
  concluida:  'Concluída',
};

const COBRANCA_LABELS = {
  pendente_cobranca_transportador: 'Pendente cobrança transportador',
  cobrado: 'Cobrado',
  isento:  'Isento',
};

function mesRef(r) {
  const d = (r.lancamento_manual && r.dt_devolucao) ? r.dt_devolucao : r.dt_emissao;
  if (!d) return '';
  const [y, m] = String(d).slice(0, 7).split('-');
  return `${m}/${y}`;
}

function nfVendaNumero(chave) {
  if (!chave) return '';
  return String(parseInt(chave.slice(25, 34), 10) || '');
}

export function mapDevolucaoRow(r) {
  return ({
    'NF Devolução':        r.nf_numero ?? '',
    'Série':               r.nf_serie ?? '',
    'Chave NF-e':          r.chave_nfe ?? '',
    'Emitente':            r.nome_emitente ?? '',
    'CNPJ Emitente':       r.cnpj_emitente ?? '',
    'Município':           r.municipio_emitente ?? '',
    'UF':                  r.uf_emitente ?? '',
    'Linha Produto':       r.linha_produto || '',
    'Empresa Destino':     CNPJ_MAP[r.cnpj_destinatario] || r.cnpj_destinatario || '',
    'Natureza Operação':   r.nat_operacao ?? '',
    'CFOPs':               Array.isArray(r.cfops) ? r.cfops.join(', ') : (r.cfops ?? ''),
    'Data Emissão':        fmtDateCell(r.dt_emissao),
    'Data Devolução':      r.lancamento_manual ? fmtDateCell(r.dt_devolucao) : '',
    'Mês de referência':   mesRef(r),
    'Valor Total':         r.valor ?? 0,
    'Valor Produtos':      r.valor_produtos ?? 0,
    'Valor ICMS':          r.valor_icms ?? 0,
    'Valor ICMS-ST':       r.valor_st ?? 0,
    'Tipo':                r.lancamento_manual ? 'Total (manual)' : 'Parcial (NFD)',
    'Status':              STATUS_LABELS[r.status_portal] || r.status_portal || '',
    'Motivo Devolução':    r.motivo_devolucao ?? '',
    'Área Responsável':    r.area_responsavel ?? '',
    'Observação NF (XML)': r.inf_complementar ?? '',
    'NF Venda (nº)':       nfVendaNumero(r.chave_nfe_referenciada),
    'Chave NF Venda':      r.chave_nfe_referenciada ?? '',
    'NF Venda Localizada': r.nf_venda_localizada == null ? '' : (r.nf_venda_localizada ? 'Sim' : 'Não'),
    'Flag Emissão x Entrega': r.flag_emissao_entrega ?? '',
    'Lançada Protheus':    r.lancado_protheus ? 'Sim' : 'Não',
    'Data Lançamento Protheus': fmtDateCell(r.dt_lancamento_protheus),
    'Status Cobrança':     COBRANCA_LABELS[r.status_cobranca] || '',
    'NF Débito':           r.nf_debito ?? '',
    'Data Cobrança':       r.data_cobranca ? r.data_cobranca.slice(0, 10) : '',
    'Cobrado Por':         r.cobrado_por ?? '',
    'Obs. Cobrança':       r.obs_cobranca ?? '',
    'Transportador (NFD)':       r.transportador_cobranca ?? '',
    'CNPJ Transportador (NFD)':   r.transportador_cnpj_cobranca ?? '',
    'Centro de custo':            r.centro_custo ?? '',
    'Canal':                      canalDe(r.centro_custo),
    'Status Operacional':         calcStatusOperacional(r) ?? '',
    'Chegou CD':                  r.retornou_cd ? 'SIM' : 'NÃO',
    'Qtd Itens':                  Array.isArray(r.itens) ? r.itens.length : 0,
  });
}

export function exportDevolucoesToExcel(rows, { filename = 'devolucoes_fiscais' } = {}) {
  // ── Aba 1: Devoluções (uma linha por NF) ──────────────────
  const devSheet = rows.map(mapDevolucaoRow);

  // ── Aba 2: Itens (uma linha por item) ─────────────────────
  const itensSheet = [];
  rows.forEach(r => {
    const itens = Array.isArray(r.itens) ? r.itens : [];
    itens.forEach(it => {
      itensSheet.push({
        'NF Devolução':   r.nf_numero ?? '',
        'Série':          r.nf_serie ?? '',
        'Emitente':       r.nome_emitente ?? '',
        'Data Emissão':   fmtDateCell(r.dt_emissao),
        'Item':           it.item ?? '',
        'Código':         it.codigo ?? '',
        'Produto':        it.descricao ?? '',
        'Unidade':        it.unidade ?? '',
        'CFOP':           it.cfop ?? '',
        'Quantidade':     it.quantidade ?? 0,
        'Valor Unitário': it.valor_unitario ?? 0,
        'Valor Total':    it.valor_total ?? 0,
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(devSheet);
  const ws2 = XLSX.utils.json_to_sheet(itensSheet);

  ws1['!cols'] = [
    { wch: 12 }, { wch: 6 }, { wch: 46 }, { wch: 34 }, { wch: 18 },
    { wch: 20 }, { wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 40 },
    { wch: 12 }, { wch: 46 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 28 }, { wch: 22 }, { wch: 9 },
  ];
  ws2['!cols'] = [
    { wch: 12 }, { wch: 6 }, { wch: 34 }, { wch: 12 }, { wch: 6 },
    { wch: 14 }, { wch: 38 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
    { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Devoluções');
  XLSX.utils.book_append_sheet(wb, ws2, 'Itens');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}

const COBRANCA_STATUS = {
  pendente_cobranca_transportador: 'Pendente',
  cobrado: 'Cobrado',
  isento: 'Isento',
};

function calcAging(dtLancamento) {
  if (!dtLancamento) return '';
  const dias = Math.floor((Date.now() - new Date(dtLancamento).getTime()) / 86400000);
  return dias;
}

export function exportCobrancasToExcel(rows, { filename = 'cobrancas_transportadores' } = {}) {
  const XLSX = window._XLSX || null;
  // importa dinamicamente
  return import('xlsx').then(({ utils, writeFile }) => {
    const data = rows.map(r => ({
      'NF Devolução':         r.nf_numero ?? '',
      'Série':                r.nf_serie ?? '',
      'Emitente':             r.nome_emitente ?? '',
      'UF':                   r.uf_emitente ?? '',
      'Município':            r.municipio_emitente ?? '',
      'Data Emissão':         fmtDateCell(r.dt_emissao),
      'Data Lançamento Protheus': fmtDateCell(r.dt_lancamento_protheus),
      'Valor NFD':            r.valor ?? 0,
      'Motivo':               r.motivo_devolucao ?? '',
      'Área':                 r.area_responsavel ?? '',
      'Centro de Custo':      r.centro_custo ?? '',
      'Transportador':        r.transportador_cobranca ?? '',
      'CNPJ Transportador':   r.transportador_cnpj_cobranca ?? '',
      'Status Cobrança':      COBRANCA_STATUS[r.status_cobranca] || r.status_cobranca || '',
      'NF Débito':            r.nf_debito ?? '',
      'Data Cobrança':        fmtDateCell(r.data_cobranca),
      'Cobrado Por':          r.cobrado_por ?? '',
      'Obs. Cobrança':        r.obs_cobranca ?? '',
      'Dias desde lançamento': calcAging(r.dt_lancamento_protheus),
    }));

    const wb = utils.book_new();
    const ws = utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 6 }, { wch: 36 }, { wch: 4 }, { wch: 20 },
      { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 14 },
      { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    ];
    utils.book_append_sheet(wb, ws, 'Cobranças');
    const dateStr = new Date().toISOString().slice(0, 10);
    writeFile(wb, `${filename}_${dateStr}.xlsx`);
  });
}


// ─── Painel Gerencial: dash + notas num único arquivo ───────────────
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function pivotDim(linhas, mesIni, mesFim, fatMes, rotulo) {
  const m = new Map();
  for (const r of linhas || []) {
    if (r.mes < mesIni || r.mes > mesFim) continue;
    if (!m.has(r.dim)) m.set(r.dim, { dim: r.dim, v: {}, tt: 0, q: 0 });
    const o = m.get(r.dim);
    o.v[r.mes] = (o.v[r.mes] || 0) + Number(r.valor || 0);
    o.tt += Number(r.valor || 0); o.q += Number(r.qtd || 0);
  }
  const fatPeriodo = Object.values(fatMes).reduce((a, b) => a + (b || 0), 0);
  return [...m.values()].sort((a, b) => b.tt - a.tt).map(o => {
    const row = { [rotulo]: o.dim };
    for (let i = mesIni; i <= mesFim; i++) row[MESES_PT[i - 1]] = Math.round((o.v[i] || 0) * 100) / 100;
    row['Total período'] = Math.round(o.tt * 100) / 100;
    row['Qtd NFs'] = o.q;
    row['% s/ faturamento'] = fatPeriodo ? Math.round((o.tt / fatPeriodo) * 10000) / 100 : null;
    return row;
  });
}

function sheetComTitulo(titulo, linhas) {
  const ws = XLSX.utils.aoa_to_sheet([[titulo], []]);
  XLSX.utils.sheet_add_json(ws, linhas, { origin: 'A3' });
  const ncols = linhas[0] ? Object.keys(linhas[0]).length : 1;
  ws['!cols'] = [{ wch: 42 }, ...Array.from({ length: ncols }, () => ({ wch: 14 }))];
  return ws;
}

export function exportPainelGerencialExcel(painel, notas, { ano, mesIni, mesFim }) {
  const periodo = mesIni === mesFim ? `${MESES_PT[mesIni - 1]}/${ano}` : `${MESES_PT[mesIni - 1]} a ${MESES_PT[mesFim - 1]}/${ano}`;
  const meses = (painel.meses || []).filter(m => m.mes >= mesIni && m.mes <= mesFim);
  const fatMes = Object.fromEntries(meses.map(m => [m.mes, Number(m.faturamento) || 0]));
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  const resumo = meses.map(m => {
    const p = Number(m.parcial) || 0, t = Number(m.total) || 0, f = Number(m.faturamento) || 0;
    return { 'Mês': `${MESES_PT[m.mes - 1]}/${ano}`, 'Devolução parcial (R$)': r2(p), 'Qtd parcial': m.qtd_parcial,
      'Devolução total (R$)': r2(t), 'Qtd total': m.qtd_total, 'Soma (R$)': r2(p + t),
      'Faturamento (R$)': r2(f), '% s/ faturamento': f ? Math.round(((p + t) / f) * 10000) / 100 : null };
  });
  const tot = resumo.reduce((a, r) => ({ p: a.p + r['Devolução parcial (R$)'], qp: a.qp + r['Qtd parcial'], t: a.t + r['Devolução total (R$)'], qt: a.qt + r['Qtd total'], f: a.f + r['Faturamento (R$)'] }), { p: 0, qp: 0, t: 0, qt: 0, f: 0 });
  resumo.push({ 'Mês': 'TOTAL', 'Devolução parcial (R$)': r2(tot.p), 'Qtd parcial': tot.qp, 'Devolução total (R$)': r2(tot.t), 'Qtd total': tot.qt,
    'Soma (R$)': r2(tot.p + tot.t), 'Faturamento (R$)': r2(tot.f), '% s/ faturamento': tot.f ? Math.round(((tot.p + tot.t) / tot.f) * 10000) / 100 : null });

  const wb = XLSX.utils.book_new();
  const titulo = (t) => `${t} · ${periodo} · gerado em ${new Date().toLocaleString('pt-BR')}`;
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Geração de retorno e devolução'), resumo), 'Resumo mensal');
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Abertura por área'), pivotDim(painel.area, mesIni, mesFim, fatMes, 'Área')), 'Por área');
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Abertura por motivo'), pivotDim(painel.motivo, mesIni, mesFim, fatMes, 'Motivo')), 'Por motivo');
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Abertura por canal'), pivotDim(painel.canal, mesIni, mesFim, fatMes, 'Canal')), 'Por canal');
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Status operacional'),
    (painel.status || []).map(s => ({ 'Status': s.status, 'Valor (R$)': r2(s.valor), 'Qtd NFs': s.qtd }))), 'Status operacional');
  XLSX.utils.book_append_sheet(wb, sheetComTitulo(titulo('Pendente de retorno por transportador (AGENDAR REVERSA)'),
    (painel.pendente_transp || []).map(s => ({ 'Transportador': s.transportador, 'Valor (R$)': r2(s.valor), 'Qtd NFs': s.qtd }))), 'Pendente transportador');

  const wsN = XLSX.utils.json_to_sheet(notas.map(mapDevolucaoRow));
  wsN['!autofilter'] = { ref: wsN['!ref'] };
  wsN['!cols'] = Object.keys(mapDevolucaoRow(notas[0] || {})).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2)) }));
  XLSX.utils.book_append_sheet(wb, wsN, 'Notas');

  const nomeArq = `painel_devolucoes_${ano}_${String(mesIni).padStart(2,'0')}-${String(mesFim).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, nomeArq);
}
