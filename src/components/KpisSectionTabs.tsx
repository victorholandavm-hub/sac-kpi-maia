import Link from "next/link";

const TABS = [
  { key: "sac", label: "SAC", href: "/kpis" },
  { key: "assistencia", label: "Assistência", href: "/kpis-assistencia" },
] as const;

export type KpisSectionKey = (typeof TABS)[number]["key"];

// Sub-aba de "KPIs" -- pedido do Victor 27/08/2026: "os kpis da aba de
// entregas/notificação de assistencia precisa ir mesmo lá para o
// sac.lojasmaia.com.br e precisa estar dentro da aba KPIs e dentro dessa
// aba subaba com SAC e outra aba Assistencia". As duas telas são rotas
// independentes (/kpis é sobre conversa do GHL, /kpis-assistencia é
// sobre service_requests -- dado e filtro de período completamente
// diferentes, cada uma com seu próprio RangePicker) -- não dá pra usar
// layout compartilhado (mesmo motivo de SacTabs.tsx/SolicitacoesTabs em
// fila/page.tsx), cada página renderiza isso informando qual aba é a
// sua. Cor laranja (brand-orange) -- mesma paleta do resto do painel de
// KPIs (AppHeader.tsx), não o verde do sistema de assistência.
export function KpisSectionTabs({ active }: { active: KpisSectionKey }) {
  return (
    <div className="flex items-center gap-2">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="text-base font-bold px-4 py-2 rounded-full"
            style={isActive ? { background: "var(--brand-orange)", color: "#fff" } : { border: "2px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
