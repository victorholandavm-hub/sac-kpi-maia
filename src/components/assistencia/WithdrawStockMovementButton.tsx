"use client";

import { useState } from "react";
import { withdrawStockMovement } from "@/app/assistencia/estoque-actions";
import { useQuickAction } from "./useQuickAction";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Dar baixa" -- pedido do Victor 28/08/2026: "Assistencia registra e a
// equipe tecnica é que retira do estoque e lança a data que foi
// retirada" (esclarecido 01/09/2026: quem retira o produto fisicamente
// do CD é a assistência -- esse botão é a equipe técnica confirmando que
// essa saída já foi lançada no Protheus, e informando a data desse
// lançamento). Mesmo padrão de "pede um dado extra antes de confirmar"
// já usado em TecnicoItemDestino.tsx (mostruario/em_observacao/outro) --
// aqui o dado extra é a data do lançamento no Protheus (defaulta pra
// hoje).
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
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-800 hover:border-gray-300 focus:border-gray-300 focus:outline-none transition-colors duration-150"
          autoFocus
        />
        {/* Primário -- Guia de Componentes Maia (Design System,
            01/09/2026): sombra sutil, hover:brightness-110. */}
        <button
          type="button"
          disabled={pending || !date}
          onClick={() => run(() => withdrawStockMovement(movementId, date), "Baixa registrada -- confirmado o lançamento no Protheus.")}
          className="text-xs rounded-lg px-3 py-1.5 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
          style={{ background: "#1B5E3C" }}
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="text-xs font-medium rounded-md px-2 py-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors duration-150"
        >
          cancelar
        </button>
      </div>
    );
  }

  return (
    // Primário -- Guia de Componentes Maia (Design System, 01/09/2026):
    // sombra sutil, hover:brightness-110. Pedido do Victor 01/09/2026:
    // "esse botão de dar baixa precisa estar na cor verde" -- mesmo
    // padrão do botão "Confirmar" logo acima, não conflita com ele
    // porque nunca aparecem ao mesmo tempo (um vira o outro ao clicar).
    <button
      type="button"
      disabled={pending}
      onClick={() => setPicking(true)}
      className="text-xs rounded-lg px-3 py-1.5 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60 shrink-0 whitespace-nowrap"
      style={{ background: "#1B5E3C" }}
    >
      Dar baixa
    </button>
  );
}
