import { getProfile, requireRole } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { PrintButton } from "@/components/assistencia/PrintButton";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-base" style={{ color: "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

export default async function DespachoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const result = await getRequestDetail(profile, id);

  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const { request } = result;
  const isUrgente = request.shift === "urgencia";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PrintButton />

      <div
        className="rounded-lg border p-6 flex flex-col gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
            Relatório Logístico
          </h1>
          {isUrgente ? (
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ color: "#fff", background: "var(--status-critical)" }}
            >
              URGENTE!
            </span>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cliente" value={request.clientName} />
          <Field label="Telefone" value={request.clientPhone} />
          <Field label="Endereço" value={request.clientAddress} />
          <Field label="Bairro" value={request.clientNeighborhood} />
          <Field label="Loja / solicitado por" value={`${request.storeName} · ${request.requestedByName ?? "—"}`} />
          <Field label="Tipo" value={REQUEST_TYPE_LABELS[request.type] ?? request.type} />
          {request.shift ? <Field label="Turno" value={SHIFT_LABELS[request.shift]} /> : null}
          {request.scheduledDate ? <Field label="Data agendada" value={request.scheduledDate.split("-").reverse().join("/")} /> : null}
        </div>

        {request.items.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Itens
            </span>
            <table className="w-full text-sm">
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1" style={{ color: "var(--text-primary)" }}>
                      {item.quantity > 1 ? `${item.quantity}x ` : ""}
                      {item.product}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Field label="Instrução / motivo" value={request.reason} />
        {request.restrictionNote ? <Field label="Restrição / observação" value={request.restrictionNote} /> : null}
      </div>
    </div>
  );
}
