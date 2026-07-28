import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { listAssemblers, listDrivers } from "@/lib/payments";
import {
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  DEADLINE_STATUS_LABELS,
  SHIFT_LABELS,
  SAC_CATEGORY_LABELS,
  SAC_MANAGED_TYPES,
} from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { RequestActions } from "@/components/assistencia/RequestActions";
import { DeadlineActions } from "@/components/assistencia/DeadlineActions";
import { AssemblerNameField } from "@/components/assistencia/AssemblerNameField";
import { ComboMontagemDesmontagemField } from "@/components/assistencia/ComboMontagemDesmontagemField";
import { DriverNameField } from "@/components/assistencia/DriverNameField";
import { ScheduleField } from "@/components/assistencia/ScheduleField";
import { getRotaWeekdayConfig, getNextRotaDates, ROTAS, ROTA_LABELS, type Rota } from "@/lib/rotas";
import { RequestItemsTable } from "@/components/assistencia/RequestItemsTable";
import { SacCategoryField } from "@/components/assistencia/SacCategoryField";
import { LegalDeadlineField } from "@/components/assistencia/LegalDeadlineField";
import { EscalationRiskToggle } from "@/components/assistencia/EscalationRiskToggle";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";
import { PhotoGallery } from "@/components/assistencia/PhotoGallery";
import { RequestPhotoUpload } from "@/components/assistencia/RequestPhotoUpload";
import { listRequestPhotos } from "@/lib/servicePhotos";

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

function formatDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function eventDescription(event: {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string | null;
}) {
  const actor = event.actorName ?? "Alguém";
  switch (event.eventType) {
    case "created":
      return `${actor} abriu a solicitação.`;
    case "assigned":
      return `${actor} assumiu a solicitação.`;
    case "status_changed": {
      const from = event.fromStatus ? STATUS_LABELS[event.fromStatus] ?? event.fromStatus : "—";
      const to = event.toStatus ? STATUS_LABELS[event.toStatus] ?? event.toStatus : "—";
      return `${actor} mudou o status de ${from} para ${to}.`;
    }
    case "note_added":
      return `${actor} adicionou uma nota.`;
    case "deadline_approved":
      return `${actor} aprovou o prazo pedido.`;
    case "deadline_rejected":
      return `${actor} recusou o prazo e propôs outra data.`;
    case "edited":
      return `${actor} corrigiu os dados da solicitação.`;
    default:
      return actor;
  }
}

export default async function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  const result = await getRequestDetail(id);

  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const { request, events } = result;
  const isSacType = (SAC_MANAGED_TYPES as readonly string[]).includes(request.type);
  const canManage =
    profile.role === "admin" ||
    (profile.role === "assistencia" && !isSacType) ||
    (profile.role === "sac" && isSacType);
  // Troca de produto, entrega de produto e envio de peça são todos entregues
  // pelo motorista — só notificação externa (e os tipos da assistência
  // técnica) usam montador.
  const isDeliveryType = request.type === "troca_produto" || request.type === "entrega_produto" || request.type === "envio_peca";
  const assemblers = canManage ? await listAssemblers() : [];
  const drivers = canManage && isDeliveryType ? await listDrivers() : [];
  const photos = await listRequestPhotos(request.id);

  const rotaConfig = canManage ? await getRotaWeekdayConfig() : null;
  const nextDatesByRota = rotaConfig
    ? (Object.fromEntries(ROTAS.map((r) => [r, getNextRotaDates(r, rotaConfig)])) as Record<Rota, string[]>)
    : ({ praia: [], sul: [], centro: [] } as Record<Rota, string[]>);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher requestId={request.id} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Chamado #{request.ticketNumber}
          </span>
          <StatusBadge status={request.status} />
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

      {canManage && request.deadlineStatus === "pendente" ? <DeadlineActions requestId={request.id} /> : null}

      {canManage ? (
        <RequestActions
          requestId={request.id}
          status={request.status}
          isAssignedToMe={request.assignedToId === profile.id}
          hasAssignee={isDeliveryType ? !!request.driverName : !!request.assemblerName}
          assigneeLabel={isDeliveryType ? "o motorista" : "o montador"}
          hideClaim={isSacType}
        />
      ) : null}

      {canManage ? (
        <RequestItemsTable items={request.items} requestId={request.id} requestStatus={request.status} />
      ) : request.items.length > 0 ? (
        <div
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
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
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
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

      <div
        className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide sm:col-span-2" style={{ color: "var(--text-muted)" }}>
          Pedido e cliente
        </h3>
        <Row label="Código do pedido/venda" value={request.orderCode} />
        <Row label="Nº da nota fiscal" value={request.invoiceNumber} />
        <Row label="Vendedor(a)" value={request.sellerName} />
        <Row label="Cliente" value={request.clientName} />
        <Row label="CPF" value={request.clientCpf} />
        <Row label="Telefone" value={request.clientPhone} />
        <Row label="Endereço" value={request.clientAddress} />
        <Row label="Bairro" value={request.clientNeighborhood} />
      </div>

      <div
        className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
        style={{ background: "var(--brand-orange-soft)", borderColor: "var(--brand-orange)", borderLeftWidth: "4px" }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wide sm:col-span-2" style={{ color: "var(--brand-orange)" }}>
          Atendimento — o que a assistência precisa acompanhar
        </h3>
        <Row label="Motivo" value={request.reason} />
        <Row label="Restrição / observação" value={request.restrictionNote} />
        <Row label="Observações" value={request.notes} />
        <Row label="Solicitado por" value={request.requestedByName} />
        <Row label="Responsável (sistema)" value={request.assignedToName ?? "Sem responsável"} />
        {isDeliveryType ? (
          canManage ? (
            <DriverNameField requestId={request.id} value={request.driverName} drivers={drivers} />
          ) : (
            <Row label="Nome do motorista" value={request.driverName ?? "Não definido"} />
          )
        ) : canManage ? (
          <AssemblerNameField requestId={request.id} requestType={request.type} value={request.assemblerName} assemblers={assemblers} />
        ) : (
          <Row label="Nome do montador" value={request.assemblerName ?? "Não definido"} />
        )}
        {(request.type === "montagem" || request.type === "desmontagem") && !canManage ? (
          <Row
            label={request.type === "montagem" ? "Também precisa desmontar o antigo?" : "Também precisa montar o novo?"}
            value={request.comboMontagemDesmontagem ? "Sim" : "Não"}
          />
        ) : null}
        {request.type === "troca_produto" ? (
          <Row label="Produto recolhido?" value={request.pickupCompleted ? "Sim" : "Ainda não"} />
        ) : null}
        {(request.type === "troca_produto" || request.type === "montagem") && request.deliveryRating !== null ? (
          <Row
            label={request.type === "montagem" ? "Nota do cliente — montagem" : "Nota do cliente — entrega"}
            value={`${request.deliveryRating}/10`}
          />
        ) : null}
        {(request.type === "troca_produto" || request.type === "montagem") && request.resolutionRating !== null ? (
          <Row label="Nota do cliente — resolução do problema" value={`${request.resolutionRating}/10`} />
        ) : null}
        {canManage ? (
          <ScheduleField
            requestId={request.id}
            scheduledDate={request.scheduledDate}
            scheduledTime={request.scheduledTime}
            shift={request.shift}
            rota={request.rota}
            rotaExceptionNote={request.rotaExceptionNote}
            nextDatesByRota={nextDatesByRota}
          />
        ) : (
          <Row
            label="Visita agendada"
            value={
              request.scheduledDate
                ? `${formatDateOnly(request.scheduledDate)}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}${request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}${request.rota ? ` · rota ${ROTA_LABELS[request.rota]}` : ""}`
                : null
            }
          />
        )}
        <Row label="Prazo pedido" value={formatDateOnly(request.requestedDeadline)} />
        <Row label="Status do prazo" value={DEADLINE_STATUS_LABELS[request.deadlineStatus]} />
        <Row
          label={request.deadlineStatus === "recusado" ? "Nova data proposta" : "Prazo aprovado"}
          value={formatDateOnly(request.approvedDeadline)}
        />
        {request.type === "notificacao_externa" ? (
          <>
            <Row label="Protocolo" value={request.protocolNumber} />
            {canManage ? (
              <SacCategoryField requestId={request.id} value={request.sacCategory} />
            ) : (
              <Row label="Categoria SAC" value={request.sacCategory ? SAC_CATEGORY_LABELS[request.sacCategory] : null} />
            )}
            {canManage ? (
              <LegalDeadlineField requestId={request.id} legalDeadline={request.legalDeadline} />
            ) : (
              <Row label="Prazo legal" value={formatDateOnly(request.legalDeadline)} />
            )}
          </>
        ) : null}
        <Row label="Criada em" value={new Date(request.createdAt).toLocaleString("pt-BR")} />
        {request.completedAt ? (
          <Row label="Encerrada em" value={new Date(request.completedAt).toLocaleString("pt-BR")} />
        ) : null}
      </div>

      {canManage && (request.type === "montagem" || request.type === "desmontagem") ? (
        <ComboMontagemDesmontagemField requestId={request.id} type={request.type} value={request.comboMontagemDesmontagem} />
      ) : null}

      {canManage && request.type === "notificacao_externa" ? (
        <EscalationRiskToggle requestId={request.id} atRisk={request.escalationRisk} />
      ) : null}

      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Histórico
        </h3>
        {events.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sem eventos registrados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 py-2" style={{ borderTop: "1px solid var(--gridline)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {eventDescription(event)}
                  </span>
                  <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {new Date(event.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {event.note ? (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {event.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
