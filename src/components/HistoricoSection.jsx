import { useEffect, useState } from 'react';
import { dbListHistorico } from '../config/supabase';

const TIPO_CFG = {
  motivo:        { label: 'Motivo classificado',     color: 'var(--red)',    icon: '≡' },
  transportador: { label: 'Transportador vinculado', color: 'var(--gold)',   icon: '▣' },
  status:        { label: 'Status atualizado',       color: 'var(--blue)',   icon: '●' },
  centro_custo:  { label: 'Centro de custo',         color: '#0EA5E9',       icon: '▤' },
  cobranca:      { label: 'Cobrança registrada',     color: 'var(--green)',  icon: '$' },
  anexo:         { label: 'Anexo adicionado',        color: '#7C3AED',       icon: '⊕' },
};

function fmtDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function HistoricoSection({ devolucaoId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!devolucaoId) return;
    setLoading(true);
    dbListHistorico(devolucaoId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [devolucaoId]);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(75,85,99,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Histórico de alterações</span>
        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-3)', padding: '1px 7px', borderRadius: 20 }}>{items.length}</span>
      </div>

      <div style={{ padding: '10px 16px 6px' }}>
        {items.map((item, i) => {
          const cfg = TIPO_CFG[item.tipo] || { label: item.tipo, color: 'var(--text-2)', icon: '·' };
          return (
            <div key={item.id} style={{
              display: 'flex', gap: 12, paddingBottom: 12, marginBottom: 12,
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Ícone de tipo */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: cfg.color + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: cfg.color, fontWeight: 700, marginTop: 1,
              }}>
                {cfg.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                    {item.usuario && <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{item.usuario} · </span>}
                    {fmtDateTime(item.created_at)}
                  </span>
                </div>

                {/* Valor anterior → novo */}
                {(item.valor_anterior || item.valor_novo) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {item.valor_anterior && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-3)', padding: '2px 7px', borderRadius: 4, textDecoration: 'line-through' }}>
                        {item.valor_anterior}
                      </span>
                    )}
                    {item.valor_anterior && item.valor_novo && (
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>→</span>
                    )}
                    {item.valor_novo && (
                      <span style={{ fontSize: 11, color: 'var(--text)', background: cfg.color + '12', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                        {item.valor_novo}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
