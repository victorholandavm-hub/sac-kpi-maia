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
] as const;

export type SacTabKey = (typeof TABS)[number]["key"];

export function SacTabs({ active }: { active: SacTabKey }) {
  return (
    <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="text-sm px-4 py-2 font-medium whitespace-nowrap border-b-2 -mb-px"
            style={{
              borderColor: isActive ? "var(--brand-green)" : "transparent",
              color: isActive ? "var(--brand-green)" : "var(--text-secondary)",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
