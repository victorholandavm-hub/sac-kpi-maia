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
  DELIVERY_REQUEST_TYPES,
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
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

// Card branco, borda fina, sombra discreta -- Guia de Componentes Maia
// (Design System, 01/09/2026): "painéis brancos bem estruturados", "cards
// brancos limpos com bordas finas (shadow-sm)". Substitui o padrão antigo
// (fundo var(--surface-1) + borda verde de 2px em toda caixa) usado nessa
// tela inteira.
function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-3 ${className}`}>
      {title ? <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3> : null}
      {children}
    </div>
  );
}

// Badge neutro (tipo, filial) -- cinza, nunca laranja/verde: essas duas
// cores ficam reservadas pra status e alerta (Guia de Componentes Maia).
function NeutralBadge({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
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
    request.causaRaiz === "erro_conferencia" || request.causaRaiz === "sujeira_conferencia"
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
      {/* Cabeçalho -- Guia de Componentes Maia (Design System, 01/09/2026):
          título em destaque + badges elegantes (status, tipo, filial),
          botões de utilidade em outline neutro à direita. "Editar e
          salvar alterações" é o único botão sólido (primário) -- os
          outros dois (Criar notificação, Imprimir despacho) viraram
          outline, pra não competir em cor com ele. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">Chamado #{request.ticketNumber}</h1>
          <DeliveryStatusBadge status={request.status} scheduledDate={request.scheduledDate} rota={request.rota} />
          <NeutralBadge>{REQUEST_TYPE_LABELS[request.type] ?? request.type}</NeutralBadge>
          <NeutralBadge icon="🏬">{request.storeName}</NeutralBadge>
          {/* Generalizado 03/09/2026 -- "nova troca" não é mais só de
              troca_produto (ver createExchangeChild, actions.ts). Antes
              mostrava esse selo sempre (inclusive "1ª troca" cinza) só pra
              troca_produto -- valia a pena porque QUALQUER troca_produto já
              nasce "rodada 1" de um conceito que é central pro tipo. Pros
              outros tipos (entrega_produto, envio_peca etc.) isso viraria
              ruído numa entrega comum que nunca vai ter 2ª rodada -- só
              aparece quando já é de fato uma 2ª rodada em diante. */}
          {(DELIVERY_REQUEST_TYPES as readonly string[]).includes(request.type) && request.exchangeRound > 1 ? (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
              style={{ background: "color-mix(in srgb, var(--status-warning) 16%, var(--surface-1))", color: "color-mix(in srgb, var(--status-warning) 70%, var(--foreground))" }}
            >
              {request.exchangeRound}ª rodada
            </span>
          ) : null}
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
            <Link
              href={`/assistencia/${request.id}/despacho`}
              className="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150"
            >
              Imprimir despacho
            </Link>
          </div>
        ) : null}
      </div>

      {request.parentExchange || request.childExchange ? (
        <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600 dark:text-gray-300">
          {request.parentExchange ? (
            <Link href={`/assistencia/${request.parentExchange.id}`} className="font-medium hover:underline" style={{ color: "#1B5E3C" }}>
              ↩ Troca anterior: #{request.parentExchange.ticketNumber} ({STATUS_LABELS[request.parentExchange.status] ?? request.parentExchange.status})
            </Link>
          ) : null}
          {request.childExchange ? (
            <Link href={`/assistencia/${request.childExchange.id}`} className="font-medium hover:underline" style={{ color: "#1B5E3C" }}>
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

      {/* 2 colunas, 70/30 -- Guia de Componentes Maia (Design System,
          01/09/2026): esquerda é dado/conteúdo, direita é painel de
          controle e histórico. Empilha normal (uma coluna só) até "lg",
          igual sempre foi no celular/tablet. */}
      <div className="grid lg:grid-cols-[7fr_3fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          {/* Blocos 1 e 2 lado a lado -- pedido do Victor 01/09/2026: "dois
              quadrados distintos, mas lado a lado". Dados do cliente
              empilha em coluna única aqui dentro (não mais 2 colunas) --
              cada quadrado agora tem metade da largura de antes, e
              Endereço/Nº da nota fiscal são campos longos demais pra
              caber em 2 colunas estreitas sem apertar de verdade. */}
          <div className="grid sm:grid-cols-2 gap-4 items-start">
            {/* Bloco 1: Dados do cliente -- nome em destaque, separado do
                resto dos campos de leitura rápida. */}
            <Card title="Dados do cliente">
              <span className="text-base font-semibold text-gray-800 dark:text-gray-100">{request.clientName ?? "Sem nome de cliente"}</span>
              <div className="flex flex-col gap-3">
                <Row label="CPF" value={request.clientCpf} />
                <Row label="Telefone" value={request.clientPhone} />
                <Row label="Bairro" value={request.clientNeighborhood} />
                <Row label="Endereço" value={formatFullAddress(request)} />
                <Row label="Código do pedido/venda" value={request.orderCode} />
                <Row label="Nº da nota fiscal" value={request.invoiceNumber} />
                <Row label="Vendedor(a)" value={request.sellerName} />
              </div>
            </Card>

            {/* Bloco 2: Logística e rota -- pedido do Victor 01/09/2026: sai
                da coluna direita ("painel de controle") pra virar conteúdo
                de leitura na esquerda, junto do resto do dado do chamado.
                Badge laranja URGENTE só quando o chamado é urgente de
                verdade -- laranja fica reservado pra isso, não é decoração. */}
            <Card title="Logística e rota">
            {/* Só aparece aqui em modo leitura -- quem pode gerenciar já
                vê o mesmo aviso dentro do próprio ScheduleField (campo
                "urgente" editável), duplicar os dois juntos repetia o
                mesmo selo duas vezes na tela. */}
            {!canManage && request.urgent ? (
              <span
                className="inline-flex items-center self-start rounded-full px-2.5 py-1 text-xs font-bold text-white whitespace-nowrap"
                style={{ background: "var(--brand-orange)" }}
              >
                🔥 URGENTE
              </span>
            ) : null}
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
                editButtonVariant="button"
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400 dark:text-gray-500">Visita agendada</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <RotaBadge rota={request.rota} />
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {request.scheduledDate
                      ? `${request.scheduledDate.split("-").reverse().join("/")}${request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}`
                      : "Não agendada"}
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">Motorista</span>
              <span className="text-sm text-gray-800 dark:text-gray-100">{request.driverName ?? "Nenhum motorista escolhido ainda"}</span>
              {canManage ? (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Vem da rota do dia -- pra trocar, use o painel{" "}
                  <Link href={motoristaDoDiaHref} className="underline">
                    Motorista do dia
                  </Link>
                  .
                </span>
              ) : null}
            </div>
          </Card>
          </div>

          {/* Bloco 3: Produtos da solicitação. */}
          <DeliveryItemsTable items={request.items} requestId={request.id} canEditItems={canManage} requestType={request.type} />

          {/* Bloco 4: Descrição do problema, erros e fotos -- pedido do
              Victor 01/09/2026: junta o que antes era a seção "Fotos"
              solta no fim da página com a descrição do chamado, lado a
              lado, num card só. */}
          <Card title="Descrição do problema">
            <div className="grid sm:grid-cols-2 gap-4">
              <Row label="Autorizado por" value={request.authorizedBy} />
              <Row label="Motivo / problema" value={request.reason} />
              {request.causaRaiz ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Quem errou</span>
                  <span
                    className="inline-flex self-start items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                  >
                    {CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz}
                  </span>
                </div>
              ) : null}
              {causaRaizDetail ? <Row label="Detalhe" value={causaRaizDetail} /> : null}
              <Row label="Restrição / observação" value={request.restrictionNote} />
              <Row label="Restrição de horário do cliente" value={request.clientTimeRestriction} />
              <Row label="Observações" value={request.notes} />
              {request.type === "troca_produto" || request.type === "envio_recolhimento_peca" ? (
                <Row
                  label={request.type === "envio_recolhimento_peca" ? "Peça recolhida?" : "Produto recolhido?"}
                  value={request.pickupCompleted ? "Sim" : "Ainda não"}
                />
              ) : null}
              {request.deliveryRating !== null ? <Row label="Nota do cliente — entrega" value={`${request.deliveryRating}/10`} /> : null}
              {request.resolutionRating !== null ? (
                <Row label="Nota do cliente — resolução do problema" value={`${request.resolutionRating}/10`} />
              ) : null}
              <Row label="Responsável (sistema)" value={request.assignedToName ?? "Sem responsável"} />
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

        {/* Coluna direita -- painel de controle de fluxo de trabalho:
            ações rápidas, notas rápidas (as duas dentro de
            DeliveryRequestActions, já em cards próprios) e histórico. */}
        <div className="flex flex-col gap-4">
          {canManage ? (
            <MobileActionSheet>
              <DeliveryRequestActions
                requestId={request.id}
                requestType={request.type}
                status={request.status}
                hasChildExchange={!!request.childExchange}
              />
            </MobileActionSheet>
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
