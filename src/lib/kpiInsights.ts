import type { KpiData, PerformanceMetric } from "./kpi";
import { ALERT_MIN_TOTAL, ALERT_RULES } from "./kpi";
import { categoryLabel } from "./labels";
import { NPS_INDEX_TARGET } from "@/components/NpsCard";

// Painel "tipo Clarity": pra cada número-chave do KPI, explica o que ele
// significa, se está bom ou ruim, e o que fazer a respeito -- em vez de só
// mostrar o número cru e deixar o gestor adivinhar. Tudo aqui é
// determinístico (limiares fixos sobre dados que já calculamos), sem
// chamada a IA -- decisão do Victor 15/08/2026 pra manter sem custo e
// resposta instantânea.
export type InsightStatus = "good" | "warning" | "critical";

export type KpiInsight = {
  id: string;
  status: InsightStatus;
  title: string;
  explanation: string;
  // null quando status é "good" -- não tem o que corrigir, só explica por
  // que está bom (ver explanation).
  action: string | null;
};

function findMetric(data: KpiData, key: string): PerformanceMetric | undefined {
  return data.performanceReport.week.metrics.find((m) => m.key === key);
}

// "Subiu 12% na última semana" / "Caiu 8% na última semana" -- null quando
// não há semana anterior comparável (amostra insuficiente).
function trendPhrase(metric: PerformanceMetric | undefined): string | null {
  if (!metric || metric.deltaPct === null || metric.direction === null || metric.direction === "flat") return null;
  const verb = metric.direction === "up" ? "subiu" : "caiu";
  const qualifier = metric.improved === null ? "" : metric.improved ? " (melhora)" : " (piora)";
  return `${verb} ${Math.abs(metric.deltaPct)}% em relação à semana anterior${qualifier}`;
}

function buildFirstResponseInsight(data: KpiData): KpiInsight | null {
  if (data.firstResponseSampleSize === 0 || data.avgFirstResponseMinutes === null) return null;
  const trend = trendPhrase(findMetric(data, "avgFirstResponse"));
  const pct5 = data.pctWithin5Min;

  if (pct5 !== null && pct5 < 50) {
    return {
      id: "first-response",
      status: pct5 < 25 ? "critical" : "warning",
      title: "Resposta ao 1º contato está lenta",
      explanation: `Só ${pct5}% dos chamados são respondidos por um atendente em até 5min (média geral: ${data.avgFirstResponseMinutes}min${trend ? `, ${trend}` : ""}). No WhatsApp, cliente esperando mais que isso já sente que "ninguém está vendo".`,
      action: "Verifique se há horários do dia com fila maior que o número de atendentes ativos, e se a mensagem automática de recepção está passando a impressão de resposta imediata quando na prática ainda não tem ninguém olhando.",
    };
  }
  return {
    id: "first-response",
    status: "good",
    title: "Resposta ao 1º contato está boa",
    explanation: `${pct5}% dos chamados são respondidos por um atendente em até 5min (média geral: ${data.avgFirstResponseMinutes}min${trend ? `, ${trend}` : ""}). Cliente não fica esperando.`,
    action: null,
  };
}

function buildNpsInsight(data: KpiData): KpiInsight | null {
  const { npsSummary, npsDetractors } = data;
  if (npsSummary.responseCount === 0 || npsSummary.npsIndex === null) return null;

  if (npsSummary.npsIndex < 0) {
    return {
      id: "nps",
      status: "critical",
      title: "Satisfação abaixo do aceitável",
      explanation: `Índice de satisfação em ${npsSummary.npsIndex} (meta ${NPS_INDEX_TARGET}) -- há mais detratores (nota 1-2, ${npsSummary.detractorPct}%) do que promotores (nota 4-5, ${npsSummary.promoterPct}%) entre as ${npsSummary.responseCount} avaliações recebidas.`,
      action:
        npsDetractors.length > 0
          ? `Ligue de volta pros ${npsDetractors.length} clientes que deram nota 1-2 (lista em "Detratores" abaixo) pra entender o que aconteceu -- é o retorno mais rápido pra reverter a percepção.`
          : "Acompanhe as próximas avaliações negativas assim que aparecerem pra entender a causa.",
    };
  }
  if (npsSummary.npsIndex < NPS_INDEX_TARGET) {
    return {
      id: "nps",
      status: "warning",
      title: "Satisfação abaixo da meta",
      explanation: `Índice de satisfação em ${npsSummary.npsIndex} (meta ${NPS_INDEX_TARGET}) -- ${npsSummary.promoterPct}% promotores, ${npsSummary.detractorPct}% detratores, entre ${npsSummary.responseCount} avaliações.`,
      action:
        npsDetractors.length > 0
          ? `Vale olhar os ${npsDetractors.length} chamados com nota 1-2 (lista em "Detratores" abaixo) pra achar um padrão comum.`
          : "Poucos detratores no período -- acompanhe se o índice se sustenta com mais avaliações.",
    };
  }
  return {
    id: "nps",
    status: "good",
    title: "Satisfação dentro da meta",
    explanation: `Índice de satisfação em ${npsSummary.npsIndex} (meta ${NPS_INDEX_TARGET}) -- ${npsSummary.promoterPct}% promotores contra só ${npsSummary.detractorPct}% detratores, entre ${npsSummary.responseCount} avaliações.`,
    action: null,
  };
}

function buildUrgencyInsight(data: KpiData): KpiInsight | null {
  const count = data.highUrgencyOpenCount;
  if (count > 0) {
    return {
      id: "urgency",
      status: count >= 5 ? "critical" : "warning",
      title: "Tem chamado urgente esperando",
      explanation: `${count} chamado${count > 1 ? "s" : ""} de urgência alta ainda em aberto agora.`,
      action: "Confira a lista de chamados em aberto e priorize esses antes de qualquer outro -- urgência alta normalmente significa cliente sem o produto ou vencendo prazo de garantia.",
    };
  }
  return {
    id: "urgency",
    status: "good",
    title: "Nenhum chamado urgente parado",
    explanation: "Não há chamado de urgência alta em aberto no momento.",
    action: null,
  };
}

function buildSlaInsight(data: KpiData): KpiInsight | null {
  if (data.pctWithinSla === null || data.firstResponseSampleSize === 0) return null;
  const trend = trendPhrase(findMetric(data, "pctWithinSla"));
  const pct = data.pctWithinSla;

  if (pct < 80) {
    return {
      id: "sla",
      status: pct < 50 ? "critical" : "warning",
      title: `Abaixo da meta de SLA (${data.slaMinutesThreshold}min)`,
      explanation: `${pct}% dos chamados tiveram 1ª resposta dentro de ${data.slaMinutesThreshold}min de horário comercial${trend ? `, ${trend}` : ""}.`,
      action: "Se a queda for concentrada em horário de pico (início da manhã, depois do almoço), considere escalonar atendentes nesses horários ou revisar a divisão de fila entre eles.",
    };
  }
  return {
    id: "sla",
    status: "good",
    title: "Dentro da meta de SLA",
    explanation: `${pct}% dos chamados tiveram 1ª resposta dentro de ${data.slaMinutesThreshold}min de horário comercial${trend ? `, ${trend}` : ""}.`,
    action: null,
  };
}

function buildRecurrenceInsight(data: KpiData): KpiInsight | null {
  if (data.recurrencePct === null) return null;
  const trend = trendPhrase(findMetric(data, "recurrencePct"));
  const pct = data.recurrencePct;

  if (pct > 10) {
    return {
      id: "recurrence",
      status: pct > 25 ? "critical" : "warning",
      title: "Taxa de reincidência alta",
      explanation: `${pct}% dos chamados são de clientes que já abriram chamado antes${trend ? `, ${trend}` : ""} -- sinal de que o problema não foi resolvido de fato na primeira vez, só "empurrado".`,
      action: "Veja se a reincidência está concentrada numa categoria ou loja específica (\"Chamados por loja\"/\"categoria\" abaixo) antes de tratar como problema geral.",
    };
  }
  return {
    id: "recurrence",
    status: "good",
    title: "Taxa de reincidência baixa",
    explanation: `Só ${pct}% dos chamados são de clientes que já tinham aberto chamado antes${trend ? `, ${trend}` : ""} -- indício de que os problemas estão sendo resolvidos na primeira vez.`,
    action: null,
  };
}

function buildTopCategoryInsight(data: KpiData): KpiInsight | null {
  const top = data.byCategory[0];
  if (!top || data.totalTickets < ALERT_MIN_TOTAL) return null;
  const pct = Math.round((top.count / data.totalTickets) * 100);
  const rule = ALERT_RULES.find((r) => r.tag === top.label);
  const label = categoryLabel(top.label);

  if (rule && pct >= rule.minPct) {
    return {
      id: "top-category",
      status: pct >= rule.minPct + 20 ? "critical" : "warning",
      title: `"${label}" concentra ${pct}% dos chamados`,
      explanation: `Causa provável: ${rule.signal}.`,
      action: `Veja os chamados dessa categoria (clique na barra em "Principais categorias") pra confirmar o padrão antes de agir.`,
    };
  }
  return {
    id: "top-category",
    status: "good",
    title: "Sem categoria concentrando os problemas",
    explanation: `"${label}" é a mais comum (${pct}% dos chamados), mas sem concentração forte o bastante pra apontar uma causa única -- os problemas estão distribuídos, não é sintoma de uma falha específica.`,
    action: null,
  };
}

// Grupos que a UI usa pra decidir onde encaixar cada card -- perto do
// número/seção que ele explica, em vez de um painel único e genérico no
// topo (ver Dashboard.tsx).
export function buildHeadlineInsights(data: KpiData): KpiInsight[] {
  return [buildFirstResponseInsight(data), buildNpsInsight(data), buildUrgencyInsight(data)].filter(
    (i): i is KpiInsight => i !== null
  );
}

export function buildPerformanceInsights(data: KpiData): KpiInsight[] {
  return [buildSlaInsight(data), buildRecurrenceInsight(data)].filter((i): i is KpiInsight => i !== null);
}

export function buildGargalosInsights(data: KpiData): KpiInsight[] {
  return [buildTopCategoryInsight(data)].filter((i): i is KpiInsight => i !== null);
}
