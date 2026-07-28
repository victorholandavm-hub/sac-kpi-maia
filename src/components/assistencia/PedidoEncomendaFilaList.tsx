"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkMarkEnviadoParaCD } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PedidoEncomendaStatusBadge } from "./PedidoEncomendaStatusBadge";
import { PEDIDO_ENCOMENDA_STATUS_COLORS } from "@/lib/assistenciaLabels";
import type { PedidoEncomendaSummary } from "@/lib/pedidosEncomenda";

// Único status de origem elegível pra seleção em lote hoje: fábrica termina a
// produção de vários pedidos e marca todos como "enviado para o CD" de uma
// vez, em vez de abrir pedido por pedido (ver bulkMarkEnviadoParaCD).
const BULK_ELIGIBLE_STATUS = "em_producao";

export function PedidoEncomendaFilaList({
  pedidos,
  queuePosition,
  actionStatuses,
  canBulkAdvance,
}: {
  pedidos: PedidoEncomendaSummary[];
  queuePosition: [string, number][];
  actionStatuses: string[];
  canBulkAdvance: boolean;
}) {
  const positionMap = new Map(queuePosition);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, run } = useQuickAction();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markSelected() {
    const ids = [...selected];
    const plural = ids.length > 1 ? "s" : "";
    run(async () => {
      await bulkMarkEnviadoParaCD(ids);
      setSelected(new Set());
    }, `${ids.length} pedido${plural} marcado${plural} como enviado para o CD.`);
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
          {pedidos.map((p) => {
            const needsAction = actionStatuses.includes(p.status);
            const eligible = canBulkAdvance && p.status === BULK_ELIGIBLE_STATUS;
            const position = positionMap.get(p.id);
            return (
              <div
                key={p.id}
                className="flex items-stretch"
                style={needsAction ? { borderLeft: "4px solid var(--status-warning)" } : undefined}
              >
                {canBulkAdvance ? (
                  <div className="flex items-center justify-center w-10 shrink-0">
                    {eligible ? (
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="w-4 h-4 cursor-pointer"
                        aria-label={`Selecionar pedido #${p.pedidoNumber}`}
                      />
                    ) : null}
                  </div>
                ) : null}
                <Link
                  href={`/assistencia/encomendas/fila/${p.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80 flex-1 min-w-0"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    {position ? (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap self-start"
                        style={{ color: "#fff", background: "var(--brand-orange)" }}
                      >
                        {position}º na fila
                      </span>
                    ) : null}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        #{p.pedidoNumber}
                      </span>
                      <PedidoEncomendaStatusBadge status={p.status} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {p.storeName}
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}
                    </p>
                    {p.clienteCodigo ? (
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        Cliente: {p.clienteCodigo}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{new Date(p.createdAt).toLocaleString("pt-BR")}</span>
                    <span>Pedido por {p.requestedByName}</span>
                    {p.prazoEntrega ? (
                      <span style={{ color: "var(--status-good)", fontWeight: 600 }}>
                        Previsão: {new Date(`${p.prazoEntrega}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                    {p.carga ? <span>Carga {p.carga}</span> : null}
                    {p.nfE ? <span>NF-e {p.nfE}</span> : null}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {selected.size > 0 ? (
        <div
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-40 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg flex-wrap"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <button
            disabled={pending}
            onClick={markSelected}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: PEDIDO_ENCOMENDA_STATUS_COLORS.pronto_para_expedicao, color: "#fff" }}
          >
            Marcar como enviado para o CD
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar seleção
          </button>
        </div>
      ) : null}
    </>
  );
}
