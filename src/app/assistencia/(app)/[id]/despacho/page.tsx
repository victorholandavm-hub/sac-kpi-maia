import { getProfile } from "@/lib/dal";
import { getRequestDetail, formatFullAddress, type ServiceRequestDetail } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { PrintButton } from "@/components/assistencia/PrintButton";
import Link from "next/link";

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
  const result = await getRequestDetail(id);

  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const { request } = result;

  // Antes travava SAC em SAC_MANAGED_TYPES (só troca/entrega de produto e
  // notificação externa) -- mas createSacRequest (actions.ts) deixa o SAC
  // criar montagem e envio de peça também, e a tela de detalhe normal
  // (ver [id]/page.tsx) já deixa qualquer papel VER qualquer chamado
  // (só a EDIÇÃO é restrita por tipo). Sem esse alinhamento, o SAC caía em
  // "Acesso restrito" ao tentar imprimir o despacho de um chamado que ele
  // mesmo acabou de criar (redirect direto pra cá desde 17/08/2026).
  const canView = profile.role === "assistencia" || profile.role === "admin" || profile.role === "sac";
  if (!canView) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const isUrgente = request.shift === "urgencia";

  if (request.type === "troca_produto") {
    return <TrocaProdutoDespacho request={request} isUrgente={isUrgente} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/${request.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver chamado completo
        </Link>
        <PrintButton />
      </div>

      <div
        className="rounded-lg border p-6 flex flex-col gap-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Relatório Logístico
            </h1>
            <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
              Chamado #{request.ticketNumber}
            </span>
          </div>
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
          <Field label="Endereço" value={formatFullAddress(request)} />
          <Field label="Bairro" value={request.clientNeighborhood} />
          <Field label="Loja / solicitado por" value={`${request.storeName} · ${request.requestedByName ?? "—"}`} />
          <Field label="Tipo" value={REQUEST_TYPE_LABELS[request.type] ?? request.type} />
          {request.shift ? <Field label="Turno" value={SHIFT_LABELS[request.shift]} /> : null}
          {request.scheduledDate ? <Field label="Data agendada" value={request.scheduledDate.split("-").reverse().join("/")} /> : null}
          {request.scheduledTime ? <Field label="Hora agendada" value={request.scheduledTime.slice(0, 5)} /> : null}
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

function TrocaProdutoDespacho({
  request,
  isUrgente,
}: {
  request: ServiceRequestDetail;
  isUrgente: boolean;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/${request.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver chamado completo
        </Link>
        <PrintButton />
      </div>

      <div
        className="rounded-lg border overflow-hidden flex flex-col"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            Chamado #{request.ticketNumber}
          </span>
          {isUrgente ? (
            <span className="text-base font-bold" style={{ color: "var(--status-critical)" }}>
              Urgente!
            </span>
          ) : null}
        </div>

        <table className="w-full text-sm border-collapse">
          <tbody>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2 font-semibold w-28 border-r align-top" style={{ borderColor: "var(--border)" }}>
                Nome
              </td>
              <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                {request.clientName || "—"}
              </td>
              <td className="px-3 py-2 border-l align-top w-40" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Solicitado por: {request.requestedByName ?? "—"}
              </td>
            </tr>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2 font-semibold border-r align-top" style={{ borderColor: "var(--border)" }}>
                Endereço
              </td>
              <td className="px-3 py-2" colSpan={2} style={{ color: "var(--text-primary)" }}>
                {request.clientAddress || "—"}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold border-r align-top" style={{ borderColor: "var(--border)" }}>
                Bairro
              </td>
              <td className="px-3 py-2 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {request.clientNeighborhood || "—"}
              </td>
              <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                Tel: {request.clientPhone || "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-sm border-collapse border-t" style={{ borderColor: "var(--border)" }}>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <th className="px-3 py-2 text-left font-semibold">Descrição</th>
              <th className="px-3 py-2 text-right font-semibold w-16">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {request.items.length > 0 ? (
              request.items.map((item) => (
                <tr key={item.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                    {item.product}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--text-primary)" }}>
                    {item.quantity}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-2" style={{ color: "var(--text-muted)" }} colSpan={2}>
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-3 py-1 text-sm font-semibold uppercase tracking-wide"
            style={{ background: "var(--text-primary)", color: "var(--surface-1)" }}
          >
            Descrição
          </div>
          <div className="px-3 py-3 flex flex-col gap-1 items-center text-center">
            <span className="text-sm font-bold uppercase" style={{ color: "var(--text-primary)" }}>
              Troca
            </span>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {request.restrictionNote || request.reason || "—"}
            </span>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-3 py-1 text-sm font-semibold uppercase tracking-wide"
            style={{ background: "var(--text-primary)", color: "var(--surface-1)" }}
          >
            Relatório Logístico
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            <Field label="Motorista" value={request.driverName} />
            <div className="flex flex-col gap-4 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b" style={{ borderColor: "var(--border)", height: "1.25rem" }} />
              ))}
            </div>
            <div className="flex justify-center pt-6">
              <div className="border-t w-56 text-center text-xs pt-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Assinatura do cliente
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
