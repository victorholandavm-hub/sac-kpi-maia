"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";

export async function setItemUnitValue(itemId: string, requestId: string, unitValue: number) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!Number.isFinite(unitValue) || unitValue < 0) throw new Error("Valor inválido.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_request_items").update({ unit_value: unitValue }).eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}

export async function setItemPaymentReleased(itemId: string, requestId: string, released: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("service_request_items")
    .update({
      payment_released: released,
      payment_released_at: released ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}
