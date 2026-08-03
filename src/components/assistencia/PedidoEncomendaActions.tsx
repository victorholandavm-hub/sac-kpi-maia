"use client";

import { useEffect, useState } from "react";
import {
  advancePedidoStatus,
  cancelPedido,
  denyPedido,
  addPedidoNoteAction,
  searchNfSuggestions,
  updatePedidoFornecedorAction,
} from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PEDIDO_ENCOMENDA_STATUS_LABELS, PEDIDO_ENCOMENDA_STATUS_COLORS } from "@/lib/assistenciaLabels";
import type { TotvsOrderSuggestion } from "@/lib/totvsLookup";
import { INTERNAL_FABRICAS, EXTERNAL_FABRICAS } from "@/lib/fabricas";
import { FormSection } from "./FormSection";

type NextStep = {
  toStatus: string;
  label: string;
  needsCarga?: boolean;
  needsNfE?: boolean;
  needsPrazoFabricaCd?: boolean;
  needsPrazoCdLoja?: boolean;
};

const NEXT_STEP: Record<string, NextStep | undefined> = {
  em_producao: { toStatus: "pronto_para_expedicao", label: "Marcar como enviado para o CD" },
  pronto_para_expedicao: { toStatus: "em_carga", label: "Informar carga e expedir", needsCarga: true, needsPrazoCdLoja: true },
  em_carga: { toStatus: "faturado", label: "Informar NF-e e faturar", needsNfE: true },
  faturado: { toStatus: "entregue", label: "Marcar entregue" },
};

// "Solicitado" é o único passo que muda de dono conforme o fornecedor:
// fábrica própria aceita e produz; fornecedor externo não tem etapa de
// produção pra acompanhar, então o CD assume direto (ver requireEncomendaAction,
// src/lib/dal.ts).
function getNextStep(status: string, fornecedorTipo: "fabrica_interna" | "fabrica_externa"): NextStep | undefined {
  if (status === "solicitado") {
    return fornecedorTipo === "fabrica_externa"
      ? { toStatus: "pronto_para_expedicao", label: "Marcar como enviado para o CD", needsPrazoFabricaCd: true }
      : { toStatus: "em_producao", label: "Marcar em produção", needsPrazoFabricaCd: true };
  }
  return NEXT_STEP[status];
}

// Cada papel só vê o próximo passo se ele de fato pode executá-lo — o
// servidor (requireEncomendaAction em src/lib/dal.ts) já barra o resto, isso
// aqui é só pra não mostrar um botão que vai dar erro.
const ROLE_CAN_ADVANCE_INTERNA: Record<string, string[]> = {
  fabrica: ["solicitado", "em_producao"],
  cd: ["pronto_para_expedicao", "em_carga", "faturado"],
};
const ROLE_CAN_ADVANCE_EXTERNA: Record<string, string[]> = {
  cd: ["solicitado", "pronto_para_expedicao", "em_carga", "faturado"],
};

export function PedidoEncomendaActions({
  pedidoId,
  status,
  role,
  storeId,
  prazoFabricaCd,
  prazoCdLoja,
  fornecedorTipo,
  fabricaId,
  fornecedorExterno,
  matchesFabrica,
}: {
  pedidoId: string;
  status: string;
  role: string;
  storeId: string;
  prazoFabricaCd: string | null;
  prazoCdLoja: string | null;
  fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  fabricaId: string | null;
  fornecedorExterno: string | null;
  matchesFabrica: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [carga, setCarga] = useState("");
  const [nfE, setNfE] = useState("");
  const [nfSuggestions, setNfSuggestions] = useState<TotvsOrderSuggestion[]>([]);
  const [note, setNote] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [showFornecedor, setShowFornecedor] = useState(false);
  const [novoFornecedorTipo, setNovoFornecedorTipo] = useState<"fabrica_interna" | "fabrica_externa">(fornecedorTipo);
  const [novaFabricaId, setNovaFabricaId] = useState(fabricaId ?? INTERNAL_FABRICAS[0].id);
  const [novoFornecedorExterno, setNovoFornecedorExterno] = useState(fornecedorExterno ?? EXTERNAL_FABRICAS[0]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nfE.trim().length < 2) {
        setNfSuggestions([]);
        return;
      }
      searchNfSuggestions(nfE, storeId)
        .then(setNfSuggestions)
        .catch(() => setNfSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [nfE, storeId]);

  const externo = fornecedorTipo === "fabrica_externa";
  const roleCanAdvanceTable = externo ? ROLE_CAN_ADVANCE_EXTERNA : ROLE_CAN_ADVANCE_INTERNA;
  const canManageStatus =
    role === "assistencia" ||
    role === "admin" ||
    ((roleCanAdvanceTable[role] ?? []).includes(status) && (role !== "fabrica" || matchesFabrica));
  const nextStep = canManageStatus ? getNextStep(status, fornecedorTipo) : undefined;
  const canCancel = (role === "assistencia" || role === "admin") && status !== "entregue" && status !== "cancelado";
  const canDeny =
    (role === "assistencia" || role === "admin" || (role === "fabrica" && !externo && matchesFabrica) || role === "cd") &&
    status === "solicitado";
  // Só quem enxerga o fluxo inteiro corrige o destino do pedido -- nunca
  // fábrica/loja, que são justamente quem erra o destino (ver
  // updatePedidoFornecedorAction).
  const canCorrectFornecedor = (role === "assistencia" || role === "admin" || role === "cd") && status === "solicitado";

  return (
    <FormSection title="Ações">
      {nextStep && nextStep.needsPrazoFabricaCd && !prazoFabricaCd ? (
        <p className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
          Defina o &ldquo;Prazo fábrica → CD&rdquo; acima antes de avançar.
        </p>
      ) : null}
      {nextStep && nextStep.needsPrazoCdLoja && !prazoCdLoja ? (
        <p className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
          Defina o &ldquo;Prazo CD → loja&rdquo; acima antes de avançar.
        </p>
      ) : null}

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
                list={`nf-suggestions-${pedidoId}`}
                autoComplete="off"
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
              <datalist id={`nf-suggestions-${pedidoId}`}>
                {nfSuggestions.map((s) => (
                  <option key={s.invoice} value={s.invoice}>
                    {[s.clientName, s.invoiceTotal ? `R$ ${s.invoiceTotal.toFixed(2)}` : null].filter(Boolean).join(" — ")}
                  </option>
                ))}
              </datalist>
            </label>
          ) : null}
          <button
            disabled={
              pending ||
              (nextStep.needsCarga && !carga.trim()) ||
              (nextStep.needsNfE && !nfE.trim()) ||
              (nextStep.needsPrazoFabricaCd && !prazoFabricaCd) ||
              (nextStep.needsPrazoCdLoja && !prazoCdLoja)
            }
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
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: PEDIDO_ENCOMENDA_STATUS_COLORS[nextStep.toStatus] ?? "var(--brand-green)", color: "#fff" }}
          >
            {nextStep.label}
          </button>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {status === "entregue" || status === "cancelado" || status === "negado"
            ? "Pedido encerrado."
            : "Nenhuma ação disponível para o seu papel neste momento."}
        </p>
      )}

      {canDeny ? (
        showDeny ? (
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
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
                    await denyPedido(pedidoId, denyReason);
                    setDenyReason("");
                    setShowDeny(false);
                  }, "Pedido negado.")
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
          <button
            onClick={() => setShowDeny(true)}
            className="text-sm underline self-start pt-2"
            style={{ color: "var(--status-critical)", borderTop: "1px solid var(--gridline)" }}
          >
            Negar pedido
          </button>
        )
      ) : null}

      {canCorrectFornecedor ? (
        showFornecedor ? (
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Corrige o destino do pedido (fábrica própria ou fornecedor externo). Não avisa quem já foi notificado do
              destino errado — só quem passa a ver o pedido a partir de agora.
            </p>
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-primary)" }}>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={novoFornecedorTipo === "fabrica_interna"}
                  onChange={() => setNovoFornecedorTipo("fabrica_interna")}
                />
                Fábrica própria
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={novoFornecedorTipo === "fabrica_externa"}
                  onChange={() => setNovoFornecedorTipo("fabrica_externa")}
                />
                Fornecedor externo
              </label>
            </div>
            {novoFornecedorTipo === "fabrica_interna" ? (
              <select
                value={novaFabricaId}
                onChange={(e) => setNovaFabricaId(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                {INTERNAL_FABRICAS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={novoFornecedorExterno}
                onChange={(e) => setNovoFornecedorExterno(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                {EXTERNAL_FABRICAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await updatePedidoFornecedorAction(pedidoId, {
                      fornecedorTipo: novoFornecedorTipo,
                      fabricaId: novoFornecedorTipo === "fabrica_interna" ? novaFabricaId : null,
                      fornecedorExterno: novoFornecedorTipo === "fabrica_externa" ? novoFornecedorExterno : null,
                    });
                    setShowFornecedor(false);
                  }, "Fornecedor corrigido.")
                }
                className="text-sm rounded px-3 py-2 disabled:opacity-60"
                style={{ background: "var(--brand-orange)", color: "#fff" }}
              >
                Confirmar correção
              </button>
              <button onClick={() => setShowFornecedor(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowFornecedor(true)}
            className="text-sm underline self-start pt-2"
            style={{ color: "var(--brand-orange)", borderTop: "1px solid var(--gridline)" }}
          >
            Corrigir fábrica/fornecedor
          </button>
        )
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
    </FormSection>
  );
}
