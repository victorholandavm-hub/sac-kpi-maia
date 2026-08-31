export const REQUEST_TYPE_LABELS: Record<string, string> = {
  montagem: "Montagem",
  desmontagem: "Desmontagem",
  recolhimento: "Recolhimento de peça",
  troca_peca: "Troca de peça",
  vistoria: "Vistoria",
  notificacao_externa: "Notificação externa",
  troca_produto: "Troca de produto",
  entrega_produto: "Entrega de produto",
  envio_peca: "Envio de peça",
  recolhimento_produto: "Recolhimento de produto",
};

// Rótulo específico pra tela do motorista -- pedido do Victor 18/08/2026:
// mais claro do que o genérico REQUEST_TYPE_LABELS pra quem tá decidindo o
// que fazer na porta do cliente. Troca sempre envolve recolher o produto
// com defeito junto (só troca_produto tem recolhimento de verdade); envio
// de peça pode ser tanto recolher a peça com problema quanto entregar a
// nova, por isso os dois nomes juntos.
export const DRIVER_TYPE_LABELS: Record<string, string> = {
  troca_produto: "Troca com recolhimento",
  entrega_produto: "Entrega",
  envio_peca: "Recolhimento ou entrega de peça",
  recolhimento: "Recolhimento de peça",
  recolhimento_produto: "Recolhimento de produto",
};

// Cor suave por tipo de visita -- só usado na agenda (ver AgendaQueueGroup),
// pra diferenciar a natureza do serviço batendo o olho, sem precisar ler o
// texto do tipo.
export const REQUEST_TYPE_COLORS: Record<string, string> = {
  montagem: "var(--series-1)",
  desmontagem: "var(--series-2)",
  recolhimento: "var(--series-8)",
  troca_peca: "var(--series-5)",
  vistoria: "var(--series-3)",
};

export const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_contato: "Em contato",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação da loja",
  remarcar: "Remarcar",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Explicação em linguagem simples pro gerente de loja, que não conhece o
// fluxo interno da assistência — só os status que geram dúvida (aberta,
// concluída e cancelada já são autoexplicativos).
export const STATUS_DESCRIPTIONS: Partial<Record<string, string>> = {
  em_contato: "A assistência já viu a solicitação e está avaliando os detalhes antes de agendar o atendimento.",
  em_andamento: "Já tem um montador definido e o atendimento está em andamento.",
  // Pedido do Victor 31/08/2026: "a partir de agora, o gerente da loja vai
  // precisar aprovar essa conclusão". Ver montadorCompleteRequest/
  // montadorCompletePartially (montador-actions.ts) e
  // lojaApproveMontagemConclusion (loja-actions.ts).
  aguardando_aprovacao: "O montador marcou como concluído, esperando o gerente da loja confirmar que foi feito de verdade.",
};

// Caminho "feliz" da solicitação, pro StatusStepper -- remarcar (mostra em
// cima de "em_andamento", é uma variação dele) e cancelada (não é progresso,
// é saída) ficam de fora dessa sequência de propósito.
export const REQUEST_STATUS_STEPS: { key: string; label: string }[] = [
  { key: "aberta", label: "Aberta" },
  { key: "em_contato", label: "Em contato" },
  { key: "em_andamento", label: "Em andamento" },
  // Só passa por aqui de verdade montagem/desmontagem (ver
  // aguardando_aprovacao acima) -- pros outros tipos, que nunca têm esse
  // status, é só mais um degrau "no caminho feliz" que não se aplica, sem
  // efeito nenhum na tela deles.
  { key: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { key: "concluida", label: "Concluída" },
];

export const STATUS_COLORS: Record<string, string> = {
  aberta: "var(--status-warning)",
  em_contato: "var(--series-5)",
  em_andamento: "var(--brand-orange)",
  // Cor própria (amarelo/dourado) -- distinta de em_andamento (laranja) e
  // concluida (verde), os dois vizinhos mais próximos no fluxo.
  aguardando_aprovacao: "var(--series-3)",
  remarcar: "var(--status-critical)",
  concluida: "var(--status-good)",
  cancelada: "var(--text-muted)",
};

export const SHIFT_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  dia: "Dia",
};

export const DEADLINE_STATUS_LABELS: Record<string, string> = {
  pendente: "Prazo pendente de aprovação",
  aprovado: "Prazo aprovado",
  recusado: "Prazo recusado — nova data proposta",
};

export const PART_ORDER_STATUS_LABELS: Record<string, string> = {
  aguardando_peca: "Aguardando peça",
  peca_recebida: "Peça recebida",
  enviada_ao_cliente: "Enviada ao cliente",
  encerrado: "Encerrado",
};

export const PART_ORDER_STATUS_COLORS: Record<string, string> = {
  aguardando_peca: "var(--status-warning)",
  peca_recebida: "var(--series-5)",
  enviada_ao_cliente: "var(--brand-orange)",
  encerrado: "var(--status-good)",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  retirado: "Retirado do CD",
  devolvido: "Devolvido ao estoque",
  reparado: "Reparado",
};

export const ROLE_LABELS: Record<string, string> = {
  assistencia: "Assistência",
  admin: "Administrador",
  sac: "SAC",
  cd: "CD",
  fabrica: "Fábrica",
  loja: "Loja",
  caixa: "Caixa",
  gerente: "Gerente",
};

export const PEDIDO_ENCOMENDA_STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  em_producao: "Em produção",
  pronto_para_expedicao: "Enviado para o CD",
  em_carga: "Em carga",
  faturado: "Faturado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  negado: "Negado",
  recebido_cd: "Recebido pelo CD / Em estoque",
};

// Idem REQUEST_STATUS_STEPS, mas pro pedido de encomenda -- cancelado/negado
// ficam de fora (não são progresso, são saída).
export const PEDIDO_ENCOMENDA_STATUS_STEPS: { key: string; label: string }[] = [
  { key: "solicitado", label: "Solicitado" },
  { key: "em_producao", label: "Em produção" },
  { key: "pronto_para_expedicao", label: "Enviado CD" },
  { key: "em_carga", label: "Em carga" },
  { key: "faturado", label: "Faturado" },
  { key: "entregue", label: "Entregue" },
];

export const PEDIDO_ENCOMENDA_STATUS_COLORS: Record<string, string> = {
  solicitado: "var(--status-warning)",
  em_producao: "var(--series-5)",
  pronto_para_expedicao: "var(--brand-orange)",
  em_carga: "var(--brand-orange)",
  faturado: "var(--brand-green)",
  entregue: "var(--status-good)",
  cancelado: "var(--text-muted)",
  negado: "var(--status-critical)",
  recebido_cd: "var(--status-good)",
};

export const PEDIDO_FORNECEDOR_STATUS_LABELS: Record<string, string> = {
  pedido_feito: "Pedido feito",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export const PEDIDO_FORNECEDOR_STATUS_COLORS: Record<string, string> = {
  pedido_feito: "var(--status-warning)",
  recebido: "var(--status-good)",
  cancelado: "var(--text-muted)",
};

// Únicos tipos de chamado que o papel SAC pode gerenciar (ver dal.ts
// requireManageAccess) — o resto da fila (montagem, envio de peça etc.)
// continua exclusivo de assistência/admin. Envio de peça (e recolhimento de
// peça) são criados pelo SAC ou pela assistência como intake (ver
// SAC_REQUEST_TYPES/REQUEST_TYPES em actions.ts), mas quem executa e
// gerencia depois é sempre a assistência -- é ela quem manda a peça, com
// motorista e rota. "recolhimento_produto" (18/08/2026: SAC recolhe o
// produto do cliente sem entregar nada no lugar, ex.: devolução/
// cancelamento -- diferente de "recolhimento", que é de PEÇA) é só do SAC,
// nasce e é gerenciado por ele, mesmo padrão de troca_produto/entrega_produto.
export const SAC_MANAGED_TYPES = ["troca_produto", "entrega_produto", "recolhimento_produto", "notificacao_externa"] as const;

// Complemento de SAC_MANAGED_TYPES — únicos tipos que o papel "assistencia"
// gerencia (admin continua com acesso total aos dois grupos, como supervisão).
export const ASSISTENCIA_MANAGED_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria", "envio_peca"] as const;

// Pedido do Victor 27/08/2026 (achado por ele: "algumas notificações de
// assistencia os atendentes do sac nao estao conseguindo editar ou
// imprimir, sendo que para mim eu consigo" -- causa raiz era exatamente
// envio_peca/recolhimento ficarem só em ASSISTENCIA_MANAGED_TYPES, mesmo
// o SAC criando "Envio de peça" pela própria tela): "quero que o SAC
// também gerencie esses dois". SAC ganha permissão de editar/imprimir/
// trocar rota desses 2 tipos, SEM tirar da assistência (ela continua
// sendo quem despacha de verdade, motorista/rota -- ASSISTENCIA_MANAGED_TYPES
// não mudou). Deliberadamente um conjunto À PARTE de SAC_MANAGED_TYPES em
// vez de simplesmente somar ali -- SAC_MANAGED_TYPES também decide origem
// exibida (entregaQueueGrouping.ts/tecnico/page.tsx), fila da loja
// (loja/trocas.tsx, só sobre troca/entrega/recolhimento de PRODUTO) e
// quem é notificado por ação de motorista (driver-actions.ts); nenhum
// desses outros usos deveria mudar só porque o SAC ganhou permissão de
// EDITAR esses 2 tipos. Ver requireManageAccess (dal.ts),
// manageableTypesForRole abaixo, [id]/page.tsx, [id]/editar/page.tsx e
// DeliveryRequestDetailContent.tsx -- os únicos lugares que devem
// enxergar esse conjunto.
export const SAC_ALSO_MANAGED_TYPES = ["envio_peca", "recolhimento"] as const;

// Espelho de SAC_ALSO_MANAGED_TYPES, direção contrária -- pedido do
// Victor 27/08/2026: testou como Iasmyn (assistência) tentando editar
// "Entrega de produto" (Sheila #4948, Gilsa #4922) e não conseguiu --
// "voce disse que tinha ajustado isso" (o ajuste de SAC_ALSO_MANAGED_TYPES
// era só na direção SAC ganhar Envio/Recolhimento de peça, não mexia
// nisso). Confirmado: "os 3 tipos do SAC também" -- assistência ganha
// Troca/Entrega/Recolhimento de PRODUTO (os 3 tipos de entrega que
// continuavam exclusivos do SAC), sem tirar do SAC. Fora daqui de
// propósito: "notificacao_externa" -- não é tipo de entrega (sem
// motorista/rota, ver DELIVERY_REQUEST_TYPES abaixo), não tem por que a
// assistência mexer nisso. Mesmos 5 lugares de SAC_ALSO_MANAGED_TYPES
// (requireManageAccess/manageableTypesForRole/[id]/page.tsx/
// [id]/editar/page.tsx/DeliveryRequestDetailContent.tsx) precisam
// enxergar esse conjunto também.
export const ASSISTENCIA_ALSO_MANAGED_TYPES = ["troca_produto", "entrega_produto", "recolhimento_produto"] as const;

// União dos dois grupos acima -- todo tipo de chamado que existe hoje (mesmas
// chaves de REQUEST_TYPE_LABELS). Usado só pra oferecer a troca de tipo na
// edição do chamado (ver manageableTypesForRole) -- lista central pra não
// desalinhar de REQUEST_TYPE_LABELS de novo.
export const ALL_REQUEST_TYPES = [...SAC_MANAGED_TYPES, ...ASSISTENCIA_MANAGED_TYPES] as const;

// Pra quais tipos um papel pode TROCAR um chamado (ex: alguém abriu como
// "montagem" mas era "troca de peça") -- reaproveita o mesmo domínio de
// requireManageAccess (dal.ts): assistência só troca entre tipos que ela
// mesma gerencia, SAC só entre os dela, admin pode qualquer um. Sem isso a
// edição deixaria criar um chamado que o próprio papel que editou não
// consegue mais gerenciar depois (ver updateRequestDetails em actions.ts,
// que valida de novo no servidor com requireManageAccess -- isso aqui só
// monta a lista de opções mostradas na tela).
export function manageableTypesForRole(role: string): readonly string[] {
  if (role === "admin") return ALL_REQUEST_TYPES;
  // ASSISTENCIA_ALSO_MANAGED_TYPES (troca/entrega/recolhimento de
  // produto) -- ver comentário lá.
  if (role === "assistencia") return [...ASSISTENCIA_MANAGED_TYPES, ...ASSISTENCIA_ALSO_MANAGED_TYPES];
  // SAC_ALSO_MANAGED_TYPES (envio_peca/recolhimento) -- ver comentário lá.
  if (role === "sac") return [...SAC_MANAGED_TYPES, ...SAC_ALSO_MANAGED_TYPES];
  return [];
}

// Tipos que saem de fato com motorista, em rota (praia/sul/centro) --
// cruza os dois grupos acima (troca/entrega de produto são SAC, envio e
// recolhimento de peça são assistência, mas os quatro usam motorista e rota
// do mesmo jeito). Montagem/desmontagem/vistoria/troca de peça são visita de
// montador e não têm rota -- são dois mundos que não se comunicam, mesmo os
// dois tendo "data agendada".
//
// "recolhimento" entrou aqui em 18/08/2026 (pedido do Victor: "primeiro
// enviamos a peça pelo motorista e só depois que entra o montador") -- antes
// ficava com montagem/desmontagem/vistoria/troca_peça (visita de montador),
// mas na prática é o motorista quem vai buscar a peça na casa do cliente.
// Igual a envio_peca (mesmo padrão do SAC): o chamado de recolhimento em si
// não tem montador nenhum -- se depois de recolhida a peça for preciso um
// montador pra instalar/trocar algo, isso é um chamado à parte (montagem ou
// troca de peça), não uma etapa deste.
export const DELIVERY_REQUEST_TYPES = [
  "troca_produto",
  "entrega_produto",
  "envio_peca",
  "recolhimento",
  "recolhimento_produto",
] as const;

// O outro lado do corte acima -- montagem/desmontagem/vistoria/troca de
// peça, a "visita de montador" de verdade, sem rota nem motorista (aba
// "Visitas" de fila/page.tsx). Centralizado aqui em vez de recalculado onde
// é usado (era um filter local em fila/page.tsx) porque também vira o
// escopo do badge da aba "Solicitações" em AssistenciaNav -- pedido do
// Victor 21/08/2026: "só faz sentido aparecer ali o número de solicitações
// em aberto das montagens/desmontagens", não entrega/notificação (que tem
// badge própria, ver countEntregasOverview em serviceRequests.ts).
export const VISITA_REQUEST_TYPES = ASSISTENCIA_MANAGED_TYPES.filter(
  (t) => !(DELIVERY_REQUEST_TYPES as readonly string[]).includes(t)
);

// Vistoria e troca de peça exigem confiança/qualificação que só um
// funcionário de verdade tem — hoje só o Manoel; os outros montadores são
// terceirizados só pra montagem/desmontagem/recolhimento.
export const MANOEL_ONLY_TYPES = ["vistoria", "troca_peca"] as const;
export const MANOEL_ONLY_ASSEMBLER = "Manoel";

// Everton manda na expedição dos carros/produtos -- pedido do Victor
// 18/08/2026: login de motorista dele vê TODAS as rotas/solicitações
// (não só as próprias), com o motorista de cada uma visível, pra ele
// acompanhar a expedição inteira. Só visualização -- concluir/subir foto/
// reorganizar continuam exclusivos de quem está de fato na rota (ver
// driver-actions.ts, cada ação já trava por driver_name === quem chamou).
// Samuel entrou 19/08/2026 (pedido do Victor: "mesmo nível de acesso do
// Everton") -- mesma lista, mesmas regras, sem distinção entre os dois.
export const DISPATCH_SUPERVISOR_DRIVERS = ["Everton", "Samuel"];

// Definir valor unitário, autorizar e liberar pagamento de montagem,
// desmontagem, vistoria e afins é exclusivo dessa pessoa -- nem outro admin
// consegue, por pedido explícito do Victor (dono do sistema).
export const PAYMENTS_CONTROLLER_NAME = "Antonio";

// Lojas com montador próprio (Mamanguape/214, Campina Grande/216 -- ver
// listOwnStoreAssemblers em payments.ts). Montagem/desmontagem/vistoria
// dessas lojas é responsabilidade exclusiva delas: só a própria loja e os
// admins (papel admin + Antonio, ver canSeeOwnAssemblerStoreRequests em
// dal.ts) devem ver esses chamados -- nem outras lojas, nem o resto da
// assistência central enxergam. Pedido do Victor, 14/08/2026.
// Recolhimento/troca de peça/envio de peça ficam de fora -- continuam
// sendo atendimento central (ver MANOEL_ONLY_TYPES), não passam pelo
// montador da loja.
export const OWN_ASSEMBLER_STORE_IDS = ["214", "216"] as const;
export const OWN_ASSEMBLER_RESTRICTED_TYPES = ["montagem", "desmontagem", "vistoria"] as const;

export const SUPPLIER_RETURN_STATUS_LABELS: Record<string, string> = {
  aguardando_envio: "Aguardando envio",
  enviado: "Enviado ao fornecedor",
  recebido: "Recebido pelo fornecedor",
  reembolsado: "Reembolsado",
  finalizado: "Finalizado",
};

export const SUPPLIER_RETURN_STATUS_COLORS: Record<string, string> = {
  aguardando_envio: "var(--status-warning)",
  enviado: "var(--series-5)",
  recebido: "var(--brand-orange)",
  reembolsado: "var(--status-good)",
  finalizado: "var(--text-muted)",
};

export const ENTREGA_RISCO_NIVEL_LABELS: Record<string, string> = {
  alerta: "Alerta",
  acompanhamento: "Acompanhamento",
};

export const ENTREGA_RISCO_NIVEL_COLORS: Record<string, string> = {
  alerta: "var(--status-critical)",
  acompanhamento: "var(--status-warning)",
};

export const ARSENAL_CATEGORY_LABELS: Record<string, string> = {
  contatos_internos: "Contatos internos",
  fornecedores: "Fornecedores e fabricantes",
  processos: "Processos de atendimento",
  garantias: "Prazos de garantia",
  cdc: "Código de Defesa do Consumidor",
};

// Cor de identidade por categoria -- reaproveita a paleta categórica que já
// existe pros gráficos (--series-1..8 em globals.css) em vez de inventar
// tom novo, só pra dar "escaneabilidade" rápida (pill de filtro e cabeçalho
// da seção usam a mesma cor da categoria).
export const ARSENAL_CATEGORY_COLORS: Record<string, string> = {
  contatos_internos: "var(--series-5)",
  fornecedores: "var(--series-8)",
  processos: "var(--brand-green)",
  garantias: "var(--series-2)",
  cdc: "var(--series-4)",
};

export const ARSENAL_HIGHLIGHT_LABELS: Record<string, string> = {
  regra_ouro: "Regra de ouro",
  atencao: "Atenção",
};

export const ARSENAL_HIGHLIGHT_COLORS: Record<string, string> = {
  regra_ouro: "var(--status-warning)",
  atencao: "var(--status-critical)",
};

// Causa raiz da troca de produto (SAC, troca_produto) -- quando é
// "erro_conferencia", carga + conferente viram obrigatórios na criação;
// quando é "erro_motorista", carga + motorista (ver createSacRequest e
// SacCreateRequestForm.tsx). Registrado à parte do "Motivo" (texto livre):
// motivo é o que aconteceu em palavras, causa raiz é pra quem apurar depois
// conseguir filtrar/cobrar por origem do erro (loja/vendedor/SAC/
// conferência/motorista/etc. -- ver relatório em /assistencia/relatorios).
//
// "erro_conferencia" e "erro_motorista" eram uma causa só ("erro_cd") até
// 14/08/2026 -- separadas por pedido do usuário, pra dar pra medir as duas
// coisas de forma independente (ver 0080_causa_raiz_conferencia_motorista.sql,
// nenhuma linha existente usava "erro_cd" ainda, migration sem backfill).
export const CAUSA_RAIZ_OPTIONS = [
  "erro_conferencia",
  "erro_motorista",
  "erro_loja",
  "erro_vendedor",
  "erro_sac",
  "avaria_transporte",
  "defeito_fabricacao",
  // Opção nova -- pedido do Victor 29/08/2026: "muitas notificações de
  // assistencia tem 'entregar peça' mas quando vai pra classificação na
  // tela de kpis, nao sei se foi peça avariada ou se só faltou entregar
  // a peça". Antes disso, quem criava um "Envio de peça" só tinha
  // avaria_transporte/defeito_fabricacao pra escolher mesmo quando a peça
  // em si nunca teve NENHUM problema físico -- só não foi incluída na
  // entrega original (esquecimento na expedição/conferência da venda).
  // Confirmado via SQL 29/08/2026: das 59 solicitações de envio de peça
  // até então, 56 estavam em "defeito_fabricacao" -- bem mais provável
  // que boa parte disso fosse na verdade peça esquecida, forçada na
  // opção mais parecida por falta de uma melhor, distorcendo o KPI de
  // "quem errou". Classificada como erro interno (ver
  // CAUSA_RAIZ_ERRO_INTERNO abaixo) -- é sempre uma falha de processo
  // (conferência/expedição não bateu o kit completo antes de enviar),
  // nunca um defeito do fabricante ou do transporte.
  "peca_nao_entregue",
  // Opção nova -- pedido do Victor 29/08/2026: "existe um outro problema
  // tambem que é em relação aos produtos que foram entregues sujos x
  // entregues avariados de fabrica, pois isso diferencia se o problema é
  // de armazenamento/conferencia no CD ou se é defeito da fabricação".
  // Antes disso, "sujo"/"manchado"/"mofado" não tinha causa própria --
  // investigação via SQL 29/08/2026 achou 8 chamados com esse tipo de
  // motivo, espalhados em 3 causas raiz DIFERENTES (3x erro_conferencia,
  // 2x outro, 3x defeito_fabricacao) -- sem padrão nenhum, cada um
  // escolhia o que parecia mais perto por falta de opção certa. Sujeira/
  // mofo/mancha é sintoma de armazenamento inadequado (umidade, produto
  // empilhado errado, tempo parado demais no CD antes de sair) -- nunca
  // saiu da fábrica assim, então virar "defeito_fabricacao" mascarava um
  // problema que é da própria operação do CD, não do fabricante.
  "armazenamento_cd",
  "solicitacao_cliente",
  "outro",
] as const;

export const CAUSA_RAIZ_LABELS: Record<string, string> = {
  erro_conferencia: "Erro de conferência (produto errado saiu do CD por má conferência)",
  erro_motorista: "Erro do motorista",
  erro_loja: "Erro da loja",
  erro_vendedor: "Erro do vendedor",
  erro_sac: "Erro do SAC",
  avaria_transporte: "Avaria no transporte",
  defeito_fabricacao: "Defeito de fabricação",
  peca_nao_entregue: "Peça não entregue na venda (esqueceram de mandar, peça em si sem problema nenhum)",
  armazenamento_cd: "Produto sujo/manchado/mofado (armazenamento no CD, não é defeito de fábrica)",
  solicitacao_cliente: "Solicitação do cliente (desistência/arrependimento)",
  outro: "Outro",
};

// Causas que são retrabalho interno (alguém do time errou), em vez de algo
// externo (transporte, fábrica) ou uma decisão legítima do cliente -- pedido
// do Victor 22/08/2026: "Destaque os erros operacionais internos... com
// badges amarelas/vermelhas para chamar a atenção da gestão para o
// retrabalho interno". Usado no relatório (badge + cor no gráfico de rosca).
// "peca_nao_entregue"/"armazenamento_cd" entraram aqui 29/08/2026 --
// esquecimento e armazenamento inadequado são sempre falha de processo
// do próprio time (expedição/CD), nunca causa externa (transporte,
// fábrica) nem decisão do cliente.
export const CAUSA_RAIZ_ERRO_INTERNO: string[] = [
  "erro_conferencia",
  "erro_motorista",
  "erro_loja",
  "erro_vendedor",
  "erro_sac",
  "peca_nao_entregue",
  "armazenamento_cd",
];

export const SAC_CATEGORIES = [
  "atraso_entrega",
  "entrega_parcial",
  "produto_encomenda",
  "pedido_sinalizado_atraso",
  "cobranca_indevida",
  "produto_avaria",
  "cancelamento_estorno",
  "endereco_errado",
  "ameaca_procon",
] as const;

export const SAC_CATEGORY_LABELS: Record<string, string> = {
  atraso_entrega: "Atraso na entrega",
  entrega_parcial: "Entrega parcial",
  produto_encomenda: "Produto sob encomenda",
  pedido_sinalizado_atraso: "Pedido sinalizado para atrasar",
  cobranca_indevida: "Cobrança indevida / Serasa",
  produto_avaria: "Produto com avaria",
  cancelamento_estorno: "Cancelamento / estorno",
  endereco_errado: "Endereço errado / cliente ausente",
  ameaca_procon: "Ameaça de Procon/ReclameAqui",
};
