import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";

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

function diasEntre(dataIso: string, hoje: Date): number {
  const d = new Date(`${dataIso}T00:00:00`);
  return Math.floor((hoje.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

// Mesmo corte que já divide "Inativo" na aba Status (ver FAIXAS_DIAS acima,
// faixa "180+ dias") -- reaproveitado aqui pra sinalizar quando um nível
// (Bronze/Prata/Ouro/Diamante) está "frio": calcularNivel nunca esfria
// sozinho (é histórico acumulado, não decai), então sem esse sinal um
// cliente que gastou muito há anos e nunca mais voltou aparece pra sempre
// como Diamante, igual a quem comprou esse mês -- pedido do Victor
// 17/08/2026 depois de eu levantar isso como ponto fraco do critério atual.
export const DIAS_INATIVO_RECENTE = 180;

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
  ultimaCompra: string | null;
  mesesRelacionamento: number | null;
  nivel: ClienteNivel;
  // 1º, 2º... por gasto acumulado dentro do próprio nível -- ver
  // atribuição em listClientesPorNivel. Fixo (não muda com busca/filtro na
  // tela), pra sempre refletir a posição real do cliente na categoria.
  posicaoNoNivel: number;
  diasSemComprar: number | null;
  // Nível "frio" -- ver DIAS_INATIVO_RECENTE. Não muda o nível em si (o
  // cálculo de calcularNivel continua igual, é histórico acumulado), só
  // sinaliza pra tela não confundir "Diamante de anos atrás, sumiu" com
  // "Diamante comprando até mês passado".
  inativoRecente: boolean;
};

// Pedido do Victor 15/08/2026: "LOJAS AIAM..." e "CONSUMIDOR FINAL" não são
// clientes de verdade -- são a própria empresa (raiz de CNPJ compartilhada
// entre as 4 filiais/CD que aparecem como "comprador" no Protheus por causa
// de transferência interna de mercadoria registrada como venda) e o
// placeholder genérico de venda balcão sem cliente identificado. Confirmado
// via dados reais (script descartável) que só existe UMA raiz de CNPJ da
// empresa aparecendo assim (39537682) -- outras empresas com CNPJ que
// compram de verdade (ex.: "CG3 ENGENHARIA LTDA") têm raiz diferente e
// continuam contando normalmente.
const COMPANY_CNPJ_ROOT = "39537682";
const NOMES_CLIENTE_INTERNO = new Set(["CONSUMIDOR FINAL"]);

function isClienteInterno(nome: string | null, cpfCnpj: string | null): boolean {
  if (cpfCnpj && cpfCnpj.startsWith(COMPANY_CNPJ_ROOT)) return true;
  if (nome && NOMES_CLIENTE_INTERNO.has(nome.trim().toUpperCase())) return true;
  return false;
}

const ORDER_PAGE_SIZE = 1000;

type ClientePedidoRow = {
  client_id: string | null;
  type: string;
  invoice_total: number;
  issue_date: string;
  client_name: string | null;
  client_cpf_cnpj: string | null;
};

// Busca o histórico de pedidos inteiro (paginado de verdade -- ver
// convenção já usada em vendasProduto.ts/entregasRisco.ts) e agrega por
// cliente. Gasto acumulado é líquido (Venda soma, Devolução subtrai,
// mesma convenção de vendasProduto.ts pra quantidade vendida). Computa
// tudo de uma vez -- cards e lista filtrável reaproveitam o mesmo array em
// memória, sem repetir a varredura. Páginas em PARALELO (ver
// fetchAllPagesParallel) -- achado 19/08/2026: era sequencial, até 200
// páginas (38 mil pedidos reais), boa parte dos 15,8s que a tela de
// Clientes chegou a demorar pra carregar.
export async function listClientesPorNivel(): Promise<ClienteNivelInfo[]> {
  const admin = getSupabaseAdmin();

  const rows = await fetchAllPagesParallel<ClientePedidoRow>(
    (from, to) =>
      admin
        .from("totvs_orders")
        .select("client_id, type, invoice_total, issue_date, client_name, client_cpf_cnpj", { count: "exact" })
        .not("client_id", "is", null)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<ClientePedidoRow>>,
    { pageSize: ORDER_PAGE_SIZE }
  );

  type Acc = { nome: string | null; cpfCnpj: string | null; compras: number; gasto: number; primeira: string | null; ultima: string | null };
  const porCliente = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.client_id) continue;
    if (isClienteInterno(r.client_name, r.client_cpf_cnpj)) continue;
    const acc = porCliente.get(r.client_id) ?? { nome: null, cpfCnpj: null, compras: 0, gasto: 0, primeira: null, ultima: null };
    if (r.type === "Venda") {
      acc.compras += 1;
      acc.gasto += r.invoice_total;
      if (!acc.primeira || r.issue_date < acc.primeira) acc.primeira = r.issue_date;
      if (!acc.ultima || r.issue_date > acc.ultima) acc.ultima = r.issue_date;
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
    const dias = acc.ultima ? diasEntre(acc.ultima, hoje) : null;
    resultado.push({
      clientId,
      nome: acc.nome,
      cpfCnpj: acc.cpfCnpj,
      compras: acc.compras,
      gastoAcumulado: acc.gasto,
      primeiraCompra: acc.primeira,
      ultimaCompra: acc.ultima,
      mesesRelacionamento: meses,
      nivel: calcularNivel(acc.compras, acc.gasto, meses),
      posicaoNoNivel: 0, // preenchido abaixo, depois que todo o nível está montado
      diasSemComprar: dias,
      inativoRecente: dias !== null && dias >= DIAS_INATIVO_RECENTE,
    });
  }

  // Posição (1º, 2º...) por gasto acumulado dentro do próprio nível --
  // precisa do nível já calculado pra cada cliente, por isso é um segundo
  // passo em vez de dar pra fazer junto do loop acima.
  const porNivelParaRank = new Map<ClienteNivel, ClienteNivelInfo[]>();
  for (const c of resultado) {
    const lista = porNivelParaRank.get(c.nivel) ?? [];
    lista.push(c);
    porNivelParaRank.set(c.nivel, lista);
  }
  for (const lista of porNivelParaRank.values()) {
    lista.sort((a, b) => b.gastoAcumulado - a.gastoAcumulado);
    lista.forEach((c, i) => {
      c.posicaoNoNivel = i + 1;
    });
  }

  return resultado;
}

export type ClienteCompra = {
  id: string;
  invoice: string | null;
  issueDate: string;
  invoiceTotal: number;
  type: string;
  branch: string | null;
  sellerName: string | null;
};

// Detalhe do cliente (clique no nome, tanto na aba Status quanto Nível de
// relacionamento) -- pedido do Victor 20/08/2026: "ao clicar no nome do
// cliente, aparecer as compras que ele já fez com data e valor de cada
// uma". client_id de totvs_orders é o mesmo protheus_code de totvs_clientes
// (chave já usada em listClientesPorNivel acima) -- funciona pros dois
// pontos de entrada sem precisar de mais nenhuma tabela. Nome/CPF vêm do
// próprio pedido (client_name/client_cpf_cnpj), não do cadastro
// totvs_clientes -- 24.584 códigos de cliente aparecem como comprador, só
// 3.760 têm cadastro completo sincronizado (mesmo motivo já documentado em
// listClientesPorNivel).
export async function listComprasDoCliente(
  clientId: string
): Promise<{ nome: string | null; cpfCnpj: string | null; compras: ClienteCompra[] }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("totvs_orders")
    .select("id, invoice, issue_date, invoice_total, type, branch, seller_name, client_name, client_cpf_cnpj")
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    invoice: string | null;
    issue_date: string;
    invoice_total: number;
    type: string;
    branch: string | null;
    seller_name: string | null;
    client_name: string | null;
    client_cpf_cnpj: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return {
    nome: rows.find((r) => r.client_name)?.client_name ?? null,
    cpfCnpj: rows.find((r) => r.client_cpf_cnpj)?.client_cpf_cnpj ?? null,
    compras: rows.map((r) => ({
      id: r.id,
      invoice: r.invoice,
      issueDate: r.issue_date,
      invoiceTotal: r.invoice_total,
      type: r.type,
      branch: r.branch,
      sellerName: r.seller_name,
    })),
  };
}
