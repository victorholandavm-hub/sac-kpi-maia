import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

export type SupplierReturnStatus = "aguardando_envio" | "enviado" | "recebido" | "reembolsado" | "finalizado";

export const SUPPLIER_RETURN_STATUSES: SupplierReturnStatus[] = [
  "aguardando_envio",
  "enviado",
  "recebido",
  "reembolsado",
  "finalizado",
];

export function isSupplierReturnStatus(value: string | undefined | null): value is SupplierReturnStatus {
  return !!value && (SUPPLIER_RETURN_STATUSES as string[]).includes(value);
}

export type SupplierReturn = {
  id: string;
  ticketNumber: number;
  supplier: string | null;
  product: string | null;
  partName: string;
  invoiceNumber: string | null;
  invoiceValue: number | null;
  sentAt: string | null;
  expectedReturnAt: string | null;
  receivedAt: string | null;
  reimbursedValue: number | null;
  status: SupplierReturnStatus;
  requestedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type SupplierReturnRow = {
  id: string;
  ticket_number: number;
  supplier: string | null;
  product: string | null;
  part_name: string;
  invoice_number: string | null;
  invoice_value: number | null;
  sent_at: string | null;
  expected_return_at: string | null;
  received_at: string | null;
  reimbursed_value: number | null;
  status: SupplierReturnStatus;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, ticket_number, supplier, product, part_name, invoice_number, invoice_value, sent_at, expected_return_at, received_at, reimbursed_value, status, requested_by, notes, created_at, updated_at";

function toSupplierReturn(row: SupplierReturnRow): SupplierReturn {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    supplier: row.supplier,
    product: row.product,
    partName: row.part_name,
    invoiceNumber: row.invoice_number,
    invoiceValue: row.invoice_value,
    sentAt: row.sent_at,
    expectedReturnAt: row.expected_return_at,
    receivedAt: row.received_at,
    reimbursedValue: row.reimbursed_value,
    status: row.status,
    requestedBy: row.requested_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSupplierReturns(
  opts: { status?: SupplierReturnStatus; supplier?: string; q?: string } = {}
): Promise<SupplierReturn[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("supplier_returns").select(COLUMNS).order("created_at", { ascending: false });

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.supplier) query = query.eq("supplier", opts.supplier);
  const q = opts.q?.trim();
  if (q) {
    const qSafe = sanitizeOrFilterValue(q);
    query = query.or([`part_name.ilike.%${qSafe}%`, `product.ilike.%${qSafe}%`, `invoice_number.ilike.%${qSafe}%`].join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SupplierReturnRow[]).map(toSupplierReturn);
}

export async function getSupplierReturn(id: string): Promise<SupplierReturn | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("supplier_returns").select(COLUMNS).eq("id", id).single();
  if (error || !data) return null;
  return toSupplierReturn(data as unknown as SupplierReturnRow);
}

export async function countSupplierReturnsOverview(): Promise<{ open: number; overdue: number }> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [openRes, overdueRes] = await Promise.all([
    admin.from("supplier_returns").select("id", { count: "exact", head: true }).not("status", "eq", "finalizado"),
    admin
      .from("supplier_returns")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "finalizado")
      .lt("expected_return_at", today),
  ]);

  return { open: openRes.count ?? 0, overdue: overdueRes.count ?? 0 };
}

// Item cru guardado do lado de cada linha de fornecedor -- mesma ideia de
// ReportRowItem em serviceRequests.ts, pra dar pra expandir e ver as
// remessas de verdade por trás de cada fornecedor (pedido do Victor
// 21/08/2026: "em todas as listas, assim que clicar, mostrar os
// detalhes").
export type SupplierReconciliationItem = {
  id: string;
  ticketNumber: number;
  partName: string;
  invoiceValue: number | null;
  reimbursedValue: number | null;
  status: SupplierReturnStatus;
};

export type SupplierReconciliationRow = {
  supplier: string;
  emDevolucao: number;
  faturado: number;
  reembolsado: number;
  pendente: number;
  items: SupplierReconciliationItem[];
};

// "Compartivos": valor por fornecedor em devolução (aguardando envio/enviado),
// faturado (nf emitida), já reembolsado, e o que ainda falta reembolsar.
export async function getSupplierReconciliation(): Promise<SupplierReconciliationRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("supplier_returns")
    .select("id, ticket_number, supplier, part_name, invoice_value, reimbursed_value, status");
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    supplier: string | null;
    part_name: string;
    invoice_value: number | null;
    reimbursed_value: number | null;
    status: SupplierReturnStatus;
  };
  const rows = (data ?? []) as unknown as Row[];

  const map = new Map<string, SupplierReconciliationRow>();
  for (const r of rows) {
    const key = r.supplier ?? "Sem fornecedor definido";
    const entry = map.get(key) ?? { supplier: key, emDevolucao: 0, faturado: 0, reembolsado: 0, pendente: 0, items: [] };
    const invoiceValue = r.invoice_value ?? 0;
    const reimbursedValue = r.reimbursed_value ?? 0;

    if (r.status === "aguardando_envio" || r.status === "enviado") entry.emDevolucao += invoiceValue;
    if (invoiceValue > 0) entry.faturado += invoiceValue;
    entry.reembolsado += reimbursedValue;
    entry.pendente += Math.max(0, invoiceValue - reimbursedValue);
    entry.items.push({
      id: r.id,
      ticketNumber: r.ticket_number,
      partName: r.part_name,
      invoiceValue: r.invoice_value,
      reimbursedValue: r.reimbursed_value,
      status: r.status,
    });

    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.faturado - a.faturado);
}
