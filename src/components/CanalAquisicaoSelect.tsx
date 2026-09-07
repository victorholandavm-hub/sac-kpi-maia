"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCanalAquisicaoAction } from "@/app/clientes/actions";
import { CANAL_AQUISICAO_OPTIONS, CANAL_AQUISICAO_LABELS, type CanalAquisicao } from "@/lib/clientes";

// Canal de aquisição -- pedido do Victor 07/09/2026: "tem como você
// deixar esse espaço com um múltiplo select para que eu pudesse ir
// preenchendo?". Um canal só por cliente (decisão dele, mesma conversa)
// -- select nativo salva sozinho ao trocar, sem botão "salvar" à parte,
// pra dar pra ir preenchendo rápido, linha por linha, na aba Status.
//
// Sem toast/useQuickAction (ToastProvider é só da árvore /assistencia) --
// erro simples embutido no próprio componente + router.refresh() no
// sucesso.
export function CanalAquisicaoSelect({ clientId, canal }: { clientId: string; canal: CanalAquisicao | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(value: string) {
    if (!value) return;
    setPending(true);
    setError(null);
    try {
      await setCanalAquisicaoAction(clientId, value);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <select
        value={canal ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="text-xs rounded border px-2 py-1 disabled:opacity-60"
        style={{ borderColor: "var(--border)", color: canal ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <option value="" disabled>
          Não preenchido
        </option>
        {CANAL_AQUISICAO_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {CANAL_AQUISICAO_LABELS[c]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-[11px] mt-0.5" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
