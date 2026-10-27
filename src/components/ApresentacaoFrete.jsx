import { useEffect, useRef, useState } from 'react';

/* Apresentação em tela cheia: um bloco por tela, setas para navegar.
   Continua clicável — cada gráfico abre os CT-es por trás do número. */

export default function ApresentacaoFrete({ titulo, periodo, filtros, slides, onSair, onLimpar, onTirarChip, onVerCtes, carregando }) {
  const [i, setI] = useState(0);
  const raiz = useRef(null);
  const n = slides.length;

  /* onSair e o total de slides mudam a cada render do pai; guardados em ref
     para os efeitos rodarem uma vez só — reentrar em tela cheia fora de um
     clique do usuário é bloqueado pelo navegador e derrubava a apresentação. */
  const ref = useRef({ onSair, n });
  useEffect(() => { ref.current = { onSair, n }; });
  const entrou = useRef(false);

  useEffect(() => {
    const el = raiz.current;
    if (el?.requestFullscreen) el.requestFullscreen().then(() => { entrou.current = true; }).catch(() => {});
    const saiu = () => { if (entrou.current && !document.fullscreenElement) { entrou.current = false; ref.current.onSair(); } };
    document.addEventListener('fullscreenchange', saiu);
    return () => {
      document.removeEventListener('fullscreenchange', saiu);
      entrou.current = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const tecla = (e) => {
      const total = ref.current.n;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setI(v => Math.min(total - 1, v + 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setI(v => Math.max(0, v - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(total - 1);
      else if (e.key === 'Escape' && !document.fullscreenElement) ref.current.onSair();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const s = slides[i] || {};
  const seta = (dir, on) => (
    <button onClick={on} disabled={dir < 0 ? i === 0 : i === n - 1} aria-label={dir < 0 ? 'Anterior' : 'Próximo'}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, width: 36, height: 36,
        cursor: 'pointer', color: 'var(--text-2)', fontSize: 17, lineHeight: 1, display: 'grid', placeItems: 'center',
        opacity: (dir < 0 ? i === 0 : i === n - 1) ? 0.3 : 1 }}>
      {dir < 0 ? '‹' : '›'}
    </button>
  );

  return (
    <div ref={raiz} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        padding: '18px 36px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#1C2130,#2D3A52)',
            display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="19" height="19" viewBox="0 0 22 22"><path d="M3 17V5h3l5 9 5-9h3v12h-2.5V9.5l-4.5 7.5h-3L5 9.5V17H3z" fill="#B8956A"/></svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{titulo}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Linea Alimentos · {periodo}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onVerCtes && (
            <button className="btn btn-outline btn-sm" style={{ height: 34 }} onClick={onVerCtes}>Ver CT-es</button>
          )}
          <div style={{ display: 'flex', gap: 6, marginRight: 6 }}>
            {slides.map((sl, k) => (
              <button key={sl.id} onClick={() => setI(k)} title={sl.titulo}
                style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: k === i ? 'var(--blue)' : 'var(--border)', transition: 'width 160ms, background 160ms' }}/>
            ))}
          </div>
          {seta(-1, () => setI(v => Math.max(0, v - 1)))}
          {seta(1, () => setI(v => Math.min(n - 1, v + 1)))}
          <button className="btn btn-outline btn-sm" style={{ height: 34, marginLeft: 4 }} onClick={onSair}>Sair</button>
        </div>
      </header>

      {(filtros?.length > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '0 36px 8px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Recorte:</span>
          {filtros.map(c => (
            <button key={c.k} className="dv-chip" onClick={() => onTirarChip?.(c.k)} title="Remover">
              {c.l} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ height: 26 }} onClick={onLimpar}>Limpar</button>
        </div>
      )}

      <div style={{ flex: '1 1 auto', minHeight: 0, padding: '4px 36px 10px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{s.titulo}</h2>
            {s.sub && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>}
          </div>
          {carregando && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>atualizando…</span>}
        </div>
        <div key={s.id} className="cf-slide" style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto',
          opacity: carregando ? 0.55 : 1, transition: 'opacity 150ms' }}>
          {s.corpo}
        </div>
      </div>

      <footer style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        padding: '6px 36px 16px', fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>
        <span>{i + 1} de {n}</span>
      </footer>
    </div>
  );
}
