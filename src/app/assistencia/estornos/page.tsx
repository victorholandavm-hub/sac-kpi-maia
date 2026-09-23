import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEstornoRequester } from "@/lib/estornoRequester";
import { listEstornoRequestsForStores } from "@/lib/estornoRequests";
import { caixaSignOut } from "@/app/assistencia/caixa-actions";
import { lojaGerenteSignOut } from "@/app/assistencia/loja-actions";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { LojaTabs } from "@/components/assistencia/LojaTabs";
import { EstornoStatusBadge } from "@/components/assistencia/EstornoStatusBadge";

export const dynamic = "force-dynamic";

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EstornosPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const requester = await resolveEstornoRequester();
  if (!requester) {
    // Sem sessão de caixa nem de gerente -- manda pra tela neutra que já
    // tem os dois logins (mesmo fallback de encomendas/caixa/page.tsx).
    redirect("/assistencia/encomendas");
  }

  const { enviado } = await searchParams;
  const storeIds = requester.kind === "gerente" ? requester.storeIds : [requester.storeId];
  const requests = await listEstornoRequestsForStores(storeIds);
  const signOutAction = requester.kind === "caixa" ? caixaSignOut : lojaGerenteSignOut;

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Estornos" subtitle="Solicitações de estorno enviadas pra o financeiro.">
        <div className="flex items-center gap-3">
          <Link
            href="/assistencia/estornos/solicitar"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
            style={{ background: "#1B5E3C" }}
          >
            + Nova solicitação
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Sair
            </button>
          </form>
        </div>
      </AssistenciaHeader>

      {requester.kind === "gerente" ? <LojaTabs /> : null}

      {enviado ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--status-good)", color: "var(--status-good)" }}>
          Solicitação enviada. O financeiro vai processar e você vê o resultado aqui.
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma solicitação de estorno ainda.</p>
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
                      {formatMoney(r.valorReembolso)} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                      {storeIds.length > 1 ? ` · ${r.storeName}` : ""}
                    </p>
                  </div>
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
                    <a href={r.anexoComprovanteUrl} target="_blank" rel="noopener noreferrer" className="underline self-start" style={{ color: "var(--status-good)" }}>
                      Ver comprovante do estorno
                    </a>
                  ) : null}
                  {r.status === "recusado" && r.motivoRecusa ? (
                    <p style={{ color: "var(--status-critical)" }}>Motivo da recusa: {r.motivoRecusa}</p>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <Link
        href={requester.kind === "gerente" ? "/assistencia/loja" : "/assistencia/encomendas/caixa"}
        className="text-sm underline self-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        ← Voltar
      </Link>
    </div>
  );
}
