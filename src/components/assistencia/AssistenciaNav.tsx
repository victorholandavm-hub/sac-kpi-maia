"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Solicitações", href: "/assistencia" },
  { label: "Peças", href: "/assistencia/pecas" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Estoque", href: "/assistencia/estoque" },
];

export function AssistenciaNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {TABS.map((tab) => {
        const active = tab.href === "/assistencia" ? pathname === "/assistencia" : pathname.startsWith(tab.href);
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
