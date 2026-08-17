"use client";

import { useState } from "react";
import Link from "next/link";
import type { KpiData, Count, StoreBreakdownTicket, MarketVolume } from "@/lib/kpi";
import type { DateRange } from "@/lib/dateRange";
import { StatTile } from "./StatTile";
import { BarRanking } from "./BarRanking";
import { VolumeChart } from "./VolumeChart";
import { BacklogTrendChart } from "./BacklogTrendChart";
import { StoreBreakdownTable } from "./StoreBreakdownTable";
import { EscalationBreakdown } from "./EscalationBreakdown";
import { EscalationByStoreTable } from "./EscalationByStoreTable";
import { RangePicker } from "./RangePicker";
import { PreviousWeekCard } from "./PreviousWeekCard";
import { AgentStatsTable } from "./AgentStatsTable";
import { PerformanceReportButton } from "./PerformanceReportButton";
import { NpsCard, NPS_INDEX_TARGET, indexColor } from "./NpsCard";
import { CategoryTicketsModal } from "./CategoryTicketsModal";
import { InsightGrid } from "./InsightCard";
import { buildHeadlineInsights, buildPerformanceInsights, buildGargalosInsights } from "@/lib/kpiInsights";
import { categoryLabel, storeLabel, productLabel } from "@/lib/labels";

// Selo de volume de chamados contra referência de mercado (ver
// getMarketVolume em kpi.ts) -- pedido do Victor 17/08/2026. null quando
// não dá pra calcular (período "todo o histórico" ou sem venda
// sincronizada no período) -- some o selo em vez de mostrar algo errado.
function marketVolumeBadge(mv: MarketVolume | null): { label: string; color: string; title: string } | undefined {
  if (!mv) return undefined;
  const title = `${mv.contactRatePct}% dos pedidos geraram chamado (${mv.orderCount} pedidos no período). Referência estimada de mercado (varejo, categoria mais próxima disponível) — não é um dado auditado pro nosso setor exato.`;
  if (mv.level === "baixo") return { label: "Volume baixo p/ mercado", color: "var(--status-good)", title };
  if (mv.level === "alto") return { label: "Volume alto p/ mercado", color: "var(--status-critical)", title };
  return { label: "Volume na média do mercado", color: "var(--status-warning)", title };
}

const NPS_SCORE_LABELS: Record<number, string> = {
  5: "5 - Muito satisfeito",
  4: "4 - Satisfeito",
  3: "3 - Indiferente",
  2: "2 - Insatisfeito",
  1: "1 - Muito insatisfeito",
};

// As 3 abas do painel -- separa "o que aconteceu" (volumetria), "quem
// atendeu" (equipe) e "onde travou" (gargalos/logística) em vez de uma
// rolagem só com tudo misturado.
const TABS = [
  { id: "geral", label: "Geral e Volumetria" },
  { id: "performance", label: "Performance da Equipe" },
  { id: "gargalos", label: "Gargalos e Logística" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function Dashboard({ data, range }: { data: KpiData; range: DateRange }) {
  // `tag` preserva o valor cru ("cat-duvida") por trás do label traduzido --
  // usado pra abrir o drill-down (data.categoryTickets é indexado pela tag).
  const byCategory = data.byCategory.map((c) => ({ ...c, tag: c.label, label: categoryLabel(c.label) }));
  const byStore = data.byStore.map((c) => ({ ...c, label: storeLabel(c.label) }));
  const byProduct = data.byProduct.map((c) => ({ ...c, label: productLabel(c.label) }));

  const [categoryModal, setCategoryModal] = useState<{ title: string; totalCount: number; tickets: StoreBreakdownTicket[] } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  function openCategoryDrilldown(item: Count) {
    const tag = item.tag ?? item.label;
    setCategoryModal({
      title: item.label,
      totalCount: item.count,
      tickets: data.categoryTickets[tag] ?? [],
    });
  }
  // Ordem invertida (5 no topo) -- fica mais intuitivo no gráfico de barras
  // horizontal ver "muito satisfeito" em cima.
  const npsDistribution = [...data.npsSummary.distribution]
    .sort((a, b) => b.score - a.score)
    .map((d) => ({ label: NPS_SCORE_LABELS[d.score], count: d.count }));

  // Insights "tipo Clarity" -- explicação + ação por trás de cada número,
  // não só o número cru (ver src/lib/kpiInsights.ts). Calculados no cliente
  // porque são função pura de `data`, que já veio pronto do servidor.
  const headlineInsights = buildHeadlineInsights(data);
  const performanceInsights = buildPerformanceInsights(data);
  const gargalosInsights = buildGargalosInsights(data);

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RangePicker range={range} />
          <div className="flex items-center gap-2">
            <Link
              href="/em-andamento"
              className="text-sm font-medium px-3 py-1.5 rounded-full"
              style={{ background: "var(--brand-green)", color: "#fff" }}
            >
              Atendimentos em andamento
            </Link>
            <PerformanceReportButton data={data.performanceReport} />
          </div>
        </div>
      </div>

      {/* Banner de resumo -- os números que mais importam de relance, em
          fonte grande, sempre visíveis independente da aba ativa. Tempo de
          resposta vira 2 números (1º contato + % em até 5min) em vez de só
          a média geral -- a média sozinha escondia o problema real (uma
          resposta rápida e outra de 20min dão a mesma média de 10min de
          uma que demorou 10min certinho, mas são situações bem diferentes
          pro cliente no WhatsApp). */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile label="Total de chamados" value={data.totalTickets} size="lg" badge={marketVolumeBadge(data.marketVolume)} />
        <StatTile
          label="Resposta no 1º contato"
          value={data.avgFirstResponseMinutes ?? "—"}
          suffix={data.avgFirstResponseMinutes !== null ? "min" : undefined}
          size="lg"
        />
        <StatTile
          label="Respondidos em até 5min"
          value={data.pctWithin5Min !== null ? `${data.pctWithin5Min}%` : "—"}
          size="lg"
          valueColor={data.pctWithin5Min !== null && data.pctWithin5Min < 50 ? "var(--status-warning)" : undefined}
        />
        <StatTile
          label={`Satisfação (NPS, meta ${NPS_INDEX_TARGET})`}
          value={data.npsSummary.npsIndex ?? "—"}
          size="lg"
          accent="var(--brand-orange)"
          valueColor={indexColor(data.npsSummary.npsIndex)}
        />
        <StatTile
          label="Urgência alta em aberto"
          value={data.highUrgencyOpenCount}
          size="lg"
          accent="var(--status-critical)"
          valueColor={data.highUrgencyOpenCount > 0 ? "var(--status-critical)" : undefined}
        />
      </section>

      <InsightGrid insights={headlineInsights} />

      {/* Abas -- cada uma monta só o conteúdo dela (sem manter as outras
          fora de tela) pra não pagar o custo de renderizar tudo de uma vez;
          como todos os dados já vieram prontos em `data`, trocar de aba é
          só troca de estado local, sem nova requisição. */}
      <div className="flex flex-wrap gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="text-sm font-medium px-4 py-2 -mb-px rounded-t-lg border border-b-0"
              style={{
                color: active ? "var(--brand-green)" : "var(--text-secondary)",
                background: active ? "var(--surface-1)" : "transparent",
                borderColor: active ? "var(--border)" : "transparent",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "geral" ? (
        <div className="flex flex-col gap-6">
          <PreviousWeekCard data={data.previousWeek} />

          {/* "Em aberto"/"Resolvidos" saíram do painel por enquanto -- dependem
              da tag de status que o time ainda não aplica de forma consistente
              em toda conversa resolvida, então o número ficava sistematicamente
              inflado pra "em aberto" (chamado resolvido de fato mas sem a tag
              continua contando como aberto). Voltam quando a adoção da tag
              melhorar. */}

          {data.paretoSummary ? (
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {data.paretoSummary}
            </p>
          ) : null}

          <VolumeChart data={data.dailyVolume} />

          <section className="grid md:grid-cols-3 gap-4">
            <BarRanking title="Chamados por canal" data={data.byChannel} />
            <BarRanking title="Chamados por produto" data={byProduct} coverage={data.productCoverage} />
            <BarRanking title="Chamados por loja" data={byStore} coverage={data.storeCoverage} />
          </section>
        </div>
      ) : null}

      {activeTab === "performance" ? (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile
              label={`Dentro do SLA (${data.slaMinutesThreshold}min)`}
              value={data.pctWithinSla !== null ? `${data.pctWithinSla}%` : "—"}
            />
            <StatTile label="Taxa de reincidência" value={data.recurrencePct !== null ? `${data.recurrencePct}%` : "—"} />
          </section>
          <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
            1ª resposta/SLA já considera horário comercial (seg-sex 8h-18h, sáb 8h-17h) para{" "}
            {data.firstResponseSampleSize} chamados com mensagens suficientes — ainda assim é uma
            aproximação nossa e pode não bater exatamente com o relatório nativo do GHL.
          </p>

          <InsightGrid insights={performanceInsights} />

          <NpsCard data={data.npsSummary} detractors={data.npsDetractors} />
          <BarRanking
            title="Distribuição das notas (enquete GHL)"
            data={npsDistribution}
            coverage={{ withValue: data.npsSummary.responseCount, total: data.npsSummary.eligibleCount, pct: data.npsSummary.responseRatePct ?? 0 }}
          />

          <AgentStatsTable data={data.byAgentStats} drilldown={data.agentDrilldown} />
          <BarRanking title="Chamados por agente" data={data.byAgent} />
        </div>
      ) : null}

      {activeTab === "gargalos" ? (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile
              label="Tempo médio de resolução"
              value={data.avgResolutionHours ?? "—"}
              suffix={data.avgResolutionHours !== null ? "h" : undefined}
            />
            <StatTile
              label="Espera média por info. externa (IA)"
              value={data.escalations.avgWaitMinutes !== null ? Math.round((data.escalations.avgWaitMinutes / 60) * 10) / 10 : "—"}
              suffix={data.escalations.avgWaitMinutes !== null ? "h" : undefined}
            />
            <StatTile label="Ciclos de consulta ainda em aberto (IA)" value={data.escalations.pendingCount} />
          </section>
          <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
            Tempo de resolução calculado apenas para os {data.resolvedByTagCount} chamados com a tag
            de status aplicada. A espera por informação externa é lida diretamente do texto das
            conversas por IA ({data.escalations.completedCount} ciclos concluídos analisados), sem
            depender de tags.
          </p>

          <BarRanking
            title="Principais categorias de problema (motivos)"
            data={byCategory}
            coverage={data.categoryCoverage}
            onSelect={openCategoryDrilldown}
          />

          <InsightGrid insights={gargalosInsights} />

          <BacklogTrendChart data={data.backlogOverTime} />
          <StoreBreakdownTable data={data.storeBreakdown} />

          <section className="grid md:grid-cols-2 gap-4">
            <EscalationBreakdown data={data.escalations.byTarget} />
            <EscalationByStoreTable data={data.escalationByStore} />
          </section>
        </div>
      ) : null}

      {categoryModal ? (
        <CategoryTicketsModal
          title={categoryModal.title}
          totalCount={categoryModal.totalCount}
          tickets={categoryModal.tickets}
          onClose={() => setCategoryModal(null)}
        />
      ) : null}
    </div>
  );
}
