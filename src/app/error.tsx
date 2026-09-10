"use client";

import { useEffect } from "react";

// Boundary de erro GLOBAL -- pedido do Victor 10/09/2026: montador viu
// "Minified React error #441" (tela vermelha crua do React/Next, sem
// nenhuma explicação) ao clicar "Concluir parcialmente" sem foto de todo
// item marcado. O app inteiro nunca teve NENHUM error.tsx (conferido:
// zero arquivos error.tsx/global-error.tsx em todo src/app) -- qualquer
// erro que escapasse de um try/catch (ex.: um erro de Server Action que,
// por algum motivo, não fica só no `catch` do useQuickAction.ts -- ver
// nota lá) sempre caía nesse overlay técnico do React, ilegível pra quem
// não é dev. `error`/`retry` (não `reset` -- API mudou no Next 16.3, ver
// node_modules/next/dist/docs/.../catchError.md) -- `retry()` re-busca e
// re-renderiza, recupera de verdade em vez de só limpar o estado.
export default function GlobalErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div
        className="max-w-sm w-full rounded-lg border p-5 flex flex-col gap-3 text-center items-center"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <span className="text-3xl" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          Algo deu errado
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {error.message || "Não foi possível concluir essa ação."}
        </p>
        <button
          onClick={() => retry()}
          className="text-sm rounded-lg px-4 py-2.5 font-medium w-full"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Tentar de novo
        </button>
        {error.digest ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Código: {error.digest}
          </span>
        ) : null}
      </div>
    </div>
  );
}
