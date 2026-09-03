import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listScheduledRequests, listStores, agendaEffectiveDate, type ServiceRequestSummary, type AgendaRange } from "@/lib/serviceRequests";
import { listAssemblers, isAssistenciaControlledAssembler } from "@/lib/payments";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { AgendaDayGroups } from "@/components/assistencia/AgendaDayGroups";
import { AgendaKanbanBoard } from "@/components/assistencia/AgendaKanbanBoard";
import { JP_PRIMARY_ROTAS, ROTA_LABELS, isRota } from "@/lib/rotas";
import { DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { groupIntoMonths, paginateMonths, pageContainingMonth } from "@/lib/weekGrouping";

// Mês corrente -- usado só pra saber em qual PÁGINA (ver paginateMonths/
// pageContainingMonth, weekGrouping.ts) o mês corrente cai por padrão,
// quando "Tudo" está selecionado e nenhuma página foi pedida na URL.
// Antes disso era usado também pra restringir a busca a um mês só, com
// navegação "[ < ] Agosto 2026 [ > ]" -- pedido do Victor 01/09/2026:
// "nas listas estão ficando 2/3 páginas sem necessidade" trocou aquela
// navegação por mês pela mesma paginação por mês que Visitas/Entregas
// passaram a usar (ver fila/page.tsx) -- um mês por página (achado do
// Victor 02/09/2026: "deixe só o mês de setembro na primeira pagina,
// agosto pode ir para a segunda"), sem precisar clicar mês a mês pra
// navegar dentro do mesmo.
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
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

function buildHref(params: { range?: string; rota?: string; assembler?: string; view?: string; page?: number; showPast?: string; store?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.range) sp.set("range", params.range);
  if (params.rota) sp.set("rota", params.rota);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.view) sp.set("view", params.view);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.showPast) sp.set("showPast", params.showPast);
  if (params.store) sp.set("store", params.store);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/assistencia/agenda?${qs}` : "/assistencia/agenda";
}

// Busca por texto -- pedido do Victor 25/08/2026 ("guia de padronização"):
// "Input de Busca por texto largo". Mais simples que a busca de
// Entregas/Solicitações (listRequests, servidor) -- aqui é em JS sobre o
// que o mês/período já trouxe (mesmo raciocínio de rota/montador, ver
// abaixo), então só cobre os campos que já vêm no resumo (nº do chamado,
// cliente, telefone, loja) -- não CPF nem produto (não fazem parte de
// ServiceRequestSummary, precisariam de outra query).
function matchesQuery(r: ServiceRequestSummary, q: string): boolean {
  const haystack = [String(r.ticketNumber), r.clientName, r.clientPhone, r.storeName].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; rota?: string; assembler?: string; view?: string; page?: string; showPast?: string; store?: string; q?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { range, rota, assembler, view, page: pageParam, showPast, store, q } = await searchParams;
  const filterRange = (["atrasado", "hoje", "semana"] as const).includes(range as AgendaRange)
    ? (range as AgendaRange)
    : undefined;
  const filterRota = isRota(rota) ? rota : undefined;
  const showKanban = view === "montador";
  const showPastResolved = showPast === "1";
  const filterQ = q?.trim().toLowerCase() || undefined;
  // "Tudo" (nenhum range escolhido) busca TODO o histórico agendado, sem
  // recorte de mês nenhum -- listScheduledRequests já não paginava por
  // linha (sempre trouxe tudo que tem scheduled_date/approved_deadline),
  // só ficava restrito a 1 mês por vez aqui na página (ver `filterMonth`
  // de antes, removido). Agrupamento por mês + paginação por página
  // (ver allMonths/pageGroups abaixo) assume esse papel agora.
  const [allRequests, assemblers, stores, overdueRaw] = await Promise.all([
    listScheduledRequests({ range: filterRange }),
    listAssemblers(),
    listStores(),
    // Sempre busca as atrasadas de verdade (sem limite de mês) pro alerta
    // no topo -- pedido do Victor 25/08/2026: "Visitas pendentes de datas
    // passadas não deveriam ficar espalhadas em suas respectivas datas
    // antigas. É melhor criar um Alerta/Card no topo". Só pula a busca
    // quando o filtro já É "Atrasado" (a lista principal já é isso).
    filterRange === "atrasado" ? Promise.resolve<ServiceRequestSummary[] | null>(null) : listScheduledRequests({ range: "atrasado" }),
  ]);
  // Loja (novo) e busca por texto (novo) entram na mesma cadeia de filtro
  // em JS que rota/montador já usavam -- pedido do Victor 25/08/2026
  // ("guia de padronização"): "Selects... Loja/Origem" + "Input de
  // Busca". `listScheduledRequests` já busca o mês/período inteiro pro
  // client-side (rota/montador já filtravam assim), então loja/busca
  // seguem o mesmo caminho em vez de crescer a query no servidor.
  const requests = allRequests
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !assembler || r.assemblerName === assembler)
    .filter((r) => !store || r.storeId === store)
    .filter((r) => !filterQ || matchesQuery(r, filterQ));
  const overdueCount = (overdueRaw ?? requests)
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !assembler || r.assemblerName === assembler)
    .filter((r) => !store || r.storeId === store)
    .filter((r) => !filterQ || matchesQuery(r, filterQ)).length;
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

  // Paginação por MÊS -- pedido do Victor 01/09/2026 (mesma regra de
  // fila/page.tsx, ver paginateMonths/weekGrouping.ts): um mês por
  // página. Só entra em jogo em "Tudo" -- Atrasado/Hoje/Semana já são
  // recortes de data próprios, não fazem sentido fatiados por mês (mesmo
  // critério de `postFiltered` em fila/page.tsx). Sem página explícita
  // na URL, abre direto na página que contém o mês corrente (equivalente
  // ao "mês corrente por padrão" de antes).
  const allMonths = !filterRange ? groupIntoMonths(groups, (g) => g.dateKey) : [];
  const requestedPage = /^\d+$/.test(pageParam ?? "") ? parseInt(pageParam!, 10) : undefined;
  const defaultPage = pageContainingMonth(allMonths, currentMonthKey());
  const { pageMonths, totalPages } = !filterRange ? paginateMonths(allMonths, requestedPage ?? defaultPage) : { pageMonths: [], totalPages: 1 };
  const currentPage = Math.min(Math.max(1, requestedPage ?? defaultPage), totalPages);
  const pageGroups = filterRange ? groups : pageMonths.flatMap((m) => m.weeks.flatMap((w) => w.days));
  // Kanban por montador segue o mesmo recorte de página -- sem isso,
  // "Tudo" + Kanban mostraria todo o histórico de uma vez, sem relação
  // com o que a visão "Por dia" ao lado está mostrando.
  const pageRequests = filterRange ? requests : pageGroups.flatMap((g) => g.items);

  // Repassado em praticamente todo buildHref abaixo -- rota/montador já
  // faziam isso individualmente; loja/busca (novos) entram do mesmo jeito.
  const commonParams = { rota: filterRota, assembler, store, q };

  return (
    <div className="flex flex-col gap-4">
      {/* Título + descrição + CTA no canto direito -- pedido do Victor
          25/08/2026 ("guia de padronização"), mesmo padrão das outras 2
          telas (fila/page.tsx, sac/notificacoes/page.tsx). */}
      <PageHeader
        title="Agenda"
        description="Visitas técnicas com data marcada -- troca de peça, vistoria, montagem e desmontagem na casa do cliente."
        cta={
          <Link
            href="/assistencia/nova-rapida"
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{ background: "var(--brand-green)" }}
          >
            + Nova visita
          </Link>
        }
      />

      {/* Segmented control -- mesma fileira de fila/page.tsx (Visitas/
          Entregas) -- pedido do Victor 27/08/2026: "coloque agenda
          dentro de solicitações ao lado de visitas/entregas". Ativo =
          quadrado VERDE + letra branca (achado do Victor 02/09/2026: ver
          fila/page.tsx). Agenda é rota própria (filtro/dado bem
          diferente -- mês corrente, por montador, não por rota), então
          cada uma das 3 páginas renderiza sua própria fileira em vez de
          layout compartilhado (mesma razão de SacTabs.tsx). */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 p-1 self-start">
        <Link href="/assistencia/fila" className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200">
          Visitas
        </Link>
        <Link href="/assistencia/fila?tab=pecas" className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200">
          Entregas
        </Link>
        <Link
          href="/assistencia/agenda"
          className="px-4 py-1.5 rounded-md text-sm font-semibold text-white shadow-sm transition-all duration-200"
          style={{ background: "#1B5E3C" }}
        >
          Agenda
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
          href={buildHref({ range: "atrasado", ...commonParams, view })}
          className="flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold text-sm text-gray-800 dark:text-gray-100 transition-colors duration-150 hover:bg-white dark:hover:bg-gray-700"
          style={{ background: "color-mix(in srgb, var(--status-critical) 8%, var(--surface-1))", borderColor: "var(--status-critical)" }}
        >
          <span className="text-lg" aria-hidden="true">
            ⚠️
          </span>
          Você tem {overdueCount} visita{overdueCount === 1 ? "" : "s"} pendente{overdueCount === 1 ? "" : "s"} atrasada
          {overdueCount === 1 ? "" : "s"}.
          <span className="font-semibold shrink-0 ml-auto" style={{ color: "var(--status-critical)" }}>
            Clique para tratar →
          </span>
        </Link>
      ) : null}

      {/* Linha 1 do guia de padronização: filtros rápidos por período,
          mesmo componente FilterPill das outras 2 telas (ver
          FilterPill.tsx). */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <FilterPill
            key={f.label}
            label={f.label}
            selected={(f.value ?? undefined) === filterRange}
            href={buildHref({ range: f.value ?? undefined, ...commonParams, view: showKanban ? "montador" : undefined })}
          />
        ))}
        {/* Atalho "hoje" -- só faz sentido em "Tudo" (Atrasado/Hoje/Semana
            já são recortes de data próprios). Antes disso era navegação
            "[ < ] Mês [ > ]" um mês por vez -- pedido do Victor
            01/09/2026: virou a mesma paginação por mês de Visitas/
            Entregas (ver paginateMonths acima), então só falta um jeito
            de voltar direto pra página com o mês corrente quando o
            usuário navegou pra outra (ver Anterior/Próxima no rodapé da
            lista, abaixo). */}
        {!filterRange && currentPage !== defaultPage ? (
          <Link
            href={buildHref({ ...commonParams, view: showKanban ? "montador" : undefined })}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 ml-1"
          >
            hoje
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Só João Pessoa "de verdade" -- Agenda é visitas técnicas
            (montagem/manutenção), Campina Grande e rota extra genérica
            são conceito de entrega/carga, não fazem sentido aqui. */}
        {[{ label: "Todas as rotas", value: undefined }, ...JP_PRIMARY_ROTAS.map((r) => ({ label: ROTA_LABELS[r], value: r }))].map((f) => (
          <FilterPill
            key={f.label}
            label={f.label}
            selected={f.value === filterRota}
            href={buildHref({ range: filterRange, ...commonParams, rota: f.value, view: showKanban ? "montador" : undefined })}
          />
        ))}
      </div>

      {/* Linha 2 do guia de padronização: selects + busca -- pedido do
          Victor 25/08/2026: "Selects dropdowns padronizados: Loja/Origem
          | Cidade/Região | Técnico/Motorista". Cidade não entra aqui --
          Agenda é visita técnica, não tem rota de Campina Grande (só
          entrega/carga tem, ver comentário acima). Loja é novo; Técnico
          já existia (era só "assembler"). */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
      </div>

      <form action="/assistencia/agenda" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterRange ? <input type="hidden" name="range" value={filterRange} /> : null}
        {filterRota ? <input type="hidden" name="rota" value={filterRota} /> : null}
        {assembler ? <input type="hidden" name="assembler" value={assembler} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {showKanban ? <input type="hidden" name="view" value="montador" /> : null}
        {showPastResolved ? <input type="hidden" name="showPast" value="1" /> : null}
        {/* Ícone de lupa -- mesmo padrão de fila/page.tsx/notificacoes
            (ver lá). Só cobre cliente/telefone/nº do chamado/loja (ver
            matchesQuery acima) -- mais limitado que a busca de
            Entregas/Solicitações, que já é feita no servidor. */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nº do chamado, cliente ou telefone…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 pl-8 pr-3 py-2 text-sm w-full text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
          />
        </div>
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Buscar
        </button>
        {q ? (
          <Link
            href={buildHref({ range: filterRange, rota: filterRota, assembler, store, view: showKanban ? "montador" : undefined, showPast: showPastResolved ? "1" : undefined })}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150"
          >
            Limpar busca
          </Link>
        ) : null}
      </form>

      {/* Kanban por montador só faz sentido com mouse/teclado pra arrastar
          -- desktop only, mesmo padrão de MobileActionSheet/AgendaDayGroups
          (interação diferente por tamanho de tela, não só reflow). No
          celular a alternância nem aparece, sempre fica na visão por dia. */}
      <div className="hidden sm:flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <FilterPill
            label="Por dia"
            selected={!showKanban}
            href={buildHref({ range: filterRange, ...commonParams })}
          />
          <FilterPill
            label="Por montador"
            selected={showKanban}
            href={buildHref({ range: filterRange, ...commonParams, view: "montador" })}
          />
        </div>
        {/* Dias já concluídos ficam escondidos por padrão -- pedido do
            Victor 25/08/2026: "Dias anteriores a 'Hoje' que já foram
            finalizados não devem aparecer na lista principal... ficar
            ocultos por padrão sob um filtro". */}
        {!showKanban && pastResolvedCount > 0 ? (
          <Link
            href={buildHref({
              range: filterRange,
              ...commonParams,
              showPast: showPastResolved ? undefined : "1",
            })}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150"
          >
            {showPastResolved ? "Ocultar dias já concluídos" : `Ver dias já concluídos (${pastResolvedCount})`}
          </Link>
        ) : null}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{filterRange ? "Nenhuma visita nesse período." : "Nenhuma visita agendada."}</p>
        </div>
      ) : !showKanban && groups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Só tem dias já concluídos nesse período --{" "}
            <Link href={buildHref({ range: filterRange, ...commonParams, showPast: "1" })} className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150">
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
              motorista aparecer aqui, ele não tem montador nenhum pra trocar.
              `pageRequests` (não `requests`) -- segue o mesmo recorte de
              página que "Por dia" ao lado, ver pageRequests acima. */}
          <AgendaKanbanBoard
            requests={pageRequests.filter((r) => !(DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type))}
            assemblers={assemblers.filter(isAssistenciaControlledAssembler)}
          />
        </div>
      ) : (
        <AgendaDayGroups groups={pageGroups} todayKey={todayKey} />
      )}

      {/* Anterior/Próxima por MÊS (não por linha) -- mesma paginação de
          fila/page.tsx (ver paginateMonths, weekGrouping.ts). Só aparece
          em "Tudo" com mais de 1 mês de dados agendados -- Atrasado/
          Hoje/Semana nunca paginam (mesmo critério de `postFiltered` em
          fila/page.tsx: são recortes estreitos de propósito). */}
      {!filterRange && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {currentPage > 1 ? (
            <Link
              href={buildHref({ ...commonParams, view: showKanban ? "montador" : undefined, showPast: showPastResolved ? "1" : undefined, page: currentPage - 1 })}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
            >
              ← Mês mais recente
            </Link>
          ) : null}
          <span className="text-sm text-gray-400 dark:text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildHref({ ...commonParams, view: showKanban ? "montador" : undefined, showPast: showPastResolved ? "1" : undefined, page: currentPage + 1 })}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
            >
              Mês mais antigo →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
