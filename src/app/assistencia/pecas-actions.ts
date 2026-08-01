"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { isPartOrderStatus } from "@/lib/partOrders";
import { formatDateTimeBr } from "@/lib/formatDateTime";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type PartOrderFormState = { error?: string; success?: boolean } | undefined;

export async function createPartOrder(_state: PartOrderFormState, formData: FormData): Promise<PartOrderFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const partName = String(formData.get("part_name") ?? "").trim();
  if (!partName) {
    return { error: "Informe a peça." };
  }

  const supplierChoice = String(formData.get("supplier") ?? "").trim();
  const supplierOther = String(formData.get("supplier_other") ?? "").trim();
  const supplier = supplierChoice === "__outro__" ? supplierOther : supplierChoice;

  const admin = getSupabaseAdmin();

  if (supplier) {
    await admin.from("suppliers").upsert({ name: supplier }, { onConflict: "name" });
  }

  const defaultExpectedAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("part_orders")
    .insert({
      service_request_id: emptyToNull(formData.get("service_request_id")),
      client_name: emptyToNull(formData.get("client_name")),
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_email: emptyToNull(formData.get("client_email")),
      product: emptyToNull(formData.get("product")),
      part_name: partName,
      part_code: emptyToNull(formData.get("part_code")),
      color: emptyToNull(formData.get("color")),
      supplier: supplier || null,
      representative: emptyToNull(formData.get("representative")),
      requested_by: profile.fullName,
      notes: emptyToNull(formData.get("notes")),
      expected_at: emptyToNull(formData.get("expected_at")) ?? defaultExpectedAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar o pedido de peça: ${error?.message ?? "erro desconhecido"}` };
  }

  revalidatePath("/assistencia/pecas");
  return { success: true };
}

export async function updatePartOrderStatus(id: string, newStatus: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!isPartOrderStatus(newStatus)) throw new Error("Status inválido.");

  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const patch: Record<string, string> = { status: newStatus };
  if (newStatus === "peca_recebida") patch.part_arrived_at = today;
  if (newStatus === "enviada_ao_cliente") patch.sent_to_client_at = today;
  if (newStatus === "encerrado") patch.closed_at = today;

  const { error } = await admin.from("part_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
}

export async function setExpectedAt(id: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!newDate) throw new Error("Informe uma data.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update({ expected_at: newDate }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
}

export async function addPartOrderNote(id: string, note: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin.from("part_orders").select("notes").eq("id", id).single();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const stamp = formatDateTimeBr(new Date().toISOString());
  const appended = current.notes ? `${current.notes}\n[${stamp}] ${trimmed}` : `[${stamp}] ${trimmed}`;

  const { error } = await admin.from("part_orders").update({ notes: appended }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/pecas/${id}`);
}
