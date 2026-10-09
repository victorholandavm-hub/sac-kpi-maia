import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listScheduledRequests, listStores, agendaEffectiveDate, type ServiceRequestSummary, type AgendaRange } from "@/lib/serviceRequests";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { UnderlineTab } from "@/components/UnderlineTab";
import { AgendaDayGroups } from "@/components/assistencia/AgendaDayGroups";
import { AgendaKanbanBoard } from "@/components/assistencia/AgendaKanbanBoard";
import { JP_PRIMARY_ROTAS, ROTA_LABELS, isRota } from "@/lib/rotas";
import { AGENDA_ANY_ASSEMBLER_TYPES, DELIVERY_REQUEST_TYPES, EQUIPE_INTERNA_ASSEMBLERS } from "@/lib/assistenciaLabels";
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

function buildHref(params: {
  range?: string;
  rota?: string;
  view?: string;
  page?: number;
  showPast?: string;
  store?: string;
  q?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params.range) sp.set("range", params.range);
  if (params.rota) sp.set("rota", params.rota);
  if (params.view) sp.set("view", params.view);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.showPast) sp.set("showPast", params.showPast);
  if (params.store) sp.set("store", params.store);
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
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

// Quem entra na Agenda -- pedido do Victor 09/10/2026: equipe interna
// (Manoel/Adriel CD) continua entrando com qualquer tipo de visita, e agora
// troca de peça/vistoria de QUALQUER outro montador também entra (ver
// AGENDA_ANY_ASSEMBLER_TYPES, assistenciaLabels.ts) -- sem sair de Visitas,
// só passa a aparecer nas duas abas.
function isAgendaRequest(r: ServiceRequestSummary): boolean {
  return (
    (EQUIPE_INTERNA_ASSEMBLERS as readonly string[]).includes(r.assemblerName ?? "") ||
    (AGENDA_ANY_ASSEMBLER_TYPES as readonly string[]).includes(r.type)
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    rota?: string;
    view?: string;
    page?: string;
    showPast?: string;
    store?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  redirectIfSac(await getProfile());
  const { range, rota, view, page: pageParam, showPast, store, q, from, to } = await searchParams;
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
  const [allRequests, stores, overdueRaw] = await Promise.all([
    listScheduledRequests({ range: filterRange }),
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
  // Agenda era a agenda EXCLUSIVA da equipe interna (Manoel -- pedido do
  // Victor 04/09/2026: "todos os montadores dentro de visitas e só manoel
  // em agenda" -- + Adriel CD, que entrou 02/10/2026 no mesmo "nível") até
  // 09/10/2026: a partir daí, troca de peça/vistoria de QUALQUER montador
  // também entra aqui (ver isAgendaRequest acima) -- o resto dos tipos dos
  // montadores terceirizados/próprios de loja continua só no alerta de
  // atrasadas da aba Visitas, ver fila/page.tsx. Trava incondicional -- não
  // depende mais do filtro "assembler" da URL (removido do formulário, ver
  // abaixo), até porque não faria sentido filtrar essa agenda por um
  // montador terceirizado especificamente (ela já traz todos quando o
  // chamado é troca de peça/vistoria).
  // Período manual (De/Até) -- pedido do Victor 03/10/2026: "preciso que
  // na aba de agenda tenha a seleção por período, para que quando eu
  // selecionar o periodo, apareça tudo, inclusive esses números de manoel
  // e adriel cd" (ver visitasPorPessoa abaixo). Filtro independente dos
  // atalhos de range (Atrasado/Hoje/Semana/Tudo) -- `requests` já traz o
  // histórico inteiro quando nenhum atalho está selecionado (ver
  // comentário de `allRequests` acima), então um De/Até aqui não precisa
  // de busca nova nenhuma, só mais um filtro em JS por cima do que já
  // existe.
  const requests = allRequests
    .filter(isAgendaRequest)
    .filter((r) => !filterRota || r.rota === filterRota)
    .filter((r) => !store || r.storeId === store)
    .filter((r) => !filterQ || matchesQuery(r, filterQ))
    .filter((r) => !from || (agendaEffectiveDate(r) ?? "") >= from)
    .filter((r) => !to || (agendaEffectiveDate(r) ?? "") <= to);
  const overdueCount = (overdueRaw ?? requests)
    .filter(isAgendaRequest)
    .filter((r) => !filterRota || r.rota === filterRota)
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

  // Vistoria/troca de peça por pessoa da equipe interna -- pedido do
  // Victor 03/10/2026 ("tem o número de vistorias e troca de peças feitas
  // por manoel e agora adriel CD?" / "pode ser na aba agenda e na aba
  // relatorio, nos dois"). Conta direto de `requests` (já filtrado pelos
  // filtros ativos da página -- range/rota/loja/busca), sem busca extra.
  // trocaPecaChamados = nº de chamados (tickets) de troca_peca; trocaPecaPecas
  // = soma das peças (quantity de cada item) dentro desses chamados --
  // pedido do Victor 03/10/2026: "creio que ele as vezes troca mais de uma
  // peça por chamado" -- confirmado (um chamado de troca_peca pode ter
  // vários itens, ver QuickCreateRequestForm). Sem item nenhum registrado
  // no chamado, conta 1 peça (o chamado em si já representa a troca).
  const visitasPorPessoa = EQUIPE_INTERNA_ASSEMBLERS.map((name) => {
    const trocaPecaRequests = requests.filter((r) => r.assemblerName === name && r.type === "troca_peca");
    return {
      name,
      vistoria: requests.filter((r) => r.assemblerName === name && r.type === "vistoria").length,
      trocaPecaChamados: trocaPecaRequests.length,
      trocaPecaPecas: trocaPecaRequests.reduce(
        (sum, r) => sum + (r.items.length > 0 ? r.items.reduce((s, i) => s + i.quantity, 0) : 1),
        0
      ),
    };
  });

  // Paginação por MÊS -- pedido do Victor 01/09/2026 (mesma regra de
  // fila/page.tsx, ver paginateMonths/weekGrouping.ts): um mês por
  // página. Só entra em jogo em "Tudo" sem período manual -- Atrasado/
  // Hoje/Semana já são recortes de data próprios (mesmo critério de
  // `postFiltered` em fila/page.tsx), e um De/Até escolhido à mão (pedido
  // do Victor 03/10/2026) também já É um recorte fechado -- paginar por
  // cima dele escondia resultado sem motivo. Sem página explícita na URL,
  // abre direto na página que contém o mês corrente (equivalente ao "mês
  // corrente por padrão" de antes).
  const hasCustomRange = !!(from || to);
  const bypassPagination = filterRange || hasCustomRange;
  const allMonths = !bypassPagination ? groupIntoMonths(groups, (g) => g.dateKey) : [];
  const requestedPage = /^\d+$/.test(pageParam ?? "") ? parseInt(pageParam!, 10) : undefined;
  const defaultPage = pageContainingMonth(allMonths, currentMonthKey());
  const { pageMonths, totalPages } = !bypassPagination ? paginateMonths(allMonths, requestedPage ?? defaultPage) : { pageMonths: [], totalPages: 1 };
  const currentPage = Math.min(Math.max(1, requestedPage ?? defaultPage), totalPages);
  const pageGroups = bypassPagination ? groups : pageMonths.flatMap((m) => m.weeks.flatMap((w) => w.days));
  // Kanban por montador segue o mesmo recorte de página -- sem isso,
  // "Tudo" + Kanban mostraria todo o histórico de uma vez, sem relação
  // com o que a visão "Por dia" ao lado está mostrando.
  const pageRequests = bypassPagination ? requests : pageGroups.flatMap((g) => g.items);

  // Repassado em praticamente todo buildHref abaixo -- rota já fazia isso
  // individualmente; loja/busca (novos) entram do mesmo jeito. "assembler"
  // saiu daqui 04/09/2026 -- Agenda virou a agenda exclusiva da equipe
  // interna (ver filtro incondicional em `requests`/`overdueCount` acima),
  // não faz mais sentido filtrar por outro montador terceirizado.
  const commonParams = { rota: filterRota, store, q, from, to };

  return (
    <div className="flex flex-col gap-4">
      {/* Título + descrição + CTA no canto direito -- pedido do Victor
          25/08/2026 ("guia de padronização"), mesmo padrão das outras 2
          telas (fila/page.tsx, sac/notificacoes/page.tsx). */}
      <PageHeader
        title="Agenda"
        description="Visitas técnicas da equipe interna (Manoel, Adriel CD) com data marcada -- montagem, desmontagem, troca de peça e vistoria na casa do cliente. Troca de peça e vistoria de qualquer outro montador, quando têm data marcada, também aparecem aqui (e continuam na aba Visitas); os demais tipos desses montadores ficam só em Visitas."
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

      {/* Abas sublinhadas -- mesma fileira de fila/page.tsx (Visitas/
          Entregas/Agenda), ver UnderlineTab.tsx pro racional completo.
          SEM self-start (mesma correção de fila/page.tsx, pedido do
          Victor 14/09/2026: "ficou faltando só uma linha na margem
          complementando a linha") -- border-b estica a largura toda. */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        <UnderlineTab href="/assistencia/fila" label="Visitas" active={false} />
        <UnderlineTab href="/assistencia/fila?tab=pecas" label="Entregas" active={false} />
        <UnderlineTab href="/assistencia/agenda" label="Agenda" active />
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

      {/* Todos os filtros agrupados num retângulo só -- mesmo pedido/motivo
          de fila/page.tsx (03/09/2026, ver lá): "agrupe esses filtros e
          coloque só uma linha como margem no retângulo". Última tela que
          faltava receber esse tratamento. */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
      {/* Linha 1 do guia de padronização: filtros rápidos por período,
          mesmo componente FilterPill das outras 2 telas (ver
          FilterPill.tsx). */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <FilterPill
            key={f.label}
            label={f.label}
            // Clicar num atalho pronto larga um De/Até manual que porventura
            // esteja ativo (sem from/to aqui, de propósito) -- os dois são
            // formas diferentes de escolher "qual período", não fazem
            // sentido compostos (ex.: "Hoje" + "01/09 a 30/09" não mostra
            // nada).
            selected={!hasCustomRange && (f.value ?? undefined) === filterRange}
            href={buildHref({ range: f.value ?? undefined, rota: filterRota, store, q, view: showKanban ? "montador" : undefined })}
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

      {/* Linha 2 do guia de padronização: select de loja + busca -- pedido
          do Victor 25/08/2026: "Selects dropdowns padronizados: Loja/Origem
          | Cidade/Região | Técnico/Motorista". Cidade não entra aqui --
          Agenda é visita técnica, não tem rota de Campina Grande (só
          entrega/carga tem, ver comentário acima). O select de Técnico/
          Montador saiu 04/09/2026 -- Agenda virou a agenda exclusiva da
          equipe interna (ver filtro incondicional acima), não faz mais
          sentido filtrar por outro montador terceirizado aqui. */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
      </div>

      <form action="/assistencia/agenda" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterRange ? <input type="hidden" name="range" value={filterRange} /> : null}
        {filterRota ? <input type="hidden" name="rota" value={filterRota} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {showKanban ? <input type="hidden" name="view" value="montador" /> : null}
        {showPastResolved ? <input type="hidden" name="showPast" value="1" /> : null}
        {/* Período manual (De/Até) -- pedido do Victor 03/10/2026: "preciso
            que na aba de agenda tenha a seleção por período, para que
            quando eu selecionar o periodo, apareça tudo, inclusive esses
            números de manoel e adriel cd". Mesmo padrão de De/Até usado em
            fila/page.tsx -- filtra por `agendaEffectiveDate` (ver `requests`
            acima), independente dos atalhos Atrasado/Hoje/Semana/Tudo. */}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          De
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-2 text-sm text-gray-800 dark:text-gray-100"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          Até
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-2 text-sm text-gray-800 dark:text-gray-100"
          />
        </label>
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
        {q || from || to ? (
          <Link
            href={buildHref({ range: filterRange, rota: filterRota, store, view: showKanban ? "montador" : undefined, showPast: showPastResolved ? "1" : undefined })}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150"
          >
            Limpar busca/período
          </Link>
        ) : null}
      </form>
      </div>
      {/* fecha o retângulo de filtros aberto acima */}

      {/* Vistoria/troca de peça por pessoa -- pedido do Victor 03/10/2026,
          logo abaixo do filtro por período (03/10/2026, pedido seguinte:
          "deixe os numeros de manoel e adriel cd com esse mesmo layout
          logo abaixo do filtro por período") -- reflete os mesmos filtros
          já aplicados na lista abaixo (range/rota/loja/busca/De-Até). */}
      <div className="flex items-center gap-3 flex-wrap">
        {visitasPorPessoa.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {p.name}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {p.vistoria} vistoria{p.vistoria === 1 ? "" : "s"} · {p.trocaPecaChamados} chamado{p.trocaPecaChamados === 1 ? "" : "s"} de troca de peça
              {p.trocaPecaPecas !== p.trocaPecaChamados ? ` (${p.trocaPecaPecas} peças)` : ""}
            </span>
          </div>
        ))}
      </div>

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
          <p className="text-sm text-gray-400 dark:text-gray-500">{bypassPagination ? "Nenhuma visita nesse período." : "Nenhuma visita agendada."}</p>
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
          {/* Kanban por dia -- exclui os tipos que saem de motorista (troca/
              entrega de produto, envio de peça): esse Kanban arrasta pra
              reatribuir MONTADOR (setAssemblerName), não faz sentido um
              chamado de motorista aparecer aqui. Colunas fixas da equipe
              interna (Manoel desde 04/09/2026, + Adriel CD desde
              02/10/2026) + qualquer outro montador que apareça em
              `requests` (troca de peça/vistoria dele, ver isAgendaRequest
              acima) -- AgendaKanbanBoard já monta coluna extra sozinho pra
              nome fora da lista (ver columnNames lá), então não precisa
              listar os terceirizados aqui. `pageRequests` (não `requests`)
              -- segue o mesmo recorte de página que "Por dia" ao lado, ver
              pageRequests acima. */}
          <AgendaKanbanBoard
            requests={pageRequests.filter((r) => !(DELIVERY_REQUEST_TYPES as readonly string[]).includes(r.type))}
            assemblers={[...EQUIPE_INTERNA_ASSEMBLERS]}
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
