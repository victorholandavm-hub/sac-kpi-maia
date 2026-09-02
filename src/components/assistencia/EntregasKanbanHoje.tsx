"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryStatusBadge, type DeliveryStatusCounts } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { DELIVERY_TYPE_COLORS } from "./AssistenciaQueueGroup";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { driverNameForRota, JP_EXTRA_ROTA, type RotaDayOverview } from "@/lib/rotas";
import type { QueueGroup } from "@/lib/entregaQueueGrouping";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

// Quadro do dia de HOJE -- pedido do Victor 25/08/2026: "Para a operação
// de Hoje, um quadro estilo Kanban funciona muito bem: Coluna Sem Rota,
// Coluna por rota (com o motorista), ...". Os outros dias continuam na
// sanfona de sempre (EntregasGroupsList.tsx) -- só hoje é operação em
// tempo real o bastante pra justificar ver tudo de uma vez.
//
// Reformulado 01/09/2026 -- pedido do Victor: "em vez de caixas verticais
// empilhadas, crie uma linha horizontal de cards resumidos... cada card
// de rota deve ter apenas mini-badges discretos com a contagem" + "exiba
// a listagem em formato de Tabela Grid Horizontal Limpa". O Kanban de
// colunas com cartão por chamado (um por rota, rolagem lateral) virou
// duas peças: (1) uma fileira de cards de RESUMO por rota (só contagem +
// motorista, sem lista de chamado nenhuma dentro) e (2) uma tabela única,
// achatada, com todos os chamados de hoje juntos -- "Rota/Motorista"
// passa a ser só mais uma COLUNA da tabela, não mais o critério de
// agrupamento visual. As subabas Programado/Concluído/Cancelado (pedido
// do Victor 29/08/2026, ver abaixo) deixam de ser por coluna e viram um
// filtro único acima da tabela -- mesma função, um lugar só.
type KanbanColumn = {
  key: string;
  rotaLabel: string;
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
// dentro de cada linha), o grupo "extra" agora vira um CARD POR MOTORISTA,
// cada um com seu cabeçalho certo -- mesmo tratamento que as rotas fixas
// (praia/sul/centro/CG) já tinham (um motorista, um card). Rotas fixas
// continuam um card só, sem mudança.
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
        borderColor: group.borderColor,
        items: group.items,
        driverName,
      },
    ];
  });
}

type DeliveryStatusTab = "todos" | "programado" | "concluido" | "cancelado";

// Mesmo balde de countByDeliveryStatus (DeliveryStatusBadge.tsx), só que
// por item em vez de agregado -- precisa pra FILTRAR quais linhas
// aparecem em cada aba, não só contar. Mantém a mesma regra (senão a
// aba e os números do resumo por rota divergiam entre si).
function deliveryStatusTab(status: string): Exclude<DeliveryStatusTab, "todos"> {
  if (status === "concluida") return "concluido";
  if (status === "cancelada") return "cancelado";
  return "programado";
}

const STATUS_TAB_LABELS: Record<DeliveryStatusTab, string> = {
  todos: "Todos",
  programado: "Programado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// Mesma cor de cada opção equivalente na fileira de filtros de cima
// (ENTREGA_FILTERS, entregaQueueGrouping.ts: Todas/Programado/Concluídas/
// Canceladas) -- pedido do Victor 02/09/2026: quando a aba está
// selecionada, fica com a cor real dessa mesma régua; não selecionada
// continua neutra, do jeito que já era.
const STATUS_TAB_COLORS: Record<DeliveryStatusTab, string> = {
  todos: "var(--text-secondary)",
  programado: "var(--brand-green)",
  concluido: "var(--status-good)",
  cancelado: "var(--text-muted)",
};

// Badge de contagem discreto -- Guia de Componentes Maia (Design System,
// 01/09/2026): "mini-badges discretos com a contagem, de forma muito
// limpa". Cinza neutro pro estado padrão (Programado), verde suave pra
// Concluído, cinza apagado pra Cancelado -- mesma régua de cor de
// StatusBadge.tsx, sem inventar paleta nova só pra esse resumo.
function CountBadge({ label, count, tone }: { label: string; count: number; tone: "neutral" | "good" | "muted" }) {
  const styles =
    tone === "good"
      ? { background: "#E8F0EC", color: "#164A30" }
      : tone === "muted"
        ? { background: "#F3F4F6", color: "#9CA3AF" }
        : { background: "#F3F4F6", color: "#4B5563" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={styles}>
      {count} {label}
    </span>
  );
}

// Card de RESUMO por rota -- linha horizontal (grid), não mais coluna de
// Kanban com cartão por chamado dentro. Só o essencial pra bater o olho:
// rota, motorista, três contagens.
function RouteSummaryCard({ column }: { column: KanbanColumn }) {
  const counts: DeliveryStatusCounts = { programado: 0, concluido: 0, cancelado: 0 };
  for (const r of column.items) counts[deliveryStatusTab(r.status)]++;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3" style={{ borderLeft: `3px solid ${column.borderColor}` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{column.rotaLabel}</span>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500 shrink-0">
          {column.items.length}
        </span>
      </div>
      <span className="text-xs text-gray-500">{column.driverName ? `🚚 ${column.driverName}` : "Sem motorista"}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <CountBadge label="programado" count={counts.programado} tone="neutral" />
        <CountBadge label="concluído" count={counts.concluido} tone="good" />
        <CountBadge label="cancelado" count={counts.cancelado} tone="muted" />
      </div>
    </div>
  );
}

type FlatRow = { r: ServiceRequestSummary; rotaLabel: string; driverName: string | null };

// Linha da tabela -- Guia de Componentes Maia: "ID/Tipo, Cliente (Nome +
// Telefone menor abaixo), Produto (texto corrido em linha), Rota/
// Motorista Atual, Situação, Ações (link sutil 'Ver produtos')". Avisos
// que antes eram tags à parte (urgente, "novo desde") viram indicadores
// compactos dentro da própria coluna Situação -- a informação continua
// ali, só sem virar uma sétima coluna.
function TodayRow({ row }: { row: FlatRow }) {
  const { r } = row;
  const router = useRouter();
  // Linha inteira clicável -- pedido do Victor 01/09/2026: "ao clicar na
  // demanda, ela abra completa, e não apenas ao clicar em 'abrir'". Não dá
  // pra embrulhar um <tr> inteiro num <Link> (HTML inválido dentro de
  // <table>, o navegador expulsa a <a> pra fora e quebra o layout) --
  // onClick no próprio <tr> + cursor-pointer é o equivalente aqui.
  // ProductsModalButton já para propagação no próprio clique (stopPropagation),
  // então continua abrindo só o modal, sem navegar.
  // Concluída fica levemente apagada -- pedido do Victor 02/09/2026:
  // "as que estiverem como concluída devem ficar levemente apagadas em
  // relação as outras" -- só concluída, cancelada/programado continuam
  // no contraste normal.
  return (
    <tr
      onClick={() => router.push(`/assistencia/${r.id}`)}
      className={`hover:bg-gray-50 transition-colors duration-150 cursor-pointer ${r.status === "concluida" ? "opacity-60" : ""}`}
    >
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <div className="font-mono text-xs text-gray-400">#{r.ticketNumber}</div>
        <span
          className="inline-flex mt-1 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap"
          style={{ background: DELIVERY_TYPE_COLORS[r.type] ?? "#9CA3AF" }}
        >
          {REQUEST_TYPE_LABELS[r.type] ?? r.type}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-800 truncate">{r.clientName ?? "Sem nome de cliente"}</span>
          <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
        </div>
        {/* Telefone + bairro -- mesma dupla que o card antigo mostrava
            (bairro tinha sumido na reformulação de 01/09/2026, restaurado
            aqui: continua sendo dado que a rota/motorista precisa). */}
        <div className="text-xs text-gray-400 font-mono">
          {r.clientPhone ?? "—"}
          {r.clientNeighborhood ? ` · ${r.clientNeighborhood}` : ""}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-gray-600 max-w-[260px] truncate" title={r.items.map((i) => i.product).join(", ")}>
        {r.items.map((i) => i.product).join(", ") || "—"}
      </td>
      <td className="px-4 py-3 align-top text-gray-600 whitespace-nowrap">
        <div>{row.rotaLabel}</div>
        <div className="text-xs text-gray-400">{row.driverName ? `🚚 ${row.driverName}` : "Sem motorista"}</div>
        {/* Responsável -- pedido do Victor 02/09/2026: "que apareça quem é
            o responsável por aquela demanda já na lista". */}
        <div className="text-xs text-gray-400">Responsável: {r.assignedToName ?? "—"}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
          {/* Horário agendado -- também tinha sumido na reformulação,
              restaurado (o card antigo mostrava "🕐 HH:MM"). */}
          {r.scheduledTime ? <span className="text-[10px] text-gray-400 whitespace-nowrap">🕐 {r.scheduledTime.slice(0, 5)}</span> : null}
          {r.urgent ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap text-white" style={{ background: "var(--status-critical)" }}>
              URGENTE
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <ProductsModalButton items={r.items} />
      </td>
    </tr>
  );
}

export function EntregasKanbanHoje({
  groups,
  todayOverview,
  motoristaAction,
}: {
  groups: QueueGroup[];
  todayOverview: RotaDayOverview | null;
  // Botão "Gestão de Motoristas & Escala" (RotaMotoristaDoDia, modo
  // buttonOnly) -- pedido do Victor 02/09/2026: "deve ficar ao lado de
  // 'hoje' e só o botão". Renderizado como slot em vez de importado
  // direto aqui pra não criar dependência circular de dados (o botão
  // precisa de today/overview/drivers, que já vêm resolvidos na página
  // que também busca `groups`/`todayOverview`).
  motoristaAction?: React.ReactNode;
}) {
  const [tab, setTab] = useState<DeliveryStatusTab>("todos");
  if (groups.length === 0) return null;
  const columns = buildColumns(groups, todayOverview);

  const allRows: FlatRow[] = columns.flatMap((column) =>
    column.items.map((r) => ({ r, rotaLabel: column.rotaLabel, driverName: column.driverName }))
  );
  const counts: DeliveryStatusCounts = { programado: 0, concluido: 0, cancelado: 0 };
  for (const row of allRows) counts[deliveryStatusTab(row.r.status)]++;
  const visibleRows = tab === "todos" ? allRows : allRows.filter((row) => deliveryStatusTab(row.r.status) === tab);

  return (
    <div className="flex flex-col gap-3">
      {/* Quadrado verde + letra branca -- pedido do Victor 02/09/2026,
          mesmo tratamento do indicador ativo do segmented control
          Visitas/Entregas/Agenda e do mês aberto (MonthAccordion.tsx).
          "Gestão de Motoristas & Escala" ao lado -- pedido do Victor
          02/09/2026: "deve ficar ao lado de 'hoje' e só o botão". */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="text-xs font-semibold uppercase tracking-wider text-white rounded-md shadow-sm px-2.5 py-1"
          style={{ background: "#1B5E3C" }}
        >
          📌 Hoje
        </span>
        {motoristaAction}
      </div>

      {/* Resumo horizontal por rota -- grid de 4 colunas em telas largas,
          empilha em telas menores. Só contagem + motorista, sem lista de
          chamado nenhuma dentro (essa mudou pra tabela única abaixo). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((column) => (
          <RouteSummaryCard key={column.key} column={column} />
        ))}
      </div>

      {/* Filtro único Todos/Programado/Concluído/Cancelado -- substitui as
          subabas por coluna de antes (pedido do Victor 29/08/2026), agora
          um lugar só pra tabela achatada inteira. */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-1 self-start">
        {(Object.keys(STATUS_TAB_LABELS) as DeliveryStatusTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              tab === t ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={tab === t ? { background: `color-mix(in srgb, ${STATUS_TAB_COLORS[t]} 78%, black)` } : undefined}
          >
            {STATUS_TAB_LABELS[t]}
            {t !== "todos" ? (
              <span className={`ml-1 text-xs font-mono ${tab === t ? "text-white/80" : "text-gray-400"}`}>
                ({counts[t as Exclude<DeliveryStatusTab, "todos">]})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tabela Grid Horizontal Limpa -- Guia de Componentes Maia (Design
          System, 01/09/2026): fim das caixas de texto espremidas do
          Kanban antigo. */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["ID / Tipo", "Cliente", "Produto", "Rota / Motorista", "Situação", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  Nada em &quot;{STATUS_TAB_LABELS[tab]}&quot; aqui.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => <TodayRow key={row.r.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
