import Link from "next/link";
import { redirect } from "next/navigation";
import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { listStores } from "@/lib/serviceRequests";
import { CaixaLoginForm } from "@/components/assistencia/CaixaLoginForm";

export const dynamic = "force-dynamic";

export default async function CaixaLoginPage() {
  const existingSession = await getCaixaSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/caixa");
  }

  const stores = await listStores();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Fazer pedido — Encomendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Selecione sua loja e digite o PIN da caixa pra lançar um pedido.
            </p>
          </div>
        </div>

        <CaixaLoginForm stores={stores} />

        <Link href="/assistencia/encomendas" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
