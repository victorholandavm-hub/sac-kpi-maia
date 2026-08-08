import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getMontadorSession } from "@/app/assistencia/montador-actions";
import { getAssemblerRequestDetail, montadorEffectiveDate, formatFullAddress, isMostruarioRequest } from "@/lib/serviceRequests";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { PhotoGallery } from "@/components/assistencia/PhotoGallery";
import { MontadorPhotoUpload } from "@/components/assistencia/MontadorPhotoUpload";
import { MontadorRequestActions } from "@/components/assistencia/MontadorRequestActions";
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
  const montadorDate = montadorEffectiveDate(request);
  const mapsQuery = [request.clientAddress, request.clientAddressNumber, request.clientNeighborhood].filter(Boolean).join(", ");

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
        <AssistenciaHeader title={`Chamado #${request.ticketNumber}`} subtitle={`${REQUEST_TYPE_LABELS[request.type] ?? request.type} · ${request.storeName}`}>
          <Link href="/assistencia/montador" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={request.status} />
          {request.comboMontagemDesmontagem ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
            >
              Visita combo — ver produtos abaixo
            </span>
          ) : null}
        </div>

        {montadorDate ? (
          <p className="text-sm font-medium" style={{ color: "var(--brand-green)" }}>
            Data da montagem: {formatDateOnly(montadorDate)}
            {request.scheduledTime ? ` às ${request.scheduledTime.slice(0, 5)}` : ""}
            {request.shift ? ` · ${SHIFT_LABELS[request.shift]}` : ""}
          </p>
        ) : null}

        {request.montadorInstruction ? (
          <div
            className="rounded-lg p-4 flex flex-col gap-1"
            style={{ background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface-1))", border: "2px solid var(--status-warning)" }}
          >
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              ⚠ Instrução da assistência
            </span>
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
              {request.montadorInstruction}
            </p>
          </div>
        ) : null}

        <div
          className="rounded-lg p-4 grid sm:grid-cols-2 gap-4"
          style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
        >
          <h3 className="text-sm font-bold sm:col-span-2" style={{ color: "var(--text-primary)" }}>
            Detalhes
          </h3>
          <Row label="Cliente" value={request.clientName} />
          {request.items.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {request.comboMontagemDesmontagem ? "Produtos" : "Produto"}
              </span>
              <div className="flex flex-col gap-1">
                {request.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 flex-wrap">
                    {item.completed ? (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-good) 35%, var(--surface-1))" }}
                      >
                        ✓ Feito
                      </span>
                    ) : null}
                    {item.action ? (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: item.action === "montar" ? "var(--brand-green-ink)" : "var(--text-primary)",
                          background: item.action === "montar" ? "var(--brand-green)" : "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))",
                        }}
                      >
                        {item.action === "montar" ? "Montar" : "Desmontar"}
                      </span>
                    ) : null}
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {item.quantity > 1 ? `${item.quantity}x ` : ""}
                      {item.product}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Row label="Produto" value={request.productSummary} />
          )}
          <Row label="Endereço" value={formatFullAddress(request)} />
          <Row label="Bairro" value={request.clientNeighborhood} />
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
          style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Fotos
          </h3>
          <PhotoGallery photos={photos} deleteMode="montador" currentActor={assemblerName} />
          <MontadorPhotoUpload requestId={request.id} />
        </div>

        {!showCompleted ? (
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Ações
            </h3>
            <MontadorRequestActions
              requestId={request.id}
              items={request.items}
              isMostruario={isMostruarioRequest(request.orderCode, request.clientName)}
            />
          </div>
        ) : null}
      </div>
    </ToastProvider>
  );
}
