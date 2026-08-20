"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkSetRotaAction, getAvailableRotasForDateAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { ROTAS, ROTA_LABELS, ROTA_COLORS, type AvailableRota, type Rota } from "@/lib/rotas";
import type { ServiceRequestSummary } from "@/lib/serviceRequests";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";

// Agrupado por rota, mesma ordem/rótulo fixo de groupByRota em fila/page.tsx
// (Praia/Sul/Centro, "Sem rota definida" por último) -- pedido do Victor
// 19/08/2026: "ainda não aparece o agrupamento por rota". Sem sub-grupo de
// data aqui de propósito (fila/page.tsx tem, mas essa lista raramente passa
// de umas dezenas de itens -- um nível a mais só atrapalharia).
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

function groupByRota(requests: ServiceRequestSummary[]): { key: RotaGroupKey; items: ServiceRequestSummary[] }[] {
  return ROTA_GROUP_ORDER.map((key) => ({ key, items: requests.filter((r) => (r.rota ?? NO_ROTA) === key) })).filter(
    (g) => g.items.length > 0
  );
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
  const allSelected = selectable && requests.length > 0 && selected.size === requests.length;
  const groups = groupByRota(requests);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(requests.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAfterApply() {
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {selectable && requests.length > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
            Selecionar todas
          </label>
          {selected.size > 0 ? (
            <>
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
            </>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => (
        <details key={group.key} className="group flex flex-col gap-1.5" open>
          <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span
              className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            >
              ▶
            </span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ROTA_GROUP_COLORS[group.key] }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {group.key === NO_ROTA ? "" : "Rota "}
              {ROTA_GROUP_LABELS[group.key]}
            </h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              ({group.items.length})
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
      ))}
    </div>
  );
}

function BulkRotaBar({
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
  const [rota, setRota] = useState("");
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
          setRota((prev) => (prev && !rotas.some((r) => r.rota === prev) ? "" : prev));
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

  async function apply() {
    setPending(true);
    setResult(null);
    try {
      const r = await bulkSetRotaAction(selectedIds, date, rota);
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
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {count} selecionada{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs rounded-full px-3 py-1.5 font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Colocar em rota
        </button>
        <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
          limpar seleção
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 w-full" style={{ borderColor: "var(--brand-green)", background: "var(--surface-1)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        Colocar {count} solicitaç{count === 1 ? "ão" : "ões"} na mesma rota
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <select
          value={rota}
          onChange={(e) => setRota(e.target.value)}
          disabled={!date || loadingRotas}
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Selecione a rota…</option>
          {effectiveAvailableRotas.map((r) => (
            <option key={r.rota} value={r.rota}>
              {ROTA_LABELS[r.rota]}
              {r.driverName ? ` — ${r.driverName}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !date || !rota}
          onClick={apply}
          className="text-xs rounded px-3 py-1.5 font-medium disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Aplicando…" : "Aplicar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
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
    </div>
  );
}
