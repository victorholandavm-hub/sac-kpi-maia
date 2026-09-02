"use client";

import { useState } from "react";
import {
  driverCompleteRequest,
  driverAddNote,
  driverReportIssue,
  driverMarkPickupCompleted,
} from "@/app/assistencia/driver-actions";
import { useQuickAction } from "./useQuickAction";

type Mode = null | "complete" | "issue";

export function MotoristaRequestActions({
  requestId,
  pickupCompleted,
  requestType,
}: {
  requestId: string;
  pickupCompleted: boolean;
  requestType: string;
}) {
  // Recolhimento existe pra troca_produto (recolher o errado + entregar o
  // certo) e pra envio_recolhimento_peca (pedido do Victor 02/09/2026, mesma
  // ideia de PEÇA em vez de produto) -- entrega_produto/envio_peca/
  // recolhimento (avulsos) são etapa única, sem nada pra recolher/entregar
  // junto na mesma visita.
  const hasPickup = requestType === "troca_produto" || requestType === "envio_recolhimento_peca";
  const { pending, run, showToast } = useQuickAction();
  const [mode, setMode] = useState<Mode>(null);
  const [issueReason, setIssueReason] = useState("");
  const [note, setNote] = useState("");

  function confirmIssue() {
    if (!issueReason.trim()) {
      showToast("Informe o motivo.", "error");
      return;
    }
    run(async () => {
      await driverReportIssue(requestId, issueReason);
      setIssueReason("");
      setMode(null);
    }, "Chamado marcado pra remarcar.");
  }

  function finishComplete() {
    run(async () => {
      await driverCompleteRequest(requestId);
      setMode(null);
    }, "Entrega concluída.");
  }

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
              await driverAddNote(requestId, note);
              setNote("");
            }, "Observação enviada.")
          }
          className="text-sm rounded-lg px-3 py-2.5 border font-medium self-start disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Enviar observação
        </button>
      </div>

      {hasPickup ? (
        !pickupCompleted ? (
          <button
            disabled={pending}
            onClick={() => run(() => driverMarkPickupCompleted(requestId), "Recolhimento registrado.")}
            className="text-sm rounded-lg px-3 py-3 font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
          >
            Marcar produto errado/avariado como recolhido
          </button>
        ) : (
          <p className="text-sm" style={{ color: "var(--brand-orange)" }}>
            ✓ Produto errado/avariado já recolhido
          </p>
        )
      ) : null}

      {mode === null ? (
        <div className="flex flex-col gap-2">
          <button
            disabled={pending}
            onClick={() => setMode("complete")}
            className="text-sm rounded-lg px-3 py-3 font-medium disabled:opacity-60"
            style={{ background: "var(--status-good)", color: "#fff" }}
          >
            Marcar entrega como concluída
          </button>
          <button
            disabled={pending}
            onClick={() => setMode("issue")}
            className="text-sm rounded-lg px-3 py-3 font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
          >
            Não consegui concluir
          </button>
        </div>
      ) : null}

      {mode === "complete" ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--status-good)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Confirmar que essa entrega foi feita? (marca só essa notificação -- as outras da rota continuam em aberto)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              onClick={finishComplete}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-good)", color: "#fff" }}
            >
              Sim, concluída
            </button>
            <button onClick={() => setMode(null)} className="text-sm underline px-2" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mode === "issue" ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Qual o motivo?
          </span>
          <textarea
            value={issueReason}
            onChange={(e) => setIssueReason(e.target.value)}
            rows={2}
            placeholder="Ex: cliente ausente, produto não confere…"
            className="rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !issueReason.trim()}
              onClick={confirmIssue}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Confirmar
            </button>
            <button
              onClick={() => {
                setMode(null);
                setIssueReason("");
              }}
              className="text-sm underline px-2"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
