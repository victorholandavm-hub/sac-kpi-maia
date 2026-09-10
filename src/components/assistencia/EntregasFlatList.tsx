"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { DELIVERY_TYPE_COLORS } from "./AssistenciaQueueGroup";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { ROTA_LABELS } from "@/lib/rotas";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";

// Lista única, sem agrupar por mês/semana/rota -- pedido do Victor
// 03/09/2026: "queria testar as listas de agenda, visitas e entregas para
// que ficassem em uma lista e nao mais agrupadas por semana/mês", com uma
// tela de referência (tabela simples, uma linha por registro, sem
// acordeão nenhum). Mesmo desenho de tabela que "Hoje" já usa
// (EntregasKanbanHoje.tsx: ID/Tipo, Cliente, Produto, Rota/Motorista,
// Situação, Ações) -- só que pra TODOS os registros de uma vez (não só
// hoje), direto de `r.rota`/`r.driverName` (já vem no próprio registro,
// sem precisar da resolução por coluna que "Hoje" faz pra saber o
// motorista do dia). Substitui EntregasWeekGroups nessa aba.
//
// Ordenado por data agendada (mais próxima/atrasada primeiro) -- sem
// agrupamento nenhum pra "ancorar" a ordem visualmente, precisa de um
// critério cronológico claro. Sem data agendada fica no fim (mesmo
// critério de baixa prioridade que o agrupamento antigo já dava pro
// "sem data definida").
function sortByScheduledDate(items: ServiceRequestSummary[]): ServiceRequestSummary[] {
  return [...items].sort((a, b) => {
    if (!a.scheduledDate && !b.scheduledDate) return 0;
    if (!a.scheduledDate) return 1;
    if (!b.scheduledDate) return -1;
    return a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "");
  });
}

function EntregaFlatRow({ r, selected, onToggleSelected }: { r: ServiceRequestSummary; selected: boolean; onToggleSelected: () => void }) {
  const router = useRouter();
  const rotaLabel = r.rota ? (ROTA_LABELS[r.rota] ?? r.rota) : "Sem rota";
  return (
    <tr
      onClick={() => router.push(`/assistencia/${r.id}`)}
      // Concluída e cancelada ficam levemente apagadas -- mesmo tratamento
      // de TodayRow (EntregasKanbanHoje.tsx), pedido do Victor 10/09/2026
      // estendido pra essa lista também.
      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer ${r.status === "concluida" || r.status === "cancelada" ? "opacity-60" : ""}`}
    >
      {/* Checkbox de seleção em bloco (ver toggleSelected/EntregasFlatList
          abaixo) -- para propagação, senão marcar pra imprimir também
          navegaria pro chamado (mesmo padrão de TodayRow em
          EntregasKanbanHoje.tsx). */}
      <td className="pl-4 pr-2 py-3 align-top" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggleSelected} className="rounded" aria-label={`Selecionar #${r.ticketNumber}`} />
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <div className="font-mono text-xs text-gray-400 dark:text-gray-500">#{r.ticketNumber}</div>
        <span
          className="inline-flex mt-1 items-center rounded-full px-1.5 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
          style={{ background: DELIVERY_TYPE_COLORS[r.type] ?? "#9CA3AF" }}
        >
          {REQUEST_TYPE_LABELS[r.type] ?? r.type}
        </span>
        {/* Data agendada logo abaixo do tipo -- pedido do Victor 03/09/2026
            (print de referência). Saiu da coluna Situação, que agora só
            tem status + urgente. Tipo/data um pouco maiores (text-[10px] ->
            text-xs) -- pedido do Victor 03/09/2026, mesma revisão. */}
        {r.scheduledDate ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap mt-1">
            📅 {new Date(`${r.scheduledDate}T00:00:00`).toLocaleDateString("pt-BR")}
            {r.scheduledTime ? ` 🕐 ${r.scheduledTime.slice(0, 5)}` : ""}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{r.clientName ?? "Sem nome de cliente"}</span>
          <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          {r.clientPhone ?? "—"}
          {r.clientNeighborhood ? ` · ${r.clientNeighborhood}` : ""}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-gray-600 dark:text-gray-300 max-w-[260px] truncate" title={r.items.map((i) => i.product).join(", ")}>
        {r.items.map((i) => i.product).join(", ") || "—"}
      </td>
      <td className="px-4 py-3 align-top text-gray-600 dark:text-gray-300 whitespace-nowrap">
        <div>{rotaLabel}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{r.driverName ? `🚚 ${r.driverName}` : "Sem motorista"}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">Responsável: {r.assignedToName ?? "—"}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
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

// Imprimir em bloco -- achado do Victor 07/09/2026: filtrar por "Amanhã"
// (ou qualquer outro período/status/rota que caia nessa lista achatada, ver
// hasActiveFilter em fila/page.tsx) não tinha essa opção, só o quadro
// "Hoje" (EntregasKanbanHoje.tsx) tinha -- mesmo padrão de lá (checkbox por
// linha + "selecionar todas" + barra flutuante com link pra despacho-lote),
// só que pra essa lista em vez do quadro de hoje.
export function EntregasFlatList({ items }: { items: ServiceRequestSummary[] }) {
  const sorted = sortByScheduledDate(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (sorted.length === 0) return null;

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((r) => r.id)));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-xs self-start text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
        Selecionar todas
      </label>

      <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
              <th className="pl-4 pr-2 py-2.5"></th>
              {["ID / Tipo", "Cliente", "Produto", "Rota / Motorista", "Situação", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((r) => (
              <EntregaFlatRow key={r.id} r={r} selected={selected.has(r.id)} onToggleSelected={() => toggleSelected(r.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra flutuante -- mesmo padrão de EntregasKanbanHoje.tsx/
          AssistenciaQueueGroup.tsx (bottom-20 no mobile por causa da barra
          de navegação inferior, bottom-4 no desktop). */}
      {selected.size > 0 ? (
        <div
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-40 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg flex-wrap"
          style={{ background: "var(--surface-1)", borderColor: "var(--brand-green)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
          <Link
            href={`/assistencia/despacho-lote?ids=${[...selected].join(",")}`}
            target="_blank"
            className="text-sm rounded-full px-3 py-1.5 font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            🖨️ Imprimir selecionados
          </Link>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
