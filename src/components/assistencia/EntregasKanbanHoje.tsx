"use client";

import { useState } from "react";
import Link from "next/link";
import { DeliveryStatusBadge, type DeliveryStatusCounts } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { DELIVERY_TYPE_COLORS } from "./AssistenciaQueueGroup";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { driverNameForRota, JP_EXTRA_ROTA, type RotaDayOverview } from "@/lib/rotas";
import type { QueueGroup } from "@/lib/entregaQueueGrouping";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

// Quadro Kanban só pro dia de HOJE -- pedido do Victor 25/08/2026: "Para a
// operação de Hoje, um quadro estilo Kanban funciona muito bem: Coluna Sem
// Rota, Coluna por rota (com o motorista), ...". Os outros dias continuam
// na sanfona de sempre (EntregasGroupsList.tsx) -- só hoje é operação em
// tempo real o bastante pra justificar ver tudo lado a lado de uma vez.
// Sem arrastar-e-soltar entre colunas -- não foi pedido, e mudar
// rota/motorista de um card já tem fluxo próprio (dentro do detalhe do
// chamado); aqui é só uma visão, mais rápida de escanear que a sanfona.
//
// Subabas Programado/Concluído/Cancelado DENTRO de cada coluna -- pedido
// do Victor 29/08/2026: "tem como colocar dentro do kanban, dentro da
// rota mesmo duas subabas de programado/concluido/cancelado? porque hoje
// eu preciso rolar muito pra ver o que ja foi concluido e o que nao".
// Mesmos 3 baldes que a sanfona já usa só pra CONTAR (countByDeliveryStatus,
// DeliveryStatusBadge.tsx, pedido anterior do Victor 21/08/2026) -- aqui
// filtram de verdade quais cards aparecem, não só mostram o número.
// "use client" + useState por coluna (cada coluna escolhe sua aba
// independente das outras) -- estado local, não faz sentido guardar na
// URL (o kanban tem N colunas, uma por rota do dia). Começa em
// "Programado": é o que precisa de atenção agora; Concluído/Cancelado já
// estão resolvidos, só um clique de distância quando alguém quiser
// conferir.

type KanbanColumn = {
  key: string;
  rotaLabel: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  items: ServiceRequestSummary[];
  driverName: string | null;
};

// "Rota extra" genérica (ver JP_EXTRA_ROTA, rotas.ts) pode ter mais de um
// motorista atribuído no mesmo dia (Joalison, Eduardo, ...) -- todos
// compartilham o mesmo rotaKey="extra" salvo em cada chamado (só a UI de
// escolha distingue "Rota extra 1"/"Rota extra 2" na hora de agendar, ver
// labelAvailableRota). Primeiro achado do Victor 26/08/2026: "eu mudei o
// motorista, nao foi joalison, foi eduardo que fez, mas na tela ainda
// aparece joalison" -- um cabeçalho só pro grupo mostrava sempre o mesmo
// motorista (driverNameForRota pega a primeira atribuição extra do dia).
// Ajuste pedido em seguida, mesma conversa: "eu prefiro que seja dois
// cards diferentes no kanban, um para cada motorista" -- em vez de um card
// com o motorista errado (ou, na correção anterior, o nome certo repetido
// dentro de cada linha), o grupo "extra" agora vira uma COLUNA POR
// MOTORISTA, cada uma com seu cabeçalho certo -- mesmo tratamento visual
// que as rotas fixas (praia/sul/centro/CG) já tinham (um motorista, um
// cabeçalho). Rotas fixas continuam uma coluna só, sem mudança.
function buildColumns(groups: QueueGroup[], todayOverview: RotaDayOverview | null): KanbanColumn[] {
  return groups.flatMap((group): KanbanColumn[] => {
    if (group.rotaKey === JP_EXTRA_ROTA) {
      const byDriver = new Map<string, ServiceRequestSummary[]>();
      for (const r of group.items) {
        const driverKey = r.driverName ?? "";
        const list = byDriver.get(driverKey) ?? [];
        list.push(r);
        byDriver.set(driverKey, list);
      }
      // Sem motorista definido fica sempre por último -- mesmo raciocínio
      // de sortedOverview/pinSemRotaFirst: pendência não deve se misturar
      // no meio das colunas já resolvidas.
      return Array.from(byDriver.entries())
        .sort(([a], [b]) => {
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b, "pt-BR");
        })
        .map(([driverKey, items]) => ({
          key: `${group.key}_${driverKey || "sem_motorista"}`,
          rotaLabel: group.rotaLabel ?? group.label,
          headerBg: group.headerBg,
          headerText: group.headerText,
          borderColor: group.borderColor,
          items,
          driverName: driverKey || null,
        }));
    }
    const driverName =
      todayOverview && group.rotaKey && group.rotaKey !== "sem_rota" ? driverNameForRota(todayOverview, group.rotaKey) : null;
    return [
      {
        key: group.key,
        rotaLabel: group.rotaLabel ?? group.label,
        headerBg: group.headerBg,
        headerText: group.headerText,
        borderColor: group.borderColor,
        items: group.items,
        driverName,
      },
    ];
  });
}

export function EntregasKanbanHoje({ groups, todayOverview }: { groups: QueueGroup[]; todayOverview: RotaDayOverview | null }) {
  if (groups.length === 0) return null;
  const columns = buildColumns(groups, todayOverview);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        📌 Hoje
      </span>
      <div className="flex items-start gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {columns.map((column) => (
          <KanbanColumnCard key={column.key} column={column} />
        ))}
      </div>
    </div>
  );
}

type DeliveryStatusTab = "programado" | "concluido" | "cancelado";

// Mesmo balde de countByDeliveryStatus (DeliveryStatusBadge.tsx), só que
// por item em vez de agregado -- precisa pra FILTRAR quais cards
// aparecem em cada subaba, não só contar. Mantém a mesma regra (senão as
// subabas e os números do cabeçalho da coluna divergiam entre si).
function deliveryStatusTab(status: string): DeliveryStatusTab {
  if (status === "concluida") return "concluido";
  if (status === "cancelada") return "cancelado";
  return "programado";
}

const STATUS_TAB_LABELS: Record<DeliveryStatusTab, string> = {
  programado: "Programado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function KanbanColumnCard({ column }: { column: KanbanColumn }) {
  // Estado local por coluna -- cada rota escolhe sua subaba independente
  // das outras (ver comentário no topo do arquivo). Começa em
  // "programado" -- é o que precisa de atenção agora.
  const [tab, setTab] = useState<DeliveryStatusTab>("programado");
  const counts: DeliveryStatusCounts = { programado: 0, concluido: 0, cancelado: 0 };
  for (const r of column.items) counts[deliveryStatusTab(r.status)]++;
  const visibleItems = column.items.filter((r) => deliveryStatusTab(r.status) === tab);

  return (
    <div className="flex flex-col rounded-xl shrink-0 w-72 overflow-hidden" style={{ border: `2px solid ${column.borderColor}` }}>
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: column.headerBg }}>
        <span className="text-sm font-bold" style={{ color: column.headerText }}>
          {column.rotaLabel}
        </span>
        <span className="text-xs font-semibold" style={{ color: column.headerText, opacity: 0.85 }}>
          ({column.items.length})
        </span>
      </div>
      {column.driverName ? (
        <div className="px-3 py-1 text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          🚚 {column.driverName}
        </div>
      ) : null}
      <div className="flex items-center gap-1 px-2 pt-2" style={{ background: "var(--surface-1)" }}>
        {(Object.keys(STATUS_TAB_LABELS) as DeliveryStatusTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="text-[11px] px-2 py-1 rounded-full whitespace-nowrap font-medium"
            style={
              tab === t
                ? { background: "var(--brand-green)", color: "var(--brand-green-ink)" }
                : { border: "1px solid var(--border)", color: "var(--text-secondary)" }
            }
          >
            {STATUS_TAB_LABELS[t]} ({counts[t]})
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[65vh]" style={{ background: "var(--surface-1)" }}>
        {visibleItems.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
            Nada em &quot;{STATUS_TAB_LABELS[tab]}&quot; aqui.
          </p>
        ) : (
          visibleItems.map((r) => <KanbanCard key={r.id} r={r} />)
        )}
      </div>
    </div>
  );
}

// Card compacto, empilhado -- diferente do EntregaCardRow (fila/sanfona),
// pensado pra ficar largo (linha inteira, 6 colunas percentuais); numa
// coluna de Kanban de ~280px isso ficaria ilegível, então é um card
// vertical novo, não reaproveitado dali.
function KanbanCard({ r }: { r: ServiceRequestSummary }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg p-2.5 shadow-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--gridline)" }}>
      {/* Campos que navegam pro chamado -- display:contents (mesmo padrão
          de EntregaCardRow/VisitaCardRow) pra Ver produtos, fora do link,
          continuar clicável sem disparar navegação. */}
      <Link href={`/assistencia/${r.id}`} className="contents">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            #{r.ticketNumber}
          </span>
          <div className="flex items-center gap-1">
            <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
            <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
          </div>
        </div>
        {/* Caixa alta -- pedido do Victor 25/08/2026 ("guia de
            padronização"): "Nome do Cliente (Bold, caixa alta)", mesmo
            tratamento de AssistenciaQueueGroup.tsx. */}
        <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
          {r.clientName ?? "Sem nome de cliente"}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {r.clientPhone ?? "—"} · {r.clientNeighborhood ?? "—"}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: DELIVERY_TYPE_COLORS[r.type] ?? "var(--text-muted)", color: "#fff" }}
          >
            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
          </span>
          {r.scheduledTime ? (
            <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              🕐 {r.scheduledTime.slice(0, 5)}
            </span>
          ) : null}
        </div>
      </Link>
      <ProductsModalButton items={r.items} />
    </div>
  );
}
