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
};

// Caminho "feliz" da solicitação, pro StatusStepper -- remarcar (mostra em
// cima de "em_andamento", é uma variação dele) e cancelada (não é progresso,
// é saída) ficam de fora dessa sequência de propósito.
export const REQUEST_STATUS_STEPS: { key: string; label: string }[] = [
  { key: "aberta", label: "Aberta" },
  { key: "em_contato", label: "Em contato" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
];

export const STATUS_COLORS: Record<string, string> = {
  aberta: "var(--status-warning)",
  em_contato: "var(--series-5)",
  em_andamento: "var(--brand-orange)",
  remarcar: "var(--status-critical)",
  concluida: "var(--status-good)",
  cancelada: "var(--text-muted)",
};

export const SHIFT_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  dia: "Dia",
  urgencia: "Urgência",
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
  if (role === "assistencia") return ASSISTENCIA_MANAGED_TYPES;
  if (role === "sac") return SAC_MANAGED_TYPES;
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
export const DISPATCH_SUPERVISOR_DRIVER = "Everton";

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
  solicitacao_cliente: "Solicitação do cliente (desistência/arrependimento)",
  outro: "Outro",
};

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
