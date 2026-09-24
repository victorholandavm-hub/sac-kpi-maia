import Image from "next/image";
import Link from "next/link";
import { Store, Box, Wrench, Headphones, Hammer, Truck, ShieldCheck, DollarSign, UserCheck } from "lucide-react";

// Nunca servir isso de cache estático/CDN — sempre gerar fresco a cada request.
export const dynamic = "force-dynamic";

// Redesenho pedido pelo Victor 24/09/2026: cor de borda única (não mais
// alternando laranja/verde por papel), ícone num círculo sutil, hierarquia
// de texto mais clara, hover suave -- "faça isso localmente primeiro" (pra
// ele revisar antes de estender esse mesmo estilo pras 9 telas de login).
function RoleCard({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border p-5 flex flex-col items-center text-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--brand-green)]"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <span
        className="rounded-full p-3 flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--brand-green)] transition-colors duration-200 [&_svg]:w-6 [&_svg]:h-6"
        style={{ background: "var(--gridline)" }}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </span>
      </div>
    </Link>
  );
}

const ROLES = [
  { href: "/assistencia/loja/login", icon: <Store />, title: "Gerente de loja", subtitle: "Equipe, encomendas e prazos" },
  { href: "/assistencia/encomendas", icon: <Box />, title: "Encomendas", subtitle: "Caixa, CD e fábrica" },
  { href: "/assistencia/login", icon: <Wrench />, title: "Equipe assistência", subtitle: "Fila e chamados" },
  { href: "/assistencia/sac/login", icon: <Headphones />, title: "SAC", subtitle: "Notificação e troca" },
  { href: "/assistencia/montador/login", icon: <Hammer />, title: "Montador", subtitle: "Meus chamados" },
  { href: "/assistencia/motorista/login", icon: <Truck />, title: "Motorista", subtitle: "Minhas rotas" },
  { href: "/assistencia/tecnico/login", icon: <ShieldCheck />, title: "Equipe técnica", subtitle: "Destino do produto" },
  { href: "/assistencia/financeiro/login", icon: <DollarSign />, title: "Financeiro", subtitle: "Solicitações de estorno" },
  { href: "/assistencia/login", icon: <UserCheck />, title: "Admin", subtitle: "E-mail e senha" },
];

export default function AssistenciaHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-20 w-20 object-contain" />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Assistência — Lojas Maia
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Quem está entrando?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {ROLES.map((r) => (
            <RoleCard key={r.title} href={r.href} icon={r.icon} title={r.title} subtitle={r.subtitle} />
          ))}
        </div>
      </div>
    </div>
  );
}
