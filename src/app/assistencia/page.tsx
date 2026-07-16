import Link from "next/link";
import { StoreIcon, WrenchIcon } from "@/components/assistencia/RoleIcons";

// Nunca servir isso de cache estático/CDN — sempre gerar fresco a cada request.
export const dynamic = "force-dynamic";

export default function AssistenciaHomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full flex flex-col gap-8 text-center">
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

        <div className="flex flex-col gap-4">
          <Link
            href="/assistencia/loja"
            className="group rounded-xl border p-5 flex items-center gap-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
          >
            <div className="rounded-full p-3 shrink-0" style={{ background: "var(--brand-orange-soft)" }}>
              <StoreIcon color="var(--brand-orange)" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                Gerente de loja
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Solicitar assistência e ver a demanda em aberto
              </span>
            </div>
          </Link>

          <Link
            href="/assistencia/login"
            className="group rounded-xl border p-5 flex items-center gap-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
          >
            <div className="rounded-full p-3 shrink-0" style={{ background: "var(--brand-green-soft)" }}>
              <WrenchIcon color="var(--brand-green)" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                Equipe assistência
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Login individual para gerenciar a fila
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
