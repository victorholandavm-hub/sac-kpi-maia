import Link from "next/link";
import { listStores } from "@/lib/serviceRequests";
import { PublicRequestForm } from "@/components/assistencia/PublicRequestForm";

export default async function SolicitarAssistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;
  const stores = await listStores();

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
          Solicitar assistência — Lojas Maia
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Montagem, desmontagem, recolhimento de peças ou notificação externa.
        </p>
      </div>

      {enviado ? (
        <div
          className="rounded-lg border p-4 flex flex-col gap-1"
          style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
            Solicitação enviada com sucesso!
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            A assistência vai analisar o prazo pedido e dar retorno. Se precisar enviar outra, use o
            formulário abaixo.
          </p>
          <Link href="/assistencia/loja" className="text-sm underline self-start mt-1" style={{ color: "var(--text-secondary)" }}>
            Ver demanda em aberto
          </Link>
        </div>
      ) : null}

      <PublicRequestForm stores={stores} />
    </div>
  );
}
