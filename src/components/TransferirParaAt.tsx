"use client";

import { useActionState, useState } from "react";
import { transferirCdParaAt, type TransferirAtState } from "@/app/assistencia/transferir-at-actions";

const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" };

export function TransferirParaAt({
  codigo,
  produto,
  fabricante,
  disponivelCd,
}: {
  codigo: string;
  produto: string | null;
  fabricante: string | null;
  disponivelCd: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<TransferirAtState, FormData>(transferirCdParaAt, undefined);
  const max = Math.min(10, Math.floor(disponivelCd));

  if (state?.ok) {
    return (
      <p className="text-sm rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-good) 14%, transparent)", color: "var(--text-primary)" }}>
        ✓ {state.ok}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start rounded-xl px-4 py-2 text-sm font-semibold"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Transferir do CD pro estoque AT
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="produto" value={produto ?? ""} />
      <input type="hidden" name="fabricante" value={fabricante ?? ""} />
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Transferir do CD pro estoque AT
      </p>
      <div className="grid gap-2 sm:grid-cols-[100px_1fr_160px]">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Quantidade
          <input name="quantidade" type="number" min={1} max={max} defaultValue={1} required className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Cliente atendido *
          <input name="cliente" required className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Nº do pedido
          <input name="pedido" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Observações
        <input name="obs" placeholder="Motivo, chamado, peça que vai ser usada…" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      </label>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        A saída do CD é lançada no Odoo na hora; fica como retirada pendente no estoque da assistência até a equipe técnica dar a baixa.
      </p>
      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Conferindo saldo do CD…" : "Registrar transferência"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
