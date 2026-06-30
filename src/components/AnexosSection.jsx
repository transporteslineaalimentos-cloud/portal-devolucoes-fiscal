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

export default function AnexosSection({ devolucaoId, user }) {
  const [anexos, setAnexos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [descricao, setDescricao] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [preview, setPreview]    = useState(null); // { url, nome, mime }
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  const reload = () => {
    setLoading(true);
    dbListAnexos(devolucaoId)
      .then(setAnexos)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [devolucaoId]); // eslint-disable-line

  const sectionRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setUploadErr('Arquivo muito grande (máx. 20 MB).'); return; }
    setPendingFile(f);
    setShowForm(true);
    setUploadErr('');
    setDescricao('');
    // Rola até a seção de anexos para o usuário ver o preview do arquivo selecionado
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true); setUploadErr('');
    try {
      await dbUploadAnexo(devolucaoId, pendingFile, { descricao, userName: user?.name || user?.email || '' });
      setPendingFile(null); setShowForm(false); setDescricao('');
      reload();
    } catch (e) { setUploadErr(e.message); }
    finally { setUploading(false); }
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
    try {
      await dbDeleteAnexo(anexo.id, anexo.storage_path);
      reload();
    } catch (e) { alert('Erro ao remover: ' + e.message); }
  };

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
        {/* Botão oculto — acionado pelo botão do hero via id.
            Abre o seletor de arquivos DIRETAMENTE, sem precisar abrir o form antes
            nem rolar a tela até a seção de anexos. */}
        <button id="btn-add-anexo" style={{ display: 'none' }}
          onClick={() => {
            setPendingFile(null); setDescricao(''); setUploadErr('');
            setShowForm(true);
            // Pequeno delay para garantir que o input já está montado/visível antes do click
            setTimeout(() => fileRef.current?.click(), 0);
          }}/>
      </div>

      {/* Input de arquivo — sempre montado, acionado pelo botão do hero ou pela área de drop */}
      <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}/>

      {/* Form de upload */}
      {showForm && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {!pendingFile ? (
            <div
              ref={dropRef}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              style={{
                border: '2px dashed var(--border-2)', borderRadius: 10,
                padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 120ms',
              }}>
              <Ic d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" size={20} color="var(--text-3)"/>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginTop: 8 }}>Clique ou arraste o arquivo</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Imagens, PDF, Excel · máx. 20 MB</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--blue-dim)', borderRadius: 8, marginBottom: 10 }}>
                <Ic d={ICON_BY_MIME(pendingFile.type)} size={16} color="var(--blue)"/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{fmtBytes(pendingFile.size)}</div>
                </div>
                <button onClick={() => { setPendingFile(null); setUploadErr(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}>
                  <Ic d="M18 6L6 18M6 6l12 12" size={14}/>
                </button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label className="input-label">Descrição (opcional)</label>
                <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
                  className="input" placeholder="Ex: Print do e-mail de reclamação, foto da avaria..."/>
              </div>
              {uploadErr && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{uploadErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowForm(false); setPendingFile(null); }} className="btn btn-ghost btn-sm">Cancelar</button>
                <button onClick={handleUpload} disabled={uploading} className="btn btn-primary btn-sm">
                  {uploading ? 'Enviando...' : 'Enviar arquivo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista de anexos */}
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
                    {a.descricao && <span style={{ marginRight: 6, color: 'var(--text-3)' }}>{a.nome_arquivo} ·</span>}
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

      {/* Lightbox de imagem */}
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
