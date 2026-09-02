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
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
        {classificacao ? (
          <>
            <p className="text-sm text-gray-800">{classificacao.note || "Sem observação registrada."}</p>
            <p className="text-xs text-gray-400">
              Reavaliar em: <span className="font-semibold text-gray-800">{classificacao.reavaliarEm ? formatDate(classificacao.reavaliarEm) : "não definida"}</span>
              {" · "}
              {classificacao.classifiedByName}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Ainda não classificado.</p>
        )}
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150 self-start">
          {classificacao ? "editar classificação" : "classificar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="O que foi verificado, novo prazo combinado com o cliente…"
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 hover:border-gray-300 focus:border-gray-300 focus:outline-none transition-colors duration-150"
      />
      <label className="flex items-center gap-2 text-sm text-gray-800">
        Reavaliar em
        <input
          type="date"
          value={reavaliarEm}
          onChange={(e) => setReavaliarEm(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 hover:border-gray-300 focus:border-gray-300 focus:outline-none transition-colors duration-150"
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
          className="text-xs rounded-lg px-3.5 py-2 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
          style={{ background: "#1B5E3C" }}
        >
          Salvar classificação
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setNote(classificacao?.note ?? "");
            setReavaliarEm(classificacao?.reavaliarEm ?? "");
          }}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
