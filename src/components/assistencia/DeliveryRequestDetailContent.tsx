import Link from "next/link";
import type { Profile } from "@/lib/dal";
import { formatFullAddress, type ServiceRequestDetail, type RequestEvent } from "@/lib/serviceRequests";
import {
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
  SAC_MANAGED_TYPES,
  SAC_ALSO_MANAGED_TYPES,
  ASSISTENCIA_MANAGED_TYPES,
  ASSISTENCIA_ALSO_MANAGED_TYPES,
  CAUSA_RAIZ_LABELS,
} from "@/lib/assistenciaLabels";
import { DeliveryStatusBadge, isDeliveryScheduled } from "./DeliveryStatusBadge";
import { StatusStepper } from "./StatusStepper";
import { DeliveryRequestActions } from "./DeliveryRequestActions";
import { MobileActionSheet } from "./MobileActionSheet";
import { ScheduleField, RotaBadge } from "./ScheduleField";
import { DeliveryItemsTable } from "./DeliveryItemsTable";
import { RealtimeQueueRefresher } from "./RealtimeQueueRefresher";
import { PhotoGallery } from "./PhotoGallery";
import { RequestPhotoUpload } from "./RequestPhotoUpload";
import type { RequestPhoto } from "@/lib/servicePhotos";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { RequestHistoryTimeline } from "./RequestHistoryTimeline";

// Substitui REQUEST_STATUS_STEPS (aberta/em_contato/em_andamento/concluída,
// vocabulário de visita de montagem) só nessa tela -- ver DeliveryStatusBadge.tsx.
const DELIVERY_STATUS_STEPS = [
  { key: "programado", label: "Programado" },
  { key: "concluida", label: "Concluída" },
];

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
    case "printed":
      return "imprimiu o despacho.";
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
  photos,
}: {
  profile: Profile;
  result: { request: ServiceRequestDetail; events: RequestEvent[] } | null;
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
  // SAC_ALSO_MANAGED_TYPES/ASSISTENCIA_ALSO_MANAGED_TYPES -- pedido do
  // Victor 27/08/2026 (duas rodadas: primeiro "quero que o SAC também
  // gerencie [Envio/Recolhimento de peça]", depois testou como Iasmyn em
  // "Entrega de produto" e travou -- "os 3 tipos do SAC também" pra
  // assistência). Checa cada papel contra a PRÓPRIA lista (mesmo padrão
  // de requireManageAccess) em vez de inferir a elegibilidade de um a
  // partir de "não é do outro" -- com tipos agora nos dois grupos,
  // `!isSacType` já não bastava.
  const canManage =
    profile.role === "admin" ||
    (profile.role === "assistencia" &&
      ((ASSISTENCIA_MANAGED_TYPES as readonly string[]).includes(request.type) ||
        (ASSISTENCIA_ALSO_MANAGED_TYPES as readonly string[]).includes(request.type))) ||
    (profile.role === "sac" && (isSacType || (SAC_ALSO_MANAGED_TYPES as readonly string[]).includes(request.type)));
  // Onde o motorista da rota é escolhido de verdade -- pedido do Victor
  // 18/08/2026: motorista não edita mais aqui, só no painel "Motorista do
  // dia" (RotaMotoristaDoDia), que existe em dois lugares. Baseado no
  // papel de QUEM TÁ VENDO (profile.role), não mais no tipo do chamado
  // (isSacType) -- achado do Victor 27/08/2026: assistência gerenciando
  // "Entrega de produto" (isSacType=true) caía em "/assistencia/sac/nova"/
  // "/assistencia/sac/notificacoes", que redirecionam embora quem não é
  // SAC/admin (dal.ts/sac/nova/page.tsx) -- mesmo dead-end na direção
  // contrária pro SAC em Envio/Recolhimento de peça. As duas filas (SAC
  // e assistência) já mostram os 5 tipos de entrega por padrão, sem
  // filtro de origem -- sempre manda pra fila do PRÓPRIO papel.
  const motoristaDoDiaHref = profile.role === "sac" ? "/assistencia/sac/notificacoes" : "/assistencia/fila?tab=pecas";
  // Atalho pra criar a próxima sem precisar navegar de volta -- pedido do
  // Victor 19/08/2026: "deixe disponível um botão 'criar nova notificação'
  // assim que for criado uma notificação" (fica logo aqui, na tela de
  // detalhe onde a criação já redireciona depois de salvar).
  const novaNotificacaoHref = profile.role === "sac" ? "/assistencia/sac/nova" : "/assistencia/nova-entrega";

  const causaRaizDetail =
    request.causaRaiz === "erro_conferencia"
      ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.causaConferente ? `Conferente: ${request.causaConferente}` : null]
          .filter(Boolean)
          .join(" · ")
      : request.causaRaiz === "erro_motorista"
        ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.driverName ? `Motorista: ${request.driverName}` : null]
            .filter(Boolean)
            .join(" · ")
        : request.causaRaiz === "outro"
          ? request.causaRaizDetalhe
          : null;

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher requestId={request.id} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Chamado #{request.ticketNumber}
          </span>
          <DeliveryStatusBadge status={request.status} scheduledDate={request.scheduledDate} rota={request.rota} />
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

      {request.parentExchange || request.childExchange ? (
        <div className="flex items-center gap-3 flex-wrap text-sm" style={{ color: "var(--text-secondary)" }}>
          {request.parentExchange ? (
            <Link href={`/assistencia/${request.parentExchange.id}`} className="underline" style={{ color: "var(--brand-green)" }}>
              ↩ Troca anterior: #{request.parentExchange.ticketNumber} ({STATUS_LABELS[request.parentExchange.status] ?? request.parentExchange.status})
            </Link>
          ) : null}
          {request.childExchange ? (
            <Link href={`/assistencia/${request.childExchange.id}`} className="underline" style={{ color: "var(--brand-green)" }}>
              → Gerou nova troca: #{request.childExchange.ticketNumber} ({STATUS_LABELS[request.childExchange.status] ?? request.childExchange.status})
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Só Programado/Concluído aqui -- pedido do Victor 19/08/2026: "não faz
          muito sentido ter os mesmos status de montagem, precisa apenas
          saber se já está programado e concluído". Nenhum passo aceso
          ainda quando não tem rota+data (ver isDeliveryScheduled) --
          currentKey some não bate com nenhum step, então os dois ficam
          cinza (equivalente a "ainda não começou"). */}
      {request.status !== "cancelada" ? (
        <StatusStepper
          steps={DELIVERY_STATUS_STEPS}
          currentKey={
            request.status === "concluida" ? "concluida" : isDeliveryScheduled(request.scheduledDate, request.rota) ? "programado" : ""
          }
        />
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

          <DeliveryItemsTable items={request.items} requestId={request.id} canEditItems={canManage} requestType={request.type} />

          <div
            className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
              Descrição da solicitação
            </h3>
            <Row label="Autorizado por" value={request.authorizedBy} />
            <Row label="Motivo / problema" value={request.reason} />
            <Row label="Quem errou" value={request.causaRaiz ? (CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz) : null} />
            {causaRaizDetail ? <Row label="Detalhe" value={causaRaizDetail} /> : null}
            <Row label="Restrição / observação" value={request.restrictionNote} />
            <Row label="Restrição de horário do cliente" value={request.clientTimeRestriction} />
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
                urgent={request.urgent}
                rota={request.rota}
                rotaExceptionNote={request.rotaExceptionNote}
                showRota
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Visita agendada
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <RotaBadge rota={request.rota} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {request.scheduledDate
                      ? `${request.scheduledDate.split("-").reverse().join("/")}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}`
                      : "Não agendada"}
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Motorista
              </span>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {request.driverName ?? "Nenhum motorista escolhido ainda"}
              </span>
              {canManage ? (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Vem da rota do dia -- pra trocar, use o painel{" "}
                  <Link href={motoristaDoDiaHref} className="underline">
                    Motorista do dia
                  </Link>
                  .
                </span>
              ) : null}
            </div>
          </div>

          {canManage ? (
            <MobileActionSheet>
              <DeliveryRequestActions
                requestId={request.id}
                requestType={request.type}
                status={request.status}
                isAssignedToMe={request.assignedToId === profile.id}
                hideClaim={isSacType}
                hasChildExchange={!!request.childExchange}
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
