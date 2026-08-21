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

// Divisão em 3 baldes (rota/data) -- pedido do Victor 21/08/2026: "dentro
// da aba de cada rota... preciso que fique dividido em programado,
// concluido, cancelado e o numero ao lado de cada status" + follow-up:
// "precisa estar dentro de cada coluna" (não só a contagem -- os
// chamados de verdade, organizados em 3 colunas). Mesmos 3 baldes do badge
// acima -- "Não programado" conta junto de "Programado" aqui, só pra bater
// exatamente com os 3 nomes pedidos. Compartilhado entre NotificacoesList.tsx
// (SAC/admin) e AssistenciaQueueGroup.tsx (aba Entregas, admin/assistência)
// -- mesma regra, um lugar só.
export type DeliveryStatusBucket = "programado" | "concluido" | "cancelado";

export function deliveryStatusBucket(status: string): DeliveryStatusBucket {
  if (status === "concluida") return "concluido";
  if (status === "cancelada") return "cancelado";
  return "programado";
}

// Cor de cada coluna -- mesmo tom já usado no badge por chamado acima
// (verde = programado, "status-good" = concluído; cancelado usa um tom
// neutro, já que a badge original também é neutra/cinza).
export const DELIVERY_STATUS_COLUMNS: { key: DeliveryStatusBucket; label: string; color: string }[] = [
  { key: "programado", label: "Programado", color: "var(--brand-green)" },
  { key: "concluido", label: "Concluído", color: "var(--status-good)" },
  { key: "cancelado", label: "Cancelado", color: "var(--text-muted)" },
];

export function partitionByDeliveryStatus<T extends { status: string }>(items: T[]): Record<DeliveryStatusBucket, T[]> {
  const result: Record<DeliveryStatusBucket, T[]> = { programado: [], concluido: [], cancelado: [] };
  for (const r of items) result[deliveryStatusBucket(r.status)].push(r);
  return result;
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
