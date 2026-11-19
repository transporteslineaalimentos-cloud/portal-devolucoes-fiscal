import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dbGetUsuarios, dbUsuariosAcao } from '../config/supabase';
import { fmtDateTime } from '../utils.jsx';

/* ─────────────────────────────────────────────────────────────
   Usuários do portal (só administradores).
   Criar, mudar perfil, desativar e redefinir senha passam pela
   função dev-fiscal-usuarios, que confere no servidor se quem pede
   é administrador. O login é o mesmo para todos os portais da Linea.
───────────────────────────────────────────────────────────── */

export const PERFIS = [
  { v: 'analista',     l: 'Analista',       d: 'Trabalha nas devoluções e cobranças: lança, edita, monta NFs de débito.' },
  { v: 'visualizador', l: 'Visualização',   d: 'Só consulta o Painel, as Devoluções e os Custos de Frete. Não altera nada.' },
  { v: 'admin',        l: 'Administrador',  d: 'Tudo o que o analista faz e ainda cadastra e gerencia usuários.' },
];
const NOME_PERFIL = Object.fromEntries(PERFIS.map(p => [p.v, p.l]));

function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', nums = '23456789';
  const r = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  let x = r('ABCDEFGHJKMNPQRSTUVWXYZ');
  for (let i = 0; i < 6; i++) x += r(letras);
  return x + r(nums) + r(nums) + r(nums);
}

function Modal({ titulo, sub, onClose, children, rodape }) {
  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 650 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={titulo} style={{ maxWidth: 520, width: '100%' }}>
        <div className="modal-header">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{rodape}</div>
      </div>
    </div>, document.body);
}

function CampoSenha({ valor, onChange, rotulo = 'Senha inicial' }) {
  return (
    <div className="usr-campo">
      <label className="input-label">{rotulo}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" value={valor} onChange={e => onChange(e.target.value)} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} autoComplete="new-password"/>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(gerarSenha())}>Gerar</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(valor)} disabled={!valor}>Copiar</button>
      </div>
      <div className="usr-dica">Mínimo de 8 caracteres, com letras e números. Passe a senha para a pessoa e peça para ela trocar no primeiro acesso (menu do usuário, "Trocar senha").</div>
    </div>
  );
}

function EscolhaPerfil({ valor, onChange }) {
  return (
    <div className="usr-perfis" role="radiogroup" aria-label="Perfil">
      {PERFIS.map(p => (
        <label key={p.v} className={`usr-perfil${valor === p.v ? ' on' : ''}`}>
          <input type="radio" name="perfil" value={p.v} checked={valor === p.v} onChange={() => onChange(p.v)}/>
          <span><b>{p.l}</b><small>{p.d}</small></span>
        </label>
      ))}
    </div>
  );
}

export default function Usuarios({ user }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null);   // { tipo: 'novo'|'editar'|'senha', u }
  const [f, setF] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    try { const d = await dbGetUsuarios(); setLista(Array.isArray(d) ? d : []); setErro(''); } catch (e) { setErro(e.message); setLista([]); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 6000); return () => clearTimeout(t); }, [aviso]);

  const abrir = (tipo, u = null) => {
    setErroModal('');
    setF(tipo === 'novo' ? { nome: '', email: '', role: 'analista', senha: gerarSenha() }
      : tipo === 'editar' ? { nome: u.nome, role: u.role, ativo: u.ativo } : { senha: gerarSenha() });
    setModal({ tipo, u });
  };
  const salvar = async () => {
    setSalvando(true); setErroModal('');
    try {
      if (modal.tipo === 'novo') {
        const r = await dbUsuariosAcao({ acao: 'criar', nome: f.nome, email: f.email, role: f.role, senha: f.senha });
        setAviso(r.ja_tinha_login
          ? `${f.nome} já tinha login em outro portal da Linea: ganhou acesso a este com a mesma senha de lá (a senha digitada não foi usada).`
          : `${f.nome} cadastrado. Passe o e-mail e a senha inicial para a pessoa.`);
      } else if (modal.tipo === 'editar') {
        await dbUsuariosAcao({ acao: 'atualizar', email: modal.u.email, nome: f.nome, role: f.role, ativo: f.ativo });
        setAviso('Usuário atualizado.');
      } else {
        await dbUsuariosAcao({ acao: 'redefinir_senha', email: modal.u.email, senha: f.senha });
        setAviso(`Senha de ${modal.u.nome} redefinida. Ela vale também para os outros portais da Linea.`);
      }
      setModal(null); carregar();
    } catch (e) { setErroModal(e.message); }
    setSalvando(false);
  };

  const ativos = (lista || []).filter(u => u.ativo);
  return (
    <div className="usr">
      <div className="usr-topo">
        <div>
          <div className="usr-tit">Usuários do portal</div>
          <div className="usr-sub">Cada pessoa com o seu login: assim as NFs de débito e o histórico das notas mostram quem fez cada coisa.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => abrir('novo')}>+ Novo usuário</button>
      </div>

      <div className="usr-perfis-info">
        {PERFIS.map(p => <div key={p.v}><b>{p.l}</b><span>{p.d}</span></div>)}
      </div>

      {erro && <div className="cob-erro">{erro}</div>}
      <div className="cob-lista">
        <div className="cob-toolbar"><div className="cob-toolbar-info">{lista ? `${ativos.length} ativos · ${lista.length - ativos.length} inativos` : 'Carregando…'}</div></div>
        <div className="cob-tabela-wrap">
          <table className="cob-tabela usr-tabela">
            <thead><tr>{['Nome', 'E-mail', 'Perfil', 'Situação', 'Último acesso', ''].map(t => <th key={t}><button>{t}</button></th>)}</tr></thead>
            <tbody>
              {(lista || []).map(u => (
                <tr key={u.email} style={{ cursor: 'default', opacity: u.ativo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.nome}{u.email === String(user?.email || '').toLowerCase() && <span className="usr-voce">você</span>}</td>
                  <td>{u.email}</td>
                  <td><span className={`usr-badge ${u.role}`}>{NOME_PERFIL[u.role] || u.role}</span></td>
                  <td>{u.ativo ? <span style={{ color: '#2F855A', fontWeight: 600 }}>Ativo</span> : 'Inativo'}</td>
                  <td>{u.ultimo_acesso ? fmtDateTime(u.ultimo_acesso) : <span style={{ color: 'var(--text-3)' }}>nunca entrou</span>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => abrir('editar', u)}>Editar</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => abrir('senha', u)}>Redefinir senha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aviso && createPortal(<div className="cob-toast" role="status">{aviso}</div>, document.body)}

      {modal?.tipo === 'novo' && (
        <Modal titulo="Novo usuário" sub="A pessoa entra com o e-mail corporativo e a senha inicial" onClose={() => !salvando && setModal(null)}
          rodape={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando || !f.nome?.trim() || !f.email?.trim()}>{salvando ? 'Salvando…' : 'Cadastrar'}</button></>}>
          <div className="usr-campo"><label className="input-label">Nome</label><input className="input" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Maria Souza" autoFocus/></div>
          <div className="usr-campo"><label className="input-label">E-mail corporativo</label><input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="nome.sobrenome@lineaalimentos.com.br"/></div>
          <div className="usr-campo"><label className="input-label">Perfil</label><EscolhaPerfil valor={f.role} onChange={v => setF({ ...f, role: v })}/></div>
          <CampoSenha valor={f.senha} onChange={v => setF({ ...f, senha: v })}/>
          {erroModal && <div className="nd-erro">{erroModal}</div>}
        </Modal>
      )}
      {modal?.tipo === 'editar' && (
        <Modal titulo={`Editar ${modal.u.nome}`} sub={modal.u.email} onClose={() => !salvando && setModal(null)}
          rodape={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
          <div className="usr-campo"><label className="input-label">Nome</label><input className="input" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })}/></div>
          <div className="usr-campo"><label className="input-label">Perfil</label><EscolhaPerfil valor={f.role} onChange={v => setF({ ...f, role: v })}/></div>
          <label className="usr-ativo"><input type="checkbox" checked={!!f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })}/> Acesso ativo <span>(desmarque para bloquear a entrada no portal sem apagar o histórico)</span></label>
          {erroModal && <div className="nd-erro">{erroModal}</div>}
        </Modal>
      )}
      {modal?.tipo === 'senha' && (
        <Modal titulo={`Redefinir senha de ${modal.u.nome}`} sub="O login é o mesmo para todos os portais da Linea: a nova senha vale para todos" onClose={() => !salvando && setModal(null)}
          rodape={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} disabled={salvando}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Redefinir'}</button></>}>
          <CampoSenha valor={f.senha} onChange={v => setF({ ...f, senha: v })} rotulo="Nova senha"/>
          {erroModal && <div className="nd-erro">{erroModal}</div>}
        </Modal>
      )}
    </div>
  );
}
