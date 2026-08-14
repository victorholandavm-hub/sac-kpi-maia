import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

// Perfil de compra/relacionamento dos clientes -- pedido do Victor
// 14/08/2026: "preciso classificar os clientes". A classificação por
// STATUS (ativo/inativo/nunca comprou + dias sem comprar) já vem PRONTA
// do Protheus, sincronizada em totvs_clientes (ver syncClients em
// totvsSync.ts). A classificação por NÍVEL DE RELACIONAMENTO
// (Bronze/Prata/Ouro/Diamante, mais abaixo) é uma regra própria que o
// Victor passou (tabela de critérios), calculada em cima do histórico de
// pedidos -- ver calcularNivel.

export const CLIENTE_STATUSES = ["ativo", "inativo", "nunca comprou"] as const;
export type ClienteStatus = (typeof CLIENTE_STATUSES)[number];

export function isClienteStatus(value: string | undefined | null): value is ClienteStatus {
  return !!value && (CLIENTE_STATUSES as readonly string[]).includes(value);
}

export const CLIENTE_STATUS_LABELS: Record<ClienteStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  "nunca comprou": "Nunca comprou",
};

export const CLIENTE_STATUS_COLORS: Record<ClienteStatus, string> = {
  ativo: "var(--status-good)",
  inativo: "var(--status-critical)",
  "nunca comprou": "var(--text-muted)",
};

// Faixas de "dias sem comprar" -- só fazem sentido pra quem já comprou
// alguma vez (ativo/inativo); "nunca comprou" não entra nessa quebra (ver
// getClientesResumo). Pensadas pra sinalizar quem está "esfriando" antes
// de virar inativo de vez: 0-30 ainda quente, 31-90 esfriando, 91-180
// alerta, 180+ já bem frio.
const FAIXAS_DIAS = [
  { label: "0–30 dias", min: 0, max: 30 },
  { label: "31–90 dias", min: 31, max: 90 },
  { label: "91–180 dias", min: 91, max: 180 },
  { label: "180+ dias", min: 181, max: null as number | null },
] as const;

export type ClientesResumo = {
  porStatus: { status: ClienteStatus; total: number }[];
  porFaixaDias: { status: ClienteStatus; faixa: string; total: number }[];
  totalGeral: number;
};

// Só contagens (head: true) -- 3.760 clientes hoje cabem numa página só,
// mas conta em vez de trazer linha por linha é mais barato de qualquer
// jeito, e não cresce com a base de clientes do jeito que um SELECT
// completo cresceria.
export async function getClientesResumo(): Promise<ClientesResumo> {
  const admin = getSupabaseAdmin();

  const porStatus = await Promise.all(
    CLIENTE_STATUSES.map(async (status) => {
      const { count, error } = await admin.from("totvs_clientes").select("id", { count: "exact", head: true }).eq("status", status);
      if (error) throw new Error(error.message);
      return { status, total: count ?? 0 };
    })
  );

  const statusComFaixa: ClienteStatus[] = ["ativo", "inativo"];
  const porFaixaDias = (
    await Promise.all(
      statusComFaixa.flatMap((status) =>
        FAIXAS_DIAS.map(async (faixa) => {
          let query = admin
            .from("totvs_clientes")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
            .gte("days_without_buying", faixa.min);
          if (faixa.max !== null) query = query.lte("days_without_buying", faixa.max);
          const { count, error } = await query;
          if (error) throw new Error(error.message);
          return { status, faixa: faixa.label, total: count ?? 0 };
        })
      )
    )
  ).filter((f) => f.total > 0);

  return {
    porStatus,
    porFaixaDias,
    totalGeral: porStatus.reduce((sum, s) => sum + s.total, 0),
  };
}

export type ClienteListItem = {
  protheusCode: string;
  name: string;
  cpfCnpj: string;
  status: ClienteStatus;
  lastPurchaseDate: string | null;
  daysWithoutBuying: number | null;
  phone1: string | null;
  city: string | null;
  state: string | null;
};

export type ListClientesResult = {
  items: ClienteListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const CLIENTES_PAGE_SIZE = 50;

export async function listClientes(
  opts: { q?: string; status?: ClienteStatus; page?: number } = {}
): Promise<ListClientesResult> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = CLIENTES_PAGE_SIZE;

  let query = admin
    .from("totvs_clientes")
    .select("protheus_code, name, cpf_cnpj, status, last_purchase_date, days_without_buying, phone1, address_city, address_state", {
      count: "exact",
    })
    .order("name");

  if (opts.status) query = query.eq("status", opts.status);

  const q = opts.q?.trim();
  if (q) {
    const qSafe = sanitizeOrFilterValue(q);
    query = query.or(`name.ilike.%${qSafe}%,phone1.ilike.%${qSafe}%,address_city.ilike.%${qSafe}%,cpf_cnpj.ilike.%${qSafe}%`);
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    protheus_code: string;
    name: string;
    cpf_cnpj: string;
    status: string;
    last_purchase_date: string | null;
    days_without_buying: number | null;
    phone1: string | null;
    address_city: string | null;
    address_state: string | null;
  };

  return {
    items: ((data ?? []) as unknown as Row[]).map((r) => ({
      protheusCode: r.protheus_code,
      name: r.name,
      cpfCnpj: r.cpf_cnpj,
      status: isClienteStatus(r.status) ? r.status : "nunca comprou",
      lastPurchaseDate: r.last_purchase_date,
      daysWithoutBuying: r.days_without_buying,
      phone1: r.phone1,
      city: r.address_city,
      state: r.address_state,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------
// Nível de relacionamento (Bronze/Prata/Ouro/Diamante) -- regra própria
// passada pelo Victor 14/08/2026 (tabela de critérios), calculada em cima
// do histórico de pedidos (totvs_orders), NÃO do cadastro totvs_clientes:
// só 3.760 clientes têm cadastro completo sincronizado, mas 24.584
// códigos de cliente distintos já aparecem como comprador em algum
// pedido -- usar o cadastro como base deixaria de fora a esmagadora
// maioria de quem já comprou de verdade. Nome/CPF-CNPJ vêm do próprio
// pedido (client_name/client_cpf_cnpj, sempre preenchidos), não precisa
// do cadastro pra isso.
// ---------------------------------------------------------------------

export const CLIENTE_NIVEIS = ["diamante", "ouro", "prata", "bronze", "sem_compra"] as const;
export type ClienteNivel = (typeof CLIENTE_NIVEIS)[number];

export function isClienteNivel(value: string | undefined | null): value is ClienteNivel {
  return !!value && (CLIENTE_NIVEIS as readonly string[]).includes(value);
}

export const CLIENTE_NIVEL_LABELS: Record<ClienteNivel, string> = {
  diamante: "Diamante",
  ouro: "Ouro",
  prata: "Prata",
  bronze: "Bronze",
  sem_compra: "Sem compra",
};

export const CLIENTE_NIVEL_COLORS: Record<ClienteNivel, string> = {
  diamante: "var(--series-4)",
  ouro: "var(--series-3)",
  prata: "var(--text-secondary)",
  bronze: "var(--brand-orange)",
  sem_compra: "var(--text-muted)",
};

function mesesEntre(dataIso: string, hoje: Date): number {
  const d = new Date(`${dataIso}T00:00:00`);
  return (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth());
}

// Cada nível é "basta um destes" (OR entre os 2-3 critérios) -- checado do
// nível mais alto pro mais baixo, o primeiro que bater vence. Sem compra
// nenhuma não é "Bronze" (Bronze exige "1ª compra") -- fica de fora, num
// nível à parte (sem_compra), pra não confundir "comprou uma vez, recente"
// com "nunca comprou".
export function calcularNivel(compras: number, gastoAcumulado: number, mesesRelacionamento: number | null): ClienteNivel {
  if (compras <= 0 || mesesRelacionamento === null) return "sem_compra";
  const recompras = compras - 1;

  if (gastoAcumulado > 10000 || (mesesRelacionamento >= 24 && recompras >= 2)) return "diamante";
  if (compras >= 3 || (mesesRelacionamento >= 12 && mesesRelacionamento <= 24 && recompras >= 1) || (gastoAcumulado >= 5000 && gastoAcumulado <= 10000)) {
    return "ouro";
  }
  if (compras >= 2 || (mesesRelacionamento >= 6 && mesesRelacionamento <= 12) || (gastoAcumulado >= 1500 && gastoAcumulado <= 5000)) {
    return "prata";
  }
  return "bronze";
}

export type ClienteNivelInfo = {
  clientId: string;
  nome: string | null;
  cpfCnpj: string | null;
  compras: number;
  gastoAcumulado: number;
  primeiraCompra: string | null;
  mesesRelacionamento: number | null;
  nivel: ClienteNivel;
};

const ORDER_PAGE_SIZE = 1000;
const ORDER_MAX_PAGINAS = 200;

// Busca o histórico de pedidos inteiro (paginado de verdade -- ver
// convenção já usada em vendasProduto.ts/entregasRisco.ts) e agrega por
// cliente. Gasto acumulado é líquido (Venda soma, Devolução subtrai,
// mesma convenção de vendasProduto.ts pra quantidade vendida). Computa
// tudo de uma vez -- cards e lista filtrável reaproveitam o mesmo array em
// memória, sem repetir a varredura.
export async function listClientesPorNivel(): Promise<ClienteNivelInfo[]> {
  const admin = getSupabaseAdmin();

  type Row = {
    client_id: string | null;
    type: string;
    invoice_total: number;
    issue_date: string;
    client_name: string | null;
    client_cpf_cnpj: string | null;
  };
  const rows: Row[] = [];
  for (let pagina = 0; pagina < ORDER_MAX_PAGINAS; pagina++) {
    const from = pagina * ORDER_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_orders")
      .select("client_id, type, invoice_total, issue_date, client_name, client_cpf_cnpj")
      .not("client_id", "is", null)
      .range(from, from + ORDER_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < ORDER_PAGE_SIZE) break;
  }

  type Acc = { nome: string | null; cpfCnpj: string | null; compras: number; gasto: number; primeira: string | null };
  const porCliente = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.client_id) continue;
    const acc = porCliente.get(r.client_id) ?? { nome: null, cpfCnpj: null, compras: 0, gasto: 0, primeira: null };
    if (r.type === "Venda") {
      acc.compras += 1;
      acc.gasto += r.invoice_total;
      if (!acc.primeira || r.issue_date < acc.primeira) acc.primeira = r.issue_date;
    } else if (r.type === "Devolucao") {
      acc.gasto -= r.invoice_total;
    }
    if (!acc.nome && r.client_name) acc.nome = r.client_name;
    if (!acc.cpfCnpj && r.client_cpf_cnpj) acc.cpfCnpj = r.client_cpf_cnpj;
    porCliente.set(r.client_id, acc);
  }

  const hoje = new Date();
  const resultado: ClienteNivelInfo[] = [];
  for (const [clientId, acc] of porCliente) {
    const meses = acc.primeira ? mesesEntre(acc.primeira, hoje) : null;
    resultado.push({
      clientId,
      nome: acc.nome,
      cpfCnpj: acc.cpfCnpj,
      compras: acc.compras,
      gastoAcumulado: acc.gasto,
      primeiraCompra: acc.primeira,
      mesesRelacionamento: meses,
      nivel: calcularNivel(acc.compras, acc.gasto, meses),
    });
  }
  return resultado;
}
