import Link from "next/link";

// Menu de abas da Supervisão (papel "supervisao", só leitura) -- pedido
// do Victor 28/09/2026 (conta da Akyla Thais). As 4 telas moram em rotas
// espalhadas (dentro e fora do grupo (app), como o SacTabs), então cada
// página que ela acessa renderiza isso informando qual aba é a sua.
const TABS = [
  { key: "estornos", label: "Estornos", href: "/assistencia/financeiro" },
  { key: "notificacoes", label: "Notificação de Assistência", href: "/assistencia/sac/notificacoes" },
  { key: "visitas", label: "Visitas", href: "/assistencia/fila" },
  { key: "reclamacoes", label: "Reclamações", href: "/assistencia/reclamacoes" },
] as const;

export type SupervisaoTabKey = (typeof TABS)[number]["key"];

export function SupervisaoTabs({ active }: { active: SupervisaoTabKey }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-600 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`text-sm px-4 py-2.5 font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
              isActive ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
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
