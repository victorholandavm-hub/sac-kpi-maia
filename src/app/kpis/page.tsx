import { getKpiData } from "@/lib/kpi";
import { resolveRange } from "@/lib/dateRange";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { listStoreGoogleReviews } from "@/lib/googleReviews";
import { getNpsTrend } from "@/lib/npsTrend";
import { Dashboard } from "@/components/Dashboard";
import { AppHeader } from "@/components/AppHeader";

export const revalidate = 60;

// 26 semanas (~6 meses) -- prazo longo o bastante pra ver tendência de
// verdade, sem carregar o histórico inteiro (aba Avaliações, ver
// AvaliacoesTab dentro de Dashboard.tsx).
const NPS_TREND_WEEKS = 26;

export default async function KpisPage({
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
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <AppHeader />
      </div>
      <Dashboard data={data} range={range} googleReviews={googleReviews} npsTrend={npsTrend} />
    </>
  );
}
