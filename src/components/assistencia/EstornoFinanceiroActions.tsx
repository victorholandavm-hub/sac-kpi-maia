"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";
import { recusarEstornoAction, desfazerConclusaoEstornoAction } from "@/app/assistencia/financeiro-estornos-actions";

// Modal de upload do(s) comprovante(s) -- pedido do Victor 23/09/2026:
// escolher o(s) arquivo(s), conferir, e só então clicar em "Enviar" (antes
// era inline, sem confirmação separada). Mesmo padrão visual de
// PrejuizoDetalheModal.tsx (overlay + painel central). Vários arquivos de
// uma vez -- pedido do Victor 07/10/2026 ("seja possível adicionar mais de
// um comprovante... do financeiro").
function ComprovanteModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { pending, run } = useQuickAction();
  const [files, setFiles] = useState<File[]>([]);

  function enviar() {
    if (files.length === 0) return;
    run(async () => {
      const formData = new FormData();
      for (const file of files) formData.append("comprovante", file);
      formData.set("requestId", requestId);
      await uploadPhotoRequest("/api/financeiro/upload-comprovante", formData);
      onClose();
    }, files.length > 1 ? "Comprovantes enviados." : "Comprovante enviado.");
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
            Comprovante(s) do estorno
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
          {files.length > 0 ? `${files.length} arquivo${files.length > 1 ? "s" : ""} selecionado${files.length > 1 ? "s" : ""}` : "Selecionar foto(s) ou PDF(s)"}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 ? (
          <ul className="text-xs flex flex-col gap-0.5 -mt-2" style={{ color: "var(--text-muted)" }}>
            {files.map((f, i) => (
              <li key={`${f.name}_${i}`} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>
        ) : null}

        <button
          disabled={files.length === 0 || pending}
          onClick={enviar}
          className="rounded-lg px-3 py-2.5 font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--status-good)" }}
        >
          {pending ? "Enviando…" : files.length > 1 ? "Enviar comprovantes" : "Enviar comprovante"}
        </button>
      </div>
    </>
  );
}

// Ações do financeiro/admin sobre uma solicitação: anexar comprovante(s)
// (via modal) pra concluir; depois de concluída, ainda dá pra "+ Adicionar
// comprovante" (reabre o mesmo modal, ACRESCENTA mais arquivos -- pedido do
// Victor 07/10/2026 -- não substitui os que já tinham sido enviados) ou
// "Desfazer" (volta pra pendente, limpando todos os comprovantes dessa
// rodada) -- pedido do Victor 23/09/2026, pro caso de ter mandado o
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
          📎 {status === "concluido" ? "+ Adicionar comprovante" : "Anexar comprovante"}
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
