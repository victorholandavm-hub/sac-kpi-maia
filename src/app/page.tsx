import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireDashboardAuth } from "@/lib/dashboardSession";

export default async function Home() {
  await requireDashboardAuth();
  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <AppHeader />
      {/* 3 lado a lado -- pedido do Victor 18/08/2026: Vendas tinha virado
          aba do cabeçalho mas ficou de fora desses cards grandes da tela
          inicial. Cartões um pouco menores (p-4/text-lg) pra caber os três
          numa linha só; empilha em telas bem estreitas. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        <Link
          href="/kpis"
          className="rounded-xl border p-4 flex flex-col gap-1.5"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            KPIs
          </h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Indicadores de atendimento do SAC.
          </p>
        </Link>
        <Link
          href="/clientes"
          className="rounded-xl border p-4 flex flex-col gap-1.5"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Clientes
          </h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Perfil de compra/relacionamento — ativos, inativos e quem nunca comprou.
          </p>
        </Link>
        <Link
          href="/vendas"
          className="rounded-xl border p-4 flex flex-col gap-1.5"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Vendas
          </h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Curva de venda, ranking e tipo de produto.
          </p>
        </Link>
      </div>
    </div>
  );
}
