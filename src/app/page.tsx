import { getKpiData } from "@/lib/kpi";
import { resolveRange } from "@/lib/dateRange";
import { categoryLabel, storeLabel } from "@/lib/labels";
import { Dashboard } from "@/components/Dashboard";

export const revalidate = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params);
  const data = await getKpiData(range, { categoryLabel, storeLabel });
  return <Dashboard data={data} range={range} />;
}
