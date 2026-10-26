import Link from "next/link";

// Sub-abas da aba "Odoo" da assistência -- Victor 26/10/2026: Luis e Iasmyn
// com o mesmo acesso do SAC (consulta de pedido com nota fiscal, estoque das
// lojas/CD com transferência pro AT), tudo numa aba só.
const TABS = [
  { key: "pedidos", label: "Vendas e pedidos", href: "/assistencia/pedidos" },
  { key: "estoque", label: "Estoque", href: "/assistencia/lojas-estoque" },
] as const;

export type OdooTabKey = (typeof TABS)[number]["key"];

export function OdooTabs({ active }: { active: OdooTabKey }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Odoo
      </h2>
      <nav className="flex items-center gap-1 rounded-full p-1" style={{ background: "var(--surface-2)" }}>
        {TABS.map((tab) => {
          const ativa = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="text-sm px-3.5 py-1 rounded-full whitespace-nowrap transition-colors duration-200"
              style={{
                background: ativa ? "var(--surface-1)" : undefined,
                color: ativa ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: ativa ? 600 : 500,
                boxShadow: ativa ? "0 1px 2px rgba(0,0,0,.08)" : undefined,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
