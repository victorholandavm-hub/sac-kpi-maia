import { UnderlineTab } from "./UnderlineTab";

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
// sua. Estilo de aba sublinhada 14/09/2026 (3ª rodada do mesmo pedido,
// ver UnderlineTab.tsx pro racional completo) -- saiu do laranja
// próprio (ver git blame) pro mesmo verde/branco usado nas outras abas
// desse estilo no resto do app.
export function KpisSectionTabs({ active }: { active: KpisSectionKey }) {
  return (
    <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
      {TABS.map((tab) => (
        <UnderlineTab key={tab.key} href={tab.href} label={tab.label} active={tab.key === active} />
      ))}
    </div>
  );
}
