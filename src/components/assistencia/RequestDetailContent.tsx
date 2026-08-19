import Link from "next/link";
import type { Profile } from "@/lib/dal";
import { formatFullAddress, type ServiceRequestDetail, type RequestEvent } from "@/lib/serviceRequests";
import {
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  DEADLINE_STATUS_LABELS,
  SHIFT_LABELS,
  SAC_CATEGORY_LABELS,
  SAC_MANAGED_TYPES,
  PAYMENTS_CONTROLLER_NAME,
  REQUEST_STATUS_STEPS,
  CAUSA_RAIZ_LABELS,
} from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { StatusStepper } from "./StatusStepper";
import { RequestActions } from "./RequestActions";
import { MobileActionSheet } from "./MobileActionSheet";
import { DeadlineActions } from "./DeadlineActions";
import { AssemblerNameField } from "./AssemblerNameField";
import { MontadorInstructionField } from "./MontadorInstructionField";
import { ComboMontagemDesmontagemField } from "./ComboMontagemDesmontagemField";
import { ScheduleField } from "./ScheduleField";
import { RequestItemsTable } from "./RequestItemsTable";
import { SacCategoryField } from "./SacCategoryField";
import { LegalDeadlineField } from "./LegalDeadlineField";
import { EscalationRiskToggle } from "./EscalationRiskToggle";
import { RealtimeQueueRefresher } from "./RealtimeQueueRefresher";
import { PhotoGallery } from "./PhotoGallery";
import { RequestPhotoUpload } from "./RequestPhotoUpload";
import type { RequestPhoto } from "@/lib/servicePhotos";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { RequestHistoryTimeline } from "./RequestHistoryTimeline";

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

// Só a ação, sem o nome do autor -- o nome fica em negrito, separado, na
// renderização (ver Histórico), não amassado dentro da frase.
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
    case "deadline_approved":
      return "aprovou o prazo pedido.";
    case "deadline_rejected":
      return "recusou o prazo e propôs outra data.";
    case "edited":
      return "corrigiu os dados da solicitação.";
    default:
      return "";
  }
}

// Tela de detalhe pra montagem/desmontagem/recolhimento/troca de peça/
// vistoria/notificação externa -- visitas de montador (+ notificação, que
// não tem motorista nem montador, só prazo legal/protocolo). Troca de
// produto, entrega de produto e envio de peça (DELIVERY_REQUEST_TYPES) têm
// componente próprio (ver DeliveryRequestDetailContent.tsx) desde
// 17/08/2026 -- antes dividiam esse arquivo aqui a golpe de `isDeliveryType
// ? ... : ...` espalhado pela tela inteira, cada vez mais difícil de mexer
// sem quebrar a outra família sem querer. [id]/page.tsx decide qual dos
// dois renderizar pelo tipo do chamado.
export function RequestDetailContent({
  profile,
  result,
  assemblers,
  photos,
}: {
  profile: Profile;
  result: { request: ServiceRequestDetail; events: RequestEvent[] } | null;
  assemblers: string[];
  photos: RequestPhoto[];
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
  const canManage =
    profile.role === "admin" ||
    (profile.role === "assistencia" && !isSacType) ||
    (profile.role === "sac" && isSacType);
  // Atalho pra criar a próxima sem precisar navegar de volta -- pedido do
  // Victor 19/08/2026: "deixe disponível um botão 'criar nova notificação'
  // assim que for criado uma notificação". Só notificação externa é SAC
  // aqui (o resto -- montagem/desmontagem/troca de peça/vistoria -- é
  // sempre visita de montador, formulário próprio).
  const novaNotificacaoHref = isSacType ? "/assistencia/sac/nova" : "/assistencia/nova-rapida";

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
              href={novaNotificacaoHref}
              className="text-sm font-medium rounded-lg px-3 py-1.5"
              style={{ background: "var(--brand-orange)", color: "#fff" }}
            >
              + Criar nova notificação
            </Link>
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

      {/* 2 colunas no desktop -- esquerda é leitura (cliente/pedido/produtos/
          detalhes), direita é ação/acompanhamento (responsável, prazo, ações,
          histórico). Empilha normal (uma coluna só) até "lg", igual sempre
          foi no celular/tablet. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
              Pedido e cliente
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
                    {item.completed ? (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded mr-1.5"
                        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-good) 35%, var(--surface-1))" }}
                      >
                        ✓ Feito
                      </span>
                    ) : null}
                    {item.action ? (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded mr-1.5"
                        style={{
                          color: item.action === "montar" ? "var(--brand-green-ink)" : "var(--text-primary)",
                          background:
                            item.action === "montar" ? "var(--brand-green)" : "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))",
                        }}
                      >
                        {item.action === "montar" ? "Montar" : "Desmontar"}
                      </span>
                    ) : null}
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
              Atendimento — o que a assistência precisa acompanhar
            </h3>
            <Row label="Motivo" value={request.reason} />
            {request.causaRaiz ? <Row label="Causa raiz" value={CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz} /> : null}
            {request.causaRaiz === "erro_conferencia" ? (
              <>
                <Row label="Carga (erro de conferência)" value={request.causaCarga} />
                <Row label="Conferente (erro de conferência)" value={request.causaConferente} />
              </>
            ) : null}
            {request.causaRaiz === "erro_motorista" ? <Row label="Carga (erro do motorista)" value={request.causaCarga} /> : null}
            <Row label="Restrição / observação" value={request.restrictionNote} />
            <Row label="Observações" value={request.notes} />
            <Row label="Solicitado por" value={request.requestedByName} />
            <Row label="Responsável (sistema)" value={request.assignedToName ?? "Sem responsável"} />
            {(request.type === "montagem" || request.type === "desmontagem") && !canManage ? (
              <Row
                label={request.type === "montagem" ? "Também precisa desmontar o antigo?" : "Também precisa montar o novo?"}
                value={request.comboMontagemDesmontagem ? "Sim" : "Não"}
              />
            ) : null}
            {request.type === "montagem" && request.deliveryRating !== null ? (
              <Row label="Nota do cliente — montagem" value={`${request.deliveryRating}/10`} />
            ) : null}
            {request.type === "montagem" && request.resolutionRating !== null ? (
              <Row label="Nota do cliente — resolução do problema" value={`${request.resolutionRating}/10`} />
            ) : null}
            {canManage ? (
              <ScheduleField
                requestId={request.id}
                scheduledDate={request.scheduledDate}
                scheduledTime={request.scheduledTime}
                shift={request.shift}
                rota={null}
                rotaExceptionNote={null}
                showRota={false}
              />
            ) : (
              <Row
                label="Visita agendada"
                value={
                  request.scheduledDate
                    ? `${formatDateOnly(request.scheduledDate)}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}${request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}`
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
            <Row label="Criada em" value={formatDateTimeBr(request.createdAt)} />
            {request.completedAt ? <Row label="Encerrada em" value={formatDateTimeBr(request.completedAt)} /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg p-4 flex flex-col gap-2"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Responsável pelo atendimento
            </h3>
            {canManage ? (
              <>
                <AssemblerNameField requestId={request.id} requestType={request.type} value={request.assemblerName} assemblers={assemblers} />
                <MontadorInstructionField requestId={request.id} value={request.montadorInstruction} />
              </>
            ) : (
              <Row label="Nome do montador" value={request.assemblerName ?? "Não definido"} />
            )}
          </div>

          {canManage ? (
            <DeadlineActions
              requestId={request.id}
              requestedDeadline={request.requestedDeadline}
              deadlineStatus={request.deadlineStatus}
              approvedDeadline={request.approvedDeadline}
            />
          ) : null}

          {canManage ? (
            <MobileActionSheet>
              <RequestActions
                requestId={request.id}
                requestType={request.type}
                status={request.status}
                isAssignedToMe={request.assignedToId === profile.id}
                hasAssignee={!!request.assemblerName}
                assigneeLabel="o montador"
                hideClaim={isSacType}
              />
            </MobileActionSheet>
          ) : null}

          {canManage && (request.type === "montagem" || request.type === "desmontagem") ? (
            <ComboMontagemDesmontagemField requestId={request.id} type={request.type} value={request.comboMontagemDesmontagem} />
          ) : null}

          {canManage && request.type === "notificacao_externa" ? (
            <EscalationRiskToggle requestId={request.id} atRisk={request.escalationRisk} />
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
