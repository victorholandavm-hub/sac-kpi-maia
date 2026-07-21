import Link from "next/link";
import { StoreIcon, WrenchIcon, HeadsetIcon, HardHatIcon, TruckIcon } from "@/components/assistencia/RoleIcons";

// Nunca servir isso de cache estático/CDN — sempre gerar fresco a cada request.
export const dynamic = "force-dynamic";

function RoleCard({
  href,
  icon,
  iconBg,
  borderColor,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group aspect-square rounded-xl border p-4 flex flex-col items-center justify-center gap-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: `3px solid ${borderColor}` }}
    >
      <div className="rounded-full p-3 shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </span>
      </div>
    </Link>
  );
}

export default function AssistenciaHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-20 w-20 object-contain" />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Assistência — Lojas Maia
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Quem está entrando?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RoleCard
            href="/assistencia/loja/login"
            icon={<StoreIcon color="var(--brand-orange)" />}
            iconBg="var(--brand-orange-soft)"
            borderColor="var(--brand-orange)"
            title="Gerente de loja"
            subtitle="Prazos da sua loja"
          />
          <RoleCard
            href="/assistencia/login"
            icon={<WrenchIcon color="var(--brand-green)" />}
            iconBg="var(--brand-green-soft)"
            borderColor="var(--brand-green)"
            title="Equipe assistência"
            subtitle="Fila e chamados"
          />
          <RoleCard
            href="/assistencia/login"
            icon={<HeadsetIcon color="var(--brand-green)" />}
            iconBg="var(--brand-green-soft)"
            borderColor="var(--brand-green)"
            title="SAC"
            subtitle="Notificação e troca"
          />
          <RoleCard
            href="/assistencia/montador/login"
            icon={<HardHatIcon color="var(--brand-orange)" />}
            iconBg="var(--brand-orange-soft)"
            borderColor="var(--brand-orange)"
            title="Montador"
            subtitle="Meus chamados"
          />
          <RoleCard
            href="/assistencia/motorista/login"
            icon={<TruckIcon color="var(--brand-green)" />}
            iconBg="var(--brand-green-soft)"
            borderColor="var(--brand-green)"
            title="Motorista"
            subtitle="Minhas rotas"
          />
        </div>
      </div>
    </div>
  );
}
