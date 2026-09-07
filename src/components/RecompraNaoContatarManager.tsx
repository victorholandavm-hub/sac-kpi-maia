"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { desmarcarNaoContatarAction } from "@/app/clientes/actions";
import type { RecompraNaoContatar } from "@/lib/recompra";

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Gerenciamento da salvaguarda de LGPD (ver RecompraContatoCell.tsx e
// migration 0109_recompra_nao_contatar.sql) -- quem está marcado some da
// lista de "Propensão a recompra" inteira, então precisa de um lugar pra
// ver quem está na lista e reverter se marcou por engano. Recolhido por
// padrão (só o contador) -- a lista em si só interessa quando alguém
// precisa checar/reverter, não no dia a dia de olhar candidatos.
export function RecompraNaoContatarManager({ items }: { items: RecompraNaoContatar[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reativar(clientId: string) {
    setPendingId(clientId);
    setError(null);
    try {
      await desmarcarNaoContatarAction(clientId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium flex items-center gap-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        🚫 {items.length} cliente{items.length === 1 ? "" : "s"} marcado{items.length === 1 ? "" : "s"} como não contatar
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <ul className="flex flex-col gap-1.5 mt-2">
          {items.map((item) => (
            <li key={item.clientId} className="flex items-center justify-between gap-2 text-xs rounded-md px-2.5 py-1.5" style={{ background: "var(--surface-1)" }}>
              <span style={{ color: "var(--text-primary)" }}>
                {item.clientId}
                {item.motivo ? <span style={{ color: "var(--text-secondary)" }}> — {item.motivo}</span> : null}
                <span style={{ color: "var(--text-muted)" }}> · {formatDateOnly(item.criadoEm)}</span>
              </span>
              <button
                type="button"
                disabled={pendingId === item.clientId}
                onClick={() => reativar(item.clientId)}
                className="text-[11px] underline shrink-0 disabled:opacity-60"
                style={{ color: "var(--status-good)" }}
              >
                reativar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="text-[11px] mt-1" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
