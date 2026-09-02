"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole, type Profile } from "@/lib/dal";
import { PAYMENTS_CONTROLLER_NAME } from "@/lib/assistenciaLabels";

function requirePaymentsController(profile: Profile) {
  requireRole(profile, "assistencia", "admin");
  if (profile.fullName !== PAYMENTS_CONTROLLER_NAME) {
    throw new Error(`Só ${PAYMENTS_CONTROLLER_NAME} pode definir valor ou mexer em pagamento.`);
  }
}

export async function setItemUnitValue(itemId: string, requestId: string, unitValue: number) {
  const profile = await getProfile();
  requirePaymentsController(profile);
  if (!Number.isFinite(unitValue) || unitValue < 0) throw new Error("Valor inválido.");

  const admin = getSupabaseAdmin();

  // Montador concluiu mas o gerente da loja ainda não aprovou -- mesma trava
  // de espírito do "só libera pagamento depois de concluída" abaixo em
  // setItemPaymentReleased, só que aplicada mais cedo: nem o valor pode ser
  // definido enquanto a aprovação estiver pendente (pedido do Victor
  // 02/09/2026, confirmado testando o fluxo ao vivo). Pra qualquer status
  // anterior a isso (aberta, em_andamento etc.) continua permitido definir
  // valor adiantado, como já era -- a trava é só nessa janela específica.
  const { data: request } = await admin.from("service_requests").select("status").eq("id", requestId).single();
  if (request?.status === "aguardando_aprovacao") {
    throw new Error("Essa montagem ainda está aguardando a aprovação do gerente da loja.");
  }

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

export async function setItemPaymentAuthorizedBy(itemId: string, requestId: string, managerName: string) {
  const profile = await getProfile();
  requirePaymentsController(profile);
  const trimmed = managerName.trim();
  if (!trimmed) throw new Error("Informe o nome do gerente.");

  const admin = getSupabaseAdmin();
  const { data: item } = await admin.from("service_request_items").select("product").eq("id", itemId).single();

  const { error } = await admin
    .from("service_request_items")
    .update({ payment_authorized_by: trimmed })
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Pagamento de "${item?.product ?? "item"}" autorizado pelo gerente: ${trimmed}.`,
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}

// Pagamento só pode ser liberado depois que a montagem foi de fato concluída
// — reverter uma aprovação (released=false) continua liberado a qualquer
// momento, caso alguém aprove por engano.
export async function setItemPaymentReleased(itemId: string, requestId: string, released: boolean) {
  const profile = await getProfile();
  requirePaymentsController(profile);

  const admin = getSupabaseAdmin();

  if (released) {
    const { data: request } = await admin.from("service_requests").select("status").eq("id", requestId).single();
    if (request?.status !== "concluida") {
      throw new Error("Só é possível liberar o pagamento depois que a montagem for concluída.");
    }
  }

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
      ? `Pagamento marcado como pago: "${item?.product ?? "item"}".`
      : `Pagamento revertido para pendente: "${item?.product ?? "item"}".`,
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/pagamentos");
}
