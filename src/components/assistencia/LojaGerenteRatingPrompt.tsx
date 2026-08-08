"use client";

import { useState } from "react";
import { setLojaGerenteRating } from "@/app/assistencia/loja-actions";
import { useQuickAction } from "./useQuickAction";
import { RatingScale } from "./RatingScale";

// Só aparece pro gerente em chamado de mostruário já concluído e ainda sem
// nota -- o montador não pede avaliação na hora pra esse caso (não tem
// cliente pra virar o celular), então fica pendente aqui até o gerente
// avaliar quando quiser.
export function LojaGerenteRatingPrompt({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [open, setOpen] = useState(false);
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [resolutionRating, setResolutionRating] = useState<number | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
        style={{ background: "var(--status-warning)", color: "#fff" }}
      >
        ⭐ Avalie a montagem
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-3 w-full"
      style={{ border: "2px solid var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-1))" }}
    >
      <RatingScale label="Nota pra montagem" value={deliveryRating} onChange={setDeliveryRating} />
      <RatingScale label="Nota pra resolução do problema" value={resolutionRating} onChange={setResolutionRating} />
      <div className="flex items-center gap-2">
        <button
          disabled={pending || deliveryRating === null || resolutionRating === null}
          onClick={() =>
            run(async () => {
              await setLojaGerenteRating(requestId, deliveryRating!, resolutionRating!);
            }, "Avaliação enviada.")
          }
          className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
          style={{ background: "var(--status-warning)", color: "#fff" }}
        >
          Enviar avaliação
        </button>
        <button onClick={() => setOpen(false)} className="text-sm underline px-2" style={{ color: "var(--text-secondary)" }}>
          cancelar
        </button>
      </div>
    </div>
  );
}
