import { useState } from 'react';
import { dbSetStatusOperacional } from '../config/supabase';
import { calcStatusOperacional, STATUS_OP_MANUAIS, fmtDateTime } from '../utils.jsx';
import { somenteLeitura } from '../lib/permissoes.js';

const REGRA = {
  'LANÇADA':                'Lançada no Protheus e o físico chegou ao CD.',
  'TROCA DE NOTA':          'Devolução total lançada no Protheus sem retorno físico.',
  'LANÇADA SEM FÍSICO':     'Lançada no Protheus, mas o físico não chegou ao CD.',
  'ENVIAR PARA LANÇAMENTO': 'O físico chegou ao CD e a nota ainda não foi lançada no Protheus.',
};

export default function StatusOperacionalCard({ dev, user, onChanged }) {
  const atual = calcStatusOperacional(dev);
  const manual = STATUS_OP_MANUAIS.includes(atual);
  const podeTrocar = manual && !somenteLeitura(user);
  const [valor, setValor] = useState(atual);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const salvar = async () => {
    setSaving(true); setErr('');
    try {
      await dbSetStatusOperacional(dev.id, valor, user?.name || user?.email);
      onChanged?.(valor);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 3 }}>Status operacional</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{atual}</div>
        </div>
        {podeTrocar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" value={valor} onChange={e => setValor(e.target.value)} style={{ fontSize: 12, minWidth: 250 }}>
              {STATUS_OP_MANUAIS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" disabled={saving || valor === atual} onClick={salvar}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
        {manual
          ? 'Nota ainda não lançada no Protheus e sem retorno ao CD: escolha a situação atual. Quando ela for lançada ou chegar ao CD, o status muda sozinho.'
          : `Definido automaticamente: ${REGRA[atual]}`}
        {dev.status_operacional_por && manual && (
          <> · Última alteração por {dev.status_operacional_por}{dev.status_operacional_em ? ` em ${fmtDateTime(dev.status_operacional_em)}` : ''}</>
        )}
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
