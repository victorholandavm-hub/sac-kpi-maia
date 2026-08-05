import Link from "next/link";
import { redirect } from "next/navigation";
import { getMontadorSession, montadorSignOut } from "@/app/assistencia/montador-actions";
import { listRequestsForAssembler, montadorEffectiveDate, type AssemblerRequestView } from "@/lib/serviceRequests";
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

function RequestRow({ r }: { r: AssemblerRequestView }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
      <div className="flex flex-col gap-1 min-w-0">
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
          {r.montadorInstruction ? (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))" }}
            >
              ⚠ Instrução
            </span>
          ) : null}
        </div>
        <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
          {r.clientName ?? "Sem nome de cliente"}
        </p>
        {r.productSummary ? (
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {r.productSummary}
          </p>
        ) : null}
        {montadorEffectiveDate(r) ? (
          <p className="text-xs font-medium" style={{ color: "var(--brand-green)" }}>
            Data da montagem: {formatDateOnly(montadorEffectiveDate(r))}
            {r.scheduledTime ? ` às ${r.scheduledTime.slice(0, 5)}` : ""}
            {r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
          </p>
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
