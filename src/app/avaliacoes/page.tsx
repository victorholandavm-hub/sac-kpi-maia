import { getKpiData } from "@/lib/kpi";
import { resolveRange } from "@/lib/dateRange";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { listStoreGoogleReviews } from "@/lib/googleReviews";
import { getNpsTrend } from "@/lib/npsTrend";
import { AppHeader } from "@/components/AppHeader";
import { AvaliacoesTabs } from "@/components/AvaliacoesTabs";

export const revalidate = 60;

// 26 semanas (~6 meses) -- prazo longo o bastante pra ver tendência de
// verdade, sem carregar o histórico inteiro.
const NPS_TREND_WEEKS = 26;

// Página própria, fora do painel de KPIs (pedido do Victor 19/08/2026): NPS
// do SAC (mesmo cálculo de Dashboard.tsx, "duplicado" aqui de propósito --
// é o mesmo buildNpsSummary por trás de getKpiData) + avaliações do Google
// por loja, cada fonte na sua aba (ver AvaliacoesTabs.tsx -- pedido do
// Victor 19/08/2026, pra não misturar). "Outros NPS" que o time ainda vai
// passar a coletar (fora do GHL) ficam pra quando tiver fonte de dado
// definida -- por ora só o do SAC e o do Google.
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

      <AvaliacoesTabs
        range={range}
        npsSummary={data.npsSummary}
        npsDetractors={data.npsDetractors}
        npsTrend={npsTrend}
        googleReviews={googleReviews}
      />
    </div>
  );
}
