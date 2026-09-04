import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getRequestsReport, getServiceTypeIndicators, type ReportRow, type ReportRowItem, type IndicatorItem, type RequestType } from "@/lib/serviceRequests";
import { listPaymentItems, paymentStage, type PaymentItem } from "@/lib/payments";
import { getSupplierReconciliation, type SupplierReconciliationItem } from "@/lib/supplierReturns";
import {
  REQUEST_TYPE_LABELS,
  CAUSA_RAIZ_LABELS,
  CAUSA_RAIZ_ERRO_INTERNO,
  STATUS_LABELS,
  STATUS_COLORS,
  SUPPLIER_RETURN_STATUS_LABELS,
  MANOEL_ONLY_ASSEMBLER,
} from "@/lib/assistenciaLabels";
import { CausaRaizDonutChart } from "@/components/CausaRaizDonutChart";
import { PagamentoPorMontadorExportButton } from "@/components/assistencia/PagamentoPorMontadorExportButton";

// Seletor de Tipo da seção Indicadores -- pedido do Victor 28/08/2026:
// "no filtros nao precisa ter recolhimento de peça e envio de peça e
// notificação externa e nem vistoria. só montagem e desmontagem". Essa
// tela é especificamente de relatório de MONTAGEM (ver
// REQUEST_REPORT_TYPES logo abaixo, já restrito aos dois desde
// 24/08/2026) -- os outros tipos de assistência (recolhimento/troca de
// peça/vistoria/notificação externa) saem do seletor por não fazerem
// sentido aqui. Com só 2 tipos sobrando, "Todos os tipos" virou
// sinônimo exato de "Montagem/Desmontagem (junto)" -- removido daqui
// por ser redundante, só sobrou o combinado.
const REQUEST_TYPES = ["montagem", "desmontagem"] as const;

// Opções do seletor "Tipo" da seção Indicadores -- pedido do Victor
// 27/08/2026: "nos filtros por tipo, tenha a opção de montagem/
// desmontagem, juntos acumulando os dois dentro de um só mas mantenha a
// opção deles separados também". "montagem_desmontagem" é só mais uma
// combinação de tipos (ver indicatorTypesFor) -- nenhum tipo sai do
// seletor, só ganhou essa opção extra que soma Montagem + Desmontagem
// sem substituir as duas separadas.
const INDICATOR_TYPE_GROUPS: Record<string, { label: string; types: readonly RequestType[] }> = {
  montagem_desmontagem: { label: "montagem/desmontagem", types: ["montagem", "desmontagem"] },
};

function resolveIndicatorTypeKey(tipo: string | undefined): string {
  if (tipo && tipo in INDICATOR_TYPE_GROUPS) return tipo;
  if ((REQUEST_TYPES as readonly string[]).includes(tipo ?? "")) return tipo!;
  return "montagem";
}

function indicatorTypesFor(key: string): RequestType[] {
  const group = INDICATOR_TYPE_GROUPS[key];
  if (group) return [...group.types];
  return [key as RequestType];
}

function indicatorLabelFor(key: string): string {
  const group = INDICATOR_TYPE_GROUPS[key];
  if (group) return group.label;
  return REQUEST_TYPE_LABELS[key]?.toLowerCase() ?? key;
}

// As 3 visões da seção Indicadores viraram abas -- pedido do Victor
// 28/08/2026 (redesign): "Visão Mensal / Desempenho por Montador /
// Análise por Loja", cada uma em largura total (antes Por montador/Por
// loja dividiam a tela em 2 colunas). `indicators` (getServiceTypeIndicators)
// já traz os 3 conjuntos de uma vez só -- a aba só decide qual reaproveitar
// no render, sem custo extra de busca.
const INDICATOR_TABS = [
  { key: "mensal", label: "Visão Mensal" },
  { key: "montador", label: "Desempenho por Montador" },
  { key: "loja", label: "Análise por Loja" },
] as const;
type IndicatorTabKey = (typeof INDICATOR_TABS)[number]["key"];

function resolveIndicatorTab(value: string | undefined): IndicatorTabKey {
  return value === "montador" || value === "loja" ? value : "mensal";
}

// "Solicitações por período" (relatório principal: loja/tipo/vendedor/
// causa raiz) -- pedido do Victor 24/08/2026: "nas solicitações por
// periodo, deve mostrar apenas solicitações de montagem/desmontagem".
// Antes trazia todos os tipos juntos (troca de produto, entrega, etc.) --
// não fazia sentido pro filtro mostruário x cliente logo abaixo (só
// existe pra montagem: "loja monta pra exposição própria"), nem pro
// pagamento de montador na sequência (que só paga item de montagem/
// desmontagem).
const REQUEST_REPORT_TYPES = ["montagem", "desmontagem"] as const;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTH_ABBREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_ABBREV[Number(m) - 1]}/${y}`;
}

// Tempo médio -- pedido do Victor 28/08/2026 (redesign): "mude o
// cabeçalho para 'Tempo médio (dias)' e exiba apenas o valor numérico
// puro (ex: 2,9 em vez de '2.9 dias')" -- unidade sai do cabeçalho da
// coluna, valor vira só o número com vírgula decimal (pt-BR).
function formatDaysNumber(days: number | null): string {
  if (days === null) return "—";
  return Math.max(0, days).toFixed(1).replace(".", ",");
}

function formatDateBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// Manoel é o único montador funcionário nosso (o resto é terceirizado, ver
// MANOEL_ONLY_ASSEMBLER/MANOEL_ONLY_TYPES em assistenciaLabels.ts) --
// pedido do Victor 21/08/2026: "Colocar Manoel pra baixo na lista de
// montadores pois ele é o único que é funcionário nosso e não
// terceirizado". Não muda a ordenação por total (continua maior pro
// menor) -- só empurra a linha do Manoel pro final da lista, mesmo que o
// total dele fosse alto o bastante pra aparecer no meio.
function sortManoelLast<T>(rows: T[], nameOf: (r: T) => string): T[] {
  const rest = rows.filter((r) => nameOf(r) !== MANOEL_ONLY_ASSEMBLER);
  const manoel = rows.filter((r) => nameOf(r) === MANOEL_ONLY_ASSEMBLER);
  return [...rest, ...manoel];
}

// Monta o href preservando TODOS os filtros da página -- data (agora
// única, ver RelatoriosPage), alvo, tipo e a aba de Indicadores ativa.
// Cada Link (segmented control de Alvo, abas de Indicadores) só passa o
// campo que está mudando, os outros vêm do estado atual da página.
function buildReportHref(params: { from?: string; to?: string; alvo?: string; tipo?: string; indTab?: string }) {
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.alvo) sp.set("alvo", params.alvo);
  if (params.tipo) sp.set("tipo", params.tipo);
  if (params.indTab && params.indTab !== "mensal") sp.set("indTab", params.indTab);
  const qs = sp.toString();
  return qs ? `/assistencia/relatorios?${qs}` : "/assistencia/relatorios";
}

// Filtro "montagem de mostruário" x "cliente" -- pedido do Victor
// 21/08/2026: "coloque Filtro de montagem de mostruário e cliente".
// Afeta o relatório principal (getRequestsReport), pagamento de montador
// (listPaymentItems) e a seção de Indicadores (getServiceTypeIndicators).
const ALVO_FILTERS: { label: string; value: "mostruario" | "cliente" | undefined }[] = [
  { label: "Todos", value: undefined },
  { label: "Mostruário", value: "mostruario" },
  { label: "Cliente", value: "cliente" },
];

// Cartão branco com barra lateral colorida -- redesign pedido do Victor
// 28/08/2026: "fundos brancos com bordas arredondadas e sombras suaves...
// barra lateral fina vertical (4px) na borda esquerda pra indicar status
// pela cor... títulos em tamanho menor, números em destaque principal".
function KpiCardWhite({ label, value, barColor, big }: { label: string; value: string; barColor: string; big?: boolean }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl py-3 pl-4 pr-4 flex flex-col gap-1 bg-white dark:bg-gray-800 shadow-sm"
      style={{ borderLeft: `4px solid ${barColor}` }}
    >
      <span className="text-sm truncate text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`${big ? "text-3xl" : "text-2xl"} font-bold truncate text-gray-800 dark:text-gray-100`}>{value}</span>
    </div>
  );
}

// Linha de detalhe de um chamado, dentro de uma linha expandida -- mesmo
// formato reaproveitado nas 3 tabelas de indicadores por tipo (mês/
// montador/loja) e no relatório principal (loja/tipo/vendedor/causa raiz).
// `showType` só liga quando mais de um tipo tá misturado na mesma lista
// ("Montagem/Desmontagem" juntos) -- com um tipo só selecionado, repetir
// o tipo em toda linha é ruído (já está no título da seção).
function IndicatorItemsList({ items, showType }: { items: IndicatorItem[]; showType?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
      {items.map((it) => (
        <div key={it.id} className="pl-6 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-left text-gray-800 dark:text-gray-100">
            #{it.ticketNumber}
            {showType ? ` · ${REQUEST_TYPE_LABELS[it.type] ?? it.type}` : ""} · {it.clientName ?? "Sem cliente"} · {formatDateBr(it.createdAt)}
          </span>
          <span className="shrink-0 font-medium text-right" style={{ color: STATUS_COLORS[it.status] ?? "#9ca3af" }}>
            {STATUS_LABELS[it.status] ?? it.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// Linha de detalhe de um chamado do relatório principal -- inclui tipo
// (as tabelas dele misturam tipos diferentes, diferente das de
// indicadores, que já filtram por um tipo só).
function ReportRowItemsList({ items }: { items: ReportRowItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
      {items.map((it) => (
        <div key={it.id} className="pl-6 pr-4 py-1.5 flex flex-col gap-0.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-left text-gray-800 dark:text-gray-100">
              #{it.ticketNumber} · {REQUEST_TYPE_LABELS[it.type] ?? it.type} · {it.storeName} · {formatDateBr(it.createdAt)}
            </span>
            <span className="shrink-0 font-medium text-right" style={{ color: STATUS_COLORS[it.status] ?? "#9ca3af" }}>
              {STATUS_LABELS[it.status] ?? it.status}
            </span>
          </div>
          {/* O que aconteceu de verdade -- pedido do Victor 24/08/2026: ao
              clicar num grupo de causa raiz (ex.: "Erro do vendedor"),
              "preciso que apareça qual foi o erro ao clicar, e não em
              quais chamados foram os erros". Número do chamado sozinho
              não dizia o quê -- `reason` é a descrição livre do
              problema, preenchida na criação do chamado. */}
          {it.reason ? (
            <span className="truncate text-left text-gray-500 dark:text-gray-400" title={it.reason}>
              {it.reason}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Cabeçalho de colunas fixo, acima da lista de linhas expansíveis --
// texto (1ª coluna) sempre à esquerda, números sempre à direita --
// pedido do Victor 28/08/2026 (redesign): "alinhamento estrito". Sem
// coluna reservada pra seta (removida, ver ExpandableRow) -- o texto
// começa direto na borda esquerda do card.
function ColumnsHeader({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
      <span className="flex-1 min-w-0 text-left">{columns[0]}</span>
      {columns.slice(1).map((c) => (
        <span key={c} className="w-20 shrink-0 text-right">
          {c}
        </span>
      ))}
    </div>
  );
}

function ExpandableRow({
  label,
  numbers,
  children,
}: {
  // ReactNode (não só string) -- pedido do Victor 22/08/2026: "Destaque os
  // erros operacionais internos... com badges", precisa caber um badge ao
  // lado do texto (ver Causa Raiz mais abaixo). Continua funcionando igual
  // pras chamadas que só passam string (loja, vendedor, montador etc.).
  label: React.ReactNode;
  numbers: { value: number | string; color?: string }[];
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      {/* Seta ► removida -- pedido do Victor 28/08/2026 (redesign):
          "substitua o ícone de seta por linhas horizontais sutis pra
          separar os registros, mantendo o visual limpo e plano". A linha
          já vem separada pelo divide-y do container pai -- aqui só sobra
          o hover pra indicar que a linha é clicável (expande o detalhe
          dos chamados por trás). */}
      <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 dark:hover:bg-gray-700">
        <span className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-left text-gray-800 dark:text-gray-100">
          {typeof label === "string" ? <span className="truncate">{label}</span> : label}
        </span>
        {numbers.map((n, i) => (
          <span key={i} className="w-20 shrink-0 text-right text-sm" style={{ color: n.color ?? "#1f2937" }}>
            {n.value}
          </span>
        ))}
      </summary>
      {children}
    </details>
  );
}

// Card branco com sombra suave -- padrão compartilhado por toda seção da
// página (Indicadores, tabelas de relatório, pagamento, causa raiz,
// reconciliação) -- redesign pedido do Victor 28/08/2026: "remova o
// contorno/borda cinza externa... fundos brancos com sombras suaves".
// Substitui a antiga borda grossa `2px solid var(--brand-green)`.
const CARD_CLASS = "rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm";

// Linhas além do Top 5 ficam recolhidas num "Ver todos" -- pedido do Victor
// 22/08/2026: "Nas tabelas longas... exiba os Top 5 inicialmente e insira
// um botão Ver todos (19) para expandir, mantendo a tela compacta". Mesmo
// truque de sempre nessa tela: <details> nativo aninhado, sem JS extra --
// as linhas já vêm ordenadas por total (maior primeiro, ver
// getRequestsReport), então "Top 5" é literalmente as 5 primeiras.
const TOP_N = 5;

function ReportTable({
  title,
  rows,
  keyLabel,
  emptyMessage,
  labelFor = (key) => key,
  limitRows = false,
}: {
  title: string;
  rows: ReportRow[];
  keyLabel: string;
  emptyMessage: string;
  labelFor?: (key: string) => string;
  limitRows?: boolean;
}) {
  const visible = limitRows ? rows.slice(0, TOP_N) : rows;
  const hidden = limitRows ? rows.slice(TOP_N) : [];

  function renderRow(r: ReportRow) {
    return (
      <ExpandableRow
        key={r.key}
        label={labelFor(r.key)}
        numbers={[
          { value: r.total },
          { value: r.concluida, color: "var(--status-good)" },
          { value: r.cancelada, color: "#9ca3af" },
        ]}
      >
        <ReportRowItemsList items={r.items} />
      </ExpandableRow>
    );
  }

  return (
    <details className={`${CARD_CLASS} overflow-hidden`}>
      <summary className="text-base font-bold cursor-pointer px-4 py-3 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">
        {title} ({rows.length})
      </summary>
      {rows.length === 0 ? (
        <p className="text-sm p-4 text-gray-400 dark:text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        <div>
          <ColumnsHeader columns={[keyLabel, "Total", "Concluídas", "Canceladas"]} />
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {visible.map(renderRow)}
          </div>
          {hidden.length > 0 ? (
            <details className="group/vertodos">
              <summary
                className="text-xs font-semibold cursor-pointer list-none px-4 py-2.5 text-center border-t border-gray-100 dark:border-gray-700"
                style={{ color: "var(--brand-green)" }}
              >
                <span className="group-open/vertodos:hidden">Ver todos ({hidden.length})</span>
                <span className="hidden group-open/vertodos:inline">Mostrar menos</span>
              </summary>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {hidden.map(renderRow)}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </details>
  );
}

// Badge de retrabalho interno -- pedido do Victor 22/08/2026: "Destaque os
// erros operacionais internos (Erro de conferência, Erro do vendedor, Erro
// do motorista) com badges amarelas/vermelhas para chamar a atenção da
// gestão para o retrabalho interno". Ver CAUSA_RAIZ_ERRO_INTERNO.
function ErroInternoBadge() {
  return (
    <span
      title="Retrabalho interno -- erro do time, não externo"
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 cursor-help"
      style={{ background: "var(--status-critical)", color: "#fff" }}
    >
      ⚠ Interno
    </span>
  );
}

// Barra de progresso financeira -- pedido do Victor 22/08/2026: "Na tabela
// de Pagamento por montador, adicione uma barra de progresso visual
// mostrando a porcentagem do valor que já foi pago em relação ao total a
// liberar".
function PaymentProgressBar({ pago, total }: { pago: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--status-good)" }} />
      </div>
      <span className="text-[11px] shrink-0 text-gray-400 dark:text-gray-500">{pct}% pago</span>
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tipo?: string; alvo?: string; indTab?: string }>;
}) {
  redirectIfSac(await getProfile());
  const { from, to, tipo, alvo, indTab: indTabParam } = await searchParams;
  // Data única pra página inteira -- redesign pedido do Victor 28/08/2026:
  // "elimine qualquer duplicidade de filtros de data... mantenha apenas
  // UM seletor de data global". Antes a seção Indicadores tinha um
  // intervalo próprio (padrão: 6 meses atrás), separado do relatório
  // principal/pagamento (padrão: mês atual) -- unificado de propósito,
  // os dois agora sempre usam o mesmo período. Isso muda o padrão da
  // seção Indicadores (era 6 meses, passa a ser o mês atual, igual ao
  // resto da página).
  const dateFrom = from || firstDayOfMonth();
  const dateTo = to || today();
  const filterAlvo = alvo === "mostruario" || alvo === "cliente" ? alvo : undefined;
  const indTab = resolveIndicatorTab(indTabParam);

  // "Todos" -- pedido do Victor 21/08/2026: "preciso que tenha uma opção
  // no seletor para 'ver tudo'". "Montagem/Desmontagem" junto, pedido do
  // Victor 27/08/2026 -- ver INDICATOR_TYPE_GROUPS acima.
  const indicatorTypeKey = resolveIndicatorTypeKey(tipo);
  const indicatorTypes = indicatorTypesFor(indicatorTypeKey);

  const [report, paymentItems, supplierReconciliation, indicators] = await Promise.all([
    getRequestsReport({ dateFrom, dateTo, alvo: filterAlvo, types: [...REQUEST_REPORT_TYPES] }),
    // Filtro mostruário x cliente também vale pro pagamento de montador --
    // achado do Victor 24/08/2026: "quando filtrar, o numero de
    // solicitações, total a pagar a montadores, pago e penente de
    // liberação deve ser filtrado" (antes só filtrava a tabela de cima).
    // includeNoValue: true -- achado do Victor 03/09/2026: "LUCIANO216 está
    // com 61 itens [na aba Pagamentos], mas no relatório ele aparece com 60
    // itens". Sem esse filtro, listPaymentItems descarta todo item sem
    // valor definido ainda ANTES de chegar aqui -- inclusive item de
    // montagem já CONCLUÍDA, só que o Antônio ainda não definiu o preço
    // (mesmo caso que a aba Pagamentos mostra de propósito, "precisa de
    // atenção", ver allItems em pagamentos/page.tsx). O "itens" contado
    // abaixo silenciosamente ficava menor que a realidade -- não só de
    // LUCIANO216: conferido no banco, Luanderson (-19), JOAO 214 (-9),
    // Gabriel (-4), Paulo (-3), Junior (-2) e outros tinham a mesma
    // divergência. Busca tudo aqui, filtro equivalente ao de
    // pagamentos/page.tsx logo abaixo (no loop de byAssembler) -- widget de
    // $ continua correto (item sem valor soma 0), só o "itens" que estava
    // errado.
    listPaymentItems({ dateFrom, dateTo, alvo: filterAlvo, includeNoValue: true }),
    getSupplierReconciliation(),
    // Alvo (mostruário/cliente) também vale pra Indicadores -- pedido do
    // Victor 27/08/2026. Data agora é a mesma `dateFrom`/`dateTo` do
    // resto da página (ver comentário acima).
    getServiceTypeIndicators(indicatorTypes, { dateFrom, dateTo, alvo: filterAlvo }),
  ]);

  // Mesmo critério de "precisa de atenção do Antônio" da aba Pagamentos
  // (allItems em pagamentos/page.tsx) -- só isso deixa "itens" (e os cards
  // de $ acima) baterem entre as duas telas. Esconde só quem tá em
  // andamento/aberto e ainda sem valor nenhum (não é acionável ainda).
  const reportablePaymentItems = paymentItems.filter(
    (i) => i.unitValue !== null || i.requestStatus === "concluida" || i.requestStatus === "aguardando_aprovacao"
  );
  const byAssembler = new Map<string, { total: number; pendente: number; pago: number; itens: number; items: PaymentItem[] }>();
  for (const item of reportablePaymentItems) {
    const name = item.assemblerName ?? "Sem montador definido";
    const entry = byAssembler.get(name) ?? { total: 0, pendente: 0, pago: 0, itens: 0, items: [] };
    const value = (item.unitValue ?? 0) * item.quantity;
    entry.total += value;
    entry.itens += 1;
    entry.items.push(item);
    if (item.paymentReleased) entry.pago += value;
    else if (paymentStage(item.requestStatus, item.paymentReleased) === "pendente") entry.pendente += value;
    byAssembler.set(name, entry);
  }
  const assemblerRows = sortManoelLast([...byAssembler.entries()].sort((a, b) => b[1].total - a[1].total), ([name]) => name);
  // "Total" aqui é tudo que tem valor definido (inclusive item ainda não
  // montado, com valor pré-definido) -- mesmo critério de "Total" na aba
  // Pagamentos (ver pagamentos/page.tsx). "Pago" é só o que já foi
  // liberado.
  //
  // Manoel continua aparecendo como linha própria em "Pagamento por
  // montador" (sortManoelLast só reordena, não remove) -- mas NÃO entra
  // nos 3 cards de KPI acima da tabela. Achado 29/08/2026 (revisão pedida
  // pelo Victor): esses cards não excluíam Manoel, ao contrário do
  // Relatório de montagem detalhado (pedido explícito: "manoel nao entra
  // nessa conta, pois é de casa"). Hoje não muda nenhum número (Manoel não
  // tem item com valor definido ainda), mas sem essa exclusão os dois
  // relatórios divergiriam silenciosamente no dia que algum item dele
  // ganhasse valor, sem nenhum painel de reconciliação avisando (esse
  // painel, ver montagem-detalhado/page.tsx, só compara "Solicitações",
  // não "Total a pagar").
  const paymentEntriesExcludingManoel = assemblerRows.filter(([name]) => name !== MANOEL_ONLY_ASSEMBLER);
  const paymentTotal = paymentEntriesExcludingManoel.reduce((sum, [, v]) => sum + v.total, 0);
  const paymentPending = paymentEntriesExcludingManoel.reduce((sum, [, v]) => sum + v.pendente, 0);
  const paymentPaid = paymentEntriesExcludingManoel.reduce((sum, [, v]) => sum + v.pago, 0);

  const indicatorsByAssembler = sortManoelLast(indicators.byAssembler, (a) => a.assemblerName);

  // Form da data única/Tipo precisa reenviar os outros filtros (o `alvo`
  // vem de Link, não de campo de formulário) -- hidden inputs, mesmo
  // padrão já usado no resto da página.
  const hiddenAlvo = filterAlvo ? <input type="hidden" name="alvo" value={filterAlvo} /> : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra superior -- redesign pedido do Victor 28/08/2026: título +
          segmented control de Alvo à esquerda, único filtro de data à
          direita. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Relatórios</h1>
          {/* Segmented control -- pílulas com fundo cinza claro e a
              selecionada com fundo verde sólido (mesmo padrão de segmented
              control usado no resto do Design System). */}
          <div className="inline-flex rounded-full p-1 flex-wrap bg-gray-100 dark:bg-gray-700">
            {ALVO_FILTERS.map((f) => {
              const selected = f.value === filterAlvo;
              return (
                <Link
                  key={f.label}
                  href={buildReportHref({ from: dateFrom, to: dateTo, tipo: indicatorTypeKey, indTab, alvo: f.value })}
                  className={`text-sm font-medium px-4 py-1.5 rounded-full whitespace-nowrap ${selected ? "text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
                  style={selected ? { background: "color-mix(in srgb, var(--brand-green) 78%, black)" } : undefined}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

        <form action="/assistencia/relatorios" method="GET" className="flex items-center gap-2 flex-wrap">
          {hiddenAlvo}
          <input type="hidden" name="tipo" value={indicatorTypeKey} />
          <input type="hidden" name="indTab" value={indTab} />
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
      </div>

      {/* Cards de KPI -- redesign pedido do Victor 28/08/2026: fundo
          branco, barra lateral de 4px por cor de status (azul =
          solicitações, roxo = total a pagar, verde = pago, laranja =
          pendente), hierarquia de texto (rótulo pequeno/cinza, valor
          grande/negrito). "Pago"/"Pendente" agrupados visualmente junto
          de "Total a pagar" (com uma seta entre os dois blocos) pra
          evidenciar que um se decompõe no outro. */}
      <div className="grid sm:grid-cols-4 gap-4 items-stretch">
        <KpiCardWhite label="Solicitações no período" value={String(report.totalRequests)} barColor="var(--series-5)" />
        <div className="sm:col-span-3 flex flex-col sm:flex-row gap-3 rounded-xl p-3 bg-gray-100 dark:bg-gray-700">
          <KpiCardWhite label="Total a pagar a montadores" value={formatBRL(paymentTotal)} barColor="var(--series-4)" big />
          <div className="hidden sm:flex items-center px-1 text-xl text-gray-400 dark:text-gray-500" aria-hidden="true">
            →
          </div>
          <div className="flex gap-3 flex-1">
            <KpiCardWhite label="Pago" value={formatBRL(paymentPaid)} barColor="var(--status-good)" />
            <KpiCardWhite label="Pendente de liberação" value={formatBRL(paymentPending)} barColor="var(--brand-orange)" />
          </div>
        </div>
      </div>

      {/* Botão pro relatório linha-por-linha -- pedido do Victor
          29/08/2026: "seu antonio está achando esse numero 141 pouco
          para o volume a pagar alto, a media 92,87 por montagem, ta
          errado, a média é 39,49... preciso que voce coloque um botão
          na aba de relatorio chamado relatorio de montagem detalhado".
          Carrega o mesmo período/alvo que já tá filtrado aqui, pra não
          o Antônio ter que reaplicar o filtro do outro lado. */}
      <Link
        href={`/assistencia/relatorios/montagem-detalhado?${new URLSearchParams({ from: dateFrom, to: dateTo, ...(filterAlvo ? { alvo: filterAlvo } : {}) }).toString()}`}
        className="self-start text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
        style={{ background: "#1B5E3C" }}
      >
        📋 Relatório de montagem detalhado
      </Link>

      {/* Indicadores -- redesign pedido do Victor 28/08/2026: sem borda
          externa colorida (card branco com sombra, ver CARD_CLASS), 3
          visões viram abas horizontais em vez de tabela + grid de 2
          colunas. Seletor de Tipo continua existindo, reposicionado pro
          canto direito da barra de abas. */}
      <div className={`flex flex-col gap-3 rounded-xl p-4 ${CARD_CLASS}`}>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Indicadores de {indicatorLabelFor(indicatorTypeKey)}</h3>

        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1 flex-wrap">
            {INDICATOR_TABS.map((t) => {
              const active = t.key === indTab;
              return (
                <Link
                  key={t.key}
                  href={buildReportHref({ from: dateFrom, to: dateTo, alvo: filterAlvo, tipo: indicatorTypeKey, indTab: t.key })}
                  className={`text-sm font-medium px-3 py-2 -mb-px border-b-2 whitespace-nowrap ${active ? "text-gray-800 dark:text-gray-100" : "border-transparent text-gray-400 dark:text-gray-500"}`}
                  style={active ? { borderColor: "var(--brand-green)" } : undefined}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <form action="/assistencia/relatorios" method="GET" className="flex items-center gap-2 pb-2">
            {hiddenAlvo}
            <input type="hidden" name="from" value={dateFrom} />
            <input type="hidden" name="to" value={dateTo} />
            <input type="hidden" name="indTab" value={indTab} />
            <select name="tipo" defaultValue={indicatorTypeKey} className="rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-sm">
              <option value="montagem_desmontagem">Montagem/Desmontagem (junto)</option>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button type="submit" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
              Aplicar
            </button>
          </form>
        </div>

        {indTab === "mensal" ? (
          indicators.byMonth.length === 0 ? (
            <p className="text-sm py-6 text-center text-gray-400 dark:text-gray-500">
              Nenhuma solicitação desse tipo no período.
            </p>
          ) : (
            <div>
              <ColumnsHeader columns={["Mês", "Total", "Concluídas"]} />
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {indicators.byMonth.map((m) => (
                  <ExpandableRow key={m.month} label={formatMonth(m.month)} numbers={[{ value: m.total }, { value: m.concluida, color: "var(--status-good)" }]}>
                    <IndicatorItemsList items={m.items} showType={indicatorTypes.length > 1} />
                  </ExpandableRow>
                ))}
              </div>
            </div>
          )
        ) : null}

        {indTab === "montador" ? (
          indicatorsByAssembler.length === 0 ? (
            <p className="text-sm py-6 text-center text-gray-400 dark:text-gray-500">
              Nenhuma solicitação desse tipo no período.
            </p>
          ) : (
            <div>
              <ColumnsHeader columns={["Montador", "Total", "Concluídas", "Tempo médio (dias)"]} />
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {indicatorsByAssembler.map((a) => (
                  <ExpandableRow
                    key={a.assemblerName}
                    label={a.assemblerName}
                    numbers={[
                      { value: a.total },
                      { value: a.concluida, color: "var(--status-good)" },
                      { value: formatDaysNumber(a.avgDaysToComplete), color: "#9ca3af" },
                    ]}
                  >
                    <IndicatorItemsList items={a.items} showType={indicatorTypes.length > 1} />
                  </ExpandableRow>
                ))}
              </div>
            </div>
          )
        ) : null}

        {indTab === "loja" ? (
          indicators.byStore.length === 0 ? (
            <p className="text-sm py-6 text-center text-gray-400 dark:text-gray-500">
              Nenhuma solicitação desse tipo no período.
            </p>
          ) : (
            <div>
              <ColumnsHeader columns={["Loja", "Total", "Concluídas"]} />
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {indicators.byStore.map((s) => (
                  <ExpandableRow key={s.storeId} label={s.storeName} numbers={[{ value: s.total }, { value: s.concluida, color: "var(--status-good)" }]}>
                    <IndicatorItemsList items={s.items} showType={indicatorTypes.length > 1} />
                  </ExpandableRow>
                ))}
              </div>
            </div>
          )
        ) : null}
      </div>

      <ReportTable
        title="Solicitações por tipo"
        rows={report.byType}
        keyLabel="Tipo"
        emptyMessage="Nenhuma solicitação no período."
        labelFor={(key) => REQUEST_TYPE_LABELS[key] ?? key}
      />

      {/* Duas colunas -- pedido do Victor 22/08/2026: "organize os dados
          lado a lado em um grid de 2 colunas: Coluna Esquerda
          (Operacional): Indicadores por Montador/Pagamentos, Causa Raiz de
          Trocas. Coluna Direita (Vendas e Lojas): Solicitações por Loja,
          Solicitações por Vendedor". */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <details className={`${CARD_CLASS} overflow-hidden`}>
            <summary className="text-base font-bold cursor-pointer px-4 py-3 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 flex-wrap">
              <span>Pagamento por montador ({assemblerRows.length})</span>
              {/* Pedido do Victor 03/09/2026: "exportar para excel tanto o
                  relatorio quanto o relatorio detalhado". stopPropagation
                  (clicar no botão não pode fechar/abrir o <details> junto,
                  o <summary> inteiro é a área de toggle por padrão) mora
                  DENTRO do componente client (PagamentoPorMontadorExportButton)
                  -- Server Component não pode ter onClick direto no JSX
                  (bug real em produção: "a tela de relatorios caiu... this
                  page couldn't load" -- "Event handlers cannot be passed
                  to Client Component props"). */}
              {assemblerRows.length > 0 ? (
                <PagamentoPorMontadorExportButton rows={assemblerRows as [string, { total: number; pendente: number; pago: number; itens: number }][]} />
              ) : null}
            </summary>
            {assemblerRows.length === 0 ? (
              <p className="text-sm p-4 text-gray-400 dark:text-gray-500">
                Nenhum pagamento no período.
              </p>
            ) : (
              <div>
                <ColumnsHeader columns={["Montador", "Itens", "Total", "Pago", "Pendente"]} />
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {assemblerRows.map(([name, v]) => (
                    <div key={name}>
                      <ExpandableRow
                        label={name}
                        numbers={[
                          { value: v.itens },
                          { value: formatBRL(v.total) },
                          { value: formatBRL(v.pago), color: "var(--status-good)" },
                          { value: formatBRL(v.pendente), color: v.pendente > 0 ? "var(--status-warning)" : "#9ca3af" },
                        ]}
                      >
                        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
                          {v.items.map((it) => (
                            <div key={it.itemId} className="pl-6 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-left text-gray-800 dark:text-gray-100">
                                {it.product} · {it.quantity}x · {it.clientName ?? it.storeName} · {formatDateBr(it.createdAt)}
                              </span>
                              <span
                                className="shrink-0 font-medium text-right"
                                style={{ color: it.paymentReleased ? "var(--status-good)" : "var(--status-warning)" }}
                              >
                                {it.unitValue !== null ? formatBRL(it.unitValue * it.quantity) : "—"} · {it.paymentReleased ? "Pago" : "Pendente"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ExpandableRow>
                      <PaymentProgressBar pago={v.pago} total={v.total} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </details>

          {/* Gráfico de rosca + tags de retrabalho interno -- pedido do
              Victor 22/08/2026 (ver ErroInternoBadge/CausaRaizDonutChart
              acima). */}
          <details className={`${CARD_CLASS} overflow-hidden`}>
            <summary className="text-base font-bold cursor-pointer px-4 py-3 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">
              Trocas de produto por causa raiz ({report.byCausaRaiz.length})
            </summary>
            {report.byCausaRaiz.length === 0 ? (
              <p className="text-sm p-4 text-gray-400 dark:text-gray-500">
                Nenhuma troca de produto com causa raiz registrada nesse período.
              </p>
            ) : (
              <div>
                <div className="px-2 pt-2">
                  <CausaRaizDonutChart
                    data={report.byCausaRaiz.map((r) => ({ key: r.key, name: CAUSA_RAIZ_LABELS[r.key] ?? r.key, value: r.total }))}
                  />
                </div>
                <ColumnsHeader columns={["Causa raiz", "Total", "Concluídas", "Canceladas"]} />
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {report.byCausaRaiz.map((r) => (
                    <ExpandableRow
                      key={r.key}
                      label={
                        <>
                          <span className="truncate" title={CAUSA_RAIZ_LABELS[r.key] ?? r.key}>
                            {CAUSA_RAIZ_LABELS[r.key] ?? r.key}
                          </span>
                          {CAUSA_RAIZ_ERRO_INTERNO.includes(r.key) ? <ErroInternoBadge /> : null}
                        </>
                      }
                      numbers={[
                        { value: r.total },
                        { value: r.concluida, color: "var(--status-good)" },
                        { value: r.cancelada, color: "#9ca3af" },
                      ]}
                    >
                      <ReportRowItemsList items={r.items} />
                    </ExpandableRow>
                  ))}
                </div>
              </div>
            )}
          </details>
        </div>

        <div className="flex flex-col gap-4">
          <ReportTable title="Solicitações por loja" rows={report.byStore} keyLabel="Loja" emptyMessage="Nenhuma solicitação no período." limitRows />
          <ReportTable
            title="Solicitações por vendedor(a)"
            rows={report.bySeller}
            keyLabel="Vendedor(a)"
            emptyMessage="Nenhuma solicitação com vendedor(a) preenchido nesse período — campo novo, só passa a existir dado a partir de agora."
            limitRows
          />
        </div>
      </div>

      <details className={`${CARD_CLASS} overflow-hidden`}>
        <summary className="text-base font-bold cursor-pointer px-4 py-3 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">
          Reconciliação com fornecedor ({supplierReconciliation.length}) — acumulado, todas as remessas
        </summary>
        {supplierReconciliation.length === 0 ? (
          <p className="text-sm p-4 text-gray-400 dark:text-gray-500">
            Nenhuma remessa registrada ainda.
          </p>
        ) : (
          <div>
            <ColumnsHeader columns={["Fornecedor", "Em devolução", "Faturado", "Reembolsado", "Pendente"]} />
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {supplierReconciliation.map((r) => (
                <ExpandableRow
                  key={r.supplier}
                  label={r.supplier}
                  numbers={[
                    { value: formatBRL(r.emDevolucao) },
                    { value: formatBRL(r.faturado) },
                    { value: formatBRL(r.reembolsado), color: "var(--status-good)" },
                    { value: formatBRL(r.pendente), color: r.pendente > 0 ? "var(--status-warning)" : "#9ca3af" },
                  ]}
                >
                  <SupplierReturnItemsList items={r.items} />
                </ExpandableRow>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}

function SupplierReturnItemsList({ items }: { items: SupplierReconciliationItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700">
      {items.map((it) => (
        <div key={it.id} className="pl-6 pr-4 py-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-left text-gray-800 dark:text-gray-100">
            #{it.ticketNumber} · {it.partName}
            {it.invoiceValue !== null ? ` · ${formatBRL(it.invoiceValue)}` : ""}
          </span>
          <span className="shrink-0 font-medium text-right text-gray-400 dark:text-gray-500">
            {SUPPLIER_RETURN_STATUS_LABELS[it.status] ?? it.status}
          </span>
        </div>
      ))}
    </div>
  );
}
