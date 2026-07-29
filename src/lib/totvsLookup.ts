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

  if (!data) return null;
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
