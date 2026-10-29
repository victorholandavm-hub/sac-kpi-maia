"use client";

import { useState, useTransition } from "react";
import { excluirCadastroHistoricoAction } from "@/app/assistencia/cadastros-actions";

// Excluir cadastro com confirmação em dois cliques -- Victor 29/10/2026.
export function ExcluirCadastroBotao({ id, cliente }: { id: string; cliente: string | null }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const estilo = { borderColor: "var(--border)", color: "var(--text-secondary)" };

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setErro(null);
          setConfirmando(true);
        }}
        className="text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
        style={estilo}
        title={erro ?? "Excluir este cadastro"}
      >
        🗑 Excluir
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
      Excluir{cliente ? ` ${cliente.split(" ")[0]}` : ""}?
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startTransition(async () => {
            const r = await excluirCadastroHistoricoAction(id);
            if (r?.error) {
              setErro(r.error);
              setConfirmando(false);
            }
          });
        }}
        className="font-semibold px-2 py-1 rounded-lg text-white"
        style={{ background: "var(--status-critical)" }}
      >
        {pending ? "Excluindo…" : "Sim"}
      </button>
      <button type="button" disabled={pending} onClick={() => setConfirmando(false)} className="px-2 py-1 rounded-lg border" style={estilo}>
        Não
      </button>
    </span>
  );
}
