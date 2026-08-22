import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { listRequests, listStores, isRequestStatus, type ServiceRequestSummary, type RequestType } from "@/lib/serviceRequests";
import { listAssemblers, listDrivers } from "@/lib/payments";
import { getRotaWeekOverview, startOfRotaWeek, ROTAS, ROTA_LABELS, ROTA_COLORS } from "@/lib/rotas";
import {
  ASSISTENCIA_MANAGED_TYPES,
  DELIVERY_REQUEST_TYPES,
  SAC_MANAGED_TYPES,
  STATUS_COLORS,
  OWN_ASSEMBLER_STORE_IDS,
  VISITA_REQUEST_TYPES,
} from "@/lib/assistenciaLabels";
import { bucketByScheduledDate, type DateBucketKey } from "@/lib/dateBuckets";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { AssistenciaQueueGroup } from "@/components/assistencia/AssistenciaQueueGroup";
import { countByDeliveryStatus, isDeliveryScheduled } from "@/components/assistencia/DeliveryStatusBadge";
import { RotaMotoristaDoDia } from "@/components/assistencia/RotaMotoristaDoDia";
import { NovaEntregaShortcut } from "@/components/assistencia/NovaEntregaShortcut";

type QueueDateSubgroup = { dateKey: string; label: string; items: ServiceRequestSummary[] };
type QueueGroup = {
  key: string;
  label: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  items: ServiceRequestSummary[];
};

// Dentro de cada grupo, mesma prioridade de sempre: ordem manual
// (assistencia_order) primeiro, senão mais recente primeiro.
function sortGroupItems(items: ServiceRequestSummary[]) {
  items.sort((a, b) => {
    if (a.assistenciaOrder !== null && b.assistenciaOrder !== null) return a.assistenciaOrder - b.assistenciaOrder;
    if (a.assistenciaOrder !== null) return -1;
    if (b.assistenciaOrder !== null) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const NO_SCHEDULED_DATE_KEY = "sem_data";

// Hoje sempre em primeiro, não "a data mais antiga" -- achado 19/08/2026: a
// primeira versão disso era só ordem ascendente de data, então uma rota
// atrasada (ex.: 18/08, com hoje sendo 20/08) aparecia ANTES de hoje, porque
// "18" < "20" como string. bucketByScheduledDate (dateBuckets.ts) já resolve
// "hoje" de verdade, no fuso de João Pessoa (mesmo helper usado nas listas
// de motorista/montador, com a mesma armadilha de fuso já corrigida lá --
// ver comentário de BUSINESS_TZ_OFFSET_MS). Ordem aqui: hoje, amanhã, resto
// do futuro (crescente), atrasado, sem data -- diferente da lista de
// motorista (que abre "Atrasado" primeiro, por ser o que precisa de atenção
// imediata pra QUEM VAI SAIR AGORA); aqui é o pedido explícito do Victor
// ("a rota do dia sempre tem que ser a primeira de cima").
const SCHEDULED_DATE_BUCKET_RANK: Record<DateBucketKey, number> = {
  hoje: 0,
  amanha: 1,
  depois: 2,
  atrasado: 3,
  sem_data: 4,
};

// Só usado por groupByRota (aba Entregas) -- pedido do Victor 19/08/2026:
// "no agrupamento de cada rota, eu não devo ter ao lado a data de criação,
// mas sim a data da rota" (a de criação já aparece em cada notificação, ver
// showCreatedDate em AssistenciaQueueGroup). Agrupa por
// scheduledDate/approvedDeadline (o mesmo 📅 mostrado no card -- ver
// effectiveDate em AssistenciaQueueGroup.tsx), não por createdAt.
// Dia da semana ao lado da data -- pedido do Victor 21/08/2026: "Adicione
// o dia da semana ao lado da data nas barras sanfonadas (ex: ROTA CENTRO
// - 24/08/2026 (Segunda-feira)) para evitar erros na troca em bloco".
function weekdayLabel(dateStr: string): string {
  const raw = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function groupByScheduledDate(items: ServiceRequestSummary[]): QueueDateSubgroup[] {
  const groups: QueueDateSubgroup[] = [];
  for (const r of items) {
    const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
    const dateKey = effectiveDate ?? NO_SCHEDULED_DATE_KEY;
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = effectiveDate
        ? `${new Date(`${effectiveDate}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })} (${weekdayLabel(effectiveDate)})`
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
    // Dentro do mesmo balde ("depois" ou "atrasado" podem ter mais de uma
    // data) -- crescente entre si.
    return a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0;
  });
  for (const group of groups) sortGroupItems(group.items);
  return groups;
}

// Aba "Visitas" -- agrupado por data de criação, mais novo pro mais antigo.
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

// Aba "Entregas" -- agrupado por rota, com a data DA ROTA (agendada) ao
// lado no mesmo cabeçalho -- não a data de criação do chamado, que já
// aparece em cada notificação (pedido do Victor 18 e 19/08/2026: "a data...
// tem que aparecer ao lado da rota, não dentro" + "eu não devo ter ao lado
// a data de criação, mas sim a data da rota"). Cada grupo é um par
// rota+data-agendada.
//
// A DATA manda na ordem, não a rota -- pedido do Victor 20/08/2026: "eu
// preciso que o primeiro seja a data do dia e abaixo as próximas... e só
// depois disso, vem as datas que já passaram". Até 20/08/2026 o loop
// externo era por rota (Praia, Sul, Centro, Sem rota) e só por dentro de
// cada rota é que a data mandava -- isso fazia uma rota atrasada aparecer
// ANTES de outra rota com entrega hoje, só porque "Praia" vem antes de
// "Sul" na ordem fixa. Agora primeiro agrupa tudo por data (mesmo rank de
// groupByScheduledDate: hoje, amanhã, depois, atrasado, sem_data) e só
// dentro de cada data é que separa por rota.
function groupByRota(requests: ServiceRequestSummary[]): QueueGroup[] {
  const rotaOrder: (Omit<QueueGroup, "items" | "label"> & { rotaLabel: string })[] = [
    ...ROTAS.map((r) => ({ key: r, rotaLabel: `Rota ${ROTA_LABELS[r]}`, headerBg: ROTA_COLORS[r], headerText: "#fff", borderColor: ROTA_COLORS[r] })),
    { key: "sem_rota", rotaLabel: "Sem rota definida", headerBg: "var(--surface-2)", headerText: "var(--text-secondary)", borderColor: "var(--border)" },
  ];

  const groups: QueueGroup[] = [];
  for (const dateGroup of groupByScheduledDate(requests)) {
    for (const rotaInfo of rotaOrder) {
      const items = dateGroup.items.filter((r) => (r.rota ?? "sem_rota") === rotaInfo.key);
      if (items.length === 0) continue;
      groups.push({
        key: `${dateGroup.dateKey}_${rotaInfo.key}`,
        label: `${rotaInfo.rotaLabel} · ${dateGroup.label}`,
        headerBg: rotaInfo.headerBg,
        headerText: rotaInfo.headerText,
        borderColor: rotaInfo.borderColor,
        items,
      });
    }
  }
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
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/assistencia/fila?${qs}` : "/assistencia/fila";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todas", value: null },
  { label: "Abertas", value: "aberta" },
  { label: "Em contato", value: "em_contato" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Concluídas", value: "concluida" },
  { label: "Canceladas", value: "cancelada" },
];

// Filtros específicos da aba Entregas -- pedido do Victor 21/08/2026: "na
// tela de notificação de assistência, não tem como eu filtrar por
// programado". Os FILTERS genéricos acima (Abertas/Em contato/Em
// andamento) são pensados pro status detalhado de visita de montador --
// entrega não passa por negociação de agenda (ver isDeliveryScheduled em
// DeliveryStatusBadge.tsx), só existe "aberta" (que vira Programado/Não
// programado dependendo se já tem data+rota), concluída ou cancelada.
// "Programado"/"Não programado" não são status de verdade no banco -- são
// status=aberta filtrado depois em JS por scheduledDate+rota (ver `sched`
// abaixo), porque não dá pra expressar isso só com `.eq("status", ...)`.
type EntregaFilterValue = { status: string | null; sched?: boolean };
const ENTREGA_FILTERS: { label: string; value: EntregaFilterValue; color: string }[] = [
  { label: "Todas", value: { status: null }, color: "var(--text-secondary)" },
  { label: "Programado", value: { status: "aberta", sched: true }, color: "var(--brand-green)" },
  { label: "Não programado", value: { status: "aberta", sched: false }, color: "var(--status-warning)" },
  { label: "Concluídas", value: { status: "concluida" }, color: "var(--status-good)" },
  { label: "Canceladas", value: { status: "cancelada" }, color: "var(--text-muted)" },
];

// Troca/entrega de produto (SAC) e envio/recolhimento de peça (assistência)
// saem no mesmo carro, na mesma rota do dia -- por isso ficam juntos numa
// aba só, visível tanto daqui quanto de /assistencia/sac (ver lá), cada lado
// vendo a rota inteira mesmo só gerenciando o que é seu (canManage já cuida
// disso). Não tem nada a ver com visita de montador (montagem/desmontagem/
// troca de peça/vistoria), que fica exclusiva na outra aba -- "recolhimento"
// mudou de lado em 18/08/2026 (era visita de montador, virou entrega de
// motorista, ver DELIVERY_REQUEST_TYPES).
const VISITA_TYPES: RequestType[] = [...VISITA_REQUEST_TYPES];
const ENTREGA_TYPES: RequestType[] = [...DELIVERY_REQUEST_TYPES];

// Filtro "SAC x Assistência" dentro da aba Entregas -- pedido do Victor
// 20/08/2026: "preciso de um filtro na aba de entregas para conseguir
// filtrar as notificações do sac e da assistencia". Os 5 tipos de
// DELIVERY_REQUEST_TYPES se dividem nos dois grupos de sempre (mesma
// divisão de SAC_MANAGED_TYPES/ASSISTENCIA_MANAGED_TYPES, ver
// assistenciaLabels.ts) -- troca/entrega/recolhimento de PRODUTO nascem no
// SAC, envio/recolhimento de PEÇA nascem na assistência, mesmo os dois
// saindo juntos na mesma rota.
const ENTREGA_TYPES_SAC: RequestType[] = ENTREGA_TYPES.filter((t) => (SAC_MANAGED_TYPES as readonly string[]).includes(t));
const ENTREGA_TYPES_ASSISTENCIA: RequestType[] = ENTREGA_TYPES.filter((t) => (ASSISTENCIA_MANAGED_TYPES as readonly string[]).includes(t));

const ORIGEM_FILTERS: { label: string; value: "sac" | "assistencia" | null }[] = [
  { label: "Todas", value: null },
  { label: "SAC", value: "sac" },
  { label: "Assistência", value: "assistencia" },
];

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
  }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  const { status, q, page: pageParam, store, assembler, from, to, tab, origem, sched } = await searchParams;
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
  const requests = filterSched === undefined ? rawRequests : rawRequests.filter((r) => isDeliveryScheduled(r.scheduledDate, r.rota) === filterSched);
  const total = filterSched === undefined ? rawTotal : requests.length;
  const groups = showPecas ? groupByRota(requests) : groupByDate(requests);
  const totalPages = filterSched === undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  // Calculado uma vez aqui (Server Component, sem hooks) e repassado pra
  // AssistenciaQueueGroup -- lá dentro é "use client" com hooks, onde
  // chamar Date.now() direto no corpo do render quebra a regra de pureza.
  const now = currentTimeMs();

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher notifyOnInsert="Nova solicitação recebida!" />

      {/* Pílulas cheias em vez de contorno fino -- pedido do Victor
          18/08/2026: a troca entre Visitas/Entregas é a navegação mais
          importante da tela (decide a tela inteira embaixo) e precisa ser a
          primeira coisa que salta aos olhos, não competir visualmente com
          os filtros de status logo abaixo. */}
      <div className="flex items-center gap-2">
        <Link
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo })}
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
          href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: "pecas", origem: filterOrigem, sched: schedParam })}
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

      {showPecas ? <RotaMotoristaDoDia today={today} initialOverview={rotaOverview} drivers={drivers} /> : null}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {showPecas
            ? ENTREGA_FILTERS.map((f) => {
                const selected = (f.value.status ?? undefined) === filterStatus && (f.value.sched ?? undefined) === filterSched;
                return (
                  <Link
                    key={f.label}
                    href={buildHref({
                      status: f.value.status ?? undefined,
                      q,
                      store,
                      from: dateFrom,
                      to: dateTo,
                      tab: "pecas",
                      origem: filterOrigem,
                      sched: f.value.sched === true ? "1" : f.value.sched === false ? "0" : undefined,
                    })}
                    className="text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0"
                    style={
                      f.value.status
                        ? {
                            color: "var(--text-primary)",
                            background: selected ? `color-mix(in srgb, ${f.color} 35%, var(--surface-1))` : "transparent",
                            fontWeight: selected ? 600 : 400,
                            border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${f.color} 40%, transparent)`}`,
                          }
                        : {
                            borderColor: "var(--border)",
                            border: "1px solid var(--border)",
                            background: selected ? "var(--surface-1)" : "transparent",
                            color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                            fontWeight: selected ? 600 : 400,
                          }
                    }
                  >
                    {f.label}
                  </Link>
                );
              })
            : FILTERS.map((f) => {
                const selected = (f.value ?? undefined) === filterStatus;
                const color = f.value ? STATUS_COLORS[f.value] ?? "var(--text-secondary)" : "var(--text-secondary)";
                return (
                  <Link
                    key={f.label}
                    href={buildHref({
                      status: f.value ?? undefined,
                      q,
                      store,
                      assembler: effectiveAssembler,
                      from: dateFrom,
                      to: dateTo,
                    })}
                    className="text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0"
                    style={
                      f.value
                        ? {
                            color: "var(--text-primary)",
                            background: selected ? `color-mix(in srgb, ${color} 35%, var(--surface-1))` : "transparent",
                            fontWeight: selected ? 600 : 400,
                            border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${color} 40%, transparent)`}`,
                          }
                        : {
                            borderColor: "var(--border)",
                            border: "1px solid var(--border)",
                            background: selected ? "var(--surface-1)" : "transparent",
                            color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                            fontWeight: selected ? 600 : 400,
                          }
                    }
                  >
                    {f.label}
                  </Link>
                );
              })}
        </div>
        {/* Contraste maior + atalho Alt+N só na aba Entregas -- pedido do
            Victor 21/08/2026: "Aumente o contraste visual do botão + Nova
            entrega no topo da página e adicione o atalho de teclado
            Alt + N". Visitas continua com o botão de sempre (pedido era
            especificamente sobre "+ Nova entrega"). */}
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

      {showPecas ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Origem:
          </span>
          {ORIGEM_FILTERS.map((f) => {
            const selected = (f.value ?? undefined) === filterOrigem;
            return (
              <Link
                key={f.label}
                href={buildHref({ status: filterStatus, q, store, from: dateFrom, to: dateTo, tab: "pecas", origem: f.value ?? undefined, sched: schedParam })}
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

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="store" placeholder="Todas as lojas" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
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
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nº do chamado, cliente, produto, CPF, telefone ou código do pedido…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
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
            href={buildHref({ status: filterStatus, store, assembler: effectiveAssembler, tab: showPecas ? "pecas" : undefined, origem: filterOrigem, sched: schedParam })}
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
      ) : (
        groups.map((group) => {
          // Divisão programado/concluído/cancelado, com o número ao lado
          // de cada um -- pedido do Victor 21/08/2026: "dentro da aba de
          // cada rota... preciso que fique dividido em programado,
          // concluido, cancelado". Só faz sentido pra Entregas (status
          // simplificado de DeliveryStatusBadge) -- Visitas usa outro
          // conjunto de status (aberta/em_contato/em_andamento/remarcar),
          // que já tem o próprio badge por chamado.
          const statusCounts = showPecas ? countByDeliveryStatus(group.items) : null;
          return (
          // Recolhível -- pedido do Victor 20/08/2026: "os agrupamentos por
          // data (Entregas e Visitas) precisam poder ser recolhidos, e
          // mostrar a quantidade de dentro quando estiver recolhido".
          // <details> nativo, sem JS extra (mesmo padrão de NotificacoesList.tsx);
          // aberto por padrão, então o comportamento de sempre não muda até
          // alguém clicar pra recolher. A contagem fica sempre visível (não só
          // quando recolhido) -- mais útil pra decidir o que vale a pena abrir.
          <details key={group.key} className="group rounded-xl overflow-hidden" style={{ border: `2px solid ${group.borderColor}` }} open>
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
              {statusCounts ? (
                <span className="flex items-center gap-2 text-[11px] font-medium ml-auto" style={{ color: group.headerText }}>
                  <span>{statusCounts.programado} Programado{statusCounts.programado === 1 ? "" : "s"}</span>
                  <span>{statusCounts.concluido} Concluído{statusCounts.concluido === 1 ? "" : "s"}</span>
                  <span>{statusCounts.cancelado} Cancelado{statusCounts.cancelado === 1 ? "" : "s"}</span>
                </span>
              ) : null}
            </summary>
            <div style={{ background: "var(--surface-1)" }}>
              <AssistenciaQueueGroup
                items={group.items}
                reorderable
                now={now}
                showCreatedDate={showPecas}
                printable={showPecas}
                showStaleBadge={!showPecas}
              />
            </div>
          </details>
          );
        })
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={buildHref({ status: filterStatus, q, page: page - 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined, origem: filterOrigem, sched: schedParam })}
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
              href={buildHref({ status: filterStatus, q, page: page + 1, store, assembler: effectiveAssembler, from: dateFrom, to: dateTo, tab: showPecas ? "pecas" : undefined, origem: filterOrigem, sched: schedParam })}
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
