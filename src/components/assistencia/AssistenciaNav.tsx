"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Agenda saiu daqui 27/08/2026 (pedido do Victor: "coloque agenda dentro
// de solicitações ao lado de visitas/entregas") -- vive dentro da própria
// tela de Solicitações agora (fila/page.tsx), não é mais aba própria.
// Peças/Fornecedores/Estoque, mesmo pedido ("coloque dessa mesma forma
// em outra aba peças/fornecedores/estoque e nomeie essa aba como
// controle assistencia"): as 3 continuam rotas próprias, só a ENTRADA no
// menu de cima virou uma só -- `matches` cobre as 3 pra essa aba
// continuar "ativa" (destacada) em qualquer uma delas, não só na 1ª.
const TABS = [
  { label: "Início", href: "/assistencia/inicio" },
  { label: "Solicitações", href: "/assistencia/fila", matches: ["/assistencia/fila", "/assistencia/agenda"] },
  { label: "Controle Assistência", href: "/assistencia/pecas", matches: ["/assistencia/pecas", "/assistencia/fornecedores", "/assistencia/estoque"] },
  { label: "Encomendas", href: "/assistencia/encomendas/fila" },
  { label: "Pagamentos", href: "/assistencia/pagamentos" },
  { label: "Prazos de produtos", href: "/assistencia/prazos-produtos" },
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
  counts,
}: {
  counts?: { solicitacoes?: number; encomendas?: number };
}) {
  const pathname = usePathname();
  // "Vendas" (curva de venda por produto + ranking) saiu daqui 18/08/2026 --
  // pedido do Victor: agora mora no painel de KPIs (/vendas, fora do sistema
  // de assistência), ao lado de KPIs e Clientes.
  // "Admin" NÃO entra mais aqui -- virou link fixo no cabeçalho (ver
  // layout.tsx), porque ficava perdido no fim de uma fileira que rola sem
  // indicação visual nenhuma de que tem mais coisa pra ver.
  const tabs = TABS;

  function badgeCountFor(label: string): number {
    if (label === "Solicitações") return counts?.solicitacoes ?? 0;
    if (label === "Encomendas") return counts?.encomendas ?? 0;
    return 0;
  }

  return (
    // Scrollbar visível de propósito (era escondida, `scrollbarWidth: "none"`)
    // -- sem nenhum sinal visual, "tem mais aba rolando pra direita" ficava
    // invisível, e a última aba (era "Admin") quase nunca era vista.
    <nav className="flex items-center gap-2 overflow-x-auto min-w-0 -mx-1 px-1 pb-1">
      {tabs.map((tab) => {
        const active = (tab.matches ?? [tab.href]).some((path) => pathname.startsWith(path));
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
