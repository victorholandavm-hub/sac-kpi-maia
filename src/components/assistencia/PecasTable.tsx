"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartOrder, PartOrderStatus } from "@/lib/partOrders";
import { PART_ORDER_STATUSES } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { formatMonthLabel } from "@/lib/weekGrouping";
import { DELIVERY_TYPE_COLORS } from "./AssistenciaQueueGroup";
import { PartOrderQuickStatus } from "./PartOrderQuickStatus";
import { PartOrderEmailButton } from "./PartOrderEmailButton";
import { bulkUpdatePartOrderStatus } from "@/app/assistencia/pecas-actions";
import { useQuickAction } from "./useQuickAction";

// Tabela Grid Horizontal, mesmo padrão da aba Entregas (TodayRow,
// EntregasKanbanHoje.tsx) -- pedido do Victor 09/09/2026: "queria que
// ficasse parecido em organização com essa aqui da aba de entregas", depois
// detalhado num pedido mais formal (checkbox de seleção em lote, tag de
// tipo/fluxo, botão "Ver detalhes"). Colunas equivalentes: ID/Tipo ->
// ID/Peça, Rota/Motorista -> Fornecedor/Representante, Situação continua
// Situação, só que aqui vira controle editável (PartOrderQuickStatus) em
// vez de badge só-leitura -- é a outra parte do mesmo pedido ("as
// atualizações precisam poder ser feitas sem entrar em cada uma").
//
// Agrupamento por período (pedido do Victor 09/09/2026, correção do que
// veio antes): anos passados (2021-2025 até agora) agrupados por ANO; o
// ano corrente, por MÊS -- diferente do padrão semana>dia já usado em
// estoque/fila (não faz sentido semana a semana pra 4+ anos de histórico
// importado da planilha).

type PeriodGroup = { key: string; label: string; items: PartOrder[] };

// Lê ano/mês direto da string ISO (sem construir Date/timezone) -- mesmo
// cuidado de DespachoCard.tsx (formatScheduledDateBr): createdAt é
// timestamptz gravado ao meio-dia local na importação (ver migration 0117),
// então os 7 primeiros caracteres já são o ano-mês certo sem risco de
// virada de dia por fuso.
function groupOrdersByPeriod(orders: PartOrder[]): PeriodGroup[] {
  const currentYear = new Date().getFullYear();
  const groups: PeriodGroup[] = [];
  for (const o of orders) {
    const year = Number(o.createdAt.slice(0, 4));
    const isCurrentYear = year === currentYear;
    const key = isCurrentYear ? o.createdAt.slice(0, 7) : String(year);
    const label = isCurrentYear ? formatMonthLabel(key) : `Ano de ${year}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(o);
  }
  return groups;
}

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function isOverdue(expectedAt: string | null): boolean {
  if (!expectedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > expectedAt;
}

function formatDateOnly(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

// Resumo em modal -- pedido do Victor 09/09/2026: "quando eu clicar em
// 'ver detalhes' apareça o resumo desse chamado, e só entre no chamado
// quando eu clicar no corpo dele". Antes o botão navegava direto pro
// mesmo lugar que clicar na linha -- agora só abre esse resumo aqui,
// mesmo padrão de modal do ProductsModalButton.tsx (botão + overlay +
// caixa), só que com os campos do pedido em vez de lista de produtos.
function PartOrderSummaryButton({ o }: { o: PartOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap underline"
        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--text-secondary) 15%, var(--surface-1))" }}
      >
        Ver detalhes
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar resumo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-md max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {o.externalReference ?? `#${o.ticketNumber}`}
              </h3>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SummaryRow label="Aberto em" value={formatDateOnly(o.createdAt)} />
              <SummaryRow label="Status" value={PART_ORDER_STATUS_LABELS[o.status] ?? o.status} />
              <SummaryRow label="Cliente" value={o.clientName} />
              <SummaryRow label="Telefone" value={o.clientPhone} />
              <SummaryRow label="Produto" value={o.product} />
              <SummaryRow label="Peça" value={o.partName} />
              <SummaryRow label="Código da peça" value={o.partCode} />
              <SummaryRow label="Cor" value={o.color} />
              <SummaryRow label="Fornecedor" value={o.supplier} />
              <SummaryRow label="Representante" value={o.representative} />
              <SummaryRow label="Solicitante" value={o.requestedBy} />
              {o.partArrivedAt ? <SummaryRow label="Peça chegou em" value={new Date(o.partArrivedAt).toLocaleDateString("pt-BR")} /> : null}
              {o.sentToClientAt ? <SummaryRow label="Enviada ao cliente em" value={new Date(o.sentToClientAt).toLocaleDateString("pt-BR")} /> : null}
              {o.closedAt ? <SummaryRow label="Encerrado em" value={new Date(o.closedAt).toLocaleDateString("pt-BR")} /> : null}
            </div>
            {o.notes ? (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Observação</span>
                <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
                  {o.notes}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

// Linha inteira clicável (igual TodayRow) -- só as células com controle
// próprio (checkbox, select de status) param propagação.
function PecaRow({ o, selected, onToggleSelected }: { o: PartOrder; selected: boolean; onToggleSelected: () => void }) {
  const router = useRouter();
  const open = o.status !== "encerrado" && o.status !== "cancelada";
  const typeColor = o.serviceRequestType ? (DELIVERY_TYPE_COLORS[o.serviceRequestType] ?? "#6B7280") : null;

  return (
    <tr
      onClick={() => router.push(`/assistencia/pecas/${o.id}`)}
      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer"
    >
      <td className="pl-4 pr-2 py-3 align-top" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="rounded"
          aria-label={`Selecionar ${o.externalReference ?? `#${o.ticketNumber}`}`}
        />
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        {/* Número da planilha (CH0001..CH1641) quando o pedido veio de lá
            -- pedido do Victor 09/09/2026: "esse CH1641 é o numero do
            chamado, tem que aparecer na tela resumida, nao crie outro
            numero de ID para isso". Pedido criado direto pelo app (sem
            vínculo com a planilha) continua com o #ticket_number normal. */}
        <div className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-300">
          {o.externalReference ?? `#${o.ticketNumber}`}
        </div>
        {/* Data de abertura logo abaixo do número -- pedido do Victor
            09/09/2026: "essa data deve aparecer logo abaixo do numero do
            chamado". */}
        <div className="text-[10px] text-gray-400 dark:text-gray-500">{formatDateOnly(o.createdAt)}</div>
        {o.serviceRequestType ? (
          <span
            className="inline-flex mt-1 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={{
              color: `color-mix(in srgb, ${typeColor} 70%, var(--foreground))`,
              background: `color-mix(in srgb, ${typeColor} 14%, var(--surface-1))`,
            }}
          >
            {REQUEST_TYPE_LABELS[o.serviceRequestType] ?? o.serviceRequestType}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top max-w-[200px]">
        <div className="font-bold uppercase truncate text-gray-800 dark:text-gray-100">{o.clientName ?? "Sem cliente"}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{o.clientPhone ?? "—"}</div>
      </td>
      <td className="px-3 py-3 align-top max-w-[260px]">
        <div className="truncate text-gray-600 dark:text-gray-300" title={o.product ?? undefined}>
          {o.product ?? "—"}
        </div>
        {/* Peça logo abaixo do produto, em linha própria -- pedido do
            Victor 09/09/2026: "abaixo de produto, apareça a peça". */}
        {o.partName ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate" title={o.partName}>
            {o.partName}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300 whitespace-nowrap">
        <div>{o.supplier ?? "Sem fornecedor"}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{o.representative ? `👤 ${o.representative}` : "Sem representante"}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">Solicitante: {o.requestedBy ?? "—"}</div>
      </td>
      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <PartOrderQuickStatus orderId={o.id} status={o.status} />
          {open ? (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{
                color: "var(--text-primary)",
                background: `color-mix(in srgb, ${isOverdue(o.expectedAt) ? "var(--status-critical)" : "var(--status-warning)"} 35%, var(--surface-1))`,
              }}
            >
              {daysSince(o.createdAt)}d{isOverdue(o.expectedAt) ? " · atrasado" : ""}
            </span>
          ) : null}
        </div>
      </td>
      <td className="pl-3 pr-4 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <PartOrderEmailButton o={o} />
          <PartOrderSummaryButton o={o} />
        </div>
      </td>
    </tr>
  );
}

function PecasTableBody({ orders, selected, onToggle }: { orders: PartOrder[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: "960px" }}>
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
            {["", "ID / Peça", "Cliente", "Produto", "Fornecedor / Representante", "Situação", ""].map((h, idx) => (
              <th
                key={idx}
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {orders.map((o) => (
            <PecaRow key={o.id} o={o} selected={selected.has(o.id)} onToggleSelected={() => onToggle(o.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PecasTable({ orders }: { orders: PartOrder[] }) {
  const { pending, run } = useQuickAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PartOrderStatus>("peca_recebida");

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }

  function applyBulk() {
    const ids = [...selected];
    run(
      () => bulkUpdatePartOrderStatus(ids, bulkStatus),
      `${ids.length} pedido${ids.length === 1 ? "" : "s"} atualizado${ids.length === 1 ? "" : "s"} pra ${PART_ORDER_STATUS_LABELS[bulkStatus]}.`
    );
    setSelected(new Set());
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum pedido de peça encontrado.</p>
      </div>
    );
  }

  // Anos passados agrupados por ANO, o ano corrente por MÊS -- pedido do
  // Victor 09/09/2026 (ver groupOrdersByPeriod acima). `orders` já chega
  // ordenado por created_at desc (listPartOrders) -- os grupos nascem na
  // mesma ordem de primeira aparição, então já saem do mais recente pro
  // mais antigo sem precisar reordenar aqui.
  const groups = groupOrdersByPeriod(orders);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-xs self-start text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
        Selecionar todas ({orders.length})
      </label>

      <div className="flex flex-col gap-3">
        {groups.map((group, idx) => (
          <details key={group.key} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 group/period" open={idx === 0}>
            <summary className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="text-xs shrink-0 transition-transform duration-150 group-open/period:rotate-90 text-gray-400 dark:text-gray-500" aria-hidden="true">
                ▶
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{group.label}</span>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">({group.items.length})</span>
            </summary>
            <div className="p-3 bg-white dark:bg-gray-800">
              <PecasTableBody orders={group.items} selected={selected} onToggle={toggleSelected} />
            </div>
          </details>
        ))}
      </div>

      {/* Barra flutuante -- mesmo padrão de AssistenciaQueueGroup.tsx/
          EntregasKanbanHoje.tsx (bottom-20 no mobile por causa da barra de
          navegação inferior, bottom-4 no desktop). Ação em lote aqui é
          trocar status de todas as selecionadas de uma vez (pedido do
          Victor 09/09/2026), não imprimir/mudar rota (isso é só de
          Entregas) -- seleção atravessa os grupos (accordion é só
          organização visual, não limita o que pode ser selecionado junto). */}
      {selected.size > 0 ? (
        <div
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-40 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg flex-wrap"
          style={{ background: "var(--surface-1)", borderColor: "var(--brand-green)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PartOrderStatus)}
            disabled={pending}
            className="text-sm rounded border px-2 py-1.5"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }}
          >
            {PART_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PART_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={applyBulk}
            className="text-sm rounded-full px-3 py-1.5 font-medium disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Aplicar
          </button>
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
