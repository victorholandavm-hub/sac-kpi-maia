import Link from "next/link";
import { redirect } from "next/navigation";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getRequestDetail } from "@/lib/serviceRequests";
import { EditServiceRequestForm } from "@/components/assistencia/EditServiceRequestForm";
import { CancelServiceRequestButton } from "@/components/assistencia/CancelServiceRequestButton";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

export const dynamic = "force-dynamic";

export default async function EditarSolicitacaoLojaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { id } = await params;
  const { salvo } = await searchParams;

  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) {
    redirect("/assistencia/loja/login");
  }

  const result = await getRequestDetail(id);
  if (!result) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Solicitação não encontrada.
        </p>
      </div>
    );
  }

  const { request } = result;
  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  const canEdit = gerenteStoreIds.includes(request.storeId) && request.status === "aberta";

  if (!canEdit) {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Essa solicitação não pode mais ser editada — ou já saiu de &quot;aberta&quot;, ou não é de uma loja sua.
        </p>
        <Link href="/assistencia/loja" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Editar chamado #${request.ticketNumber}`} subtitle={request.storeName} />

        <Link href="/assistencia/loja" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>

        {salvo ? (
          <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
            Alterações salvas.
          </p>
        ) : null}

        <EditServiceRequestForm request={request} />

        <CancelServiceRequestButton requestId={request.id} />
      </div>
    </ToastProvider>
  );
}
