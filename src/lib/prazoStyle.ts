import type { CSSProperties } from "react";

// Vermelho quando já venceu ou vence hoje/amanhã -- é a informação mais
// crítica pra quem despacha, não devia ter o mesmo peso visual de um prazo
// folgado. Compara só a data (sem hora, os campos de prazo são "date" puro).
// Compartilhado entre a lista (PedidoEncomendaFilaList.tsx) e o detalhe
// (encomendas/fila/[id]/page.tsx) do pedido de encomenda.
export function prazoUrgencyStyle(dateStr: string): CSSProperties {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prazo = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((prazo.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 1) return { color: "var(--status-critical)", fontWeight: 700 };
  return { color: "var(--status-good)", fontWeight: 600 };
}
