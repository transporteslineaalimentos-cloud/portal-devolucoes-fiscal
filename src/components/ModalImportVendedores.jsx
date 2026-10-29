import { useState } from 'react';
import * as XLSX from 'xlsx';
import { dbImportarClientesVendedor } from '../config/supabase';

/* ─────────────────────────────────────────────────────────────
   Atualiza o cadastro cliente x vendedor a partir do relatório
   de clientes do Protheus (Excel). Provisório até a API do TI.
   Só insere e atualiza: cliente que sumiu da planilha mantém o
   último vendedor, para não perder o histórico.
───────────────────────────────────────────────────────────── */

const semAc = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const COLUNAS = {
  cnpj: ['CNPJCPF', 'CNPJ', 'CPFCNPJ'],
  vendedor_cod: ['VENDEDOR', 'CODVENDEDOR'],
  vendedor_nome: ['NOMEVENDEDOR'],
  cod_cliente: ['CODIGO', 'CODCLIENTE'],
  loja: ['LOJA'],
  razao_social: ['RAZAOSOCIAL'],
  uf: ['ESTADO', 'UF'],
  municipio: ['MUNICIPIO', 'CIDADE'],
  regional: ['REGIONAL'],
  canal: ['CANAL'],
  segmento: ['SEGMENTO'],
  modalidade: ['MODALIDADE'],
  grupo: ['GRPEMPRESA', 'GRUPOEMPRESA'],
  interno_externo: ['INTEROEXTERNO', 'INTERNOEXTERNO'],
};

function texto(v) {
  if (v == null) return '';
  return String(v).trim();
}

function documento(v) {
  if (v == null) return '';
  // planilha que salvou o CNPJ como número perde os zeros da esquerda
  if (typeof v === 'number') {
    const s = String(Math.round(v));
    return s.length > 11 ? s.padStart(14, '0') : s;
  }
  return String(v).replace(/\D/g, '');
}

async function lerPlanilha(arquivo) {
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!rows.length) throw new Error('A planilha está vazia.');

  const cab = Object.keys(rows[0]);
  const mapa = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) {
    const achou = cab.find(c => nomes.includes(semAc(c)));
    if (achou) mapa[campo] = achou;
  }
  if (!mapa.cnpj || !mapa.vendedor_cod) {
    throw new Error('Não encontrei as colunas "CNPJ/CPF" e "VENDEDOR". Use o relatório de clientes com vendedor do Protheus.');
  }

  const linhas = [];
  let semDoc = 0;
  const vendedores = new Set();
  for (const r of rows) {
    const cnpj = documento(r[mapa.cnpj]);
    const vend = texto(r[mapa.vendedor_cod]);
    if (![11, 14].includes(cnpj.length) || !vend) { semDoc++; continue; }
    const l = { cnpj, vendedor_cod: vend };
    for (const campo of Object.keys(COLUNAS)) {
      if (campo === 'cnpj' || campo === 'vendedor_cod' || !mapa[campo]) continue;
      l[campo] = texto(r[mapa[campo]]);
    }
    vendedores.add(vend);
    linhas.push(l);
  }
  return { linhas, semDoc, vendedores: vendedores.size, total: rows.length };
}

export default function ModalImportVendedores({ info, onClose, onImportado }) {
  const [lido, setLido] = useState(null);
  const [nomeArq, setNomeArq] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [prog, setProg] = useState(null);
  const [res, setRes] = useState(null);

  const escolher = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErro(''); setRes(null); setLido(null); setNomeArq(f.name);
    try { setLido(await lerPlanilha(f)); } catch (x) { setErro(x.message); }
  };

  const enviar = async () => {
    setEnviando(true); setErro('');
    try {
      const r = await dbImportarClientesVendedor(lido.linhas, (feitos, total) => setProg({ feitos, total }));
      setRes(r);
      onImportado?.();
    } catch (x) { setErro(x.message); }
    setEnviando(false);
  };

  const n = (v) => Number(v || 0).toLocaleString('pt-BR');

  return (
    <div className="modal-overlay" style={{ zIndex: 600 }} onClick={e => e.target === e.currentTarget && !enviando && onClose()}>
      <div className="modal" role="dialog" aria-label="Atualizar cadastro de vendedores" style={{ maxWidth: 560, width: '100%' }}>
        <div className="modal-header" style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Cadastro de clientes x vendedor</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {info?.clientes
              ? `Hoje: ${n(info.clientes)} clientes e ${n(info.vendedores)} vendedores · atualizado em ${new Date(info.atualizado_em).toLocaleString('pt-BR')}${info.atualizado_por ? ' · ' + info.atualizado_por : ''}`
              : 'Nenhum cadastro carregado ainda.'}
          </div>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Envie o relatório de clientes com vendedor do Protheus (.xlsx). Clientes novos entram, quem mudou de vendedor
            é atualizado e quem não veio na planilha continua com o último vendedor conhecido.
          </div>

          <label className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start', cursor: enviando ? 'default' : 'pointer' }}>
            {nomeArq ? 'Escolher outro arquivo' : 'Escolher planilha'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={escolher} disabled={enviando} style={{ display: 'none' }}/>
          </label>

          {lido && !res && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{nomeArq}</div>
              <div>{n(lido.linhas.length)} clientes com CNPJ/CPF · {n(lido.vendedores)} vendedores</div>
              {lido.semDoc > 0 && <div style={{ color: 'var(--text-3)' }}>{n(lido.semDoc)} linha{lido.semDoc === 1 ? '' : 's'} sem CNPJ/CPF ou sem vendedor ficam de fora (ex.: clientes do exterior).</div>}
            </div>
          )}

          {prog && enviando && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Enviando {n(prog.feitos)} de {n(prog.total)}…</div>
          )}

          {res && (
            <div style={{ border: '1px solid var(--green)', background: 'var(--green-dim, #F0FDF4)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700 }}>Cadastro atualizado</div>
              <div>{n(res.novos)} clientes novos · {n(res.vendedor_alterado)} mudaram de vendedor · {n(res.sem_mudanca)} sem mudança</div>
              <div style={{ color: 'var(--text-3)' }}>Total no cadastro: {n(res.total_cadastro)} clientes. O painel já usa os dados novos.</div>
            </div>
          )}

          {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{erro}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={enviando}>{res ? 'Fechar' : 'Cancelar'}</button>
          {!res && (
            <button className="btn btn-primary btn-sm" onClick={enviar} disabled={!lido || !lido.linhas.length || enviando}>
              {enviando ? 'Atualizando…' : `Atualizar ${lido ? n(lido.linhas.length) + ' clientes' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
