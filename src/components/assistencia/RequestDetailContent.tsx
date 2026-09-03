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
import { LojaApprovalActions } from "./LojaApprovalActions";
import type { RequestPhoto } from "@/lib/servicePhotos";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { RequestHistoryTimeline } from "./RequestHistoryTimeline";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Card branco, borda fina, sombra discreta -- Guia de Componentes Maia
// (Design System, 01/09/2026), mesmo componente local de
// DeliveryRequestDetailContent.tsx. Substitui o padrão antigo (fundo
// var(--surface-1) + borda verde de 2px em toda caixa) usado nessa tela
// inteira -- era a metade que ainda não tinha recebido esse tratamento
// (achado revisando as telas 02/09/2026: mesma rota /assistencia/[id],
// duas linguagens visuais diferentes dependendo do tipo do chamado).
function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-3 ${className}`}>
      {title ? <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3> : null}
      {children}
    </div>
  );
}

// Badge neutro (tipo, filial) -- mesmo de DeliveryRequestDetailContent.tsx.
function NeutralBadge({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
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
    case "printed":
      return "imprimiu o despacho.";
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
    return <p className="text-sm text-gray-400 dark:text-gray-500">Solicitação não encontrada.</p>;
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
      {/* Cabeçalho -- Guia de Componentes Maia (Design System, 01/09/2026):
          título em destaque + badges elegantes (status, tipo, filial),
          botões de utilidade em outline neutro à direita. "Editar e
          salvar alterações" é o único botão sólido (primário), mesma
          convenção de DeliveryRequestDetailContent.tsx. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">Chamado #{request.ticketNumber}</h1>
          <StatusBadge status={request.status} />
          <NeutralBadge>{REQUEST_TYPE_LABELS[request.type] ?? request.type}</NeutralBadge>
          <NeutralBadge icon="🏬">{request.storeName}</NeutralBadge>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/assistencia/${request.id}/editar`}
              className="text-sm font-semibold rounded-lg px-3.5 py-2 text-white shadow-sm transition-all duration-200 hover:brightness-110"
              style={{ background: "#1B5E3C" }}
            >
              Editar e salvar alterações
            </Link>
            <Link
              href={novaNotificacaoHref}
              className="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
            >
              + Criar nova notificação
            </Link>
            {profile.role !== "sac" ? (
              <Link
                href={`/assistencia/pecas/nova?service_request_id=${request.id}`}
                className="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
              >
                Solicitar peça
              </Link>
            ) : null}
            <Link
              href={`/assistencia/${request.id}/despacho`}
              className="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
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
          histórico). 50/50 (não 7fr/3fr como em DeliveryRequestDetailContent)
          porque essa família de chamado carrega bem mais blocos na coluna
          direita (responsável, prazo, aprovação, ações, combo, escalonamento,
          histórico) -- precisa de mais espaço que a versão de entrega.
          Empilha normal (uma coluna só) até "lg", igual sempre foi no
          celular/tablet. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <Card title="Pedido e cliente">
            <div className="grid sm:grid-cols-2 gap-4">
              <Row label="Código do pedido/venda" value={request.orderCode} />
              <Row label="Nº da nota fiscal" value={request.invoiceNumber} />
              <Row label="Vendedor(a)" value={request.sellerName} />
              <Row label="Cliente" value={request.clientName} />
              <Row label="CPF" value={request.clientCpf} />
              <Row label="Telefone" value={request.clientPhone} />
              <Row label="Endereço" value={formatFullAddress(request)} />
              <Row label="Bairro" value={request.clientNeighborhood} />
            </div>
          </Card>

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
            <Card title="Produtos">
              <ul className="flex flex-col gap-1">
                {request.items.map((item) => (
                  <li key={item.id} className="text-sm text-gray-800 dark:text-gray-100">
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
                    {item.partCode ? <span className="text-gray-400 dark:text-gray-500"> · cód. {item.partCode}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Descrição/atendimento + Fotos no mesmo card -- pedido do Victor
              01/09/2026 (mesma mudança já feita em
              DeliveryRequestDetailContent.tsx): junta o que antes era a
              seção "Fotos" solta no fim da página com a descrição do
              chamado, lado a lado, num card só. */}
          <Card title="Atendimento — o que a assistência precisa acompanhar">
            <div className="grid sm:grid-cols-2 gap-4">
              <Row label="Motivo" value={request.reason} />
              {request.causaRaiz ? <Row label="Causa raiz" value={CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz} /> : null}
              {request.causaRaiz === "erro_conferencia" || request.causaRaiz === "sujeira_conferencia" ? (
                <>
                  <Row label="Carga" value={request.causaCarga} />
                  <Row label="Conferente" value={request.causaConferente} />
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
                  urgent={request.urgent}
                  rota={null}
                  rotaExceptionNote={null}
                  showRota={false}
                />
              ) : (
                <Row
                  label="Visita agendada"
                  value={
                    request.scheduledDate
                      ? `${formatDateOnly(request.scheduledDate)}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}${request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}${request.urgent ? " · URGENTE" : ""}`
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

            <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Fotos</h4>
              <PhotoGallery photos={photos} deleteMode={canManage ? "staff" : undefined} />
              {photos.length === 0 ? <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma foto anexada ainda.</p> : null}
              {canManage ? <RequestPhotoUpload requestId={request.id} /> : null}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Responsável pelo atendimento">
            {canManage ? (
              <>
                <AssemblerNameField requestId={request.id} requestType={request.type} value={request.assemblerName} assemblers={assemblers} />
                <MontadorInstructionField requestId={request.id} value={request.montadorInstruction} />
              </>
            ) : (
              <Row label="Nome do montador" value={request.assemblerName ?? "Não definido"} />
            )}
          </Card>

          {canManage ? (
            <DeadlineActions
              requestId={request.id}
              requestedDeadline={request.requestedDeadline}
              deadlineStatus={request.deadlineStatus}
              approvedDeadline={request.approvedDeadline}
            />
          ) : null}

          {/* Pedido do Victor 31/08/2026: "alem do gerente de cada loja, a
              equipe de assistencia e os admins tambem podem aprovar a
              montagem" -- mesmo componente de item por item + foto que o
              gerente usa em /assistencia/loja (LojaApprovalCard), só que
              aqui reaproveitando os itens/fotos que essa tela já carregou
              (sem outra consulta). lojaApproveMontagemConclusion aceita a
              sessão de admin/assistência como alternativa à do gerente. */}
          {canManage && request.status === "aguardando_aprovacao" && (request.type === "montagem" || request.type === "desmontagem") ? (
            <Card title="Aprovar conclusão do montador">
              {request.items.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {request.items.map((item) => {
                    const itemPhotos = photos.filter((p) => p.itemId === item.id);
                    return (
                      <div key={item.id} className="flex flex-col gap-1.5 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {item.quantity > 1 ? `${item.quantity}x ` : ""}
                          {item.product}
                        </span>
                        {itemPhotos.length > 0 ? (
                          <PhotoGallery photos={itemPhotos} />
                        ) : item.completed ? (
                          <span className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                            Sem foto enviada
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Ainda não foi feito pelo montador</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <LojaApprovalActions
                requestId={request.id}
                items={request.items.map((i) => ({ id: i.id, product: i.product, quantity: i.quantity, completed: i.completed }))}
              />
            </Card>
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

          <Card title="Histórico">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
