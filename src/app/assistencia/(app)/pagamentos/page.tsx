import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPaymentItems, listAssemblers, paymentStage, type PaymentItem } from "@/lib/payments";
import { PAYMENTS_CONTROLLER_NAME } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { PaymentsExportButton } from "@/components/assistencia/PaymentsExportButton";
import { AssemblerPaymentGroup } from "@/components/assistencia/AssemblerPaymentGroup";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildHref(params: { pendentes?: string; assembler?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (params.pendentes) sp.set("pendentes", params.pendentes);
  if (params.assembler) sp.set("assembler", params.assembler);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return qs ? `/assistencia/pagamentos?${qs}` : "/assistencia/pagamentos";
}

function groupByAssembler(items: PaymentItem[]) {
  const groups: { assemblerName: string; items: PaymentItem[] }[] = [];
  for (const item of items) {
    const name = item.assemblerName ?? "Sem montador definido";
    let group = groups.find((g) => g.assemblerName === name);
    if (!group) {
      group = { assemblerName: name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.sort((a, b) => a.assemblerName.localeCompare(b.assemblerName));
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ pendentes?: string; assembler?: string; from?: string; to?: string }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  // Mesma checagem de requirePaymentsController (pagamentos-actions.ts) --
  // controla tanto o botão de exportar quanto a edição inline de valor/
  // aprovação/autorização aqui na tela.
  const canExport = profile.fullName === PAYMENTS_CONTROLLER_NAME;
  const { pendentes, assembler, from, to } = await searchParams;
  // Filtra pela data da solicitação (quando a montagem foi pedida), não pela
  // data do pagamento -- decisão do usuário 13/08/2026: itens ainda não
  // pagos continuam aparecendo mesmo filtrando um período passado.
  const [rawItems, assemblers] = await Promise.all([
    listPaymentItems({ assemblerName: assembler, includeNoValue: true, dateFrom: from, dateTo: to }),
    listAssemblers(),
  ]);
  // Esconde "ainda em andamento e sem valor" -- isso não é acionável (a
  // montagem nem terminou) e seria só ruído. O que precisa de atenção do
  // Antonio é quem já tem valor (qualquer status), quem já concluiu mas
  // ainda não tem valor, ou quem tá esperando o gerente aprovar -- essa
  // última também precisa aparecer (só sem a opção de definir valor ainda,
  // ver isAwaitingApproval em PaymentItemEditor.tsx), senão o chamado some
  // da tela do Antonio inteiro enquanto aguarda a loja (achado testando o
  // fluxo ao vivo 02/09/2026 -- pedido original do Victor era "enquanto
  // isso, na tela do seu antonio deve aparecer que está pendente de
  // aprovação do gerente").
  const allItems = rawItems.filter(
    (i) => i.unitValue !== null || i.requestStatus === "concluida" || i.requestStatus === "aguardando_aprovacao"
  );
  const items = pendentes ? allItems.filter((i) => paymentStage(i.requestStatus, i.paymentReleased) === "pendente") : allItems;
  const groups = groupByAssembler(items);
  const grandTotal = items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
  const pendingTotal = items
    .filter((i) => paymentStage(i.requestStatus, i.paymentReleased) === "pendente")
    .reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
  // "Pago" = soma do que o Antonio já marcou como pago (payment_released) --
  // junto com "Pendente" ao lado, deixa visível o desconto: Total = Pago +
  // Pendente (+ o que ainda tá "a montar", sem entrar na conta de nenhum
  // dos dois).
  const paidTotal = items.filter((i) => i.paymentReleased).reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill label="Todos" selected={!pendentes} href={buildHref({ assembler, from, to })} />
          <FilterPill label="Só pendentes de liberação" selected={!!pendentes} href={buildHref({ pendentes: "1", assembler, from, to })} />
          <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
          <form action="/assistencia/pagamentos" method="GET" className="flex items-center gap-2 flex-wrap">
            {pendentes ? <input type="hidden" name="pendentes" value={pendentes} /> : null}
            {assembler ? <input type="hidden" name="assembler" value={assembler} /> : null}
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
              De
              <input type="date" name="from" defaultValue={from ?? ""} className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs" />
            </label>
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
              Até
              <input type="date" name="to" defaultValue={to ?? ""} className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs" />
            </label>
            <button type="submit" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 font-medium whitespace-nowrap text-gray-800 dark:text-gray-100">
              Aplicar
            </button>
            {from || to ? (
              <Link href={buildHref({ pendentes, assembler })} className="text-xs underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Limpar data
              </Link>
            ) : null}
          </form>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total: <strong>{formatBRL(grandTotal)}</strong> · Pago:{" "}
            <strong style={{ color: "var(--status-good)" }}>{formatBRL(paidTotal)}</strong> · Pendente:{" "}
            <strong style={{ color: "var(--status-warning)" }}>{formatBRL(pendingTotal)}</strong>
          </div>
          {canExport ? <PaymentsExportButton items={items} /> : null}
          <Link
            href="/assistencia/nova-rapida"
            className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
            style={{ background: "#1B5E3C" }}
          >
            + Nova
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {assembler
              ? "Nenhuma montagem desse montador encontrada."
              : pendentes
                ? "Nada pendente de valor ou liberação no momento."
                : "Nenhuma montagem encontrada."}
          </p>
        </div>
      ) : (
        groups.map((group) => {
          const total = group.items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
          return (
            <AssemblerPaymentGroup
              key={group.assemblerName}
              assemblerName={group.assemblerName}
              items={group.items}
              total={total}
              canEdit={canExport}
              // Aberto de cara só quando esse montador já foi escolhido no
              // filtro, ou quando é o único grupo na tela -- senão fica
              // recolhido, pra não ter que descer passando pelas montagens
              // de todo mundo só pra ver o próximo montador.
              defaultOpen={group.assemblerName === assembler || groups.length === 1}
            />
          );
        })
      )}
    </div>
  );
}
