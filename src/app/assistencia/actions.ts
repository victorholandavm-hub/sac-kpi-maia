"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { SHIFT_LABELS, SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";
import { saveRequestPhoto, getPhotoForAuth, deleteRequestPhoto } from "@/lib/servicePhotos";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";

const REQUEST_TYPES = [
  "montagem",
  "desmontagem",
  "recolhimento",
  "troca_peca",
  "vistoria",
  "notificacao_externa",
] as const;
const STATUSES = ["aberta", "em_contato", "em_andamento", "remarcar", "concluida", "cancelada"] as const;
const SHIFTS = ["manha", "tarde", "dia", "urgencia"] as const;

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

  redirect("/assistencia/inicio");
}

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/assistencia/login");
}

// Sem sessão do Supabase Auth (usa a sessão de gerente de loja por PIN — ver
// src/lib/gerentes.ts) — /assistencia/solicitar exige login de gerente antes
// de mostrar o formulário, então chegar aqui sem sessão válida é só alguém
// chamando a action direto. Rate limit por IP fica como defesa extra contra
// um PIN vazado sendo usado pra spam (src/lib/rateLimit.ts).
export async function createPublicRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const { allowed } = await checkAndRecordPublicSubmission(ip);
  if (!allowed) {
    return { error: "Muitas solicitações enviadas em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) return { error: "Sessão expirada. Faça login de novo." };

  // A solicitação só pode ser para uma das lojas do gerente. Se ele cuida de
  // uma loja só, não há ambiguidade e a gente força o valor (ignora o que
  // veio do form, mesmo que alguém tente adulterar o <select> pelo devtools).
  // Se cuida de várias, valida que o valor escolhido está entre as dele.
  let storeId = String(formData.get("store_id") ?? "").trim();
  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (gerenteStoreIds.length === 1) {
    storeId = gerenteStoreIds[0];
  } else if (!gerenteStoreIds.includes(storeId)) {
    return { error: "Selecione uma das lojas que você gerencia." };
  }

  // Nome do solicitante vem da sessão do gerente, não do form (o campo no
  // formulário é só leitura) — evita adulteração via devtools, igual ao store_id acima.
  const requestedByName = gerenteName;
  const requestedDeadline = String(formData.get("requested_deadline") ?? "").trim();

  if (!storeId) return { error: "Selecione a loja." };
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
      seller_name: emptyToNull(formData.get("seller_name")),
      invoice_number: emptyToNull(formData.get("invoice_number")),
      sac_category: type === "notificacao_externa" ? emptyToNull(formData.get("sac_category")) : null,
    })
    .select("id, ticket_number")
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

  // Notificação SAC: gera um protocolo pro cliente e um prazo legal padrão
  // (30 dias, ajustável depois pela assistência).
  if (type === "notificacao_externa") {
    const protocolNumber = `SAC-${new Date().getFullYear()}-${data.id.slice(0, 8).toUpperCase()}`;
    const legalDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await admin
      .from("service_requests")
      .update({ protocol_number: protocolNumber, legal_deadline: legalDeadline })
      .eq("id", data.id);
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: null,
    event_type: "created",
    to_status: "aberta",
  });

  redirect(`/assistencia/solicitar?enviado=1&chamado=${data.ticket_number}`);
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

  revalidatePath("/assistencia/fila");
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

  revalidatePath("/assistencia/fila");
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

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function updateStatus(requestId: string, newStatus: string, note?: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!STATUSES.includes(newStatus as (typeof STATUSES)[number])) {
    throw new Error("Status inválido.");
  }
  if (newStatus === "remarcar" && !note?.trim()) {
    throw new Error("Informe o motivo da remarcação.");
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

  revalidatePath("/assistencia/fila");
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

export async function addRequestPhoto(requestId: string, formData: FormData): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  const caption = String(formData.get("caption") ?? "");

  await saveRequestPhoto({ requestId, file, uploadedBy: profile.fullName, caption });
  revalidatePath(`/assistencia/${requestId}`);
}

export async function deleteRequestPhotoAsStaff(photoId: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const info = await getPhotoForAuth(photoId);
  if (!info) throw new Error("Foto não encontrada.");

  await deleteRequestPhoto(photoId);
  revalidatePath(`/assistencia/${info.requestId}`);
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

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setSchedule(requestId: string, scheduledDate: string, shift: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (shift && !SHIFTS.includes(shift as (typeof SHIFTS)[number])) {
    throw new Error("Turno inválido.");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("service_requests")
    .update({ scheduled_date: scheduledDate || null, shift: shift || null })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  const shiftLabel = SHIFT_LABELS[shift] ?? shift;
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: scheduledDate
      ? `Visita agendada: ${scheduledDate}${shift ? ` (${shiftLabel})` : ""}`
      : "Agendamento removido.",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setSacCategory(requestId: string, category: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!SAC_CATEGORIES.includes(category as (typeof SAC_CATEGORIES)[number])) {
    throw new Error("Categoria inválida.");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_requests").update({ sac_category: category }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Categoria SAC definida: ${SAC_CATEGORY_LABELS[category] ?? category}.`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setLegalDeadline(requestId: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!newDate) throw new Error("Informe uma data.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_requests").update({ legal_deadline: newDate }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Prazo legal ajustado para ${newDate}.`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setEscalationRisk(requestId: string, atRisk: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_requests").update({ escalation_risk: atRisk }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: atRisk ? "Marcado como risco de escalonamento (Procon/ReclameAqui)." : "Risco de escalonamento removido.",
  });

  revalidatePath("/assistencia/fila");
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
      seller_name: emptyToNull(formData.get("seller_name")),
      invoice_number: emptyToNull(formData.get("invoice_number")),
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

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
  redirect(`/assistencia/${requestId}`);
}

// Criação rápida a partir da Agenda ou de Pagamentos: cria a solicitação com só
// o essencial (evita ter que passar pela tela cheia de "Nova solicitação" pra
// coisas pontuais, do jeito que dava pra digitar direto na planilha).
export async function createQuickRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const type = String(formData.get("type") ?? "");
  if (!REQUEST_TYPES.includes(type as (typeof REQUEST_TYPES)[number])) {
    return { error: "Tipo de solicitação inválido." };
  }

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return { error: "Informe o nome do cliente." };

  const shift = String(formData.get("shift") ?? "").trim();
  if (shift && !SHIFTS.includes(shift as (typeof SHIFTS)[number])) {
    return { error: "Turno inválido." };
  }

  const assemblerName = emptyToNull(formData.get("assembler_name"));
  const product = emptyToNull(formData.get("product"));
  const unitValueRaw = String(formData.get("unit_value") ?? "").trim();
  const unitValue = unitValueRaw ? parseFloat(unitValueRaw.replace(",", ".")) : null;
  if (unitValueRaw && (unitValue === null || Number.isNaN(unitValue) || unitValue < 0)) {
    return { error: "Valor inválido." };
  }

  const admin = getSupabaseAdmin();

  if (assemblerName) {
    await admin.from("assemblers").upsert({ name: assemblerName }, { onConflict: "name" });
  }

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      type,
      store_id: storeId,
      requested_by: profile.id,
      client_name: clientName,
      client_phone: emptyToNull(formData.get("client_phone")),
      client_address: emptyToNull(formData.get("client_address")),
      reason: emptyToNull(formData.get("reason")),
      scheduled_date: emptyToNull(formData.get("scheduled_date")),
      shift: shift || null,
      assembler_name: assemblerName,
      // Criação rápida não coleta prazo pedido pela loja, então não há nada
      // pra "aprovar" — sem isso, o padrão do banco (pendente) fazia a tela
      // sempre mostrar "prazo pendente de aprovação" sem sentido.
      deadline_status: "aprovado",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar: ${error?.message ?? "erro desconhecido"}` };
  }

  if (product) {
    const quantity = Math.max(1, parseInt(String(formData.get("quantity") ?? "1"), 10) || 1);
    const { error: itemError } = await admin.from("service_request_items").insert({
      request_id: data.id,
      product,
      quantity,
      unit_value: unitValue,
    });
    if (itemError) {
      return { error: `Solicitação criada, mas falhou ao salvar o item: ${itemError.message}` };
    }
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: profile.id,
    event_type: "created",
    to_status: "aberta",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
  revalidatePath("/assistencia/pagamentos");
  redirect(`/assistencia/${data.id}`);
}

// Chamada a partir do painel da loja (/assistencia/loja, protegido por login
// de loja + PIN — ver src/lib/lojaAuth.ts), pra propor uma nova data mesmo
// depois que a assistência já tinha definido uma. Reabre a negociação de
// prazo (mesmo fluxo de aprovação já existente). Verifica que o chamado é da
// UMA DAS lojas do gerente autenticado — sem isso, qualquer sessão de loja
// conseguiria mudar o prazo de um chamado de outra loja.
export async function proposeNewDeadline(requestId: string, newDate: string) {
  if (!newDate) throw new Error("Informe uma data.");

  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) throw new Error("Sessão expirada. Faça login de novo.");
  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (gerenteStoreIds.length === 0) throw new Error("Gerente sem loja vinculada.");

  const admin = getSupabaseAdmin();
  const { data: request, error: fetchError } = await admin
    .from("service_requests")
    .select("store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError || !request || !gerenteStoreIds.includes(request.store_id)) {
    throw new Error("Esse chamado não é de uma loja sua.");
  }

  const { error } = await admin
    .from("service_requests")
    .update({ requested_deadline: newDate, deadline_status: "pendente" })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `${gerenteName} (loja) propôs nova data: ${newDate}.`,
  });

  revalidatePath("/assistencia/loja");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

const LOJA_STORE_COOKIE = "loja_store_pref";

// Sem sessão — lembra qual loja a pessoa escolheu no painel público, pra não
// precisar reselecionar toda vez que entrar do mesmo aparelho.
export async function setLojaStorePreference(storeId: string) {
  const cookieStore = await cookies();
  if (storeId) {
    cookieStore.set(LOJA_STORE_COOKIE, storeId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    cookieStore.delete(LOJA_STORE_COOKIE);
  }
}

export async function getLojaStorePreference(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LOJA_STORE_COOKIE)?.value ?? null;
}
