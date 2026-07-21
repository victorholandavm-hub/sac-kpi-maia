"use client";

import { useState } from "react";
import { montadorCompleteRequest, montadorAddNote, montadorReportIssue } from "@/app/assistencia/montador-actions";
import { useQuickAction } from "./useQuickAction";

export function MontadorRequestActions({ requestId }: { requestId: string }) {
  const { pending, run, showToast } = useQuickAction();
  const [confirming, setConfirming] = useState(false);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [issueReason, setIssueReason] = useState("");
  const [note, setNote] = useState("");

  function confirmIssue() {
    if (!issueReason.trim()) {
      showToast("Informe o motivo.", "error");
      return;
    }
    run(async () => {
      await montadorReportIssue(requestId, issueReason);
      setIssueReason("");
      setReportingIssue(false);
    }, "Chamado marcado pra remarcar.");
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

      {!reportingIssue ? (
        <button
          disabled={pending}
          onClick={() => setReportingIssue(true)}
          className="text-sm rounded-lg px-3 py-3 font-medium border disabled:opacity-60"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          Não consegui montar
        </button>
      ) : (
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
                setReportingIssue(false);
                setIssueReason("");
              }}
              className="text-sm underline px-2"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
