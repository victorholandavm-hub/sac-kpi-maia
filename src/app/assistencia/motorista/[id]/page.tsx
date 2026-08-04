import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getDriverSession } from "@/app/assistencia/driver-actions";
import { getDriverRequestDetail } from "@/lib/serviceRequests";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { PhotoGallery } from "@/components/assistencia/PhotoGallery";
import { MotoristaPhotoUpload } from "@/components/assistencia/MotoristaPhotoUpload";
import { MotoristaRequestActions } from "@/components/assistencia/MotoristaRequestActions";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

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
  const request = await getDriverRequestDetail(driverName, id);
  if (!request) {
    notFound();
  }

  const photos = await listRequestPhotos(request.id);
  const showCompleted = request.status === "concluida" || request.status === "cancelada";
  const deadline = request.approvedDeadline ?? request.requestedDeadline;
  const mapsQuery = [request.clientAddress, request.clientNeighborhood].filter(Boolean).join(", ");

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Chamado #${request.ticketNumber}`} subtitle={`${REQUEST_TYPE_LABELS[request.type] ?? request.type} · ${request.storeName}`}>
          <Link href="/assistencia/motorista" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={request.status} />
          {request.shift === "urgencia" ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: "#fff", background: "var(--status-critical)" }}
            >
              Urgente!
            </span>
          ) : null}
          {!showCompleted && !request.pickupCompleted ? (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--brand-orange)", border: "1px solid var(--brand-orange)" }}
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
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
            Detalhes
          </h3>
          <Row label="Cliente" value={request.clientName} />
          <Row label="Produto a entregar" value={request.productSummary} />
          <Row label="Endereço" value={request.clientAddress} />
          <Row label="Bairro" value={request.clientNeighborhood} />
          <Row label="Motivo" value={request.reason} />
          <Row label="O que recolher / observação" value={request.restrictionNote} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {request.clientPhone ? (
            <a
              href={`tel:${request.clientPhone.replace(/\D/g, "")}`}
              className="text-sm font-medium rounded-lg px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
            >
              📞 {request.clientPhone}
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
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Fotos
          </h3>
          <PhotoGallery photos={photos} deleteMode="driver" currentActor={driverName} />
          <MotoristaPhotoUpload requestId={request.id} />
        </div>

        {!showCompleted ? (
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Ações
            </h3>
            <MotoristaRequestActions requestId={request.id} pickupCompleted={request.pickupCompleted} requestType={request.type} />
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}
