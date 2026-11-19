/* ─────────────────────────────────────────────────────────────
   Conteúdo do tutorial "Como emitir uma NF de débito" (aba Cobranças).
   Mesmo processo do POP-COB-001: portal + Protheus, na ordem em que se faz.
   Texto aceita **negrito** e `código`; imagens em /public/tutorial.
───────────────────────────────────────────────────────────── */

export const SISTEMA = {
  portal:   { nome: 'Portal',     cor: '#1E4DB7', bg: 'rgba(30,77,183,0.09)' },
  protheus: { nome: 'Protheus',   cor: '#0F1923', bg: '#EEF0F3' },
  financ:   { nome: 'Financeiro', cor: '#B45309', bg: 'rgba(217,119,6,0.11)' },
};

export const GRUPOS = [
  { k: 'inicio',     titulo: 'Antes de começar' },
  { k: 'montar',     titulo: '1 · Montar no portal' },
  { k: 'pedido',     titulo: '2 · Pedido no Protheus' },
  { k: 'liberar',    titulo: '3 · Liberar e faturar' },
  { k: 'registrar',  titulo: '4 · Registrar a NF' },
  { k: 'pdf',        titulo: '5 · PDF da NF (DANFE)' },
  { k: 'enviar',     titulo: '6 · Enviar' },
  { k: 'acompanhar', titulo: 'Acompanhar no portal' },
];

const img = (arq, legenda) => ({ src: `/tutorial/${arq}.webp`, legenda });

export const PASSOS = [
  /* ── Antes de começar ── */
  {
    id: 'visao', grupo: 'inicio', sistema: 'portal', onde: 'Visão geral',
    titulo: 'Como funciona a NF de débito',
    texto: [
      'A NF de débito cobra do transportador os produtos de uma devolução que foi responsabilidade dele (avaria, falta, inversão, erro de carregamento). Cobramos **só o valor dos produtos**, pelo mesmo preço da NF de venda.',
      'O caminho é sempre este, e o portal guarda cada número para nenhuma nota ser cobrada duas vezes:',
    ],
    lista: [
      '**Portal:** junte até 3 notas do mesmo transportador, filial e motivo.',
      '**Protheus:** digite o pedido de venda e salve.',
      '**Portal:** registre o nº do pedido.',
      '**Protheus:** libere o pedido. Se cair em crédito, o **financeiro** libera. Depois gere a NF no Prep.doc.saída.',
      '**Portal:** registre o nº da NF de débito (cada pedido vira uma NF).',
      '**Protheus:** baixe o PDF da NF (DANFE).',
      '**Portal:** baixe a relação em Excel, envie ao transportador e marque como enviada.',
    ],
    atencao: 'É normal lançar vários pedidos num dia e registrar as NFs depois, conforme o financeiro libera. O portal mostra em que etapa cada uma está.',
  },

  /* ── 1 · Montar no portal ── */
  {
    id: 'notas', grupo: 'montar', sistema: 'portal', onde: 'Cobranças › Notas a cobrar',
    titulo: 'Escolha as notas e clique em Montar NF de débito',
    texto: [
      'Primeiro escolha o transportador: no monitor grande, clique no nome dele na lista **Transportadores**, à esquerda; no notebook, escolha o nome no filtro de transportador (o que começa mostrando "Todos os transportadores"). A lista passa a mostrar só as notas dele.',
      'Marque **até 3 notas** da **mesma filial** e do **mesmo motivo** (clientes diferentes podem ir juntos).',
      'Na barra escura que aparece embaixo, clique em **Montar NF de débito**.',
    ],
    imagens: [img('p-01-notas', 'Transportador escolhido no filtro, notas marcadas e o botão Montar NF de débito.')],
  },
  {
    id: 'tela', grupo: 'montar', sistema: 'portal', onde: 'Tela da NF de débito',
    titulo: 'Deixe a tela da NF de débito aberta',
    texto: [
      'Ela traz tudo o que vai ser digitado no Protheus, com o botão **copiar** ao lado de cada valor: filial, CNPJ, operação, data de entrega, mensagem da nota e uma linha por produto.',
      'No quadro de notas, o número grande é a **NFD** (nota de devolução do cliente). A **NF de venda** aparece embaixo, em cinza.',
    ],
    atencao: 'Se aparecer o quadro amarelo "Atenção antes de salvar o pedido", resolva antes de ir ao Protheus.',
    imagens: [img('p-02-modal', 'Tela da NF de débito com os campos para copiar.')],
  },

  /* ── 2 · Pedido no Protheus ── */
  {
    id: 'filial', grupo: 'pedido', sistema: 'protheus', onde: 'Tela de abertura do Protheus',
    titulo: 'Entre na filial da NF de venda',
    texto: ['A filial aparece no topo da NF de débito do portal. Preencha **Grupo 01**, a filial e **Ambiente 05**, e clique em **Entrar**.'],
    campos: [
      ['Filial (Anápolis)', '0102', 'Linea Alimentos Anápolis'],
      ['Filial (Extrema)', '0106', 'Linea Alimentos Extrema'],
      ['Ambiente', '05', 'Faturamento, sempre'],
    ],
    imagens: [img('01-filial', 'Filial e Ambiente na abertura.')],
  },
  {
    id: 'incluir', grupo: 'pedido', sistema: 'protheus', onde: 'Atualizações › Pedidos › Pedidos de Venda',
    titulo: 'Abra Pedidos de Venda e clique em Incluir',
    texto: ['No menu da esquerda, abra **Pedidos** e depois **Pedidos de Venda**. Clique em **Incluir**.'],
    imagens: [img('02-menu', 'Pedidos de Venda no menu e o atalho Incluir.')],
  },
  {
    id: 'cliente', grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › campo Cliente',
    titulo: 'Busque o transportador pelo CNPJ',
    texto: [
      'Clique na **lupa** do campo Cliente. Cole o CNPJ copiado do portal em **Pesquisar**, clique na linha do transportador e em **OK**.',
      'Nome, loja, condição de pagamento, tabela e tipo de frete se preenchem sozinhos.',
    ],
    imagens: [img('03-cliente', 'Consulta de cliente pesquisada pelo CNPJ.')],
  },
  {
    id: 'cabecalho', grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › cabeçalho',
    titulo: 'Preencha Operação e Dt. Entrega',
    campos: [
      ['Operacao', '50', 'Venda de mercadoria'],
      ['Dt. Entrega', 'hoje + 10 dias', 'Dias corridos. A tela da NF de débito mostra a data pronta'],
    ],
    imagens: [img('04-cabecalho', 'Cabeçalho preenchido (laranja).')],
  },
  {
    id: 'mensagem', grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › Mens.p/ Nota',
    titulo: 'Cole a observação em Mens.p/ Nota',
    texto: ['Role os campos do cabeçalho até **Mens.p/ Nota** e cole o texto copiado do portal, no padrão curto: `Ref Cob Avaria NFD 969576;1806008`.'],
    atencao: 'Não use o campo OBSERVACAO, que fica logo abaixo. A mensagem da nota fiscal é a Mens.p/ Nota.',
    imagens: [img('05-mensnota', 'Mens.p/ Nota preenchida; OBSERVACAO fica vazio.')],
  },
  {
    id: 'linhas', grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › linhas',
    titulo: 'Inclua uma linha para cada produto',
    texto: ['Para cada linha do portal, digite **Produto**, **Quantidade** e **Prc Unitario**. Depois corrija três colunas que o Protheus preenche com outro valor:'],
    campos: [
      ['Prc Lista', '0', 'Vem com o preço de tabela (ex.: 74,59). Apague'],
      ['Tipo Saida', '627', 'Vem 531. Troque'],
      ['Armazem', '50', 'Confira; fica no fim da linha, role para o lado'],
    ],
    atencao: 'No fim, o Total do pedido tem que ser igual ao total mostrado no portal.',
    imagens: [
      img('06-linha-antes', 'Como a linha chega: Prc Lista e Tipo Saida errados (vermelho).'),
      img('04b-linha-certa', 'Linha corrigida (verde): Prc Lista 0, Tipo Saida 627, Armazém 50.'),
    ],
  },
  {
    id: 'salvar', grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › Salvar',
    titulo: 'Salve e anote o número do pedido',
    texto: ['Clique em **Salvar** (canto superior direito). O número do pedido é o campo **Numero**, no topo do cabeçalho.'],
    imagens: [img('13-salvar', 'Numero do pedido e o botão Salvar.')],
  },
  {
    id: 'reg-pedido', grupo: 'pedido', sistema: 'portal', onde: 'Portal › NF de débito › passo 3',
    titulo: 'Digite o número do pedido no portal',
    texto: ['Volte à tela da NF de débito no portal. No passo **3**, digite o número do pedido e clique em **Registrar pedido**. A NF de débito passa para **Aguardando faturamento**.'],
    imagens: [img('p-03-pedido', 'Número do pedido digitado e o botão Registrar pedido.')],
  },

  /* ── 3 · Liberar e faturar ── */
  {
    id: 'menu-liberacao', grupo: 'liberar', sistema: 'protheus', onde: 'Atualizações › Pedidos › Liberação de Pedidos de Venda',
    titulo: 'Abra a Liberação de Pedidos de Venda',
    texto: ['No menu da esquerda, em **Pedidos**, logo abaixo de Pedidos de Venda, clique em **Liberação de Pedidos de Venda**. Nos atalhos da direita, o mesmo bloco tem o link **Liberar**.'],
    imagens: [img('14-menu-liberacao', 'Liberação de Pedidos de Venda no menu e o atalho Liberar.')],
  },
  {
    id: 'liberar', grupo: 'liberar', sistema: 'protheus', onde: 'Liberação de Pedidos de Venda',
    titulo: 'Pesquise o pedido, clique em Liberar e Salve',
    texto: ['Digite o número do pedido na barra de pesquisa, clique na linha dele e em **Liberar**. Na tela que abrir, clique em **Salvar**.'],
    imagens: [
      img('07-liberacao', 'Barra de pesquisa e o botão Liberar.'),
      img('15-liberar-salvar', 'Na tela de liberação, clique em Salvar.'),
    ],
  },
  {
    id: 'bolinha', grupo: 'liberar', sistema: 'financ', onde: 'Pedidos de Venda › cor da bolinha',
    titulo: 'Bolinha branca? Peça a liberação ao financeiro',
    texto: [
      'Volte em **Pedidos de Venda** e procure o pedido. **Bolinha branca** = o pedido caiu na regra de crédito e só o **financeiro** pode liberar. Peça e aguarde.',
      'Enquanto isso, pode seguir com outras NFs de débito. No portal, o cartão **Com pedido, sem NF de débito** mostra há quantos dias cada uma espera.',
    ],
    imagens: [img('08-bolinha', 'Pedido com bolinha branca: aguardando o financeiro.')],
  },
  {
    id: 'prepdoc', grupo: 'liberar', sistema: 'protheus', onde: 'Pedidos de Venda › Outras Ações › Prep.Doc.saída',
    titulo: 'Gere a NF no Prep.Doc.saída',
    texto: [
      'Com o pedido liberado, clique na linha dele em **Pedidos de Venda**, depois em **Outras Ações** e **Prep.Doc.saída**.',
      'No assistente, clique em **Avançar** até o fim. O Protheus gera o **número da NF de débito**. Anote.',
    ],
    atencao: 'Se o assistente listar itens bloqueados, o pedido ainda está em regra de crédito. Volte ao passo anterior.',
    imagens: [
      img('16-prepdoc', 'Pedido selecionado, Outras Ações e Prep.Doc.saída.'),
      img('09-assistente', 'Assistente do Prep.Doc.saída: siga com Avançar.'),
    ],
  },

  /* ── 4 · Registrar a NF ── */
  {
    id: 'reg-nf', grupo: 'registrar', sistema: 'portal', onde: 'Portal › NF de débito › passo 4',
    titulo: 'Registre o número da NF de débito',
    texto: ['Abra a NF de débito no portal (aba **NFs de débito**). No passo **4**, digite o número da NF e clique em **Registrar NF de débito**. As notas ficam como **cobradas**.'],
    imagens: [img('p-05-nf', 'Número da NF digitado e o botão Registrar NF de débito.')],
  },

  /* ── 5 · PDF da NF ── */
  {
    id: 'menu-nfe', grupo: 'pdf', sistema: 'protheus', onde: 'Atualizações › Nf-e e Nfs-e › NF-e Sefaz',
    titulo: 'Abra a NF-e Sefaz',
    texto: ['No menu da esquerda, abra **Nf-e e Nfs-e** e depois **NF-e Sefaz** (tela Monitoramento SEFAZ). Procure a NF pelo número na barra de pesquisa e clique na linha dela.'],
    imagens: [img('17-menu-nfe', 'Nf-e e Nfs-e no menu do Faturamento.')],
  },
  {
    id: 'danfe', grupo: 'pdf', sistema: 'protheus', onde: 'NF-e Sefaz › Outras Ações › DANFE › Imp. Padrão',
    titulo: 'Clique em Outras Ações › DANFE › Imp. Padrão',
    texto: ['Na janela **Parâmetros**, preencha e clique em **OK**:'],
    campos: [
      ['Da Nota Fiscal', 'nº da NF', 'O número que o Protheus gerou'],
      ['Até a Nota Fiscal', 'nº da NF', 'O mesmo número'],
      ['Da Série', '2', ''],
      ['Tipo de Operação', 'NF. Saída', ''],
    ],
    imagens: [
      img('18-danfe-menu', 'Outras Ações › DANFE › Imp. Padrão.'),
      img('19-parametros', 'Parâmetros: número da NF, série 2 e NF. Saída.'),
    ],
  },
  {
    id: 'pdf', grupo: 'pdf', sistema: 'protheus', onde: 'Janela DANFE',
    titulo: 'Salve o PDF',
    campos: [
      ['Tipo de Impressão', 'Microsoft Print to PDF', ''],
      ['Destino', 'Local', ''],
      ['Orientação', 'Retrato', 'Clique em Retrato'],
    ],
    texto: ['Clique em **Ok**. Na janela de download, dê um nome ao arquivo (ex.: `NF debito 244606 - TECMAR`) e salve.'],
    imagens: [img('20-danfe-janela', 'Microsoft Print to PDF, destino Local, orientação Retrato e Ok.')],
  },

  /* ── 6 · Enviar ── */
  {
    id: 'enviar', grupo: 'enviar', sistema: 'portal', onde: 'NFs de débito › NF de débito emitida',
    titulo: 'Baixe a relação única e marque como enviadas',
    texto: [
      'Na aba **NFs de débito**, clique no cartão **NF de débito emitida**. Use **Marcar todas de [transportador]** e clique em **Baixar relação única (Excel)**: sai uma planilha só com todas as NFs dele.',
      'Envie ao transportador o PDF de cada NF e a relação. Depois, na mesma barra, confira a data e clique em **Marcar todas como enviadas**. Pronto.',
    ],
    imagens: [img('p-07-enviar', 'Atalho por transportador, relação única e marcar como enviadas.')],
  },

  /* ── Acompanhar ── */
  {
    id: 'status', grupo: 'acompanhar', sistema: 'portal', onde: 'Cobranças › NFs de débito',
    titulo: 'Veja em que etapa está cada NF de débito',
    texto: [
      'A aba **NFs de débito** sempre abre em **Minhas NFs de débito** (as que você criou). Em **De todos** você vê as dos colegas.',
      'Os cartões filtram por etapa. Clique de novo no mesmo cartão para voltar a ver todas em andamento:',
    ],
    lista: [
      '**Abertas, sem pedido:** montadas, falta digitar o pedido no Protheus.',
      '**Com pedido, sem NF de débito:** aguardando liberação/faturamento.',
      '**NF de débito emitida:** falta enviar ao transportador.',
      '**Enviadas:** processo concluído.',
    ],
    imagens: [img('p-08-nfs', 'Minhas / De todos e os cartões de etapa.')],
  },
  {
    id: 'canais', grupo: 'acompanhar', sistema: 'portal', onde: 'Cobranças › Canais',
    titulo: 'Filtre pelos canais que você atende',
    texto: ['O botão **Canais**, no alto à direita, filtra as notas pelo canal (centro de custo da NF de venda). Marque um ou mais e clique em **Salvar como meus canais**: o portal abre sempre com eles. **Ver todos** mostra tudo de novo.'],
    imagens: [img('p-10-canais', 'Escolha dos canais e Salvar como meus canais.')],
  },
  {
    id: 'corrigir', grupo: 'acompanhar', sistema: 'portal', onde: 'NF de débito › rodapé',
    titulo: 'Corrigir, desfazer ou passar para outra pessoa',
    lista: [
      '**corrigir:** aparece ao lado do pedido ou da NF já registrados, para trocar um número digitado errado.',
      '**Desfazer última etapa:** volta uma etapa (ex.: tira o registro da NF).',
      '**Passar para outra pessoa:** a NF de débito vai para "Minhas NFs de débito" do colega.',
      '**Cancelar NF de débito:** desiste da cobrança; as notas voltam para "Notas a cobrar".',
    ],
    imagens: [img('p-11-rodape', 'Rodapé da NF de débito com as opções.')],
  },
];

/** Índice de um passo pelo id (para abrir o tutorial direto nele). */
export const passoPorId = (id) => Math.max(0, PASSOS.findIndex(p => p.id === id));
