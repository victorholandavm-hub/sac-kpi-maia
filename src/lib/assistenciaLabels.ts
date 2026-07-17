export const REQUEST_TYPE_LABELS: Record<string, string> = {
  montagem: "Montagem",
  desmontagem: "Desmontagem",
  recolhimento: "Recolhimento de peça",
  troca_peca: "Troca de peça",
  vistoria: "Vistoria",
  notificacao_externa: "Notificação externa",
};

export const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_contato: "Em contato",
  em_andamento: "Em andamento",
  remarcar: "Remarcar",
  concluida: "Concluída",
  cancelada: "Cancelada",
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
  gerente: "Gerente de loja",
  assistencia: "Assistência",
  admin: "Administrador",
};
