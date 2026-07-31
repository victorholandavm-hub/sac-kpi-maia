import Link from "next/link";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { getPedidoDetail } from "@/lib/pedidosEncomenda";
import { PedidoEncomendaStatusBadge } from "@/components/assistencia/PedidoEncomendaStatusBadge";
import { PedidoEncomendaActions } from "@/components/assistencia/PedidoEncomendaActions";
import { PedidoEncomendaTimeline } from "@/components/assistencia/PedidoEncomendaTimeline";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { PedidoPrazoField } from "@/components/assistencia/PedidoPrazoField";
import { listEncomendaPhotos } from "@/lib/pedidoEncomendaPhotos";
import { FormSection } from "@/components/assistencia/FormSection";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export default async function PedidoEncomendaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireEncomendaActor();
  const { id } = await params;
  const result = await getPedidoDetail(id);

  if (!result) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pedido não encontrado.
        </p>
      </div>
    );
  }

  const { pedido, events } = result;
  const photos = await listEncomendaPhotos(pedido.id);

  return (
    <ToastProvider>
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher requestId={pedido.id} table="pedidos_encomenda" eventsTable="pedido_encomenda_events" eventsIdColumn="pedido_id" />

      <Link href="/assistencia/encomendas/fila" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar pra fila
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          Pedido #{pedido.pedidoNumber}
        </span>
        <PedidoEncomendaStatusBadge status={pedido.status} />
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {pedido.storeName}
        </h2>
      </div>

      <FormSection title="Produtos">
        <ul className="flex flex-col gap-1">
          {pedido.items.map((item) => (
            <li key={item.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
              {item.quantidade}x {item.produtoDescricao}
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection title="Detalhes do pedido">
        <div className="grid sm:grid-cols-2 gap-4">
          <Row label="Solicitado por" value={pedido.requestedByName} />
          <Row label="Vendedor" value={pedido.vendedorName} />
          <Row label="Código do cliente" value={pedido.clienteCodigo} />
          <Row label="Criado em" value={new Date(pedido.createdAt).toLocaleString("pt-BR")} />
          <Row label="Carga" value={pedido.carga} />
          <Row label="NF-e" value={pedido.nfE} />
          <Row label="Observações" value={pedido.notes} />
        </div>
      </FormSection>

      <div className="grid sm:grid-cols-2 gap-4">
        <PedidoPrazoField
          pedidoId={pedido.id}
          field="fabrica_cd"
          label="Prazo fábrica → CD"
          value={pedido.prazoFabricaCd}
          canEdit={actor.role === "fabrica" || actor.role === "admin" || actor.role === "assistencia"}
        />
        <PedidoPrazoField
          pedidoId={pedido.id}
          field="cd_loja"
          label="Prazo CD → loja"
          value={pedido.prazoCdLoja}
          canEdit={actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia"}
        />
      </div>

      {photos.length > 0 ? (
        <FormSection title="Cupom fiscal">
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="Cupom fiscal" className="h-32 w-32 object-cover rounded border" style={{ borderColor: "var(--border)" }} />
              </a>
            ))}
          </div>
        </FormSection>
      ) : null}

      <PedidoEncomendaActions
        pedidoId={pedido.id}
        status={pedido.status}
        role={actor.role}
        storeId={pedido.storeId}
        prazoFabricaCd={pedido.prazoFabricaCd}
        prazoCdLoja={pedido.prazoCdLoja}
      />

      <FormSection title="Histórico">
        <PedidoEncomendaTimeline events={events} />
      </FormSection>
    </div>
    </ToastProvider>
  );
}
