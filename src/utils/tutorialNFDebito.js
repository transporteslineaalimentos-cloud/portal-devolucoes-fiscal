/* ─────────────────────────────────────────────────────────────
   Conteúdo do tutorial "Como emitir uma NF de débito" (aba Cobranças).
   Mesmo passo a passo do POP-COB-001, gravado no Protheus em 19/11/2026.
   Texto com **negrito**; imagens em /public/tutorial.
───────────────────────────────────────────────────────────── */

export const SISTEMA = {
  portal:   { nome: 'Portal',     cor: '#1E4DB7', bg: 'rgba(30,77,183,0.09)' },
  protheus: { nome: 'Protheus',   cor: '#0F1923', bg: '#EEF0F3' },
  financ:   { nome: 'Financeiro', cor: '#B45309', bg: 'rgba(217,119,6,0.11)' },
};

export const GRUPOS = [
  { k: 'portal',   titulo: 'No portal' },
  { k: 'pedido',   titulo: 'Pedido no Protheus' },
  { k: 'nf',       titulo: 'Liberar e faturar' },
  { k: 'envio',    titulo: 'Enviar' },
];

const img = (arq, legenda) => ({ src: `/tutorial/${arq}.webp`, legenda });

export const PASSOS = [
  {
    grupo: 'portal', sistema: 'portal', onde: 'Cobranças › Notas a cobrar',
    titulo: 'Escolha as notas que vão na mesma NF de débito',
    texto: [
      'Na lista da esquerda, clique no transportador. Marque **até 3 notas** do **mesmo transportador, mesma filial e mesmo motivo**. Clientes diferentes podem ir juntos.',
      'Use o filtro **Canais**, no alto, para ver só os canais que você atende. A escolha fica salva no seu usuário.',
    ],
    imagens: [img('11-portal-notas', 'Nota marcada e o botão Montar NF de débito na barra de baixo.')],
  },
  {
    grupo: 'portal', sistema: 'portal', onde: 'Barra de baixo › Montar NF de débito',
    titulo: 'Monte a NF de débito e deixe a tela aberta',
    texto: [
      'Clique em **Montar NF de débito**. Abre a tela com tudo o que vai ser digitado no Protheus, com o botão **copiar** em cada valor.',
      'No quadro de notas, o número grande é a **NFD** (nota de devolução do cliente). A **NF de venda** aparece embaixo, em cinza.',
    ],
    atencao: 'Se aparecer o quadro amarelo "Atenção antes de salvar o pedido", resolva antes de ir ao Protheus.',
    imagens: [img('12-portal-modal', 'Observação pronta, uma linha por produto e o campo do nº do pedido.')],
  },
  {
    grupo: 'pedido', sistema: 'protheus', onde: 'Tela de abertura do Protheus',
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
    grupo: 'pedido', sistema: 'protheus', onde: 'Atualizações › Pedidos › Pedidos de Venda',
    titulo: 'Abra Pedidos de Venda e clique em Incluir',
    texto: ['No menu da esquerda, abra **Pedidos** e depois **Pedidos de Venda**. Na tela que abrir, clique em **Incluir**.'],
    imagens: [img('02-menu', 'Pedidos de Venda no menu e o atalho Incluir.')],
  },
  {
    grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › campo Cliente',
    titulo: 'Busque o transportador pelo CNPJ',
    texto: [
      'Clique na **lupa** do campo Cliente. Cole o CNPJ (copiado do portal, só números) em **Pesquisar**, clique na linha do transportador e em **OK**.',
      'Nome, loja, condição de pagamento, tabela e tipo de frete se preenchem sozinhos. Não precisa mexer.',
    ],
    imagens: [img('03-cliente', 'Consulta de cliente pesquisada pelo CNPJ.')],
  },
  {
    grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › cabeçalho',
    titulo: 'Preencha Operação e Dt. Entrega',
    campos: [
      ['Operacao', '50', 'Venda de mercadoria'],
      ['Dt. Entrega', 'hoje + 10 dias', 'Dias corridos. A tela da NF de débito mostra a data pronta'],
    ],
    imagens: [img('04-cabecalho', 'Cabeçalho preenchido (laranja).')],
  },
  {
    grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › Mens.p/ Nota',
    titulo: 'Cole a observação em Mens.p/ Nota',
    texto: [
      'Role os campos do cabeçalho até **Mens.p/ Nota** e cole o texto copiado do portal. Ele segue o padrão curto, porque o campo tem limite: `Ref Cob Avaria NFD 969576;1806008`.',
    ],
    atencao: 'Não use o campo OBSERVACAO, que fica logo abaixo. A mensagem da nota fiscal é a Mens.p/ Nota.',
    imagens: [img('05-mensnota', 'Mens.p/ Nota preenchida; OBSERVACAO fica vazio.')],
  },
  {
    grupo: 'pedido', sistema: 'protheus', onde: 'Pedido de venda › linhas',
    titulo: 'Inclua uma linha para cada produto',
    texto: [
      'Para cada linha do portal, digite **Produto**, **Quantidade** e **Prc Unitario**. Depois corrija três colunas que o Protheus preenche com outro valor:',
    ],
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
    grupo: 'nf', sistema: 'portal', onde: 'Protheus › Salvar  →  Portal › Passo 3',
    titulo: 'Salve o pedido e registre o número no portal',
    texto: [
      'No Protheus, clique em **Salvar** e anote o **Numero** do pedido (topo do cabeçalho).',
      'No portal, no **Passo 3** da NF de débito, digite o número e clique em **Registrar pedido**.',
    ],
  },
  {
    grupo: 'nf', sistema: 'protheus', onde: 'Pedidos › Liberação de Pedidos de Venda',
    titulo: 'Libere o pedido',
    texto: ['Pesquise o número do pedido, clique na linha dele e em **Liberar**. Na tela que abrir, clique em **Salvar**.'],
    imagens: [img('07-liberacao', 'Barra de pesquisa e o botão Liberar.')],
  },
  {
    grupo: 'nf', sistema: 'financ', onde: 'Pedidos de Venda › Prep.doc.saída',
    titulo: 'Bolinha branca? Peça a liberação ao financeiro',
    texto: [
      'Volte em **Pedidos de Venda** e procure o pedido. **Bolinha branca** = regra de crédito: peça ao financeiro para liberar.',
      'Liberado, selecione o pedido e use **Prep.doc.saída**. Siga o assistente com **Avançar**. Ao final o Protheus gera o **número da NF**.',
    ],
    imagens: [
      img('08-bolinha', 'Pedido com bolinha branca: aguardando o financeiro.'),
      img('09-assistente', 'Assistente do Prep.doc.saída.'),
    ],
  },
  {
    grupo: 'envio', sistema: 'protheus', onde: 'Nf-e e Nfs-e › NF-e Sefaz',
    titulo: 'Registre a NF no portal e baixe o PDF',
    texto: [
      'No portal, **Passo 4**: digite o nº da NF de débito e clique em **Registrar NF de débito**. As notas ficam como cobradas.',
      'No Protheus, abra **NF-e Sefaz**, pesquise a NF e abra o DANFE. Parâmetros: da nota / até a nota = número da NF, **Série 2**, **NF Saída**. Na janela DANFE, escolha **Microsoft Print to PDF** e destino **Local**, e salve o arquivo.',
    ],
    imagens: [img('10-danfe', 'Janela DANFE: Microsoft Print to PDF e destino Local.')],
  },
  {
    grupo: 'envio', sistema: 'portal', onde: 'Cobranças › NFs de débito',
    titulo: 'Envie ao transportador e marque como enviada',
    texto: [
      'Baixe a relação das notas em Excel: **Baixar relação só desta NF** (Passo 5) ou, para várias do mesmo transportador, marque todas em **NF de débito emitida** e clique em **Baixar relação única (Excel)**.',
      'Envie o PDF de cada NF e a relação. Depois clique em **Marcar como enviada** (ou **Marcar todas como enviadas**). Pronto.',
    ],
  },
];
