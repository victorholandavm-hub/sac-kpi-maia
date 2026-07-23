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
        ) : request.approvedDeadline ?? request.requestedDeadline ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Prazo: {formatDateOnly(request.approvedDeadline ?? request.requestedDeadline)} (sem visita agendada ainda)
          </p>
        ) : null}

        <div
          className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <Row label="Cliente" value={request.clientName} />
          <Row label="Produto a entregar" value={request.productSummary} />
          <Row label="Endereço" value={request.clientAddress} />
          <Row label="Bairro" value={request.clientNeighborhood} />
          <Row label="Motivo" value={request.reason} />
          <Row label="O que recolher / observação" value={request.restrictionNote} />
        </div>

        {request.clientPhone ? (
          <a
            href={`tel:${request.clientPhone.replace(/\D/g, "")}`}
            className="text-sm font-medium rounded-lg px-3 py-2.5 self-start"
            style={{ background: "rgba(22, 163, 74, 0.1)", color: "var(--brand-green)" }}
          >
            📞 {request.clientPhone}
          </a>
        ) : null}

        <div className="flex flex-col gap-3">
          <PhotoGallery photos={photos} deleteMode="driver" currentActor={driverName} />
          <MotoristaPhotoUpload requestId={request.id} />
          {!showCompleted ? (
            <MotoristaRequestActions requestId={request.id} pickupCompleted={request.pickupCompleted} requestType={request.type} />
          ) : null}
        </div>
      </div>
    </ToastProvider>
  );
}
