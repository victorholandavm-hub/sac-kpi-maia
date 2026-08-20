import { describe, it, expect } from "vitest";
import type { KpiData, PerformanceMetric } from "./kpi";
import { buildHeadlineInsights, buildPerformanceInsights, buildGargalosInsights } from "./kpiInsights";

function metric(key: string, overrides: Partial<PerformanceMetric> = {}): PerformanceMetric {
  return {
    key,
    label: key,
    unit: "%",
    current: null,
    previous: null,
    deltaPct: null,
    direction: null,
    improved: null,
    ...overrides,
  };
}

// Base com todos os campos de KpiData preenchidos com valores neutros --
// cada teste só sobrescreve o que importa pra regra sendo testada.
function baseData(overrides: Partial<KpiData> = {}): KpiData {
  return {
    totalTickets: 0,
    resolvedCount: 0,
    openCount: 0,
    resolvedByTagCount: 0,
    highUrgencyOpenCount: 0,
    avgResolutionHours: null,
    medianResolutionHours: null,
    byCategory: [],
    byStore: [],
    byProduct: [],
    byAgent: [],
    byChannel: [],
    dailyVolume: [],
    backlogOverTime: [],
    attention: [],
    openTicketsList: [],
    avgFirstResponseMinutes: null,
    pctWithinSla: null,
    pctWithin5Min: null,
    firstResponseSampleSize: 0,
    slaMinutesThreshold: 30,
    recurrenceCount: 0,
    recurrencePct: null,
    paretoSummary: null,
    storeBreakdown: [],
    categoryTickets: {},
    waitingCount: 0,
    waitingByType: [],
    waitingByStore: [],
    waitingList: [],
    categoryCoverage: { withValue: 0, total: 0, pct: 0 },
    storeCoverage: { withValue: 0, total: 0, pct: 0 },
    productCoverage: { withValue: 0, total: 0, pct: 0 },
    previousWeek: { from: "", to: "", totalTickets: 0, topStore: null, topCategory: null, topCategoryTickets: [] },
    escalations: { completedCount: 0, pendingCount: 0, avgWaitMinutes: null, byTarget: [] },
    escalationList: [],
    escalationByStore: [],
    byAgentStats: [],
    performanceReport: {
      week: {
        windowDays: 7,
        currentFrom: "",
        currentTo: "",
        previousFrom: "",
        previousTo: "",
        currentSampleSize: 0,
        previousSampleSize: 0,
        metrics: [],
      },
      month: {
        windowDays: 30,
        currentFrom: "",
        currentTo: "",
        previousFrom: "",
        previousTo: "",
        currentSampleSize: 0,
        previousSampleSize: 0,
        metrics: [],
      },
    },
    npsSummary: {
      avgScore: null,
      responseCount: 0,
      eligibleCount: 0,
      responseRatePct: null,
      distribution: [],
      promoterCount: 0,
      neutralCount: 0,
      detractorCount: 0,
      promoterPct: null,
      neutralPct: null,
      detractorPct: null,
      npsIndex: null,
    },
    npsDetractors: [],
    agentDrilldown: {},
    ...overrides,
  };
}

describe("buildHeadlineInsights", () => {
  it("sem amostra de 1ª resposta -> não gera insight de 1ª resposta", () => {
    const insights = buildHeadlineInsights(baseData());
    expect(insights.find((i) => i.id === "first-response")).toBeUndefined();
  });

  it("pctWithin5Min abaixo de 25% -> crítico", () => {
    const insights = buildHeadlineInsights(
      baseData({ firstResponseSampleSize: 10, avgFirstResponseMinutes: 40, pctWithin5Min: 10 })
    );
    const insight = insights.find((i) => i.id === "first-response");
    expect(insight?.status).toBe("critical");
    expect(insight?.action).not.toBeNull();
  });

  it("pctWithin5Min entre 25% e 50% -> alerta", () => {
    const insights = buildHeadlineInsights(
      baseData({ firstResponseSampleSize: 10, avgFirstResponseMinutes: 15, pctWithin5Min: 40 })
    );
    expect(insights.find((i) => i.id === "first-response")?.status).toBe("warning");
  });

  it("pctWithin5Min acima de 50% -> bom, sem ação", () => {
    const insights = buildHeadlineInsights(
      baseData({ firstResponseSampleSize: 10, avgFirstResponseMinutes: 3, pctWithin5Min: 80 })
    );
    const insight = insights.find((i) => i.id === "first-response");
    expect(insight?.status).toBe("good");
    expect(insight?.action).toBeNull();
  });

  it("NPS negativo -> crítico e sugere ligar pros detratores", () => {
    const insights = buildHeadlineInsights(
      baseData({
        npsSummary: {
          avgScore: 2,
          responseCount: 5,
          eligibleCount: 10,
          responseRatePct: 50,
          distribution: [],
          promoterCount: 1,
          neutralCount: 0,
          detractorCount: 4,
          promoterPct: 20,
          neutralPct: 0,
          detractorPct: 80,
          npsIndex: -60,
        },
        npsDetractors: [{ conversationId: "c1", score: 1, answeredAt: "", clientName: "Cliente", clientPhone: null }],
      })
    );
    const insight = insights.find((i) => i.id === "nps");
    expect(insight?.status).toBe("critical");
    expect(insight?.action).toContain("1 clientes");
  });

  it("NPS acima da meta -> bom", () => {
    const insights = buildHeadlineInsights(
      baseData({
        npsSummary: {
          avgScore: 5,
          responseCount: 5,
          eligibleCount: 5,
          responseRatePct: 100,
          distribution: [],
          promoterCount: 5,
          neutralCount: 0,
          detractorCount: 0,
          promoterPct: 100,
          neutralPct: 0,
          detractorPct: 0,
          npsIndex: 100,
        },
      })
    );
    expect(insights.find((i) => i.id === "nps")?.status).toBe("good");
  });

  it("urgência alta zerada -> bom", () => {
    const insights = buildHeadlineInsights(baseData({ highUrgencyOpenCount: 0 }));
    expect(insights.find((i) => i.id === "urgency")?.status).toBe("good");
  });

  it("5+ chamados urgentes -> crítico", () => {
    const insights = buildHeadlineInsights(baseData({ highUrgencyOpenCount: 6 }));
    expect(insights.find((i) => i.id === "urgency")?.status).toBe("critical");
  });

  it("1-4 chamados urgentes -> alerta", () => {
    const insights = buildHeadlineInsights(baseData({ highUrgencyOpenCount: 2 }));
    expect(insights.find((i) => i.id === "urgency")?.status).toBe("warning");
  });
});

describe("buildPerformanceInsights", () => {
  it("SLA abaixo de 50% -> crítico, com tendência da semana", () => {
    const insights = buildPerformanceInsights(
      baseData({
        firstResponseSampleSize: 10,
        pctWithinSla: 30,
        performanceReport: {
          week: {
            windowDays: 7,
            currentFrom: "",
            currentTo: "",
            previousFrom: "",
            previousTo: "",
            currentSampleSize: 10,
            previousSampleSize: 10,
            metrics: [metric("pctWithinSla", { current: 30, previous: 60, deltaPct: -50, direction: "down", improved: false })],
          },
          month: { windowDays: 30, currentFrom: "", currentTo: "", previousFrom: "", previousTo: "", currentSampleSize: 0, previousSampleSize: 0, metrics: [] },
        },
      })
    );
    const insight = insights.find((i) => i.id === "sla");
    expect(insight?.status).toBe("critical");
    expect(insight?.explanation).toContain("piora");
  });

  it("SLA acima de 80% -> bom", () => {
    const insights = buildPerformanceInsights(baseData({ firstResponseSampleSize: 10, pctWithinSla: 90 }));
    expect(insights.find((i) => i.id === "sla")?.status).toBe("good");
  });

  it("reincidência acima de 25% -> crítico", () => {
    const insights = buildPerformanceInsights(baseData({ recurrencePct: 30 }));
    expect(insights.find((i) => i.id === "recurrence")?.status).toBe("critical");
  });

  it("reincidência baixa -> bom, sem ação", () => {
    const insights = buildPerformanceInsights(baseData({ recurrencePct: 5 }));
    const insight = insights.find((i) => i.id === "recurrence");
    expect(insight?.status).toBe("good");
    expect(insight?.action).toBeNull();
  });
});

describe("buildGargalosInsights", () => {
  it("amostra pequena (< 5 chamados) -> não gera insight de categoria", () => {
    const insights = buildGargalosInsights(baseData({ totalTickets: 3, byCategory: [{ label: "cat-atraso", count: 3 }] }));
    expect(insights.find((i) => i.id === "top-category")).toBeUndefined();
  });

  it("categoria concentrada bate regra conhecida -> alerta/crítico com causa provável", () => {
    const insights = buildGargalosInsights(
      baseData({ totalTickets: 10, byCategory: [{ label: "cat-atraso", count: 5 }] })
    );
    const insight = insights.find((i) => i.id === "top-category");
    expect(insight?.status).not.toBe("good");
    expect(insight?.explanation).toContain("Causa provável");
  });

  it("sem categoria concentrada -> bom", () => {
    const insights = buildGargalosInsights(
      baseData({ totalTickets: 10, byCategory: [{ label: "cat-atraso", count: 2 }] })
    );
    expect(insights.find((i) => i.id === "top-category")?.status).toBe("good");
  });
});
