import Link from "next/link";
import { BarChart3, Users, TrendingUp, SquareStar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { requireDashboardAuth } from "@/lib/dashboardSession";

// Redesenho pedido pelo Victor 24/09/2026: seção central mais imponente
// (título + subtítulo) e cards com ícone/hover mais trabalhados -- as abas
// do cabeçalho somem nessa tela (ver AppHeader.tsx), já que esses 4 cards
// fazem a mesma navegação.
const AREAS = [
  {
    href: "/kpis",
    icon: BarChart3,
    color: "var(--brand-orange)",
    title: "KPIs",
    description: "Indicadores de atendimento do SAC e desempenho da assistência técnica.",
  },
  {
    href: "/clientes",
    icon: Users,
    color: "var(--brand-green)",
    title: "Clientes",
    description: "Gestão e perfil de relacionamento de clientes ativos e inativos.",
  },
  {
    href: "/vendas",
    icon: TrendingUp,
    color: "var(--brand-orange)",
    title: "Vendas",
    description: "Análise da curva de vendas, ranking de faturamento e categorias de produtos.",
  },
  {
    href: "/avaliacoes",
    icon: SquareStar,
    color: "var(--brand-green)",
    title: "Avaliações",
    description: "Evolução do NPS do SAC e monitoramento de avaliações do Google por loja.",
  },
];

export default async function Home() {
  await requireDashboardAuth();
  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-10">
      <AppHeader />

      <div className="flex flex-col items-center gap-2 text-center pt-4">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Bem-vindo ao Painel de Controle
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Selecione uma área para gerenciar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
        {AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.href}
              href={area.href}
              className="group rounded-xl bg-white dark:bg-gray-800 border p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              style={{ borderColor: "var(--border)" }}
            >
              <span
                className="rounded-full p-3 w-fit transition-colors duration-200"
                style={{ background: `color-mix(in srgb, ${area.color} 15%, transparent)`, color: area.color }}
              >
                <Icon size={24} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {area.title}
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {area.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
