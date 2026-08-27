import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getDriverSession } from "@/app/assistencia/driver-actions";
import { getDriverRequestDetail, formatFullAddress } from "@/lib/serviceRequests";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { DRIVER_TYPE_LABELS, SHIFT_LABELS, DISPATCH_SUPERVISOR_DRIVERS } from "@/lib/assistenciaLabels";
import { DeliveryStatusBadge } from "@/components/assistencia/DeliveryStatusBadge";
import { PhotoGallery } from "@/components/assistencia/PhotoGallery";
import { MotoristaPhotoUpload } from "@/components/assistencia/MotoristaPhotoUpload";
import { MotoristaRequestActions } from "@/components/assistencia/MotoristaRequestActions";
import { RatingQrCode } from "@/components/assistencia/RatingQrCode";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { telHref, whatsappHref } from "@/lib/phone";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

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

export default async function MotoristaRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const driverName = await getDriverSession();
  if (!driverName) {
    redirect("/assistencia/motorista/login");
  }

  const { id } = await params;
  const isSupervisor = DISPATCH_SUPERVISOR_DRIVERS.includes(driverName);
  const request = await getDriverRequestDetail(driverName, id, { viewAll: isSupervisor });
  if (!request) {
    notFound();
  }
  // Everton (expedição) pode abrir o chamado de qualquer motorista, mas só
  // visualiza -- concluir/foto continuam exclusivos de quem tá na rota (as
  // actions em driver-actions.ts já travam isso de qualquer forma; aqui é
  // só pra não oferecer botão que ia dar erro "não é seu").
  const isOwnTicket = request.driverName === driverName;

  const photos = await listRequestPhotos(request.id);
  const proofPhotos = photos.filter((p) => p.isProof);
  const otherPhotos = photos.filter((p) => !p.isProof);
  const showCompleted = request.status === "concluida" || request.status === "cancelada";
  // Motorista não tem caso "mostruário" (sempre tem cliente de verdade na
  // outra ponta), diferente do montador -- QR aparece sempre que concluído
  // e ainda sem nota.
  const needsClientRatingQr = request.status === "concluida" && request.deliveryRating === null;
  const deadline = request.approvedDeadline ?? request.requestedDeadline;
  const mapsQuery = [request.clientAddress, request.clientAddressNumber, request.clientNeighborhood].filter(Boolean).join(", ");

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Chamado #${request.ticketNumber}`} subtitle={`${DRIVER_TYPE_LABELS[request.type] ?? request.type} · ${request.storeName}`}>
          <Link href="/assistencia/motorista" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>

        {!isOwnTicket ? (
          <p
            className="text-xs font-medium rounded-lg px-3 py-2"
            style={{ background: "var(--brand-green-soft)", color: "var(--text-primary)" }}
          >
            🚚 Motorista responsável: {request.driverName ?? "nenhum ainda"} — você só está visualizando.
          </p>
        ) : null}

        <div className="flex items-center gap-2 flex-wrap">
          <DeliveryStatusBadge status={request.status} scheduledDate={request.scheduledDate} rota={request.rota} />
          {request.clientTimeRestriction ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-warning) 40%, var(--surface-1))" }}
            >
              🕐 {request.clientTimeRestriction}
            </span>
          ) : null}
          {request.urgent ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: "#fff", background: "var(--status-critical)" }}
            >
              Urgente!
            </span>
          ) : null}
          {/* Recolhimento só existe pra troca_produto -- mesma regra de
              MotoristaRequestActions.tsx/DriverRouteGroup.tsx. */}
          {!showCompleted && request.type === "troca_produto" && !request.pickupCompleted ? (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
            >
              Recolher produto
            </span>
          ) : null}
        </div>

        {request.scheduledDate ? (
          <p className="text-sm font-medium" style={{ color: "var(--brand-green)" }}>
            {formatDateOnly(request.scheduledDate)}
            {request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}
            {request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}
          </p>
        ) : deadline ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Prazo: {formatDateOnly(deadline)} (sem visita agendada ainda)
          </p>
        ) : null}

        <div
          className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
          style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
        >
          <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
            Detalhes
          </h3>
          <Row label="Cliente" value={request.clientName} />
          <Row label={request.type === "envio_peca" ? "Peça a entregar" : "Produto a entregar"} value={request.deliverySummary} />
          {/* Só aparece pra troca_produto (recolhimento de verdade) --
              pedido do Victor 26/08/2026: "obrigatorio colocar os produtos
              que deverão ser entregues e os produtos que deverão ser
              recolhidos" -- o motorista precisa ver separado, não
              misturado com o que entregar. */}
          {request.pickupSummary ? <Row label="Produto a recolher" value={request.pickupSummary} /> : null}
          <Row label="Endereço" value={formatFullAddress(request)} />
          <Row label="Bairro" value={request.clientNeighborhood} />
          <Row label="Motivo" value={request.reason} />
          <Row label="O que recolher / observação" value={request.restrictionNote} />
          <Row label="Autorizado por" value={request.authorizedBy} />
          <Row label="Criado por" value={request.requestedByName} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {request.clientPhone ? (
            <a
              href={telHref(request.clientPhone)}
              className="text-sm font-medium rounded-lg px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
            >
              📞 {request.clientPhone}
            </a>
          ) : null}
          {request.clientPhone ? (
            <a
              href={whatsappHref(request.clientPhone)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium rounded-lg px-3 py-2.5"
              style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "#1da851" }}
            >
              💬 WhatsApp
            </a>
          ) : null}
          {mapsQuery ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium rounded-lg px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
            >
              🗺️ Ver no mapa
            </a>
          ) : null}
        </div>

        <div
          className="rounded-lg p-4 flex flex-col gap-3"
          style={{ background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-1))", border: "2px solid var(--status-warning)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            📝 Comprovante assinado {showCompleted ? "" : "(obrigatório antes de concluir)"}
          </h3>
          {!showCompleted ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Só está concluída quando o cliente assina — foto do papel impresso com a assinatura.
            </p>
          ) : null}
          <PhotoGallery photos={proofPhotos} deleteMode="driver" currentActor={driverName} />
          {!showCompleted && isOwnTicket ? <MotoristaPhotoUpload requestId={request.id} proof /> : null}
        </div>

        <div
          className="rounded-lg p-4 flex flex-col gap-3"
          style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Fotos
          </h3>
          <PhotoGallery photos={otherPhotos} deleteMode="driver" currentActor={driverName} />
          {isOwnTicket ? <MotoristaPhotoUpload requestId={request.id} /> : null}
        </div>

        {!showCompleted && isOwnTicket ? (
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Ações
            </h3>
            <MotoristaRequestActions requestId={request.id} pickupCompleted={request.pickupCompleted} requestType={request.type} />
          </div>
        ) : needsClientRatingQr ? (
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Avaliação do cliente
            </h3>
            <RatingQrCode requestId={request.id} />
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}
