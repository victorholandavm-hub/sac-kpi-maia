import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listScheduledRequests, agendaEffectiveDate, type ServiceRequestSummary, type AgendaRange } from "@/lib/serviceRequests";
import { listAssemblers, isAssistenciaControlledAssembler } from "@/lib/payments";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { AgendaDayGroups } from "@/components/assistencia/AgendaDayGroups";
import { AgendaKanbanBoard } from "@/components/assistencia/AgendaKanbanBoard";
import { JP_PRIMARY_ROTAS, ROTA_LABELS, isRota } from "@/lib/rotas";
import { DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";

// Mês corrente + navegação </> -- pedido do Victor 25/08/2026: "Se a
// opção padrão for 'Tudo', limite por padrão ao mês corrente" +
// "[ < ] Agosto 2026 [ > ]". Só usado quando nenhum filtro de período
// (Atrasado/Hoje/Semana) está escolhido -- esses três já são recortes de
// data explícitos, não fazem sentido combinados com navegação de mês.
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function addMonthsToKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Mesmo critério de isGroupOverdue (AgendaDayGroups.tsx) -- "ainda tem
// algo em aberto" (nem concluído, nem cancelado).
function hasPendingItems(items: ServiceRequestSummary[]): boolean {
  return items.some((r) => r.status !== "concluida" && r.status !== "cancelada");
}

function groupByDate(requests: ServiceRequestSummary[]) {
  const groups: { dateKey: string; label: string; items: ServiceRequestSummary[] }[] = [];
  for (const r of requests) {
    const dateKey = agendaEffectiveDate(r) ?? "";
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const [y, m, d] = dateKey.split("-");
      const label = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      group = { dateKey, label, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  // Concluído vai pro final -- pedido do Victor 25/08/2026: "os que
  // estiverem com status de concluido, precisam ir para baixo". Partição
  // estável (não reordena dentro de cada grupo, só separa quem já
  // terminou de quem ainda não) -- continua dando pra reordenar manualmente
  // dentro do dia (ver AgendaQueueGroup), só o arranjo inicial que muda.
  for (const group of groups) {
    const pendentes = group.items.filter((r) => r.status !== "concluida");
    const concluidos = group.items.filter((r) => r.status === "concluida");
    group.items = [...pendentes, ...concluidos];
  }
  return groups;
}

const FILTERS: { label: string; value: AgendaRange | null }[] = [
  { label: "Tudo", value: null },
  { label: "Atrasado", value: "atrasado" },
  { label: "Hoje", value: "hoje" },
  { label: "Próximos 7 dias", value: "semana" },
];

function buildHref(params: { range?: string; rota?: string; assembler?: string; view?: string; month?: string; showPast?: string }) {
  const sp = new URLSearchParams();
  if (params.range) sp.set("range", params.range);
  if (params.rota) sp.set("rota", params.rota);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.view) sp.set("view", params.view);
  if (params.month) sp.set("month", params.month);
  if (params.showPast) sp.set("showPast", params.showPast);
  const qs = sp.toString();
  return qs ? `/assistencia/agenda?${qs}` : "/assistencia/agenda";
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; rota?: string; assembler?: string; view?: string; month?: string; showPast?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { range, rota, assembler, view, month, showPast } = await searchParams;
  const filterRange = (["atrasado", "hoje", "semana"] as const).includes(range as AgendaRange)
    ? (range as AgendaRange)
    : undefined;
  const filterRota = isRota(rota) ? rota : undefined;
  const showKanban = view === "montador";
  // Mês corrente por padrão -- só entra em jogo quando "Tudo" está
  // selecionado (Atrasado/Hoje/Semana já são recortes de data próprios).
  const filterMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : currentMonthKey();
  const showPastResolved = showPast === "1";
  const [allRequests, assemblers, overdueRaw] = await Promise.all([
    listScheduledRequests({ range: filterRange, month: filterRange ? undefined : filterMonth }),
    listAssemblers(),
    // Sempre busca as atrasadas de verdade (sem limite de mês) pro alerta
    // no topo -- pedido do Victor 25/08/2026: "Visitas pendentes de datas
    // passadas não deveriam ficar espalhadas em suas respectivas datas
    // antigas. É melhor criar um Alerta/Card no topo". Só pula a busca
    // quando o filtro já É "Atrasado" (a lista principal já é isso).
    filterRange === "atrasado" ? Promise.resolve<ServiceRequestSummary[] | null>(null) : listScheduledRequests({ range: "atrasado" }),
  ]);
  const requests = allRequests
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !assembler || r.assemblerName === assembler);
  const overdueCount = (overdueRaw ?? requests)
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !assembler || r.assemblerName === assembler).length;
  let groups = groupByDate(requests);
  const todayKey = new Date().toISOString().slice(0, 10);
  // Dias passados já 100% resolvidos (nada em aberto) ficam escondidos por
  // padrão -- pedido do Victor 25/08/2026: "Dias anteriores a 'Hoje' que já
  // foram finalizados não devem aparecer na lista principal... ficar
  // ocultos por padrão sob um filtro". Atrasado/Hoje/Semana nunca têm
  // grupo assim (não olham pra trás ou só olham hoje/futuro), então isso só
  // tem efeito de verdade na visão "Tudo".
  const pastResolvedCount = groups.filter((g) => g.dateKey < todayKey && !hasPendingItems(g.items)).length;
  if (!showPastResolved) {
    groups = groups.filter((g) => !(g.dateKey < todayKey && !hasPendingItems(g.items)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Visitas técnicas com data marcada — troca de peça, vistoria, montagem e desmontagem na casa do cliente.
        </p>
        <Link
          href="/assistencia/nova-rapida"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          + Nova visita
        </Link>
      </div>

      {/* Alerta de atrasadas -- pedido do Victor 25/08/2026: "Visitas
          pendentes de datas passadas não deveriam ficar espalhadas em suas
          respectivas datas antigas. É melhor criar um Alerta/Card no topo
          da página: ⚠️ Você tem X visitas pendentes atrasadas". Sempre
          reflete o total de verdade (busca própria, sem limite de mês),
          já filtrado por rota/montador se algum estiver escolhido. Não
          aparece quando o filtro já É "Atrasado" -- a lista logo abaixo já
          é exatamente isso. */}
      {overdueCount > 0 && filterRange !== "atrasado" ? (
        <Link
          href={buildHref({ range: "atrasado", rota: filterRota, assembler, view })}
          className="flex items-center gap-2 rounded-lg px-4 py-3 font-semibold text-sm"
          style={{
            background: "color-mix(in srgb, var(--status-critical) 12%, var(--surface-1))",
            border: "2px solid var(--status-critical)",
            color: "var(--text-primary)",
          }}
        >
          <span className="text-lg" aria-hidden="true">
            ⚠️
          </span>
          Você tem {overdueCount} visita{overdueCount === 1 ? "" : "s"} pendente{overdueCount === 1 ? "" : "s"} atrasada
          {overdueCount === 1 ? "" : "s"}.
          <span className="underline shrink-0 ml-auto" style={{ color: "var(--status-critical)" }}>
            Clique para tratar →
          </span>
        </Link>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const selected = (f.value ?? undefined) === filterRange;
          return (
            <Link
              key={f.label}
              href={buildHref({ range: f.value ?? undefined, rota: filterRota, assembler, view: showKanban ? "montador" : undefined })}
              className="text-xs px-3 py-1 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: selected ? "var(--surface-1)" : "transparent",
                color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: selected ? 600 : 400,
              }}
            >
              {f.label}
            </Link>
          );
        })}
        {/* Navegação de mês </> -- só faz sentido em "Tudo" (Atrasado/Hoje/
            Semana já são recortes de data próprios, não usam mês). */}
        {!filterRange ? (
          <div className="flex items-center gap-1 ml-1">
            <Link
              href={buildHref({ rota: filterRota, assembler, view: showKanban ? "montador" : undefined, month: addMonthsToKey(filterMonth, -1) })}
              aria-label="Mês anterior"
              className="text-sm px-2 py-1 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              ←
            </Link>
            <span className="text-xs font-semibold px-1 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              {monthLabel(filterMonth)}
            </span>
            <Link
              href={buildHref({ rota: filterRota, assembler, view: showKanban ? "montador" : undefined, month: addMonthsToKey(filterMonth, 1) })}
              aria-label="Próximo mês"
              className="text-sm px-2 py-1 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              →
            </Link>
            {filterMonth !== currentMonthKey() ? (
              <Link
                href={buildHref({ rota: filterRota, assembler, view: showKanban ? "montador" : undefined })}
                className="text-xs underline"
                style={{ color: "var(--text-secondary)" }}
              >
                hoje
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Só João Pessoa "de verdade" -- Agenda é visitas técnicas
            (montagem/manutenção), Campina Grande e rota extra genérica
            são conceito de entrega/carga, não fazem sentido aqui. */}
        {[{ label: "Todas as rotas", value: undefined }, ...JP_PRIMARY_ROTAS.map((r) => ({ label: ROTA_LABELS[r], value: r }))].map((f) => (
          <Link
            key={f.label}
            href={buildHref({ range: filterRange, rota: f.value, assembler, view: showKanban ? "montador" : undefined, month: filterRange ? undefined : filterMonth })}
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: f.value === filterRota ? "var(--surface-1)" : "transparent",
              color: f.value === filterRota ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: f.value === filterRota ? 600 : 400,
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
      </div>

      {/* Kanban por montador só faz sentido com mouse/teclado pra arrastar
          -- desktop only, mesmo padrão de MobileActionSheet/AgendaDayGroups
          (interação diferente por tamanho de tela, não só reflow). No
          celular a alternância nem aparece, sempre fica na visão por dia. */}
      <div className="hidden sm:flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={buildHref({ range: filterRange, rota: filterRota, assembler, month: filterRange ? undefined : filterMonth })}
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: !showKanban ? "var(--surface-1)" : "transparent",
              color: !showKanban ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: !showKanban ? 600 : 400,
            }}
          >
            Por dia
          </Link>
          <Link
            href={buildHref({ range: filterRange, rota: filterRota, assembler, view: "montador", month: filterRange ? undefined : filterMonth })}
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: showKanban ? "var(--surface-1)" : "transparent",
              color: showKanban ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: showKanban ? 600 : 400,
            }}
          >
            Por montador
          </Link>
        </div>
        {/* Dias já concluídos ficam escondidos por padrão -- pedido do
            Victor 25/08/2026: "Dias anteriores a 'Hoje' que já foram
            finalizados não devem aparecer na lista principal... ficar
            ocultos por padrão sob um filtro". */}
        {!showKanban && pastResolvedCount > 0 ? (
          <Link
            href={buildHref({
              range: filterRange,
              rota: filterRota,
              assembler,
              month: filterRange ? undefined : filterMonth,
              showPast: showPastResolved ? undefined : "1",
            })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {showPastResolved ? "Ocultar dias já concluídos" : `Ver dias já concluídos (${pastResolvedCount})`}
          </Link>
        ) : null}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filterRange ? "Nenhuma visita nesse período." : "Nenhuma visita agendada nesse mês."}
          </p>
        </div>
      ) : !showKanban && groups.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Só tem dias já concluídos nesse período --{" "}
            <Link
              href={buildHref({ range: filterRange, rota: filterRota, assembler, month: filterRange ? undefined : filterMonth, showPast: "1" })}
              className="underline"
            >
              ver dias já concluídos ({pastResolvedCount})
            </Link>
            .
          </p>
        </div>
      ) : showKanban ? (
        <div className="hidden sm:block">
          {/* Kanban é só dos montadores que a assistência de fato controla --
              o filtro "Por dia" acima continua com a lista inteira (útil se
              algum chamado real estiver atribuído a alguém do interior).
              Também exclui os tipos que saem de motorista (troca/entrega de
              produto, envio de peça): esse Kanban arrasta pra reatribuir
              MONTADOR (setAssemblerName) -- não faz sentido um chamado de
              motorista aparecer aqui, ele não tem montador nenhum pra trocar. */}
          <AgendaKanbanBoard
            requests={requests.filter((r) => !(DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type))}
            assemblers={assemblers.filter(isAssistenciaControlledAssembler)}
          />
        </div>
      ) : (
        <AgendaDayGroups groups={groups} todayKey={todayKey} />
      )}
    </div>
  );
}
