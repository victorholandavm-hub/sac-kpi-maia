"use client";

import { useState } from "react";
import { claimRequest, updateStatus, addNote } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/assistenciaLabels";

// Cor de cada botão de avanço reflete o status de destino (mesma cor do
// badge que a solicitação vai ganhar) — "cancelada" some pro cinza no badge
// (histórico), mas aqui vira vermelho pra não parecer um botão inerte.
function buttonColor(status: string): string {
  if (status === "cancelada") return "var(--status-critical)";
  return STATUS_COLORS[status] ?? "var(--brand-green)";
}

const NEXT_STATUSES: Record<string, string[]> = {
  aberta: ["em_contato", "cancelada"],
  em_contato: ["em_andamento", "cancelada"],
  em_andamento: ["remarcar", "concluida", "cancelada"],
  remarcar: ["em_andamento", "concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

// Qual das próximas opções é o caminho esperado (some, cancelar sempre fica
// secundário) — usado só pra decidir qual botão vem sólido/em destaque e
// quais ficam discretos, não muda o que é permitido (isso continua 100% em
// NEXT_STATUSES + updateStatus no servidor).
const PRIMARY_NEXT_STATUS: Record<string, string> = {
  aberta: "em_contato",
  em_contato: "em_andamento",
  em_andamento: "concluida",
  remarcar: "em_andamento",
};

// Pra desfazer um clique errado (ex.: marcar "Em andamento" sem querer) —
// o servidor (updateStatus) já aceita qualquer status válido, só faltava a
// opção na tela. Fica separado dos botões de avanço, mais discreto de
// propósito, pra não incentivar uso casual.
const PREVIOUS_STATUS: Record<string, string | null> = {
  aberta: null,
  em_contato: "aberta",
  em_andamento: "em_contato",
  remarcar: "em_andamento",
  concluida: "em_andamento",
  cancelada: "em_andamento",
};

export function RequestActions({
  requestId,
  status,
  isAssignedToMe,
  hasAssignee,
  assigneeLabel = "o montador",
  hideClaim = false,
}: {
  requestId: string;
  status: string;
  isAssignedToMe: boolean;
  hasAssignee: boolean;
  assigneeLabel?: string;
  hideClaim?: boolean;
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

  // Sem montador/motorista definido não dá pra ir pra "em andamento" (ver
  // updateStatus no servidor, que é quem realmente barra isso) — some a
  // opção da lista em vez de deixar clicar e levar um erro.
  const nextStatuses = (NEXT_STATUSES[status] ?? []).filter((s) => s !== "em_andamento" || hasAssignee);
  const previousStatus = PREVIOUS_STATUS[status] ?? null;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {!hideClaim && !isAssignedToMe ? (
        <button
          disabled={pending}
          onClick={() => run(() => claimRequest(requestId), "Solicitação assumida.")}
          className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Assumir para mim
        </button>
      ) : null}

      {!hasAssignee && (NEXT_STATUSES[status] ?? []).includes("em_andamento") ? (
        <p className="text-xs" style={{ color: "var(--status-warning)" }}>
          Defina {assigneeLabel} (mais abaixo, em &quot;Atendimento&quot;) pra poder marcar como Em andamento.
        </p>
      ) : null}

      {nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => {
            const isPrimary = s === PRIMARY_NEXT_STATUS[status];
            const color = buttonColor(s);
            return (
              <button
                key={s}
                disabled={pending}
                onClick={() =>
                  s === "remarcar"
                    ? setAskingRemarcarReason(true)
                    : run(() => updateStatus(requestId, s), `Status atualizado para ${STATUS_LABELS[s] ?? s}.`)
                }
                className={`text-sm rounded px-3 py-2 disabled:opacity-60 ${isPrimary ? "font-medium" : ""}`}
                style={
                  isPrimary
                    ? { background: color, color: "#fff" }
                    : { background: `color-mix(in srgb, ${color} 35%, var(--surface-1))`, color: "var(--text-primary)" }
                }
              >
                Marcar como {STATUS_LABELS[s] ?? s}
              </button>
            );
          })}
        </div>
      ) : null}

      {previousStatus ? (
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => updateStatus(requestId, previousStatus),
              `Status revertido para ${STATUS_LABELS[previousStatus] ?? previousStatus}.`
            )
          }
          className="text-xs underline self-start disabled:opacity-60"
          style={{ color: "var(--text-secondary)" }}
        >
          ↩ Reverter pra {STATUS_LABELS[previousStatus] ?? previousStatus} (marquei errado)
        </button>
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
