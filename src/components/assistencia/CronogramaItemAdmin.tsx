"use client";

import { useActionState } from "react";
import { addCronogramaItemAction, toggleCronogramaItemAtivoAction, type FormState } from "@/app/assistencia/cronograma-actions";
import { useQuickAction } from "./useQuickAction";
import type { CronogramaItem } from "@/lib/cronogramaSac";

function ItemRow({ item }: { item: CronogramaItem }) {
  const { pending, run } = useQuickAction();
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span style={{ color: item.ativo ? "var(--text-primary)" : "var(--text-muted)" }}>
        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          {item.horario}
        </span>{" "}
        {item.descricao}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          run(() => toggleCronogramaItemAtivoAction(item.id, !item.ativo), item.ativo ? "Item desativado." : "Item reativado.")
        }
        className="text-xs underline shrink-0 disabled:opacity-60"
        style={{ color: item.ativo ? "var(--status-critical)" : "var(--status-good)" }}
      >
        {item.ativo ? "desativar" : "reativar"}
      </button>
    </li>
  );
}

// Lista + formulário de adicionar -- pedido do Victor 01/10/2026: "os 7
// itens do cronograma vão mudar com o tempo... vou querer editar de vez em
// quando". Mesmo padrão de ProdutoEncomendaAdmin.tsx (catálogo de
// encomendas) -- desativar em vez de apagar, pra não perder o histórico de
// quem já marcou aquele item em dias anteriores (ver
// sac_cronograma_completions).
export function CronogramaItemAdmin({ itens }: { itens: CronogramaItem[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addCronogramaItemAction, undefined);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {itens.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
        {itens.length === 0 ? (
          <li className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum item cadastrado ainda.
          </li>
        ) : null}
      </ul>
      <form action={formAction} className="flex items-center gap-2 mt-2 flex-wrap">
        <input
          name="horario"
          type="time"
          required
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          name="descricao"
          placeholder="Descrição do item"
          required
          className="rounded border px-2 py-1 text-sm flex-1 min-w-[200px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
        {state?.error ? (
          <span className="text-xs" style={{ color: "var(--status-critical)" }}>
            {state.error}
          </span>
        ) : null}
      </form>
    </div>
  );
}
