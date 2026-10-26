"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Users, ShoppingBag, PackageSearch, Star, MessageSquare, Wrench, MessagesSquare, Truck, LogOut, Moon, Sun, BarChart3, ChevronDown } from "lucide-react";
import { signOutDashboard } from "@/app/login/actions";

// Menu lateral de todas as telas do painel (pedido do Victor 17/10/2026:
// "todas as telas com o layout da Logística") -- substitui o AppHeader. No
// celular vira uma faixa rolável no topo.
// kpi: vai dentro do grupo "KPIs" (o resto fica solto no topo).
type ItemMenu = { href: string; rotulo: string; Icone: typeof Home; ativo: (p: string) => boolean; kpi?: boolean };

const ITENS: ItemMenu[] = [
  { href: "/", rotulo: "Início", Icone: Home, ativo: (p) => p === "/" },
  { href: "/clientes", rotulo: "Clientes", Icone: Users, ativo: (p) => p.startsWith("/clientes") },
  // Vendas por produto (veio da assistência em 18/08/2026) ficava só no link
  // direto -- no menu desde 26/10/2026 pro SAC consultar (pedido do Victor).
  { href: "/vendas", rotulo: "Vendas", Icone: ShoppingBag, ativo: (p) => p.startsWith("/vendas") },
  // Consulta de pedido (venda + carga + entrega do cliente) -- 26/10/2026.
  { href: "/pedidos", rotulo: "Pedidos", Icone: PackageSearch, ativo: (p) => p.startsWith("/pedidos") },
  { href: "/avaliacoes", rotulo: "Avaliações", Icone: Star, ativo: (p) => p.startsWith("/avaliacoes") },
  {
    href: "/kpis",
    rotulo: "SAC",
    Icone: MessageSquare,
    ativo: (p) => p === "/kpis" || p.startsWith("/kpis/chamados-do-dia"),
    kpi: true,
  },
  { href: "/kpis-assistencia", rotulo: "Assistência", Icone: Wrench, ativo: (p) => p.startsWith("/kpis-assistencia"), kpi: true },
  { href: "/kpis/ghl", rotulo: "GHL", Icone: MessagesSquare, ativo: (p) => p.startsWith("/kpis/ghl"), kpi: true },
  { href: "/kpis/logistica", rotulo: "Logística", Icone: Truck, ativo: (p) => p.startsWith("/kpis/logistica"), kpi: true },
];

const SOLTOS = ITENS.filter((i) => !i.kpi);
const DO_GRUPO_KPIS = ITENS.filter((i) => i.kpi);

const base = "flex flex-col items-center gap-1 rounded-xl px-2 py-2 min-w-[64px] text-[11px] transition-all duration-200";
const hover = "hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] hover:text-[var(--text-primary)]";

function Item({ item, pathname }: { item: ItemMenu; pathname: string }) {
  const ativo = item.ativo(pathname);
  const { Icone } = item;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={`group ${base} ${ativo ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : `text-[var(--text-muted)] ${hover}`}`}
    >
      <Icone
        aria-hidden
        size={20}
        strokeWidth={1.75}
        className={`transition-transform duration-200 ${ativo ? "text-[var(--brand-green)]" : "group-hover:scale-110"}`}
      />
      <span className={ativo ? "font-semibold" : undefined}>{item.rotulo}</span>
    </Link>
  );
}

// Grupo "KPIs" (pedido do Victor 18/10/2026): SAC, Assistência, GHL e
// Logística ficam dentro de um botão recolhido que abre ao clicar. A escolha
// fica salva neste navegador. Recolhido numa tela de KPI, o botão fica marcado
// pra mostrar onde você está.
const CHAVE_KPIS = "painel:menu-kpis";

function GrupoKpis({ itens, pathname }: { itens: ItemMenu[]; pathname: string }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha salva só existe no navegador
      if (localStorage.getItem(CHAVE_KPIS) === "1") setAberto(true);
    } catch {
      // storage bloqueado: fica recolhido
    }
  }, []);
  function alternar() {
    setAberto((a) => {
      try {
        localStorage.setItem(CHAVE_KPIS, a ? "0" : "1");
      } catch {
        // vale nesta visita
      }
      return !a;
    });
  }
  const dentro = itens.some((i) => i.ativo(pathname));
  const marcado = dentro && !aberto;
  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className={`group ${base} ${marcado ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : `text-[var(--text-muted)] ${hover}`}`}
      >
        <BarChart3
          aria-hidden
          size={20}
          strokeWidth={1.75}
          className={`transition-transform duration-200 ${marcado ? "text-[var(--brand-green)]" : "group-hover:scale-110"}`}
        />
        <span className={`inline-flex items-center gap-0.5 ${marcado ? "font-semibold" : ""}`}>
          KPIs
          <ChevronDown aria-hidden size={12} className={`transition-transform duration-200 ${aberto ? "" : "-rotate-90"}`} />
        </span>
      </button>
      {aberto && (
        <div className="flex flex-col gap-1 rounded-xl py-1" style={{ background: "color-mix(in srgb, var(--text-primary) 4%, transparent)" }}>
          {itens.map((i) => (
            <Item key={i.href} item={i} pathname={pathname} />
          ))}
        </div>
      )}
    </>
  );
}

// Um tema só pro app: classe .dark da <html> + localStorage "theme" (mesmo
// mecanismo do ThemeToggle; o script de layout.tsx aplica antes de pintar).
function BotaoTema() {
  const [escuro, setEscuro] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só sincroniza o ícone com a classe já aplicada
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);
  function alternar() {
    const novo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem("theme", novo ? "dark" : "light");
    } catch {
      // storage bloqueado: a troca vale nesta visita
    }
    setEscuro(novo);
  }
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className={`${base} text-[var(--text-muted)] ${hover}`}
    >
      {escuro ? <Sun aria-hidden size={20} strokeWidth={1.75} /> : <Moon aria-hidden size={20} strokeWidth={1.75} />}
      {escuro ? "Claro" : "Escuro"}
    </button>
  );
}

function Sair() {
  return (
    <form action={signOutDashboard}>
      <button
        type="submit"
        className={`${base} text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] hover:text-[var(--status-critical)]`}
      >
        <LogOut aria-hidden size={20} strokeWidth={1.75} />
        Sair
      </button>
    </form>
  );
}

export function SidebarApp() {
  const pathname = usePathname();
  return (
    <>
      <aside
        className="hidden md:flex sticky top-0 h-screen w-[88px] shrink-0 flex-col items-center gap-2 py-5 border-r"
        style={{ borderColor: "var(--border)", background: "var(--canvas)" }}
      >
        <Link href="/" aria-label="Início">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-10 w-10 object-contain mb-3" />
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Seções">
          {SOLTOS.map((i) => (
            <Item key={i.href} item={i} pathname={pathname} />
          ))}
          <GrupoKpis itens={DO_GRUPO_KPIS} pathname={pathname} />
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <BotaoTema />
          <Sair />
        </div>
      </aside>
      <nav
        className="md:hidden flex items-center gap-1 overflow-x-auto px-3 py-2 border-b"
        style={{ borderColor: "var(--border)", background: "var(--canvas)" }}
        aria-label="Seções"
      >
        <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-8 w-8 object-contain shrink-0 mr-1" />
        {SOLTOS.map((i) => (
          <Item key={i.href} item={i} pathname={pathname} />
        ))}
        <GrupoKpis itens={DO_GRUPO_KPIS} pathname={pathname} />
        <BotaoTema />
        <Sair />
      </nav>
    </>
  );
}
