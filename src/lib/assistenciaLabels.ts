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
// continua exclusivo de assistência/admin. Envio de peça é criado pelo SAC
// como intake (ver SAC_REQUEST_TYPES em actions.ts, mesmo padrão de
// montagem), mas quem executa e gerencia depois é a assistência -- é ela
// quem manda a peça, com motorista e rota, só que o pedido nasce no SAC.
export const SAC_MANAGED_TYPES = ["troca_produto", "entrega_produto", "notificacao_externa"] as const;

// Complemento de SAC_MANAGED_TYPES — únicos tipos que o papel "assistencia"
// gerencia (admin continua com acesso total aos dois grupos, como supervisão).
export const ASSISTENCIA_MANAGED_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria", "envio_peca"] as const;

// Tipos que saem de fato com motorista, em rota (praia/sul/centro) --
// cruza os dois grupos acima (troca/entrega de produto são SAC, envio de
// peça é assistência, mas os três usam motorista e rota do mesmo jeito).
// Montagem/desmontagem/vistoria/troca de peça são visita de montador e não
// têm rota -- são dois mundos que não se comunicam, mesmo os dois tendo
// "data agendada".
export const DELIVERY_REQUEST_TYPES = ["troca_produto", "entrega_produto", "envio_peca"] as const;

// Vistoria e troca de peça exigem confiança/qualificação que só um
// funcionário de verdade tem — hoje só o Manoel; os outros montadores são
// terceirizados só pra montagem/desmontagem/recolhimento.
export const MANOEL_ONLY_TYPES = ["vistoria", "troca_peca"] as const;
export const MANOEL_ONLY_ASSEMBLER = "Manoel";

// Definir valor unitário, autorizar e liberar pagamento de montagem,
// desmontagem, vistoria e afins é exclusivo dessa pessoa -- nem outro admin
// consegue, por pedido explícito do Victor (dono do sistema).
export const PAYMENTS_CONTROLLER_NAME = "Antonio";

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
