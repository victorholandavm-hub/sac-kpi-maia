"use client";

import { useState } from "react";
import { claimRequest, updateStatus, addNote } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { STATUS_LABELS } from "@/lib/assistenciaLabels";

const NEXT_STATUSES: Record<string, string[]> = {
  aberta: ["em_contato", "cancelada"],
  em_contato: ["em_andamento", "cancelada"],
  em_andamento: ["remarcar", "concluida", "cancelada"],
  remarcar: ["em_andamento", "concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

export function RequestActions({
  requestId,
  status,
  isAssignedToMe,
  hasAssembler,
}: {
  requestId: string;
  status: string;
  isAssignedToMe: boolean;
  hasAssembler: boolean;
}) {
  const { pending, run, showToast } = useQuickAction();
  const [note, setNote] = useState("");
  const [remarcarReason, setRemarcarReason] = useState("");
  const [askingRemarcarReason, setAskingRemarcarReason] = useState(false);

  function confirmRemarcar() {
    if (!remarcarReason.trim()) {
      showToast("Informe o motivo da remarcação.", "error");
      return;
    }
    run(async () => {
      await updateStatus(requestId, "remarcar", remarcarReason);
      setRemarcarReason("");
      setAskingRemarcarReason(false);
    }, "Solicitação remarcada.");
  }

  // Sem montador definido não dá pra ir pra "em andamento" (ver updateStatus
  // no servidor, que é quem realmente barra isso) — some a opção da lista em
  // vez de deixar clicar e levar um erro.
  const nextStatuses = (NEXT_STATUSES[status] ?? []).filter((s) => s !== "em_andamento" || hasAssembler);

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {!isAssignedToMe ? (
        <button
          disabled={pending}
          onClick={() => run(() => claimRequest(requestId), "Solicitação assumida.")}
          className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Assumir para mim
        </button>
      ) : null}

      {!hasAssembler && (NEXT_STATUSES[status] ?? []).includes("em_andamento") ? (
        <p className="text-xs" style={{ color: "var(--status-warning)" }}>
          Defina o montador acima pra poder marcar como Em andamento.
        </p>
      ) : null}

      {nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() =>
                s === "remarcar"
                  ? setAskingRemarcarReason(true)
                  : run(() => updateStatus(requestId, s), `Status atualizado para ${STATUS_LABELS[s] ?? s}.`)
              }
              className="text-sm rounded px-3 py-2 border disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Marcar como {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      ) : null}

      {askingRemarcarReason ? (
        <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Qual o motivo da remarcação?
          </span>
          <textarea
            value={remarcarReason}
            onChange={(e) => setRemarcarReason(e.target.value)}
            rows={2}
            placeholder="Ex: cliente ausente, chovendo, técnico sem tempo…"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !remarcarReason.trim()}
              onClick={confirmRemarcar}
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Confirmar remarcação
            </button>
            <button
              onClick={() => {
                setAskingRemarcarReason(false);
                setRemarcarReason("");
              }}
              className="text-sm underline"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Adicionar observação…"
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addNote(requestId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
        </button>
      </div>
    </div>
  );
}
