"use client";

import { assignEntregaRiscoAction } from "@/app/assistencia/entregas-risco-actions";
import { useQuickAction } from "./useQuickAction";
import type { EntregaRiscoAssignedTo, EntregaRiscoAtendente } from "@/lib/entregasRisco";

export function EntregaRiscoAssignField({
  pedido,
  filialVenda,
  assignedTo,
  atendentes,
}: {
  pedido: string;
  filialVenda: string;
  assignedTo: EntregaRiscoAssignedTo | null;
  atendentes: EntregaRiscoAtendente[];
}) {
  const { pending, run } = useQuickAction();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--text-muted)" }}>Atendente:</span>
      <select
        disabled={pending}
        value={assignedTo?.id ?? ""}
        onChange={(e) => {
          const value = e.target.value || null;
          const nome = atendentes.find((a) => a.id === value)?.fullName;
          run(
            () => assignEntregaRiscoAction(pedido, filialVenda, value),
            value ? `Atribuído a ${nome}.` : "Atribuição removida."
          );
        }}
        className="rounded border px-2 py-1 text-sm disabled:opacity-60"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        <option value="">Não atribuído</option>
        {atendentes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}
