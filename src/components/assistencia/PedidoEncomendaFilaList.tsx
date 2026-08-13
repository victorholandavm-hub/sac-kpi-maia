"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkMarkEnviadoParaCD } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PedidoEncomendaStatusBadge } from "./PedidoEncomendaStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { PEDIDO_ENCOMENDA_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { prazoUrgencyStyle } from "@/lib/prazoStyle";
import type { PedidoEncomendaSummary } from "@/lib/pedidosEncomenda";

// Único status de origem elegível pra seleção em lote hoje: fábrica termina a
// produção de vários pedidos e marca todos como "enviado para o CD" de uma
// vez, em vez de abrir pedido por pedido (ver bulkMarkEnviadoParaCD).
const BULK_ELIGIBLE_STATUS = "em_producao";

// A partir daqui o pedido já saiu da fábrica -- o prazo fábrica→CD já foi
// cumprido ou não, mas deixou de ser um prazo "vivo" (ver
// chegadaCdByPedido/prazoFabricaCd abaixo).
const JA_SAIU_DA_FABRICA: PedidoEncomendaSummary["status"][] = [
  "pronto_para_expedicao",
  "recebido_cd",
  "em_carga",
  "faturado",
  "entregue",
];

export function PedidoEncomendaFilaList({
  pedidos,
  queuePosition,
  actionNeededIds,
  canBulkAdvance,
  chegadaCdByPedido,
}: {
  pedidos: PedidoEncomendaSummary[];
  queuePosition: [string, number][];
  actionNeededIds: Set<string>;
  canBulkAdvance: boolean;
  // Data real (não prazo) em que cada pedido chegou no CD -- ver
  // getChegadaCdDates (pedidosEncomenda.ts). Ausente quando o pedido ainda
  // não passou por lá.
  chegadaCdByPedido: Record<string, string>;
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
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
          {pedidos.map((p) => {
            const needsAction = actionNeededIds.has(p.id);
            const fornecedorLabel = p.fornecedorTipo === "fabrica_externa" ? `Externo: ${p.fornecedorExterno}` : p.fabricaNome;
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
                {/* Selo compacto e fixo à esquerda -- pista visual imediata da ordem da
                    fila, sem depender de ler o resto do texto. */}
                <div className="flex items-center justify-center w-9 shrink-0">
                  {position ? (
                    <div
                      className="rounded flex flex-col items-center justify-center px-1 py-0.5 shrink-0 leading-none"
                      style={{ background: "var(--brand-green)", color: "#fff" }}
                    >
                      <span className="text-sm font-bold">{position}º</span>
                      <span className="text-[7px] font-semibold uppercase tracking-wide">na fila</span>
                    </div>
                  ) : null}
                </div>
                <Link
                  href={`/assistencia/encomendas/fila/${p.id}`}
                  className="flex items-center justify-between gap-4 p-4 flex-wrap hover:opacity-80 flex-1 min-w-0"
                >
                  <div className="flex flex-col gap-1 min-w-0 w-0 grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        #{p.pedidoNumber}
                      </span>
                      <PedidoEncomendaStatusBadge status={p.status} />
                      <NewSinceBadge createdAt={p.createdAt} storageKey="fila-encomendas-last-seen" />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {p.storeName}
                      </span>
                      {fornecedorLabel ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                        >
                          {fornecedorLabel}
                        </span>
                      ) : null}
                    </div>
                    {p.items.length > 1 ? (
                      <ul className="text-sm list-disc pl-4" style={{ color: "var(--text-secondary)" }}>
                        {p.items.map((i, idx) => (
                          <li key={idx} className="truncate">
                            {i.quantidade}x {i.produtoDescricao}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                        {p.items.map((i) => `${i.quantidade}x ${i.produtoDescricao}`).join(", ")}
                      </p>
                    )}
                    {p.clienteCodigo ? (
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        Cliente: {p.clienteCodigo}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-bold" style={{ color: "var(--text-secondary)" }}>
                      {new Date(p.createdAt).toLocaleString("pt-BR")}
                    </span>
                    <span>Pedido por {p.requestedByName}</span>
                    {/* Antes de sair da fábrica: o prazo fábrica→CD é o que
                        vale, com cor de urgência (pode estourar). Depois de
                        sair: esse prazo já foi cumprido ou não, não é mais
                        "vivo" -- troca pela data real de chegada (fato, sem
                        cor de urgência) assim que ela existir. */}
                    {!JA_SAIU_DA_FABRICA.includes(p.status) && p.prazoFabricaCd ? (
                      <span style={prazoUrgencyStyle(p.prazoFabricaCd)}>
                        🕐 Prazo p/ CD: {new Date(`${p.prazoFabricaCd}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                    {JA_SAIU_DA_FABRICA.includes(p.status) && chegadaCdByPedido[p.id] ? (
                      <span>📦 Chegou no CD: {new Date(chegadaCdByPedido[p.id]).toLocaleDateString("pt-BR")}</span>
                    ) : null}
                    {p.prazoCdLoja ? (
                      <span style={prazoUrgencyStyle(p.prazoCdLoja)}>
                        🕐 Prazo p/ loja: {new Date(`${p.prazoCdLoja}T00:00:00`).toLocaleDateString("pt-BR")}
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
