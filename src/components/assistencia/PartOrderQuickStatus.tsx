"use client";

import { updatePartOrderStatus } from "@/app/assistencia/pecas-actions";
import { PART_ORDER_STATUSES } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { useQuickAction } from "./useQuickAction";

// Atualizar o status direto na lista, sem abrir o pedido -- pedido do Victor
// 09/09/2026: "as atualizações precisam poder ser feitas sem entrar em cada
// uma, eu só precisaria entrar em cada uma para ver detalhado". Reaproveita
// a mesma updatePartOrderStatus de PartOrderActions.tsx (já cuida de
// carimbar part_arrived_at/sent_to_client_at/closed_at conforme o status) --
// só um jeito novo de chamá-la. Select livre entre TODOS os status (não só
// os "próximos" de PartOrderActions.tsx) -- na lista é mais útil poder
// corrigir/voltar um status errado direto do que seguir um fluxo linear.
export function PartOrderQuickStatus({ orderId, status }: { orderId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const color = PART_ORDER_STATUS_COLORS[status] ?? "var(--text-muted)";

  return (
    <select
      value={status}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value;
        if (next === status) return;
        run(() => updatePartOrderStatus(orderId, next), `Status atualizado para ${PART_ORDER_STATUS_LABELS[next] ?? next}.`);
      }}
      className="text-xs font-semibold rounded-full pl-2.5 pr-1.5 py-1 border-0 disabled:opacity-60 cursor-pointer"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      {PART_ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PART_ORDER_STATUS_LABELS[s] ?? s}
        </option>
      ))}
    </select>
  );
}
