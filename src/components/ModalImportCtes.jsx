import { useState } from 'react';
import * as XLSX from 'xlsx';
import { dbImportarMovimentacaoCtes, dbRefreshCustosFrete } from '../config/supabase';

/* Importa a planilha "Movimentação por Nota Fiscal" do Active (uma linha por CT-e x NF).
   O recebimento automático continua igual: aqui só entram CT-es que faltam na base;
   linhas repetidas (mesmo transportador + CT-e + NF) são ignoradas pelo banco. */

const LOTE = 2000;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const digitos = (s) => String(s ?? '').replace(/\D/g, '');
const cnpjDe = (s) => digitos(String(s ?? '').split(' - ')[0]).slice(0, 14);
const nomeDe = (s) => { const p = String(s ?? '').split(' - '); return (p.length > 1 ? p.slice(1).join(' - ') : p[0]).trim() || null; };
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return isFinite(n) ? n : null;
};
const dataISO = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v))) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = String(v).match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
};

const COLUNAS = {
  'nota fiscal': 'nf_numero', 'emissao do pedido': 'dt_pedido', 'remetente': 'remetente',
  'cidade destino': 'cidade_destino', 'uf destino': 'uf_destino', 'destinatario': 'destinatario',
  'centro de custo': 'centro_custo', 'valor dos produtos': 'valor_produtos', 'peso': 'peso',
  'quant. volumes': 'volumes', 'transportador': 'transportador', 'cte': 'cte_numero',
  'cte - tipo': 'cte_tipo', 'cte - rateio valor nf': 'valor_rateio', 'emissao cte': 'dt_cte',
  'chave da nota fiscal': 'nf_chave', 'romaneio': 'romaneio', 'cfop': 'cfop',
};
const OBRIGATORIAS = ['nf_chave', 'transportador', 'cte_numero', 'cte_tipo', 'valor_rateio', 'dt_cte', 'cfop'];

function lerPlanilha(buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const brutas = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!brutas.length) throw new Error('A planilha está vazia.');
  const mapa = {};
  Object.keys(brutas[0]).forEach(h => { const k = COLUNAS[norm(h)]; if (k) mapa[h] = k; });
  const faltam = OBRIGATORIAS.filter(c => !Object.values(mapa).includes(c));
  if (faltam.length) throw new Error('Colunas não encontradas: ' + faltam.join(', ') + '. Use o relatório "Movimentação por Nota Fiscal" do Active.');

  const linhas = [];
  let ignoradas = 0;
  for (const b of brutas) {
    const r = {};
    for (const [h, k] of Object.entries(mapa)) r[k] = b[h];
    const chave = digitos(r.nf_chave);
    if (chave.length !== 44 || !r.cte_numero || !r.transportador) { ignoradas++; continue; }
    linhas.push({
      nf_chave: chave,
      nf_numero: r.nf_numero != null ? String(r.nf_numero) : null,
      cfop: r.cfop != null ? String(r.cfop).slice(0, 4) : null,
      remetente_cnpj: cnpjDe(r.remetente) || null,
      destinatario_cnpj: cnpjDe(r.destinatario) || null,
      destinatario_nome: nomeDe(r.destinatario),
      cidade_destino: r.cidade_destino ?? null,
      uf_destino: r.uf_destino ?? null,
      centro_custo: r.centro_custo ?? null,
      valor_produtos: num(r.valor_produtos),
      peso: num(r.peso),
      volumes: num(r.volumes) != null ? Math.round(num(r.volumes)) : null,
      transportador_cnpj: cnpjDe(r.transportador),
      transportador_nome: nomeDe(r.transportador),
      cte_numero: digitos(r.cte_numero).replace(/^0+/, ''),
      cte_tipo: r.cte_tipo ?? null,
      valor_rateio: num(r.valor_rateio),
      dt_cte: dataISO(r.dt_cte),
      dt_pedido: dataISO(r.dt_pedido),
      romaneio: r.romaneio != null && r.romaneio !== '' ? String(r.romaneio) : null,
    });
  }
  return { linhas, ignoradas };
}

export default function ModalImportCtes({ onClose, onImported }) {
  const [arquivo, setArquivo] = useState(null);
  const [lidas, setLidas] = useState(null);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState(null);
  const [resultado, setResultado] = useState(null);

  const escolher = async (file) => {
    setErro(''); setLidas(null); setResultado(null); setArquivo(file);
    if (!file) return;
    try { setLidas(lerPlanilha(await file.arrayBuffer())); }
    catch (e) { setErro(e.message); }
  };

  const importar = async () => {
    const { linhas } = lidas;
    let inseridas = 0, existentes = 0;
    setErro('');
    try {
      for (let i = 0; i < linhas.length; i += LOTE) {
        setProgresso({ feitas: i, total: linhas.length });
        const r = await dbImportarMovimentacaoCtes(linhas.slice(i, i + LOTE), arquivo.name);
        inseridas += r.inseridas; existentes += r.ja_existentes;
      }
      setProgresso({ feitas: linhas.length, total: linhas.length, atualizando: true });
      await dbRefreshCustosFrete();
      setResultado({ inseridas, existentes });
      onImported?.();
    } catch (e) { setErro(e.message); }
    setProgresso(null);
  };

  const ctes = lidas ? new Set(lidas.linhas.map(l => l.transportador_cnpj + '|' + l.cte_numero)).size : 0;
  const periodo = lidas && lidas.linhas.length
    ? lidas.linhas.reduce((a, l) => ({ min: !a.min || (l.dt_cte && l.dt_cte < a.min) ? l.dt_cte : a.min, max: !a.max || (l.dt_cte && l.dt_cte > a.max) ? l.dt_cte : a.max }), {})
    : null;
  const br = (iso) => iso ? iso.split('-').reverse().join('/') : '';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !progresso && onClose()}>
      <div className="modal" style={{ width: 560, maxWidth: 'calc(100vw - 32px)' }} role="dialog" aria-label="Importar CT-es">
        <div style={{ padding: '18px 22px 6px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Importar CT-es do Active</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
            Envie o relatório <b>Movimentação por Nota Fiscal</b>. Só entram CT-es que ainda não estão na base;
            os que já chegaram pelo recebimento automático continuam valendo como estão.
          </p>
        </div>
        <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="file" accept=".xlsx,.xls" disabled={!!progresso}
            onChange={e => escolher(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }}/>

          {lidas && !resultado && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
              <b>{lidas.linhas.length.toLocaleString('pt-BR')}</b> linhas · <b>{ctes.toLocaleString('pt-BR')}</b> CT-es
              {periodo?.min && <> · emitidos de {br(periodo.min)} a {br(periodo.max)}</>}
              {lidas.ignoradas > 0 && <div style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{lidas.ignoradas} linhas sem chave da NF ou sem CT-e serão ignoradas.</div>}
            </div>
          )}

          {progresso && (
            <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
              {progresso.atualizando ? 'Recalculando o painel…' : `Enviando ${progresso.feitas.toLocaleString('pt-BR')} de ${progresso.total.toLocaleString('pt-BR')} linhas…`}
              <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progresso.feitas / Math.max(1, progresso.total)) * 100}%`, background: 'var(--blue)', transition: 'width 200ms' }}/>
              </div>
            </div>
          )}

          {resultado && (
            <div style={{ background: 'var(--green-dim)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>
              <b>{resultado.inseridas.toLocaleString('pt-BR')}</b> linhas novas gravadas ·{' '}
              {resultado.existentes.toLocaleString('pt-BR')} já estavam na base e foram ignoradas. O painel já foi atualizado.
            </div>
          )}

          {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{erro}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!progresso}>{resultado ? 'Fechar' : 'Cancelar'}</button>
            {!resultado && (
              <button className="btn btn-primary btn-sm" onClick={importar} disabled={!lidas || !lidas.linhas.length || !!progresso}>
                {progresso ? 'Importando…' : 'Importar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
