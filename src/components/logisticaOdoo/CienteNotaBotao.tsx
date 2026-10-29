"use client";

import { cienteNotaDeOutroAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoStyle } from "./ui";

export function CienteNotaBotao({ acaoId }: { acaoId: number }) {
  const { pending, run } = useAcaoOdoo();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => cienteNotaDeOutroAction(acaoId), "Ciente registrado.")} className={botaoClass} style={botaoStyle}>
      {pending ? "…" : "Ciente"}
    </button>
  );
}
