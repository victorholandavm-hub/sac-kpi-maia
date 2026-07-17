"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { isSupplierReturnStatus } from "@/lib/supplierReturns";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

function emptyToNumber(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const n = parseFloat(str.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type SupplierReturnFormState = { error?: string; success?: boolean } | undefined;

export async function createSupplierReturn(
  _state: SupplierReturnFormState,
  formData: FormData
): Promise<SupplierReturnFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const partName = String(formData.get("part_name") ?? "").trim();
  if (!partName) return { error: "Informe a peça." };

  const supplierChoice = String(formData.get("supplier") ?? "").trim();
  const supplierOther = String(formData.get("supplier_other") ?? "").trim();
  const supplier = supplierChoice === "__outro__" ? supplierOther : supplierChoice;

  const admin = getSupabaseAdmin();
  if (supplier) {
    await admin.from("suppliers").upsert({ name: supplier }, { onConflict: "name" });
  }

  const { error } = await admin.from("supplier_returns").insert({
    supplier: supplier || null,
    product: emptyToNull(formData.get("product")),
    part_name: partName,
    invoice_number: emptyToNull(formData.get("invoice_number")),
    invoice_value: emptyToNumber(formData.get("invoice_value")),
    sent_at: emptyToNull(formData.get("sent_at")),
    expected_return_at: emptyToNull(formData.get("expected_return_at")),
    requested_by: profile.fullName,
    notes: emptyToNull(formData.get("notes")),
  });

  if (error) {
    return { error: `Não foi possível criar a remessa: ${error.message}` };
  }

  revalidatePath("/assistencia/fornecedores");
  return { success: true };
}

export async function updateSupplierReturnStatus(id: string, newStatus: string, reimbursedValue?: number) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!isSupplierReturnStatus(newStatus)) throw new Error("Status inválido.");

  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const patch: Record<string, string | number> = { status: newStatus };
  if (newStatus === "recebido") patch.received_at = today;
  if (newStatus === "reembolsado" && reimbursedValue !== undefined) patch.reimbursed_value = reimbursedValue;

  const { error } = await admin.from("supplier_returns").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/fornecedores");
  revalidatePath(`/assistencia/fornecedores/${id}`);
}

export async function addSupplierReturnNote(id: string, note: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin.from("supplier_returns").select("notes").eq("id", id).single();
  if (fetchError || !current) throw new Error("Remessa não encontrada.");

  const stamp = new Date().toLocaleString("pt-BR");
  const appended = current.notes ? `${current.notes}\n[${stamp}] ${trimmed}` : `[${stamp}] ${trimmed}`;

  const { error } = await admin.from("supplier_returns").update({ notes: appended }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/fornecedores/${id}`);
}
