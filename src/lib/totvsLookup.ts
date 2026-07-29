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
