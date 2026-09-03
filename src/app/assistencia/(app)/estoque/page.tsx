import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import {
  listStockMovements,
  listDistinctResponsibles,
  isMovementType,
  effectiveDateKey,
  type StockMovement,
} from "@/lib/stockMovements";
import { listSuppliers } from "@/lib/partOrders";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { StockMovementCard } from "@/components/assistencia/StockMovementCard";
import { groupIntoWeeks } from "@/lib/weekGrouping";

function buildHref(params: { type?: string; q?: string; factory?: string; responsavel?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.q) sp.set("q", params.q);
  if (params.factory) sp.set("factory", params.factory);
  if (params.responsavel) sp.set("responsavel", params.responsavel);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return qs ? `/assistencia/estoque?${qs}` : "/assistencia/estoque";
}

// Abas de status gerais -- pedido do Victor 28/08/2026 (redesign):
// "abas superiores para os status gerais", mesmo componente FilterPill
// já usado em /assistencia/fila. "Pendentes de retirada" não é um
// movement_type de verdade (é retirado sem baixa ainda, ver
// isPendingWithdrawal) -- por isso o `value` "pendente" à parte,
// resolvido no servidor (ver onlyPending abaixo).
const FILTERS: { label: string; value: string | null; color?: string }[] = [
  { label: "Todos", value: null },
  { label: "Retirados", value: "retirado", color: "var(--series-5)" },
  { label: "Devolvidos", value: "devolvido", color: "var(--status-good)" },
  { label: "Reparados", value: "reparado", color: "var(--series-4)" },
  { label: "Pendentes de retirada", value: "pendente", color: "var(--brand-orange)" },
];

type DayGroup = { key: string; label: string; items: StockMovement[] };

// Agrupado por dia "efetivo" (retirado/concluído; pendente usa a data de
// lançamento) -- mesmo padrão de groupByDate em fila/page.tsx.
function groupByDate(movements: StockMovement[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const m of movements) {
    const dateKey = effectiveDateKey(m);
    let group = groups.find((g) => g.key === dateKey);
    if (!group) {
      const label = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key: dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(m);
  }
  groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return groups;
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; factory?: string; responsavel?: string; from?: string; to?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { type, q, factory, responsavel, from, to } = await searchParams;
  const onlyPending = type === "pendente";
  const filterType = isMovementType(type) ? type : undefined;
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;

  const [rawMovements, suppliers, responsibles] = await Promise.all([
    listStockMovements({ movementType: filterType, q, onlyPendingWithdrawal: onlyPending, factory, responsavel }),
    listSuppliers(),
    listDistinctResponsibles(),
  ]);
  // De/Até -- data efetiva não é uma coluna de verdade (ver
  // effectiveDateKey), então o filtro de período é em JS depois da busca,
  // mesmo padrão de todo filtro derivado nessa base (isMostruarioRequest,
  // filterSched em fila/page.tsx etc.).
  const movements = rawMovements.filter((m) => {
    const key = effectiveDateKey(m);
    if (dateFrom && key < dateFrom) return false;
    if (dateTo && key > dateTo) return false;
    return true;
  });

  const groups = groupByDate(movements);

  return (
    <div className="flex flex-col gap-4">
      {/* "Controle Assistência" -- pedido do Victor 27/08/2026, mesmo
          desenho de pecas/page.tsx (ver lá). */}
      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/pecas"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Peças
        </Link>
        <Link
          href="/assistencia/fornecedores"
          className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Fornecedores
        </Link>
        <Link
          href="/assistencia/estoque"
          className="text-sm font-semibold px-4 py-2 rounded-full text-white shadow-sm"
          style={{ background: "color-mix(in srgb, var(--brand-green) 78%, black)" }}
        >
          Estoque
        </Link>
      </div>

      {/* Título + CTA -- pedido do Victor 28/08/2026 (redesign): "seguindo
          o padrão visual de outra tela do sistema", mesmo PageHeader já
          usado em /assistencia/fila. */}
      <PageHeader
        title="Estoque"
        description="Retiradas, devoluções e reparos de produto pra Assistência Técnica."
        cta={
          <Link
            href="/assistencia/estoque/nova"
            className="text-sm px-4 py-2.5 rounded-lg font-bold shadow-md"
            style={{ background: "var(--brand-orange)", color: "#fff", border: "2px solid var(--brand-orange)" }}
          >
            + Nova movimentação
          </Link>
        }
      />

      {/* Abas de status -- ver FILTERS acima. */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
        {FILTERS.map((f) => (
          <FilterPill
            key={f.label}
            label={f.label}
            color={f.color}
            selected={(f.value ?? undefined) === (type || undefined)}
            href={buildHref({ type: f.value ?? undefined, q, factory, responsavel, from: dateFrom, to: dateTo })}
          />
        ))}
      </div>

      {/* Dropdowns Fábrica/Responsável -- pedido do Victor 28/08/2026:
          "filtros de seleção (dropdown) para lojas/operadores" -- essa
          tela não tem loja (stock_movements não é por loja), o dado
          equivalente aqui é Fábrica; "operadores" = Responsável (quem
          registrou ou quem deu baixa, ver listDistinctResponsibles). */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="factory" placeholder="Todas as fábricas" options={suppliers} />
        <FilterSelect name="responsavel" placeholder="Todos os responsáveis" options={responsibles} />
      </div>

      {/* Busca + De/Até -- mesmo desenho de /assistencia/fila. */}
      <form action="/assistencia/estoque" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterType ? <input type="hidden" name="type" value={filterType} /> : null}
        {onlyPending ? <input type="hidden" name="type" value="pendente" /> : null}
        {factory ? <input type="hidden" name="factory" value={factory} /> : null}
        {responsavel ? <input type="hidden" name="responsavel" value={responsavel} /> : null}
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por produto, código ou cliente…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 pl-8 pr-3 py-2 text-sm w-full"
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          De
          <input type="date" name="from" defaultValue={dateFrom ?? ""} className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          Até
          <input type="date" name="to" defaultValue={dateTo ?? ""} className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-2 text-sm" />
        </label>
        <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
          Buscar
        </button>
        {q || dateFrom || dateTo ? (
          <Link href={buildHref({ type: type || undefined, factory, responsavel })} className="text-xs underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Limpar busca/data
          </Link>
        ) : null}
      </form>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {movements.length} movimentaç{movements.length === 1 ? "ão" : "ões"} encontrada{movements.length === 1 ? "" : "s"}
      </p>

      {movements.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma movimentação encontrada.</p>
        </div>
      ) : (
        // Semana > dia (accordion, recolhido por padrão) -- pedido do
        // Victor 28/08/2026: "Agrupe os cards por períodos lógicos...
        // 'SEMANA DE X A Y'... subgrupos por dias específicos, exibindo
        // o contador de itens". Mesmo padrão de groupIntoWeeks já usado
        // em /assistencia/fila (aba Visitas).
        <div className="flex flex-col gap-3">
          {groupIntoWeeks(groups, (g) => g.key).map((week) => {
            const weekTotal = week.days.reduce((sum, g) => sum + g.items.length, 0);
            return (
              <details key={week.weekKey} className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 group/week">
                <summary className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-xs shrink-0 transition-transform duration-150 group-open/week:rotate-90 text-gray-400 dark:text-gray-500" aria-hidden="true">
                    ▶
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{week.label}</span>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">({weekTotal})</span>
                </summary>
                <div className="flex flex-col gap-3 p-3 bg-white dark:bg-gray-800">
                  {week.days.map((group) => (
                    <details key={group.key} className="group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                      <summary className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <span className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90 text-gray-400 dark:text-gray-500" aria-hidden="true">
                          ▶
                        </span>
                        {/* Recolhido = branco/texto verde, aberto = verde
                            sólido/texto branco -- mesmo tratamento de
                            MonthAccordion.tsx (Design System, 02/09/2026). */}
                        <span className="text-sm font-bold uppercase tracking-wide rounded-md shadow-sm px-2.5 py-1 bg-white dark:bg-gray-800 text-[#1B5E3C] group-open:bg-[#1B5E3C] group-open:text-white">
                          {group.label} ({group.items.length})
                        </span>
                      </summary>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {group.items.map((m) => (
                          <StockMovementCard key={m.id} m={m} />
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
