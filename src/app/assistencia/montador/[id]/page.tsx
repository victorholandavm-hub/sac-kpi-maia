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
  const deadline = request.approvedDeadline ?? request.requestedDeadline;
  const mapsQuery = [request.clientAddress, request.clientNeighborhood].filter(Boolean).join(", ");

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Chamado #${request.ticketNumber}`} subtitle={`${REQUEST_TYPE_LABELS[request.type] ?? request.type} · ${request.storeName}`}>
          <Link href="/assistencia/montador" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>

        <StatusBadge status={request.status} />

        {request.comboMontagemDesmontagem ? (
          <p
            className="text-sm font-medium rounded-lg px-3 py-2.5"
            style={{ background: "var(--brand-orange-soft)", color: "var(--brand-orange)" }}
          >
            ⚠ Essa visita também precisa de {request.type === "montagem" ? "desmontagem do móvel antigo" : "montagem do móvel novo"}.
          </p>
        ) : null}

        {request.scheduledDate ? (
          <p className="text-sm font-medium" style={{ color: "var(--brand-green)" }}>
            {formatDateOnly(request.scheduledDate)}
            {request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}
            {request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}
          </p>
        ) : deadline ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Data da montagem: {formatDateOnly(deadline)} (sem visita agendada ainda)
          </p>
        ) : null}

        <div
          className="rounded-lg border p-4 grid sm:grid-cols-2 gap-4"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <Row label="Cliente" value={request.clientName} />
          {request.comboMontagemDesmontagem ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Produtos
              </span>
              {(["montar", "desmontar"] as const).map((action) => {
                const list = request.items.filter((i) => i.action === action);
                if (list.length === 0) return null;
                return (
                  <div key={action} className="flex flex-col gap-0.5">
                    <span
                      className="text-xs font-bold w-fit px-1.5 py-0.5 rounded"
                      style={{
                        color: action === "montar" ? "var(--brand-green-ink)" : "var(--brand-orange)",
                        background: action === "montar" ? "var(--brand-green)" : "var(--brand-orange-soft)",
                      }}
                    >
                      {action === "montar" ? "Montar" : "Desmontar"}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {list.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.product}`).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Row label="Produto" value={request.productSummary} />
          )}
          <Row label="Endereço" value={request.clientAddress} />
          <Row label="Bairro" value={request.clientNeighborhood} />
          <Row label="Motivo" value={request.reason} />
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

        <div className="flex flex-col gap-3">
          <PhotoGallery photos={photos} deleteMode="montador" currentActor={assemblerName} />
          <MontadorPhotoUpload requestId={request.id} />
          {!showCompleted ? <MontadorRequestActions requestId={request.id} /> : null}
        </div>
      </div>
    </ToastProvider>
  );
}
