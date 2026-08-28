"use client";

import { useState } from "react";
import { withdrawStockMovement } from "@/app/assistencia/estoque-actions";
import { useQuickAction } from "./useQuickAction";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Dar baixa" -- pedido do Victor 28/08/2026: "Assistencia registra e a
// equipe tecnica é que retira do estoque e lança a data que foi
// retirada". Mesmo padrão de "pede um dado extra antes de confirmar" já
// usado em TecnicoItemDestino.tsx (mostruario/em_observacao/outro) --
// aqui o dado extra é a data de retirada (defaulta pra hoje).
export function WithdrawStockMovementButton({ movementId }: { movementId: string }) {
  const { pending, run } = useQuickAction();
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(today());

  if (picking) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-xs rounded border px-2 py-1"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <button
          type="button"
          disabled={pending || !date}
          onClick={() => run(() => withdrawStockMovement(movementId, date), "Baixa registrada -- retirado do CD.")}
          className="text-xs rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => setPicking(true)}
      className="text-xs rounded-full px-3 py-1.5 font-medium border disabled:opacity-60 shrink-0 whitespace-nowrap"
      style={{ borderColor: "var(--brand-green)", color: "var(--brand-green)" }}
    >
      Dar baixa
    </button>
  );
}
