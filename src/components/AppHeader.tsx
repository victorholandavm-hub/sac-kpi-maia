"use client";
import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutDashboard } from "@/app/login/actions";

const TABS = [
  { key: "home", label: "Início", href: "/" },
  { key: "kpis", label: "KPIs", href: "/kpis" },
  { key: "clientes", label: "Clientes", href: "/clientes" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center gap-4 pb-4 flex-wrap" style={{ borderBottom: "3px solid var(--brand-orange)" }}>
      <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-12 w-12 object-contain shrink-0" />
      <nav className="flex-1 flex items-center gap-2 flex-wrap">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="text-sm px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{
                background: active ? "var(--brand-orange)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOutDashboard}>
        <button type="submit" className="text-sm underline shrink-0" style={{ color: "var(--text-secondary)" }}>
          Sair
        </button>
      </form>
    </header>
  );
}
