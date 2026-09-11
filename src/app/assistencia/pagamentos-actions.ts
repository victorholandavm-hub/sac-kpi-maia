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

  // Valor só pode ser definido depois que a montagem for confirmada como
  // concluída (status "concluida") -- correção do Victor 11/09/2026: antes
  // o Antonio podia pré-definir o valor a qualquer momento (só travava
  // durante "aguardando_aprovacao"), mas ele decidiu que o valor deve ficar
  // preso à confirmação de conclusão (gerente da loja/admin/assistência via
  // lojaApproveMontagemConclusion), não antes. Mesma trava em
  // PaymentItemEditor.tsx/RequestItemsTable.tsx (UI) -- aqui é a garantia
  // de verdade, os dois lados do form).
  const { data: request } = await admin.from("service_requests").select("status").eq("id", requestId).single();
  if (request?.status !== "concluida") {
    throw new Error("Só é possível definir o valor depois que a montagem for concluída (aprovada).");
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

  const { data: item } = await admin.from("service_request_items").select("product, unit_value").eq("id", itemId).single();
  // Nunca liberar pagamento sem valor definido -- inconsistência real achada
  // 11/09/2026 (Victor: "seu antonio falou que ele gerou uma nota fiscal
  // perto do 2200 reais e agora so aparece 1500 em pagos"): 8 itens do
  // Luanderson (#4901/#4907/#4983) tinham sido marcados como pagos pelo
  // botão INDIVIDUAL ("Marcar como pago" em PaymentItemEditor.tsx/
  // RequestItemsTable.tsx) sem nunca ter um unit_value definido -- contavam
  // R$0 no total, mesmo aparecendo como "pago". A seleção em LOTE
  // (AssemblerPaymentGroup.tsx, `eligibleIds`) já filtrava certo (só deixa
  // selecionar quem tem unit_value); faltava a mesma trava aqui e no botão
  // individual (PaymentItemEditor.tsx/RequestItemsTable.tsx).
  if (released && item?.unit_value === null) {
    throw new Error("Defina o valor do item antes de marcar como pago.");
  }

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
