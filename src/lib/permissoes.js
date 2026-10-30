// Perfil "visualizador" (ex.: gerência): vê o portal, não altera nada.
// O bloqueio de verdade está no banco (dev_fiscal_pode_editar); aqui só escondemos os botões.
export const ABAS_VISUALIZADOR = ['painel', 'devolucoes', 'fretes'];
export const somenteLeitura = (user) => user?.role === 'visualizador';
export const abaPermitida = (user, id) => !somenteLeitura(user) || ABAS_VISUALIZADOR.includes(id);
