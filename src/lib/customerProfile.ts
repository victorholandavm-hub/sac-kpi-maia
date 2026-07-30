import { getSupabaseAdmin } from "./supabaseAdmin";
import type { Count } from "./kpi";

// PostgREST limita cada resposta (max_rows do projeto, normalmente 1000) --
// mesmo padrão de paginação de src/lib/kpi.ts, extraído aqui porque é usado
// em 4 lugares diferentes neste arquivo (kpi.ts só usa em 2, por isso não
// tinha um helper próprio).
async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await query(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export type ClientCategory = "neighborhood" | "city";

export type ClientSummary = {
  cpfCnpj: string;
  protheusCode: string | null;
  name: string;
  // "sem cadastro" -- comprou (existe em totvs_orders) mas não tem linha
  // correspondente em totvs_clientes. Achado rodando contra dado real: de
  // 782 CPF/CNPJ distintos que compraram, só 10 têm cadastro (os dois syncs
  // cobrem universos diferentes do TOTVS, ver 0048_client_purchase_summary_name.sql)
  // -- portanto a maioria dos clientes reais cai nesse caso, não é exceção rara.
  status: "nunca comprou" | "ativo" | "inativo" | "sem cadastro";
  neighborhood: string | null;
  city: string | null;
  phone1: string | null;
  lastPurchaseDate: string | null;
  daysWithoutBuying: number | null;
};

export type ClientSearchResult = Pick<ClientSummary, "cpfCnpj" | "protheusCode" | "name" | "city" | "status">;

export type ClientPurchaseStats = {
  totalCompras: number;
  valorBruto: number;
  valorLiquido: number;
  ticketMedio: number | null;
  primeiraCompra: string | null;
  ultimaCompra: string | null;
};

export type MonthlyPattern = { month: number; label: string; count: number; total: number };

export type OrderHistoryRow = {
  invoice: string;
  issueDate: string;
  type: "Venda" | "Devolucao";
  invoiceTotal: number;
  paymentMethod: string | null;
  sellerName: string | null;
};

export type ClientProfile = {
  client: ClientSummary;
  stats: ClientPurchaseStats;
  monthlyPattern: MonthlyPattern[];
  topProducts: Count[];
  topManufacturers: Count[];
  orderHistory: OrderHistoryRow[];
};

export type ClientSegment = {
  key: string;
  clientCount: number;
  totalRevenue: number;
  totalCompras: number;
  avgTicket: number;
  avgFrequencyPerYear: number | null;
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type ClienteRow = {
  cpf_cnpj: string;
  protheus_code: string;
  name: string;
  status: string;
  address_neighborhood: string | null;
  address_city: string | null;
  phone1: string | null;
  last_purchase_date: string | null;
  days_without_buying: number | null;
  updated_at: string;
};

function toClientSummary(row: ClienteRow): ClientSummary {
  return {
    cpfCnpj: row.cpf_cnpj,
    protheusCode: row.protheus_code,
    name: row.name,
    status: row.status as ClientSummary["status"],
    neighborhood: row.address_neighborhood,
    city: row.address_city,
    phone1: row.phone1,
    lastPurchaseDate: row.last_purchase_date,
    daysWithoutBuying: row.days_without_buying,
  };
}

// totvs_clientes.cpf_cnpj NÃO é único (uma linha por loja/filial, ver
// 0040_totvs_clientes_cpf_cnpj_nao_unico.sql) -- mantém a linha de
// updated_at mais recente por cliente. Único lugar do projeto que resolve
// essa não-unicidade, reaproveitado pela busca e pelos segmentos.
export function dedupeByCpfCnpj<T extends { cpf_cnpj: string; updated_at: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const existing = byId.get(row.cpf_cnpj);
    if (!existing || row.updated_at > existing.updated_at) byId.set(row.cpf_cnpj, row);
  }
  return [...byId.values()];
}

// Busca em totvs_clientes E totvs_orders -- não dá pra confiar só em
// totvs_clientes pra achar cliente (ver nota em ClientSummary.status: a
// maioria de quem realmente comprou não tem cadastro lá). totvs_clientes
// prioridade quando o mesmo cpf_cnpj aparece nos dois (dado mais rico:
// bairro, telefone).
export async function searchClients(query: string): Promise<ClientSearchResult[]> {
  const trimmed = query.trim().replace(/,/g, " ");
  if (trimmed.length < 2) return [];

  const admin = getSupabaseAdmin();
  const [clienteRes, orderRes] = await Promise.all([
    admin
      .from("totvs_clientes")
      .select("cpf_cnpj, protheus_code, name, status, address_neighborhood, address_city, phone1, last_purchase_date, days_without_buying, updated_at")
      .or(`name.ilike.%${trimmed}%,cpf_cnpj.ilike.%${trimmed}%,protheus_code.ilike.%${trimmed}%`)
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("totvs_orders")
      .select("client_cpf_cnpj, client_name, issue_date")
      .not("client_cpf_cnpj", "is", null)
      .or(`client_name.ilike.%${trimmed}%,client_cpf_cnpj.ilike.%${trimmed}%`)
      .order("issue_date", { ascending: false })
      .limit(200),
  ]);
  if (clienteRes.error) throw new Error(clienteRes.error.message);
  if (orderRes.error) throw new Error(orderRes.error.message);

  const results = new Map<string, ClientSearchResult>();
  for (const row of dedupeByCpfCnpj((clienteRes.data ?? []) as unknown as ClienteRow[])) {
    const summary = toClientSummary(row);
    results.set(summary.cpfCnpj, { cpfCnpj: summary.cpfCnpj, protheusCode: summary.protheusCode, name: summary.name, city: summary.city, status: summary.status });
  }
  for (const row of (orderRes.data ?? []) as { client_cpf_cnpj: string; client_name: string | null }[]) {
    if (results.has(row.client_cpf_cnpj)) continue; // já tem dado melhor de totvs_clientes
    results.set(row.client_cpf_cnpj, {
      cpfCnpj: row.client_cpf_cnpj,
      protheusCode: null,
      name: row.client_name ?? row.client_cpf_cnpj,
      city: null,
      status: "sem cadastro",
    });
  }

  return [...results.values()].slice(0, 20);
}

type OrderRow = {
  invoice: string;
  issue_date: string;
  invoice_total: number;
  type: "Venda" | "Devolucao";
  payment_method: string | null;
  seller_name: string | null;
};

// Devoluções já chegam com invoice_total negativo (não é só um rótulo) --
// valorLiquido soma tudo sem filtro (o sinal já compensa); as métricas "de
// compra" (contagem/bruto/ticket médio/datas) filtram type==='Venda', senão
// devolução infla "quantas vezes o cliente comprou".
export function buildPurchaseStats(orders: OrderRow[]): ClientPurchaseStats {
  const vendas = orders.filter((o) => o.type === "Venda");
  const valorBruto = vendas.reduce((sum, o) => sum + o.invoice_total, 0);
  const valorLiquido = orders.reduce((sum, o) => sum + o.invoice_total, 0);
  const datas = vendas.map((o) => o.issue_date).sort();
  return {
    totalCompras: vendas.length,
    valorBruto,
    valorLiquido,
    ticketMedio: vendas.length > 0 ? valorBruto / vendas.length : null,
    primeiraCompra: datas[0] ?? null,
    ultimaCompra: datas[datas.length - 1] ?? null,
  };
}

// Sempre os 12 meses, mesmo sem dado, pro gráfico não pular mês.
export function buildMonthlyPattern(orders: OrderRow[]): MonthlyPattern[] {
  const buckets = MONTH_LABELS.map((label, i) => ({ month: i + 1, label, count: 0, total: 0 }));
  for (const o of orders) {
    if (o.type !== "Venda") continue;
    const month = new Date(`${o.issue_date}T00:00:00Z`).getUTCMonth();
    buckets[month].count += 1;
    buckets[month].total += o.invoice_total;
  }
  return buckets;
}

function toOrderHistoryRow(o: OrderRow): OrderHistoryRow {
  return {
    invoice: o.invoice,
    issueDate: o.issue_date,
    type: o.type,
    invoiceTotal: o.invoice_total,
    paymentMethod: o.payment_method,
    sellerName: o.seller_name,
  };
}

type OrderItemRow = { product: string | null; description: string | null; manufacturer: string | null; total: number };

// Soma de `total` por rótulo, top 10 desc -- shape {label, count} de
// propósito pra plugar direto em <BarRanking> (que espera Count de kpi.ts)
// sem adaptação, mesmo "count" aqui sendo valor em R$, não uma contagem.
function topByValue(items: OrderItemRow[], key: "description" | "manufacturer"): Count[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const label = (key === "description" ? item.description || item.product : item.manufacturer)?.trim();
    if (!label) continue;
    totals.set(label, (totals.get(label) ?? 0) + item.total);
  }
  return [...totals.entries()]
    .map(([label, count]) => ({ label, count: Math.round(count * 100) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// totvs_clientes é só enriquecimento (bairro/telefone) quando existir --
// NÃO é mais condição pra achar o cliente (ver nota em ClientSummary.status).
// A fonte de verdade de "esse cliente existe" é ter pelo menos um pedido.
export async function getClientProfile(cpfCnpj: string): Promise<ClientProfile | null> {
  const admin = getSupabaseAdmin();

  const { data: clienteRows, error: clienteError } = await admin
    .from("totvs_clientes")
    .select("cpf_cnpj, protheus_code, name, status, address_neighborhood, address_city, phone1, last_purchase_date, days_without_buying, updated_at")
    .eq("cpf_cnpj", cpfCnpj)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (clienteError) throw new Error(clienteError.message);
  const clienteRow = (clienteRows as unknown as ClienteRow[] | null)?.[0] ?? null;

  const orders = await fetchAllPages<OrderRow & { client_name: string | null }>((from, to) =>
    admin
      .from("totvs_orders")
      .select("invoice, issue_date, invoice_total, type, payment_method, seller_name, client_name")
      .eq("client_cpf_cnpj", cpfCnpj)
      .order("issue_date", { ascending: false })
      .range(from, to)
  );

  if (!clienteRow && orders.length === 0) return null;

  const client: ClientSummary = clienteRow
    ? toClientSummary(clienteRow)
    : {
        cpfCnpj,
        protheusCode: null,
        name: orders[0]?.client_name ?? cpfCnpj,
        status: "sem cadastro",
        neighborhood: null,
        city: null,
        phone1: null,
        lastPurchaseDate: null,
        daysWithoutBuying: null,
      };

  const items = await fetchAllPages<OrderItemRow>((from, to) =>
    admin
      .from("totvs_order_items")
      .select("product, description, manufacturer, total, order:totvs_orders!inner(client_cpf_cnpj, type)")
      .eq("order.client_cpf_cnpj", cpfCnpj)
      .eq("order.type", "Venda")
      .range(from, to)
  );

  return {
    client,
    stats: buildPurchaseStats(orders),
    monthlyPattern: buildMonthlyPattern(orders),
    topProducts: topByValue(items, "description"),
    topManufacturers: topByValue(items, "manufacturer"),
    orderHistory: orders.map(toOrderHistoryRow),
  };
}

type SummaryRow = {
  cpf_cnpj: string;
  client_name: string | null;
  total_compras: number;
  valor_bruto: number;
  ticket_medio: number | null;
  primeira_compra: string | null;
  ultima_compra: string | null;
};

// Anos ativos = diferença entre primeira e última compra, arredondada pra
// cima, mínimo 1 -- evita dividir por zero/frequência absurda num cliente
// com todas as compras no mesmo ano.
export function clientFrequencyPerYear(summary: SummaryRow): number {
  if (!summary.primeira_compra || !summary.ultima_compra || summary.total_compras === 0) return 0;
  const anos = Math.max(
    1,
    Math.ceil(
      (new Date(summary.ultima_compra).getTime() - new Date(summary.primeira_compra).getTime()) / (365 * 24 * 60 * 60 * 1000)
    )
  );
  return summary.total_compras / anos;
}

// Ticket médio do grupo é PONDERADO (totalRevenue / soma de compras do
// grupo), não a média simples dos tickets médios individuais -- média
// simples distorce quando clientes do grupo têm volumes de compra muito
// diferentes (um cliente com 1 compra de R$5000 pesaria igual a um com 50
// compras de R$200).
//
// Itera por SUMMARIES (quem comprou, totvs_orders), não por totvs_clientes:
// rodando contra dado real, só 10 de 782 compradores têm cadastro em
// totvs_clientes (ver 0048_client_purchase_summary_name.sql) -- iterar
// pelos clientes cadastrados deixava a esmagadora maioria dos compradores
// de fora da agregação. totvs_clientes aqui é só enriquecimento pro bairro/
// cidade quando existir; sem match, cai em "Não informado" (não descarta o
// cliente, só não sabemos o bairro dele).
export function computeSegments(
  clients: ClienteRow[],
  summaries: SummaryRow[],
  groupBy: ClientCategory
): ClientSegment[] {
  const clientByCpf = new Map(clients.map((c) => [c.cpf_cnpj, c]));
  const field = groupBy === "neighborhood" ? "address_neighborhood" : "address_city";

  const groups = new Map<string, { clientCount: number; totalRevenue: number; totalCompras: number; frequencies: number[] }>();
  for (const summary of summaries) {
    if (summary.total_compras === 0) continue;

    const client = clientByCpf.get(summary.cpf_cnpj);
    const key = (client?.[field] || "").trim() || "Não informado";
    const group = groups.get(key) ?? { clientCount: 0, totalRevenue: 0, totalCompras: 0, frequencies: [] };
    group.clientCount += 1;
    group.totalRevenue += summary.valor_bruto;
    group.totalCompras += summary.total_compras;
    group.frequencies.push(clientFrequencyPerYear(summary));
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      clientCount: g.clientCount,
      totalRevenue: Math.round(g.totalRevenue * 100) / 100,
      totalCompras: g.totalCompras,
      avgTicket: g.totalCompras > 0 ? Math.round((g.totalRevenue / g.totalCompras) * 100) / 100 : 0,
      avgFrequencyPerYear: g.frequencies.length > 0 ? g.frequencies.reduce((a, b) => a + b, 0) / g.frequencies.length : null,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function listClientSegments(groupBy: ClientCategory): Promise<ClientSegment[]> {
  const admin = getSupabaseAdmin();

  const clientRows = await fetchAllPages<ClienteRow>((from, to) =>
    admin
      .from("totvs_clientes")
      .select("cpf_cnpj, protheus_code, name, status, address_neighborhood, address_city, phone1, last_purchase_date, days_without_buying, updated_at")
      .range(from, to)
  );
  const clients = dedupeByCpfCnpj(clientRows);

  const summaries = await fetchAllPages<SummaryRow>((from, to) =>
    admin
      .from("v_client_purchase_summary")
      .select("cpf_cnpj, client_name, total_compras, valor_bruto, ticket_medio, primeira_compra, ultima_compra")
      .range(from, to)
  );

  return computeSegments(clients, summaries, groupBy);
}
