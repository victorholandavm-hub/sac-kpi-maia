import { getAssistenciaKpiData } from "@/lib/kpiAssistencia";
import { resolveRange } from "@/lib/dateRange";
import { AppHeader } from "@/components/AppHeader";
import { RangePicker } from "@/components/RangePicker";
import { KpisAssistenciaView } from "@/components/KpisAssistenciaView";

export const revalidate = 60;

// Página própria (fora do painel de KPIs geral) -- pedido do Victor
// 27/08/2026: "preciso que os kpis da assistencia fiquem numa aba
// separada, sozinha" (era a 4ª aba de /kpis por um dia, ver
// Dashboard.tsx). Título "Relatório de Assistência" (rota/arquivo
// continuam kpis-assistencia, só o texto visível mudou -- pedido do
// Victor 27/08/2026). Mesmo padrão de /avaliacoes (RangePicker com
// basePath próprio, AppHeader compartilhado). Dados vêm de
// service_requests -- domínio separado do resto do painel (conversas do
// GHL, ver kpi.ts), ver kpiAssistencia.ts.
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
