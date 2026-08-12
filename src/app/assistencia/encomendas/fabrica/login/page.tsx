import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";
import { FabricaLoginForm } from "@/components/assistencia/FabricaLoginForm";

export const dynamic = "force-dynamic";

export default async function FabricaLoginPage() {
  const existingSession = await getFabricaSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/fila");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Fábrica — Encomendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Veja os pedidos solicitados e marque o que já entrou em produção.
            </p>
          </div>
        </div>

        <FabricaLoginForm />

        <Link href="/assistencia/encomendas" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
