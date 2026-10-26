import { getSupabaseAdmin } from "./supabaseAdmin";
import { memoizeWithTtl } from "./memoCache";
import { inventarioSaldo, listarEmpresas, mensagemDeErro } from "./odoo/logistica";

// Estoque dos produtos por loja/CD pro SAC e a assistência -- pedido do
// Victor 26/10/2026 ("os atendentes do sac precisam ver os números do
// estoque de produtos"). Desde a virada de 25/10 o estoque vive no Odoo: o
// saldo vem da ponte do Pedro (/inventario/saldo, uma empresa por chamada).
// A busca por nome usa o cadastro de produtos que já temos (totvs_stock,
// mesmos códigos do Odoo) -- produto criado no Odoo depois de 24/10 só
// aparece buscando pelo código exato, até a ponte expor o catálogo.

const MAX_PRODUTOS = 6;
const CHAMADAS_SIMULTANEAS = 4;

export type ProdutoEstoque = { codigo: string; descricao: string | null; fabricante: string | null };
export type SaldoLoja = { empresaId: number; empresa: string; sistema: number; reservado: number; disponivel: number };
export type EstoqueProduto = ProdutoEstoque & { saldos: SaldoLoja[]; total: number; totalDisponivel: number };
export type ResultadoEstoque = {
  busca: string;
  produtos: EstoqueProduto[];
  // lojas que a ponte não respondeu (aparecem como "sem leitura", nunca como 0)
  falhas: { empresa: string; erro: string }[];
  limitado: boolean;
};

const empresasCache = memoizeWithTtl(() => listarEmpresas("logistica"), 60 * 60_000);

async function buscarProdutos(q: string): Promise<{ produtos: ProdutoEstoque[]; limitado: boolean }> {
  const admin = getSupabaseAdmin();
  const termo = q.trim();
  const codigo = termo.toUpperCase();
  const { data: exato } = await admin.from("totvs_stock").select("product_code, description, manufacturer").eq("product_code", codigo).limit(1);
  if (exato && exato.length > 0) {
    return { produtos: exato.map((p) => ({ codigo: p.product_code, descricao: p.description, fabricante: p.manufacturer })), limitado: false };
  }
  if (/^[A-Z]\d{4,}$/.test(codigo)) return { produtos: [{ codigo, descricao: null, fabricante: null }], limitado: false };
  // Todas as palavras precisam aparecer na descrição, em qualquer ordem.
  let consulta = admin.from("totvs_stock").select("product_code, description, manufacturer");
  for (const palavra of termo.split(/\s+/).filter((p) => p.length >= 2).slice(0, 5)) {
    consulta = consulta.ilike("description", `%${palavra.replace(/[%_,()]/g, " ")}%`);
  }
  const { data } = await consulta.order("description").limit(MAX_PRODUTOS + 1);
  const linhas = data ?? [];
  return {
    produtos: linhas.slice(0, MAX_PRODUTOS).map((p) => ({ codigo: p.product_code, descricao: p.description, fabricante: p.manufacturer })),
    limitado: linhas.length > MAX_PRODUTOS,
  };
}

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))));
  return out;
}

// 2 min: o saldo muda com as vendas, mas a mesma busca repetida (atendente
// conferindo) não deve bater de novo nas 16 empresas da ponte.
const saldosCache = memoizeWithTtl(
  async (codigos: string[]) => {
    const empresas = await empresasCache();
    const leituras = await emLotes(empresas, CHAMADAS_SIMULTANEAS, async (e) => {
      try {
        return { empresa: e, r: await inventarioSaldo(e.id, codigos), erro: null as string | null };
      } catch (err) {
        return { empresa: e, r: null, erro: mensagemDeErro(err) };
      }
    });
    return leituras;
  },
  2 * 60_000
);

export async function consultarEstoque(busca: string): Promise<ResultadoEstoque> {
  const q = busca.trim();
  if (q.length < 3) return { busca: q, produtos: [], falhas: [], limitado: false };
  const { produtos, limitado } = await buscarProdutos(q);
  if (produtos.length === 0) return { busca: q, produtos: [], falhas: [], limitado: false };

  const leituras = await saldosCache(produtos.map((p) => p.codigo));
  const falhas = leituras.filter((l) => l.erro).map((l) => ({ empresa: l.empresa.name, erro: l.erro! }));
  const resultado = produtos.map((p) => {
    const saldos: SaldoLoja[] = [];
    let nomeOdoo: string | undefined;
    for (const l of leituras) {
      const item = l.r?.itens.find((i) => i.codigo === p.codigo);
      if (!item || !item.existe) continue;
      nomeOdoo ??= item.nome;
      const sistema = Number(item.sistema ?? 0);
      const reservado = Number(item.reservado ?? 0);
      if (sistema === 0 && reservado === 0) continue;
      saldos.push({ empresaId: l.empresa.id, empresa: l.empresa.name, sistema, reservado, disponivel: sistema - reservado });
    }
    saldos.sort((a, b) => b.disponivel - a.disponivel || a.empresa.localeCompare(b.empresa));
    return {
      ...p,
      descricao: p.descricao ?? nomeOdoo ?? null,
      saldos,
      total: saldos.reduce((t, s) => t + s.sistema, 0),
      totalDisponivel: saldos.reduce((t, s) => t + Math.max(0, s.disponivel), 0),
    };
  });
  return { busca: q, produtos: resultado, falhas, limitado };
}

// Saldo de um produto só no CD, lido na hora (sem cache) -- conferência da
// transferência CD → AT antes de registrar (transferir-at-actions.ts).
export async function saldoNoCd(codigo: string): Promise<{ empresa: string; disponivel: number; nome: string | null } | null> {
  const cd = (await empresasCache()).find((e) => /\bCD\b/.test(e.name));
  if (!cd) return null;
  const r = await inventarioSaldo(cd.id, [codigo]);
  const item = r.itens.find((i) => i.codigo === codigo);
  if (!item || !item.existe) return { empresa: cd.name, disponivel: 0, nome: null };
  return { empresa: cd.name, disponivel: Number(item.sistema ?? 0) - Number(item.reservado ?? 0), nome: item.nome ?? null };
}
