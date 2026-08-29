"use client";

import { useState } from "react";
import type { Count } from "@/lib/kpi";
import type { AssistenciaKpiData } from "@/lib/kpiAssistencia";
import type { ReportRowItem } from "@/lib/serviceRequests";
import { StatTile } from "./StatTile";
import { BarRanking } from "./BarRanking";
import { VolumeChart } from "./VolumeChart";
import { CausaRaizDonutChart } from "./CausaRaizDonutChart";
import { AssistenciaTicketsModal } from "./AssistenciaTicketsModal";

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
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total de chamados de assistência" value={data.totalChamados} size="lg" />
        <StatTile label="Produtos distintos com chamado" value={data.distinctProductCount} />
        <StatTile label="Lojas com chamado no período" value={data.byStore.length} />
        <StatTile label="Rotas com chamado no período" value={data.byRota.length} />
      </section>

      <VolumeChart data={data.dailyVolume} title="Volume de chamados de assistência por dia" />

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title={`Chamados por produto (top 20 de ${data.distinctProductCount})`} data={data.byProduct} onSelect={openDrilldown} />
        <BarRanking title="Chamados por grupo de produto" data={data.byProductGroup} onSelect={openDrilldown} />
        <BarRanking title="Chamados por tipo de solicitação" data={data.byType} onSelect={openDrilldown} />
        <BarRanking title="Chamados por rota" data={data.byRota} onSelect={openDrilldown} />
        <BarRanking title="Chamados por loja" data={data.byStore} onSelect={openDrilldown} />
        <BarRanking title="Chamados por atendente" data={data.byAgent} onSelect={openDrilldown} />
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
            <BarRanking title="Chamados por causa raiz" data={data.byCausaRaiz} onSelect={openDrilldown} />
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
        <BarRanking title="Produtos com mais defeito de fabricação" data={data.byProductDefeitoFabricacao} onSelect={openDrilldown} />
      ) : null}

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title="Conferente que mais errou" data={data.byConferente} onSelect={openDrilldown} />
        <div className="flex flex-col gap-2">
          <BarRanking title="Motorista que mais errou" data={data.byMotoristaErro} onSelect={openDrilldown} />
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
