import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { dbImportRetornoCD } from '../config/supabase';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const DESTINOS_COBRAR = new Set(['AVARIA', 'FALTA', 'IMPROPRIO']);

function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  return null;
}

function getCol(row, ...names) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null) return row[n];
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
    if (key && row[key] !== undefined) return row[key];
  }
  return null;
}

function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (!rows.length) throw new Error('Planilha vazia ou sem dados na primeira aba.');

  // Valida que tem a coluna NF
  const firstRow = rows[0];
  const hasNF = Object.keys(firstRow).some(k => k.trim().toUpperCase() === 'NF');
  if (!hasNF) throw new Error('Coluna "NF" não encontrada. Verifique o formato da planilha.');

  const grouped = new Map();

  for (const row of rows) {
    const nf = getCol(row, 'NF');
    if (nf == null || nf === '') continue;
    const nfNum = parseInt(String(nf).replace(/\D/g,''), 10);
    if (!nfNum || isNaN(nfNum)) continue;

    if (!grouped.has(nfNum)) {
      grouped.set(nfNum, {
        nf_numero: nfNum,
        filial_cd: String(getCol(row, 'FILIAL') ?? '').trim() || null,
        dt_recebimento_cd: toIsoDate(getCol(row, 'RECEBIMENTO')),
        cliente: String(getCol(row, 'CLIENTE') ?? '').trim() || null,
        itens_cd: [],
      });
    }

    const entry = grouped.get(nfNum);
    const destino = String(getCol(row, 'DESTINO') ?? '').trim().toUpperCase();

    entry.itens_cd.push({
      codigo:    String(getCol(row, 'CÓDIGO', 'CODIGO') ?? '').trim() || null,
      descricao: String(getCol(row, 'DESCRIÇÃO', 'DESCRICAO') ?? '').trim() || null,
      qtd:       parseFloat(getCol(row, 'QTD') ?? 0) || 0,
      unidade:   String(getCol(row, 'UNID.MEDIDA', 'UNIDADE') ?? '').trim() || null,
      lote:      String(getCol(row, 'LOTE') ?? '').trim() || null,
      destino,
      formulario:String(getCol(row, 'FORMULÁRIO', 'FORMULARIO') ?? '').trim() || null,
      cobrar:    DESTINOS_COBRAR.has(destino),
    });
  }

  // Calcula tem_itens_cobrar por NF
  const result = [];
  for (const [, entry] of grouped) {
    const qtdTotal  = entry.itens_cd.reduce((s, i) => s + i.qtd, 0);
    const qtdCobrar = entry.itens_cd.filter(i => DESTINOS_COBRAR.has(i.destino)).reduce((s, i) => s + i.qtd, 0);
    result.push({
      ...entry,
      tem_itens_cobrar: qtdCobrar > 0,
      // valor_cobrar_transp calculado no backend com base no % de itens não-BOM
    });
  }

  return result;
}

export default function ModalImportRetornoCD({ onClose, onDone }) {
  const [step, setStep]       = useState('upload'); // upload | preview | loading | result
  const [preview, setPreview] = useState([]);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState('');
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    setErr('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      setPreview(parsed);
      setStep('preview');
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setStep('loading');
    setErr('');
    try {
      const res = await dbImportRetornoCD(preview);
      setResult(res);
      setStep('result');
      onDone?.();
    } catch (e) {
      setErr(e.message);
      setStep('preview');
    }
  };

  const qtdCobrar  = preview.filter(r => r.tem_itens_cobrar).length;
  const qtdSomente = preview.filter(r => !r.tem_itens_cobrar).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={16} color="var(--blue)"/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Importar — Retorno ao CD</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
              Planilha no mesmo formato da NFD_retornaram_CD.xlsx
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {/* STEP: Upload */}
          {step === 'upload' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 12,
                  padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--surface-2)', transition: 'border-color 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" size={32} color="var(--text-3)"/>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>
                  Arraste o arquivo .xlsx aqui
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  ou clique para selecionar
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
                  onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}/>
              </div>

              {/* Formato esperado */}
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Formato esperado</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  Colunas obrigatórias: <strong>NF · FILIAL · RECEBIMENTO · CLIENTE · CÓDIGO · DESCRIÇÃO · QTD · UNID.MEDIDA · LOTE · DESTINO · FORMULÁRIO</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                  Destinos reconhecidos: BOM · AVARIA · FALTA · VALIDADE CURTA · IMPROPRIO
                </div>
              </div>

              {err && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', fontSize: 12.5, color: 'var(--red)' }}>
                  {err}
                </div>
              )}
            </div>
          )}

          {/* STEP: Preview */}
          {step === 'preview' && (
            <div>
              {/* Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'NFDs encontradas', value: preview.length, color: 'var(--blue)' },
                  { label: 'Com itens a cobrar', value: qtdCobrar, color: '#DC2626' },
                  { label: 'Somente bons', value: qtdSomente, color: '#16A34A' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tabela preview */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                    <tr>
                      {['NF', 'Cliente', 'Recebimento', 'Itens', 'BOM', 'A cobrar'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => {
                      const bom    = r.itens_cd.filter(i => i.destino === 'BOM');
                      const cobrar = r.itens_cd.filter(i => DESTINOS_COBRAR.has(i.destino));
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--surface-3)', background: r.tem_itens_cobrar ? 'rgba(220,38,38,0.03)' : 'transparent' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{r.nf_numero}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--text-2)', maxWidth: 160 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente || '—'}</div>
                            {r.filial_cd && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{r.filial_cd}</div>}
                          </td>
                          <td style={{ padding: '7px 12px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{r.dt_recebimento_cd || '—'}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'center' }}>{r.itens_cd.length}</td>
                          <td style={{ padding: '7px 12px', color: '#16A34A', fontWeight: 600, textAlign: 'center' }}>{bom.length}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                            {cobrar.length > 0
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.10)', padding: '2px 7px', borderRadius: 10 }}>⚠ {cobrar.length}</span>
                              : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {err && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 8, fontSize: 12.5, color: 'var(--red)' }}>
                  {err}
                </div>
              )}
            </div>
          )}

          {/* STEP: Loading */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Importando {preview.length} NFDs...</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Vinculando itens e classificações ao portal</div>
            </div>
          )}

          {/* STEP: Result */}
          {step === 'result' && result && (
            <div>
              <div style={{ padding: '20px', background: 'var(--green-dim)', borderRadius: 12, border: '1px solid rgba(22,163,74,0.25)', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{result.atualizadas}</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>NFDs atualizadas com dados de retorno ao CD</div>
              </div>
              {result.nao_encontradas?.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'var(--yellow-dim)', borderRadius: 10, border: '1px solid rgba(217,119,6,0.25)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--yellow)', marginBottom: 6 }}>
                    {result.nao_encontradas.length} NFDs não encontradas no portal
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    {result.nao_encontradas.slice(0, 20).join(', ')}{result.nao_encontradas.length > 20 ? ' ...' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Essas NFs ainda não foram sincronizadas pelo OOBJ (período anterior ao sistema).
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {step === 'result' ? (
            <button onClick={onClose} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Fechar</button>
          ) : (
            <>
              <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {step === 'preview' && (
                  <>
                    <button onClick={() => { setStep('upload'); setPreview([]); setErr(''); }} className="btn btn-outline btn-sm">← Voltar</button>
                    <button onClick={handleImport} className="btn btn-primary btn-sm">
                      Importar {preview.length} NFDs
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
