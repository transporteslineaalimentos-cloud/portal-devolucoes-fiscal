import { useState } from 'react';
import { createPortal } from 'react-dom';
import { dbTrocarMinhaSenha } from '../config/supabase';

/** O próprio usuário troca a senha. O login é o mesmo para todos os portais da Linea. */
export default function ModalTrocarSenha({ onClose }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const valida = nova.length >= 8 && /[A-Za-z]/.test(nova) && /\d/.test(nova);

  const salvar = async (e) => {
    e.preventDefault();
    if (!valida) { setErro('A nova senha precisa ter pelo menos 8 caracteres, com letras e números.'); return; }
    if (nova !== conf) { setErro('A confirmação não bate com a nova senha.'); return; }
    if (nova === atual) { setErro('A nova senha precisa ser diferente da atual.'); return; }
    setSalvando(true); setErro('');
    try { await dbTrocarMinhaSenha(atual, nova); setOk(true); }
    catch (e2) { setErro(e2.message); }
    setSalvando(false);
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 700 }} onClick={e => e.target === e.currentTarget && !salvando && onClose()}>
      <form className="modal" role="dialog" aria-label="Trocar senha" style={{ maxWidth: 420, width: '100%' }} onSubmit={salvar}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Trocar senha</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>A nova senha vale também para os outros portais da Linea.</div>
        </div>
        <div className="modal-body">
          {ok ? (
            <div style={{ fontSize: 13, color: '#2F855A', fontWeight: 600 }}>Senha trocada. Use a nova senha no próximo acesso.</div>
          ) : (
            <>
              <div className="usr-campo"><label className="input-label" htmlFor="ts-atual">Senha atual</label>
                <input id="ts-atual" className="input" type="password" value={atual} onChange={e => setAtual(e.target.value)} autoComplete="current-password" autoFocus/></div>
              <div className="usr-campo"><label className="input-label" htmlFor="ts-nova">Nova senha</label>
                <input id="ts-nova" className="input" type="password" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password"/>
                <div className="usr-dica" style={{ color: nova && !valida ? '#B45309' : undefined }}>Mínimo de 8 caracteres, com letras e números.</div></div>
              <div className="usr-campo"><label className="input-label" htmlFor="ts-conf">Repita a nova senha</label>
                <input id="ts-conf" className="input" type="password" value={conf} onChange={e => setConf(e.target.value)} autoComplete="new-password"/></div>
              {erro && <div className="nd-erro">{erro}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {ok ? <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Fechar</button> : <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvando || !atual || !nova || !conf}>{salvando ? 'Salvando…' : 'Trocar senha'}</button>
          </>}
        </div>
      </form>
    </div>, document.body);
}
