import Link from "next/link";
import { redirect } from "next/navigation";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { CdLoginForm } from "@/components/assistencia/CdLoginForm";

export const dynamic = "force-dynamic";

export default async function CdLoginPage() {
  const existingSession = await getCdSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/fila");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              CD — Encomendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Acompanhe e expeça os pedidos prontos pra saírem do centro de distribuição.
            </p>
          </div>
        </div>

        <CdLoginForm />

        <Link href="/assistencia/encomendas" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
