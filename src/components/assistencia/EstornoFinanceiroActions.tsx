"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";
import { recusarEstornoAction, desfazerConclusaoEstornoAction } from "@/app/assistencia/financeiro-estornos-actions";

// Modal de upload do comprovante -- pedido do Victor 23/09/2026: escolher o
// arquivo, conferir, e só então clicar em "Enviar comprovante" (antes era
// inline, sem confirmação separada). Mesmo padrão visual de
// PrejuizoDetalheModal.tsx (overlay + painel central).
function ComprovanteModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { pending, run } = useQuickAction();
  const [file, setFile] = useState<File | null>(null);

  function enviar() {
    if (!file) return;
    run(async () => {
      const formData = new FormData();
      formData.set("comprovante", file);
      formData.set("requestId", requestId);
      await uploadPhotoRequest("/api/financeiro/upload-comprovante", formData);
      onClose();
    }, "Comprovante enviado.");
  }

  return (
    <>
      <button aria-label="Fechar" onClick={onClose} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-sm rounded-lg border p-4 shadow-lg flex flex-col gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Comprovante do estorno
          </h3>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>

        <label
          className="text-sm rounded-lg px-3 py-8 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
          style={{ border: "2px dashed var(--status-good)", color: "var(--status-good)" }}
        >
          <span className="text-2xl leading-none">📎</span>
          {file ? file.name : "Selecionar foto ou PDF"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <button
          disabled={!file || pending}
          onClick={enviar}
          className="rounded-lg px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--status-good)" }}
        >
          {pending ? "Enviando…" : "Enviar comprovante"}
        </button>
      </div>
    </>
  );
}

// Ações do financeiro/admin sobre uma solicitação: anexar comprovante (via
// modal) pra concluir; depois de concluída, ainda dá pra "Alterar
// comprovante" (reabre o mesmo modal, troca o arquivo) ou "Desfazer" (volta
// pra pendente) -- pedido do Victor 23/09/2026, pro caso de ter mandado o
// comprovante errado. Recusar continua só disponível enquanto pendente.
export function EstornoFinanceiroActions({ requestId, status }: { requestId: string; status: "pendente" | "concluido" }) {
  const { pending, run } = useQuickAction();
  const [showModal, setShowModal] = useState(false);
  const [showDeny, setShowDeny] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  return (
    <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={pending}
          onClick={() => setShowModal(true)}
          className="text-sm rounded-lg px-3 py-2 font-semibold disabled:opacity-60"
          style={{ border: "2px dashed var(--status-good)", color: "var(--status-good)" }}
        >
          📎 {status === "concluido" ? "Alterar comprovante" : "Anexar comprovante"}
        </button>
        {status === "concluido" ? (
          <button
            disabled={pending}
            onClick={() => run(async () => desfazerConclusaoEstornoAction(requestId), "Desfeito -- voltou pra pendente.")}
            className="text-sm underline disabled:opacity-60"
            style={{ color: "var(--status-critical)" }}
          >
            Desfazer
          </button>
        ) : null}
      </div>

      {status === "pendente" ? (
        showDeny ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={2}
              placeholder="Motivo da recusa…"
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--status-critical)" }}
            />
            <div className="flex items-center gap-2">
              <button
                disabled={pending || !denyReason.trim()}
                onClick={() =>
                  run(async () => {
                    await recusarEstornoAction(requestId, denyReason);
                    setDenyReason("");
                    setShowDeny(false);
                  }, "Solicitação recusada.")
                }
                className="text-sm rounded px-3 py-2 disabled:opacity-60"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                Confirmar recusa
              </button>
              <button onClick={() => setShowDeny(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowDeny(true)} className="text-sm underline self-start" style={{ color: "var(--status-critical)" }}>
            Recusar
          </button>
        )
      ) : null}

      {showModal ? <ComprovanteModal requestId={requestId} onClose={() => setShowModal(false)} /> : null}
    </div>
  );
}
