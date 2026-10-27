import { useCallback, useEffect, useMemo, useState } from 'react';
import { dbListarRetornoCD, dbRegistrarRetornoCD } from '../config/supabase';

/* ─────────────────────────────────────────────────────────────
   Conferência de recebimento no CD.
   A nota chega, a pessoa marca que chegou e lança, item a item,
   a quantidade e a condição do que veio. Substitui a planilha
   que era importada à mão, e ainda baixa o relatório do setor.
───────────────────────────────────────────────────────────── */

const DESTINOS = [
  { v: 'BOM',            l: 'Bom',            cor: '#16A34A', bg: '#F0FDF4', bd: '#BBF7D0' },
  { v: 'AVARIA',         l: 'Avaria',         cor: '#DC2626', bg: '#FEF2F2', bd: '#FECACA' },
  { v: 'FALTA',          l: 'Falta',          cor: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
  { v: 'VALIDADE CURTA', l: 'Validade curta', cor: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
  { v: 'IMPROPRIO',      l: 'Impróprio',      cor: '#1D4ED8', bg: '#EFF6FF', bd: '#BFDBFE' },
];
const CFG = Object.fromEntries(DESTINOS.map(d => [d.v, d]));
const COBRAR = new Set(['AVARIA', 'FALTA', 'IMPROPRIO']);
const FILIAIS = ['ANAPOLIS', 'EXTREMA'];

const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (d) => { if (!d) return '—'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };

/* ─── Conferência de uma nota ──────────────────────────────── */
function Conferencia({ nota, onSalvo, onFechar }) {
  /* Lançamento manual (devolução total sem NFD) não tem XML, então os
     produtos vêm do Protheus; se nem isso existir, ela lança à mão. */
  const { itensNf, fonteItens } = useMemo(() => {
    const xml = Array.isArray(nota.itens) ? nota.itens : [];
    if (xml.length) return { itensNf: xml, fonteItens: 'xml' };
    const pro = Array.isArray(nota.itens_protheus) ? nota.itens_protheus : [];
    if (pro.length) return { itensNf: pro, fonteItens: 'protheus' };
    return { itensNf: [], fonteItens: 'nenhuma' };
  }, [nota]);
  const jaLancado = useMemo(() => {
    const m = new Map();
    (Array.isArray(nota.itens_cd) ? nota.itens_cd : []).forEach(i => {
      const k = String(i.codigo ?? '');
      m.set(k, (m.get(k) || []).concat([i]));
    });
    return m;
  }, [nota]);

  const [data, setData] = useState(nota.dt_recebimento_cd || hojeISO());
  const [filial, setFilial] = useState(nota.filial_cd || '');
  const [obs, setObs] = useState(nota.obs_retorno_cd || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  /* Uma linha por item da nota; cada linha pode ser dividida em condições. */
  const [linhas, setLinhas] = useState(() => {
    const base = itensNf.map((it, idx) => {
      const cod = it.codigo ?? it.codigo_produto;
      const antes = jaLancado.get(String(cod ?? '')) || [];
      const partes = antes.length
        ? antes.map(a => ({ destino: a.destino || 'BOM', qtd: String(a.qtd ?? ''), lote: a.lote || '' }))
        : [{ destino: 'BOM', qtd: String(it.quantidade ?? ''), lote: '' }];
      return { idx, codigo: cod, descricao: it.descricao, unidade: it.unidade || 'CX',
        qtdNf: Number(it.quantidade) || 0, conferido: antes.length > 0 || !nota.retornou_cd, partes, manual: false };
    });
    if (base.length) return base;
    /* Nota sem nenhuma origem de produto: traz de volta o que já foi lançado,
       senão começa com uma linha em branco para ela preencher. */
    const antes = Array.isArray(nota.itens_cd) ? nota.itens_cd : [];
    if (antes.length) {
      const porCod = new Map();
      antes.forEach(a => { const k = String(a.codigo ?? '') + '|' + (a.descricao || ''); porCod.set(k, (porCod.get(k) || []).concat([a])); });
      return [...porCod.values()].map((grupo, idx) => ({
        idx, codigo: grupo[0].codigo || '', descricao: grupo[0].descricao || '', unidade: grupo[0].unidade || 'CX',
        qtdNf: 0, conferido: true, manual: true,
        partes: grupo.map(a => ({ destino: a.destino || 'BOM', qtd: String(a.qtd ?? ''), lote: a.lote || '' })),
      }));
    }
    return [{ idx: 0, codigo: '', descricao: '', unidade: 'CX', qtdNf: 0, conferido: true, manual: true,
      partes: [{ destino: 'BOM', qtd: '', lote: '' }] }];
  });
  const [proxIdx, setProxIdx] = useState(1000);
  const addProduto = () => {
    setLinhas(ls => [...ls, { idx: proxIdx, codigo: '', descricao: '', unidade: 'CX', qtdNf: 0,
      conferido: true, manual: true, partes: [{ destino: 'BOM', qtd: '', lote: '' }] }]);
    setProxIdx(i => i + 1);
  };
  const tirarProduto = (idx) => setLinhas(ls => (ls.length > 1 ? ls.filter(l => l.idx !== idx) : ls));

  const setLinha = (idx, fn) => setLinhas(ls => ls.map(l => (l.idx === idx ? fn(l) : l)));
  const setParte = (idx, pi, campo, valor) =>
    setLinha(idx, l => ({ ...l, partes: l.partes.map((p, i) => (i === pi ? { ...p, [campo]: valor } : p)) }));
  const addParte = (idx) => setLinha(idx, l => ({ ...l, partes: [...l.partes, { destino: 'AVARIA', qtd: '', lote: '' }] }));
  const tirarParte = (idx, pi) => setLinha(idx, l => ({ ...l, partes: l.partes.length > 1 ? l.partes.filter((_, i) => i !== pi) : l.partes }));

  const marcarTudoBom = () => setLinhas(ls => ls.map(l => ({ ...l, conferido: true,
    partes: [{ destino: 'BOM', qtd: String(l.qtdNf || l.partes.reduce((s, p) => s + num(p.qtd), 0) || ''), lote: l.partes[0]?.lote || '' }] })));

  const resumo = useMemo(() => {
    const r = { total: 0, porDestino: {}, divergencias: [] };
    linhas.filter(l => l.conferido).forEach(l => {
      const soma = l.partes.reduce((s, p) => s + num(p.qtd), 0);
      r.total += soma;
      l.partes.forEach(p => { const q = num(p.qtd); if (q > 0) r.porDestino[p.destino] = (r.porDestino[p.destino] || 0) + q; });
      if (l.qtdNf && Math.abs(soma - l.qtdNf) > 0.001) r.divergencias.push({ ...l, soma });
    });
    return r;
  }, [linhas]);

  const salvar = async () => {
    setErro('');
    const itens = [];
    for (const l of linhas) {
      if (!l.conferido) continue;
      for (const p of l.partes) {
        const q = num(p.qtd);
        if (q <= 0) continue;
        if (l.manual && !String(l.descricao || '').trim() && !String(l.codigo || '').trim()) {
          setErro('Informe o código ou a descrição dos produtos lançados à mão.'); return;
        }
        itens.push({ codigo: l.codigo || null, descricao: l.descricao || null, unidade: l.unidade, qtd: q,
          lote: p.lote || null, destino: p.destino, cobrar: COBRAR.has(p.destino), formulario: 'PORTAL' });
      }
    }
    if (!itens.length) { setErro('Marque pelo menos um produto com quantidade antes de salvar.'); return; }
    if (!data) { setErro('Informe a data em que a nota chegou.'); return; }
    setSalvando(true);
    try {
      await dbRegistrarRetornoCD(nota.id, { dt: data, filial, itens, obs });
      onSalvo();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  const rot = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 3 };

  return (
    <div className="modal-overlay" style={{ zIndex: 200, padding: 20 }} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-label={`Conferência da NF ${nota.nf_numero}`}
        style={{ maxWidth: 1080, width: '100%', height: 'calc(100vh - 40px)', maxHeight: 'none' }}>

        <div style={{ padding: '16px 22px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chegada ao CD{nota.retornou_cd ? ' · já registrada' : ''}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                NF-e {nota.nf_numero} {nota.devolucao_total ? '· Total' : '· Parcial'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                {nota.nome_emitente} · {nota.uf_emitente} · {brl(nota.valor)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label><span style={rot}>Chegou em</span>
                <input type="date" className="input" value={data} max={hojeISO()} onChange={e => setData(e.target.value)} style={{ width: 150, height: 34 }}/>
              </label>
              <label><span style={rot}>Filial</span>
                <select className="input" value={filial} onChange={e => setFilial(e.target.value)} style={{ width: 150, height: 34 }}>
                  <option value="">Selecione</option>
                  {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <button className="btn btn-ghost btn-sm" style={{ height: 34 }} onClick={onFechar}>Fechar</button>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '14px 22px', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
              {fonteItens === 'nenhuma'
                ? 'Lançamento manual sem produtos na base · informe os produtos que chegaram'
                : `${itensNf.length} produto${itensNf.length === 1 ? '' : 's'} na nota · marque o que chegou e em que condição`}
              {fonteItens === 'protheus' && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>produtos do Protheus</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {fonteItens === 'nenhuma' && (
                <button className="btn btn-outline btn-sm" onClick={addProduto}>+ Produto</button>
              )}
              <button className="btn btn-outline btn-sm" onClick={marcarTudoBom}>Tudo chegou bom</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {linhas.map(l => {
              const soma = l.partes.reduce((s, p) => s + num(p.qtd), 0);
              const diverge = l.conferido && l.qtdNf > 0 && Math.abs(soma - l.qtdNf) > 0.001;
              return (
                <div key={l.idx} style={{ border: '1px solid ' + (l.conferido ? 'var(--border)' : 'var(--surface-3)'), borderRadius: 10,
                  padding: '10px 12px', background: l.conferido ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    {!l.manual && (
                      <input type="checkbox" checked={l.conferido} style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--blue)' }}
                        onChange={e => setLinha(l.idx, x => ({ ...x, conferido: e.target.checked }))}/>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {l.manual ? (
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.preventDefault()}>
                          <input className="input" value={l.codigo} placeholder="Código"
                            onChange={e => setLinha(l.idx, x => ({ ...x, codigo: e.target.value }))}
                            style={{ width: 120, height: 30, fontSize: 12.5 }}/>
                          <input className="input" value={l.descricao} placeholder="Descrição do produto"
                            onChange={e => setLinha(l.idx, x => ({ ...x, descricao: e.target.value }))}
                            style={{ flex: 1, minWidth: 200, height: 30, fontSize: 12.5 }}/>
                          <input className="input" value={l.unidade} placeholder="UN"
                            onChange={e => setLinha(l.idx, x => ({ ...x, unidade: e.target.value.toUpperCase() }))}
                            style={{ width: 70, height: 30, fontSize: 12.5 }}/>
                          {linhas.length > 1 && (
                            <button className="btn btn-ghost btn-sm" style={{ height: 30 }} onClick={() => tirarProduto(l.idx)}>Remover</button>
                          )}
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{l.descricao}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            Código {l.codigo} · nota traz {l.qtdNf} {l.unidade}
                          </span>
                        </>
                      )}
                    </span>
                    {l.conferido && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: diverge ? 'var(--yellow)' : 'var(--text-2)', whiteSpace: 'nowrap' }}>
                        {l.qtdNf > 0 ? `${soma} de ${l.qtdNf} ${l.unidade}` : `${soma} ${l.unidade}`}
                      </span>
                    )}
                  </label>

                  {l.conferido && (
                    <div style={{ marginTop: 9, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {l.partes.map((p, pi) => (
                        <div key={pi} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {DESTINOS.map(d => (
                              <button key={d.v} onClick={() => setParte(l.idx, pi, 'destino', d.v)}
                                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                  border: '1px solid ' + (p.destino === d.v ? d.bd : 'var(--border)'),
                                  background: p.destino === d.v ? d.bg : 'transparent',
                                  color: p.destino === d.v ? d.cor : 'var(--text-3)' }}>{d.l}</button>
                            ))}
                          </div>
                          <input className="input" type="number" min="0" step="any" value={p.qtd} placeholder="Qtd"
                            onChange={e => setParte(l.idx, pi, 'qtd', e.target.value)}
                            style={{ width: 86, height: 30, fontSize: 12.5 }}/>
                          <input className="input" value={p.lote} placeholder="Lote (opcional)"
                            onChange={e => setParte(l.idx, pi, 'lote', e.target.value)}
                            style={{ width: 150, height: 30, fontSize: 12.5 }}/>
                          {l.partes.length > 1 && (
                            <button className="btn btn-ghost btn-sm" style={{ height: 30 }} onClick={() => tirarParte(l.idx, pi)}>Remover</button>
                          )}
                        </div>
                      ))}
                      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', height: 28 }} onClick={() => addParte(l.idx)}>
                        + Dividir em outra condição
                      </button>
                      {diverge && (
                        <div style={{ fontSize: 11.5, color: 'var(--yellow)' }}>
                          {soma < l.qtdNf
                            ? `Faltam ${(l.qtdNf - soma).toLocaleString('pt-BR')} ${l.unidade} para fechar a quantidade da nota.`
                            : `Quantidade lançada passa em ${(soma - l.qtdNf).toLocaleString('pt-BR')} ${l.unidade} o que a nota traz.`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14 }}>
            <span style={rot}>Observação (opcional)</span>
            <textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Alguma observação sobre o recebimento" style={{ width: '100%', resize: 'vertical' }}/>
          </div>
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex',
          justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(resumo.porDestino).map(([d, q]) => (
              <span key={d} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                color: CFG[d]?.cor, background: CFG[d]?.bg, border: `1px solid ${CFG[d]?.bd}` }}>
                {CFG[d]?.l || d}: {q.toLocaleString('pt-BR')}
              </span>
            ))}
            {resumo.total === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Nada lançado ainda.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {erro && <span style={{ color: 'var(--red)', fontSize: 12 }}>{erro}</span>}
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : nota.retornou_cd ? 'Atualizar recebimento' : 'Confirmar chegada ao CD'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tela ─────────────────────────────────────────────────── */
export default function RetornoCDTrabalho({ onSair }) {
  const [aba, setAba] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [ate, setAte] = useState(hojeISO());
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState(null);

  const carregar = useCallback(async () => {
    setErro(''); setRows(null);
    try { setRows(await dbListarRetornoCD({ status: aba, busca, de, ate })); }
    catch (e) { setErro(e.message); setRows([]); }
  }, [aba, busca, de, ate]);

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);

  const baixar = () => {
    const cab = ['NF devolução', 'Série', 'Emissão', 'Cliente', 'CNPJ', 'UF', 'Tipo', 'Valor da NF',
      'Recebimento no CD', 'Filial', 'Código', 'Produto', 'Unidade', 'Quantidade', 'Lote', 'Condição',
      'A cobrar do transportador', 'Motivo', 'Área', 'Transportador', 'Observação', 'Lançado por'];
    const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const n2 = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
    const out = [cab.join(';')];
    for (const r of (rows || [])) {
      const itens = Array.isArray(r.itens_cd) && r.itens_cd.length ? r.itens_cd : [{}];
      for (const i of itens) {
        out.push([r.nf_numero, r.nf_serie, dt(r.dt_emissao), r.nome_emitente, r.cnpj_emitente, r.uf_emitente,
          r.devolucao_total ? 'Total' : 'Parcial', n2(r.valor), dt(r.dt_recebimento_cd), r.filial_cd,
          i.codigo, i.descricao, i.unidade, i.qtd != null ? n2(i.qtd) : '', i.lote,
          i.destino ? (CFG[i.destino]?.l || i.destino) : '', COBRAR.has(i.destino) ? 'Sim' : 'Não',
          r.motivo_devolucao, r.area_responsavel, r.transportador_cobranca, r.obs_retorno_cd, r.retorno_cd_por,
        ].map(esc).join(';'));
      }
    }
    const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Retorno ao CD ${aba === 'recebida' ? `${dt(de)} a ${dt(ate)}` : 'pendentes'}`.replace(/\//g, '-') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const th = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textAlign: 'left',
    whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 };
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 9 }}>
          {[['pendente', 'Aguardando chegada'], ['recebida', 'Já recebidas']].map(([v, l]) => (
            <button key={v} onClick={() => setAba(v)}
              style={{ border: 'none', cursor: 'pointer', borderRadius: 7, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
                background: aba === v ? 'var(--surface)' : 'transparent', color: aba === v ? 'var(--text)' : 'var(--text-3)',
                boxShadow: aba === v ? 'var(--shadow-xs)' : 'none' }}>{l}</button>
          ))}
        </div>
        <input className="input" placeholder="Buscar NF, cliente ou CNPJ" value={busca}
          onChange={e => setBusca(e.target.value)} style={{ width: 260, height: 34 }}/>
        {aba === 'recebida' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="input" value={de} max={ate} onChange={e => setDe(e.target.value)} style={{ width: 142, height: 34 }}/>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>até</span>
            <input type="date" className="input" value={ate} min={de} onChange={e => setAte(e.target.value)} style={{ width: 142, height: 34 }}/>
          </span>
        )}
        <div style={{ flex: 1 }}/>
        <button className="btn btn-outline btn-sm" style={{ height: 34 }} onClick={baixar} disabled={!rows?.length}>
          Baixar planilha do recebimento
        </button>
        {onSair && <button className="btn btn-ghost btn-sm" style={{ height: 34 }} onClick={onSair}>Sair deste modo</button>}
      </div>

      {erro && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{erro}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>NF</th><th style={th}>Cliente</th><th style={th}>UF</th><th style={th}>Tipo</th>
                <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                <th style={th}>{aba === 'recebida' ? 'Recebida em' : 'Devolução'}</th>
                <th style={th}>{aba === 'recebida' ? 'Conferência' : 'Status'}</th>
                <th style={{ ...th, textAlign: 'right' }}/>
              </tr>
            </thead>
            <tbody>
              {!rows && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 36, color: 'var(--text-3)' }}>Carregando…</td></tr>}
              {rows?.map(r => {
                const itens = Array.isArray(r.itens_cd) ? r.itens_cd : [];
                const cobrar = itens.filter(i => COBRAR.has(i.destino)).reduce((s, i) => s + (Number(i.qtd) || 0), 0);
                const totalQtd = itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
                return (
                  <tr key={r.id} className="drill-row">
                    <td style={{ ...td, fontWeight: 700, color: 'var(--text)' }}>{r.nf_numero}</td>
                    <td style={{ ...td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.nome_emitente}>{r.nome_emitente}</td>
                    <td style={td}>{r.uf_emitente}</td>
                    <td style={td}>{r.devolucao_total ? 'Total' : 'Parcial'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.valor)}</td>
                    <td style={td}>{dt(aba === 'recebida' ? r.dt_recebimento_cd : r.dt_devolucao)}</td>
                    <td style={td}>
                      {aba === 'recebida' ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          color: cobrar > 0 ? '#DC2626' : '#16A34A', background: cobrar > 0 ? '#FEF2F2' : '#F0FDF4' }}>
                          {totalQtd.toLocaleString('pt-BR')} un{cobrar > 0 ? ` · ${cobrar.toLocaleString('pt-BR')} a cobrar` : ' · tudo bom'}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{r.status_operacional || '—'}</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" style={{ height: 28 }} onClick={() => setSel(r)}>
                        {aba === 'recebida' ? 'Rever' : 'Registrar chegada'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows?.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 36, color: 'var(--text-3)' }}>
                  {aba === 'pendente' ? 'Nenhuma nota aguardando chegada.' : 'Nenhuma nota recebida neste período.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sel && <Conferencia nota={sel} onFechar={() => setSel(null)} onSalvo={() => { setSel(null); carregar(); }}/>}
    </div>
  );
}
