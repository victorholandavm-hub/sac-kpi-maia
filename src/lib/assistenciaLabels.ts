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
};

export const PEDIDO_ENCOMENDA_STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  em_producao: "Em produção",
  pronto_para_expedicao: "Pronto para expedição",
  em_carga: "Em carga",
  faturado: "Faturado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  negado: "Negado",
};

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

// Únicos tipos de chamado que o papel SAC pode gerenciar (ver dal.ts
// requireManageAccess) — o resto da fila (montagem, troca_peça etc.)
// continua exclusivo de assistência/admin.
export const SAC_MANAGED_TYPES = ["troca_produto", "entrega_produto", "envio_peca", "notificacao_externa"] as const;

// Complemento de SAC_MANAGED_TYPES — únicos tipos que o papel "assistencia"
// gerencia (admin continua com acesso total aos dois grupos, como supervisão).
export const ASSISTENCIA_MANAGED_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"] as const;

// Vistoria e troca de peça exigem confiança/qualificação que só um
// funcionário de verdade tem — hoje só o Manoel; os outros montadores são
// terceirizados só pra montagem/desmontagem/recolhimento.
export const MANOEL_ONLY_TYPES = ["vistoria", "troca_peca"] as const;
export const MANOEL_ONLY_ASSEMBLER = "Manoel";

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
