"use client";

import type { KpiData } from "@/lib/kpi";
import type { DateRange } from "@/lib/dateRange";
import { StatTile } from "./StatTile";
import { BarRanking } from "./BarRanking";
import { VolumeChart } from "./VolumeChart";
import { BacklogTable } from "./BacklogTable";
import { BacklogTrendChart } from "./BacklogTrendChart";
import { StoreBreakdownTable } from "./StoreBreakdownTable";
import { WaitingTable } from "./WaitingTable";
import { EscalationBreakdown } from "./EscalationBreakdown";
import { EscalationByStoreTable } from "./EscalationByStoreTable";
import { EscalationPendingTable } from "./EscalationPendingTable";
import { RangePicker } from "./RangePicker";
import { PreviousWeekCard } from "./PreviousWeekCard";
import { AgentQueue } from "./AgentQueue";
import { AgentStatsTable } from "./AgentStatsTable";
import { PerformanceReportButton } from "./PerformanceReportButton";
import { categoryLabel, storeLabel, productLabel, blockingLabel } from "@/lib/labels";

export function Dashboard({ data, range }: { data: KpiData; range: DateRange }) {
  const resolvedPct =
    data.totalTickets > 0 ? Math.round((data.resolvedCount / data.totalTickets) * 100) : 0;

  const byCategory = data.byCategory.map((c) => ({ ...c, label: categoryLabel(c.label) }));
  const byStore = data.byStore.map((c) => ({ ...c, label: storeLabel(c.label) }));
  const byProduct = data.byProduct.map((c) => ({ ...c, label: productLabel(c.label) }));
  const waitingByType = data.waitingByType.map((c) => ({ ...c, label: blockingLabel(c.label) }));
  const waitingByStore = data.waitingByStore.map((c) => ({ ...c, label: storeLabel(c.label) }));

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RangePicker range={range} />
          <PerformanceReportButton data={data.performanceReport} />
        </div>
      </div>

      <PreviousWeekCard data={data.previousWeek} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total de chamados" value={data.totalTickets} />
        <StatTile label="Em aberto" value={data.openCount} />
        <StatTile label="Resolvidos" value={`${resolvedPct}%`} />
        <StatTile label="Urgência alta em aberto" value={data.highUrgencyOpenCount} />
        <StatTile
          label="Tempo médio de resolução"
          value={data.avgResolutionHours ?? "—"}
          suffix={data.avgResolutionHours !== null ? "h" : undefined}
        />
        <StatTile
          label="1ª resposta (média)"
          value={data.avgFirstResponseMinutes ?? "—"}
          suffix={data.avgFirstResponseMinutes !== null ? "min" : undefined}
        />
        <StatTile
          label={`Dentro do SLA (${data.slaMinutesThreshold}min)`}
          value={data.pctWithinSla !== null ? `${data.pctWithinSla}%` : "—"}
        />
        <StatTile label="Taxa de reincidência" value={data.recurrencePct !== null ? `${data.recurrencePct}%` : "—"} />
        <StatTile label="Esperando resposta externa (tag)" value={data.waitingCount} />
        <StatTile
          label="Espera média por info. externa (IA)"
          value={data.escalations.avgWaitMinutes !== null ? Math.round((data.escalations.avgWaitMinutes / 60) * 10) / 10 : "—"}
          suffix={data.escalations.avgWaitMinutes !== null ? "h" : undefined}
        />
        <StatTile label="Ciclos de consulta ainda em aberto (IA)" value={data.escalations.pendingCount} />
      </section>
      <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
        Tempo de resolução calculado apenas para os {data.resolvedByTagCount} chamados com a tag de
        status aplicada. 1ª resposta/SLA já considera horário comercial (seg-sex 8h-18h, sáb 8h-17h)
        para {data.firstResponseSampleSize} chamados com mensagens suficientes — ainda assim é uma
        aproximação nossa e pode não bater exatamente com o relatório nativo do GHL. A espera por
        informação externa é lida diretamente do texto das conversas por IA (
        {data.escalations.completedCount} ciclos concluídos analisados), sem depender de tags.
      </p>

      {data.paretoSummary ? (
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {data.paretoSummary}
        </p>
      ) : null}

      <AgentQueue data={data.agentQueue} />

      <AgentStatsTable data={data.byAgentStats} />

      <section className="grid md:grid-cols-3 gap-4">
        <BarRanking title="Principais categorias de problema" data={byCategory} coverage={data.categoryCoverage} />
        <BarRanking title="Chamados por loja" data={byStore} coverage={data.storeCoverage} />
        <BarRanking title="Chamados por produto" data={byProduct} coverage={data.productCoverage} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title="Chamados por agente" data={data.byAgent} />
        <BarRanking title="Chamados por canal" data={data.byChannel} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <VolumeChart data={data.dailyVolume} />
        <BacklogTrendChart data={data.backlogOverTime} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <StoreBreakdownTable data={data.storeBreakdown} />
        <BacklogTable data={data.attention} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title="Lojas que mais demoram a responder" data={waitingByStore} />
        <BarRanking title="Aguardando por tipo" data={waitingByType} />
      </section>

      <WaitingTable data={data.waitingList} />

      <section className="grid md:grid-cols-2 gap-4">
        <EscalationBreakdown data={data.escalations.byTarget} />
        <EscalationByStoreTable data={data.escalationByStore} />
      </section>

      <EscalationPendingTable data={data.escalationList} />
    </div>
  );
}
