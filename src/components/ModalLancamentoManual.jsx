import { useState } from 'react';
import { dbLancarDevolucaoManual } from '../config/supabase';

const MOTIVOS = [
  'Avaria no recebimento',
  'Falta no recebimento',
  'Mercadoria não solicitada',
  'Desacordo com o pedido',
  'Produto fora da validade',
  'Desvio de qualidade',
  'Erro de faturamento',
  'Recusa na entrega',
  'Outros',
];

const CNPJ_OPTIONS = [
  { v: '05207076000297', l: 'Linea MIX' },
  { v: '05207076000459', l: 'Linea CHOCOLATE' },
];

export default function ModalLancamentoManual({ onClose, onSaved, user }) {
  const [form, setForm] = useState({
    chave_nfe_referenciada: '',
    nome_emitente: '',
    cnpj_emitente: '',
    uf_emitente: '',
    municipio_emitente: '',
    cnpj_destinatario: '05207076000297',
    dt_emissao: new Date().toISOString().slice(0, 10),
    valor: '',
    motivo_devolucao: '',
    observacao: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nome_emitente) { setError('Informe o nome do cliente.'); return; }
    if (!form.valor || isNaN(parseFloat(form.valor))) { setError('Informe o valor da devolução.'); return; }
    if (!form.motivo_devolucao) { setError('Informe o motivo da devolução.'); return; }
    setSaving(true); setError('');
    try {
      await dbLancarDevolucaoManual({ ...form, usuario: user?.name || user?.email });
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Lançamento Manual</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Devolução total sem NFD emitida pelo cliente</div>
            </div>
          </div>
          <div style={{ background: 'var(--purple-dim)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: 'var(--purple)', marginTop: 8 }}>
            Use quando o cliente devolveu a mercadoria mas não emitiu a Nota Fiscal de Devolução.
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Chave NF de venda */}
          <div>
            <label className="input-label">Chave NF-e de venda (opcional — preenche dados automaticamente)</label>
            <input type="text" placeholder="44 dígitos da chave de acesso"
              value={form.chave_nfe_referenciada} maxLength={44}
              onChange={e => set('chave_nfe_referenciada', e.target.value.replace(/\D/g,''))}
              className="input" style={{ fontFamily: 'monospace', fontSize: 11 }}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="input-label">Cliente (Razão Social) *</label>
              <input type="text" value={form.nome_emitente} onChange={e => set('nome_emitente', e.target.value)}
                className="input" placeholder="Nome do cliente que devolveu"/>
            </div>
            <div>
              <label className="input-label">CNPJ do cliente</label>
              <input type="text" value={form.cnpj_emitente} onChange={e => set('cnpj_emitente', e.target.value.replace(/\D/g,''))}
                className="input" placeholder="00000000000000" maxLength={14}/>
            </div>
            <div>
              <label className="input-label">UF</label>
              <input type="text" value={form.uf_emitente} onChange={e => set('uf_emitente', e.target.value.toUpperCase())}
                className="input" placeholder="SP" maxLength={2}/>
            </div>
            <div>
              <label className="input-label">Empresa destinatária *</label>
              <select value={form.cnpj_destinatario} onChange={e => set('cnpj_destinatario', e.target.value)} className="input">
                {CNPJ_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Data da devolução *</label>
              <input type="date" value={form.dt_emissao} onChange={e => set('dt_emissao', e.target.value)} className="input"/>
            </div>
            <div>
              <label className="input-label">Valor devolvido (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.valor}
                onChange={e => set('valor', e.target.value)}
                className="input" placeholder="0,00"/>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="input-label">Motivo da devolução *</label>
              <select value={form.motivo_devolucao} onChange={e => set('motivo_devolucao', e.target.value)} className="input">
                <option value="">— Selecionar —</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="input-label">Observações</label>
              <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)}
                className="input" rows={2} placeholder="Informações adicionais sobre a devolução..."
                style={{ resize: 'vertical' }}/>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-sm"
            style={{ background: 'var(--purple)', color: '#fff' }}>
            {saving ? 'Salvando...' : 'Registrar devolução'}
          </button>
        </div>
      </div>
    </div>
  );
}
