import Link from "next/link";
import { redirect } from "next/navigation";
import { getMontadorSession, montadorSignOut } from "@/app/assistencia/montador-actions";
import { listRequestsForAssembler, montadorEffectiveDate, formatFullAddress, type AssemblerRequestView } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "@/components/assistencia/StatusBadge";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { groupByDateDetailed } from "@/lib/dateBuckets";

export const dynamic = "force-dynamic";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Tudo que o montador precisa pra decidir/agir sem abrir o chamado -- ele
// usava planilha antes e via tudo de cara; "Ver chamado" fica só pra ações
// de verdade (concluir, reportar problema, foto).
function RequestRow({ r }: { r: AssemblerRequestView }) {
  const address = formatFullAddress(r);
  const mapsQuery = [r.clientAddress, r.clientAddressNumber, r.clientNeighborhood].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            #{r.ticketNumber}
          </span>
          <StatusBadge status={r.status} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
          </span>
          {r.comboMontagemDesmontagem ? (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
            >
              {r.type === "montagem" ? "+ desmontagem" : "+ montagem"}
            </span>
          ) : null}
        </div>
        <Link
          href={`/assistencia/montador/${r.id}`}
          className="text-sm rounded-lg px-3 py-2 font-medium shrink-0"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Ver chamado
        </Link>
      </div>

      <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
        {r.clientName ?? "Sem nome de cliente"}
      </p>

      {montadorEffectiveDate(r) ? (
        <p className="text-xs font-medium" style={{ color: "var(--brand-green)" }}>
          Data da montagem: {formatDateOnly(montadorEffectiveDate(r))}
          {r.scheduledTime ? ` às ${r.scheduledTime.slice(0, 5)}` : ""}
          {r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
        </p>
      ) : null}

      {r.items.length > 0 ? (
        <div className="flex flex-col gap-1">
          {r.items.map((item) => (
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
      ) : null}

      {r.montadorInstruction ? (
        <div
          className="rounded-lg p-2.5 flex flex-col gap-0.5"
          style={{ background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface-1))", border: "2px solid var(--status-warning)" }}
        >
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            ⚠ Instrução da assistência
          </span>
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
            {r.montadorInstruction}
          </p>
        </div>
      ) : null}

      {address || r.clientNeighborhood ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          📍 {address}
          {r.clientNeighborhood ? ` — ${r.clientNeighborhood}` : ""}
        </p>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap">
        {r.clientPhone ? (
          <a
            href={`tel:${r.clientPhone.replace(/\D/g, "")}`}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5"
            style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
          >
            📞 {r.clientPhone}
          </a>
        ) : null}
        {mapsQuery ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium rounded-lg px-2.5 py-1.5"
            style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
          >
            🗺️ Ver no mapa
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default async function MontadorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) {
    redirect("/assistencia/montador/login");
  }

  const { view } = await searchParams;
  const showCompleted = view === "concluidas";

  const requests = await listRequestsForAssembler(assemblerName, { onlyCompleted: showCompleted });
  const groups = !showCompleted ? groupByDateDetailed(requests, montadorEffectiveDate) : null;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader
        title={`Olá, ${assemblerName}`}
        subtitle="Seus chamados de montagem, desmontagem, recolhimento e vistoria."
      >
        <div className="flex items-center gap-4">
          <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
          <form action={montadorSignOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      <div className="flex items-center gap-2">
        <Link
          href="/assistencia/montador"
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: !showCompleted ? "var(--surface-1)" : "transparent",
            color: !showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: !showCompleted ? 600 : 400,
          }}
        >
          Em aberto
        </Link>
        <Link
          href="/assistencia/montador?view=concluidas"
          className="text-xs px-3 py-1.5 rounded-full border"
          style={{
            borderColor: "var(--border)",
            background: showCompleted ? "var(--surface-1)" : "transparent",
            color: showCompleted ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: showCompleted ? 600 : 400,
          }}
        >
          Concluídas
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {showCompleted ? "Nenhum chamado concluído ainda." : "Nenhum chamado em aberto no momento."}
          </p>
        </div>
      ) : groups ? (
        groups.map((g) => (
          <details key={g.key} open={g.defaultOpen}>
            <summary className="text-base font-bold cursor-pointer py-1" style={{ color: "var(--text-primary)" }}>
              {g.label} ({g.items.length})
            </summary>
            <div className="rounded-lg overflow-hidden mt-2" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
              <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
                {g.items.map((r) => (
                  <RequestRow key={r.id} r={r} />
                ))}
              </div>
            </div>
          </details>
        ))
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
            {requests.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
