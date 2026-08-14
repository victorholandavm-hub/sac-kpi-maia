import https from "node:https";
import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { recordSyncRun } from "./syncRuns.ts";

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

// Aumentados de 20/300s em 2026-08-11: com o bug de retry corrigido (ver
// syncOrders abaixo), o gargalo passou a ser throughput puro -- 20 pedidos
// por página significa muitas idas e vindas na API do TOTVS pra cobrir um
// dia só. 100 é o mesmo tamanho já usado em CLIENT_PAGE_SIZE e está dentro
// do limite documentado da API (máximo 500). O orçamento de tempo maior
// (15min) deixa cada execução cobrir mais dias -- a tarefa agendada só roda
// 1x/dia, então não há risco de sobrepor com a próxima chamada.
const ORDER_PAGE_SIZE = 100;
const ORDERS_WINDOW_DAYS = 1;
const ORDERS_TIME_BUDGET_MS = 900_000;
const INITIAL_ORDERS_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// /ai/deliveries não tem nota de custo por período medida em produção (ao
// contrário de /orders, ver comentário acima) -- por enquanto sem janela de
// data, full-scan contínuo por página (mesmo desenho de syncClients),
// orçamento de tempo + teto de páginas como corte de segurança. Deliberado
// não filtrar por deliveryDateFrom/deliveryDateTo: isso arriscaria excluir
// pedidos sem nenhuma carga ainda (cargas: []), que são exatamente o caso
// mais crítico da regra de negócio (pedido nunca ganhou carga até o prazo).
const DELIVERY_PAGE_SIZE = 100;
const DELIVERY_PAGE_CAP = 40;
const DELIVERIES_TIME_BUDGET_MS = 120_000;

// Cópia de RESOLVIDO_LABELS (src/lib/entregasRisco.ts) -- ver nota lá sobre
// por que este arquivo não importa daquele. Usado tanto pra decidir quais
// pedidos vale a pena re-sincronizar com prioridade (syncStaleDeliveries)
// quanto pra guarda de detectDeliveryRiskTrigger (nunca reabre risco de
// pedido já entregue por outra carga).
const DELIVERY_RESOLVIDO_LABELS = ["Entregue", "Entregue Parcial"];

// Cópia de PEDIDO_ENCERRADO_LABELS (src/lib/entregasRisco.ts) -- venda
// cancelada nunca vai bater "Entregue", então sem isso syncStaleDeliveries
// ficava re-sincronizando pedido cancelado pra sempre (nunca "resolve"),
// disputando orçamento de tempo/chamadas com pedido genuinamente pendente.
const DELIVERY_ENCERRADO_LABELS = [...DELIVERY_RESOLVIDO_LABELS, "Cancelada"];

// O full-scan sequencial de syncDeliveries só revisita um pedido já
// sincronizado quando o cursor dá a volta inteira nas páginas -- com bastante
// linha na tabela e execuções que nem sempre completam (disputa de licença
// do Protheus, timeout), isso pode levar dias/semanas. Descoberto em
// 2026-08-10: dois pedidos entregues ficaram sinalizados como risco porque o
// snapshot local (de quando o pedido foi visto pela 1ª vez) nunca foi
// atualizado depois. Antes do scan sequencial, busca com prioridade os N
// pedidos "não resolvidos" com `synced_at` mais antigo, refazendo a consulta
// por CPF/CNPJ do cliente (filtro `document` da API, existe justamente pra
// isso) -- mais barato que esperar o cursor chegar lá.
const STALE_PRIORITY_LIMIT = 15;
const STALE_PRIORITY_TIME_BUDGET_MS = 60_000;

// URL e paginação (page/size minúsculo) confirmados contra a API real em
// 2026-07-30 -- api-totvs.yaml também errava os nomes de alguns campos do
// payload (ver TotvsDeliveryOrder/TotvsDeliveryCarga abaixo: "order"/"branch"
// em vez de "pedido"/"filialVenda", "invoice" em vez de "notaFiscal").

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

// WSStock (totvs.md) -- saldo no armazém 75 (o CD), detalhado por filial em
// `stores[]`. current_balance/reserved_qty em totvs_stock são a SOMA dessas
// filiais, não uma filial só (ver syncStock).
type TotvsStockStore = { storeCode: string; currentBalance: number; reservedQty: number };

type TotvsStockItem = {
  code: string;
  description?: string;
  manufacturer?: string;
  unitCost?: number;
  purchaseOrderBalance?: number;
  estimatedArrivalDate?: string;
  stores: TotvsStockStore[];
};

type TotvsStockListResponse = {
  currentPage: number;
  totalPages: number;
  data: TotvsStockItem[];
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

type TotvsDeliveryClient = {
  codigo?: string;
  loja?: string;
  nome?: string;
  documento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
};

type TotvsDeliveryMotorista = { codigo?: string; nome?: string };

type TotvsDeliveryOcorrencia = { codigo?: string; descricao?: string; categoria?: string; nivel?: string };

// itens[] existe no payload real mas é ignorado -- fora do escopo do MVP, a
// regra de negócio é a nível de pedido/carga, não de item.
//
// CAMPOS RENOMEADOS EM RELAÇÃO A api-totvs.yaml: a resposta real (inspecionada
// em 2026-07-30 via GET /rest/ai/deliveries) usa "invoice" onde a doc chama de
// "notaFiscal" -- resto da carga bate com o documentado.
type TotvsDeliveryCarga = {
  carga: string;
  dtPrevisao?: string; // YYYY-MM-DD
  tentativa?: number;
  tipoEntrega?: "Entrega" | "Retirada" | "Express";
  statusCarga?: string;
  statusCargaCodigo?: string;
  statusEntrega?: string;
  statusEntregaCodigo?: string;
  statusOrigem?: "CARGA" | "ENTREGA";
  motorista?: TotvsDeliveryMotorista;
  // Mesmo formato de motorista (codigo/nome), fonte AC4 -- ver
  // 0072_carga_conferente_e_problemas.sql pras colunas novas que guardam isso.
  conferente?: TotvsDeliveryMotorista;
  transportadora?: string;
  veiculo?: string;
  regiao?: string;
  invoice?: string;
  serie?: string;
  dtRetorno?: string;
  hrRetorno?: string;
  ocorrencia?: TotvsDeliveryOcorrencia;
};

// CAMPOS RENOMEADOS EM RELAÇÃO A api-totvs.yaml: a doc chama de "pedido" e
// "filialVenda", mas a resposta real usa "order" e "branch" (mesmo nome que
// WSOrders usa pra filial) -- ver nota acima. Confirmado com uma chamada real
// em 2026-07-30, trazendo 98 pedidos reais.
type TotvsDeliveryOrder = {
  order: string;
  branch: string;
  loja?: string;
  cliente?: TotvsDeliveryClient;
  statusAtual?: string;
  statusAtualCodigo?: string;
  totalCargas?: number;
  cargas?: TotvsDeliveryCarga[];
};

type TotvsDeliveryListResponse = {
  currentPage: number;
  totalPages: number;
  data: TotvsDeliveryOrder[];
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 503 no /rest/orders é quase sempre disputa da licença única da API do
// Protheus (confirmado com a TI em 2026-08-03: só existe 1 licença, e várias
// pessoas usando o Protheus ao mesmo tempo derrubam a nossa chamada) --
// retry imediato batia direto na mesma disputa. Backoff crescente (5s, 10s)
// em vez de tentar de novo na hora, dando tempo da licença liberar.
const RETRY_DELAYS_MS = [5_000, 10_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

async function fetchTotvs<T>(url: string, attempt = 1): Promise<T> {
  let res: { status: number; body: string };
  try {
    res = await getTotvs(url);
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      await delay(RETRY_DELAYS_MS[attempt - 1]);
      return fetchTotvs<T>(url, attempt + 1);
    }
    throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
      await delay(RETRY_DELAYS_MS[attempt - 1]);
      return fetchTotvs<T>(url, attempt + 1);
    }
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

// Depois de falhar 3 execuções seguidas NA MESMA página (cada uma já com os
// 3 retries de fetchTotvs esgotados), pula ela em vez de tentar pra sempre
// -- descoberto em 2026-08-04: a página 30 ficou travada em 503 (mesma
// disputa de licença dos pedidos) e, como o cursor só avança em caso de
// sucesso, o sync inteiro parou de progredir a partir dali (clientes
// cadastrados depois da página 30 nunca chegavam na cópia local). Pular
// não perde o cliente pra sempre: quando o cursor completa um ciclo e volta
// pra página 1 (ver "page = 1" abaixo), a página pulada é tentada de novo.
const CLIENT_PAGE_FAIL_LIMIT = 3;

// Mesmo problema do CLIENT_PAGE_FAIL_LIMIT acima, mas em pedidos: descoberto
// em 2026-08-05 com o cursor travado ~1 mês parado num único dia (a mesma
// disputa de licença/timeout de 45s da página 1 daquele dia, sempre no
// mesmo lugar) -- como o catch original só dava break sem avançar dia nem
// página, a próxima rodada tentava exatamente o mesmo dia/página de novo,
// pra sempre. Depois de N falhas seguidas no mesmo dia+página, pula pro dia
// seguinte em vez de travar o sync inteiro dali pra frente. Diferente do de
// clientes, pedidos não fazem ciclo (não voltam pra página 1 do começo), então
// um dia pulado só é reprocessado com um reset manual do cursor -- aceitável
// pra não perder todo o progresso seguinte por causa de um dia ruim isolado.
const ORDER_DAY_FAIL_LIMIT = 3;

async function syncClients(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  let page = Number(await getSyncState(supabase, "totvs_clients_next_page")) || 1;
  const [failPageRaw, failCountRaw] = ((await getSyncState(supabase, "totvs_clients_page_fail")) ?? "").split(":");
  let failCount = Number(failPageRaw) === page ? Number(failCountRaw) || 0 : 0;
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
      failCount += 1;
      if (failCount >= CLIENT_PAGE_FAIL_LIMIT) {
        errors.push(`clients page ${page}: ${(err as Error).message} (pulada após ${failCount} falhas seguidas)`);
        await setSyncState(supabase, "totvs_clients_page_fail", "");
        page += 1;
        failCount = 0;
        continue;
      }
      // `continue` (não `break`) pelo mesmo motivo do syncOrders logo abaixo
      // -- tenta a mesma página de novo aqui mesmo (consome 1 iteração do
      // CLIENT_PAGE_CAP, não o orçamento de tempo inteiro) em vez de acabar
      // a execução inteira por causa de 1 pico passageiro de disputa de
      // licença.
      errors.push(`clients page ${page}: ${(err as Error).message}`);
      await setSyncState(supabase, "totvs_clients_page_fail", `${page}:${failCount}`);
      continue;
    }
    if (failCount > 0) {
      await setSyncState(supabase, "totvs_clients_page_fail", "");
      failCount = 0;
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

const STOCK_PAGE_SIZE = 200;
const STOCK_PAGE_CAP = 30;
const STOCK_TIME_BUDGET_MS = 120_000;
const STOCK_PAGE_FAIL_LIMIT = 3;

// Mesmo padrão de syncClients acima (paginação simples por página/tamanho,
// não por período como syncOrders) -- WSStock é uma foto do catálogo
// inteiro, não bounded por data.
async function syncStock(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  let page = Number(await getSyncState(supabase, "totvs_stock_next_page")) || 1;
  const [failPageRaw, failCountRaw] = ((await getSyncState(supabase, "totvs_stock_page_fail")) ?? "").split(":");
  let failCount = Number(failPageRaw) === page ? Number(failCountRaw) || 0 : 0;
  let checked = 0;
  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < STOCK_PAGE_CAP; i++) {
    if (Date.now() - started > STOCK_TIME_BUDGET_MS) break;

    let json: TotvsStockListResponse;
    try {
      json = await fetchTotvs<TotvsStockListResponse>(`${BASE_URL}/rest/stock?Page=${page}&Size=${STOCK_PAGE_SIZE}`);
    } catch (err) {
      failCount += 1;
      if (failCount >= STOCK_PAGE_FAIL_LIMIT) {
        errors.push(`stock page ${page}: ${(err as Error).message} (pulada após ${failCount} falhas seguidas)`);
        await setSyncState(supabase, "totvs_stock_page_fail", "");
        page += 1;
        failCount = 0;
        continue;
      }
      errors.push(`stock page ${page}: ${(err as Error).message}`);
      await setSyncState(supabase, "totvs_stock_page_fail", `${page}:${failCount}`);
      continue;
    }
    if (failCount > 0) {
      await setSyncState(supabase, "totvs_stock_page_fail", "");
      failCount = 0;
    }

    const rows = json.data ?? [];
    checked += rows.length;

    for (const item of rows) {
      if (!item.code) continue;
      const stores = item.stores ?? [];
      // Soma as filiais -- ver comentário em TotvsStockItem acima.
      const currentBalance = stores.reduce((s, st) => s + (st.currentBalance ?? 0), 0);
      const reservedQty = stores.reduce((s, st) => s + (st.reservedQty ?? 0), 0);
      const { error } = await supabase.from("totvs_stock").upsert(
        {
          product_code: item.code,
          description: item.description || null,
          manufacturer: item.manufacturer || null,
          unit_cost: item.unitCost ?? null,
          current_balance: currentBalance,
          reserved_qty: reservedQty,
          purchase_order_balance: item.purchaseOrderBalance ?? null,
          estimated_arrival_date: item.estimatedArrivalDate || null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "product_code" }
      );
      if (!error) upserted++;
      else errors.push(`stock ${item.code}: ${error.message}`);
    }

    if (rows.length === 0 || page >= (json.totalPages ?? page)) {
      page = 1;
      break;
    }
    page += 1;
  }

  await setSyncState(supabase, "totvs_stock_next_page", String(page));
  return { checked, upserted, errors };
}

const BACKFILL_TIME_BUDGET_MS = 240_000;
const BACKFILL_LOOKBACK_DAYS = 30;
const BACKFILL_MAX_CODES = 80;

// Descoberto em 2026-08-05 (relato real: Jaluska não conseguiu achar cliente
// nem produto criando uma encomenda): a listagem paginada de /rest/client
// (usada por syncClients acima) não traz alguns clientes reais e ATIVOS,
// mesmo varrendo as 36/36 páginas reportadas com OrderBy=id e sem
// duplicata nenhuma -- confirmado testando direto contra a API. Só
// SearchQuery acha esses clientes. Ou seja: bug do lado do Protheus (a
// listagem parece vir de uma fonte/cache diferente do índice de busca), não
// tem conserto possível daqui. Reportado pra TI (ver ONBOARDING.md).
//
// Enquanto isso não é corrigido lá, essa função fecha o buraco pro caso que
// dói de verdade: pega só os códigos de cliente REALMENTE digitados em
// chamados/pedidos recentes (não um scan geral -- não faz sentido nem daria
// tempo buscar código por código de 3600+ clientes) que não bateram com o
// que já sincronizamos, e busca CADA UM via SearchQuery, que funciona
// mesmo quando a listagem não traz o cliente.
async function backfillMissingClients(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  const since = isoDate(new Date(Date.now() - BACKFILL_LOOKBACK_DAYS * DAY_MS));
  const errors: string[] = [];
  let checked = 0;
  let upserted = 0;

  const codes = new Set<string>();
  const { data: reqRows } = await supabase
    .from("service_requests")
    .select("client_protheus_code")
    .not("client_protheus_code", "is", null)
    .gte("created_at", since);
  for (const r of reqRows ?? []) {
    const code = (r.client_protheus_code as string | null)?.trim();
    if (code) codes.add(code);
  }
  const { data: pedidoRows } = await supabase
    .from("pedidos_encomenda")
    .select("cliente_codigo")
    .not("cliente_codigo", "is", null)
    .gte("created_at", since);
  for (const r of pedidoRows ?? []) {
    const code = (r.cliente_codigo as string | null)?.trim();
    if (code) codes.add(code);
  }
  if (codes.size === 0) return { checked, upserted, errors };

  const { data: existing } = await supabase.from("totvs_clientes").select("protheus_code").in("protheus_code", [...codes]);
  const existingCodes = new Set((existing ?? []).map((r) => r.protheus_code as string));
  const missing = [...codes].filter((c) => !existingCodes.has(c)).slice(0, BACKFILL_MAX_CODES);

  for (const code of missing) {
    if (Date.now() - started > BACKFILL_TIME_BUDGET_MS) break;
    checked++;
    let json: TotvsClientListResponse;
    try {
      json = await fetchTotvs<TotvsClientListResponse>(`${BASE_URL}/rest/client?SearchQuery=${encodeURIComponent(code)}&Page=1&Size=10`);
    } catch (err) {
      errors.push(`backfill client ${code}: ${(err as Error).message}`);
      continue;
    }
    const match = (json.data ?? []).find((c) => String(c.id) === code);
    if (!match) continue; // não achou nem pela busca -- código digitado errado mesmo, não é problema de sync

    const { error } = await supabase.from("totvs_clientes").upsert(
      {
        protheus_code: match.id,
        cpf_cnpj: match.cpf_cnpj,
        name: match.name,
        status: match.status,
        last_purchase_date: ddmmyyyyToIso(match.lastPurchase),
        days_without_buying: match.daysWithoutBuying ?? null,
        phone1: match.phone1 || null,
        phone2: match.phone2 || null,
        email: match.email || null,
        contact_name: match.contactName || null,
        address_street: match.address?.street || null,
        address_number: match.address?.number != null ? String(match.address.number) : null,
        address_complement: match.address?.complement || null,
        address_neighborhood: match.address?.neighborhood || null,
        address_city: match.address?.city || null,
        address_cep: match.address?.cep || null,
        address_state: match.address?.state || null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "protheus_code" }
    );
    if (error) errors.push(`backfill client ${code}: ${error.message}`);
    else upserted++;
  }

  return { checked, upserted, errors };
}

// Grava a PÁGINA inteira de pedidos (e itens) em duas chamadas só, em vez
// de uma chamada por pedido + uma por item (era o gargalo real do sync de
// pedidos, descoberto em 2026-08-11 -- mesmo depois de corrigir o bug de
// retry, uma página de 100 pedidos com ~1.8 item cada significava ~280
// idas-e-voltas de rede sequenciais só nessa página). upsert aceita array
// igual aceita objeto único -- mesma semântica de onConflict, só que pra
// várias linhas de uma vez.
//
// Contrapartida aceita: se UMA linha do lote tiver dado inválido (violação
// de constraint etc.), o Postgres reverte o lote inteiro, não só a linha
// ruim -- diferente do laço um-a-um antigo, onde um pedido malformado não
// travava os outros da mesma página. Aceitável porque isso nunca aconteceu
// nos syncs reais até aqui (sempre 0 erros); se voltar a acontecer, dá pra
// reintroduzir um fallback pra gravação individual só no lote que falhar.
async function upsertOrdersBatch(supabase: SupabaseAdmin, orders: TotvsOrder[], errors: string[]): Promise<number> {
  if (orders.length === 0) return 0;

  const orderRows = orders.map((o) => ({
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
  }));

  const { data: upsertedOrders, error } = await supabase
    .from("totvs_orders")
    .upsert(orderRows, { onConflict: "invoice,serie,branch" })
    .select("id, invoice, serie, branch");
  if (error || !upsertedOrders) {
    errors.push(`orders lote de ${orders.length}: ${error?.message ?? "sem retorno"}`);
    return 0;
  }

  const idByKey = new Map(upsertedOrders.map((r) => [`${r.invoice}|${r.serie}|${r.branch}`, r.id]));
  const itemRows: {
    order_id: string;
    item_number: string;
    product: string | null;
    description: string | null;
    manufacturer: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number | null;
    sale_price: number | null;
    total: number;
    discount: number | null;
    tes: string | null;
    cfop: string | null;
  }[] = [];
  for (const o of orders) {
    const orderId = idByKey.get(`${o.invoice}|${o.serie}|${o.branch}`);
    if (!orderId) continue;
    for (const item of o.items ?? []) {
      itemRows.push({
        order_id: orderId,
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
      });
    }
  }

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from("totvs_order_items").upsert(itemRows, { onConflict: "order_id,item_number" });
    if (itemsError) errors.push(`order items lote de ${itemRows.length}: ${itemsError.message}`);
  }

  return upsertedOrders.length;
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

  const [failDay, failPageRaw, failCountRaw] = ((await getSyncState(supabase, "totvs_orders_day_fail")) ?? "").split(":");
  let failCount = failDay === day && Number(failPageRaw) === page ? Number(failCountRaw) || 0 : 0;

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
      failCount += 1;
      if (failCount >= ORDER_DAY_FAIL_LIMIT) {
        errors.push(`orders ${day} page ${page}: ${(err as Error).message} (pulado após ${failCount} falhas seguidas)`);
        await setSyncState(supabase, "totvs_orders_day_fail", "");
        day = isoDate(new Date(new Date(day).getTime() + ORDERS_WINDOW_DAYS * DAY_MS));
        page = 1;
        failCount = 0;
        continue;
      }
      // Antes disso era `break` -- terminava a execução inteira do sync de
      // pedidos por causa de UM pico passageiro de disputa de licença,
      // jogando fora o resto do orçamento de tempo (~300s) sem tentar mais
      // nada. Como esse erro é sempre o mesmo dia+página até a próxima
      // rodada do cron/script, "esperar a próxima execução" significava
      // esperar uma rodada inteira só pra reduzir o failCount em 1 --
      // descoberto em 2026-08-11 com o cursor 1 mês parado (2026-07-09,
      // página 4), sempre no mesmo lugar. `continue` tenta o mesmo dia+página
      // de novo aqui mesmo, ainda dentro do orçamento de tempo desta
      // execução (checado no topo do loop) -- geralmente resolve na 2ª/3ª
      // tentativa sem precisar de uma rodada nova, e só quando bate no
      // ORDER_DAY_FAIL_LIMIT é que pula o dia de verdade.
      errors.push(`orders ${day} page ${page}: ${(err as Error).message}`);
      await setSyncState(supabase, "totvs_orders_day_fail", `${day}:${page}:${failCount}`);
      continue;
    }
    if (failCount > 0) {
      await setSyncState(supabase, "totvs_orders_day_fail", "");
      failCount = 0;
    }
    const rows = json.data ?? [];
    checked += rows.length;
    upserted += await upsertOrdersBatch(supabase, rows, errors);

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

type ExistingDeliveryCarga = { carga: string; tentativa: number | null; status_entrega: string | null };

export type DeliveryRiskTrigger = { reason: string } | null;

// Compara o snapshot anterior de cargas de um pedido (o que já estava no
// banco antes deste sync) com o payload novo pra detectar que uma carga que
// já estava agendada foi cancelada, ou que o pedido foi "tirado" dela --
// gatilho que sempre sobrepõe uma classificação manual em snooze (ver
// listEntregasEmRisco em src/lib/entregasRisco.ts). Comparação por rótulo
// texto (não por código), ver nota em entregasRisco.ts sobre a ambiguidade
// dos códigos numéricos entre os namespaces CARGA/ENTREGA.
export function detectDeliveryRiskTrigger(
  existingCargas: ExistingDeliveryCarga[],
  incomingCargas: TotvsDeliveryCarga[]
): DeliveryRiskTrigger {
  // Pedido já entregue por alguma carga não é risco, mesmo que outra carga
  // do mesmo pedido apareça cancelada ou suma da lista depois -- caso comum
  // de carga duplicada/administrativa sendo limpa no Protheus DEPOIS da
  // entrega real já ter acontecido. Sem essa guarda, o gatilho abaixo
  // gravava risk_trigger_at nesse pedido, e como esse campo nunca é limpo
  // (só sobrescrito por um gatilho mais novo), o pedido ficava preso em
  // "alerta" pra sempre em listEntregasEmRisco -- bug real em produção,
  // achado 14/08/2026 (ver pedidoJaEntregue em entregasRisco.ts, mesma
  // ideia, mas do lado da leitura).
  if (incomingCargas.some((c) => DELIVERY_RESOLVIDO_LABELS.includes(c.statusEntrega ?? ""))) {
    return null;
  }

  const existingByCode = new Map(existingCargas.map((c) => [c.carga, c]));
  const incomingCodes = new Set(incomingCargas.map((c) => c.carga));

  for (const c of incomingCargas) {
    const prev = existingByCode.get(c.carga);
    if (c.statusEntrega === "Cancelada" && prev?.status_entrega !== "Cancelada") {
      return { reason: `Carga ${c.carga} foi cancelada.` };
    }
    if (!prev) {
      const precedidaPorTentativaRuim = existingCargas.some(
        (e) =>
          (e.tentativa ?? 0) < (c.tentativa ?? 0) &&
          (e.status_entrega === "Cancelada" || e.status_entrega === "Não Entregue")
      );
      if (precedidaPorTentativaRuim) {
        return { reason: `Nova tentativa (carga ${c.carga}) após tentativa anterior cancelada/não entregue.` };
      }
    }
  }

  for (const e of existingCargas) {
    if (!incomingCodes.has(e.carga)) {
      return { reason: `Carga ${e.carga} não aparece mais no pedido (pedido retirado da carga).` };
    }
  }

  return null;
}

async function upsertDelivery(supabase: SupabaseAdmin, d: TotvsDeliveryOrder, errors: string[]): Promise<boolean> {
  const { data: existingDelivery } = await supabase
    .from("totvs_deliveries")
    .select("id")
    .eq("pedido", d.order)
    .eq("filial_venda", d.branch)
    .maybeSingle();

  let existingCargas: ExistingDeliveryCarga[] = [];
  if (existingDelivery) {
    const { data } = await supabase
      .from("totvs_delivery_cargas")
      .select("carga, tentativa, status_entrega")
      .eq("delivery_id", existingDelivery.id);
    existingCargas = data ?? [];
  }

  const { data: deliveryRow, error } = await supabase
    .from("totvs_deliveries")
    .upsert(
      {
        pedido: d.order,
        filial_venda: d.branch,
        loja: d.loja || null,
        client_id: d.cliente?.codigo || null,
        client_loja: d.cliente?.loja || null,
        client_name: d.cliente?.nome || null,
        client_cpf_cnpj: d.cliente?.documento || null,
        client_neighborhood: d.cliente?.bairro || null,
        client_city: d.cliente?.municipio || null,
        client_state: d.cliente?.uf || null,
        status_atual: d.statusAtual || null,
        status_atual_codigo: d.statusAtualCodigo || null,
        total_cargas: d.totalCargas ?? (d.cargas?.length ?? 0),
        synced_at: new Date().toISOString(),
      },
      { onConflict: "pedido,filial_venda" }
    )
    .select("id")
    .single();
  if (error || !deliveryRow) {
    errors.push(`delivery ${d.order}: ${error?.message ?? "sem id retornado"}`);
    return false;
  }

  const trigger = detectDeliveryRiskTrigger(existingCargas, d.cargas ?? []);

  for (const c of d.cargas ?? []) {
    const { error: cargaError } = await supabase.from("totvs_delivery_cargas").upsert(
      {
        delivery_id: deliveryRow.id,
        carga: c.carga,
        dt_previsao: c.dtPrevisao || null,
        tentativa: c.tentativa ?? null,
        tipo_entrega: c.tipoEntrega || null,
        status_carga: c.statusCarga || null,
        status_carga_codigo: c.statusCargaCodigo || null,
        status_entrega: c.statusEntrega || null,
        status_entrega_codigo: c.statusEntregaCodigo || null,
        status_origem: c.statusOrigem || null,
        motorista_codigo: c.motorista?.codigo || null,
        motorista_nome: c.motorista?.nome || null,
        conferente_codigo: c.conferente?.codigo || null,
        conferente_nome: c.conferente?.nome || null,
        transportadora: c.transportadora || null,
        veiculo: c.veiculo || null,
        regiao: c.regiao || null,
        nota_fiscal: c.invoice || null,
        serie: c.serie || null,
        dt_retorno: c.dtRetorno || null,
        hr_retorno: c.hrRetorno || null,
        ocorrencia_codigo: c.ocorrencia?.codigo || null,
        ocorrencia_descricao: c.ocorrencia?.descricao || null,
        ocorrencia_categoria: c.ocorrencia?.categoria || null,
        ocorrencia_nivel: c.ocorrencia?.nivel || null,
      },
      { onConflict: "delivery_id,carga" }
    );
    if (cargaError) errors.push(`delivery ${d.order} carga ${c.carga}: ${cargaError.message}`);
  }

  if (trigger) {
    await supabase
      .from("totvs_deliveries")
      .update({ risk_trigger_at: new Date().toISOString(), risk_trigger_reason: trigger.reason })
      .eq("id", deliveryRow.id);
    await supabase.from("entrega_risco_events").insert({
      pedido: d.order,
      filial_venda: d.branch,
      actor_name: "Sincronização TOTVS",
      actor_role: "sistema",
      event_type: "reaberto_por_cancelamento",
      note: trigger.reason,
    });
  }

  return true;
}

type StaleDeliveryCandidate = { pedido: string; client_cpf_cnpj: string | null; status_atual: string | null; synced_at: string };

async function syncStaleDeliveries(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  const errors: string[] = [];
  let checked = 0;
  let upserted = 0;

  // Busca mais candidatos do que o limite final (STALE_PRIORITY_LIMIT) porque
  // vários pedidos podem compartilhar o mesmo CPF/CNPJ (mesmo cliente com
  // mais de uma venda) -- dedup por documento abaixo reduz antes de aplicar
  // o teto de chamadas à API.
  const { data: rows, error: fetchError } = await supabase
    .from("totvs_deliveries")
    .select("pedido, client_cpf_cnpj, status_atual, synced_at")
    .not("client_cpf_cnpj", "is", null)
    .order("synced_at", { ascending: true })
    .limit(STALE_PRIORITY_LIMIT * 4);
  if (fetchError) {
    errors.push(`stale deliveries: ${fetchError.message}`);
    return { checked, upserted, errors };
  }

  const candidates = ((rows ?? []) as StaleDeliveryCandidate[]).filter(
    (r) => !DELIVERY_ENCERRADO_LABELS.includes(r.status_atual ?? "")
  );
  const documents = [...new Set(candidates.map((r) => r.client_cpf_cnpj).filter((v): v is string => !!v))].slice(
    0,
    STALE_PRIORITY_LIMIT
  );

  for (const document of documents) {
    if (Date.now() - started > STALE_PRIORITY_TIME_BUDGET_MS) break;
    checked++;
    let json: TotvsDeliveryListResponse;
    try {
      json = await fetchTotvs<TotvsDeliveryListResponse>(
        `${BASE_URL}/rest/ai/deliveries?document=${encodeURIComponent(document)}&page=1&size=50`
      );
    } catch (err) {
      errors.push(`stale delivery document ${document}: ${(err as Error).message}`);
      continue;
    }
    for (const d of json.data ?? []) {
      if (await upsertDelivery(supabase, d, errors)) upserted++;
    }
  }

  return { checked, upserted, errors };
}

async function syncDeliveries(supabase: SupabaseAdmin): Promise<SyncResult> {
  const started = Date.now();
  let page = Number(await getSyncState(supabase, "totvs_deliveries_next_page")) || 1;
  let checked = 0;
  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < DELIVERY_PAGE_CAP; i++) {
    if (Date.now() - started > DELIVERIES_TIME_BUDGET_MS) break;

    let json: TotvsDeliveryListResponse;
    try {
      json = await fetchTotvs<TotvsDeliveryListResponse>(
        // Endpoint documentado com params em minúsculo (page/size), diferente
        // de /rest/client e /rest/orders (Page/Size) -- ver api-totvs.yaml.
        `${BASE_URL}/rest/ai/deliveries?page=${page}&size=${DELIVERY_PAGE_SIZE}`
      );
    } catch (err) {
      errors.push(`deliveries page ${page}: ${(err as Error).message}`);
      break;
    }
    const rows = json.data ?? [];
    checked += rows.length;

    for (const d of rows) {
      if (await upsertDelivery(supabase, d, errors)) upserted++;
    }

    if (rows.length === 0 || page >= (json.totalPages ?? page)) {
      page = 1;
      break;
    }
    page += 1;
  }

  await setSyncState(supabase, "totvs_deliveries_next_page", String(page));
  return { checked, upserted, errors };
}

export type TotvsSyncSummary = {
  ok: boolean;
  clients: { checked: number; upserted: number };
  orders: { checked: number; upserted: number };
  deliveriesStale: { checked: number; upserted: number };
  deliveries: { checked: number; upserted: number };
  clientsBackfill: { checked: number; upserted: number };
  stock: { checked: number; upserted: number };
  errors: string[];
};

export async function runTotvsSync(supabase: SupabaseAdmin): Promise<TotvsSyncSummary> {
  if (!BASE_URL || !process.env.TOTVS_API_KEY) {
    throw new Error("TOTVS_API_BASE_URL/TOTVS_API_KEY ausentes");
  }

  const clients = await syncClients(supabase);
  const orders = await syncOrders(supabase);
  // Antes do scan sequencial: refresca com prioridade os pedidos não
  // resolvidos mais desatualizados (ver comentário em syncStaleDeliveries).
  const deliveriesStale = await syncStaleDeliveries(supabase);
  const deliveries = await syncDeliveries(supabase);
  const clientsBackfill = await backfillMissingClients(supabase);
  const stock = await syncStock(supabase);

  const summary: TotvsSyncSummary = {
    ok:
      clients.errors.length === 0 &&
      orders.errors.length === 0 &&
      deliveriesStale.errors.length === 0 &&
      deliveries.errors.length === 0 &&
      clientsBackfill.errors.length === 0 &&
      stock.errors.length === 0,
    clients: { checked: clients.checked, upserted: clients.upserted },
    orders: { checked: orders.checked, upserted: orders.upserted },
    deliveriesStale: { checked: deliveriesStale.checked, upserted: deliveriesStale.upserted },
    deliveries: { checked: deliveries.checked, upserted: deliveries.upserted },
    clientsBackfill: { checked: clientsBackfill.checked, upserted: clientsBackfill.upserted },
    stock: { checked: stock.checked, upserted: stock.upserted },
    errors: [...clients.errors, ...orders.errors, ...deliveriesStale.errors, ...deliveries.errors, ...clientsBackfill.errors, ...stock.errors],
  };

  await recordSyncRun(
    "totvs",
    summary.ok,
    {
      clients: summary.clients,
      orders: summary.orders,
      deliveriesStale: summary.deliveriesStale,
      deliveries: summary.deliveries,
      clientsBackfill: summary.clientsBackfill,
      stock: summary.stock,
    },
    summary.errors
  );

  return summary;
}
