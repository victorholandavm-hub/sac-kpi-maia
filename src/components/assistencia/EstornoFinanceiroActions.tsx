"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";
import { recusarEstornoAction } from "@/app/assistencia/financeiro-estornos-actions";

// Ações do financeiro/admin sobre uma solicitação pendente: anexar o
// comprovante do estorno e SÓ DEPOIS confirmar em "Concluir" (pedido do
// Victor 23/09/2026, revisado: antes o upload já concluía sozinho, agora
// são dois passos -- escolhe o arquivo, confere, e clica em concluir) ou
// recusar com motivo -- mesmo padrão de "Negar pedido" em
// PedidoEncomendaActions.tsx.
export function EstornoFinanceiroActions({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [showDeny, setShowDeny] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  function concluir() {
    if (!comprovante) return;
    run(async () => {
      const formData = new FormData();
      formData.set("comprovante", comprovante);
      formData.set("requestId", requestId);
      await uploadPhotoRequest("/api/financeiro/upload-comprovante", formData);
      setComprovante(null);
      setInputKey((k) => k + 1);
    }, "Estorno marcado como concluído.");
  }

  return (
    <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <label
          className="text-sm rounded-lg px-3 py-2 font-semibold text-center cursor-pointer"
          style={{ border: "2px dashed var(--status-good)", color: "var(--status-good)", opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
        >
          📎 {comprovante ? "Trocar comprovante" : "Anexar comprovante"}
          <input
            key={inputKey}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
          />
        </label>
        {comprovante ? (
          <>
            <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-secondary)" }}>
              {comprovante.name}
            </span>
            <button
              disabled={pending}
              onClick={concluir}
              className="text-sm rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--status-good)" }}
            >
              {pending ? "Enviando…" : "✓ Concluir"}
            </button>
          </>
        ) : null}
      </div>

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
