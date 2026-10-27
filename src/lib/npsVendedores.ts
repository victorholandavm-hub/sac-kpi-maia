import { separarVendedorOdoo } from "./vendaNpsOdoo";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";

// NPS de atendimento em loja por vendedor (pesquisa "Pós-venda", ver
// vendaNps.ts) pra API do app onde os vendedores lançam venda -- pedido do
// Victor 21/10/2026, consumidor: Pedro. Só agregados: nenhum dado de cliente
// sai daqui. Mesma régua do resto do projeto: 1 a 5, promotor 4-5, neutro 3,
// detrator 1-2, NPS = (promotores - detratores) / respostas x 100.

export const NPS_VENDEDORES_JANELA_MAXIMA_DIAS = 366;

export type FiltroNpsVendedores = { de: string; ate: string; filial: string | null; vendedor: string | null };

export type NpsResumo = {
  enviadas: number;
  respostas: number;
  taxaResposta: number | null;
  nps: number | null;
  media: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  notas: Record<"1" | "2" | "3" | "4" | "5", number>;
};

export type NpsVendedor = NpsResumo & { codigo: string | null; nome: string | null; filiais: string[] };

type Linha = {
  score: number | null;
  totvs_orders: { seller_id: string | null; seller_name: string | null; branch: string; issue_date: string };
};

export function resumirNps(notas: (number | null)[]): NpsResumo {
  const respondidas = notas.filter((n): n is number => n !== null);
  const contagem = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const n of respondidas) contagem[String(n) as keyof typeof contagem]++;
  const promotores = contagem["4"] + contagem["5"];
  const detratores = contagem["1"] + contagem["2"];
  const r = respondidas.length;
  return {
    enviadas: notas.length,
    respostas: r,
    taxaResposta: notas.length > 0 ? Math.round((r / notas.length) * 1000) / 1000 : null,
    nps: r > 0 ? Math.round(((promotores - detratores) / r) * 100) : null,
    media: r > 0 ? Math.round((respondidas.reduce((t, n) => t + n, 0) / r) * 100) / 100 : null,
    promotores,
    neutros: contagem["3"],
    detratores,
    notas: contagem,
  };
}

// Vendedor pelo código do Protheus (seller_id); sem código, pelo nome.
export function agruparPorVendedor(linhas: Linha[]): NpsVendedor[] {
  const grupos = new Map<string, { codigo: string | null; nome: string | null; filiais: Set<string>; notas: (number | null)[] }>();
  for (const l of linhas) {
    const o = l.totvs_orders;
    const codigo = o.seller_id?.trim() || null;
    const nome = o.seller_name?.trim() || null;
    const chave = codigo ? `c:${codigo}` : `n:${nome ?? ""}`;
    const g = grupos.get(chave) ?? { codigo, nome, filiais: new Set<string>(), notas: [] };
    g.filiais.add(o.branch);
    g.notas.push(l.score);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({ codigo: g.codigo, nome: g.nome, filiais: [...g.filiais].sort(), ...resumirNps(g.notas) }))
    .sort((a, b) => (b.nps ?? -999) - (a.nps ?? -999) || b.respostas - a.respostas || (a.nome ?? "").localeCompare(b.nome ?? ""));
}

const normalizarNome = (n: string) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();

// Vendas do Odoo (venda_nps_odoo, desde a virada de 25/10): o Odoo só dá o nome
// do vendedor; quando o nome bate com um vendedor do Protheus, entra no código
// dele (mesma linha no resultado). Filtro por código de vendedor não se aplica
// a quem só tem nome.
export function linhasOdooComoProtheus(
  odoo: { score: number | null; vendedor: string | null; loja: string | null; data_venda: string }[],
  protheus: Linha[]
): Linha[] {
  const codigoPorNome = new Map<string, string>();
  for (const l of protheus) {
    const c = l.totvs_orders.seller_id?.trim();
    const n = l.totvs_orders.seller_name?.trim();
    if (c && n) codigoPorNome.set(normalizarNome(n), c);
  }
  return odoo.map((o) => {
    const v = separarVendedorOdoo(o.vendedor);
    return {
    score: o.score,
    totvs_orders: {
      // Nome bate com vendedor do Protheus: entra no código dele; senão, o
      // código do vendedor no Odoo ("L17").
      seller_id: (v.nome ? codigoPorNome.get(normalizarNome(v.nome)) : undefined) ?? v.codigo,
      seller_name: v.nome,
      branch: o.loja ?? "",
      issue_date: o.data_venda,
    },
    };
  });
}

async function linhasDoOdoo(filtro: FiltroNpsVendedores, protheus: Linha[]): Promise<Linha[]> {
  let q = getSupabaseAdmin()
    .from("venda_nps_odoo")
    .select("score, vendedor, loja, data_venda")
    .is("descartada_em", null)
    .gte("data_venda", filtro.de)
    .lte("data_venda", filtro.ate);
  if (filtro.filial) q = q.eq("loja", filtro.filial);
  const { data, error } = await q.limit(20000);
  if (error) throw new Error(error.message);
  const linhas = linhasOdooComoProtheus((data ?? []) as Parameters<typeof linhasOdooComoProtheus>[0], protheus);
  return filtro.vendedor ? linhas.filter((l) => l.totvs_orders.seller_id === filtro.vendedor) : linhas;
}

export async function getNpsVendedores(filtro: FiltroNpsVendedores) {
  const admin = getSupabaseAdmin();
  const linhas = await fetchAllPagesParallel<Linha>((from, to) => {
    let q = admin
      .from("venda_nps")
      .select("score, totvs_orders!inner(seller_id, seller_name, branch, issue_date)", { count: "exact" })
      .gte("totvs_orders.issue_date", filtro.de)
      .lte("totvs_orders.issue_date", filtro.ate);
    if (filtro.filial) q = q.eq("totvs_orders.branch", filtro.filial);
    if (filtro.vendedor) q = q.eq("totvs_orders.seller_id", filtro.vendedor);
    return q.order("order_id").range(from, to) as unknown as PromiseLike<PagedQueryResult<Linha>>;
  });
  const todas = [...linhas, ...(await linhasDoOdoo(filtro, linhas))];
  return {
    periodo: { de: filtro.de, ate: filtro.ate },
    filtros: { filial: filtro.filial, vendedor: filtro.vendedor },
    geradoEm: new Date().toISOString(),
    total: resumirNps(todas.map((l) => l.score)),
    vendedores: agruparPorVendedor(todas),
  };
}
