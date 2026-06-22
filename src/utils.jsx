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
  evidencia_solicitada: { l: 'Evidência solicitada', dot: '#D97706', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  evidencia_anexada:    { l: 'Evidência anexada',    dot: '#16A34A', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([v, c]) => ({ v, l: c.l }));

export const STATUS_COBRANCA_CFG = {
  pendente_cobranca_transportador: { l: 'Pendente cobrança',  dot: '#D97706', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  cobrado:                          { l: 'Cobrado',            dot: '#16A34A', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
  isento:                           { l: 'Isento',             dot: '#9CA3AF', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
};

export function BadgeCobranca({ status }) {
  const cfg = STATUS_COBRANCA_CFG[status] || STATUS_COBRANCA_CFG.pendente_cobranca_transportador;
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

const STATUS_NEUTRO = { l: '—', dot: '#9CA3AF', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };

export function Badge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_NEUTRO;
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
