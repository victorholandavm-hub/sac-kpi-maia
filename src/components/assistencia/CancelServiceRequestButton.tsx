"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelServiceRequestByGerente } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

export function CancelServiceRequestButton({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  if (!showCancel) {
    return (
      <button
        onClick={() => setShowCancel(true)}
        className="text-sm underline self-start pt-2"
        style={{ color: "var(--status-critical)", borderTop: "1px solid var(--gridline)" }}
      >
        Cancelar chamado
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Motivo do cancelamento…"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--status-critical)" }}
      />
      <div className="flex items-center gap-2">
        <button
          disabled={pending || !reason.trim()}
          onClick={() =>
            run(async () => {
              await cancelServiceRequestByGerente(requestId, reason);
              router.push("/assistencia/loja");
            }, "Chamado cancelado.")
          }
          className="text-sm rounded px-3 py-2 disabled:opacity-60"
          style={{ background: "var(--status-critical)", color: "#fff" }}
        >
          Confirmar cancelamento
        </button>
        <button onClick={() => setShowCancel(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar
        </button>
      </div>
    </div>
  );
}
