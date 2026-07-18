import { getSupabaseAdmin } from "./supabaseAdmin";

export async function listAssemblers(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => a.name as string);
}

export type AssemblerWithPinStatus = { name: string; hasPin: boolean };

export async function listAssemblersWithPinStatus(): Promise<AssemblerWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ name: a.name as string, hasPin: !!a.pin_hash }));
}

export type PaymentItem = {
  itemId: string;
  requestId: string;
  product: string;
  quantity: number;
  unitValue: number | null;
  paymentReleased: boolean;
  paymentReleasedAt: string | null;
  paymentAuthorizedBy: string | null;
  assemblerName: string | null;
  clientName: string | null;
  storeName: string;
  createdAt: string;
};

type PaymentItemRow = {
  id: string;
  product: string;
  quantity: number;
  unit_value: number | null;
  payment_released: boolean;
  payment_released_at: string | null;
  payment_authorized_by: string | null;
  request: {
    id: string;
    assembler_name: string | null;
    client_name: string | null;
    created_at: string;
    stores: { name: string } | null;
  } | null;
};

export async function listPaymentItems(
  opts: { assemblerName?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<PaymentItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_request_items")
    .select(
      "id, product, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, request:service_requests(id, assembler_name, client_name, created_at, stores(name))"
    )
    .not("unit_value", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as PaymentItemRow[])
    .filter((row) => row.request !== null)
    .map((row) => ({
      itemId: row.id,
      requestId: row.request!.id,
      product: row.product,
      quantity: row.quantity,
      unitValue: row.unit_value,
      paymentReleased: row.payment_released,
      paymentReleasedAt: row.payment_released_at,
      paymentAuthorizedBy: row.payment_authorized_by,
      assemblerName: row.request!.assembler_name,
      clientName: row.request!.client_name,
      storeName: row.request!.stores?.name ?? "",
      createdAt: row.request!.created_at,
    }));

  return items.filter((i) => {
    if (opts.assemblerName && i.assemblerName !== opts.assemblerName) return false;
    if (opts.dateFrom && i.createdAt < opts.dateFrom) return false;
    if (opts.dateTo && i.createdAt > `${opts.dateTo}T23:59:59`) return false;
    return true;
  });
}

export async function countPendingPayments(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("service_request_items")
    .select("id", { count: "exact", head: true })
    .not("unit_value", "is", null)
    .eq("payment_released", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
