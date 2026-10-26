import { requireDashboardAuth } from "@/lib/dashboardSession";
import { ConsultaPedidoView } from "@/components/ConsultaPedidoView";

export const dynamic = "force-dynamic";

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireDashboardAuth();
  const { q } = await searchParams;
  return <ConsultaPedidoView busca={(q ?? "").trim()} acao="/pedidos" />;
}
