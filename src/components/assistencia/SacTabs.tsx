import Link from "next/link";

// Menu de abas do SAC -- as 3 telas são rotas independentes (sac/* e
// encomendas/sac ficam fora do grupo (app) de propósito, ver
// AGENTS.md/plano), então não dá pra usar um layout compartilhado: cada
// página renderiza esse componente informando qual aba é a sua.
const TABS = [
  { key: "solicitacoes", label: "Solicitações", href: "/assistencia/sac" },
  { key: "notificacoes", label: "Notificação de Assistência", href: "/assistencia/sac/notificacoes" },
  { key: "encomendas", label: "Minhas encomendas", href: "/assistencia/encomendas/sac" },
  { key: "montagens", label: "Montagens e serviços", href: "/assistencia/sac/montagens" },
  // Consulta de pedido (venda + carga + entrega + status) -- pedido do Victor
  // 26/10/2026: "onde o sac consulta os pedidos?". Mesma tela do painel
  // (/pedidos, ConsultaPedidoView), com o login de cada atendente.
  { key: "pedidos", label: "Consulta de pedido", href: "/assistencia/sac/pedidos" },
  // Pedido do Victor 01/10/2026: "quero que todos os atendentes fossem
  // colocando como feito, diariamente" -- checklist pessoal do atendente
  // (ou matriz de controle, se admin, ver cronograma/page.tsx).
  { key: "cronograma", label: "Cronograma", href: "/assistencia/sac/cronograma" },
  // Inativadas (tiradas de exibição) -- pedido do Victor 28/09/2026. A
  // rota/página continua existindo (não removida do código), só não
  // aparece mais nessa fileira de abas. `hidden: true` em vez de apagar a
  // entrada -- as próprias páginas (cargas/page.tsx, prazos-produtos/
  // page.tsx) ainda se identificam com essas chaves via `active`.
  { key: "cargas", label: "Cargas", href: "/assistencia/sac/cargas", hidden: true },
  { key: "prazos-produtos", label: "Prazos de produtos", href: "/assistencia/prazos-produtos", hidden: true },
  // Só visualização (ver financeiro/page.tsx) -- pedido do Victor
  // 28/09/2026: "a tela de estornos também deve ficar disponível para o
  // sac ver". Concluir/recusar continua exclusivo de financeiro/admin.
  { key: "estornos", label: "Estornos", href: "/assistencia/financeiro" },
] as const;

export type SacTabKey = (typeof TABS)[number]["key"];

// Pílulas (era sublinhado) -- migração pro Design System unificado, pedido
// do Victor 18/10/2026: "elimine a barra laranja horizontal dura do menu
// superior antigo... os botões ativos devem ganhar uma pílula de cor
// sólida". Mesma receita de AssistenciaNav.tsx/LojaTabs.tsx -- com 6 abas
// (contando as `hidden`) continua cabendo numa fileira que rola horizontal,
// só não precisa mais do trilho `border-b` por baixo.
export function SacTabs({ active }: { active: SacTabKey }) {
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto min-w-0 -mx-1 px-1 pb-1">
      {TABS.filter((tab) => !("hidden" in tab && tab.hidden)).map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`text-sm font-medium tracking-wide px-3.5 py-1.5 rounded-full shrink-0 whitespace-nowrap transition-colors duration-200 ${
              isActive ? "" : "bg-[var(--surface-2)] hover:bg-[var(--brand-green-soft)]"
            }`}
            style={{
              background: isActive ? "var(--brand-green)" : undefined,
              color: isActive ? "var(--brand-green-ink)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
