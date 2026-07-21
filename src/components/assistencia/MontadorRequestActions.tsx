"use client";

import { useState } from "react";
import { montadorCompleteRequest, montadorAddNote } from "@/app/assistencia/montador-actions";
import { useQuickAction } from "./useQuickAction";

export function MontadorRequestActions({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Relatar observação, avaria ou outro detalhe…"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await montadorAddNote(requestId, note);
              setNote("");
            }, "Observação enviada.")
          }
          className="text-sm rounded-lg px-3 py-2.5 border font-medium self-start disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Enviar observação
        </button>
      </div>

      {!confirming ? (
        <button
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="text-sm rounded-lg px-3 py-3 font-medium disabled:opacity-60"
          style={{ background: "var(--status-good)", color: "#fff" }}
        >
          Marcar como concluído
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--status-good)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Confirmar que esse chamado foi concluído?
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              onClick={() => {
                run(async () => {
                  await montadorCompleteRequest(requestId);
                  setConfirming(false);
                }, "Chamado marcado como concluído.");
              }}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-good)", color: "#fff" }}
            >
              Sim, concluído
            </button>
            <button onClick={() => setConfirming(false)} className="text-sm underline px-2" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
