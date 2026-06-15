import * as XLSX from 'xlsx';
import { CNPJ_MAP } from '../utils.jsx';

const fmtDateCell = (d) => d || '';

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

function nfVendaNumero(chave) {
  if (!chave) return '';
  return String(parseInt(chave.slice(25, 34), 10) || '');
}

export function exportDevolucoesToExcel(rows, { filename = 'devolucoes_fiscais' } = {}) {
  // ── Aba 1: Devoluções (uma linha por NF) ──────────────────
  const devSheet = rows.map(r => ({
    'NF Devolução':        r.nf_numero ?? '',
    'Série':               r.nf_serie ?? '',
    'Chave NF-e':          r.chave_nfe ?? '',
    'Emitente':            r.nome_emitente ?? '',
    'CNPJ Emitente':       r.cnpj_emitente ?? '',
    'Município':           r.municipio_emitente ?? '',
    'UF':                  r.uf_emitente ?? '',
    'Empresa Destino':     CNPJ_MAP[r.cnpj_destinatario] || r.cnpj_destinatario || '',
    'Natureza Operação':   r.nat_operacao ?? '',
    'CFOPs':               Array.isArray(r.cfops) ? r.cfops.join(', ') : (r.cfops ?? ''),
    'Data Emissão':        fmtDateCell(r.dt_emissao),
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
    'Qtd Itens':           Array.isArray(r.itens) ? r.itens.length : 0,
  }));

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
