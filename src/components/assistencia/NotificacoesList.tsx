"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkSetRotaAction, getAvailableRotasForDateAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { ROTAS, ROTA_LABELS, ROTA_COLORS, type AvailableRota, type Rota } from "@/lib/rotas";
import { bucketByScheduledDate, type DateBucketKey } from "@/lib/dateBuckets";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";
import { DeliveryStatusBadge, countByDeliveryStatus } from "./DeliveryStatusBadge";

// Agrupado por DATA primeiro, rota dentro de cada data -- pedido do Victor
// 20/08/2026: "na tela do sac também fique em ordem por data". Antes era só
// por rota (pedido do Victor 19/08/2026: "ainda não aparece o agrupamento
// por rota", sem sub-grupo de data "de propósito"), mas isso misturava
// datas fora de ordem dentro de cada rota -- mesmo problema, e mesmo
// conserto, já aplicado em groupByRota de fila/page.tsx ("a data manda, não
// a rota"). Mesmo rank de sempre: hoje, amanhã, depois, atrasado, sem data.
const NO_ROTA = "sem_rota" as const;
type RotaGroupKey = Rota | typeof NO_ROTA;
const ROTA_GROUP_ORDER: RotaGroupKey[] = [...ROTAS, NO_ROTA];
const ROTA_GROUP_LABELS: Record<RotaGroupKey, string> = {
  ...ROTA_LABELS,
  [NO_ROTA]: "Sem rota definida",
};
const ROTA_GROUP_COLORS: Record<RotaGroupKey, string> = {
  ...ROTA_COLORS,
  [NO_ROTA]: "var(--text-muted)",
};

const NO_SCHEDULED_DATE_KEY = "sem_data";
const SCHEDULED_DATE_BUCKET_RANK: Record<DateBucketKey, number> = {
  hoje: 0,
  amanha: 1,
  depois: 2,
  atrasado: 3,
  sem_data: 4,
};

type DateSubgroup = { dateKey: string; label: string; items: ServiceRequestSummary[] };

function groupByScheduledDate(items: ServiceRequestSummary[]): DateSubgroup[] {
  const groups: DateSubgroup[] = [];
  for (const r of items) {
    const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
    const dateKey = effectiveDate ?? NO_SCHEDULED_DATE_KEY;
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = effectiveDate
        ? new Date(`${effectiveDate}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
        : "Sem data definida";
      group = { dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  groups.sort((a, b) => {
    const rankA = SCHEDULED_DATE_BUCKET_RANK[bucketByScheduledDate(a.dateKey === NO_SCHEDULED_DATE_KEY ? null : a.dateKey)];
    const rankB = SCHEDULED_DATE_BUCKET_RANK[bucketByScheduledDate(b.dateKey === NO_SCHEDULED_DATE_KEY ? null : b.dateKey)];
    if (rankA !== rankB) return rankA - rankB;
    return a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0;
  });
  return groups;
}

type Group = { key: string; label: string; color: string; items: ServiceRequestSummary[] };

function groupByDateAndRota(requests: ServiceRequestSummary[]): Group[] {
  const groups: Group[] = [];
  for (const dateGroup of groupByScheduledDate(requests)) {
    for (const rotaKey of ROTA_GROUP_ORDER) {
      const items = dateGroup.items.filter((r) => (r.rota ?? NO_ROTA) === rotaKey);
      if (items.length === 0) continue;
      groups.push({
        key: `${dateGroup.dateKey}_${rotaKey}`,
        label: `${rotaKey === NO_ROTA ? "" : "Rota "}${ROTA_GROUP_LABELS[rotaKey]} · ${dateGroup.label}`,
        color: ROTA_GROUP_COLORS[rotaKey],
        items,
      });
    }
  }
  return groups;
}

// Lista de notificações com seleção em bloco (pedido do Victor 19/08/2026:
// "preciso selecionar em bloco pra colocar todas em uma rota") -- cada
// linha continua um <Link> pro detalhe, só ganhou um checkbox do lado que
// não interfere na navegação (para propagação, não é o mesmo alvo de
// clique). Sem seleção habilitada na aba "Concluídas" -- não faz sentido
// remarcar rota de chamado já fechado. Seleção fica no componente pai (não
// por grupo de rota) -- "selecionar todas" precisa valer pra lista inteira,
// atravessando os grupos.
export function NotificacoesList({
  requests,
  selectable,
}: {
  requests: ServiceRequestSummary[];
  selectable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const groups = groupByDateAndRota(requests);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Selecionar todas" fica por grupo (dia+rota), não mais um único
  // checkbox pra lista inteira -- pedido do Victor 21/08/2026: "quando o
  // selecionar todas estiver selecionado, selecione todos [os itens] de um
  // dia/rota específica". Impressão em lote normalmente é isso mesmo: a
  // remessa de uma rota num dia, não a fila inteira misturada. `selected`
  // continua um Set só (atravessa grupos se a pessoa marcar item a item de
  // grupos diferentes), só o atalho de "marcar tudo de uma vez" que virou
  // por grupo.
  function isGroupFullySelected(group: Group): boolean {
    return group.items.length > 0 && group.items.every((r) => selected.has(r.id));
  }

  function toggleGroup(group: Group) {
    setSelected((prev) => {
      const next = new Set(prev);
      const fullySelected = group.items.every((r) => next.has(r.id));
      for (const r of group.items) {
        if (fullySelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  function clearAfterApply() {
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {selectable && selected.size > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
          <Link
            href={`/assistencia/despacho-lote?ids=${[...selected].join(",")}`}
            target="_blank"
            className="text-xs rounded-full px-3 py-1.5 font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            🖨️ Imprimir selecionadas
          </Link>
          <BulkRotaBar
            selectedIds={[...selected]}
            count={selected.size}
            onDone={clearAfterApply}
            onPartialProgress={() => router.refresh()}
            onCancel={() => setSelected(new Set())}
          />
        </div>
      ) : null}

      {groups.map((group) => {
        const statusCounts = countByDeliveryStatus(group.items);
        return (
        <details key={group.key} className="group flex flex-col gap-1.5" open>
          <summary className="flex items-center gap-2 px-1 cursor-pointer list-none flex-wrap [&::-webkit-details-marker]:hidden">
            <span
              className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            >
              ▶
            </span>
            {selectable ? (
              <input
                type="checkbox"
                checked={isGroupFullySelected(group)}
                onChange={() => toggleGroup(group)}
                onClick={(e) => e.stopPropagation()}
                className="rounded shrink-0"
                aria-label={`Selecionar tudo de ${group.label}`}
              />
            ) : null}
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.color }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {group.label}
            </h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              ({group.items.length})
            </span>
            <span className="flex items-center gap-2 text-[11px] font-medium ml-auto">
              <span style={{ color: "var(--brand-green)" }}>Programado {statusCounts.programado}</span>
              <span style={{ color: "var(--status-good)" }}>Concluído {statusCounts.concluido}</span>
              <span style={{ color: "var(--text-secondary)" }}>Cancelado {statusCounts.cancelado}</span>
            </span>
          </summary>
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
            <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
              {group.items.map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-4">
                  {selectable ? (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="rounded shrink-0"
                      aria-label={`Selecionar #${r.ticketNumber}`}
                    />
                  ) : null}
                  <Link href={`/assistencia/${r.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap hover:opacity-80">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          #{r.ticketNumber}
                        </span>
                        <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {REQUEST_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                        {r.clientTimeRestriction ? (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))" }}
                          >
                            🕐 {r.clientTimeRestriction}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {r.clientName ?? "Sem nome de cliente"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {r.storeName}
                        {r.driverName ? ` · Motorista: ${r.driverName}` : ""}
                      </p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </details>
        );
      })}
    </div>
  );
}

// Exportado -- pedido do Victor 21/08/2026: "preciso de uma forma de
// selecionar em bloco, no meu acesso de admin, para mudar aquelas
// notificações para outro motorista/rota". Mesmo componente da aba do
// SAC, reaproveitado na aba Entregas de /assistencia/fila (admin/
// assistência, ver AssistenciaQueueGroup.tsx) em vez de duplicar.
export function BulkRotaBar({
  selectedIds,
  count,
  onDone,
  onPartialProgress,
  onCancel,
}: {
  selectedIds: string[];
  count: number;
  onDone: () => void;
  // Chamado quando algum item deu certo mas nem todos (ver errors abaixo)
  // -- só atualiza a lista por trás (rota já aparece nos que funcionaram),
  // sem fechar o painel nem limpar a seleção, pra quem tá aplicando
  // continuar vendo os erros e decidir o que fazer com eles.
  onPartialProgress: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  // Id da atribuição escolhida, não só a rota -- pedido do Victor
  // 21/08/2026: precisa diferenciar duas atribuições com a MESMA rota
  // (principal + extra, motoristas diferentes), mesmo problema e mesma
  // solução de ScheduleField.tsx.
  const [assignmentId, setAssignmentId] = useState("");
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errors: string[] } | null>(null);

  const hasDateContext = !!date;

  useEffect(() => {
    if (!hasDateContext) return;
    const timer = setTimeout(() => {
      setLoadingRotas(true);
      getAvailableRotasForDateAction(date)
        .then((rotas) => {
          setAvailableRotas(rotas);
          setAssignmentId((prev) => (prev && !rotas.some((r) => r.id === prev) ? "" : prev));
        })
        .catch(() => setAvailableRotas([]))
        .finally(() => setLoadingRotas(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [hasDateContext, date]);

  // Sem data ainda, não mostra rota nenhuma (mesmo se `availableRotas` tiver
  // ficado com um valor antigo de uma data anterior) -- mesmo desenho do
  // ScheduleField.tsx, evita limpar o state direto no corpo do efeito.
  const effectiveAvailableRotas = hasDateContext ? availableRotas : [];
  const selectedAssignment = effectiveAvailableRotas.find((r) => r.id === assignmentId) ?? null;

  async function apply() {
    if (!selectedAssignment) return;
    setPending(true);
    setResult(null);
    try {
      const r = await bulkSetRotaAction(selectedIds, date, selectedAssignment.rota, selectedAssignment.driverName ?? undefined);
      setResult(r);
      if (r.errors.length === 0) {
        setOpen(false);
        onDone();
      } else if (r.successCount > 0) {
        onPartialProgress();
      }
    } catch (e) {
      setResult({ successCount: 0, errors: [e instanceof Error ? e.message : "Erro inesperado."] });
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs rounded-full px-3 py-1.5 font-medium whitespace-nowrap"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Mover {count} selecionado{count === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
          limpar seleção
        </button>
      </div>
    );
  }

  // Modal, não painel expandido inline -- pedido do Victor 21/08/2026:
  // "Crie um modal direto para transferência em bloco com dois seletores
  // encadeados: Selecione a Nova Data -> Selecione a Rota de Destino".
  // Os dois campos já eram encadeados de verdade (a rota só aparece
  // depois de escolher a data, ver efeito acima) -- só o container que
  // virou overlay centralizado em vez de caixa inline.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, black 55%, transparent)" }}>
      <div
        className="flex flex-col gap-3 rounded-lg border p-4 w-full max-w-sm"
        style={{ borderColor: "var(--brand-green)", background: "var(--surface-1)" }}
      >
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Mover {count} solicitaç{count === 1 ? "ão" : "ões"}
        </span>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          1. Nova data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          2. Rota de destino
          <select
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            disabled={!date || loadingRotas}
            className="rounded border px-2 py-1.5 text-sm disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">{date ? "Selecione a rota…" : "Escolha a data primeiro"}</option>
            {effectiveAvailableRotas.map((r) => (
              <option key={r.id} value={r.id}>
                {ROTA_LABELS[r.rota]}
                {r.isExtra ? " (extra)" : ""}
                {r.driverName ? ` — ${r.driverName}` : ""}
              </option>
            ))}
          </select>
        </label>

        {!date ? null : loadingRotas ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Carregando rotas…
          </span>
        ) : effectiveAvailableRotas.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--status-warning)" }}>
            Nenhuma rota disponível pra essa data.
          </span>
        ) : null}

        {result ? (
          <div className="flex flex-col gap-1">
            {result.successCount > 0 ? (
              <span className="text-xs" style={{ color: "var(--status-good)" }}>
                {result.successCount} atualizada{result.successCount === 1 ? "" : "s"} com sucesso.
              </span>
            ) : null}
            {result.errors.length > 0 ? (
              <div className="text-xs" style={{ color: "var(--status-critical)" }}>
                {result.errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={pending || !date || !selectedAssignment}
            onClick={apply}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            {pending ? "Movendo…" : `Mover ${count} selecionado${count === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setResult(null);
            }}
            className="text-sm underline"
            style={{ color: "var(--text-secondary)" }}
          >
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
