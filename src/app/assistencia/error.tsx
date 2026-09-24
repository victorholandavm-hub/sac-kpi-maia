"use client";

import { useEffect } from "react";

// Rede de segurança pra QUALQUER rota sob /assistencia/* -- achado do
// Victor 24/09/2026: montador mateusjp em conexão de celular instável
// (rede caindo no meio da resposta do servidor -- "The destination
// stream closed early" nos logs) às vezes teve uma ação de servidor
// esperada (ex.: validação de "envie foto antes de concluir") escapar do
// try/catch normal (useQuickAction.ts) e cair direto na tela crua de
// erro do React/Next ("Minified React error #441"), sem UI nenhuma nem
// jeito de tentar de novo sem sair da tela e voltar. Nenhuma rota sob
// /assistencia tinha error.tsx até então -- Next usa o fallback padrão
// (a tela crua) quando falta um.
export default function AssistenciaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[assistencia] erro não tratado:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div
        className="max-w-sm w-full rounded-xl border p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <span className="text-3xl" aria-hidden>
          ⚠️
        </span>
        <h1 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          Algo deu errado
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Pode ter sido a conexão. Toque em tentar de novo — se continuar, avise a assistência.
        </p>
        <button
          onClick={() => reset()}
          className="text-sm px-4 py-2.5 rounded-lg font-semibold w-full"
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
