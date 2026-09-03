import { getSupabaseAdmin } from "./supabaseAdmin";

export type TotvsOrderSuggestion = {
  invoice: string;
  issueDate: string | null;
  clientName: string | null;
  invoiceTotal: number;
};

// Sugestão, não validação: usado pra popular um <datalist> na hora de
// informar a NF-e de uma encomenda, sem travar o envio se não bater com
// nada (ver src/components/assistencia/PedidoEncomendaActions.tsx).
// ilike em substring casa "444" digitado com "000000444" armazenado sem
// precisar normalizar zero-padding.
export async function searchTotvsOrdersByInvoice(query: string, branch: string): Promise<TotvsOrderSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("totvs_orders")
    .select("invoice, issue_date, client_name, invoice_total")
    .eq("branch", branch)
    .ilike("invoice", `%${trimmed}%`)
    .order("issue_date", { ascending: false })
    .limit(8);

  return (data ?? []).map((r) => ({
    invoice: r.invoice,
    issueDate: r.issue_date,
    clientName: r.client_name,
    invoiceTotal: r.invoice_total,
  }));
}

export type TotvsClientMatch = {
  protheusCode: string;
  name: string;
  cpfCnpj: string;
  phone1: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
};

// Busca exata por código do cliente -- autopreenche nome/CPF/telefone
// (dado confiável, vem do cadastro) e sugere endereço (editável, porque o
// cliente pode ter mudado desde a última sincronização).
export async function findTotvsClientByCode(code: string): Promise<TotvsClientMatch | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("totvs_clientes")
    .select(
      "protheus_code, name, cpf_cnpj, phone1, address_street, address_number, address_complement, address_neighborhood, address_city, address_state"
    )
    .eq("protheus_code", trimmed)
    .maybeSingle();

  if (data) {
    return {
      protheusCode: data.protheus_code,
      name: data.name,
      cpfCnpj: data.cpf_cnpj,
      phone1: data.phone1,
      addressStreet: data.address_street,
      addressNumber: data.address_number,
      addressComplement: data.address_complement,
      addressNeighborhood: data.address_neighborhood,
      addressCity: data.address_city,
      addressState: data.address_state,
    };
  }

  // Cadastro completo (totvs_clientes) só cobre uma fração de quem já
  // comprou -- mesmo gap já confirmado em clientes.ts/avaliar/actions.ts
  // (24.584 códigos distintos aparecem como comprador em algum pedido, só
  // 3.760 têm cadastro sincronizado). Sem esse fallback, buscar um código
  // de cliente real (ex.: 106044/FABIO GOMES, tem pedido mas não tem
  // cadastro) simplesmente não achava nada -- confirmado em produção
  // 17/08/2026. totvs_orders não tem telefone/endereço, só nome e CPF, mas
  // já evita a pessoa ter que digitar tudo à mão de novo.
  const { data: order } = await admin
    .from("totvs_orders")
    .select("client_name, client_cpf_cnpj")
    .eq("client_id", trimmed)
    .not("client_name", "is", null)
    .order("issue_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order?.client_name) return null;

  return {
    protheusCode: trimmed,
    name: order.client_name,
    cpfCnpj: order.client_cpf_cnpj ?? "",
    phone1: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
  };
}

export type TotvsProductMatch = {
  productCode: string;
  description: string | null;
  manufacturer: string | null;
};

// Bug real, achado pelo Victor 03/09/2026: "ainda não encontro produto e
// cliente pelo código". Causa: essa função só buscava em totvs_order_items
// (itens de venda já sincronizados), e o comentário original dizia "não
// existe um catálogo de produtos separado" -- mas existe, sim: totvs_stock
// (sincronizado por syncStock em totvsSync.ts) é o catálogo completo do
// Protheus, com todo produto que tem posição de estoque, vendido ou não.
// Conferido em produção: totvs_order_items só tem 2.030 produtos distintos
// (só o que apareceu numa venda já sincronizada, dentro da janela de dias
// que syncOrders cobre) contra 71.326 em totvs_stock -- exatamente o mesmo
// tipo de gap já resolvido pra cliente logo acima (findTotvsClientByCode),
// só que aqui nunca tinha ganhado o fallback equivalente.
export async function findTotvsProductByCode(code: string): Promise<TotvsProductMatch | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const admin = getSupabaseAdmin();
  const { data: stock } = await admin
    .from("totvs_stock")
    .select("product_code, description, manufacturer")
    .eq("product_code", trimmed)
    .maybeSingle();

  if (stock) {
    return {
      productCode: stock.product_code ?? trimmed,
      description: stock.description,
      manufacturer: stock.manufacturer,
    };
  }

  // Fallback: produto sem posição de estoque atual (ex.: descontinuado) mas
  // que já apareceu em alguma venda sincronizada -- mesmo espírito do
  // fallback de cliente acima, cobre o que o catálogo de estoque não pega.
  const { data: item } = await admin
    .from("totvs_order_items")
    .select("product, description, manufacturer")
    .eq("product", trimmed)
    .limit(1)
    .maybeSingle();

  if (!item) return null;
  return {
    productCode: item.product ?? trimmed,
    description: item.description,
    manufacturer: item.manufacturer,
  };
}
