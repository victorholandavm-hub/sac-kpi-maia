"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Início", href: "/assistencia/inicio" },
  { label: "Solicitações", href: "/assistencia/fila" },
  { label: "Agenda", href: "/assistencia/agenda" },
  { label: "Peças", href: "/assistencia/pecas" },
  { label: "Fornecedores", href: "/assistencia/fornecedores" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Estoque", href: "/assistencia/estoque" },
  { label: "Relatórios", href: "/assistencia/relatorios" },
];

export function AssistenciaNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, { label: "Admin", href: "/assistencia/admin" }] : TABS;

  return (
    <nav className="flex items-center gap-2 overflow-x-auto min-w-0 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-sm px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap"
            style={{
              background: active ? "var(--brand-green)" : "transparent",
              color: active ? "var(--brand-green-ink)" : "var(--text-secondary)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
