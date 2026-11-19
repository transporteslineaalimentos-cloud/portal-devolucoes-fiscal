// Quem vê o quê. O bloqueio de verdade está no banco (dev_fiscal_aba / dev_fiscal_pode_editar);
// aqui só escondemos abas e botões.
export const ABAS = [
  { id: 'painel',     l: 'Painel Gerencial' },
  { id: 'devolucoes', l: 'Devoluções' },
  { id: 'cobrancas',  l: 'Cobranças' },
  { id: 'fretes',     l: 'Custos de Frete' },
];
export const ABAS_VISUALIZADOR = ['painel', 'devolucoes', 'fretes'];
export const abasPadrao = (role) => role === 'visualizador' ? ABAS_VISUALIZADOR : ABAS.map(a => a.id);
/** Abas liberadas: as escolhidas no cadastro do usuário ou, se nada foi escolhido, o padrão do perfil. */
export const abasDoUsuario = (user) => Array.isArray(user?.abas) && user.abas.length ? user.abas : abasPadrao(user?.role);
export const somenteLeitura = (user) => user?.role === 'visualizador';
export const ehAdmin = (user) => user?.role === 'admin';
export const abaPermitida = (user, id) => id === 'usuarios' ? ehAdmin(user) : abasDoUsuario(user).includes(id);
export const primeiraAba = (user) => abasDoUsuario(user).find(id => ABAS.some(a => a.id === id)) || 'devolucoes';
