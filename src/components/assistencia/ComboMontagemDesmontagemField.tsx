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
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <span className="text-sm text-gray-800">
        Também precisa de {complemento} nessa visita: <span className="font-semibold">{value ? "Sim" : "Não"}</span>
      </span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => setComboMontagemDesmontagem(requestId, !value),
            value ? "Removido." : "Adicionado."
          )
        }
        className="text-xs underline shrink-0 text-gray-500 hover:text-gray-700 disabled:opacity-60"
      >
        {value ? "remover" : "adicionar"}
      </button>
    </div>
  );
}
