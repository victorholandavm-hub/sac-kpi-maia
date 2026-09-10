"use client";

import { useState } from "react";
import type { Count } from "@/lib/kpi";
import type { AssistenciaKpiData } from "@/lib/kpiAssistencia";
import type { ReportRowItem } from "@/lib/serviceRequests";
import { StatTile } from "./StatTile";
import { BarRanking } from "./BarRanking";
import { ProductBreakageRanking } from "./assistencia/ProductBreakageRanking";
import { VolumeChart } from "./VolumeChart";
import { CausaRaizDonutChart } from "./CausaRaizDonutChart";
import { AssistenciaTicketsModal } from "./AssistenciaTicketsModal";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Conteúdo da página /kpis-assistencia -- extraído de dentro de
// Dashboard.tsx (onde viveu como 4ª aba por um dia, 27/08/2026) pra
// página própria, pedido do Victor: "preciso que os kpis da assistencia
// fiquem numa aba separada, sozinha". Dados já vêm prontos do servidor
// (getAssistenciaKpiData, kpiAssistencia.ts) -- esse componente só cuida
// da interatividade (clique numa barra abre o drill-down de chamados).
export function KpisAssistenciaView({ data }: { data: AssistenciaKpiData }) {
  const [ticketsModal, setTicketsModal] = useState<{ title: string; totalCount: number; tickets: ReportRowItem[] } | null>(null);

  function openDrilldown(item: Count) {
    const tag = item.tag ?? item.label;
    setTicketsModal({
      title: item.label,
      totalCount: item.count,
      tickets: data.ticketsByTag[tag] ?? [],
    });
  }

  const causaRaizDonutData = data.byCausaRaiz.map((c) => ({
    key: c.tag?.replace(/^causa:/, "") ?? c.label,
    name: c.label,
    value: c.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile label="Total de chamados de assistência" value={data.totalChamados} size="lg" />
        {/* Prejuízo Total Estimado em Estoque -- pedido do Victor
            10/09/2026: soma (1) prejuízo de PRODUTO (unidades trocadas/
            enviadas × custo de reposição do Protheus, totvs_stock.unit_cost)
            com (2) custo OPERACIONAL estático por tipo de chamado (frete/
            motoboy, sem valor real no ERP -- estimativa fixa do Victor,
            ver CUSTO_OPERACIONAL_POR_TIPO em kpiAssistencia.ts). O badge
            só cobre a cobertura da parte (1) -- a (2) é sempre um valor
            conhecido por construção (estimativa), não precisa de
            cobertura. */}
        <StatTile
          label="Prejuízo total estimado em estoque"
          value={formatBRL(data.prejuizoTotalEstimado)}
          size="lg"
          accent="var(--status-critical)"
          badge={{
            label: `${data.prejuizoCobertura.pct}% com custo de produto rastreado`,
            color: "var(--status-critical)",
            title: `Soma custo de produto (unidades × custo de reposição do Protheus) com custo operacional estimado (frete/motoboy, valor fixo por tipo -- não vem do ERP). A parte de PRODUTO só está rastreada em ${data.prejuizoCobertura.withValue} de ${data.prejuizoCobertura.total} chamados (${data.prejuizoCobertura.pct}%) -- quem não tem código Protheus + custo sincronizado entra só com o custo operacional estimado.`,
          }}
        />
        <StatTile label="Produtos distintos com chamado" value={data.distinctProductCount} />
        <StatTile label="Lojas com chamado no período" value={data.byStore.length} />
        <StatTile label="Rotas com chamado no período" value={data.byRota.length} />
      </section>

      <VolumeChart data={data.dailyVolume} title="Volume de chamados de assistência por dia" />

      <section className="grid md:grid-cols-2 gap-4">
        {/* Substitui o antigo ranking por volume bruto -- pedido do
            Victor 10/09/2026: ordenar por Taxa de Quebra (chamados ÷
            vendas do período), não por quantos chamados o produto teve.
            Ver ProductBreakageRanking.tsx pro racional completo. */}
        <ProductBreakageRanking data={data.byProductBreakage} onSelect={openDrilldown} />
        <BarRanking title="Chamados por grupo de produto" data={data.byProductGroup} onSelect={openDrilldown} showPercent />
        <BarRanking title="Chamados por tipo de solicitação" data={data.byType} onSelect={openDrilldown} showPercent />
        <BarRanking title="Chamados por rota" data={data.byRota} onSelect={openDrilldown} showPercent />
        <BarRanking title="Chamados por loja" data={data.byStore} onSelect={openDrilldown} showPercent />
        <BarRanking title="Chamados por atendente" data={data.byAgent} onSelect={openDrilldown} showPercent />
      </section>

      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          Quem errou
        </h3>
        {data.byCausaRaiz.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sem dados suficientes ainda.
          </p>
        ) : (
          <>
            <CausaRaizDonutChart data={causaRaizDonutData} />
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Clique numa fatia da lista abaixo pra ver os chamados.
            </p>
            {/* Percentual dentro da própria barra -- pedido do Victor
                29/08/2026 (voltando atrás da lista abaixo do gráfico de
                rosca): "só precisa colocar esse percentual dentro da
                barra horizontal de cada causa no grafico de 'chamados
                por causa raiz'". */}
            <BarRanking title="Chamados por causa raiz" data={data.byCausaRaiz} onSelect={openDrilldown} showPercent />
          </>
        )}
      </div>

      {/* Ranking próprio, não a mesma barra de "Chamados por produto" lá em
          cima (que soma TODO motivo) -- pedido do Victor 29/08/2026:
          "consegue colocar o ranking de produtos com mais erros de
          fabricação nos kpis da assistencia?". Fica perto de "Quem errou"
          por ser outro recorte da mesma causa raiz, não perto do ranking
          geral de produto. */}
      {data.byProductDefeitoFabricacao.length > 0 ? (
        <BarRanking title="Produtos com mais defeito de fabricação" data={data.byProductDefeitoFabricacao} onSelect={openDrilldown} showPercent />
      ) : null}

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title="Conferente que mais errou" data={data.byConferente} onSelect={openDrilldown} showCount />
        <div className="flex flex-col gap-2">
          <BarRanking title="Motorista que mais errou" data={data.byMotoristaErro} onSelect={openDrilldown} showCount />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Baseado no motorista atual do chamado — se a rota foi reatribuída depois da criação, pode não refletir mais quem entregou o item errado originalmente.
          </p>
        </div>
      </section>

      {ticketsModal ? (
        <AssistenciaTicketsModal
          title={ticketsModal.title}
          totalCount={ticketsModal.totalCount}
          tickets={ticketsModal.tickets}
          onClose={() => setTicketsModal(null)}
        />
      ) : null}
    </div>
  );
}
