"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ABAS = [
  { href: "/assistencia/logistica/expedicao", label: "Expedição" },
  { href: "/assistencia/logistica/cargas", label: "Cargas" },
  { href: "/assistencia/logistica/abastecimento", label: "Pedidos das lojas" },
  { href: "/assistencia/logistica/kardex", label: "Kardex" },
];

export function LogisticaTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const empresa = params.get("empresa");
  const sufixo = empresa ? `?empresa=${encodeURIComponent(empresa)}` : "";
  return (
    <nav className="flex gap-2 flex-wrap" aria-label="Logística">
      {ABAS.map((a) => {
        const ativa = pathname.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href + sufixo}
            aria-current={ativa ? "page" : undefined}
            className="text-sm px-4 py-2 rounded-full border font-semibold"
            style={{
              borderColor: ativa ? "var(--brand-green)" : "var(--border)",
              background: ativa ? "var(--brand-green)" : "var(--surface-1)",
              color: ativa ? "var(--brand-green-ink)" : "var(--text-secondary)",
            }}
          >
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}
