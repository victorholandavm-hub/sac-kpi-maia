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
};

export type Count = { label: string; count: number };
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

export type StoreBreakdown = {
  store: string;
  total: number;
  topCategory: string | null;
  topCategoryCount: number;
  topCategoryPct: number;
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
  avgFirstResponseMinutes: number | null;
  pctWithinSla: number | null;
  firstResponseSampleSize: number;
  slaMinutesThreshold: number;
  recurrenceCount: number;
  recurrencePct: number | null;
  paretoSummary: string | null;
  storeBreakdown: StoreBreakdown[];
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
};

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
    if (!row.is_sac_agent || !row.agent_name) continue;
    counts.set(row.agent_name, (counts.get(row.agent_name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
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

function buildPreviousWeekSummary(allRows: TicketRow[], now: Date): PreviousWeekSummary {
  const { from, to, fromLabel, toLabel } = getPreviousWeekRange(now);
  const weekRows = allRows.filter((r) => {
    const opened = new Date(r.opened_at).getTime();
    return opened >= from.getTime() && opened <= to.getTime();
  });
  return {
    from: fromLabel,
    to: toLabel,
    totalTickets: weekRows.length,
    topStore: topCounts(weekRows, "store_tag")[0] ?? null,
    topCategory: topCounts(weekRows, "category")[0] ?? null,
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
      return {
        store: storeLabelFn(store),
        total: storeRows.length,
        topCategory: top ? categoryLabelFn(top[0]) : null,
        topCategoryCount: top ? top[1] : 0,
        topCategoryPct: top ? Math.round((top[1] / storeRows.length) * 100) : 0,
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
    allRows.push(...((pageRows ?? []) as TicketRow[]));
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
    avgFirstResponseMinutes,
    pctWithinSla,
    firstResponseSampleSize: firstResponseRows.length,
    slaMinutesThreshold: 30,
    recurrenceCount,
    recurrencePct: rows.length > 0 ? Math.round((recurrenceCount / rows.length) * 100) : null,
    paretoSummary: buildParetoSummary(byCategory, rows.length, labelFns.categoryLabel),
    storeBreakdown: buildStoreBreakdown(rows, labelFns.storeLabel, labelFns.categoryLabel),
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
  };
}
