import Link from "next/link";

// Menu de abas do SAC -- as 3 telas são rotas independentes (sac/* e
// encomendas/sac ficam fora do grupo (app) de propósito, ver
// AGENTS.md/plano), então não dá pra usar um layout compartilhado: cada
// página renderiza esse componente informando qual aba é a sua.
const TABS = [
  { key: "solicitacoes", label: "Solicitações", href: "/assistencia/sac" },
  { key: "notificacoes", label: "Notificação de Assistência", href: "/assistencia/sac/notificacoes" },
  { key: "encomendas", label: "Minhas encomendas", href: "/assistencia/encomendas/sac" },
  { key: "montagens", label: "Montagens e serviços", href: "/assistencia/sac/montagens" },
  { key: "cargas", label: "Cargas", href: "/assistencia/sac/cargas" },
  { key: "prazos-produtos", label: "Prazos de produtos", href: "/assistencia/prazos-produtos" },
] as const;

export type SacTabKey = (typeof TABS)[number]["key"];

// Abas por sublinhado (não segmented control) -- Guia de Componentes
// Maia (Design System, 01/09/2026): com 6 abas, um trilho de pílulas
// (bg-gray-100 p-1, ver fila/agenda) ficaria apertado demais; sublinhado
// é o padrão certo pra um conjunto largo assim, só com as cores/
// tipografia atualizadas.
export function SacTabs({ active }: { active: SacTabKey }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`text-sm px-4 py-2.5 font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
              isActive ? "text-gray-800" : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
            style={isActive ? { borderColor: "#1B5E3C" } : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
