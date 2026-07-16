"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Solicitações", href: "/assistencia/fila" },
  { label: "Peças", href: "/assistencia/pecas" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Estoque", href: "/assistencia/estoque" },
];

export function AssistenciaNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, { label: "Admin", href: "/assistencia/admin" }] : TABS;

  return (
    <nav className="flex items-center gap-2">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-sm px-3 py-1.5 rounded-full"
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
