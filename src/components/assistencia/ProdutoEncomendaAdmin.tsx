"use client";

import { useActionState } from "react";
import { addProdutoEncomenda, toggleProdutoEncomendaAtivo, type FormState } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";
import type { ProdutoEncomenda } from "@/lib/pedidosEncomenda";

function ProdutoRow({ produto }: { produto: ProdutoEncomenda }) {
  const { pending, run } = useQuickAction();
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span style={{ color: produto.ativo ? "var(--text-primary)" : "var(--text-muted)" }}>
        {produto.descricao}
        {produto.categoria ? <span style={{ color: "var(--text-muted)" }}> · {produto.categoria}</span> : null}
      </span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => toggleProdutoEncomendaAtivo(produto.id, !produto.ativo),
            produto.ativo ? "Produto desativado." : "Produto reativado."
          )
        }
        className="text-xs underline shrink-0 disabled:opacity-60"
        style={{ color: produto.ativo ? "var(--status-critical)" : "var(--status-good)" }}
      >
        {produto.ativo ? "desativar" : "reativar"}
      </button>
    </li>
  );
}

export function ProdutoEncomendaAdmin({ produtos }: { produtos: ProdutoEncomenda[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addProdutoEncomenda, undefined);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {produtos.map((p) => (
          <ProdutoRow key={p.id} produto={p} />
        ))}
        {produtos.length === 0 ? (
          <li className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum produto cadastrado ainda.
          </li>
        ) : null}
      </ul>
      <form action={formAction} className="flex items-center gap-2 mt-2 flex-wrap">
        <input
          name="descricao"
          placeholder="Descrição do produto"
          required
          className="rounded border px-2 py-1 text-sm flex-1 min-w-[200px]"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          name="categoria"
          placeholder="Categoria (opcional)"
          className="rounded border px-2 py-1 text-sm w-40"
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
