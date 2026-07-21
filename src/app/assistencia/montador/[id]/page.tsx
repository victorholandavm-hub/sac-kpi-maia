import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getMontadorSession } from "@/app/assistencia/montador-actions";
import { getAssemblerRequestDetail } from "@/lib/serviceRequests";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { PhotoGallery } from "@/components/assistencia/PhotoGallery";
import { MontadorPhotoUpload } from "@/components/assistencia/MontadorPhotoUpload";
import { MontadorRequestActions } from "@/components/assistencia/MontadorRequestActions";
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

export default async function MontadorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) {
    redirect("/assistencia/montador/login");
  }

  const { id } = await params;
  const request = await getAssemblerRequestDetail(assemblerName, id);
  if (!request) {
    notFound();
  }

  const photos = await listRequestPhotos(request.id);
  const showCompleted = request.status === "concluida" || request.status === "cancelada";

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Chamado #${request.ticketNumber}`} subtitle={`${REQUEST_TYPE_LABELS[request.type] ?? request.type} · ${request.storeName}`}>
          <Link href="/assistencia/montador" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>

        <StatusBadge status={request.status} />

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
          <Row label="Produto" value={request.productSummary} />
          <Row label="Endereço" value={request.clientAddress} />
          <Row label="Bairro" value={request.clientNeighborhood} />
          <Row label="Motivo" value={request.reason} />
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
          <PhotoGallery photos={photos} deleteMode="montador" currentActor={assemblerName} />
          <MontadorPhotoUpload requestId={request.id} />
          {!showCompleted ? <MontadorRequestActions requestId={request.id} /> : null}
        </div>
      </div>
    </ToastProvider>
  );
}
