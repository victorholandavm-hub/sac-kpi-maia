import { bucketByScheduledDate, type DateBucketKey } from "./dateBuckets";
import { ROTAS, ROTA_LABELS, ROTA_COLORS, JP_EXTRA_ROTA, type Rota, type RotaCity } from "./rotas";
import { ASSISTENCIA_MANAGED_TYPES, DELIVERY_REQUEST_TYPES, SAC_MANAGED_TYPES } from "./assistenciaLabels";
import type { ServiceRequestSummary, RequestType } from "./serviceRequests";

// Filtros da aba Entregas -- pedido do Victor 21/08/2026: "na tela de
// notificação de assistência, não tem como eu filtrar por programado".
// Entrega não passa por negociação de agenda (ver isDeliveryScheduled em
// DeliveryStatusBadge.tsx), só existe "aberta" (que vira Programado/Não
// programado dependendo se já tem data+rota), concluída ou cancelada.
// "Programado"/"Não programado" não são status de verdade no banco -- são
// status=aberta filtrado depois em JS por scheduledDate+rota (ver `sched`
// nas duas telas que usam isso).
export type EntregaFilterValue = { status: string | null; sched?: boolean };
export const ENTREGA_FILTERS: { label: string; value: EntregaFilterValue; color: string }[] = [
  { label: "Todas", value: { status: null }, color: "var(--text-secondary)" },
  { label: "Programado", value: { status: "aberta", sched: true }, color: "var(--brand-green)" },
  { label: "Não programado", value: { status: "aberta", sched: false }, color: "var(--status-warning)" },
  { label: "Concluídas", value: { status: "concluida" }, color: "var(--status-good)" },
  { label: "Canceladas", value: { status: "cancelada" }, color: "var(--text-muted)" },
];

// Filtro "SAC x Assistência" -- pedido do Victor 20/08/2026: "preciso de um
// filtro na aba de entregas para conseguir filtrar as notificações do sac e
// da assistencia". Os 5 tipos de DELIVERY_REQUEST_TYPES se dividem nos dois
// grupos de sempre -- troca/entrega/recolhimento de PRODUTO nascem no SAC,
// envio/recolhimento de PEÇA nascem na assistência, mesmo os dois saindo
// juntos na mesma rota.
export const ENTREGA_TYPES: RequestType[] = [...DELIVERY_REQUEST_TYPES];
export const ENTREGA_TYPES_SAC: RequestType[] = ENTREGA_TYPES.filter((t) => (SAC_MANAGED_TYPES as readonly string[]).includes(t));
export const ENTREGA_TYPES_ASSISTENCIA: RequestType[] = ENTREGA_TYPES.filter((t) => (ASSISTENCIA_MANAGED_TYPES as readonly string[]).includes(t));

export const ORIGEM_FILTERS: { label: string; value: "sac" | "assistencia" | null }[] = [
  { label: "Todas", value: null },
  { label: "SAC", value: "sac" },
  { label: "Assistência", value: "assistencia" },
];

// Pedido do Victor 02/09/2026: "quando filtro a origem para assistencia,
// deve aparecer apenas o que foi solicitado por iasmyn e luis" -- filtrar
// só por ENTREGA_TYPES_ASSISTENCIA (tipo) não bastava, outros papéis também
// criam envio_peca/recolhimento/envio_recolhimento_peca às vezes. Usado
// junto de ENTREGA_TYPES_ASSISTENCIA como requestedByNames em
// listRequests/listRequestsScheduledOn (serviceRequests.ts) -- os únicos 2
// lugares que aplicam o filtro "Origem" (fila/page.tsx e
// sac/notificacoes/page.tsx).
export const ASSISTENCIA_ORIGEM_REQUESTERS = ["Iasmyn", "Luis"];

// Filtro por cidade -- pedido do Victor 24/08/2026: "filtro por cidade"
// (depois de perguntar se as telas de acompanhamento já tinham divisão
// por Campina Grande -- o agrupamento por rota já mostra separado
// sozinho, ver groupByRota, mas não existia um jeito de FILTRAR só por
// uma cidade). Só filtra quem já tem rota definida -- sem rota ainda
// (`r.rota === null`) não aparece em nenhuma das duas, só em "Todas"
// (mesmo raciocínio de ORIGEM_FILTERS/ENTREGA_FILTERS: filtro só afeta
// quem já tem o dado que ele filtra).
export const CITY_FILTERS: { label: string; value: RotaCity | null }[] = [
  { label: "Todas", value: null },
  { label: "João Pessoa", value: "joao_pessoa" },
  { label: "Campina Grande", value: "campina_grande" },
];

// Extraído de fila/page.tsx (24/08/2026) -- a tela de notificações do SAC
// (assistencia/sac/notificacoes/page.tsx) tinha sua PRÓPRIA cópia quase
// igual desse agrupamento (groupByDateAndRota em NotificacoesList.tsx), que
// foi divergindo aos poucos e virou uma tela visualmente diferente com
// contagem diferente da aba Entregas do admin -- achado do Victor
// 24/08/2026: "a tela de notificação de assistencia do sac deve ser igual
// a de admin... as notificações de hoje, ta contando 11 e na minha tela de
// admin mostra 16". Centralizado aqui pra nunca mais duas cópias
// divergirem de novo -- as duas telas passam a usar exatamente essa mesma
// função.

const NO_SCHEDULED_DATE_KEY = "sem_data";

// Hoje sempre em primeiro, não "a data mais antiga" -- bucketByScheduledDate
// (dateBuckets.ts) já resolve "hoje" de verdade, no fuso de João Pessoa.
// Ordem: hoje, amanhã, resto do futuro (crescente), atrasado, sem data --
// pedido explícito do Victor ("a rota do dia sempre tem que ser a primeira
// de cima").
const SCHEDULED_DATE_BUCKET_RANK: Record<DateBucketKey, number> = {
  hoje: 0,
  amanha: 1,
  depois: 2,
  atrasado: 3,
  sem_data: 4,
};

// Dia da semana ao lado da data -- pedido do Victor 21/08/2026: "Adicione o
// dia da semana ao lado da data nas barras sanfonadas (ex: ROTA CENTRO -
// 24/08/2026 (Segunda-feira)) para evitar erros na troca em bloco".
function weekdayLabel(dateStr: string): string {
  const raw = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Entregas/envios que já passaram da data agendada e continuam em
// aberto -- pedido do Victor 25/08/2026: "preciso que haja algo bem
// visivel para as notificações de assistencia que nao foram feitas no
// dia e estao em atraso... para que fique mais facil deles verem e
// remarcarem e nao ficar nada atrasado e para tras". Só quem ainda está
// "aberta" -- concluído/cancelado não precisa remarcar mais nada, mesmo
// com data agendada no passado. Usado tanto pro número do banner ("N
// atrasadas") quanto pra filtrar a lista quando o banner "Remarcar
// urgente" é clicado -- um cálculo só, compartilhado entre fila/page.tsx
// (aba Entregas) e sac/notificacoes/page.tsx.
export function filterOverdueOpen(requests: ServiceRequestSummary[]): ServiceRequestSummary[] {
  return requests.filter((r) => r.status === "aberta" && bucketByScheduledDate(r.scheduledDate) === "atrasado");
}

// Entregas/envios ainda sem rota atribuída -- pedido do Victor 25/08/2026
// (revisão da tela de notificações de assistência): "Sem Rota Definida...
// não devem ficar perdidos no meio do feed de datas". Mesmo critério de
// filterOverdueOpen (só "aberta" -- concluído/cancelado sem rota não
// precisa de atenção de ninguém). Usado tanto pro contador do pill quanto
// pra filtrar a lista quando ele é clicado.
export function filterSemRotaOpen(requests: ServiceRequestSummary[]): ServiceRequestSummary[] {
  return requests.filter((r) => r.status === "aberta" && r.rota === null);
}

// Tira os grupos "sem rota" do meio do feed ordenado por data e coloca
// primeiro -- mesmo pedido do Victor acima. groupByRota já calcula
// `isSemRota` por grupo (ver abaixo); aqui só reordena o array que ele
// devolve, sem recalcular nada. Aplicado nas duas telas que usam
// groupByRota (fila/page.tsx aba Entregas e sac/notificacoes/page.tsx).
export function pinSemRotaFirst(groups: QueueGroup[]): QueueGroup[] {
  const semRota = groups.filter((g) => g.isSemRota);
  const rest = groups.filter((g) => !g.isSemRota);
  return [...semRota, ...rest];
}

// Dentro de cada grupo, mesma prioridade de sempre: ordem manual
// (assistencia_order) primeiro, senão mais recente primeiro. Exportado --
// groupByDate (Visitas, fila/page.tsx) também usa, e ordena do mesmo jeito.
export function sortGroupItems(items: ServiceRequestSummary[]) {
  items.sort((a, b) => {
    if (a.assistenciaOrder !== null && b.assistenciaOrder !== null) return a.assistenciaOrder - b.assistenciaOrder;
    if (a.assistenciaOrder !== null) return -1;
    if (b.assistenciaOrder !== null) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

type QueueDateSubgroup = { dateKey: string; label: string; items: ServiceRequestSummary[] };

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

export type QueueGroup = {
  key: string;
  label: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  items: ServiceRequestSummary[];
  // Pra tag Hoje/Futura/Atrasada/Sem rota no cabeçalho -- ver DATE_BUCKET_TAG.
  dateBucket?: DateBucketKey;
  isSemRota?: boolean;
  // Rota "crua" (sem a data junto) -- pedido do Victor 25/08/2026: o
  // Kanban de "Hoje" (EntregasKanbanHoje.tsx) precisa de coluna por rota
  // com cabeçalho só "Rota Praia" (sem "· 25 de agosto..." repetido em
  // toda coluna do mesmo dia) e precisa da chave crua pra buscar o nome
  // do motorista (driverNameForRota, rotas.ts). Só existe em groupByRota
  // -- groupByDate (Visitas) não agrupa por rota, não preenche.
  rotaKey?: Rota | "sem_rota";
  rotaLabel?: string;
  // Data "crua" (YYYY-MM-DD) por trás do dateBucket -- null quando o grupo
  // é o pseudo-dia "sem data definida" (nenhum item com scheduledDate nem
  // approvedDeadline, ver groupByScheduledDate). Pedido do Victor
  // 26/08/2026: agrupar a aba Entregas/notificações por semana como já é
  // em Visitas (groupIntoWeeks, weekGrouping.ts) -- esse agrupador precisa
  // de uma data de verdade por grupo, não do `key` composto
  // (`${data}_${rota}`) que já existe aqui. Só existe em groupByRota --
  // groupByDate (Visitas) não precisa, já usa a data crua como o próprio
  // `key`.
  dateKey?: string | null;
};

export const DATE_BUCKET_TAG: Record<DateBucketKey, { label: string; bg: string } | null> = {
  hoje: { label: "HOJE", bg: "var(--status-good)" },
  amanha: { label: "FUTURA", bg: "color-mix(in srgb, #fff 35%, transparent)" },
  depois: { label: "FUTURA", bg: "color-mix(in srgb, #fff 35%, transparent)" },
  atrasado: { label: "ATRASADA", bg: "var(--status-critical)" },
  sem_data: null,
};

// Agrupado por rota, com a data DA ROTA (agendada) ao lado no mesmo
// cabeçalho -- não a data de criação do chamado, que já aparece em cada
// notificação. A DATA manda na ordem, não a rota -- primeiro agrupa tudo
// por data (hoje, amanhã, depois, atrasado, sem_data) e só dentro de cada
// data é que separa por rota.
export function groupByRota(requests: ServiceRequestSummary[]): QueueGroup[] {
  const rotaOrder: (Omit<QueueGroup, "items" | "label" | "key" | "rotaKey" | "rotaLabel"> & { key: Rota | "sem_rota"; rotaLabel: string })[] = [
    ...ROTAS.map((r) => ({
      key: r,
      // "Rota extra" já é o nome inteiro (ver JP_EXTRA_ROTA em rotas.ts)
      // -- sem isso o grupo virava "Rota Rota extra", duplicado.
      rotaLabel: r === JP_EXTRA_ROTA ? ROTA_LABELS[r] : `Rota ${ROTA_LABELS[r]}`,
      headerBg: ROTA_COLORS[r],
      headerText: "#fff",
      borderColor: ROTA_COLORS[r],
    })),
    // Cor de atenção (mesma família do "Não programado" acima), não mais
    // cinza neutro -- pedido do Victor 25/08/2026: sem rota é pendência
    // que precisa ser tratada, não deve se camuflar no meio dos grupos
    // normais (reforçado por pinSemRotaFirst, que também bota esses
    // grupos primeiro na lista).
    { key: "sem_rota", rotaLabel: "⚠ Sem rota definida", headerBg: "var(--status-warning)", headerText: "#fff", borderColor: "var(--status-warning)" },
  ];

  const groups: QueueGroup[] = [];
  for (const dateGroup of groupByScheduledDate(requests)) {
    for (const rotaInfo of rotaOrder) {
      const items = dateGroup.items.filter((r) => (r.rota ?? "sem_rota") === rotaInfo.key);
      if (items.length === 0) continue;
      const rawDateKey = dateGroup.dateKey === NO_SCHEDULED_DATE_KEY ? null : dateGroup.dateKey;
      groups.push({
        key: `${dateGroup.dateKey}_${rotaInfo.key}`,
        label: `${rotaInfo.rotaLabel} · ${dateGroup.label}`,
        headerBg: rotaInfo.headerBg,
        headerText: rotaInfo.headerText,
        borderColor: rotaInfo.borderColor,
        items,
        dateBucket: bucketByScheduledDate(rawDateKey),
        isSemRota: rotaInfo.key === "sem_rota",
        rotaKey: rotaInfo.key,
        rotaLabel: rotaInfo.rotaLabel,
        dateKey: rawDateKey,
      });
    }
  }
  return groups;
}
