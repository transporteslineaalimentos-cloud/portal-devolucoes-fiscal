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
};

// Farol de prazo Protheus: 90 dias corridos a partir da emissão da NFD
// (dt_devolucao para devolução total / lançamento manual, dt_emissao para parcial)
// para lançar no Protheus. Alerta amarelo nos últimos 15 dias do prazo.
export function calcFarolProtheus(row) {
  if (row.lancado_protheus) {
    return { cor: 'lancada', label: 'Lançada', dias: null, diasRestantes: null };
  }
  const dataRef = row.lancamento_manual ? row.dt_devolucao : row.dt_emissao;
  if (!dataRef) return { cor: 'sem_data', label: '—', dias: null, diasRestantes: null };

  const hoje = new Date();
  const ref = new Date(dataRef + 'T00:00:00');
  const dias = Math.floor((hoje - ref) / 86400000);
  const diasRestantes = 90 - dias;

  if (diasRestantes > 15) return { cor: 'verde', label: `${diasRestantes}d restantes`, dias, diasRestantes };
  if (diasRestantes > 0)  return { cor: 'amarelo', label: `${diasRestantes}d restantes`, dias, diasRestantes };
  return { cor: 'vermelho', label: `${Math.abs(diasRestantes)}d em atraso`, dias, diasRestantes };
}

export const FAROL_CFG = {
  verde:    { color: '#22c55e', bg: '#22c55e18', dot: '🟢' },
  amarelo:  { color: '#eab308', bg: '#eab30818', dot: '🟡' },
  vermelho: { color: '#ef4444', bg: '#ef444418', dot: '🔴' },
  lancada:  { color: 'var(--text-3)', bg: 'transparent', dot: '' },
  sem_data: { color: 'var(--text-3)', bg: 'transparent', dot: '' },
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
