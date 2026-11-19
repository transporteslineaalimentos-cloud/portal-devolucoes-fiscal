import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GRUPOS, PASSOS, SISTEMA } from '../utils/tutorialNFDebito.js';

/* Tutorial "Como emitir uma NF de débito": portal + Protheus, um passo por tela. */

const CHAVE = 'df_tutorial_nfd_passo';
const lerPasso = () => { try { const n = Number(localStorage.getItem(CHAVE)); return n >= 0 && n < PASSOS.length ? n : 0; } catch { return 0; } };
const gravarPasso = (n) => { try { localStorage.setItem(CHAVE, String(n)); } catch { /* sem armazenamento */ } };

/** Texto com **negrito** e `código`. */
function Rico({ t }) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b>
      : p.startsWith('`') ? <code key={i} className="tut-code">{p.slice(1, -1)}</code>
      : <Fragment key={i}>{p}</Fragment>);
}

export default function ModalTutorialNFDebito({ onClose, inicio }) {
  const [i, setI] = useState(() => inicio ?? lerPasso());
  const p = PASSOS[i];
  const sis = SISTEMA[p.sistema];
  const ultimo = i === PASSOS.length - 1;
  const ir = (n) => { const v = Math.max(0, Math.min(PASSOS.length - 1, n)); setI(v); gravarPasso(v); };

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && !e.target.closest?.('select')) ir(i + 1);
      else if (e.key === 'ArrowLeft' && !e.target.closest?.('select')) ir(i - 1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [i, onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.querySelector('.tut-conteudo')?.scrollTo?.(0, 0); }, [i]);

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 720 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal tut" role="dialog" aria-label="Tutorial: como emitir uma NF de débito">
        <div className="tut-topo">
          <div>
            <div className="tut-sobre">Tutorial · POP-COB-001</div>
            <div className="tut-titulo">Como emitir uma NF de débito</div>
            <div className="tut-sub">Do portal ao Protheus, na ordem em que você faz. Use ← e → para navegar.</div>
          </div>
          <button className="dd-close" onClick={onClose} aria-label="Fechar tutorial">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="tut-meio">
          <nav className="tut-nav" aria-label="Passos do tutorial">
            {GRUPOS.map(g => (
              <div key={g.k} className="tut-grupo">
                <div className="tut-grupo-tit">{g.titulo}</div>
                {PASSOS.map((x, n) => x.grupo !== g.k ? null : (
                  <button key={n} className={`tut-item${n === i ? ' on' : ''}${n < i ? ' feito' : ''}`} onClick={() => ir(n)} aria-current={n === i ? 'step' : undefined}>
                    <span className="tut-item-n">{n < i ? '✓' : n + 1}</span>
                    <span className="tut-item-t">{x.titulo}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <select className="tut-nav-mob cob-filtro" value={i} onChange={e => ir(Number(e.target.value))} aria-label="Ir para o passo">
            {PASSOS.map((x, n) => <option key={n} value={n}>{n + 1}. {x.titulo}</option>)}
          </select>

          <div className="tut-conteudo">
            <div className="tut-meta">
              <span className="tut-passo">Passo {i + 1} de {PASSOS.length}</span>
              <span className="tut-sis" style={{ color: sis.cor, background: sis.bg }}>{sis.nome}</span>
              <span className="tut-onde">{p.onde}</span>
            </div>
            <h2 className="tut-h">{p.titulo}</h2>
            {(p.texto || []).map((t, n) => <p key={n} className="tut-p"><Rico t={t}/></p>)}

            {p.campos && (
              <table className="tut-campos">
                <thead><tr><th>Campo</th><th>Digite</th><th>Observação</th></tr></thead>
                <tbody>{p.campos.map(([c, v, o]) => (
                  <tr key={c}><td>{c}</td><td><span className="tut-valor">{v}</span></td><td>{o}</td></tr>
                ))}</tbody>
              </table>
            )}

            {p.atencao && <div className="tut-atencao"><b>Atenção:</b> {p.atencao}</div>}

            {(p.imagens || []).map(im => (
              <figure key={im.src + im.legenda} className="tut-fig">
                <a href={im.src} target="_blank" rel="noreferrer" title="Abrir a imagem em tamanho real">
                  <img src={im.src} alt={im.legenda} loading="lazy"/>
                </a>
                <figcaption>{im.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="tut-rodape">
          <div className="tut-progresso" aria-hidden="true"><span style={{ width: `${((i + 1) / PASSOS.length) * 100}%` }}/></div>
          <button className="btn btn-ghost btn-sm" onClick={() => ir(i - 1)} disabled={i === 0}>← Anterior</button>
          <span style={{ flex: 1 }}/>
          {ultimo
            ? <button className="btn btn-primary btn-sm" onClick={() => { gravarPasso(0); onClose(); }}>Concluir</button>
            : <button className="btn btn-primary btn-sm" onClick={() => ir(i + 1)}>Próximo →</button>}
        </div>
      </div>
    </div>, document.body);
}
