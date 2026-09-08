"use client";

import { useState } from "react";
import type { DateRange } from "@/lib/dateRange";
import type { NpsSummary, NpsDetractor } from "@/lib/kpi";
import type { StoreGoogleReviews } from "@/lib/googleReviews";
import type { NpsWeekPoint } from "@/lib/npsTrend";
import type { NpsDetrator } from "@/lib/npsDetratores";
import { RangePicker } from "./RangePicker";
import { NpsCard, NPS_SCORE_LABELS } from "./NpsCard";
import { BarRanking } from "./BarRanking";
import { NpsTrendChart } from "./NpsTrendChart";
import { GoogleReviewsSection } from "./GoogleReviewsSection";
import { NpsDetratoresTable } from "./NpsDetratoresTable";

// Cada fonte de avaliação tem sua própria aba, sem misturar (pedido do
// Victor 19/08/2026) -- quando entrar uma fonte nova de NPS (fora do GHL,
// ainda sem data definida), é só somar uma entrada aqui + um novo bloco de
// conteúdo abaixo, igual às duas que já existem.
//
// "Detratores" é diferente das outras duas: não é uma fonte própria, é uma
// lista de trabalho cruzando TODAS as fontes de NPS (pedido do Victor
// 08/09/2026) -- por isso não segue o padrão "uma aba por fonte" acima. As
// abas por fase (pós-entrega/montagem/assistência) + uma aba "geral" com só
// as notas ficam pra quando essas fontes estiverem rodando de verdade
// (ainda esperando aprovação de template no WhatsApp) -- combinado com o
// Victor, essa aba de Detratores é a parte que já dá pra ligar agora.
const TABS = [
  { id: "nps-sac", label: "NPS Atendimento (SAC)" },
  { id: "detratores", label: "Detratores" },
  { id: "google", label: "Avaliações Google" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AvaliacoesTabs({
  range,
  npsSummary,
  npsDetractors,
  npsTrend,
  googleReviews,
  npsDetratores,
}: {
  range: DateRange;
  npsSummary: NpsSummary;
  npsDetractors: NpsDetractor[];
  npsTrend: NpsWeekPoint[];
  googleReviews: StoreGoogleReviews[];
  npsDetratores: NpsDetrator[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("nps-sac");

  // Ordem invertida (5 no topo) -- fica mais intuitivo no gráfico de barras
  // horizontal ver "muito satisfeito" em cima.
  const npsDistribution = [...npsSummary.distribution]
    .sort((a, b) => b.score - a.score)
    .map((d) => ({ label: NPS_SCORE_LABELS[d.score], count: d.count }));

  return (
    <div className="flex flex-col gap-6">
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

      {activeTab === "nps-sac" ? (
        <div className="flex flex-col gap-6">
          {/* Filtro de período só se aplica ao NPS (é range-scoped, igual ao
              painel de KPIs) -- avaliações do Google são leitura pontual
              semanal, sem período pra filtrar, por isso fica só nessa aba. */}
          <RangePicker range={range} basePath="/avaliacoes" />
          <NpsCard data={npsSummary} detractors={npsDetractors} />
          <BarRanking
            title="Distribuição das notas (enquete GHL)"
            data={npsDistribution}
            coverage={{ withValue: npsSummary.responseCount, total: npsSummary.eligibleCount, pct: npsSummary.responseRatePct ?? 0 }}
          />
          <NpsTrendChart data={npsTrend} />
        </div>
      ) : null}

      {activeTab === "detratores" ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Todo mundo que deu nota baixa em qualquer NPS (últimos 6 meses) -- atendimento (SAC) e, assim que
            estiverem rodando, pós-montagem e pós-assistência técnica. Registre o motivo depois de ligar e marque
            como recuperado, perdido, em contato ou sem resposta.
          </p>
          <NpsDetratoresTable items={npsDetratores} />
        </div>
      ) : null}

      {activeTab === "google" ? (
        <div className="flex flex-col gap-6">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Puxado manualmente uma vez por semana (o Google não deixa automatizar de forma confiável) -- peça pra
            atualizar quando precisar.
          </p>
          {googleReviews.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma loja com link do Google configurado ainda.
            </p>
          ) : (
            <GoogleReviewsSection stores={googleReviews} />
          )}
        </div>
      ) : null}
    </div>
  );
}
