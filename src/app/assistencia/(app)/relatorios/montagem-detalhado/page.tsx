import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPaymentItems, paymentStage, type PaymentItem } from "@/lib/payments";
import { MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";

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
  a_montar: { label: "A montar", color: "var(--text-muted)" },
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

function StatCard({ label, value, barColor }: { label: string; value: string; barColor: string }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl py-3 pl-4 pr-4 flex flex-col gap-1"
      style={{ background: "var(--surface-1)", borderLeft: `4px solid ${barColor}`, boxShadow: "0 1px 3px rgba(11,11,11,0.08)" }}
    >
      <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
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
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-1)", boxShadow: "0 1px 3px rgba(11,11,11,0.08)" }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {assemblerName}{" "}
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
            ({items.length} {items.length === 1 ? "produto" : "produtos"})
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {formatBRL(total)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 720 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
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
          <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {items.map((item) => {
              const status = STATUS_LABEL[paymentStage(item.requestStatus, item.paymentReleased)];
              return (
                <tr key={item.itemId}>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    <Link href={`/assistencia/${item.requestId}`} className="underline">
                      #{item.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {formatDateBr(item.createdAt)}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                    {item.storeName || "—"}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[160px]" style={{ color: "var(--text-secondary)" }} title={item.clientName ?? undefined}>
                    {item.clientName ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                    {item.product}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {item.unitValue !== null ? formatBRL(item.unitValue) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
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

  const rawItems = await listPaymentItems({ dateFrom, dateTo, alvo: filterAlvo, includeNoValue: true });
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
  const avgPerItem = items.length > 0 ? totalValue / items.length : 0;
  const avgPerRequest = distinctRequests > 0 ? totalValue / distinctRequests : 0;

  const manoelGroups = groupByAssembler(manoelItems);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Relatório de montagem detalhado
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Todo produto de toda montagem/desmontagem no período, um por um -- pra conferir o valor certinho. Manoel (equipe interna) fica separado embaixo.
          </p>
        </div>
        <Link href={buildRelatoriosHref({ from: dateFrom, to: dateTo, alvo: filterAlvo })} className="text-sm underline whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          ← Voltar pros Relatórios
        </Link>
      </div>

      <form action="/assistencia/relatorios/montagem-detalhado" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterAlvo ? <input type="hidden" name="alvo" value={filterAlvo} /> : null}
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          De
          <input type="date" name="from" defaultValue={dateFrom} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Até
          <input type="date" name="to" defaultValue={dateTo} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
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
        <StatCard label="Valor médio por produto (o número certo)" value={formatBRL(avgPerItem)} barColor="var(--status-good)" />
        <StatCard label="Valor médio por solicitação (não é o mesmo)" value={formatBRL(avgPerRequest)} barColor="var(--text-muted)" />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma montagem/desmontagem de terceirizado nesse período.
          </p>
        </div>
      ) : (
        groups.map((group) => <AssemblerDetailTable key={group.assemblerName} assemblerName={group.assemblerName} items={group.items} />)
      )}

      {manoelItems.length > 0 ? (
        <div className="flex flex-col gap-3 pt-2" style={{ borderTop: "2px dashed var(--border)" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Manoel (equipe interna)
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
