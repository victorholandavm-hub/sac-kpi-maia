import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinanceiroSession, financeiroSignOut } from "@/app/assistencia/financeiro-actions";
import { getOptionalProfile } from "@/lib/dal";
import { listAllEstornoRequests, getEstornoRequestsSummary, type EstornoRequestStatus } from "@/lib/estornoRequests";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { UnderlineTab } from "@/components/UnderlineTab";
import { StatTile } from "@/components/StatTile";
import { EstornoStatusBadge } from "@/components/assistencia/EstornoStatusBadge";
import { EstornoFinanceiroActions } from "@/components/assistencia/EstornoFinanceiroActions";

export const dynamic = "force-dynamic";

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_VIEWS: { view: string; status: EstornoRequestStatus; label: string }[] = [
  { view: "pendentes", status: "pendente", label: "Pendentes" },
  { view: "concluidos", status: "concluido", label: "Concluídos" },
  { view: "recusados", status: "recusado", label: "Recusados" },
];

// Um campo de detalhe -- mesma receita de "label pequeno em cima, valor
// embaixo" que a tabela de Entregas (EntregasKanbanHoje.tsx) já usa, em vez
// da pilha de <p>"Rótulo: valor"</p> que essa tela tinha antes (pedido do
// Victor 23/09/2026: "precisa estar melhor organizada essas informações,
// como é a organização da tela de entregas").
function InfoItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

// Financeiro (PIN) vê essa fila; admin (Supabase Auth) também acessa a
// MESMA rota como fallback -- pedido do Victor 23/09/2026: "Admin deve
// poder continuar vendo tudo também". Mesmo fallback de
// lojaApproveMontagemConclusion (loja-actions.ts), só que aqui é a rota
// inteira, não uma ação isolada.
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const financeiroName = await getFinanceiroSession();
  const profile = financeiroName ? null : await getOptionalProfile();
  const isAdmin = !!profile && profile.role === "admin";
  if (!financeiroName && !isAdmin) {
    redirect("/assistencia/financeiro/login");
  }

  const { view } = await searchParams;
  const current = STATUS_VIEWS.find((v) => v.view === view) ?? STATUS_VIEWS[0];
  const [requests, summary] = await Promise.all([listAllEstornoRequests(current.status), getEstornoRequestsSummary()]);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader
        title="Financeiro — Estornos"
        subtitle={isAdmin ? `${profile!.fullName} (admin) · todas as lojas` : `${financeiroName} · todas as lojas`}
      >
        {financeiroName ? (
          <form action={financeiroSignOut}>
            <button type="submit" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Sair
            </button>
          </form>
        ) : (
          <Link href="/assistencia" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            ← Voltar
          </Link>
        )}
      </AssistenciaHeader>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Pendentes" value={summary.pendente} accent="var(--brand-orange)" />
        <StatTile label="Valor pendente" value={formatMoney(summary.valorPendente)} accent="var(--brand-orange)" />
        <StatTile label="Concluídos" value={summary.concluido} accent="var(--status-good)" />
        <StatTile label="Recusados" value={summary.recusado} accent="var(--status-critical)" />
      </section>

      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {STATUS_VIEWS.map((v) => (
          <UnderlineTab key={v.view} href={`/assistencia/financeiro?view=${v.view}`} label={v.label} active={current.view === v.view} />
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma solicitação {current.label.toLowerCase()} no momento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <details
              key={r.id}
              className="rounded-xl border overflow-hidden"
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border)",
                borderLeft: `3px solid ${r.status === "pendente" ? "var(--brand-orange)" : r.status === "concluido" ? "var(--status-good)" : "var(--status-critical)"}`,
              }}
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 flex-wrap">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {r.clienteNome}
                    </span>
                    <EstornoStatusBadge status={r.status} />
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.storeName} · {r.requesterRole === "gerente" ? "Gerente" : "Caixa"} {r.requesterName}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatMoney(r.valorReembolso)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </summary>

              <div className="px-4 pb-4 flex flex-col gap-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <InfoItem label="CPF" value={r.cpf ?? ""} />
                  <InfoItem label="Código do cliente" value={r.codigoCliente ?? ""} />
                  <InfoItem label="NF de entrada" value={r.nfEntrada ?? ""} />
                  <InfoItem label="NF de devolução" value={r.nfDevolucao ?? ""} />
                  <InfoItem label="Data da venda" value={r.dataVenda ? new Date(`${r.dataVenda}T00:00:00`).toLocaleDateString("pt-BR") : ""} />
                  <InfoItem label="Forma de pagamento" value={r.formaPagamento ?? ""} />
                  <InfoItem label="Produto" value={r.produto ?? ""} />
                  <InfoItem label="Autorizado por" value={r.autorizadoPor ?? ""} />
                </div>
                {r.motivo ? (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Motivo
                    </span>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {r.motivo}
                    </p>
                  </div>
                ) : null}

                <a
                  href={r.anexoSolicitacaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline self-start"
                  style={{ color: "var(--brand-green)" }}
                >
                  Ver comprovante da venda
                </a>

                {r.status === "concluido" && r.anexoComprovanteUrl ? (
                  <div className="flex flex-col gap-1">
                    <a href={r.anexoComprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline self-start" style={{ color: "var(--status-good)" }}>
                      Ver comprovante do estorno
                    </a>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Concluído por {r.concluidoPor} em {r.concluidoEm ? new Date(r.concluidoEm).toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                ) : null}
                {r.status === "recusado" ? (
                  <p className="text-sm" style={{ color: "var(--status-critical)" }}>
                    Recusado por {r.recusadoPor}: {r.motivoRecusa}
                  </p>
                ) : null}
                {r.status === "pendente" ? <EstornoFinanceiroActions requestId={r.id} /> : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
