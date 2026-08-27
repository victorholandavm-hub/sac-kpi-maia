import { getKpiData } from "@/lib/kpi";
import { resolveRange } from "@/lib/dateRange";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { Dashboard } from "@/components/Dashboard";
import { AppHeader } from "@/components/AppHeader";

export const revalidate = 60;

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  // Default "este mês" pedido do Victor 20/08/2026 -- só aqui (o painel de
  // avaliações, que reaproveita o mesmo resolveRange, continua com "all").
  const range = resolveRange(params, "month");
  const data = await getKpiData(range, { categoryLabel, storeLabel });
  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <AppHeader />
      </div>
      <Dashboard data={data} range={range} />
    </>
  );
}
