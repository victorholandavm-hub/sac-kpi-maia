import { getSupabaseAdmin } from "./supabaseAdmin";
import type { DateRange } from "./dateRange";

export type TicketRow = {
  conversation_id: string;
  ghl_conversation_id: string;
  contact_id: string;
  opened_at: string;
  resolved_at: string | null;
  resolution_hours: number | null;
  store_tag: string | null;
  category: string | null;
  product: string | null;
  resolved_by_tag: boolean;
  resolved_by_ai: boolean;
  resolved_effective: boolean;
  urgency: string;
  summary_ai: string | null;
  agent_name: string | null;
  is_sac_agent: boolean;
  channel: string | null;
  first_response_minutes: number | null;
  within_sla: boolean;
  is_recurrence: boolean;
  blocking_tag: string | null;
  blocking_since: string | null;
  // Não vem de v_ticket_enriched (view mantida direto no Supabase, fora das
  // migrations do repo) -- juntado em memória a partir de `conversations`
  // pra não precisar mexer na view. Ver getKpiData.
  nps_score: number | null;
};

// `tag` (opcional) carrega o valor cru por trás de `label` quando o label é
// só um texto de exibição traduzido (ex.: byCategory) -- usado pra buscar o
// drill-down de chamados sem precisar re-derivar o tag original a partir do
// texto já traduzido.
export type Count = { label: string; count: number; tag?: string };
export type Coverage = { withValue: number; total: number; pct: number };
export type DayCount = { date: string; count: number };

export type AttentionRow = {
  conversation_id: string;
  ghl_conversation_id: string;
  store_tag: string | null;
  category: string | null;
  product: string | null;
  urgency: string;
  summary_ai: string | null;
  opened_at: string;
  aberto_ha_horas: number;
};

export type WaitingRow = {
  conversation_id: string;
  ghl_conversation_id: string;
  store_tag: string | null;
  blocking_tag: string;
  aguardando_ha_horas: number;
};

export type PreviousWeekSummary = {
  from: string;
  to: string;
  totalTickets: number;
  topStore: Count | null;
  topCategory: Count | null;
  // Drill-down do topCategory acima -- mesma ideia de StoreBreakdown.topCategoryTickets.
  topCategoryTickets: StoreBreakdownTicket[];
};

export type EscalationRow = {
  id: number;
  conversation_id: string;
  ghl_conversation_id: string;
  ticket_opened_at: string;
  store_tag: string | null;
  target: string;
  asked_at: string;
  answered_at: string | null;
  wait_minutes: number | null;
  ask_excerpt: string | null;
  answer_excerpt: string | null;
  waiting_hours_so_far: number | null;
};

export type EscalationTargetStat = { target: string; count: number; avgWaitMinutes: number | null };

export type EscalationSummary = {
  completedCount: number;
  pendingCount: number;
  avgWaitMinutes: number | null;
  byTarget: EscalationTargetStat[];
};

export type EscalationStoreStat = {
  store: string;
  count: number;
  avgWaitMinutes: number | null;
  pendingCount: number;
};

export type PerformanceMetric = {
  key: string;
  label: string;
  unit: "h" | "min" | "%" | "count";
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
  direction: "up" | "down" | "flat" | null;
  improved: boolean | null;
};

export type PerformanceReport = {
  windowDays: number;
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  currentSampleSize: number;
  previousSampleSize: number;
  metrics: PerformanceMetric[];
};

export type PerformanceReportSet = {
  week: PerformanceReport;
  month: PerformanceReport;
};

// Enquete de satisfação (1 a 5) disparada pelo GHL quando o atendente marca
// resolvido -- ver detectNpsScore em src/app/api/sync/route.ts. Não é NPS
// no sentido estrito (promotor/detrator em escala 0-10), mas é como o
// usuário se refere a ela, então mantive o nome.
export type NpsDistributionEntry = { score: 1 | 2 | 3 | 4 | 5; count: number };

export type NpsSummary = {
  avgScore: number | null;
  responseCount: number;
  eligibleCount: number;
  responseRatePct: number | null;
  distribution: NpsDistributionEntry[];
  promoterCount: number;
  neutralCount: number;
  detractorCount: number;
  promoterPct: number | null;
  neutralPct: number | null;
  detractorPct: number | null;
  // Fórmula clássica de NPS (%promotores - %detratores), -100 a 100 --
  // adaptada pra escala 1-5 da enquete (sem o "6" do meio que a escala 0-10
  // original teria como corte).
  npsIndex: number | null;
};

// Detrator (nota 1-2) com nome/contato do cliente -- pra assistência/SAC
// conseguirem ligar de volta e entender o que aconteceu. Nome/telefone vêm
// de `contacts` (GHL), então podem ser null se o contato nunca foi
// sincronizado com nome/telefone preenchido.
export type NpsDetractor = {
  conversationId: string;
  score: 1 | 2;
  answeredAt: string;
  clientName: string | null;
  clientPhone: string | null;
};

export type AgentStat = {
  agent: string;
  total: number;
  resolvedCount: number;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
  avgFirstResponseMinutes: number | null;
  pctWithinSla: number | null;
  avgNpsScore: number | null;
  npsResponseCount: number;
};

// Chamado por trás do "problema mais comum" de uma loja -- drill-down pra ver
// do que se trata de verdade (categoria tipo "Dúvida" é só um rótulo vago; o
// resumo de IA por conversa mostra o assunto real). Nome/telefone vêm de
// `contacts` (GHL), então podem ser null se o contato nunca foi sincronizado.
export type StoreBreakdownTicket = {
  conversationId: string;
  contactId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  openedAt: string;
  summaryAi: string | null;
};

export type StoreBreakdown = {
  store: string;
  total: number;
  topCategory: string | null;
  topCategoryCount: number;
  topCategoryPct: number;
  // Os mais recentes do total acima (ver MAX_TOP_CATEGORY_TICKETS) -- lista
  // completa não é necessária, é só pra dar contexto do que está por trás do
  // número.
  topCategoryTickets: StoreBreakdownTicket[];
};

export type KpiData = {
  totalTickets: number;
  resolvedCount: number;
  openCount: number;
  resolvedByTagCount: number;
  highUrgencyOpenCount: number;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
  byCategory: Count[];
  byStore: Count[];
  byProduct: Count[];
  byAgent: Count[];
  byChannel: Count[];
  dailyVolume: DayCount[];
  backlogOverTime: DayCount[];
  attention: AttentionRow[];
  // Todos os chamados em aberto (sem o corte de 15 do `attention`) -- pra
  // filtrar por categoria (ex.: "Dúvida") e ler o resumo de cada um, ver
  // OpenTicketsBrowser.tsx.
  openTicketsList: AttentionRow[];
  avgFirstResponseMinutes: number | null;
  pctWithinSla: number | null;
  firstResponseSampleSize: number;
  slaMinutesThreshold: number;
  recurrenceCount: number;
  recurrencePct: number | null;
  paretoSummary: string | null;
  storeBreakdown: StoreBreakdown[];
  // Drill-down de byCategory acima -- por tag crua de categoria (ex.:
  // "cat-duvida"), os chamados mais recentes daquela categoria no período
  // selecionado. Ver CategoryTicketsModal / BarRanking.
  categoryTickets: Record<string, StoreBreakdownTicket[]>;
  waitingCount: number;
  waitingByType: Count[];
  waitingByStore: Count[];
  waitingList: WaitingRow[];
  categoryCoverage: Coverage;
  storeCoverage: Coverage;
  productCoverage: Coverage;
  previousWeek: PreviousWeekSummary;
  escalations: EscalationSummary;
  escalationList: EscalationRow[];
  escalationByStore: EscalationStoreStat[];
  byAgentStats: AgentStat[];
  performanceReport: PerformanceReportSet;
  npsSummary: NpsSummary;
  npsDetractors: NpsDetractor[];
};

// Victor não é atendente do SAC (é quem administra o sistema) -- alguma
// conversa de teste/uso interno dele acabou marcada com a tag de agente no
// GHL, e isso poluía os rankings "por agente" com um nome que não devia
// estar ali.
function isRealAgent(agentName: string | null): agentName is string {
  return !!agentName && !agentName.toLowerCase().includes("victor");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function topCounts(
  rows: TicketRow[],
  key: "store_tag" | "category" | "product" | "channel" | "blocking_tag",
  limit = 10
): Count[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function computeCoverage(rows: TicketRow[], key: "store_tag" | "category" | "product"): Coverage {
  const withValue = rows.filter((r) => r[key] !== null).length;
  return {
    withValue,
    total: rows.length,
    pct: rows.length > 0 ? Math.round((withValue / rows.length) * 100) : 0,
  };
}

function byAgentCounts(rows: TicketRow[]): Count[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.is_sac_agent || !isRealAgent(row.agent_name)) continue;
    counts.set(row.agent_name, (counts.get(row.agent_name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function windowStats(rows: TicketRow[]) {
  const total = rows.length;
  const resolvedCount = rows.filter((r) => r.resolved_effective).length;
  const resolutionRatePct = total > 0 ? Math.round((resolvedCount / total) * 100) : null;

  const resolutionHours = rows
    .filter((r) => r.resolved_by_tag)
    .map((r) => r.resolution_hours)
    .filter((h): h is number => h !== null);
  const avgResolutionHours =
    resolutionHours.length > 0
      ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
      : null;

  const firstResponseRows = rows.filter((r) => r.first_response_minutes !== null);
  const avgFirstResponseMinutes =
    firstResponseRows.length > 0
      ? Math.round(
          (firstResponseRows.reduce((sum, r) => sum + (r.first_response_minutes ?? 0), 0) /
            firstResponseRows.length) *
            10
        ) / 10
      : null;
  const pctWithinSla =
    firstResponseRows.length > 0
      ? Math.round((firstResponseRows.filter((r) => r.within_sla).length / firstResponseRows.length) * 100)
      : null;

  const recurrencePct =
    total > 0 ? Math.round((rows.filter((r) => r.is_recurrence).length / total) * 100) : null;

  return { total, resolutionRatePct, avgResolutionHours, avgFirstResponseMinutes, pctWithinSla, recurrencePct };
}

function buildMetric(
  key: string,
  label: string,
  unit: PerformanceMetric["unit"],
  current: number | null,
  previous: number | null,
  higherIsBetter: boolean | null
): PerformanceMetric {
  const deltaPct =
    current !== null && previous !== null && previous !== 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : null;

  let direction: PerformanceMetric["direction"] = null;
  let improved: boolean | null = null;
  if (current !== null && previous !== null) {
    direction = current === previous ? "flat" : current > previous ? "up" : "down";
    if (higherIsBetter !== null && direction !== "flat") {
      improved = higherIsBetter ? current > previous : current < previous;
    }
  }

  return { key, label, unit, current, previous, deltaPct, direction, improved };
}

function buildPerformanceReport(allRows: TicketRow[], now: Date, windowDays: number): PerformanceReport {
  const dayMs = 24 * 60 * 60 * 1000;
  const currentTo = now;
  const currentFrom = new Date(now.getTime() - windowDays * dayMs);
  const previousTo = currentFrom;
  const previousFrom = new Date(currentFrom.getTime() - windowDays * dayMs);

  const inWindow = (row: TicketRow, from: Date, to: Date) => {
    const opened = new Date(row.opened_at).getTime();
    return opened >= from.getTime() && opened < to.getTime();
  };

  const cur = windowStats(allRows.filter((r) => inWindow(r, currentFrom, currentTo)));
  const prev = windowStats(allRows.filter((r) => inWindow(r, previousFrom, previousTo)));

  return {
    windowDays,
    currentFrom: currentFrom.toISOString().slice(0, 10),
    currentTo: currentTo.toISOString().slice(0, 10),
    previousFrom: previousFrom.toISOString().slice(0, 10),
    previousTo: previousTo.toISOString().slice(0, 10),
    currentSampleSize: cur.total,
    previousSampleSize: prev.total,
    metrics: [
      buildMetric("volume", "Chamados abertos", "count", cur.total, prev.total, null),
      buildMetric("resolutionRate", "Taxa de resolução", "%", cur.resolutionRatePct, prev.resolutionRatePct, true),
      buildMetric("avgResolutionHours", "Tempo médio de resolução", "h", cur.avgResolutionHours, prev.avgResolutionHours, false),
      buildMetric("avgFirstResponse", "1ª resposta (média)", "min", cur.avgFirstResponseMinutes, prev.avgFirstResponseMinutes, false),
      buildMetric("pctWithinSla", "Dentro do SLA", "%", cur.pctWithinSla, prev.pctWithinSla, true),
      buildMetric("recurrencePct", "Taxa de reincidência", "%", cur.recurrencePct, prev.recurrencePct, false),
    ],
  };
}

function buildPerformanceReportSet(allRows: TicketRow[], now: Date): PerformanceReportSet {
  return {
    week: buildPerformanceReport(allRows, now, 7),
    month: buildPerformanceReport(allRows, now, 30),
  };
}

function buildAgentStats(rows: TicketRow[]): AgentStat[] {
  const byAgent = new Map<string, TicketRow[]>();
  for (const row of rows) {
    if (!row.is_sac_agent || !isRealAgent(row.agent_name)) continue;
    const list = byAgent.get(row.agent_name) ?? [];
    list.push(row);
    byAgent.set(row.agent_name, list);
  }

  return [...byAgent.entries()]
    .map(([agent, agentRows]) => {
      const resolutionHours = agentRows
        .filter((r) => r.resolved_by_tag)
        .map((r) => r.resolution_hours)
        .filter((h): h is number => h !== null);
      const firstResponseRows = agentRows.filter((r) => r.first_response_minutes !== null);
      // Nota de avaliação por atendente -- toda avaliação de chamado com a
      // tag desse agente conta, mesmo sem tag de resolução (mesmo critério
      // "mostra tudo que respondeu" do resumo geral, ver buildNpsSummary).
      const npsScores = agentRows.filter((r) => r.nps_score !== null).map((r) => r.nps_score as number);

      return {
        agent,
        total: agentRows.length,
        resolvedCount: agentRows.filter((r) => r.resolved_effective).length,
        avgResolutionHours:
          resolutionHours.length > 0
            ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
            : null,
        medianResolutionHours: median(resolutionHours),
        avgFirstResponseMinutes:
          firstResponseRows.length > 0
            ? Math.round(
                (firstResponseRows.reduce((sum, r) => sum + (r.first_response_minutes ?? 0), 0) /
                  firstResponseRows.length) *
                  10
              ) / 10
            : null,
        pctWithinSla:
          firstResponseRows.length > 0
            ? Math.round((firstResponseRows.filter((r) => r.within_sla).length / firstResponseRows.length) * 100)
            : null,
        avgNpsScore: npsScores.length > 0 ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10 : null,
        npsResponseCount: npsScores.length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

function toAttentionRow(row: TicketRow, now: number): AttentionRow {
  return {
    conversation_id: row.conversation_id,
    ghl_conversation_id: row.ghl_conversation_id,
    store_tag: row.store_tag,
    category: row.category,
    product: row.product,
    urgency: row.urgency,
    summary_ai: row.summary_ai,
    opened_at: row.opened_at,
    aberto_ha_horas: Math.round(((now - new Date(row.opened_at).getTime()) / 3_600_000) * 10) / 10,
  };
}

function buildOpenTicketsList(openRows: TicketRow[], now: number): AttentionRow[] {
  const urgencyRank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return [...openRows]
    .sort((a, b) => {
      const rankDiff = (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
    })
    .map((r) => toAttentionRow(r, now));
}

// Semana calculada no fuso de Joao Pessoa (America/Fortaleza, UTC-3, sem horario de verao),
// usando metodos UTC pra ficar independente do fuso do servidor onde o codigo roda.
const BUSINESS_TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

function getPreviousWeekRange(nowUtc: Date): { from: Date; to: Date; fromLabel: string; toLabel: string } {
  const local = new Date(nowUtc.getTime() + BUSINESS_TZ_OFFSET_MS);
  const day = local.getUTCDay(); // 0=domingo, 1=segunda, ...
  const diffToMonday = (day + 6) % 7;

  const thisMondayLocal = new Date(local);
  thisMondayLocal.setUTCHours(0, 0, 0, 0);
  thisMondayLocal.setUTCDate(thisMondayLocal.getUTCDate() - diffToMonday);

  const prevMondayLocal = new Date(thisMondayLocal);
  prevMondayLocal.setUTCDate(prevMondayLocal.getUTCDate() - 7);
  const prevSundayLocal = new Date(thisMondayLocal.getTime() - 1);

  return {
    from: new Date(prevMondayLocal.getTime() - BUSINESS_TZ_OFFSET_MS),
    to: new Date(prevSundayLocal.getTime() - BUSINESS_TZ_OFFSET_MS),
    fromLabel: prevMondayLocal.toISOString().slice(0, 10),
    toLabel: prevSundayLocal.toISOString().slice(0, 10),
  };
}

// Toda avaliação que existir entra na conta -- mesmo de chamado sem tag de
// resolução aplicada, ou de conversa que nem apareceu em v_ticket_enriched
// (sem categoria/loja marcada). Antes filtrava por resolved_effective e
// escondia quem respondeu de verdade só porque o chamado não tava com a tag
// certa -- ver relato real onde isso sumiu com 2 de 8 avaliações. "Elegível"
// (chamados resolvidos no período) continua só como referência pra taxa de
// resposta, sem funcionar mais como filtro do que aparece.
function buildNpsSummary(rows: TicketRow[], untrackedScores: number[]): NpsSummary {
  const eligibleCount = rows.filter((r) => r.resolved_effective).length;
  const scores = [...rows.filter((r) => r.nps_score !== null).map((r) => r.nps_score as number), ...untrackedScores];

  const distribution: NpsDistributionEntry[] = ([1, 2, 3, 4, 5] as const).map((score) => ({
    score,
    count: scores.filter((s) => s === score).length,
  }));

  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  // Classificação clássica de NPS adaptada pra escala 1-5 da enquete: 4-5
  // promotor, 3 neutro, 1-2 detrator -- direto satisfação/insatisfação, sem
  // o "6" do meio que a escala 0-10 original teria como corte.
  const promoterCount = scores.filter((s) => s >= 4).length;
  const neutralCount = scores.filter((s) => s === 3).length;
  const detractorCount = scores.filter((s) => s <= 2).length;
  const pct = (count: number) => (scores.length > 0 ? Math.round((count / scores.length) * 1000) / 10 : null);
  const promoterPct = pct(promoterCount);
  const neutralPct = pct(neutralCount);
  const detractorPct = pct(detractorCount);

  return {
    avgScore,
    responseCount: scores.length,
    eligibleCount,
    responseRatePct: eligibleCount > 0 ? Math.round((scores.length / eligibleCount) * 100) : null,
    distribution,
    promoterCount,
    neutralCount,
    detractorCount,
    promoterPct,
    neutralPct,
    detractorPct,
    npsIndex: promoterPct !== null && detractorPct !== null ? Math.round(promoterPct - detractorPct) : null,
  };
}

// Só dá pra atribuir a nota a um atendente quando o chamado tem a tag de
// atendente aplicada (mesmo critério de byAgentCounts/buildAgentStats) --
// avaliação de conversa sem essa tag entra no resumo geral, mas não dá pra
// saber de quem foi.
function buildPreviousWeekSummary(allRows: TicketRow[], now: Date): PreviousWeekSummary {
  const { from, to, fromLabel, toLabel } = getPreviousWeekRange(now);
  const weekRows = allRows.filter((r) => {
    const opened = new Date(r.opened_at).getTime();
    return opened >= from.getTime() && opened <= to.getTime();
  });
  const topCategory = topCounts(weekRows, "category")[0] ?? null;
  return {
    from: fromLabel,
    to: toLabel,
    totalTickets: weekRows.length,
    topStore: topCounts(weekRows, "store_tag")[0] ?? null,
    topCategory,
    topCategoryTickets: topCategory ? buildTicketList(weekRows.filter((r) => r.category === topCategory.label)) : [],
  };
}

function buildEscalationSummary(rows: EscalationRow[]): EscalationSummary {
  const completed = rows.filter((r) => r.wait_minutes !== null);
  const pending = rows.filter((r) => r.wait_minutes === null);

  const byTargetMap = new Map<string, number[]>();
  for (const r of completed) {
    const list = byTargetMap.get(r.target) ?? [];
    list.push(r.wait_minutes as number);
    byTargetMap.set(r.target, list);
  }
  const byTarget: EscalationTargetStat[] = [...byTargetMap.entries()]
    .map(([target, waits]) => ({
      target,
      count: waits.length,
      avgWaitMinutes: Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  const avgWaitMinutes =
    completed.length > 0
      ? Math.round((completed.reduce((a, b) => a + (b.wait_minutes as number), 0) / completed.length) * 10) / 10
      : null;

  return {
    completedCount: completed.length,
    pendingCount: pending.length,
    avgWaitMinutes,
    byTarget,
  };
}

function buildEscalationByStore(
  rows: EscalationRow[],
  storeLabelFn: (tag: string) => string
): EscalationStoreStat[] {
  const storeRows = rows.filter((r) => r.store_tag && (r.target === "loja" || r.target === "gerente"));
  const byStoreMap = new Map<string, EscalationRow[]>();
  for (const r of storeRows) {
    const key = r.store_tag as string;
    const list = byStoreMap.get(key) ?? [];
    list.push(r);
    byStoreMap.set(key, list);
  }

  return [...byStoreMap.entries()]
    .map(([store, storeEscRows]) => {
      const completed = storeEscRows.filter((r) => r.wait_minutes !== null);
      const avgWaitMinutes =
        completed.length > 0
          ? Math.round(
              (completed.reduce((a, b) => a + (b.wait_minutes as number), 0) / completed.length) * 10
            ) / 10
          : null;
      return {
        store: storeLabelFn(store),
        count: storeEscRows.length,
        avgWaitMinutes,
        pendingCount: storeEscRows.length - completed.length,
      };
    })
    .sort((a, b) => {
      if (a.avgWaitMinutes === null && b.avgWaitMinutes === null) return b.count - a.count;
      if (a.avgWaitMinutes === null) return 1;
      if (b.avgWaitMinutes === null) return -1;
      return b.avgWaitMinutes - a.avgWaitMinutes;
    });
}

function buildWaitingList(openRows: TicketRow[], now: number): WaitingRow[] {
  return openRows
    .filter((r): r is TicketRow & { blocking_tag: string; blocking_since: string } =>
      r.blocking_tag !== null && r.blocking_since !== null
    )
    .map((r) => ({
      conversation_id: r.conversation_id,
      ghl_conversation_id: r.ghl_conversation_id,
      store_tag: r.store_tag,
      blocking_tag: r.blocking_tag,
      aguardando_ha_horas: Math.round(((now - new Date(r.blocking_since).getTime()) / 3_600_000) * 10) / 10,
    }))
    .sort((a, b) => b.aguardando_ha_horas - a.aguardando_ha_horas);
}

function buildParetoSummary(byCategory: Count[], total: number, categoryLabelFn: (tag: string) => string): string | null {
  if (byCategory.length === 0 || total === 0) return null;
  let cumulative = 0;
  const picked: string[] = [];
  for (const c of byCategory) {
    cumulative += c.count;
    picked.push(categoryLabelFn(c.label));
    if (cumulative / total >= 0.8) break;
  }
  const pct = Math.round((cumulative / total) * 100);
  const n = picked.length;
  const list = picked.length <= 3 ? picked.join(", ") : `${picked.slice(0, 3).join(", ")} e outros`;
  return `Os ${n} principais motivos (${list}) somam ${pct}% dos chamados.`;
}

function buildBacklogOverTime(rows: TicketRow[], from: Date | null, to: Date): DayCount[] {
  const earliestOpen = rows.reduce(
    (min, r) => Math.min(min, new Date(r.opened_at).getTime()),
    Infinity
  );
  const start = from ? from.getTime() : earliestOpen;
  if (!Number.isFinite(start)) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(start / dayMs) * dayMs;
  const endDay = Math.floor(to.getTime() / dayMs) * dayMs;
  const maxDays = 366;

  const result: DayCount[] = [];
  for (let day = startDay, i = 0; day <= endDay && i < maxDays; day += dayMs, i++) {
    const endOfDay = day + dayMs - 1;
    const openCount = rows.filter((r) => {
      const opened = new Date(r.opened_at).getTime();
      const resolved = r.resolved_at ? new Date(r.resolved_at).getTime() : null;
      return opened <= endOfDay && (resolved === null || resolved > endOfDay);
    }).length;
    result.push({ date: new Date(day).toISOString().slice(0, 10), count: openCount });
  }
  return result;
}

const MAX_TOP_CATEGORY_TICKETS = 30;

// Nome/telefone do contato entram depois, numa query em lote (ver
// getKpiData) -- aqui só junta os chamados crus, mais recentes primeiro.
function buildTicketList(rows: TicketRow[], limit = MAX_TOP_CATEGORY_TICKETS): StoreBreakdownTicket[] {
  return [...rows]
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
    .slice(0, limit)
    .map((r) => ({
      conversationId: r.conversation_id,
      contactId: r.contact_id,
      clientName: null,
      clientPhone: null,
      openedAt: r.opened_at,
      summaryAi: r.summary_ai,
    }));
}

// Drill-down de byCategory (ver KpiData.categoryTickets) -- chave é a tag
// crua da categoria (ex.: "cat-duvida"), não o label traduzido.
function buildCategoryTicketsMap(rows: TicketRow[]): Record<string, StoreBreakdownTicket[]> {
  const byCategoryRows = new Map<string, TicketRow[]>();
  for (const row of rows) {
    if (!row.category) continue;
    const list = byCategoryRows.get(row.category) ?? [];
    list.push(row);
    byCategoryRows.set(row.category, list);
  }
  return Object.fromEntries([...byCategoryRows.entries()].map(([category, catRows]) => [category, buildTicketList(catRows)]));
}

function buildStoreBreakdown(rows: TicketRow[], storeLabelFn: (tag: string) => string, categoryLabelFn: (tag: string) => string): StoreBreakdown[] {
  const byStoreRows = new Map<string, TicketRow[]>();
  for (const row of rows) {
    if (!row.store_tag) continue;
    const list = byStoreRows.get(row.store_tag) ?? [];
    list.push(row);
    byStoreRows.set(row.store_tag, list);
  }

  return [...byStoreRows.entries()]
    .map(([store, storeRows]) => {
      const catCounts = new Map<string, number>();
      for (const r of storeRows) {
        if (!r.category) continue;
        catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);
      }
      const top = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const topCategoryTickets: StoreBreakdownTicket[] = top
        ? buildTicketList(storeRows.filter((r) => r.category === top[0]))
        : [];
      return {
        store: storeLabelFn(store),
        total: storeRows.length,
        topCategory: top ? categoryLabelFn(top[0]) : null,
        topCategoryCount: top ? top[1] : 0,
        topCategoryPct: top ? Math.round((top[1] / storeRows.length) * 100) : 0,
        topCategoryTickets,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function getKpiData(
  range: DateRange,
  labelFns: {
    categoryLabel: (tag: string) => string;
    storeLabel: (tag: string) => string;
  }
): Promise<KpiData> {
  const supabase = getSupabaseAdmin();

  // PostgREST limita cada resposta (max_rows do projeto, normalmente 1000),
  // entao paginamos com .range() ate esgotar os dados.
  const allRows: TicketRow[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page++) {
    const { data: pageRows, error: ticketError } = await supabase
      .from("v_ticket_enriched")
      .select("*")
      .order("opened_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (ticketError) throw ticketError;
    allRows.push(...((pageRows ?? []) as TicketRow[]).map((r) => ({ ...r, nps_score: null as number | null })));
    if (!pageRows || pageRows.length < pageSize) break;
  }

  // nps_score não vem de v_ticket_enriched (view mantida direto no Supabase,
  // fora das migrations do repo) -- busca à parte em conversations e junta
  // em memória por conversation_id, pra não precisar reescrever uma view
  // que não dá pra inspecionar com segurança daqui. Toda avaliação entra na
  // conta, mesmo quando a conversa não aparece em v_ticket_enriched (sem
  // categoria/loja marcada) -- essas ficam de fora do join principal, mas
  // ainda contam pro resumo geral via `untrackedNpsScores` abaixo.
  const rowsByConversationId = new Map(allRows.map((r) => [r.conversation_id, r]));
  const untrackedNpsScores: number[] = [];
  // Candidatos a detrator (nota 1-2) juntados aqui na mesma varredura --
  // tracked (tem linha em v_ticket_enriched) e untracked, pra depois buscar
  // nome/telefone em `contacts` numa query só (ver npsDetractors abaixo).
  const detractorCandidates: { conversationId: string; score: 1 | 2; answeredAt: string; contactId: string | null }[] = [];
  for (let page = 0; ; page++) {
    const { data: pageRows, error: npsError } = await supabase
      .from("conversations")
      .select("id, nps_score, nps_answered_at, contact_id")
      .not("nps_score", "is", null)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (npsError) throw npsError;
    for (const row of pageRows ?? []) {
      const conversationId = row.id as string;
      const score = row.nps_score as number;
      const answeredAt = row.nps_answered_at as string | null;
      const match = rowsByConversationId.get(conversationId);
      if (match) {
        match.nps_score = score;
      } else {
        const answeredAtDate = answeredAt ? new Date(answeredAt) : null;
        if (range.from && answeredAtDate && answeredAtDate < range.from) continue;
        if (answeredAtDate && answeredAtDate > range.to) continue;
        untrackedNpsScores.push(score);
      }
      if (score <= 2 && answeredAt) {
        detractorCandidates.push({
          conversationId,
          score: score as 1 | 2,
          answeredAt,
          contactId: (row.contact_id as string | null) ?? match?.contact_id ?? null,
        });
      }
    }
    if (!pageRows || pageRows.length < pageSize) break;
  }

  // Só entra na lista se a resposta caiu dentro do período selecionado --
  // consistente com o critério já usado pros untracked acima (nps_answered_at,
  // não opened_at do chamado, já que o cliente pode responder dias depois).
  const detractorsInRange = detractorCandidates.filter((d) => {
    const t = new Date(d.answeredAt);
    if (range.from && t < range.from) return false;
    if (t > range.to) return false;
    return true;
  });
  const detractorContactIds = [...new Set(detractorsInRange.map((d) => d.contactId).filter((id): id is string => !!id))];
  let contactsById = new Map<string, { name: string | null; phone: string | null }>();
  if (detractorContactIds.length > 0) {
    const { data: contactRows, error: contactsError } = await supabase
      .from("contacts")
      .select("id, name, phone")
      .in("id", detractorContactIds);
    if (contactsError) throw contactsError;
    contactsById = new Map((contactRows ?? []).map((c) => [c.id as string, { name: c.name as string | null, phone: c.phone as string | null }]));
  }
  const npsDetractors: NpsDetractor[] = detractorsInRange
    .map((d) => ({
      conversationId: d.conversationId,
      score: d.score,
      answeredAt: d.answeredAt,
      clientName: contactsById.get(d.contactId ?? "")?.name ?? null,
      clientPhone: contactsById.get(d.contactId ?? "")?.phone ?? null,
    }))
    .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());

  // Mesma lógica do nps_score acima (coluna própria em `conversations`, fora
  // de v_ticket_enriched) -- só que aqui é pra SUBSTITUIR categoria/produto/
  // loja do chamado quando a tag manual do GHL for genérica ou estiver
  // faltando (ver src/lib/aiClassification.ts e a rota /api/sync-ai-classify
  // que preenche essas colunas). Confiança "baixa" não é aplicada -- prefere
  // deixar "Dúvida"/sem produto a arriscar um chute ruim virando estatística.
  for (let page = 0; ; page++) {
    const { data: pageRows, error: aiError } = await supabase
      .from("conversations")
      .select("id, ai_category, ai_product, ai_store_tag, ai_confidence")
      .not("ai_analyzed_at", "is", null)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (aiError) throw aiError;
    for (const row of pageRows ?? []) {
      const match = rowsByConversationId.get(row.id as string);
      if (!match) continue;
      if (row.ai_confidence === "baixa") continue;
      if ((!match.category || match.category === "cat-duvida") && row.ai_category) {
        match.category = row.ai_category as string;
      }
      if (!match.product && row.ai_product) {
        match.product = row.ai_product as string;
      }
      if (!match.store_tag && row.ai_store_tag) {
        match.store_tag = row.ai_store_tag as string;
      }
    }
    if (!pageRows || pageRows.length < pageSize) break;
  }

  const rows = allRows.filter((r) => {
    const opened = new Date(r.opened_at).getTime();
    if (range.from && opened < range.from.getTime()) return false;
    if (opened > range.to.getTime()) return false;
    return true;
  });

  const now = Date.now();

  const allEscalationRows: EscalationRow[] = [];
  for (let page = 0; ; page++) {
    const { data: pageRows, error: escalationError } = await supabase
      .from("v_escalations")
      .select("*")
      .order("asked_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (escalationError) throw escalationError;
    allEscalationRows.push(
      ...(pageRows ?? []).map(
        (r): EscalationRow => ({
          ...r,
          waiting_hours_so_far:
            r.wait_minutes === null ? Math.round(((now - new Date(r.asked_at).getTime()) / 3_600_000) * 10) / 10 : null,
        })
      )
    );
    if (!pageRows || pageRows.length < pageSize) break;
  }
  const escalationRows = allEscalationRows.filter((r) => {
    const opened = new Date(r.ticket_opened_at).getTime();
    if (range.from && opened < range.from.getTime()) return false;
    if (opened > range.to.getTime()) return false;
    return true;
  });

  const resolvedRows = rows.filter((r) => r.resolved_effective);
  const openRows = rows.filter((r) => !r.resolved_effective);
  const resolutionHours = rows
    .filter((r) => r.resolved_by_tag)
    .map((r) => r.resolution_hours)
    .filter((h): h is number => h !== null);
  const highUrgencyOpen = openRows.filter((r) => r.urgency === "alta");

  const dailyMap = new Map<string, number>();
  for (const row of rows) {
    const date = row.opened_at.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }
  const dailyVolume = [...dailyMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const urgencyRank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const attention = [...openRows]
    .sort((a, b) => {
      const rankDiff = (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
    })
    .slice(0, 15)
    .map((r) => toAttentionRow(r, now));

  const waitingOpenRows = openRows.filter((r) => r.blocking_tag !== null);
  const waitingByType = topCounts(waitingOpenRows, "blocking_tag");
  const waitingByStore = topCounts(
    waitingOpenRows.filter((r) => r.blocking_tag === "aguardando-loja"),
    "store_tag"
  );
  const waitingList = buildWaitingList(openRows, now);
  const openTicketsList = buildOpenTicketsList(openRows, now);

  const firstResponseRows = rows.filter((r) => r.first_response_minutes !== null);
  const avgFirstResponseMinutes =
    firstResponseRows.length > 0
      ? Math.round(
          (firstResponseRows.reduce((sum, r) => sum + (r.first_response_minutes ?? 0), 0) /
            firstResponseRows.length) *
            10
        ) / 10
      : null;
  const pctWithinSla =
    firstResponseRows.length > 0
      ? Math.round((firstResponseRows.filter((r) => r.within_sla).length / firstResponseRows.length) * 100)
      : null;

  const recurrenceCount = rows.filter((r) => r.is_recurrence).length;

  const byCategory = topCounts(rows, "category");
  const previousWeek = buildPreviousWeekSummary(allRows, new Date());
  const escalations = buildEscalationSummary(escalationRows);
  const escalationList = [...escalationRows].sort(
    (a, b) => new Date(b.asked_at).getTime() - new Date(a.asked_at).getTime()
  );

  const storeBreakdown = buildStoreBreakdown(rows, labelFns.storeLabel, labelFns.categoryLabel);
  const categoryTickets = buildCategoryTicketsMap(rows);
  // Nome/telefone dos chamados por trás do "problema mais comum" (loja,
  // categoria geral e semana anterior) -- query em lote única (mesmo padrão
  // de npsDetractors acima), pra não disparar uma consulta por chamado.
  const allBreakdownTickets = [
    ...storeBreakdown.flatMap((s) => s.topCategoryTickets),
    ...Object.values(categoryTickets).flat(),
    ...previousWeek.topCategoryTickets,
  ];
  const breakdownContactIds = [...new Set(allBreakdownTickets.map((t) => t.contactId).filter((id): id is string => !!id))];
  if (breakdownContactIds.length > 0) {
    const { data: contactRows, error: breakdownContactsError } = await supabase
      .from("contacts")
      .select("id, name, phone")
      .in("id", breakdownContactIds);
    if (breakdownContactsError) throw breakdownContactsError;
    const breakdownContactsById = new Map(
      (contactRows ?? []).map((c) => [c.id as string, { name: c.name as string | null, phone: c.phone as string | null }])
    );
    for (const ticket of allBreakdownTickets) {
      const info = breakdownContactsById.get(ticket.contactId ?? "");
      ticket.clientName = info?.name ?? null;
      ticket.clientPhone = info?.phone ?? null;
    }
  }

  return {
    totalTickets: rows.length,
    resolvedCount: resolvedRows.length,
    openCount: openRows.length,
    resolvedByTagCount: rows.filter((r) => r.resolved_by_tag).length,
    highUrgencyOpenCount: highUrgencyOpen.length,
    avgResolutionHours:
      resolutionHours.length > 0
        ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
        : null,
    medianResolutionHours: median(resolutionHours),
    byCategory,
    byStore: topCounts(rows, "store_tag"),
    byProduct: topCounts(rows, "product"),
    byAgent: byAgentCounts(rows),
    byChannel: topCounts(rows, "channel"),
    dailyVolume,
    backlogOverTime: buildBacklogOverTime(allRows, range.from, range.to),
    attention,
    openTicketsList,
    avgFirstResponseMinutes,
    pctWithinSla,
    firstResponseSampleSize: firstResponseRows.length,
    slaMinutesThreshold: 30,
    recurrenceCount,
    recurrencePct: rows.length > 0 ? Math.round((recurrenceCount / rows.length) * 100) : null,
    paretoSummary: buildParetoSummary(byCategory, rows.length, labelFns.categoryLabel),
    storeBreakdown,
    categoryTickets,
    waitingCount: waitingOpenRows.length,
    waitingByType,
    waitingByStore,
    waitingList,
    categoryCoverage: computeCoverage(rows, "category"),
    storeCoverage: computeCoverage(rows, "store_tag"),
    productCoverage: computeCoverage(rows, "product"),
    previousWeek,
    escalations,
    escalationList,
    escalationByStore: buildEscalationByStore(escalationRows, labelFns.storeLabel),
    byAgentStats: buildAgentStats(rows),
    performanceReport: buildPerformanceReportSet(allRows, new Date()),
    npsSummary: buildNpsSummary(rows, untrackedNpsScores),
    npsDetractors,
  };
}
