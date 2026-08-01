import Link from "next/link";
import { RedefinirSenhaForm } from "@/components/assistencia/RedefinirSenhaForm";

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Definir nova senha
            </h1>
          </div>
        </div>

        {token_hash ? (
          <RedefinirSenhaForm tokenHash={token_hash} />
        ) : (
          <p className="text-sm text-center" style={{ color: "var(--status-critical)" }}>
            Link inválido. Peça um novo link de redefinição.
          </p>
        )}

        <Link href="/assistencia/login" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
