"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { KpiData, Count, StoreBreakdownTicket } from "@/lib/kpi";
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
import { categoryLabel, storeLabel, productLabel } from "@/lib/labels";

const NPS_SCORE_LABELS: Record<number, string> = {
  5: "5 - Muito satisfeito",
  4: "4 - Satisfeito",
  3: "3 - Indiferente",
  2: "2 - Insatisfeito",
  1: "1 - Muito insatisfeito",
};

const TABS = [
  { key: "geral", label: "Geral e volumetria" },
  { key: "performance", label: "Performance da equipe" },
  { key: "gargalos", label: "Gargalos e logística" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Linha de BarRanking que vira carrossel deslizável no mobile (snap-x) e
// grid normal a partir do md: -- cada filho define sua própria largura
// (ver uso abaixo), esse wrapper só cuida do scroll/snap.
function CarouselRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 md:grid md:grid-cols-2 md:overflow-visible md:mx-0 md:px-0">
      {children}
    </div>
  );
}

function CarouselCard({ children }: { children: ReactNode }) {
  return <div className="shrink-0 w-[85%] snap-center md:w-auto md:shrink">{children}</div>;
}

export function Dashboard({ data, range }: { data: KpiData; range: DateRange }) {
  const [tab, setTab] = useState<TabKey>("geral");

  // Cabeçalho de filtro colapsa ao rolar pra baixo no mobile, reaparece ao
  // rolar pra cima -- no desktop fica sempre visível (transform anulado por
  // md:translate-y-0, ver classe abaixo). Sem lib nova, só scroll listener.
  const [filtersHidden, setFiltersHidden] = useState(false);
  const lastScrollY = useRef(0);
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - lastScrollY.current) > 8) {
        setFiltersHidden(y > lastScrollY.current && y > 80);
        lastScrollY.current = y;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const resolvedPct =
    data.totalTickets > 0 ? Math.round((data.resolvedCount / data.totalTickets) * 100) : 0;

  // `tag` preserva o valor cru ("cat-duvida") por trás do label traduzido --
  // usado pra abrir o drill-down (data.categoryTickets é indexado pela tag).
  const byCategory = data.byCategory.map((c) => ({ ...c, tag: c.label, label: categoryLabel(c.label) }));
  const byStore = data.byStore.map((c) => ({ ...c, label: storeLabel(c.label) }));
  const byProduct = data.byProduct.map((c) => ({ ...c, label: productLabel(c.label) }));

  const [categoryModal, setCategoryModal] = useState<{ title: string; totalCount: number; tickets: StoreBreakdownTicket[] } | null>(
    null
  );
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

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <div
        className={`sticky top-0 z-20 flex flex-col gap-3 pb-3 transition-transform duration-200 md:static md:translate-y-0 ${
          filtersHidden ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{ background: "var(--background)" }}
      >
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

        {/* Banner de destaque -- os 4 números que mais importam pro
            gestor de relance, antes de qualquer aba. */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Total de chamados" value={data.totalTickets} />
          <StatTile
            label="Tempo médio de 1ª resposta"
            value={data.avgFirstResponseMinutes ?? "—"}
            suffix={data.avgFirstResponseMinutes !== null ? "min" : undefined}
          />
          <StatTile
            label={`Índice NPS (meta ${NPS_INDEX_TARGET})`}
            value={data.npsSummary.npsIndex ?? "—"}
            accent={indexColor(data.npsSummary.npsIndex)}
          />
          <StatTile
            label="Urgência alta em aberto"
            value={data.highUrgencyOpenCount}
            accent={data.highUrgencyOpenCount > 0 ? "var(--status-critical)" : undefined}
          />
        </section>

        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap -mx-1 px-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="text-sm px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 border"
                style={{
                  borderColor: active ? "transparent" : "var(--border)",
                  background: active ? "var(--brand-green)" : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "geral" ? (
        <div className="flex flex-col gap-6">
          <PreviousWeekCard data={data.previousWeek} />

          <BacklogTrendChart data={data.backlogOverTime} trend={data.backlogTrend} />

          <VolumeChart data={data.dailyVolume} />

          <CarouselRow>
            <CarouselCard>
              <BarRanking
                title="Principais categorias de problema"
                data={byCategory}
                coverage={data.categoryCoverage}
                onSelect={openCategoryDrilldown}
              />
            </CarouselCard>
            <CarouselCard>
              <BarRanking title="Chamados por loja" data={byStore} coverage={data.storeCoverage} />
            </CarouselCard>
            <CarouselCard>
              <BarRanking title="Chamados por produto" data={byProduct} coverage={data.productCoverage} />
            </CarouselCard>
            <CarouselCard>
              <BarRanking title="Chamados por canal" data={data.byChannel} />
            </CarouselCard>
          </CarouselRow>

          <StoreBreakdownTable data={data.storeBreakdown} />

          <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatTile label="Em aberto" value={data.openCount} />
            <StatTile label="Resolvidos" value={`${resolvedPct}%`} />
            <StatTile
              label="Tempo médio de resolução"
              value={data.avgResolutionHours ?? "—"}
              suffix={data.avgResolutionHours !== null ? "h" : undefined}
            />
            <StatTile
              label="Respondidos em até 5min"
              value={data.pctWithin5Min !== null ? `${data.pctWithin5Min}%` : "—"}
            />
            <StatTile
              label={`Dentro do SLA (${data.slaMinutesThreshold}min)`}
              value={data.pctWithinSla !== null ? `${data.pctWithinSla}%` : "—"}
            />
            <StatTile label="Taxa de reincidência" value={data.recurrencePct !== null ? `${data.recurrencePct}%` : "—"} />
          </section>
          <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
            Tempo de resolução calculado apenas para os {data.resolvedByTagCount} chamados com a tag de
            status aplicada. 1ª resposta/SLA já considera horário comercial (seg-sex 8h-18h, sáb 8h-17h)
            para {data.firstResponseSampleSize} chamados com mensagens suficientes — ainda assim é uma
            aproximação nossa e pode não bater exatamente com o relatório nativo do GHL.
          </p>
        </div>
      ) : null}

      {tab === "performance" ? (
        <div className="flex flex-col gap-6">
          <NpsCard data={data.npsSummary} detractors={data.npsDetractors} />
          <BarRanking
            title="Distribuição das notas (enquete GHL)"
            data={npsDistribution}
            coverage={{ withValue: data.npsSummary.responseCount, total: data.npsSummary.eligibleCount, pct: data.npsSummary.responseRatePct ?? 0 }}
          />

          {data.paretoSummary ? (
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {data.paretoSummary}
            </p>
          ) : null}

          <BarRanking title="Chamados por agente" data={data.byAgent} />

          <AgentStatsTable data={data.byAgentStats} ticketsByAgent={data.agentTickets} />
        </div>
      ) : null}

      {tab === "gargalos" ? (
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 gap-4">
            <StatTile
              label="Espera média por info. externa (IA)"
              value={data.escalations.avgWaitMinutes !== null ? Math.round((data.escalations.avgWaitMinutes / 60) * 10) / 10 : "—"}
              suffix={data.escalations.avgWaitMinutes !== null ? "h" : undefined}
            />
            <StatTile label="Ciclos de consulta ainda em aberto (IA)" value={data.escalations.pendingCount} />
          </section>
          <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
            A espera por informação externa é lida diretamente do texto das conversas por IA (
            {data.escalations.completedCount} ciclos concluídos analisados), sem depender de tags.
          </p>

          <EscalationByStoreTable data={data.escalationByStore} />
          <EscalationBreakdown data={data.escalations.byTarget} />
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
