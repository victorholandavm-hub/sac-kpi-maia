import { getAssistenciaKpiData, getAssistenciaMonthlyEvolution } from "@/lib/kpiAssistencia";
import { resolveRange } from "@/lib/dateRange";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { RangePicker } from "@/components/RangePicker";
import { KpisAssistenciaView } from "@/components/KpisAssistenciaView";
import { MonthlyEvolutionTable } from "@/components/MonthlyEvolutionTable";

// SEM `export const revalidate` aqui -- achado 30/09/2026 (continuação do
// fix em kpiAssistencia.ts): não é só getAssistenciaKpiData que passava
// pelo teto de 2MB do Next.js Data Cache -- o Full Route Cache dessa
// página (habilitado por `revalidate = 60`, mesmo mecanismo de cache por
// trás, ver pm2 logs sac) tentava cachear a página INTEIRA já renderizada
// e batia no mesmo limite, quebrando a página mesmo depois do cache de
// dados virar memória. O cache em memória de getAssistenciaKpiData já dá
// o ganho de performance que essa rota precisava (achado 21/09/2026) --
// não precisa do Full Route Cache por cima disso.
//
// `dynamic`/`fetchCache` force-no-store -- achado 30/09/2026 (2ª rodada):
// o erro (mesmo "Failed to set Next.js data cache... items over 2MB",
// mesmos 2189648 bytes) continuou batendo mesmo depois de tirar TODO
// unstable_cache alcançável por essa rota (kpiAssistencia.ts +
// vendasProduto.ts + serviceRequests.ts, ver memoCache.ts). Causa real:
// o Next.js também tenta cachear automaticamente as respostas de
// fetch() que o supabase-js faz por baixo dos panos, mesmo sem nenhum
// unstable_cache explícito envolvido -- a mensagem de erro usa o nome
// "unstable_cache" pro mecanismo de cache inteiro, não só pra chamadas
// explícitas dessa API. Essas 2 flags desligam esse cache de fetch por
// completo pra essa rota (documentado pelo Next.js pra isso), sem
// depender de nenhuma lib de terceiro cooperar.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
  const [data, monthlyEvolution] = await Promise.all([getAssistenciaKpiData(range), getAssistenciaMonthlyEvolution()]);

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

      <MonthlyEvolutionTable
        rows={monthlyEvolution}
        subtitle="Total de chamados de assistência, total de vendas e o percentual entre os dois, mês a mês."
      />
    </div>
  );
}
