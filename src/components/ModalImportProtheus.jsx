import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { dbImportProtheusLancamentos } from '../config/supabase';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

// Converte DD/MM/YYYY ou número serial do Excel para 'YYYY-MM-DD'
function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // serial date do Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  return null;
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(',', '.')) || 0;
}

function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (!rows.length) throw new Error('Planilha vazia ou sem dados na primeira aba.');

  // Mapeia colunas de forma resiliente a pequenas variações de nome
  const getCol = (row, ...names) => {
    for (const n of names) {
      if (row[n] !== undefined) return row[n];
      // tenta case-insensitive
      const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
      if (key) return row[key];
    }
    return null;
  };

  const grouped = new Map();
  for (const row of rows) {
    const nf = getCol(row, 'NF');
    if (nf == null || nf === '') continue;
    const nfNum = parseInt(nf, 10);
    if (!grouped.has(nfNum)) {
      grouped.set(nfNum, {
        nf_numero: nfNum,
        dt_lancamento_protheus: toIsoDate(getCol(row, 'DT Digitação', 'DT Digitacao', 'Data Digitação')),
        motivo_codigo: getCol(row, 'F1_XMOTDEV') != null ? String(getCol(row, 'F1_XMOTDEV')) : null,
        motivo_descricao: getCol(row, 'F1_XDMOTDV') != null ? String(getCol(row, 'F1_XDMOTDV')).trim() : null,
        itens: [],
      });
    }
    const entry = grouped.get(nfNum);
    entry.itens.push({
      item: entry.itens.length + 1,
      codigo: String(getCol(row, 'PRODUTO') ?? ''),
      descricao: String(getCol(row, 'DESCRICAO', 'DESCRIÇÃO') ?? '').trim(),
      unidade: String(getCol(row, 'UNIDADE') ?? '').trim(),
      cfop: String(getCol(row, 'CFOP') ?? ''),
      quantidade: Math.abs(num(getCol(row, 'QUANTIDADE'))),
      valor_unitario: Math.abs(num(getCol(row, 'VALOR UNITARIO', 'VALOR UNITÁRIO'))),
      valor_total: Math.abs(num(getCol(row, 'VALOR ITEM NF'))),
    });
  }

  return Array.from(grouped.values());
}

export default function ModalImportProtheus({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (f) => {
    setError(''); setResult(null); setParsed(null); setFile(f);
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const lancamentos = parseWorkbook(buf);
      if (!lancamentos.length) {
        setError('Nenhum lançamento encontrado. Verifique se a planilha tem a coluna "NF" preenchida.');
        return;
      }
      setParsed(lancamentos);
    } catch (e) {
      setError('Erro ao ler a planilha: ' + e.message);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true); setError('');
    try {
      const res = await dbImportProtheusLancamentos(parsed);
      setResult(res);
      onImported?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalItens = parsed ? parsed.reduce((s, l) => s + l.itens.length, 0) : 0;

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer" style={{ width: 520 }}>

        <div className="dd-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 6 }}>
                Sincronização Protheus
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                Importar lançamentos
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.5 }}>
                Envie a planilha de devoluções exportada do Protheus (mesmo formato de sempre). O sistema atualiza o status de lançamento, os itens (código, produto, quantidade, valor unitário e total) e o motivo de devolução das NFs correspondentes.
              </div>
            </div>
            <button onClick={onClose} className="dd-close">
              <Ic d="M18 6L6 18M6 6l12 12" size={16}/>
            </button>
          </div>
        </div>

        <div className="drawer-body" style={{ padding: '18px 22px 28px' }}>

          {!result && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                style={{
                  border: '2px dashed var(--border-2)', borderRadius: 12,
                  padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
                  background: 'var(--surface-2)', transition: 'border-color 120ms',
                }}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0])}/>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" size={18} color="var(--blue)"/>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {file ? file.name : 'Clique ou arraste a planilha aqui'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Formato .xlsx, mesma estrutura do relatório do Protheus</div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--red)', fontSize: 12 }}>
                  {error}
                </div>
              )}

              {parsed && !error && (
                <div style={{ marginTop: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Pré-visualização
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{parsed.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>NF{parsed.length !== 1 ? 's' : ''} de devolução</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{totalItens}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>itens no total</div>
                    </div>
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                    {parsed.map(l => (
                      <div key={l.nf_numero} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <span style={{ fontWeight: 700 }}>NF {l.nf_numero}</span>
                        <span style={{ color: 'var(--text-2)', flex: 1, marginLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.motivo_descricao || '—'}</span>
                        <span style={{ color: 'var(--text-3)' }}>{l.itens.length} itens</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
                    NFs que ainda não foram sincronizadas pelo OOBJ ficam em espera e são aplicadas automaticamente quando chegarem.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
                <button onClick={handleImport} disabled={!parsed || loading} className="btn btn-primary btn-sm">
                  {loading ? 'Importando...' : 'Importar lançamentos'}
                </button>
              </div>
            </>
          )}

          {result && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ic d="M20 6L9 17l-5-5" size={18} color="var(--green)"/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Importação concluída</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Os dados foram atualizados no portal.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--green-dim)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{result.applied}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>NFs atualizadas</div>
                </div>
                <div style={{ background: 'var(--yellow-dim)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--yellow)' }}>{result.staged}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>Aguardando sincronização do OOBJ</div>
                </div>
              </div>

              {result.staged > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 16 }}>
                  As NFs ainda não capturadas pelo OOBJ serão atualizadas automaticamente assim que aparecerem no portal — não é necessário reenviar a planilha.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="btn btn-primary btn-sm">Concluir</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
