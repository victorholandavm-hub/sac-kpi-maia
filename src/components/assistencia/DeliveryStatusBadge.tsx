// Status de montagem/desmontagem (aberta/em_contato/em_andamento/remarcar)
// não dizem nada de útil pra troca/entrega/envio de peça -- essas
// solicitações não passam por negociação de agenda como uma visita, só
// saem numa rota e acabou (pedido do Victor 19/08/2026: "não faz muito
// sentido ter os mesmos status de montagem, precisa apenas saber se já
// está programado e concluído"). Derivado dos campos que já existem
// (scheduledDate/rota), sem mexer no status real por trás -- o histórico
// do chamado e os KPIs continuam usando o status de verdade normalmente.
// Compartilhado entre a lista (NotificacoesList) e o detalhe do chamado
// (DeliveryRequestDetailContent) -- os dois usam DELIVERY_REQUEST_TYPES.
export function isDeliveryScheduled(scheduledDate: string | null, rota: string | null): boolean {
  return !!scheduledDate && !!rota;
}

// Contagem por status dentro de um grupo (rota/data) -- pedido do Victor
// 21/08/2026: "dentro da aba de cada rota... preciso que fique dividido em
// programado, concluido, cancelado e o numero ao lado de cada status".
// Mesmos 3 baldes do badge acima -- "Não programado" conta junto de
// "Programado" aqui, só pra bater exatamente com os 3 nomes pedidos.
// Compartilhado entre NotificacoesList.tsx (SAC/admin) e fila/page.tsx
// (aba Entregas, admin/assistência) -- mesma regra, um lugar só.
export type DeliveryStatusCounts = { programado: number; concluido: number; cancelado: number };

export function countByDeliveryStatus(items: { status: string }[]): DeliveryStatusCounts {
  const counts: DeliveryStatusCounts = { programado: 0, concluido: 0, cancelado: 0 };
  for (const r of items) {
    if (r.status === "concluida") counts.concluido++;
    else if (r.status === "cancelada") counts.cancelado++;
    else counts.programado++;
  }
  return counts;
}

export function DeliveryStatusBadge({
  status,
  scheduledDate,
  rota,
}: {
  status: string;
  scheduledDate: string | null;
  rota: string | null;
}) {
  if (status === "concluida") {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: "#fff", background: "var(--status-good)" }}>
        Concluído
      </span>
    );
  }
  if (status === "cancelada") {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}
      >
        Cancelada
      </span>
    );
  }
  // Pedido do Victor 31/08/2026: "o motorista ja consegue colocar como nao
  // consegui concluir, porem, na tela de acompanhamento nao tem nenhum
  // status de nao concluida" -- driverReportIssue (driver-actions.ts) já
  // gravava status='remarcar' certinho, só esse badge (pensado só pra
  // programado/concluído/cancelado, ver comentário no topo do arquivo)
  // não tinha um caso pra ele -- caía em "Programado"/"Não programado"
  // pela data agendada, escondendo que o motorista já tentou e não
  // conseguiu. Cor igual à de STATUS_COLORS.remarcar (StatusBadge.tsx,
  // resto do sistema), pra não inventar um vermelho novo.
  if (status === "remarcar") {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ color: "#fff", background: "var(--status-critical)" }}
      >
        Não concluída
      </span>
    );
  }
  const scheduled = isDeliveryScheduled(scheduledDate, rota);
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        color: scheduled ? "#fff" : "var(--text-primary)",
        background: scheduled ? "var(--brand-green)" : "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))",
      }}
    >
      {scheduled ? "Programado" : "Não programado"}
    </span>
  );
}
