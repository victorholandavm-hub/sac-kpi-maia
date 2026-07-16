"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { isMovementType } from "@/lib/stockMovements";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type StockMovementFormState = { error?: string; success?: boolean } | undefined;

export async function createStockMovement(
  _state: StockMovementFormState,
  formData: FormData
): Promise<StockMovementFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const movementType = String(formData.get("movement_type") ?? "");
  if (!isMovementType(movementType)) {
    return { error: "Tipo de movimentação inválido." };
  }

  const product = String(formData.get("product") ?? "").trim();
  if (!product) {
    return { error: "Informe o produto." };
  }

  const factoryChoice = String(formData.get("factory") ?? "").trim();
  const factoryOther = String(formData.get("factory_other") ?? "").trim();
  const factory = factoryChoice === "__outro__" ? factoryOther : factoryChoice;

  const admin = getSupabaseAdmin();
  if (factory) {
    await admin.from("suppliers").upsert({ name: factory }, { onConflict: "name" });
  }

  const { error } = await admin.from("stock_movements").insert({
    movement_type: movementType,
    code: emptyToNull(formData.get("code")),
    product,
    factory: factory || null,
    client_name: emptyToNull(formData.get("client_name")),
    volume: emptyToNull(formData.get("volume")),
    responsible: profile.fullName,
    movement_date: emptyToNull(formData.get("movement_date")),
    logged_date: emptyToNull(formData.get("logged_date")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (error) {
    return { error: `Não foi possível registrar a movimentação: ${error.message}` };
  }

  revalidatePath("/assistencia/estoque");
  return { success: true };
}
