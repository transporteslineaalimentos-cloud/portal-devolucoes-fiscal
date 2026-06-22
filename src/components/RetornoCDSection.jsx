const DESTINO_CFG = {
  BOM:            { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: '✓' },
  AVARIA:         { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '⚠' },
  FALTA:          { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '−' },
  'VALIDADE CURTA':{ color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: '⏱' },
  IMPROPRIO:      { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', icon: '✕' },
};

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function RetornoCDSection({ dev }) {
  if (!dev?.retornou_cd) return null;

  const itens = dev.itens_cd || [];
  const COBRAR = new Set(['AVARIA', 'FALTA', 'VALIDADE CURTA', 'IMPROPRIO']);

  // Agrupa por destino
  const porDestino = {};
  itens.forEach(item => {
    const d = item.destino || '—';
    if (!porDestino[d]) porDestino[d] = { qtd: 0, itens: [] };
    porDestino[d].qtd += item.qtd || 0;
    porDestino[d].itens.push(item);
  });

  const itensBom    = itens.filter(i => i.destino === 'BOM');
  const itensCobrar = itens.filter(i => COBRAR.has(i.destino));
  const qtdBom      = itensBom.reduce((s, i) => s + (i.qtd || 0), 0);
  const qtdCobrar   = itensCobrar.reduce((s, i) => s + (i.qtd || 0), 0);
  const qtdTotal    = itens.reduce((s, i) => s + (i.qtd || 0), 0);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: dev.tem_itens_cobrar ? 'rgba(220,38,38,0.04)' : 'rgba(22,163,74,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: dev.tem_itens_cobrar ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
            {dev.tem_itens_cobrar ? '⚠' : '✓'}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Retornou ao CD</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
              {fmtDate(dev.dt_recebimento_cd)}
              {dev.filial_cd && ` · ${dev.filial_cd}`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {dev.tem_itens_cobrar ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.10)', padding: '3px 8px', borderRadius: 20 }}>
                ⚠ Tem itens a cobrar do transportador
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: 'rgba(22,163,74,0.10)', padding: '3px 8px', borderRadius: 20 }}>
                ✓ Todos os itens em bom estado
              </span>
            )}
          </div>
        </div>

        {/* Resumo por destino */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.entries(porDestino).map(([destino, data]) => {
            const cfg = DESTINO_CFG[destino] || { color: 'var(--text-2)', bg: 'var(--surface-2)', border: 'var(--border)', icon: '·' };
            return (
              <span key={destino} style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '3px 9px', borderRadius: 20 }}>
                {cfg.icon} {destino}: {data.qtd} cx
              </span>
            );
          })}
        </div>
      </div>

      {/* Itens a cobrar do transportador */}
      {itensCobrar.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: itensBom.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            A cobrar do transportador ({qtdCobrar} cx)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                {['Produto', 'Qtd', 'Lote', 'Classificação'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensCobrar.map((item, i) => {
                const cfg = DESTINO_CFG[item.destino] || {};
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface-3)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--text)', fontWeight: 500, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
                      {item.codigo && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.codigo}</div>}
                    </td>
                    <td style={{ padding: '5px 8px', color: 'var(--text)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qtd} {item.unidade}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{item.lote || '—'}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 6px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                        {cfg.icon} {item.destino}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Itens em bom estado */}
      {itensBom.length > 0 && (
        <details style={{ padding: '8px 16px' }}>
          <summary style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', cursor: 'pointer', userSelect: 'none' }}>
            ✓ Itens em bom estado ({qtdBom} cx) — integrados ao estoque
          </summary>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
            <tbody>
              {itensBom.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--surface-3)' }}>
                  <td style={{ padding: '4px 6px', color: 'var(--text-2)', maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
                    {item.codigo && <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{item.codigo}</span>}
                  </td>
                  <td style={{ padding: '4px 6px', color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qtd} {item.unidade}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{item.lote || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
