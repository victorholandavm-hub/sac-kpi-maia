"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path
        d="M9 4h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path
        d="M5 9h14M7 4v2M17 4v2M6 6h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path
        d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5ZM4 8l8 4.5M20 8l-8 4.5M12 12.5V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path
        d="M5 12h.01M12 12h.01M19 12h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const PRIMARY_TABS = [
  { label: "Início", href: "/assistencia/inicio", icon: HomeIcon },
  { label: "Fila", href: "/assistencia/fila", icon: ClipboardIcon },
  { label: "Agenda", href: "/assistencia/agenda", icon: CalendarIcon },
  { label: "Peças", href: "/assistencia/pecas", icon: BoxIcon },
];

const MORE_TABS = [
  { label: "Fornecedores", href: "/assistencia/fornecedores" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Estoque", href: "/assistencia/estoque" },
  { label: "Relatórios", href: "/assistencia/relatorios" },
];

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTabs = isAdmin ? [...MORE_TABS, { label: "Admin", href: "/assistencia/admin" }] : MORE_TABS;
  const moreActive = moreTabs.some((t) => pathname.startsWith(t.href));

  return (
    <>
      {moreOpen ? (
        <button
          aria-label="Fechar menu"
          onClick={() => setMoreOpen(false)}
          className="sm:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.3)" }}
        />
      ) : null}

      {moreOpen ? (
        <div
          className="sm:hidden fixed bottom-16 inset-x-4 z-50 rounded-xl border p-2 flex flex-col gap-1 shadow-lg"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          {moreTabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setMoreOpen(false)}
              className="text-sm px-3 py-2.5 rounded-lg"
              style={{
                background: pathname.startsWith(t.href) ? "var(--brand-green-soft)" : "transparent",
                color: pathname.startsWith(t.href) ? "var(--brand-green)" : "var(--text-primary)",
                fontWeight: pathname.startsWith(t.href) ? 600 : 400,
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}

      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
              style={{ color: active ? "var(--brand-green)" : "var(--text-muted)" }}
            >
              <Icon />
              <span className="text-[11px]" style={{ fontWeight: active ? 600 : 400 }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
          style={{ color: moreOpen || moreActive ? "var(--brand-green)" : "var(--text-muted)" }}
        >
          <DotsIcon />
          <span className="text-[11px]" style={{ fontWeight: moreOpen || moreActive ? 600 : 400 }}>
            Mais
          </span>
        </button>
      </nav>

      <Link
        href="/assistencia/nova-rapida"
        aria-label="Nova solicitação"
        className="sm:hidden fixed right-4 bottom-20 z-40 rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        style={{ background: "var(--brand-orange)", color: "#fff" }}
      >
        <PlusIcon />
      </Link>
    </>
  );
}
