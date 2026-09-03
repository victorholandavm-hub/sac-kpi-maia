import Link from "next/link";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { getPedidoDetail, PEDIDO_UNDO_WINDOW_MS, type PedidoEncomendaEvent } from "@/lib/pedidosEncomenda";
import { PedidoEncomendaStatusBadge } from "@/components/assistencia/PedidoEncomendaStatusBadge";
import { PedidoEncomendaActions } from "@/components/assistencia/PedidoEncomendaActions";
import { PedidoEncomendaTimeline } from "@/components/assistencia/PedidoEncomendaTimeline";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { PedidoPrazoField } from "@/components/assistencia/PedidoPrazoField";
import { listEncomendaPhotos } from "@/lib/pedidoEncomendaPhotos";
import { FormSection } from "@/components/assistencia/FormSection";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { StatusStepper } from "@/components/assistencia/StatusStepper";
import { PEDIDO_ENCOMENDA_STATUS_STEPS } from "@/lib/assistenciaLabels";
import { prazoUrgencyStyle } from "@/lib/prazoStyle";

export const dynamic = "force-dynamic";

// Só oferece "desfazer" quando a última mudança do pedido ainda é a atual
// (ninguém mexeu depois), foi uma troca de status pura (não carga/NF-e) e
// dentro da janela de tempo -- mesma checagem que o servidor refaz de
// verdade em undoLastPedidoStatusChange, isso aqui só evita mostrar um
// botão que vai dar erro. Função à parte (não direto no componente) porque
// Date.now() é impuro -- mesmo padrão de timeAgo em admin/page.tsx.
function undoTargetFor(
  lastEvent: PedidoEncomendaEvent | null,
  currentStatus: string,
  actorRole: string
): string | null {
  if (!lastEvent || lastEvent.eventType !== "status_changed" || !lastEvent.fromStatus) return null;
  if (lastEvent.toStatus !== currentStatus) return null;
  if (Date.now() - new Date(lastEvent.createdAt).getTime() > PEDIDO_UNDO_WINDOW_MS) return null;
  const isSupervisor = actorRole === "admin" || actorRole === "assistencia";
  if (!isSupervisor && lastEvent.actorRole !== actorRole) return null;
  return lastEvent.fromStatus;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100">{value}</span>
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
        <p className="text-sm text-gray-400 dark:text-gray-500">Pedido não encontrado.</p>
      </div>
    );
  }

  const { pedido, events } = result;
  const photos = await listEncomendaPhotos(pedido.id);
  const externo = pedido.fornecedorTipo === "fabrica_externa";
  const matchesFabrica = actor.role !== "fabrica" || actor.fabricaId == null || actor.fabricaId === pedido.fabricaId;
  const fornecedorLabel = externo ? `Externo: ${pedido.fornecedorExterno}` : pedido.fabricaNome;

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const undoTarget = undoTargetFor(lastEvent, pedido.status, actor.role);

  return (
    <ToastProvider>
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-4 w-full min-w-0">
      <RealtimeQueueRefresher requestId={pedido.id} table="pedidos_encomenda" eventsTable="pedido_encomenda_events" eventsIdColumn="pedido_id" />

      <Link href="/assistencia/encomendas/fila" className="text-sm underline self-start text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        ← Voltar pra fila
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-mono text-gray-400 dark:text-gray-500">Pedido #{pedido.pedidoNumber}</span>
        <PedidoEncomendaStatusBadge status={pedido.status} />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{pedido.storeName}</h2>
      </div>

      {pedido.status !== "cancelado" && pedido.status !== "negado" && pedido.status !== "recebido_cd" ? (
        <StatusStepper steps={PEDIDO_ENCOMENDA_STATUS_STEPS} currentKey={pedido.status} />
      ) : null}

      {pedido.prazoFabricaCd || pedido.prazoCdLoja ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 grid sm:grid-cols-2 gap-4">
          {pedido.prazoFabricaCd ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">Prazo fábrica → CD</span>
              <span className="text-xl" style={prazoUrgencyStyle(pedido.prazoFabricaCd)}>
                🕐 {new Date(`${pedido.prazoFabricaCd}T00:00:00`).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ) : null}
          {pedido.prazoCdLoja ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">Prazo CD → loja</span>
              <span className="text-xl" style={prazoUrgencyStyle(pedido.prazoCdLoja)}>
                🕐 {new Date(`${pedido.prazoCdLoja}T00:00:00`).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2 colunas no desktop -- esquerda é leitura (produtos/detalhes/cupom),
          direita é ação/acompanhamento (status, prazos, histórico). Empilha
          normal (uma coluna só) até "lg". */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <FormSection title="Produtos">
            <ul className="flex flex-col gap-1">
              {pedido.items.map((item) => (
                <li key={item.id} className="text-sm text-gray-800 dark:text-gray-100">
                  {item.quantidade}x {item.produtoDescricao}
                </li>
              ))}
            </ul>
          </FormSection>

          <FormSection title="Detalhes do pedido">
            <div className="grid sm:grid-cols-2 gap-4">
              <Row label="Fornecedor" value={fornecedorLabel} />
              <Row label="Solicitado por" value={pedido.requestedByName} />
              <Row label="Vendedor" value={pedido.vendedorName} />
              <Row label="Código do cliente" value={pedido.clienteCodigo} />
              <Row label="Criado em" value={formatDateTimeBr(pedido.createdAt)} />
              <Row label="Carga" value={pedido.carga} />
              <Row label="NF-e" value={pedido.nfE} />
              <Row label="Observações" value={pedido.notes} />
            </div>
          </FormSection>

          {photos.length > 0 ? (
            <FormSection title="Cupom fiscal">
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="Cupom fiscal" className="h-32 w-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                  </a>
                ))}
              </div>
            </FormSection>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <PedidoEncomendaActions
            pedidoId={pedido.id}
            status={pedido.status}
            role={actor.role}
            storeId={pedido.storeId}
            prazoFabricaCd={pedido.prazoFabricaCd}
            prazoCdLoja={pedido.prazoCdLoja}
            fornecedorTipo={pedido.fornecedorTipo}
            fabricaId={pedido.fabricaId}
            fornecedorExterno={pedido.fornecedorExterno}
            matchesFabrica={matchesFabrica}
            undoTarget={undoTarget}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <PedidoPrazoField
                pedidoId={pedido.id}
                field="fabrica_cd"
                label="Prazo fábrica → CD"
                value={pedido.prazoFabricaCd}
                canEdit={
                  actor.role === "admin" ||
                  actor.role === "assistencia" ||
                  (externo ? actor.role === "cd" : actor.role === "fabrica" && matchesFabrica)
                }
              />
              <PedidoPrazoField
                pedidoId={pedido.id}
                field="cd_loja"
                label="Prazo CD → loja"
                value={pedido.prazoCdLoja}
                canEdit={actor.role === "cd" || actor.role === "admin" || actor.role === "assistencia"}
              />
            </div>
          </PedidoEncomendaActions>

          <FormSection title="Histórico">
            <PedidoEncomendaTimeline events={events} />
          </FormSection>
        </div>
      </div>
    </div>
    </ToastProvider>
  );
}
