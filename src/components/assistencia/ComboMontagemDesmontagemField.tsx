"use client";

import { setComboMontagemDesmontagem } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

// Só aparece pra montagem/desmontagem — deixa ligar/desligar a necessidade
// complementar (montagem<->desmontagem) num chamado já criado, caso a loja
// tenha esquecido de marcar ou a assistência perceba depois.
export function ComboMontagemDesmontagemField({
  requestId,
  type,
  value,
}: {
  requestId: string;
  type: string;
  value: boolean;
}) {
  const { pending, run } = useQuickAction();
  if (type !== "montagem" && type !== "desmontagem") return null;

  const complemento = type === "montagem" ? "desmontagem do móvel antigo" : "montagem do móvel novo";

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        Também precisa de {complemento} nessa visita:{" "}
        <span style={{ fontWeight: 600, color: value ? "var(--brand-orange)" : "var(--text-muted)" }}>
          {value ? "Sim" : "Não"}
        </span>
      </span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => setComboMontagemDesmontagem(requestId, !value),
            value ? "Removido." : "Adicionado."
          )
        }
        className="text-xs underline shrink-0 disabled:opacity-60"
        style={{ color: "var(--text-secondary)" }}
      >
        {value ? "remover" : "adicionar"}
      </button>
    </div>
  );
}
