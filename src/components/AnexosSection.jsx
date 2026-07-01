import { useEffect, useRef, useState } from 'react';
import { dbListAnexos, dbUploadAnexo, dbGetAnexoUrl, dbDeleteAnexo } from '../config/supabase';

const Ic = ({ d, size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

function fmtDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const ICON_BY_MIME = (mime) => {
  if (!mime) return 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z';
  if (mime.startsWith('image/')) return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
  if (mime === 'application/pdf') return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  if (mime.includes('sheet') || mime.includes('excel')) return 'M3 10h18M3 14h18M10 3v18M3 3h18M3 21h18';
  return 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z';
};

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.txt';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export default function AnexosSection({ devolucaoId, user }) {
  const [anexos, setAnexos]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState(null);

  // Fila de arquivos pendentes: [{ file, descricao, status: 'pending'|'uploading'|'done'|'error', erro }]
  const [fila, setFila]         = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileRef    = useRef(null);
  const sectionRef = useRef(null);

  const reload = () => {
    setLoading(true);
    dbListAnexos(devolucaoId).then(setAnexos).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [devolucaoId]); // eslint-disable-line

  // Adiciona arquivos à fila (validando tamanho)
  const handleFiles = (files) => {
    const validos = [...files].filter(f => f.size <= MAX_SIZE);
    const grandes = [...files].filter(f => f.size > MAX_SIZE);
    if (grandes.length) alert(`${grandes.length} arquivo(s) ignorado(s) por exceder 20 MB.`);
    if (!validos.length) return;

    setFila(prev => [
      ...prev,
      ...validos.map(f => ({ id: Math.random(), file: f, descricao: '', status: 'pending', erro: '' }))
    ]);
    setShowForm(true);
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };

  const removerDaFila = (id) => setFila(prev => prev.filter(f => f.id !== id));
  const setDesc = (id, v) => setFila(prev => prev.map(f => f.id === id ? { ...f, descricao: v } : f));

  // Envia todos da fila com status 'pending'
  const handleUploadAll = async () => {
    const pendentes = fila.filter(f => f.status === 'pending');
    if (!pendentes.length) return;
    setUploading(true);

    for (const item of pendentes) {
      setFila(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
      try {
        await dbUploadAnexo(devolucaoId, item.file, { descricao: item.descricao, userName: user?.name || user?.email || '' });
        setFila(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
      } catch (e) {
        setFila(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', erro: e.message } : f));
      }
    }

    setUploading(false);
    reload();
    // Limpa os que deram certo depois de 1s
    setTimeout(() => {
      setFila(prev => {
        const restantes = prev.filter(f => f.status !== 'done');
        if (!restantes.length) setShowForm(false);
        return restantes;
      });
    }, 1000);
  };

  const handleOpen = async (anexo) => {
    try {
      const url = await dbGetAnexoUrl(anexo.storage_path);
      if (anexo.tipo_mime?.startsWith('image/')) {
        setPreview({ url, nome: anexo.nome_arquivo, mime: anexo.tipo_mime });
      } else {
        window.open(url, '_blank');
      }
    } catch (e) { alert('Erro ao abrir arquivo: ' + e.message); }
  };

  const handleDelete = async (anexo) => {
    if (!window.confirm(`Remover "${anexo.nome_arquivo}"?`)) return;
    try { await dbDeleteAnexo(anexo.id, anexo.storage_path); reload(); }
    catch (e) { alert('Erro ao remover: ' + e.message); }
  };

  const pendentes = fila.filter(f => f.status === 'pending' || f.status === 'uploading');

  return (
    <div ref={sectionRef} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: showForm || anexos.length > 0 ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(14,165,233,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" size={13} color="#0EA5E9"/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Anexos e evidências</span>
          {anexos.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(14,165,233,0.12)', color: '#0EA5E9', padding: '1px 7px', borderRadius: 20 }}>{anexos.length}</span>
          )}
        </div>

        {/* Botão oculto acionado pelo hero */}
        <button id="btn-add-anexo" style={{ display: 'none' }}
          onClick={() => {
            setShowForm(true);
            setTimeout(() => fileRef.current?.click(), 0);
          }}/>

        {/* Botão visível dentro da seção */}
        <button onClick={() => fileRef.current?.click()}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer', color: 'var(--text-2)', fontWeight: 600 }}>
          <Ic d="M12 4v16m8-8H4" size={11}/> Adicionar
        </button>
      </div>

      {/* Input múltiplo — sempre montado */}
      <input ref={fileRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }}
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}/>

      {/* Fila de upload */}
      {showForm && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>

          {/* Área de drop (sempre visível quando form aberto) */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            style={{
              border: '2px dashed var(--border-2)', borderRadius: 10,
              padding: fila.length ? '12px 16px' : '24px 16px',
              textAlign: 'center', cursor: 'pointer', marginBottom: fila.length ? 12 : 0,
            }}>
            <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" size={18} color="var(--text-3)"/>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginTop: 6 }}>
              Clique ou arraste arquivos aqui
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
              Múltiplos arquivos permitidos · Imagens, PDF, Excel · máx. 20 MB cada
            </div>
          </div>

          {/* Lista da fila */}
          {fila.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fila.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  background: item.status === 'done' ? '#22c55e18' : item.status === 'error' ? '#ef444418' : 'var(--blue-dim)',
                  borderRadius: 8, border: `1px solid ${item.status === 'done' ? '#22c55e33' : item.status === 'error' ? '#ef444433' : 'transparent'}`,
                }}>
                  <Ic d={ICON_BY_MIME(item.file.type)} size={15} color="var(--blue)"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                      <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>{fmtBytes(item.file.size)}</span>
                    </div>
                    {item.status === 'pending' && (
                      <input type="text" value={item.descricao}
                        onChange={e => setDesc(item.id, e.target.value)}
                        placeholder="Descrição (opcional)"
                        style={{ marginTop: 4, width: '100%', fontSize: 11, padding: '3px 7px',
                          border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', color: 'var(--text)' }}
                        onClick={e => e.stopPropagation()}/>
                    )}
                    {item.status === 'uploading' && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>Enviando…</div>}
                    {item.status === 'done'     && <div style={{ fontSize: 10.5, color: '#22c55e', marginTop: 2 }}>✓ Enviado</div>}
                    {item.status === 'error'    && <div style={{ fontSize: 10.5, color: '#ef4444', marginTop: 2 }}>Erro: {item.erro}</div>}
                  </div>
                  {item.status === 'pending' && (
                    <button onClick={() => removerDaFila(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2, flexShrink: 0 }}>
                      <Ic d="M18 6L6 18M6 6l12 12" size={13}/>
                    </button>
                  )}
                </div>
              ))}

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => { setFila([]); setShowForm(false); }} className="btn btn-ghost btn-sm">
                  Cancelar
                </button>
                {pendentes.length > 0 && (
                  <button onClick={handleUploadAll} disabled={uploading} className="btn btn-primary btn-sm">
                    {uploading ? 'Enviando…' : `Enviar ${pendentes.length} arquivo${pendentes.length > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de anexos existentes */}
      <div style={{ padding: '6px 16px 10px' }}>
        {loading ? (
          <div style={{ padding: '14px 0', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Carregando...</div>
        ) : anexos.length === 0 ? (
          <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Nenhum anexo. Use o botão "Adicionar" para incluir prints, fotos ou documentos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 6 }}>
            {anexos.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, transition: 'background 100ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ic d={ICON_BY_MIME(a.tipo_mime)} size={15} color={a.tipo_mime?.startsWith('image/') ? '#0EA5E9' : a.tipo_mime === 'application/pdf' ? 'var(--red)' : 'var(--text-3)'}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.descricao || a.nome_arquivo}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                    {a.descricao && <span style={{ marginRight: 6 }}>{a.nome_arquivo} ·</span>}
                    {fmtBytes(a.tamanho_bytes)}
                    {a.uploader && ` · ${a.uploader}`}
                    {a.created_at && ` · ${fmtDateTime(a.created_at)}`}
                  </div>
                </div>
                <button onClick={() => handleOpen(a)} title="Abrir"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <Ic d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" size={15}/>
                </button>
                <button onClick={() => handleDelete(a)} title="Remover"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                  <Ic d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, width: '100%', maxWidth: 900 }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, flex: 1 }}>{preview.nome}</span>
            <a href={preview.url} download={preview.nome} target="_blank" rel="noreferrer"
              style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textDecoration: 'none', background: 'rgba(255,255,255,0.10)', padding: '5px 10px', borderRadius: 7 }}
              onClick={e => e.stopPropagation()}>
              ⬇ Baixar
            </a>
            <button onClick={() => setPreview(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <img src={preview.url} alt={preview.nome} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '78vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', objectFit: 'contain' }}/>
        </div>
      )}
    </div>
  );
}
