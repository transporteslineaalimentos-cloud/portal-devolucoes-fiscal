import { useEffect, useRef, useState } from 'react';
import { dbBuscarClienteFrete } from '../config/supabase';

/* Campo da aba Custos de Frete: digita CNPJ ou nome do cliente e escolhe na lista. */
const nomeT = (s) => !s ? '' : s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ú])/g, (m, p, c) => p + c.toUpperCase());
const fmtCnpj = (c) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || ''; };
const brlK = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : n >= 1e3 ? `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`; };

export default function BuscaClienteFrete({ onEscolher, width = 250 }) {
  const [q, setQ] = useState('');
  const [itens, setItens] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const dig = q.replace(/\D/g, '');
    const valido = dig.length >= 5 || (dig.length < 5 && q.trim().length >= 3);
    if (!valido) { setItens([]); return; }
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(() => {
      dbBuscarClienteFrete(q.trim())
        .then(r => { if (vivo) { setItens(r); setAtivo(0); setAberto(true); } })
        .catch(() => { if (vivo) setItens([]); })
        .finally(() => { if (vivo) setCarregando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const escolher = (it) => { setAberto(false); setQ(''); onEscolher(it); };
  const tecla = (e) => {
    if (!aberto || !itens.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, itens.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(itens[ativo]); }
    else if (e.key === 'Escape') setAberto(false);
  };

  return (
    <label ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-3)', fontWeight: 600, position: 'relative' }}>
      Extrato do cliente
      <input className="input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={tecla} onFocus={() => itens.length && setAberto(true)}
        placeholder="CNPJ ou nome do cliente" style={{ width, height: 32, fontSize: 12.5 }} aria-label="Buscar cliente por CNPJ ou nome"/>
      {aberto && (
        <div role="listbox" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4, width: Math.max(width, 380), maxHeight: 340, overflow: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          {carregando && !itens.length && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Buscando…</div>}
          {!carregando && !itens.length && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>Nenhum cliente com venda encontrado.</div>}
          {itens.map((it, i) => (
            <div key={it.cnpj} role="option" aria-selected={i === ativo} onMouseEnter={() => setAtivo(i)} onMouseDown={e => { e.preventDefault(); escolher(it); }}
              style={{ padding: '8px 12px', cursor: 'pointer', background: i === ativo ? 'var(--surface-2)' : undefined, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{nomeT(it.nome) || 'Sem nome'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{fmtCnpj(it.cnpj)} · {it.qtd_nfs} NFs · {brlK(it.faturamento)} faturado (toda a base)</div>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}
