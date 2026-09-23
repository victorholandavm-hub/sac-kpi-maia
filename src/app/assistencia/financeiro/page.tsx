import Link from "next/link";
import { redirect } from "next/navigation";
import { getFinanceiroSession, financeiroSignOut } from "@/app/assistencia/financeiro-actions";
import { getOptionalProfile } from "@/lib/dal";
import { listAllEstornoRequests, type EstornoRequestStatus } from "@/lib/estornoRequests";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { UnderlineTab } from "@/components/UnderlineTab";
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
  const requests = await listAllEstornoRequests(current.status);

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
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {requests.map((r) => (
              <details key={r.id} className="p-4">
                <summary className="flex items-center justify-between gap-2 cursor-pointer list-none flex-wrap">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.clienteNome}</span>
                      <EstornoStatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {r.storeName} · {formatMoney(r.valorReembolso)} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {r.requesterRole === "gerente" ? "Gerente" : "Caixa"}: {r.requesterName}
                  </span>
                </summary>
                <div className="mt-3 pt-3 flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  {r.cpf ? <p>CPF: {r.cpf}</p> : null}
                  {r.codigoCliente ? <p>Código do cliente: {r.codigoCliente}</p> : null}
                  {r.nfEntrada ? <p>NF de entrada: {r.nfEntrada}</p> : null}
                  {r.nfDevolucao ? <p>NF de devolução: {r.nfDevolucao}</p> : null}
                  {r.dataVenda ? <p>Data da venda: {new Date(`${r.dataVenda}T00:00:00`).toLocaleDateString("pt-BR")}</p> : null}
                  {r.formaPagamento ? <p>Forma de pagamento: {r.formaPagamento}</p> : null}
                  {r.produto ? <p>Produto: {r.produto}</p> : null}
                  {r.motivo ? <p>Motivo: {r.motivo}</p> : null}
                  {r.autorizadoPor ? <p>Autorizado por: {r.autorizadoPor}</p> : null}
                  <a href={r.anexoSolicitacaoUrl} target="_blank" rel="noopener noreferrer" className="underline self-start" style={{ color: "var(--brand-green)" }}>
                    Ver comprovante da venda
                  </a>
                  {r.status === "concluido" && r.anexoComprovanteUrl ? (
                    <>
                      <a href={r.anexoComprovanteUrl} target="_blank" rel="noopener noreferrer" className="underline self-start" style={{ color: "var(--status-good)" }}>
                        Ver comprovante do estorno
                      </a>
                      <p>Concluído por {r.concluidoPor} em {r.concluidoEm ? new Date(r.concluidoEm).toLocaleDateString("pt-BR") : "—"}</p>
                    </>
                  ) : null}
                  {r.status === "recusado" ? (
                    <p style={{ color: "var(--status-critical)" }}>
                      Recusado por {r.recusadoPor}: {r.motivoRecusa}
                    </p>
                  ) : null}
                  {r.status === "pendente" ? <EstornoFinanceiroActions requestId={r.id} /> : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
