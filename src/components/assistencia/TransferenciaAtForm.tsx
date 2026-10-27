"use client";

import { useActionState } from "react";
import { transferirEstoqueAt, type TransferenciaAtState } from "@/app/assistencia/tecnico/estoque-at/actions";

// Formulário da transferência estoque <-> AT na tela da equipe técnica.
export function TransferenciaAtForm({ empresas, empresaAtual }: { empresas: { id: number; name: string }[]; empresaAtual: number }) {
  const [state, acao, pending] = useActionState<TransferenciaAtState, FormData>(transferirEstoqueAt, undefined);
  const campo = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  return (
    <form action={acao} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Transferir entre o estoque de venda e o estoque AT
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_minmax(0,1.3fr)]">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Loja / CD
          <select name="empresa" defaultValue={String(empresaAtual)} className="rounded-lg px-3 py-2 text-sm" style={campo}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Código do produto
          <input name="codigo" required placeholder="ex.: 071280" className="rounded-lg px-3 py-2 text-sm font-mono" style={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Quantidade
          <input name="qtd" type="number" min={1} step={1} defaultValue={1} required className="rounded-lg px-3 py-2 text-sm" style={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Direção
          <select name="direcao" defaultValue="para_at" className="rounded-lg px-3 py-2 text-sm" style={campo}>
            <option value="para_at">Estoque de venda → Estoque AT</option>
            <option value="do_at">Estoque AT → Estoque de venda</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Motivo *
        <input name="motivo" required placeholder="Chamado, peça pra conserto, devolução ao estoque…" className="rounded-lg px-3 py-2 text-sm" style={campo} />
      </label>
      {state?.erro ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.erro}
        </p>
      ) : state?.ok ? (
        <p className="text-sm" style={{ color: "var(--status-good)" }}>
          ✓ {state.ok}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Transferindo no Odoo…" : "Transferir"}
      </button>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Sai do Odoo na hora: só move saldo livre e, se faltar, nada é movido. Seu nome e o motivo ficam no histórico.
      </p>
    </form>
  );
}
