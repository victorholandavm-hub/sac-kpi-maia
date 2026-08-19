import { getKpiData } from "@/lib/kpi";
import { resolveRange } from "@/lib/dateRange";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { listStoreGoogleReviews } from "@/lib/googleReviews";
import { getNpsTrend } from "@/lib/npsTrend";
import { AppHeader } from "@/components/AppHeader";
import { RangePicker } from "@/components/RangePicker";
import { NpsCard, NPS_SCORE_LABELS } from "@/components/NpsCard";
import { BarRanking } from "@/components/BarRanking";
import { NpsTrendChart } from "@/components/NpsTrendChart";
import { GoogleReviewsSection } from "@/components/GoogleReviewsSection";

export const revalidate = 60;

// 26 semanas (~6 meses) -- prazo longo o bastante pra ver tendência de
// verdade, sem carregar o histórico inteiro.
const NPS_TREND_WEEKS = 26;

// Aba própria, fora do painel de KPIs (pedido do Victor 19/08/2026): NPS do
// SAC (mesmo cálculo de Dashboard.tsx, "duplicado" aqui de propósito -- é o
// mesmo buildNpsSummary por trás de getKpiData, só que exibido junto com as
// avaliações do Google em vez de dentro de uma aba do painel) + timeline do
// Google por loja. "Outros NPS" que o time ainda vai passar a coletar
// (fora do GHL) ficam pra quando tiver fonte de dado definida -- por ora só
// o do SAC.
export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params);
  const [data, googleReviews, npsTrend] = await Promise.all([
    getKpiData(range, { categoryLabel, storeLabel }),
    listStoreGoogleReviews(),
    getNpsTrend(NPS_TREND_WEEKS),
  ]);

  const npsDistribution = [...data.npsSummary.distribution]
    .sort((a, b) => b.score - a.score)
    .map((d) => ({ label: NPS_SCORE_LABELS[d.score], count: d.count }));

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Avaliações
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          NPS do atendimento (SAC) e avaliações do Google por loja, com a evolução ao longo do tempo.
        </p>
      </div>

      <RangePicker range={range} basePath="/avaliacoes" />

      <NpsCard data={data.npsSummary} detractors={data.npsDetractors} />
      <BarRanking
        title="Distribuição das notas (enquete GHL)"
        data={npsDistribution}
        coverage={{ withValue: data.npsSummary.responseCount, total: data.npsSummary.eligibleCount, pct: data.npsSummary.responseRatePct ?? 0 }}
      />
      <NpsTrendChart data={npsTrend} />

      <h3 className="text-sm font-bold -mb-2" style={{ color: "var(--text-primary)" }}>
        Avaliações do Google por loja
      </h3>
      <p className="text-xs -mt-4" style={{ color: "var(--text-muted)" }}>
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
  );
}
