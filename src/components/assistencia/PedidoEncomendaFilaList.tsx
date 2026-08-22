"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkMarkEnviadoParaCD } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PedidoEncomendaStatusBadge } from "./PedidoEncomendaStatusBadge";
import { StatusStepper } from "./StatusStepper";
import { NewSinceBadge } from "./NewSinceBadge";
import { PEDIDO_ENCOMENDA_STATUS_COLORS, PEDIDO_ENCOMENDA_STATUS_STEPS } from "@/lib/assistenciaLabels";
import { prazoUrgencyStyle } from "@/lib/prazoStyle";
import { groupByDeadline } from "@/lib/encomendaDeadline";
import type { PedidoEncomendaSummary } from "@/lib/pedidosEncomenda";

// Estados fora do caminho linear -- mesmo critério do StatusStepper na tela
// de detalhe (fila/[id]/page.tsx): continuam com a tag simples, o stepper só
// faz sentido pra quem está de fato andando pela sequência
// solicitado→em_producao→...→entregue.
const STEPPER_EXCLUDED: PedidoEncomendaSummary["status"][] = ["cancelado", "negado", "recebido_cd"];

// Único status de origem elegível pra seleção em lote hoje: fábrica termina a
// produção de vários pedidos e marca todos como "enviado para o CD" de uma
// vez, em vez de abrir pedido por pedido (ver bulkMarkEnviadoParaCD).
const BULK_ELIGIBLE_STATUS = "em_producao";

// A partir daqui o CD já confirmou o pedido de alguma forma (botou em carga
// ou marcou recebido/em estoque) -- só nesse ponto existe uma data real de
// chegada pra mostrar. "pronto_para_expedicao" fica DE FORA de propósito:
// é a fábrica dizendo "enviei", não o CD confirmando "recebi", então o
// prazo fábrica→CD continua sendo a informação que vale até o CD agir de
// verdade (ver chegadaCdByPedido/getChegadaCdDates em pedidosEncomenda.ts).
const CD_JA_CONFIRMOU: PedidoEncomendaSummary["status"][] = ["recebido_cd", "em_carga", "faturado", "entregue"];

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
      <div className="flex flex-col gap-3">
        {groupByDeadline(pedidos).map((group) => (
          <details key={group.dateKey} className="group flex flex-col gap-1.5" open>
            <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }}>
                ▶
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {group.label}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                ({group.pedidos.length})
              </span>
            </summary>
            <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
              <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
                {group.pedidos.map((p) => {
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
                          {/* Linha de progresso visual em vez da tag de status --
                              pedido do Victor 22/08/2026: "Substitua as tags de
                              status por uma linha de progresso visual...
                              Solicitado ➔ Em Produção ➔ Enviado para CD ➔
                              Entregue. Isso elimina dúvidas entre a fábrica... e
                              a loja... sem precisar perguntar". Estados fora do
                              caminho linear continuam com a tag (ver
                              STEPPER_EXCLUDED). */}
                          {STEPPER_EXCLUDED.includes(p.status) ? (
                            <PedidoEncomendaStatusBadge status={p.status} />
                          ) : (
                            <StatusStepper steps={PEDIDO_ENCOMENDA_STATUS_STEPS} currentKey={p.status} compact />
                          )}
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
                          {/* Prazo fábrica→CD continua valendo até o CD confirmar
                              de verdade (botar em carga / marcar recebido) --
                              "enviado para o CD" sozinho é só a fábrica dizendo
                              que despachou, não prova que chegou. Só depois da
                              confirmação do CD troca pela data real de chegada
                              (fato, sem cor de urgência). */}
                          {!CD_JA_CONFIRMOU.includes(p.status) && p.prazoFabricaCd ? (
                            <span style={prazoUrgencyStyle(p.prazoFabricaCd)}>
                              🕐 Prazo p/ CD: {new Date(`${p.prazoFabricaCd}T00:00:00`).toLocaleDateString("pt-BR")}
                            </span>
                          ) : null}
                          {CD_JA_CONFIRMOU.includes(p.status) && chegadaCdByPedido[p.id] ? (
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
          </details>
        ))}
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
