"use client";

import { setEscalationRisk } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

export function EscalationRiskToggle({ requestId, atRisk }: { requestId: string; atRisk: boolean }) {
  const { pending, run } = useQuickAction();

  function toggle() {
    run(
      () => setEscalationRisk(requestId, !atRisk),
      atRisk ? "Risco de escalonamento removido." : "Marcado como risco de escalonamento."
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="text-xs font-medium px-2.5 py-1 rounded-full border disabled:opacity-60 whitespace-nowrap"
      style={{
        color: atRisk ? "var(--status-critical)" : "var(--text-secondary)",
        borderColor: atRisk ? "var(--status-critical)" : "var(--border)",
      }}
    >
      {atRisk ? "⚠ Risco de escalonamento" : "Marcar risco de escalonamento"}
    </button>
  );
}
