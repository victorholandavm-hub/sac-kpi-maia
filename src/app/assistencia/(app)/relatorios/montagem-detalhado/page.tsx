import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPaymentItems, paymentStage, type PaymentItem } from "@/lib/payments";
import { getMontagemReconciliation } from "@/lib/serviceRequests";
import { MANOEL_ONLY_ASSEMBLER, STATUS_LABELS } from "@/lib/assistenciaLabels";
import { MontagemDetalhadoExportButton } from "@/components/assistencia/MontagemDetalhadoExportButton";

export const dynamic = "force-dynamic";

// Relatório de montagem detalhado -- pedido do Victor 29/08/2026: "seu
// antonio está achando esse numero 141 pouco para o volume a pagar
// alto, a media 92,87 por montagem, ta errado, a média é 39,49, ta mais
// que o dobro... preciso que voce coloque um botão na aba de relatorio
// chamado relatorio de montagem detalhado, onde você precisa colocar
// tudo detalhado de todas as montagens/desmontagens, produto por
// produto, valor por cada produto".
//
// A confusão do Antônio batia: "Solicitações no período" (uma
// solicitação de montagem/desmontagem) e "produtos" não são a mesma
// coisa -- uma solicitação pode ter VÁRIOS produtos, cada um com seu
// próprio valor (ver service_request_items). Dividir "total a pagar"
// pelo número de SOLICITAÇÕES (como o relatório principal mostra) dá
// uma média inflada, que não bate com o valor de verdade por produto.
// Esse relatório existe pra deixar isso explícito -- mostra os dois
// números lado a lado (Solicitações x Produtos) e todo produto de toda
// montagem/desmontagem, um por um, com o valor de cada um, pro Antônio
// conferir manualmente sem precisar confiar numa média de ninguém.
//
// Reaproveita listPaymentItems (mesma fonte de dado de /assistencia/
// pagamentos e do card "Total a pagar a montadores" em /assistencia/
// relatorios) -- só muda a apresentação: aqui é uma lista completa,
// sempre expandida, pensada pra conferência linha por linha, não uma
// tela de trabalho com abas Pendente/Pago pra marcar pagamento.
//
// Painel de reconciliação (ver getMontagemReconciliation, serviceRequests.ts)
// -- pergunta seguinte do Victor 29/08/2026, depois de ver esse relatório
// funcionando: "mas porque no relatorio aparece 142 solicitações e no
// detalhado aparece 136? Tem alguma de Manoel que entrou nesses
// calculos?" + "preciso que coloque essas informações em algum lugar da
// tela" (não bastava responder no chat). Explica a diferença -- nunca é
// só Manoel, também sobra o caso raro de chamado sem produto nenhum
// registrado (geralmente cancelado antes de ganhar item).
function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function itemTotal(item: PaymentItem): number {
  return (item.unitValue ?? 0) * item.quantity;
}

const STATUS_LABEL: Record<"a_montar" | "pendente" | "liberado", { label: string; color: string }> = {
  a_montar: { label: "A montar", color: "#9ca3af" },
  pendente: { label: "Pendente de liberação", color: "var(--status-warning)" },
  liberado: { label: "Pago", color: "var(--status-good)" },
};

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

function StatCard({ label, value, caption, barColor }: { label: string; value: string; caption?: string; barColor: string }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl py-3 pl-4 pr-4 flex flex-col gap-1 bg-white dark:bg-gray-800 shadow-sm"
      style={{ borderLeft: `4px solid ${barColor}` }}
    >
      <span className="text-sm truncate text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-2xl font-bold truncate text-gray-800 dark:text-gray-100">{value}</span>
      {caption ? <span className="text-xs truncate text-gray-400 dark:text-gray-500">{caption}</span> : null}
    </div>
  );
}

// Tabela linha-por-linha de um montador -- todo produto de toda
// montagem/desmontagem dele, sempre visível (sem recolher/expandir, ao
// contrário de AssemblerPaymentGroup em /assistencia/pagamentos, que é
// tela de trabalho). É exatamente o "minucioso" pedido -- ticket, data,
// loja, cliente, produto, quantidade, valor unitário, valor total e
// status de cada item, um embaixo do outro.
function AssemblerDetailTable({ assemblerName, items }: { assemblerName: string; items: PaymentItem[] }) {
  const total = items.reduce((sum, i) => sum + itemTotal(i), 0);
  return (
    <div className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 dark:border-gray-700">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {assemblerName}{" "}
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
            ({items.length} {items.length === 1 ? "produto" : "produtos"})
          </span>
        </span>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatBRL(total)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 720 }}>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
              <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Chamado</th>
              <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Data</th>
              <th className="text-left px-3 py-2 font-semibold">Loja</th>
              <th className="text-left px-3 py-2 font-semibold">Cliente</th>
              <th className="text-left px-3 py-2 font-semibold">Produto</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Qtd</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Valor unit.</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Valor total</th>
              <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((item) => {
              const status = STATUS_LABEL[paymentStage(item.requestStatus, item.paymentReleased)];
              return (
                <tr key={item.itemId}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-100">
                    <Link href={`/assistencia/${item.requestId}`} className="underline">
                      #{item.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDateBr(item.createdAt)}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{item.storeName || "—"}</td>
                  <td className="px-3 py-2 truncate max-w-[160px] text-gray-500 dark:text-gray-400" title={item.clientName ?? undefined}>
                    {item.clientName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{item.product}</td>
                  <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{item.quantity}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {item.unitValue !== null ? formatBRL(item.unitValue) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-gray-800 dark:text-gray-100">
                    {item.unitValue !== null ? formatBRL(itemTotal(item)) : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium" style={{ color: status.color }}>
                    {status.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Usado só pro link "Voltar pros Relatórios" carregar o mesmo período que
// tava sendo conferido aqui, em vez de resetar pro padrão (mês atual) --
// evita o Antônio ter que reaplicar o filtro de novo do outro lado.
function buildRelatoriosHref(params: { from: string; to: string; alvo?: string }) {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.alvo) sp.set("alvo", params.alvo);
  return `/assistencia/relatorios?${sp.toString()}`;
}

export default async function RelatorioMontagemDetalhadoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; alvo?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { from, to, alvo } = await searchParams;
  const dateFrom = from || firstDayOfMonth();
  const dateTo = to || today();
  const filterAlvo = alvo === "mostruario" || alvo === "cliente" ? alvo : undefined;

  const [rawItems, reconciliation] = await Promise.all([
    listPaymentItems({ dateFrom, dateTo, alvo: filterAlvo, includeNoValue: true }),
    getMontagemReconciliation({ dateFrom, dateTo, alvo: filterAlvo }),
  ]);
  // listPaymentItems traz item de QUALQUER tipo de solicitação (troca/
  // entrega de produto, envio/recolhimento de peça também têm itens) --
  // com includeNoValue:true (pra esse relatório mostrar até quem ainda
  // não tem valor definido), os outros tipos entravam junto. Esse
  // relatório é só de montagem/desmontagem (mesmo escopo do resto de
  // /assistencia/relatorios, ver REQUEST_REPORT_TYPES lá).
  const allItems = rawItems.filter((i) => i.type === "montagem" || i.type === "desmontagem");

  // Manoel é o único montador funcionário nosso, não terceirizado (ver
  // MANOEL_ONLY_ASSEMBLER/MANOEL_ONLY_TYPES, assistenciaLabels.ts) --
  // pedido explícito: "lembre que manoel nao entra nessa conta, pois é
  // de casa, tudo o que for dele, você coloca a parte". Fora da soma
  // principal, numa seção própria lá embaixo.
  const manoelItems = allItems.filter((i) => i.assemblerName === MANOEL_ONLY_ASSEMBLER);
  const items = allItems.filter((i) => i.assemblerName !== MANOEL_ONLY_ASSEMBLER);

  const groups = groupByAssembler(items);
  const totalValue = items.reduce((sum, i) => sum + itemTotal(i), 0);
  const distinctRequests = new Set(items.map((i) => i.requestId)).size;
  // Achado 29/08/2026 (revisão pedida pelo Victor): a média precisa
  // dividir só pelos produtos que TÊM valor definido (unitValue !== null),
  // não por `items.length` inteiro -- produto ainda "a montar" (sem valor)
  // contribui 0 pro total, mas contava no denominador, diluindo a média
  // pra baixo (achado via SQL: 336 produtos no período, só 300 com valor
  // -- dividir por 336 dava R$ 40,46, o certo é R$ 45,32). Justamente o
  // tipo de erro que esse relatório existe pra eliminar, então precisa
  // estar certo aqui de todo jeito.
  const pricedItems = items.filter((i) => i.unitValue !== null);
  const avgPerItem = pricedItems.length > 0 ? totalValue / pricedItems.length : 0;
  const avgPerRequest = distinctRequests > 0 ? totalValue / distinctRequests : 0;

  const manoelGroups = groupByAssembler(manoelItems);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Relatório de montagem detalhado</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todo produto de toda montagem/desmontagem no período, um por um -- pra conferir o valor certinho. Manoel (equipe interna) fica separado embaixo.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MontagemDetalhadoExportButton items={allItems} />
          <Link href={buildRelatoriosHref({ from: dateFrom, to: dateTo, alvo: filterAlvo })} className="text-sm underline whitespace-nowrap text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            ← Voltar pros Relatórios
          </Link>
        </div>
      </div>

      <form action="/assistencia/relatorios/montagem-detalhado" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterAlvo ? <input type="hidden" name="alvo" value={filterAlvo} /> : null}
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          De
          <input type="date" name="from" defaultValue={dateFrom} className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          Até
          <input type="date" name="to" defaultValue={dateTo} className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
          Aplicar
        </button>
      </form>

      {/* Solicitações x Produtos lado a lado -- é exatamente a confusão
          que gerou esse pedido (média calculada em cima do número
          errado). Valor médio por SOLICITAÇÃO também aparece, só pra
          deixar claro visualmente por que ele é maior que o médio por
          PRODUTO -- uma solicitação pode ter vários produtos. */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Solicitações no período (terceirizados)" value={String(distinctRequests)} barColor="var(--series-5)" />
        <StatCard label="Produtos no período (terceirizados)" value={String(items.length)} barColor="var(--series-2)" />
        <StatCard label="Total a pagar (terceirizados)" value={formatBRL(totalValue)} barColor="var(--series-4)" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard
          label="Valor médio por produto (o número certo)"
          value={formatBRL(avgPerItem)}
          caption={
            pricedItems.length < items.length
              ? `Considerando os ${pricedItems.length} produtos com valor definido, de ${items.length} no total`
              : undefined
          }
          barColor="var(--status-good)"
        />
        <StatCard label="Valor médio por solicitação (não é o mesmo)" value={formatBRL(avgPerRequest)} barColor="#9ca3af" />
      </div>

      {/* Reconciliação com o "Solicitações no período" do relatório
          principal -- pedido do Victor 29/08/2026: "mas porque no
          relatorio aparece 142 solicitações e no detalhado aparece 136?
          Tem alguma de Manoel que entrou nesses calculos?", seguido de
          "preciso que coloque essas informações em algum lugar da
          tela". A conta bate: total do relatório principal MENOS Manoel
          MENOS chamado sem produto nenhum registrado (normalmente
          cancelado antes de chegar a ter item) = o total daqui. */}
      {reconciliation.totalRequests !== distinctRequests ? (
        <div className="rounded-xl p-4 flex flex-col gap-2 bg-white dark:bg-gray-800 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            Por que esse número é diferente do &quot;Solicitações no período&quot; do relatório principal?
          </h3>
          <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-between gap-4">
              <span>Solicitações no relatório principal (qualquer montador, com ou sem produto)</span>
              <span className="font-medium text-gray-800 dark:text-gray-100">{reconciliation.totalRequests}</span>
            </div>
            {reconciliation.manoelRequests > 0 ? (
              <div className="flex justify-between gap-4">
                <span>(−) Manoel (equipe interna, não entra aqui)</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{reconciliation.manoelRequests}</span>
              </div>
            ) : null}
            {reconciliation.emptyRequests.length > 0 ? (
              <div className="flex justify-between gap-4">
                <span>(−) Sem produto nenhum registrado (nada pra listar aqui)</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{reconciliation.emptyRequests.length}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
              <span>(=) Solicitações neste relatório</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{distinctRequests}</span>
            </div>
          </div>
          {reconciliation.emptyRequests.length > 0 ? (
            <div className="flex flex-col gap-1 pt-2 mt-1 border-t border-dashed border-gray-200 dark:border-gray-600">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Chamados sem produto registrado:</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {reconciliation.emptyRequests.map((r) => (
                  <Link key={r.id} href={`/assistencia/${r.id}`} className="underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    #{r.ticketNumber} · {r.storeName} · {STATUS_LABELS[r.status] ?? r.status}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma montagem/desmontagem de terceirizado nesse período.</p>
        </div>
      ) : (
        groups.map((group) => <AssemblerDetailTable key={group.assemblerName} assemblerName={group.assemblerName} items={group.items} />)
      )}

      {manoelItems.length > 0 ? (
        <div className="flex flex-col gap-3 pt-2 border-t-2 border-dashed border-gray-200 dark:border-gray-600">
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Manoel (equipe interna)</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Funcionário da casa, não terceirizado -- não entra em nenhum dos números acima, só listado aqui por registro.
            </p>
          </div>
          {manoelGroups.map((group) => (
            <AssemblerDetailTable key={group.assemblerName} assemblerName={group.assemblerName} items={group.items} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
