"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Início", href: "/assistencia/inicio" },
  { label: "Solicitações", href: "/assistencia/fila" },
  { label: "Agenda", href: "/assistencia/agenda" },
  { label: "Peças", href: "/assistencia/pecas" },
  { label: "Encomendas", href: "/assistencia/encomendas/fila" },
  { label: "Fornecedores", href: "/assistencia/fornecedores" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Estoque", href: "/assistencia/estoque" },
  { label: "Relatórios", href: "/assistencia/relatorios" },
];

function NavBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className="text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center"
      style={{ background: active ? "var(--brand-green-ink)" : "var(--brand-orange)", color: active ? "var(--brand-green)" : "#fff" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AssistenciaNav({
  isAdmin,
  counts,
}: {
  isAdmin: boolean;
  counts?: { solicitacoes?: number; encomendas?: number };
}) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, { label: "Admin", href: "/assistencia/admin" }] : TABS;

  function badgeCountFor(label: string): number {
    if (label === "Solicitações") return counts?.solicitacoes ?? 0;
    if (label === "Encomendas") return counts?.encomendas ?? 0;
    return 0;
  }

  return (
    <nav className="flex items-center gap-2 overflow-x-auto min-w-0 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-sm px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap flex items-center gap-1.5"
            style={{
              background: active ? "var(--brand-green)" : "transparent",
              color: active ? "var(--brand-green-ink)" : "var(--text-secondary)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {tab.label}
            <NavBadge count={badgeCountFor(tab.label)} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
