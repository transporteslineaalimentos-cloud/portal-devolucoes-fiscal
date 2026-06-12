import { useState } from 'react';
import { dbRegistrarCobranca, dbIsentarCobranca, dbReabrirCobranca } from '../config/supabase';
import { fmtBRL, fmtDate, fmtCNPJ, fmtDateTime, BadgeCobranca } from '../utils.jsx';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

export default function ModalCobranca({ row, user, onClose, onSaved }) {
  const [nfDebito, setNfDebito] = useState(row.nf_debito || '');
  const [obs, setObs]           = useState(row.obs_cobranca || '');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [mode, setMode]         = useState(null); // 'cobrar' | 'isentar'

  const userName = user?.name || user?.email || '';
  const isPendente = row.status_cobranca === 'pendente_cobranca_transportador';

  const handleCobrar = async () => {
    if (!nfDebito.trim()) { setErr('Informe o número da NF de débito.'); return; }
    setSaving(true); setErr('');
    try {
      await dbRegistrarCobranca(row.id, { nf_debito: nfDebito.trim(), obs_cobranca: obs, userName });
      onSaved?.(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleIsentar = async () => {
    setSaving(true); setErr('');
    try {
      await dbIsentarCobranca(row.id, { obs_cobranca: obs, userName });
      onSaved?.(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleReabrir = async () => {
    setSaving(true); setErr('');
    try {
      await dbReabrirCobranca(row.id);
      onSaved?.(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={{ width: 480 }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                  NF-e {row.nf_numero ?? '—'} · Série {row.nf_serie ?? '—'}
                </span>
                <BadgeCobranca status={row.status_cobranca}/>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                {row.nome_emitente} {row.municipio_emitente && `· ${row.municipio_emitente}`} {row.uf_emitente && `/ ${row.uf_emitente}`}
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6, borderRadius: 6, flexShrink: 0 }}>
              <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
            </button>
          </div>
        </div>

        <div className="drawer-body" style={{ padding: '16px 20px' }}>

          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 16 }}>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Motivo</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>{row.motivo_devolucao || '—'}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Valor da NF</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{fmtBRL(row.valor)}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Emissão</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{fmtDate(row.dt_emissao)}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Lançada no Protheus</div>
              <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>{fmtDate(row.dt_lancamento_protheus)}</div>
            </div>
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Transportador responsável</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                {row.transportador_cobranca || <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontWeight: 400 }}>Não identificado automaticamente — verificar manualmente pela NF de venda</span>}
              </div>
              {row.transportador_cnpj_cobranca && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{fmtCNPJ(row.transportador_cnpj_cobranca)}</div>
              )}
            </div>
          </div>

          {/* Estado: já cobrado / isento */}
          {!isPendente && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {row.status_cobranca === 'cobrado' ? 'Cobrança registrada' : 'Marcada como isenta'}
              </div>
              {row.nf_debito && (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>NF de débito: {row.nf_debito}</div>
              )}
              {row.obs_cobranca && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{row.obs_cobranca}</div>
              )}
              {row.data_cobranca && (
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {row.cobrado_por && `${row.cobrado_por} · `}{fmtDateTime(row.data_cobranca)}
                </div>
              )}
              <button onClick={handleReabrir} disabled={saving} className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>
                Reabrir cobrança
              </button>
            </div>
          )}

          {/* Ações para pendente */}
          {isPendente && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMode('cobrar')} className={`btn btn-sm ${mode === 'cobrar' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                  <Ic d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13}/>
                  Marcar como cobrado
                </button>
                <button onClick={() => setMode('isentar')} className={`btn btn-sm ${mode === 'isentar' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                  Isentar
                </button>
              </div>

              {mode === 'cobrar' && (
                <div style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label className="input-label">Número da NF de débito *</label>
                    <input type="text" value={nfDebito} onChange={e => setNfDebito(e.target.value)}
                      className="input" placeholder="Ex: 12345"/>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label className="input-label">Observação (opcional)</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} className="input" rows={2} style={{ resize: 'vertical' }}/>
                  </div>
                  {err && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setMode(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                    <button onClick={handleCobrar} disabled={saving} className="btn btn-primary btn-sm">
                      {saving ? 'Salvando...' : 'Confirmar cobrança'}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'isentar' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label className="input-label">Motivo da isenção</label>
                    <textarea value={obs} onChange={e => setObs(e.target.value)} className="input" rows={2} style={{ resize: 'vertical' }} placeholder="Por que essa NF não será cobrada do transportador?"/>
                  </div>
                  {err && <div style={{ color: 'var(--red)', fontSize: 11.5, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setMode(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                    <button onClick={handleIsentar} disabled={saving} className="btn btn-primary btn-sm">
                      {saving ? 'Salvando...' : 'Confirmar isenção'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
