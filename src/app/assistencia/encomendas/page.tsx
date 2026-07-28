import Link from "next/link";
import { BoxIcon, HardHatIcon, TruckIcon } from "@/components/assistencia/RoleIcons";

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
      className="group w-36 h-36 sm:w-40 sm:h-40 rounded-xl border p-4 flex flex-col items-center justify-center gap-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
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

export default function EncomendasHubPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-20 w-20 object-contain" />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Encomendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Pedido de produto: loja pede, fábrica produz, CD expede. Quem está entrando?
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <RoleCard
            href="/assistencia/encomendas/caixa/login"
            icon={<BoxIcon color="var(--brand-orange)" />}
            iconBg="var(--brand-orange-soft)"
            borderColor="var(--brand-orange)"
            title="Fazer pedido"
            subtitle="Caixa da loja"
          />
          <RoleCard
            href="/assistencia/encomendas/fabrica/login"
            icon={<HardHatIcon color="var(--brand-green)" />}
            iconBg="var(--brand-green-soft)"
            borderColor="var(--brand-green)"
            title="Fábrica"
            subtitle="Produção"
          />
          <RoleCard
            href="/assistencia/encomendas/cd/login"
            icon={<TruckIcon color="var(--brand-green)" />}
            iconBg="var(--brand-green-soft)"
            borderColor="var(--brand-green)"
            title="CD"
            subtitle="Expedição"
          />
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Gerente de loja: use seu login de sempre em{" "}
          <Link href="/assistencia/loja/login" className="underline">
            /assistencia/loja
          </Link>{" "}
          — não precisa de PIN novo.
        </p>

        <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
