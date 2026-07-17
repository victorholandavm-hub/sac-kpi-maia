"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";

export async function setItemUnitValue(itemId: string, requestId: string, unitValue: number) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!Number.isFinite(unitValue) || unitValue < 0) throw new Error("Valor inválido.");

  const admin = getSupabaseAdmin();
  const { data: item } = await admin.from("service_request_items").select("product").eq("id", itemId).single();

  const { error } = await admin.from("service_request_items").update({ unit_value: unitValue }).eq("id", itemId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Valor definido para "${item?.product ?? "item"}": ${unitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}

export async function setItemPaymentReleased(itemId: string, requestId: string, released: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: item } = await admin.from("service_request_items").select("product").eq("id", itemId).single();

  const { error } = await admin
    .from("service_request_items")
    .update({
      payment_released: released,
      payment_released_at: released ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: released
      ? `Pagamento aprovado: "${item?.product ?? "item"}".`
      : `Aprovação de pagamento revertida: "${item?.product ?? "item"}".`,
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}
