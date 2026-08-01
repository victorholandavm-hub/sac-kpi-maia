import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEncomendaRequester, canEditPedido } from "@/lib/encomendaRequester";
import { getPedidoDetail } from "@/lib/pedidosEncomenda";
import { EditPedidoEncomendaForm } from "@/components/assistencia/EditPedidoEncomendaForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function EditarPedidoEncomendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { id } = await params;
  const { salvo } = await searchParams;

  const requester = await resolveEncomendaRequester();
  if (!requester) {
    redirect("/assistencia/encomendas");
  }

  const result = await getPedidoDetail(id);
  if (!result) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pedido não encontrado.
        </p>
      </div>
    );
  }

  const { pedido } = result;
  const voltarHref =
    requester.kind === "cd" || requester.kind === "fabrica"
      ? "/assistencia/encomendas/fila"
      : requester.kind === "sac"
        ? "/assistencia/encomendas/sac"
        : "/assistencia/encomendas/caixa";

  if (!canEditPedido(requester, { status: pedido.status, storeId: pedido.storeId, requestedByName: pedido.requestedByName })) {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Esse pedido não pode mais ser editado — ou já saiu de &quot;solicitado&quot;, ou não é seu.
        </p>
        <Link href={voltarHref} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title={`Editar pedido #${pedido.pedidoNumber}`} subtitle={pedido.storeName} />

      <Link href={voltarHref} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>

      {salvo ? (
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Alterações salvas.
        </p>
      ) : null}

      <EditPedidoEncomendaForm pedido={pedido} />
    </div>
  );
}
