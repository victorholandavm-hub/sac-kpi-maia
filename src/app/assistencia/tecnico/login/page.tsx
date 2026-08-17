import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { TecnicoLoginForm } from "@/components/assistencia/TecnicoLoginForm";

export const dynamic = "force-dynamic";

export default async function TecnicoLoginPage() {
  const existingSession = await getTecnicoSession();
  if (existingSession) {
    redirect("/assistencia/tecnico");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Equipe técnica
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Chamados que voltaram com o motorista, com produto pra dar destino.
            </p>
          </div>
        </div>

        <TecnicoLoginForm />

        <Link href="/assistencia" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
