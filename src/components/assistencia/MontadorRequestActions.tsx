"use client";

import { useState } from "react";
import {
  montadorCompleteRequest,
  montadorAddNote,
  montadorReportIssue,
  montadorCompletePartially,
} from "@/app/assistencia/montador-actions";
import { useQuickAction } from "./useQuickAction";
import { RatingScale } from "./RatingScale";
import type { AssemblerRequestItem } from "@/lib/serviceRequests";

type Mode = null | "complete" | "rating" | "issue" | "partial";

export function MontadorRequestActions({
  requestId,
  items,
  isMostruario,
}: {
  requestId: string;
  items: AssemblerRequestItem[];
  // Mostruário é item de exposição da própria loja -- não tem cliente pra
  // virar o celular. A avaliação, nesse caso, fica pro gerente que pediu
  // fazer depois, na própria tela dele (ver loja/page.tsx), não aqui.
  isMostruario: boolean;
}) {
  const { pending, run, showToast } = useQuickAction();
  const [mode, setMode] = useState<Mode>(null);
  const [issueReason, setIssueReason] = useState("");
  const [note, setNote] = useState("");
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [resolutionRating, setResolutionRating] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [partialNote, setPartialNote] = useState("");

  function confirmIssue() {
    if (!issueReason.trim()) {
      showToast("Informe o motivo.", "error");
      return;
    }
    run(async () => {
      await montadorReportIssue(requestId, issueReason);
      setIssueReason("");
      setMode(null);
    }, "Chamado marcado pra remarcar.");
  }

  function finishComplete(withRating: boolean) {
    run(async () => {
      await montadorCompleteRequest(requestId, withRating ? deliveryRating : null, withRating ? resolutionRating : null);
      setMode(null);
    }, "Chamado marcado como concluído.");
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function confirmPartial() {
    if (checkedIds.length === 0) {
      showToast("Marque pelo menos um item como feito.", "error");
      return;
    }
    run(async () => {
      await montadorCompletePartially(requestId, checkedIds, partialNote);
      setCheckedIds([]);
      setPartialNote("");
      setMode(null);
    }, "Chamado concluído parcialmente.");
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

      {mode === null ? (
        <div className="flex flex-col gap-2">
          <button
            disabled={pending}
            onClick={() => setMode("complete")}
            className="text-sm rounded-lg px-3 py-3 font-medium disabled:opacity-60"
            style={{ background: "var(--status-good)", color: "#fff" }}
          >
            Marcar como concluído
          </button>
          {items.length > 0 ? (
            <button
              disabled={pending}
              onClick={() => setMode("partial")}
              className="text-sm rounded-lg px-3 py-3 font-medium border disabled:opacity-60"
              style={{ borderColor: "var(--status-warning)", color: "var(--status-warning)" }}
            >
              Concluir parcialmente
            </button>
          ) : null}
          <button
            disabled={pending}
            onClick={() => setMode("issue")}
            className="text-sm rounded-lg px-3 py-3 font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
          >
            Não consegui montar
          </button>
        </div>
      ) : null}

      {mode === "complete" ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--status-good)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Confirmar que esse chamado foi concluído?
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              onClick={() => (isMostruario ? finishComplete(false) : setMode("rating"))}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-good)", color: "#fff" }}
            >
              Sim, concluído
            </button>
            <button onClick={() => setMode(null)} className="text-sm underline px-2" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mode === "rating" ? (
        <div
          className="flex flex-col gap-4 rounded-lg p-4"
          style={{ border: "2px solid var(--status-good)", background: "color-mix(in srgb, var(--status-good) 8%, var(--surface-1))" }}
        >
          <div className="rounded-lg py-3 px-2 text-center" style={{ background: "var(--status-good)" }}>
            <p className="text-lg font-bold" style={{ color: "#fff" }}>
              📱 Vire o celular pro cliente avaliar!
            </p>
          </div>
          <RatingScale label="Nota pra montagem" value={deliveryRating} onChange={setDeliveryRating} />
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

      {mode === "partial" ? (
        <div
          className="flex flex-col gap-3 rounded-lg p-3"
          style={{ border: "2px solid var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-1))" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Marque só os itens que já foram montados/desmontados nesta visita. O resto fica pendente — a assistência
            entra em contato pra combinar a data de conclusão.
          </span>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={checkedIds.includes(item.id)}
                  onChange={() => toggleChecked(item.id)}
                  className="rounded"
                />
                <span style={{ color: "var(--text-primary)" }}>
                  {item.action ? (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded mr-1.5"
                      style={{
                        color: item.action === "montar" ? "var(--brand-green-ink)" : "var(--text-primary)",
                        background: item.action === "montar" ? "var(--brand-green)" : "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))",
                      }}
                    >
                      {item.action === "montar" ? "Montar" : "Desmontar"}
                    </span>
                  ) : null}
                  {item.quantity > 1 ? `${item.quantity}x ` : ""}
                  {item.product}
                </span>
              </label>
            ))}
          </div>
          {checkedIds.length === items.length && items.length > 0 ? (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Marcou tudo? Se terminou a visita inteira, use &ldquo;Marcar como concluído&rdquo; em vez desta opção.
            </span>
          ) : null}
          <textarea
            value={partialNote}
            onChange={(e) => setPartialNote(e.target.value)}
            rows={2}
            placeholder="Observação sobre o que falta (opcional)…"
            className="rounded-lg border px-3 py-2.5 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || checkedIds.length === 0}
              onClick={confirmPartial}
              className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Concluir parcialmente
            </button>
            <button
              onClick={() => {
                setMode(null);
                setCheckedIds([]);
                setPartialNote("");
              }}
              className="text-sm underline px-2"
              style={{ color: "var(--text-secondary)" }}
            >
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
            placeholder="Ex: móvel chegou com avaria, cliente não estava em casa…"
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
