import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus, isMostruarioRequest, type ServiceRequestSummary, type RequestType } from "@/lib/serviceRequests";
import { listAssemblers, listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek, ROTA_CITY } from "@/lib/rotas";
import { STATUS_COLORS, OWN_ASSEMBLER_STORE_IDS, VISITA_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaQueueGroup } from "@/components/assistencia/AssistenciaQueueGroup";
import { EntregasGroupsList } from "@/components/assistencia/EntregasGroupsList";
import { EntregasKanbanHoje } from "@/components/assistencia/EntregasKanbanHoje";
import { isDeliveryScheduled } from "@/components/assistencia/DeliveryStatusBadge";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";
import { NovaEntregaShortcut } from "@/components/assistencia/NovaEntregaShortcut";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { groupIntoWeeks } from "@/lib/weekGrouping";
import {
  groupByRota,
  sortGroupItems,
  filterOverdueOpen,
  filterSemRotaOpen,
  pinSemRotaFirst,
  type QueueGroup,
  ENTREGA_FILTERS,
  ORIGEM_FILTERS,
  CITY_FILTERS,
  ENTREGA_TYPES,
  ENTREGA_TYPES_SAC,
  ENTREGA_TYPES_ASSISTENCIA,
} from "@/lib/entregaQueueGrouping";

// Aba "Visitas" -- agrupado por data de criação, mais novo pro mais antigo.
// Aba "Entregas" usa groupByRota (compartilhado com a tela de notificações
// do SAC, ver src/lib/entregaQueueGrouping.ts -- extraído de propósito pra
// nunca mais as duas telas divergirem, achado do Victor 24/08/2026: "a
// tela de notificação de assistencia do sac deve ser igual a de admin").
function groupByDate(requests: ServiceRequestSummary[]): QueueGroup[] {
  const groups: QueueGroup[] = [];
  for (const r of requests) {
    const date = new Date(r.createdAt);
    const dateKey = date.toISOString().slice(0, 10);
    let group = groups.find((g) => g.key === dateKey);
    if (!group) {
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      group = { key: dateKey, label, headerBg: "var(--brand-green)", headerText: "var(--brand-green-ink)", borderColor: "var(--brand-green)", items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }
  groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  for (const group of groups) sortGroupItems(group.items);
  return groups;
}

// Isolado numa função à parte (não direto no corpo do componente) --
// Date.now() é impuro, e o lint de pureza do React Compiler só reclama de
// chamada direta no corpo do componente, não dentro de uma função nomeada
// (mesmo padrão de timeAgo em admin/page.tsx).
function currentTimeMs(): number {
  return Date.now();
}

function buildHref(params: {
  status?: string;
  q?: string;
  page?: number;
  store?: string;
  assembler?: string;
  from?: string;
  to?: string;
  tab?: string;
  origem?: string;
  sched?: string;
  alvo?: string;
  city?: string;
  urgente?: string;
  semrota?: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.store) sp.set("store", params.store);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.tab) sp.set("tab", params.tab);
  if (params.origem) sp.set("origem", params.origem);
  if (params.sched) sp.set("sched", params.sched);
  if (params.alvo) sp.set("alvo", params.alvo);
  if (params.city) sp.set("city", params.city);
  if (params.urgente) sp.set("urgente", params.urgente);
  if (params.semrota) sp.set("semrota", params.semrota);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/assistencia/fila?${qs}` : "/assistencia/fila";
}

// Chip "Clientes x Mostruário" -- só na aba Visitas -- pedido do Victor
// 22/08/2026: "Crie chips de filtro no topo para isolar chamados comuns de
// solicitações de Mostruário das Lojas, reduzindo o volume de itens na tela
// principal quando o foco for atendimento ao cliente final". Reaproveita
// isMostruarioRequest (serviceRequests.ts) -- mesmo heurística já usada em
// Indicadores/relatórios (order_code vazio + clientName começando com
// "Mostruário — "), não precisa de coluna nova.
const ALVO_FILTERS: { label: string; value: "cliente" | "mostruario" | null }[] = [
  { label: "Todos", value: null },
  { label: "Clientes", value: "cliente" },
  { label: "🏬 Mostruário", value: "mostruario" },
];

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todas", value: null },
  { label: "Abertas", value: "aberta" },
  { label: "Em contato", value: "em_contato" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluídas", value: "concluida" },
  { label: "Canceladas", value: "cancelada" },
];

// Troca/entrega de produto (SAC) e envio/recolhimento de peça (assistência)
// saem no mesmo carro, na mesma rota do dia -- por isso ficam juntos numa
// aba só, visível tanto daqui quanto de /assistencia/sac (ver lá), cada lado
// vendo a rota inteira mesmo só gerenciando o que é seu (canManage já cuida
// disso). Não tem nada a ver com visita de montador (montagem/desmontagem/
// troca de peça/vistoria), que fica exclusiva na outra aba -- "recolhimento"
// mudou de lado em 18/08/2026 (era visita de montador, virou entrega de
// motorista, ver DELIVERY_REQUEST_TYPES). ENTREGA_FILTERS/ORIGEM_FILTERS/
// ENTREGA_TYPES* vêm de entregaQueueGrouping.ts -- compartilhados com a
// tela de notificações do SAC (mesmo motivo de groupByRota, ver acima).
const VISITA_TYPES: RequestType[] = [...VISITA_REQUEST_TYPES];

export default async function AssistenciaQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    store?: string;
    assembler?: string;
    from?: string;
    to?: string;
    tab?: string;
    origem?: string;
    sched?: string;
    alvo?: string;
    city?: string;
    urgente?: string;
    semrota?: string;
  }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  const { status, q, page: pageParam, store, assembler, from, to, tab, origem, sched, alvo, city, urgente, semrota } = await searchParams;
  const filterStatus = isRequestStatus(status) ? status : undefined;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const dateFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const dateTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
  // Aba "Visitas" (padrão) x "Entregas" -- pros dois papéis que chegam
  // aqui (SAC nunca chega, ver redirectIfSac acima; notificação externa
  // continua só em /assistencia/sac, não é entrega de rota).
  const showPecas = tab === "pecas";
  // Filtro SAC x Assistência só existe dentro da aba Entregas -- ignora um
  // valor de "origem" que tenha sobrado na URL de antes de trocar pra
  // Visitas, mesmo padrão de effectiveAssembler logo abaixo.
  const filterOrigem = showPecas && (origem === "sac" || origem === "assistencia") ? origem : undefined;
  // Programado/Não programado (ver ENTREGA_FILTERS acima) -- também só faz
  // sentido dentro da aba Entregas, mesmo padrão de filterOrigem.
  const filterSched: boolean | undefined = showPecas && filterStatus === "aberta" && (sched === "1" || sched === "0") ? sched === "1" : undefined;
  const schedParam = filterSched === true ? "1" : filterSched === false ? "0" : undefined;
  // Clientes x Mostruário (ver ALVO_FILTERS acima) -- só existe na aba
  // Visitas, mesmo padrão de filterOrigem/filterSched pras outras abas.
  const filterAlvo: "cliente" | "mostruario" | undefined = !showPecas && (alvo === "cliente" || alvo === "mostruario") ? alvo : undefined;
  // Filtro por cidade (ver CITY_FILTERS) -- só existe dentro da aba
  // Entregas, mesmo padrão das outras. Visitas não usa esse filtro --
  // Campina Grande não tem rota de visita técnica (montador), só de
  // entrega.
  const filterCity: "joao_pessoa" | "campina_grande" | undefined =
    showPecas && (city === "joao_pessoa" || city === "campina_grande") ? city : undefined;
  // Banner "Remarcar urgente" (ver filterOverdueOpen) -- pedido do Victor
  // 25/08/2026: entregas/envios já atrasados (data agendada no passado,
  // ainda "aberta") precisam de um jeito bem visível de achar e remarcar,
  // sem depender de reparar sozinho no selo "ATRASADA" dentro de cada
  // grupo. Só existe na aba Entregas.
  const filterUrgente = showPecas && urgente === "1";
  // Pill "sem rota" (ver filterSemRotaOpen) -- pedido do Victor 25/08/2026
  // (revisão da tela de notificações): "Sem Rota Definida... não devem
  // ficar perdidos no meio do feed de datas". Mesmo padrão de
  // filterUrgente acima -- só existe na aba Entregas.
  const filterSemRota = showPecas && semrota === "1";
  const types = showPecas
    ? filterOrigem === "sac"
      ? ENTREGA_TYPES_SAC
      : filterOrigem === "assistencia"
        ? ENTREGA_TYPES_ASSISTENCIA
        : ENTREGA_TYPES
    : VISITA_TYPES;
  // Entrega de peça não tem montador (é motorista) -- ignora um valor de
  // "assembler" que tenha sobrado na URL de antes de trocar de aba, senão
  // filtra por um campo que essas linhas nunca preenchem e a lista some
  // inteira sem nenhuma explicação.
  const effectiveAssembler = showPecas ? undefined : assembler;
  // Montagem/desmontagem/vistoria de Mamanguape/Campina Grande (lojas com
  // montador próprio) só aparece pra admin e Antonio -- resto da equipe de
  // assistência vê a fila normalmente, só sem essas duas (ver
  // OWN_ASSEMBLER_STORE_IDS). Sem efeito na aba "Entregas", que nunca tem
  // esses tipos.
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const today = new Date().toISOString().slice(0, 10);
  const [{ items: rawRequests, total: rawTotal, pageSize }, stores, assemblers, drivers, rotaOverview] = await Promise.all([
    listRequests({ status: filterStatus, q, page, storeId: store, assemblerName: effectiveAssembler, types, dateFrom, dateTo, excludeOwnAssemblerStoreIds }),
    listStores(),
    listAssemblers(),
    showPecas ? listDrivers() : Promise.resolve([]),
    showPecas ? getRotaWeekOverview(startOfRotaWeek(today), 14) : Promise.resolve([]),
  ]);
  // Programado/Não programado não são status de verdade no banco (ver
  // ENTREGA_FILTERS acima) -- `.eq("status", "aberta")` já rolou no
  // servidor, esse filtro extra em JS separa quem já tem data+rota de
  // quem não tem. `total`/`totalPages` do servidor ficam errados nesse
  // caso (contam a "aberta" inteira, não só o sub-balde) -- recalculo os
  // dois a partir do que sobrou depois do filtro. Sem problema de paginação
  // na prática: a fila de entregas em aberto nunca chega perto do tamanho
  // de página pra precisar de mais de uma página dividida ainda por cima
  // em programado/não programado.
  let requests = filterSched === undefined ? rawRequests : rawRequests.filter((r) => isDeliveryScheduled(r.scheduledDate, r.rota) === filterSched);
  // Mesmo raciocínio do filterSched acima -- "mostruário" não é uma coluna
  // no banco, é uma heurística sobre order_code/client_name (ver
  // isMostruarioRequest), então também só dá pra aplicar em JS depois da
  // busca no servidor.
  if (filterAlvo !== undefined) {
    requests = requests.filter((r) => isMostruarioRequest(r.orderCode, r.clientName) === (filterAlvo === "mostruario"));
  }
  // Cidade não é coluna no banco -- é derivada da rota (ver ROTA_CITY em
  // rotas.ts), mesmo raciocínio de filterSched/filterAlvo acima: filtro
  // em JS depois da busca. Sem rota ainda (`r.rota === null`) não entra
  // em nenhuma cidade.
  if (filterCity !== undefined) {
    requests = requests.filter((r) => r.rota !== null && ROTA_CITY[r.rota] === filterCity);
  }
  // Quantas estão atrasadas dentro do que já foi buscado (loja/origem/
  // data escolhidos) -- ANTES do filtro de status/programado, pra não
  // sumir o aviso só porque "Concluídas" ou "Não programado" tá
  // selecionado. Reflete o total de verdade só na visão padrão ("Todas").
  const overdueCount = showPecas ? filterOverdueOpen(rawRequests).length : 0;
  // Mesmo raciocínio do overdueCount acima, pro pill "sem rota".
  const semRotaCount = showPecas ? filterSemRotaOpen(rawRequests).length : 0;
  // Clicar no pill força só as atrasadas (ou só as sem rota) em aberto --
  // ignora status/programado escolhidos antes (não fazem sentido juntos:
  // os dois já implicam "aberta"). Mutuamente exclusivos -- os próprios
  // links de cada pill nunca combinam os dois parâmetros na URL.
  if (filterUrgente) {
    requests = filterOverdueOpen(rawRequests);
  } else if (filterSemRota) {
    requests = filterSemRotaOpen(rawRequests);
  }
  const postFiltered = filterSched !== undefined || filterAlvo !== undefined || filterCity !== undefined || filterUrgente || filterSemRota;
  const total = postFiltered ? requests.length : rawTotal;
  // "Sem rota" primeiro, não perdido no meio do feed por data -- ver
  // pinSemRotaFirst.
  const groups = showPecas ? pinSemRotaFirst(groupByRota(requests)) : groupByDate(requests);
  // Kanban só pra hoje (ver EntregasKanbanHoje) -- pedido do Victor
  // 25/08/2026: "Para a operação de Hoje, um quadro estilo Kanban". O
  // resto dos dias continua na sanfona de sempre, embaixo.
  const todayGroups = showPecas ? groups.filter((g) => g.dateBucket === "hoje") : [];
  const restGroups = showPecas ? groups.filter((g) => g.dateBucket !== "hoje") : groups;
  const todayOverview = showPecas ? (rotaOverview.find((d) => d.date === today) ?? null) : null;
  const totalPages = postFiltered ? 1 : Math.max(1, Math.ceil(total / pageSize));
  // Calculado uma vez aqui (Server Component, sem hooks) e repassado pra
  // AssistenciaQueueGroup -- lá dentro é "use client" com hooks, onde
  // chamar Date.now() direto no corpo do render quebra a regra de pureza.
  const now = currentTimeMs();

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />

      {/* Título + descrição + CTA no canto direito -- pedido do Victor
          25/08/2026 ("guia de padronização"): "Todas as telas devem
          começar com o Título H1... botão principal sempre fixado no
          canto superior direito". Muda de título/descrição junto com a
          aba Visitas/Entregas (ver logo abaixo) -- são duas telas
          diferentes de verdade (Solicitações x Entregas), só moram na
          mesma rota. */}
      <PageHeader
        title={showPecas ? "Entregas" : "Solicitações"}
        description={
          showPecas
            ? "Rotas de motorista -- troca, entrega e recolhimento de produto, envio e recolhimento de peça."
            : "Chamados de montagem, desmontagem, vistoria e troca de peça -- triagem de clientes e mostruário."
        }
        cta={
          <div className="flex items-center gap-2">
            {/* Contraste maior + atalho Alt+N só na aba Entregas -- pedido
                do Victor 21/08/2026: "Aumente o contraste visual do botão
                + Nova entrega no topo da página e adicione o atalho de
                teclado Alt + N". Visitas continua com o botão de sempre. */}
            {showPecas ? <NovaEntregaShortcut href="/assistencia/nova-entrega" /> : null}
            <Link
              href={showPecas ? "/assistencia/nova-entrega" : "/assistencia/nova-rapida"}
              className={showPecas ? "text-sm px-4 py-2.5 rounded-lg font-bold shadow-md" : "text-sm px-3 py-2 rounded font-medium"}
              style={
                showPecas
                  ? { background: "var(--brand-orange)", color: "#fff", border: "2px solid var(--brand-orange)" }
                  : { background: "var(--brand-green)", color: "var(--brand-green-ink)" }
              }
              title={showPecas ? "Atalho: Alt + N" : undefined}
            >
              + Nova {showPecas ? "entrega" : "visita"}
              {showPecas ? <span className="ml-1.5 text-xs font-normal opacity-80">(Alt+N)</span> : null}
            </Link>
          </div>
        }
      />

      {/* Pílulas cheias em vez de contorno fino -- pedido do Victor
          18/08/2026: a troca entre Visitas/Entregas é a navegação mais
          importante da tela (decide a tela inteira embaixo) e precisa ser a
          primeira coisa que salta aos olhos, não competir visualmente com
          os filtros de status logo abaixo. */}
      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, alvo: filterAlvo })}
          className="text-base font-bold px-4 py-2 rounded-full"
          style={
            !showPecas
              ? { background: "var(--brand-green)", color: "var(--brand-green-ink)" }
              : { border: "2px solid var(--border)", color: "var(--text-secondary)" }
          }
        >
          Visitas
        </Link>
        <Link
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, sched: schedParam, city: filterCity })}
          className="text-base font-bold px-4 py-2 rounded-full"
          style={
            showPecas
              ? { background: "var(--brand-green)", color: "var(--brand-green-ink)" }
              : { border: "2px solid var(--border)", color: "var(--text-secondary)" }
          }
        >
          Entregas
        </Link>
      </div>

      {/* Junior como motorista padrão da rota de João Pessoa -- pedido do
          Victor 26/08/2026: "coloque por padrão, o motorista junior na
          rota do dia de joao pessoa". Já valia só pra aba de notificação
          do SAC (pedido do Victor 21/08/2026) -- agora vale aqui também,
          a aba Entregas da própria assistência. Só preenche quando o dia
          ainda não tem motorista salvo (ver defaultDriver em
          RotaMotoristaDoDia.tsx) -- não sobrescreve atribuição já feita. */}
      {showPecas ? <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} defaultDriver="Junior" /> : null}

      {/* Linha 1 do guia de padronização: filtros rápidos por status, com
          contador -- pedido do Victor 25/08/2026 ("guia de padronização"):
          "Botões estilo Pill/Badge para filtro rápido com contadores
          numéricos". FilterPill centraliza o estilo (ver
          FilterPill.tsx) -- as pills coloridas (ENTREGA_FILTERS/FILTERS
          já trazem `color` própria) e as de alerta (pra remarcar/sem
          rota, com contador) ficam nessa mesma fileira. CTA saiu daqui,
          agora mora no PageHeader (canto direito, fixo). */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
        {showPecas
          ? ENTREGA_FILTERS.map((f) => (
              <FilterPill
                key={f.label}
                label={f.label}
                color={f.color}
                selected={(f.value.status ?? undefined) === filterStatus && (f.value.sched ?? undefined) === filterSched}
                href={buildHref({
                  status: f.value.status ?? undefined,
                  q,
                  store,
                  from: dateFrom,
                  to: dateTo,
                  tab: "pecas",
                  origem: filterOrigem,
                  sched: f.value.sched === true ? "1" : f.value.sched === false ? "0" : undefined,
                  city: filterCity,
                })}
              />
            ))
          : FILTERS.map((f) => (
              <FilterPill
                key={f.label}
                label={f.label}
                color={f.value ? (STATUS_COLORS[f.value] ?? "var(--text-secondary)") : undefined}
                selected={(f.value ?? undefined) === filterStatus}
                href={buildHref({ status: f.value ?? undefined, q, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, alvo: filterAlvo })}
              />
            ))}
        {/* Badge "pra remarcar" -- pedido do Victor 25/08/2026: "nao
            gostei da badge gigante... colocar uma badge em vermelho com
            a quantidade a remarcar ao lado de Todas/Programado/Não
            programado/Concluídas/Canceladas, pouca coisa maior em
            tamanho que os outros, mas bem vermelho e piscando" (banner
            grande de antes, ver git blame, era chamativo demais). Não
            usa FilterPill -- é maior de propósito (mais chamativo que os
            outros) e pisca (animate-pulse), duas coisas que o pill
            padrão não faz. */}
        {showPecas && (overdueCount > 0 || filterUrgente) ? (
          <Link
            href={
              filterUrgente
                ? buildHref({ store, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, city: filterCity })
                : buildHref({ store, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, city: filterCity, urgente: "1" })
            }
            className={`text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 font-bold ${filterUrgente ? "" : "animate-pulse"}`}
            style={{
              background: "var(--status-critical)",
              color: "#fff",
              border: filterUrgente ? "2px solid var(--text-primary)" : "2px solid var(--status-critical)",
            }}
          >
            ⚠ {overdueCount} pra remarcar
          </Link>
        ) : null}
        {/* Pill "sem rota" -- pedido do Victor 25/08/2026: "Sem Rota
            Definida... não devem ficar perdidos no meio do feed de
            datas", junto do resto dos atalhos rápidos com contador.
            Mesmo desenho do "pra remarcar" ao lado, cor de atenção em
            vez de crítica (não é atraso, é falta de atribuição). */}
        {showPecas && (semRotaCount > 0 || filterSemRota) ? (
          <Link
            href={
              filterSemRota
                ? buildHref({ store, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, city: filterCity })
                : buildHref({ store, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, city: filterCity, semrota: "1" })
            }
            className="text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 font-bold"
            style={{
              background: "var(--status-warning)",
              color: "#fff",
              border: filterSemRota ? "2px solid var(--text-primary)" : "2px solid var(--status-warning)",
            }}
          >
            🧭 {semRotaCount} sem rota
          </Link>
        ) : null}
      </div>

      {/* Clientes x Mostruário -- só na aba Visitas -- pedido do Victor
          22/08/2026: "Crie chips de filtro no topo para isolar chamados
          comuns de solicitações de Mostruário das Lojas, reduzindo o
          volume de itens na tela principal quando o foco for atendimento
          ao cliente final". */}
      {!showPecas ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Tipo de solicitação:
          </span>
          {ALVO_FILTERS.map((f) => {
            const selected = (f.value ?? undefined) === filterAlvo;
            return (
              <Link
                key={f.label}
                href={buildHref({ status: filterStatus, q, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, alvo: f.value ?? undefined })}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
                style={{
                  border: "1px solid var(--border)",
                  background: selected ? "var(--brand-green)" : "transparent",
                  color: selected ? "var(--brand-green-ink)" : "var(--text-secondary)",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {total} solicitaç{total === 1 ? "ão" : "ões"} encontrada{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}
      </p>

      {/* Filtros avançados consolidados numa barra só -- pedido do Victor
          25/08/2026: "os filtros estão espalhados em vários blocos...
          crie uma barra única de filtragem". Origem/Cidade eram fileiras
          de pills próprias (ver git blame) -- viram dropdown junto de
          Loja/Montador, mesmas opções de sempre (ORIGEM_FILTERS/
          CITY_FILTERS), só reaproveitadas aqui em vez de lá. */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
        {showPecas ? (
          <FilterSelect
            name="origem"
            placeholder="Origem: todas"
            options={ORIGEM_FILTERS.filter((f) => f.value !== null).map((f) => ({ value: f.value as string, label: f.label }))}
          />
        ) : null}
        {showPecas ? (
          <FilterSelect
            name="city"
            placeholder="Cidade: todas"
            options={CITY_FILTERS.filter((f) => f.value !== null).map((f) => ({ value: f.value as string, label: f.label }))}
          />
        ) : null}
        {/* Filtro de montador não existe na aba de entrega de peça -- lá é
            motorista, não montador (ver Motorista/Montador em
            AssistenciaQueueGroup.tsx). */}
        {showPecas ? null : <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />}
      </div>

      <form action="/assistencia/fila" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {store ? <input type="hidden" name="store" value={store} /> : null}
        {effectiveAssembler ? <input type="hidden" name="assembler" value={effectiveAssembler} /> : null}
        {showPecas ? <input type="hidden" name="tab" value="pecas" /> : null}
        {filterOrigem ? <input type="hidden" name="origem" value={filterOrigem} /> : null}
        {schedParam ? <input type="hidden" name="sched" value={schedParam} /> : null}
        {filterAlvo ? <input type="hidden" name="alvo" value={filterAlvo} /> : null}
        {filterCity ? <input type="hidden" name="city" value={filterCity} /> : null}
        {filterUrgente ? <input type="hidden" name="urgente" value="1" /> : null}
        {filterSemRota ? <input type="hidden" name="semrota" value="1" /> : null}
        {/* Ícone de lupa -- pedido do Victor 25/08/2026 ("guia de
            padronização"): "Input de Busca por texto largo com ícone de
            lupa". `pointer-events-none` no ícone -- sem isso o clique nele
            não cai no input logo atrás. */}
        <div className="relative flex-1 min-w-[240px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }} aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nº do chamado, cliente, produto, CPF ou telefone…"
            className="rounded border pl-8 pr-3 py-2 text-sm w-full"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          De
          <input
            type="date"
            name="from"
            defaultValue={dateFrom ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Até
          <input
            type="date"
            name="to"
            defaultValue={dateTo ?? ""}
            className="rounded border px-2 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Buscar
        </button>
        {q || dateFrom || dateTo ? (
          <Link
            href={buildHref({
              status: filterStatus,
              store,
              assembler: effectiveAssembler,
              tab: showPecas ? "pecas" : undefined,
              origem: filterOrigem,
              sched: schedParam,
              alvo: filterAlvo,
              city: filterCity,
              urgente: filterUrgente ? "1" : undefined,
              semrota: filterSemRota ? "1" : undefined,
            })}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Limpar busca/data
          </Link>
        ) : null}
      </form>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma solicitação encontrada.
          </p>
        </div>
      ) : showPecas ? (
        // Compartilhado com a tela de notificações do SAC -- ver
        // EntregasKanbanHoje.tsx/EntregasGroupsList.tsx.
        <div className="flex flex-col gap-4">
          <EntregasKanbanHoje groups={todayGroups} todayOverview={todayOverview} />
          {restGroups.length > 0 ? <EntregasGroupsList groups={restGroups} now={now} /> : null}
        </div>
      ) : (
        // Agrupado por semana -- pedido do Victor 25/08/2026: "na tela de
        // visitas preciso que fique organizado por semana, como é na tela
        // de agenda". groupIntoWeeks compartilhado com AgendaDayGroups.tsx
        // (ver weekGrouping.ts) -- mesmo visual/comportamento (recolhido
        // por padrão, rótulo "Semana de DD/MM a DD/MM"), só que aqui
        // agrupa por data de CRIAÇÃO do chamado (groupByDate acima), não
        // por data agendada (é o que Visitas sempre agrupou, só ganhou
        // mais um nível por cima agora). Grupo nomeado (group/week) --
        // cada dia já usa "group" sem nome pro próprio ícone de abrir/
        // fechar; sem o nome, abrir a semana giraria também as setas de
        // todos os dias lá dentro, mesmo fechados.
        <div className="flex flex-col gap-3">
          {groupIntoWeeks(groups, (g) => g.key).map((week) => {
            const weekTotal = week.days.reduce((sum, g) => sum + g.items.length, 0);
            return (
              <details key={week.weekKey} className="rounded-xl overflow-hidden group/week" style={{ border: "2px solid var(--border)" }}>
                <summary
                  className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="text-xs shrink-0 transition-transform duration-150 group-open/week:rotate-90"
                    style={{ color: "var(--text-secondary)" }}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {week.label}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    ({weekTotal})
                  </span>
                </summary>
                <div className="flex flex-col gap-3 p-3" style={{ background: "var(--surface-1)" }}>
                  {week.days.map((group) => (
                    // Recolhível -- pedido do Victor 20/08/2026: "os
                    // agrupamentos por data (Entregas e Visitas) precisam
                    // poder ser recolhidos, e mostrar a quantidade de
                    // dentro quando estiver recolhido". Recolhido por
                    // padrão -- achado do Victor 24/08/2026: "toda vez que
                    // eu entrar em qualquer tela, as demandas agrupadas
                    // precisam aparecer recolhidas". <details> nativo, sem
                    // JS extra; sem `open` já nasce fechado.
                    <details key={group.key} className="group rounded-xl overflow-hidden" style={{ border: `2px solid ${group.borderColor}` }}>
                      <summary
                        className="px-4 py-2 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                        style={{ background: group.headerBg }}
                      >
                        <span
                          className="text-xs shrink-0 transition-transform duration-150 group-open:rotate-90"
                          style={{ color: group.headerText }}
                          aria-hidden="true"
                        >
                          ▶
                        </span>
                        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: group.headerText }}>
                          {group.label}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: group.headerText, opacity: 0.85 }}>
                          ({group.items.length})
                        </span>
                      </summary>
                      <div style={{ background: "var(--surface-1)" }}>
                        <AssistenciaQueueGroup items={group.items} reorderable now={now} showCreatedDate={false} printable={false} showStaleBadge />
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page - 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined, origem: filterOrigem, sched: schedParam, alvo: filterAlvo, city: filterCity })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              ← Anterior
            </Link>
          ) : null}
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page + 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined, origem: filterOrigem, sched: schedParam, alvo: filterAlvo, city: filterCity })}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Próxima →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
