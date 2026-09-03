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
      <span className="text-gray-400 dark:text-gray-500">Atendente:</span>
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
        className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150 disabled:opacity-60"
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
