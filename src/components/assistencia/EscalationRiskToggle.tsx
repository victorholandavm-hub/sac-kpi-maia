"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEscalationRisk } from "@/app/assistencia/actions";

export function EscalationRiskToggle({ requestId, atRisk }: { requestId: string; atRisk: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setEscalationRisk(requestId, !atRisk);
      router.refresh();
    });
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
