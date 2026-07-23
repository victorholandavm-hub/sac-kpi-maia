import Link from "next/link";
import { redirect } from "next/navigation";
import { getVendedorSession } from "@/app/assistencia/vendedor-actions";
import { VendedorLoginForm } from "@/components/assistencia/VendedorLoginForm";

export const dynamic = "force-dynamic";

export default async function VendedorLoginPage() {
  const existingSession = await getVendedorSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/caixa");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Vendedor — Encomendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Digite seu nome e o seu PIN pra lançar um pedido.
            </p>
          </div>
        </div>

        <VendedorLoginForm />

        <Link href="/assistencia/encomendas" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
