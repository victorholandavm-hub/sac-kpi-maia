import Link from "next/link";
import { redirect } from "next/navigation";
import { listStores } from "@/lib/serviceRequests";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { listOwnStoreAssemblers } from "@/lib/payments";
import { PublicRequestForm } from "@/components/assistencia/PublicRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SolicitarAssistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; chamado?: string }>;
}) {
  const { enviado, chamado } = await searchParams;

  // Só gerente autenticado pode solicitar — sem isso qualquer visitante do
  // link público conseguia abrir chamado em nome de qualquer loja.
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) {
    redirect("/assistencia/loja/login");
  }

  const [stores, gerenteStoreIds] = await Promise.all([listStores(), getGerenteStoreIds(gerenteName)]);
  const restrictedStores = stores.filter((s) => gerenteStoreIds.includes(s.id));

  // Montador da própria loja (Mamanguape, Campina Grande...) só faz sentido
  // de mostrar aqui quando a loja já vem fixa no formulário (gerente de uma
  // loja só) -- com várias lojas pra escolher, ainda não dá pra saber qual
  // lista de montador mostrar antes de a loja ser selecionada no cliente.
  const ownAssemblers = restrictedStores.length === 1 ? await listOwnStoreAssemblers(restrictedStores[0].id) : [];

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title="Solicitar assistência"
        subtitle="Montagem ou desmontagem."
      />

      <Link href="/assistencia/loja" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>

      {enviado ? (
        <div
          className="rounded-lg border p-4 flex flex-col gap-1"
          style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
            Solicitação enviada com sucesso!{chamado ? ` Chamado #${chamado}.` : ""}
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

      <PublicRequestForm stores={restrictedStores} requesterName={gerenteName} ownAssemblers={ownAssemblers} />
    </div>
  );
}
