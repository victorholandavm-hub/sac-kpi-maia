import Link from "next/link";
import { listStores } from "@/lib/serviceRequests";
import { getGerenteStoreId } from "@/lib/gerentes";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { PublicRequestForm } from "@/components/assistencia/PublicRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SolicitarAssistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; store?: string }>;
}) {
  const { enviado, store } = await searchParams;
  const stores = await listStores();

  const gerenteName = await getLojaGerenteSession();
  const gerenteStoreId = gerenteName ? await getGerenteStoreId(gerenteName) : null;
  const lockedStore = gerenteStoreId ? stores.find((s) => s.id === gerenteStoreId) ?? null : null;

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title="Solicitar assistência"
        subtitle="Montagem, desmontagem, recolhimento de peças ou notificação externa."
      />

      <Link
        href={gerenteName ? "/assistencia/loja" : "/assistencia"}
        className="text-sm underline self-start"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Voltar
      </Link>

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
          <Link
            href={gerenteName ? "/assistencia/loja" : "/assistencia/loja/login"}
            className="text-sm underline self-start mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Ver demanda em aberto
          </Link>
        </div>
      ) : null}

      <PublicRequestForm stores={stores} lockedStore={lockedStore} defaultStoreId={store} />
    </div>
  );
}
