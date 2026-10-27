import { useEffect, useMemo, useState } from 'react';
import { dbAtualizarMassa, dbGetMotivos, dbGetTransportadoras } from '../config/supabase';
import { STATUS_OP_MANUAIS } from '../utils.jsx';

/* Barra que aparece quando há notas marcadas na lista.
   Muda de uma vez o que hoje se muda nota por nota. */

const CAMPOS = [
  { k: 'status_operacional',     l: 'Status operacional' },
  { k: 'motivo_devolucao',       l: 'Motivo e área' },
  { k: 'transportador_cobranca', l: 'Transportador' },
  { k: 'centro_custo',           l: 'Centro de custo' },
];

export default function BarraSelecao({ ids, onLimpar, onAplicado }) {
  const [campo, setCampo] = useState('status_operacional');
  const [valor, setValor] = useState('');
  const [motivos, setMotivos] = useState([]);
  const [transps, setTransps] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState('');

  useEffect(() => {
    let vivo = true;
    dbGetMotivos().then(m => vivo && setMotivos(m || [])).catch(() => {});
    dbGetTransportadoras().then(t => vivo && setTransps(t || [])).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const area = useMemo(() => motivos.find(m => m.motivo === valor)?.area, [motivos, valor]);

  const aplicar = async () => {
    if (!valor) { setErro('Escolha o novo valor.'); return; }
    setSalvando(true); setErro(''); setFeito('');
    try {
      const campos = {};
      if (campo === 'transportador_cobranca') {
        const t = transps.find(x => x.nome === valor);
        campos.transportador_cobranca = valor;
        campos.transportador_cnpj_cobranca = t?.cnpj || '';
      } else campos[campo] = valor;
      const r = await dbAtualizarMassa(ids, campos);
      setFeito(`${r.alteradas} nota${r.alteradas === 1 ? '' : 's'} atualizada${r.alteradas === 1 ? '' : 's'}.`);
      setValor('');
      onAplicado();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  const campoAtual = CAMPOS.find(c => c.k === campo);

  return (
    <div style={{ position: 'sticky', bottom: 0, zIndex: 20, margin: '0 -1px', background: 'var(--surface)',
      borderTop: '2px solid var(--blue)', boxShadow: '0 -4px 14px rgba(15,25,35,.08)', padding: '12px 16px',
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {ids.length.toLocaleString('pt-BR')} nota{ids.length === 1 ? '' : 's'} marcada{ids.length === 1 ? '' : 's'}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={onLimpar}>Desmarcar</button>

      <div style={{ width: 1, height: 22, background: 'var(--border)' }}/>

      <select className="input" value={campo} style={{ width: 180, height: 32, fontSize: 12.5 }}
        onChange={e => { setCampo(e.target.value); setValor(''); setErro(''); setFeito(''); }}>
        {CAMPOS.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
      </select>

      {campo === 'status_operacional' && (
        <select className="input" value={valor} onChange={e => setValor(e.target.value)} style={{ width: 300, height: 32, fontSize: 12.5 }}>
          <option value="">Escolha o status</option>
          {STATUS_OP_MANUAIS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {campo === 'motivo_devolucao' && (
        <>
          <input className="input" list="motivos-massa" value={valor} onChange={e => setValor(e.target.value)}
            placeholder="Digite para filtrar os motivos" style={{ width: 340, height: 32, fontSize: 12.5 }}/>
          <datalist id="motivos-massa">
            {motivos.map(m => <option key={m.motivo} value={m.motivo}>{m.area}</option>)}
          </datalist>
          {area && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Área: <b style={{ color: 'var(--text-2)' }}>{area}</b></span>}
        </>
      )}

      {campo === 'transportador_cobranca' && (
        <>
          <input className="input" list="transp-massa" value={valor} onChange={e => setValor(e.target.value)}
            placeholder="Digite para filtrar os transportadores" style={{ width: 340, height: 32, fontSize: 12.5 }}/>
          <datalist id="transp-massa">
            {transps.map(t => <option key={t.cnpj} value={t.nome}>{t.cnpj}</option>)}
          </datalist>
        </>
      )}

      {campo === 'centro_custo' && (
        <input className="input" value={valor} onChange={e => setValor(e.target.value.toUpperCase())}
          placeholder="Centro de custo" style={{ width: 280, height: 32, fontSize: 12.5 }}/>
      )}

      <button className="btn btn-primary btn-sm" style={{ height: 32 }} onClick={aplicar} disabled={salvando || !valor}>
        {salvando ? 'Aplicando…' : `Aplicar em ${ids.length}`}
      </button>

      {erro && <span style={{ color: 'var(--red)', fontSize: 12 }}>{erro}</span>}
      {feito && <span style={{ color: 'var(--green)', fontSize: 12 }}>{feito}</span>}
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
        Muda só o {campoAtual?.l.toLowerCase()}; o resto da nota fica como está e tudo entra no histórico.
      </span>
    </div>
  );
}
