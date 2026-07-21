import Link from "next/link";
import { redirect } from "next/navigation";
import { getDriverSession } from "@/app/assistencia/driver-actions";
import { MotoristaLoginForm } from "@/components/assistencia/MotoristaLoginForm";

export const dynamic = "force-dynamic";

export default async function MotoristaLoginPage() {
  const existingSession = await getDriverSession();
  if (existingSession) {
    redirect("/assistencia/motorista");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Área do motorista
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Veja suas rotas de troca de produto e recolhimento.
            </p>
          </div>
        </div>

        <MotoristaLoginForm />

        <Link href="/assistencia" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
