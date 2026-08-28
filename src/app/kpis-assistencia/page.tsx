import { getAssistenciaKpiData } from "@/lib/kpiAssistencia";
import { resolveRange } from "@/lib/dateRange";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { RangePicker } from "@/components/RangePicker";
import { KpisAssistenciaView } from "@/components/KpisAssistenciaView";

export const revalidate = 60;

// Sub-aba "Assistência" de KPIs -- pedido do Victor 27/08/2026: "os kpis
// da aba de entregas/notificação de assistencia precisa ir mesmo lá para
// o sac.lojasmaia.com.br e precisa estar dentro da aba KPIs e dentro
// dessa aba subaba com SAC e outra aba Assistencia" (refinamento de
// "preciso que os kpis da assistencia fiquem numa aba separada,
// sozinha", pedido mais cedo no mesmo dia -- ainda é rota própria, IDs/
// arquivo continuam kpis-assistencia, só a apresentação virou sub-aba de
// KPIs em vez de item solto no menu, ver KpisSectionTabs.tsx/
// AppHeader.tsx). Dados vêm de service_requests -- domínio separado do
// resto do painel (conversas do GHL, ver kpi.ts), ver kpiAssistencia.ts.
export default async function KpisAssistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params, "month");
  const data = await getAssistenciaKpiData(range);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />
      <KpisSectionTabs active="assistencia" />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Relatório de Assistência
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Mesmos chamados da aba Entregas: troca, entrega e recolhimento de produto, envio e recolhimento de peça — não conta montagem, desmontagem, vistoria nem troca de peça (visita de montador).
        </p>
      </div>

      <RangePicker range={range} basePath="/kpis-assistencia" />

      <KpisAssistenciaView data={data} />
    </div>
  );
}
