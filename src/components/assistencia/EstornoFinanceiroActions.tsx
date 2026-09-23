"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";
import { recusarEstornoAction } from "@/app/assistencia/financeiro-estornos-actions";

// Ações do financeiro/admin sobre uma solicitação pendente: anexar o
// comprovante do estorno (upload + conclusão num só passo, ver
// /api/financeiro/upload-comprovante) ou recusar com motivo -- mesmo padrão
// de "Negar pedido" em PedidoEncomendaActions.tsx.
export function EstornoFinanceiroActions({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [showDeny, setShowDeny] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [inputKey, setInputKey] = useState(0);

  function uploadComprovante(file: File) {
    run(async () => {
      const formData = new FormData();
      formData.set("comprovante", file);
      formData.set("requestId", requestId);
      await uploadPhotoRequest("/api/financeiro/upload-comprovante", formData);
      setInputKey((k) => k + 1);
    }, "Estorno marcado como concluído.");
  }

  return (
    <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <label
        className="text-sm rounded-lg px-3 py-2.5 font-semibold text-center cursor-pointer self-start"
        style={{ border: "2px dashed var(--status-good)", color: "var(--status-good)", opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
      >
        {pending ? "Enviando…" : "📎 Anexar comprovante e concluir"}
        <input
          key={inputKey}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadComprovante(file);
          }}
        />
      </label>

      {showDeny ? (
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
      )}
    </div>
  );
}
