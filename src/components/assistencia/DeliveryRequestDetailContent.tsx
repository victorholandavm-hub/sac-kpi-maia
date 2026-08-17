import Link from "next/link";
import type { Profile } from "@/lib/dal";
import { formatFullAddress, type ServiceRequestDetail, type RequestEvent } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, STATUS_LABELS, SAC_MANAGED_TYPES, REQUEST_STATUS_STEPS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { StatusStepper } from "./StatusStepper";
import { RequestActions } from "./RequestActions";
import { MobileActionSheet } from "./MobileActionSheet";
import { DriverNameField } from "./DriverNameField";
import { ScheduleField } from "./ScheduleField";
import { RequestItemsTable } from "./RequestItemsTable";
import { RealtimeQueueRefresher } from "./RealtimeQueueRefresher";
import { PhotoGallery } from "./PhotoGallery";
import { RequestPhotoUpload } from "./RequestPhotoUpload";
import type { RequestPhoto } from "@/lib/servicePhotos";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { RequestHistoryTimeline } from "./RequestHistoryTimeline";
import { PAYMENTS_CONTROLLER_NAME } from "@/lib/assistenciaLabels";
import { ROTA_LABELS, type Rota } from "@/lib/rotas";

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

function eventAction(event: { eventType: string; fromStatus: string | null; toStatus: string | null }) {
  switch (event.eventType) {
    case "created":
      return "abriu a solicitação.";
    case "assigned":
      return "assumiu a solicitação.";
    case "status_changed": {
      const from = event.fromStatus ? STATUS_LABELS[event.fromStatus] ?? event.fromStatus : "—";
      const to = event.toStatus ? STATUS_LABELS[event.toStatus] ?? event.toStatus : "—";
      return `mudou o status de ${from} para ${to}.`;
    }
    case "note_added":
      return "adicionou uma nota.";
    case "edited":
      return "corrigiu os dados da solicitação.";
    default:
      return "";
  }
}

// Tela de detalhe pra troca de produto, entrega de produto e envio de peça
// (DELIVERY_REQUEST_TYPES) -- separada de RequestDetailContent de propósito
// (pedido do Victor 17/08/2026): antes esses três tipos dividiam o mesmo
// componente com montagem/desmontagem/vistoria a golpe de `isDeliveryType ?
// ... : ...` espalhado pela tela inteira -- cada ajuste novo virava mais um
// `if`, e o resultado juntava campo de montador, stepper de prazo (que não
// existe pra esses tipos, ver comentário removido de lá) e outras coisas
// que não pertencem a essa família. Aqui não tem NADA disso: sem prazo,
// sem montador, sem instrução de montagem, sem combo montagem/desmontagem
// -- só o que troca/entrega/envio de peça realmente usa. Estrutura
// deliberadamente na mesma ordem do despacho impresso (ver despacho/page.tsx):
// cliente, produto, descrição da solicitação, rota/motorista, ações,
// histórico, fotos.
export function DeliveryRequestDetailContent({
  profile,
  result,
  drivers,
  photos,
  nextDatesByRota,
}: {
  profile: Profile;
  result: { request: ServiceRequestDetail; events: RequestEvent[] } | null;
  drivers: string[];
  photos: RequestPhoto[];
  nextDatesByRota: Record<Rota, string[]>;
}) {
  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const { request, events } = result;
  const isSacType = (SAC_MANAGED_TYPES as readonly string[]).includes(request.type);
  const canManage = profile.role === "admin" || (profile.role === "assistencia" && !isSacType) || (profile.role === "sac" && isSacType);

  const causaRaizDetail =
    request.causaRaiz === "erro_conferencia"
      ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.causaConferente ? `Conferente: ${request.causaConferente}` : null]
          .filter(Boolean)
          .join(" · ")
      : request.causaRaiz === "erro_motorista"
        ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.driverName ? `Motorista: ${request.driverName}` : null]
            .filter(Boolean)
            .join(" · ")
        : null;

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher requestId={request.id} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Chamado #{request.ticketNumber}
          </span>
          <StatusBadge status={request.status} />
          {request.type === "troca_produto" ? (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={
                request.exchangeRound > 1
                  ? { background: "var(--status-warning)", color: "#fff" }
                  : { color: "var(--text-secondary)", background: "color-mix(in srgb, var(--text-secondary) 15%, var(--surface-1))" }
              }
            >
              {request.exchangeRound}ª troca
            </span>
          ) : null}
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {REQUEST_TYPE_LABELS[request.type] ?? request.type} · {request.storeName}
          </h2>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/assistencia/${request.id}/editar`}
              className="text-sm font-medium rounded-lg px-3 py-1.5"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              Editar e salvar alterações
            </Link>
            {profile.role !== "sac" ? (
              <Link
                href={`/assistencia/pecas/nova?service_request_id=${request.id}`}
                className="text-sm font-medium rounded-lg border px-3 py-1.5"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Solicitar peça
              </Link>
            ) : null}
            <Link
              href={`/assistencia/${request.id}/despacho`}
              className="text-sm font-medium rounded-lg border px-3 py-1.5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Imprimir despacho
            </Link>
          </div>
        ) : null}
      </div>

      {request.status !== "cancelada" ? (
        <StatusStepper steps={REQUEST_STATUS_STEPS} currentKey={request.status === "remarcar" ? "em_andamento" : request.status} />
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
              Dados do cliente
            </h3>
            <Row label="Código do pedido/venda" value={request.orderCode} />
            <Row label="Nº da nota fiscal" value={request.invoiceNumber} />
            <Row label="Vendedor(a)" value={request.sellerName} />
            <Row label="Cliente" value={request.clientName} />
            <Row label="CPF" value={request.clientCpf} />
            <Row label="Telefone" value={request.clientPhone} />
            <Row label="Endereço" value={formatFullAddress(request)} />
            <Row label="Bairro" value={request.clientNeighborhood} />
          </div>

          {canManage ? (
            <RequestItemsTable
              items={request.items}
              requestId={request.id}
              requestStatus={request.status}
              requestType={request.type}
              canEditValues={profile.fullName === PAYMENTS_CONTROLLER_NAME}
              canEditItems={profile.role === "admin" || profile.role === "assistencia"}
            />
          ) : request.items.length > 0 ? (
            <div
              className="rounded-lg p-4 flex flex-col gap-2"
              style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Produtos
              </span>
              <ul className="flex flex-col gap-1">
                {request.items.map((item) => (
                  <li key={item.id} className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {item.quantity > 1 ? `${item.quantity}x ` : ""}
                    {item.product}
                    {item.partCode ? <span style={{ color: "var(--text-muted)" }}> · cód. {item.partCode}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
              Descrição da solicitação
            </h3>
            <Row label="Autorizado por" value={request.requestedByName} />
            <Row label="Motivo / problema" value={request.reason} />
            <Row label="Quem errou" value={request.causaRaiz ? (CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz) : null} />
            {causaRaizDetail ? <Row label="Detalhe" value={causaRaizDetail} /> : null}
            <Row label="Restrição / observação" value={request.restrictionNote} />
            <Row label="Observações" value={request.notes} />
            {request.type === "troca_produto" ? (
              <Row label="Produto recolhido?" value={request.pickupCompleted ? "Sim" : "Ainda não"} />
            ) : null}
            {request.deliveryRating !== null ? <Row label="Nota do cliente — entrega" value={`${request.deliveryRating}/10`} /> : null}
            {request.resolutionRating !== null ? (
              <Row label="Nota do cliente — resolução do problema" value={`${request.resolutionRating}/10`} />
            ) : null}
            <Row label="Responsável (sistema)" value={request.assignedToName ?? "Sem responsável"} />
            <Row label="Criada em" value={formatDateTimeBr(request.createdAt)} />
            {request.completedAt ? <Row label="Encerrada em" value={formatDateTimeBr(request.completedAt)} /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Rota e motorista
            </h3>
            {canManage ? (
              <ScheduleField
                requestId={request.id}
                scheduledDate={request.scheduledDate}
                scheduledTime={request.scheduledTime}
                shift={request.shift}
                rota={request.rota}
                rotaExceptionNote={request.rotaExceptionNote}
                nextDatesByRota={nextDatesByRota}
                showRota
              />
            ) : (
              <Row
                label="Visita agendada"
                value={
                  request.scheduledDate
                    ? `${request.scheduledDate.split("-").reverse().join("/")}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}${request.rota ? ` · rota ${ROTA_LABELS[request.rota]}` : ""}`
                    : null
                }
              />
            )}
            {canManage ? (
              <DriverNameField requestId={request.id} value={request.driverName} drivers={drivers} />
            ) : (
              <Row label="Nome do motorista" value={request.driverName ?? "Não definido"} />
            )}
          </div>

          {canManage ? (
            <MobileActionSheet>
              <RequestActions
                requestId={request.id}
                requestType={request.type}
                status={request.status}
                isAssignedToMe={request.assignedToId === profile.id}
                hasAssignee={!!request.driverName}
                assigneeLabel="o motorista"
                hideClaim={isSacType}
              />
            </MobileActionSheet>
          ) : null}

          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Histórico
            </h3>
            <RequestHistoryTimeline
              events={events.map((event) => ({
                id: event.id,
                eventType: event.eventType,
                note: event.note,
                createdAt: event.createdAt,
                actorName: event.actorName,
                actionText: eventAction(event),
              }))}
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Fotos
        </h3>
        <PhotoGallery photos={photos} deleteMode={canManage ? "staff" : undefined} />
        {photos.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma foto anexada ainda.
          </p>
        ) : null}
        {canManage ? <RequestPhotoUpload requestId={request.id} /> : null}
      </div>
    </div>
  );
}
