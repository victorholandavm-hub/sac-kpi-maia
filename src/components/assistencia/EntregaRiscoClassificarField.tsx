"use client";

import { useState } from "react";
import { classifyEntregaRiscoAction } from "@/app/assistencia/entregas-risco-actions";
import { useQuickAction } from "./useQuickAction";
import type { EntregaRiscoClassificacao } from "@/lib/entregasRisco";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function EntregaRiscoClassificarField({
  pedido,
  filialVenda,
  classificacao,
}: {
  pedido: string;
  filialVenda: string;
  classificacao: EntregaRiscoClassificacao | null;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(classificacao?.note ?? "");
  const [reavaliarEm, setReavaliarEm] = useState(classificacao?.reavaliarEm ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        {classificacao ? (
          <>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {classificacao.note || "Sem observação registrada."}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Reavaliar em:{" "}
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {classificacao.reavaliarEm ? formatDate(classificacao.reavaliarEm) : "não definida"}
              </span>
              {" · "}
              {classificacao.classifiedByName}
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Ainda não classificado.
          </p>
        )}
        <button onClick={() => setEditing(true)} className="text-xs underline self-start" style={{ color: "var(--text-secondary)" }}>
          {classificacao ? "editar classificação" : "classificar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="O que foi verificado, novo prazo combinado com o cliente…"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        Reavaliar em
        <input
          type="date"
          value={reavaliarEm}
          onChange={(e) => setReavaliarEm(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              await classifyEntregaRiscoAction(pedido, filialVenda, { note: note || null, reavaliarEm: reavaliarEm || null });
              setEditing(false);
            }, "Classificação salva.")
          }
          className="text-xs rounded px-3 py-2 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar classificação
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setNote(classificacao?.note ?? "");
            setReavaliarEm(classificacao?.reavaliarEm ?? "");
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
