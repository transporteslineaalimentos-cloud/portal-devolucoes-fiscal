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
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  pendente:   { l: 'Pendente',    c: '#8B949E', bg: 'rgba(139,148,158,0.12)' },
  em_analise: { l: 'Em análise',  c: '#D29922', bg: 'rgba(210,153,34,0.12)'  },
  aprovada:   { l: 'Aprovada',    c: '#3FB950', bg: 'rgba(63,185,80,0.12)'   },
  rejeitada:  { l: 'Rejeitada',   c: '#F85149', bg: 'rgba(248,81,73,0.12)'   },
  concluida:  { l: 'Concluída',   c: '#58A6FF', bg: 'rgba(88,166,255,0.12)'  },
};

export const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([v, c]) => ({ v, l: c.l }));

export function Badge({ status, size = 'normal' }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 600,
      color: cfg.c, background: cfg.bg,
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
      borderRadius: 4, whiteSpace: 'nowrap',
    }}>
      {cfg.l}
    </span>
  );
}
