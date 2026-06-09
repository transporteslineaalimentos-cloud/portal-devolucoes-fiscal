export function fmtBRL(v) {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
}
export function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}
export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
export function fmtCNPJ(s) {
  if (!s) return '—';
  const d = s.replace(/\D/g, '');
  if (d.length !== 14) return s;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

export const CNPJ_MAP = {
  '05207076000297': 'MIX',
  '05207076000459': 'CHOCOLATE',
};

export const STATUS_CFG = {
  pendente:   { l: 'Pendente',   dot: '#9CA3AF', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
  em_analise: { l: 'Em análise', dot: '#D97706', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  aprovada:   { l: 'Aprovada',   dot: '#16A34A', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
  rejeitada:  { l: 'Rejeitada',  dot: '#DC2626', color: '#7F1D1D', bg: '#FEF2F2', border: '#FECACA' },
  concluida:  { l: 'Concluída',  dot: '#1E4DB7', color: '#1E3A8A', bg: '#EFF6FF', border: '#BFDBFE' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([v, c]) => ({ v, l: c.l }));

export function Badge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}/>
      {cfg.l}
    </span>
  );
}
