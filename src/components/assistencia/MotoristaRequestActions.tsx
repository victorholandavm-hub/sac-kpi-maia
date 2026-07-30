"use client";

import { useState } from "react";
import {
  driverCompleteRequest,
  driverAddNote,
  driverReportIssue,
  driverMarkPickupCompleted,
} from "@/app/assistencia/driver-actions";
import { useQuickAction } from "./useQuickAction";
import { RatingScale } from "./RatingScale";

type Mode = null | "complete" | "rating" | "issue";

export function MotoristaRequestActions({
  requestId,
  pickupCompleted,
  requestType,
}: {
  requestId: string;
  pickupCompleted: boolean;
  requestType: string;
}) {
  // Recolhimento só existe pra troca_produto (recolher o errado + entregar o
  // certo) — entrega_produto/envio_peca são entrega em etapa única, sem nada
  // pra recolher na casa do cliente.
  const hasPickup = requestType === "troca_produto";
  const { pending, run, showToast } = useQuickAction();
  const [mode, setMode] = useState<Mode>(null);
  const [issueReason, setIssueReason] = useState("");
  const [note, setNote] = useState("");
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [resolutionRating, setResolutionRating] = useState<number | null>(null);

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

  function finishComplete(withRating: boolean) {
    run(async () => {
      await driverCompleteRequest(requestId, withRating ? deliveryRating : null, withRating ? resolutionRating : null);
      setMode(null);
    }, "Rota concluída.");
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
            Marcar rota como concluída
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
            Confirmar que a entrega foi feita e a rota está concluída?
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              onClick={() => setMode("rating")}
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

      {mode === "rating" ? (
        <div className="flex flex-col gap-4 rounded-lg border p-3" style={{ borderColor: "var(--status-good)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Passe o celular pro cliente avaliar (0 a 10):
          </span>
          <RatingScale label="Nota pra entrega" value={deliveryRating} onChange={setDeliveryRating} />
          <RatingScale label="Nota pra resolução do problema" value={resolutionRating} onChange={setResolutionRating} />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || deliveryRating === null || resolutionRating === null}
              onClick={() => finishComplete(true)}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-good)", color: "#fff" }}
            >
              Enviar avaliação e concluir
            </button>
          </div>
          <button
            disabled={pending}
            onClick={() => finishComplete(false)}
            className="text-sm underline self-start disabled:opacity-60"
            style={{ color: "var(--text-secondary)" }}
          >
            Cliente não quis avaliar — concluir sem avaliação
          </button>
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
