import https from "node:https";
import { getSupabaseAdmin } from "./supabaseAdmin.ts";

// O certificado de protheus.lojasmaia.com.br é autoassinado por uma CA
// interna da própria TOTVS (não uma CA pública) -- fetch() rejeitaria com
// "fetch failed" por padrão. Como é servidor interno da empresa, aceitamos
// esse risco só pras chamadas ao Protheus (resto do app segue validando TLS
// normalmente).
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// Medido manualmente em 2026-07-29: GET /rest/orders escala pelo TAMANHO DO
// PERÍODO pedido, não pelo Size da página -- 1 dia com Size=50 respondeu em
// ~19s, mas 29 dias com Size=50 deu 503 depois de 52s (o servidor parece
// escanear o período inteiro pra montar totalPages independente de Size).
// Por isso pedimos 1 dia por vez, com orçamento de tempo em vez de contador
// fixo de páginas -- a duração real por request varia demais pra confiar num
// número fixo.
//
// Rodado a partir de um script standalone (scripts/totvs-sync.ts), não mais
// via cron do Vercel: o firewall do Protheus deixa passar o computador de
// casa e a rede do CD, mas derruba (timeout, não 401) o IP de nuvem do
// Vercel -- descoberto em produção em 2026-07-29.
const BASE_URL = process.env.TOTVS_API_BASE_URL;
const REQUEST_TIMEOUT_MS = 45_000;

const CLIENT_PAGE_SIZE = 100;
const CLIENT_PAGE_CAP = 30;
const CLIENT_TIME_BUDGET_MS = 120_000;

const ORDER_PAGE_SIZE = 20;
const ORDERS_WINDOW_DAYS = 1;
const ORDERS_TIME_BUDGET_MS = 300_000;
const INITIAL_ORDERS_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type TotvsClientAddress = {
  street?: string;
  number?: string | number;
  complement?: string;
  neighborhood?: string;
  city?: string;
  cep?: string;
  state?: string;
};

type TotvsClient = {
  id: string;
  cpf_cnpj: string;
  name: string;
  status: "nunca comprou" | "ativo" | "inativo";
  lastPurchase?: string;
  daysWithoutBuying?: number;
  phone1?: string;
  phone2?: string;
  email?: string;
  contactName?: string;
  address?: TotvsClientAddress;
};

type TotvsClientListResponse = {
  currentPage: number;
  totalPages: number;
  data: TotvsClient[];
};

type TotvsOrderItem = {
  itemNumber: string;
  product?: string;
  description?: string;
  manufacturer?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  salePrice?: number;
  total?: number;
  discount?: number;
  tes?: string;
  cfop?: string;
};

type TotvsOrder = {
  invoice: string;
  serie: string;
  branch: string;
  date: string;
  paymentMethod?: string;
  invoiceTotal?: number;
  type: "Venda" | "Devolucao";
  nfeKey?: string;
  seller?: { id?: string; name?: string };
  client?: { id?: string; loja?: string; cpf_cnpj?: string; name?: string };
  items?: TotvsOrderItem[];
};

type TotvsOrderListResponse = {
  currentPage: number;
  totalPages: number;
  data: TotvsOrder[];
};

export function totvsHeaders() {
  const basicUser = process.env.TOTVS_BASIC_AUTH_USER;
  const basicPassword = process.env.TOTVS_BASIC_AUTH_PASSWORD;
  const headers: Record<string, string> = {
    ApiKey: process.env.TOTVS_API_KEY ?? "",
    Accept: "application/json",
  };
  // O servidor exige Basic Auth (IIS/HTTPREST) além da ApiKey da aplicação --
  // sem isso o Protheus responde 401 antes mesmo de checar a ApiKey.
  if (basicUser && basicPassword) {
    headers.Authorization = `Basic ${Buffer.from(`${basicUser}:${basicPassword}`).toString("base64")}`;
  }
  return headers;
}

function getTotvs(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: totvsHeaders(), agent: insecureAgent, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf-8") }));
    });
    req.on("timeout", () => req.destroy(new Error(`timeout após ${REQUEST_TIMEOUT_MS}ms`)));
    req.on("error", reject);
  });
}

async function fetchTotvs<T>(url: string, attempt = 1): Promise<T> {
  let res: { status: number; body: string };
  try {
    res = await getTotvs(url);
  } catch (err) {
    if (attempt < 2) return fetchTotvs<T>(url, attempt + 1);
    throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    if (res.status >= 500 && attempt < 2) return fetchTotvs<T>(url, attempt + 1);
    throw new Error(`${res.status} ${url}: ${res.body.slice(0, 200)}`);
  }
  return JSON.parse(res.body) as T;
}

export function ddmmyyyyToIso(value: string | undefined): string | null {
  if (!value) return null;
  const [d, m, y] = value.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getSyncState(supabase: SupabaseAdmin, key: string): Promise<string | null> {
  const { data } = await supabase.from("totvs_sync_state").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function setSyncState(supabase: SupabaseAdmin, key: string, value: string) {
  await supabase.from("totvs_sync_state").upsert({ key, value }, { onConflict: "key" });
}

type SyncResult = { checked: number; upserted: number; errors: string[] };

async function syncClients(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  let page = Number(await getSyncState(supabase, "totvs_clients_next_page")) || 1;
  let checked = 0;
  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < CLIENT_PAGE_CAP; i++) {
    if (Date.now() - started > CLIENT_TIME_BUDGET_MS) break;

    let json: TotvsClientListResponse;
    try {
      json = await fetchTotvs<TotvsClientListResponse>(
        `${BASE_URL}/rest/client?Page=${page}&Size=${CLIENT_PAGE_SIZE}`
      );
    } catch (err) {
      errors.push(`clients page ${page}: ${(err as Error).message}`);
      break;
    }
    const rows = json.data ?? [];
    checked += rows.length;

    for (const c of rows) {
      const { error } = await supabase.from("totvs_clientes").upsert(
        {
          protheus_code: c.id,
          cpf_cnpj: c.cpf_cnpj,
          name: c.name,
          status: c.status,
          last_purchase_date: ddmmyyyyToIso(c.lastPurchase),
          days_without_buying: c.daysWithoutBuying ?? null,
          phone1: c.phone1 || null,
          phone2: c.phone2 || null,
          email: c.email || null,
          contact_name: c.contactName || null,
          address_street: c.address?.street || null,
          address_number: c.address?.number != null ? String(c.address.number) : null,
          address_complement: c.address?.complement || null,
          address_neighborhood: c.address?.neighborhood || null,
          address_city: c.address?.city || null,
          address_cep: c.address?.cep || null,
          address_state: c.address?.state || null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "protheus_code" }
      );
      if (!error) upserted++;
      else errors.push(`client ${c.id}: ${error.message}`);
    }

    if (rows.length === 0 || page >= (json.totalPages ?? page)) {
      page = 1;
      break;
    }
    page += 1;
  }

  await setSyncState(supabase, "totvs_clients_next_page", String(page));
  return { checked, upserted, errors };
}

async function upsertOrder(supabase: SupabaseAdmin, o: TotvsOrder, errors: string[]): Promise<boolean> {
  const { data: orderRow, error } = await supabase
    .from("totvs_orders")
    .upsert(
      {
        invoice: o.invoice,
        serie: o.serie,
        branch: o.branch,
        issue_date: ddmmyyyyToIso(o.date),
        payment_method: o.paymentMethod || null,
        invoice_total: o.invoiceTotal ?? 0,
        type: o.type,
        nfe_key: o.nfeKey || null,
        seller_id: o.seller?.id || null,
        seller_name: o.seller?.name || null,
        client_id: o.client?.id || null,
        client_cpf_cnpj: o.client?.cpf_cnpj || null,
        client_name: o.client?.name || null,
        client_loja: o.client?.loja || null,
      },
      { onConflict: "invoice,serie,branch" }
    )
    .select("id")
    .single();
  if (error || !orderRow) {
    errors.push(`order ${o.invoice}/${o.serie}: ${error?.message ?? "sem id retornado"}`);
    return false;
  }

  for (const item of o.items ?? []) {
    const { error: itemError } = await supabase.from("totvs_order_items").upsert(
      {
        order_id: orderRow.id,
        item_number: item.itemNumber,
        product: item.product || null,
        description: item.description || null,
        manufacturer: item.manufacturer || null,
        unit: item.unit || null,
        quantity: item.quantity ?? 0,
        unit_price: item.unitPrice ?? null,
        sale_price: item.salePrice ?? null,
        total: item.total ?? 0,
        discount: item.discount ?? null,
        tes: item.tes || null,
        cfop: item.cfop || null,
      },
      { onConflict: "order_id,item_number" }
    );
    if (itemError) errors.push(`order ${o.invoice} item ${item.itemNumber}: ${itemError.message}`);
  }
  return true;
}

// Varre dia a dia (não um StartDate/EndDate largo -- ver nota acima sobre o
// tempo de resposta escalar com o período) até acabar o orçamento de tempo ou
// alcançar hoje. O cursor (dia + página) é salvo sempre, mesmo quando a
// execução para no meio de um dia com muitos pedidos -- salvar só ao
// terminar o dia inteiro fazia dias grandes nunca avançarem o cursor, mesmo
// tendo gravado pedidos reais (visto rodando de verdade em 2026-07-29: 140
// pedidos gravados, cursor não avançou, próxima rodada recomeçaria do zero).
async function syncOrders(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  let day = (await getSyncState(supabase, "totvs_orders_next_day")) ?? isoDate(new Date(Date.now() - INITIAL_ORDERS_LOOKBACK_DAYS * DAY_MS));
  let page = Number(await getSyncState(supabase, "totvs_orders_next_page")) || 1;
  const today = new Date();

  let checked = 0;
  let upserted = 0;
  const errors: string[] = [];

  while (new Date(day).getTime() <= today.getTime()) {
    if (Date.now() - started > ORDERS_TIME_BUDGET_MS) break;

    let json: TotvsOrderListResponse;
    try {
      json = await fetchTotvs<TotvsOrderListResponse>(
        `${BASE_URL}/rest/orders?StartDate=${day}&EndDate=${day}&Page=${page}&Size=${ORDER_PAGE_SIZE}`
      );
    } catch (err) {
      errors.push(`orders ${day} page ${page}: ${(err as Error).message}`);
      break;
    }
    const rows = json.data ?? [];
    checked += rows.length;

    for (const o of rows) {
      if (await upsertOrder(supabase, o, errors)) upserted++;
    }

    if (rows.length === 0 || page >= (json.totalPages ?? page)) {
      day = isoDate(new Date(new Date(day).getTime() + ORDERS_WINDOW_DAYS * DAY_MS));
      page = 1;
    } else {
      page += 1;
    }
  }

  await setSyncState(supabase, "totvs_orders_next_day", day);
  await setSyncState(supabase, "totvs_orders_next_page", String(page));
  return { checked, upserted, errors };
}

export type TotvsSyncSummary = {
  ok: boolean;
  clients: { checked: number; upserted: number };
  orders: { checked: number; upserted: number };
  errors: string[];
};

export async function runTotvsSync(supabase: SupabaseAdmin): Promise<TotvsSyncSummary> {
  if (!BASE_URL || !process.env.TOTVS_API_KEY) {
    throw new Error("TOTVS_API_BASE_URL/TOTVS_API_KEY ausentes");
  }

  const clients = await syncClients(supabase);
  const orders = await syncOrders(supabase);

  return {
    ok: clients.errors.length === 0 && orders.errors.length === 0,
    clients: { checked: clients.checked, upserted: clients.upserted },
    orders: { checked: orders.checked, upserted: orders.upserted },
    errors: [...clients.errors, ...orders.errors],
  };
}
