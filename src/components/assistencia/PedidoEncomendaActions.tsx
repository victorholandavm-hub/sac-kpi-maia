"use client";

import { useState } from "react";
import { advancePedidoStatus, cancelPedido, addPedidoNoteAction } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PEDIDO_ENCOMENDA_STATUS_LABELS } from "@/lib/assistenciaLabels";

type NextStep = { toStatus: string; label: string; needsCarga?: boolean; needsNfE?: boolean };

const NEXT_STEP: Record<string, NextStep | undefined> = {
  solicitado: { toStatus: "em_producao", label: "Marcar em produção" },
  em_producao: { toStatus: "pronto_para_expedicao", label: "Marcar pronto para expedição" },
  pronto_para_expedicao: { toStatus: "em_carga", label: "Informar carga e expedir", needsCarga: true },
  em_carga: { toStatus: "faturado", label: "Informar NF-e e faturar", needsNfE: true },
  faturado: { toStatus: "entregue", label: "Marcar entregue" },
};

// Cada papel só vê o próximo passo se ele de fato pode executá-lo — o
// servidor (requireEncomendaAction em src/lib/dal.ts) já barra o resto, isso
// aqui é só pra não mostrar um botão que vai dar erro.
const ROLE_CAN_ADVANCE: Record<string, string[]> = {
  fabrica: ["solicitado", "em_producao"],
  cd: ["pronto_para_expedicao", "em_carga", "faturado"],
};

export function PedidoEncomendaActions({
  pedidoId,
  status,
  role,
}: {
  pedidoId: string;
  status: string;
  role: string;
}) {
  const { pending, run } = useQuickAction();
  const [carga, setCarga] = useState("");
  const [nfE, setNfE] = useState("");
  const [note, setNote] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const canManageStatus = role === "assistencia" || role === "admin" || (ROLE_CAN_ADVANCE[role] ?? []).includes(status);
  const nextStep = canManageStatus ? NEXT_STEP[status] : undefined;
  const canCancel = (role === "assistencia" || role === "admin") && status !== "entregue" && status !== "cancelado";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {nextStep ? (
        <div className="flex items-end gap-2 flex-wrap">
          {nextStep.needsCarga ? (
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
              Nº da carga
              <input
                value={carga}
                onChange={(e) => setCarga(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
          ) : null}
          {nextStep.needsNfE ? (
            <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
              Nº da NF-e
              <input
                value={nfE}
                onChange={(e) => setNfE(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
          ) : null}
          <button
            disabled={pending || (nextStep.needsCarga && !carga.trim()) || (nextStep.needsNfE && !nfE.trim())}
            onClick={() =>
              run(
                () =>
                  advancePedidoStatus(pedidoId, nextStep.toStatus, {
                    carga: nextStep.needsCarga ? carga : undefined,
                    nfE: nextStep.needsNfE ? nfE : undefined,
                  }),
                `Status atualizado para ${PEDIDO_ENCOMENDA_STATUS_LABELS[nextStep.toStatus] ?? nextStep.toStatus}.`
              )
            }
            className="text-sm rounded px-3 py-2 border disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            {nextStep.label}
          </button>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {status === "entregue" || status === "cancelado" ? "Pedido encerrado." : "Nenhuma ação disponível para o seu papel neste momento."}
        </p>
      )}

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
              await addPedidoNoteAction(pedidoId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
        </button>
      </div>

      {canCancel ? (
        showCancel ? (
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              rows={2}
              placeholder="Motivo do cancelamento…"
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--status-critical)" }}
            />
            <div className="flex items-center gap-2">
              <button
                disabled={pending || !cancelNote.trim()}
                onClick={() =>
                  run(async () => {
                    await cancelPedido(pedidoId, cancelNote);
                    setCancelNote("");
                    setShowCancel(false);
                  }, "Pedido cancelado.")
                }
                className="text-sm rounded px-3 py-2 disabled:opacity-60"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                Confirmar cancelamento
              </button>
              <button onClick={() => setShowCancel(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCancel(true)}
            className="text-sm underline self-start pt-2"
            style={{ color: "var(--status-critical)", borderTop: "1px solid var(--gridline)" }}
          >
            Cancelar pedido
          </button>
        )
      ) : null}
    </div>
  );
}
