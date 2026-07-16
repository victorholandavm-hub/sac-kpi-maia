"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";

const REQUEST_TYPES = ["montagem", "desmontagem", "recolhimento", "notificacao_externa"] as const;
const STATUSES = ["aberta", "em_contato", "em_andamento", "concluida", "cancelada"] as const;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type FormState = { error?: string } | undefined;

export async function signIn(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/assistencia");
}

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/assistencia/login");
}

// Sem sessão do Supabase Auth — usado pelo formulário público em /assistencia/solicitar,
// protegido só pela senha compartilhada checada em src/proxy.ts.
export async function createPublicRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const storeId = String(formData.get("store_id") ?? "").trim();
  const requestedByName = String(formData.get("requested_by_name") ?? "").trim();
  const requestedDeadline = String(formData.get("requested_deadline") ?? "").trim();

  if (!storeId) return { error: "Selecione a loja." };
  if (!requestedByName) return { error: "Informe seu primeiro nome." };
  if (!requestedDeadline) return { error: "Informe o prazo desejado." };

  const type = String(formData.get("type") ?? "");
  if (!REQUEST_TYPES.includes(type as (typeof REQUEST_TYPES)[number])) {
    return { error: "Tipo de solicitação inválido." };
  }

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) {
    return { error: "Informe o nome do cliente." };
  }

  const itemProducts = formData.getAll("item_product").map((v) => String(v).trim());
  const itemQuantities = formData.getAll("item_quantity").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items = itemProducts
    .map((product, i) => ({ product, quantity: itemQuantities[i] ?? 1 }))
    .filter((item) => item.product.length > 0);

  if (type !== "notificacao_externa" && items.length === 0) {
    return { error: "Informe pelo menos um produto." };
  }

  const admin = getSupabaseAdmin();

  const { data: store } = await admin.from("stores").select("id").eq("id", storeId).single();
  if (!store) return { error: "Loja inválida." };

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      type,
      store_id: storeId,
      requested_by_name: requestedByName,
      requested_deadline: requestedDeadline,
      order_code: emptyToNull(formData.get("order_code")),
      client_name: clientName,
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_address: emptyToNull(formData.get("client_address")),
      client_neighborhood: emptyToNull(formData.get("client_neighborhood")),
      reason: emptyToNull(formData.get("reason")),
      restriction_note: emptyToNull(formData.get("restriction_note")),
      notes: emptyToNull(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar a solicitação: ${error?.message ?? "erro desconhecido"}` };
  }

  if (items.length > 0) {
    const { error: itemsError } = await admin
      .from("service_request_items")
      .insert(items.map((item) => ({ request_id: data.id, product: item.product, quantity: item.quantity })));
    if (itemsError) {
      return { error: `Solicitação criada, mas falhou ao salvar os itens: ${itemsError.message}` };
    }
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: null,
    event_type: "created",
    to_status: "aberta",
  });

  redirect("/assistencia/solicitar?enviado=1");
}

export async function approveDeadline(requestId: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("requested_deadline")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");

  const { error } = await admin
    .from("service_requests")
    .update({ deadline_status: "aprovado", approved_deadline: current.requested_deadline })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "deadline_approved",
    note: current.requested_deadline ? `Prazo aprovado: ${current.requested_deadline}` : null,
  });

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function rejectDeadline(requestId: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!newDate) throw new Error("Informe a nova data proposta.");

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("service_requests")
    .update({ deadline_status: "recusado", approved_deadline: newDate })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "deadline_rejected",
    note: `Nova data proposta: ${newDate}`,
  });

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function claimRequest(requestId: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("status")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");

  const nextStatus = current.status === "aberta" ? "em_contato" : current.status;

  const { error } = await admin
    .from("service_requests")
    .update({ assigned_to: profile.id, status: nextStatus })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  type RequestEvent = {
    request_id: string;
    actor_id: string;
    event_type: "assigned" | "status_changed";
    from_status?: string;
    to_status?: string;
  };
  const events: RequestEvent[] = [{ request_id: requestId, actor_id: profile.id, event_type: "assigned" }];
  if (nextStatus !== current.status) {
    events.push({
      request_id: requestId,
      actor_id: profile.id,
      event_type: "status_changed",
      from_status: current.status,
      to_status: nextStatus,
    });
  }
  await admin.from("service_request_events").insert(events);

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function updateStatus(requestId: string, newStatus: string, note?: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!STATUSES.includes(newStatus as (typeof STATUSES)[number])) {
    throw new Error("Status inválido.");
  }

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("status")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");

  const completedAt = newStatus === "concluida" || newStatus === "cancelada" ? new Date().toISOString() : null;

  const { error } = await admin
    .from("service_requests")
    .update({ status: newStatus, completed_at: completedAt })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "status_changed",
    from_status: current.status,
    to_status: newStatus,
    note: note?.trim() || null,
  });

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function addNote(requestId: string, note: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: trimmed,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/${requestId}`);
}

export async function setAssemblerName(requestId: string, assemblerName: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = assemblerName.trim();
  if (!trimmed) throw new Error("Informe o nome do montador.");

  const admin = getSupabaseAdmin();
  await admin.from("assemblers").upsert({ name: trimmed }, { onConflict: "name" });

  const { error } = await admin.from("service_requests").update({ assembler_name: trimmed }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Montador definido: ${trimmed}`,
  });

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function updateRequestDetails(
  requestId: string,
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return { error: "Informe o nome do cliente." };
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("service_requests")
    .update({
      store_id: storeId,
      order_code: emptyToNull(formData.get("order_code")),
      client_name: clientName,
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_address: emptyToNull(formData.get("client_address")),
      client_neighborhood: emptyToNull(formData.get("client_neighborhood")),
      reason: emptyToNull(formData.get("reason")),
      restriction_note: emptyToNull(formData.get("restriction_note")),
      notes: emptyToNull(formData.get("notes")),
    })
    .eq("id", requestId);

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "edited",
    note: "Dados da solicitação corrigidos.",
  });

  revalidatePath("/assistencia");
  revalidatePath(`/assistencia/${requestId}`);
  redirect(`/assistencia/${requestId}`);
}
