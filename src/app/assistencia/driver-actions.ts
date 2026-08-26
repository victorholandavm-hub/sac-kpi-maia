"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPhotoForAuth, deleteRequestPhoto, hasProofPhoto } from "@/lib/servicePhotos";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { notifyLoja, notifySac, notifyAssistencia } from "@/lib/notifications";
import { SAC_MANAGED_TYPES, DISPATCH_SUPERVISOR_DRIVERS } from "@/lib/assistenciaLabels";
import type { RequestType } from "@/lib/serviceRequests";
import { resolveDriverName } from "@/lib/payments";
import { isRota, getAvailableRotasForDate, getRotaDriverAssignments, ROTA_LABELS, type Rota } from "@/lib/rotas";
import { sanitizeOrFilterValue } from "@/lib/searchFilter";
import {
  DRIVER_COOKIE_NAME,
  DRIVER_SESSION_MAX_AGE,
  signDriverSession,
  verifyDriverSession,
  verifyPin,
} from "@/lib/driverAuth";

// Troca/entrega de produto são solicitadas pelo SAC -- envio de peça é
// solicitado pela própria assistência (peça que ela pediu pro CD/fábrica
// mandar pro cliente). Roteia o alerta de "precisa remarcar" pra quem abriu
// o chamado, não sempre pro mesmo lugar.
function notifyRemarcarOwner(type: RequestType, opts: Parameters<typeof notifySac>[0]): Promise<void> {
  return (SAC_MANAGED_TYPES as readonly string[]).includes(type) ? notifySac(opts) : notifyAssistencia(opts);
}

export type DriverFormState = { error?: string } | undefined;

export async function driverSignIn(_state: DriverFormState, formData: FormData): Promise<DriverFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

  // Mesma lógica de montadorSignIn (src/app/assistencia/montador-actions.ts):
  // nome não diferencia maiúsculas/minúsculas, e usa o nome como está no
  // banco (não o digitado) daqui pra frente.
  const admin = getSupabaseAdmin();
  const { data: drivers } = await admin.from("drivers").select("name, pin_hash");
  const data = (drivers ?? []).find((d) => d.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("drivers", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("drivers", "name", name);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("drivers", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(DRIVER_COOKIE_NAME, signDriverSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: DRIVER_SESSION_MAX_AGE,
    // Path "/" (era "/assistencia/motorista") -- mesma armadilha do
    // montador (ver comentário em montador-actions.ts): /api/motorista/upload-photo
    // é rota irmã, fora do escopo antigo, então o cookie nunca chegava lá.
    path: "/",
  });

  redirect("/assistencia/motorista");
}

export async function driverSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: DRIVER_COOKIE_NAME, path: "/" });
  redirect("/assistencia/motorista/login");
}

export async function getDriverSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyDriverSession(cookieStore.get(DRIVER_COOKIE_NAME)?.value);
}

// Upload de foto do motorista NÃO é mais aqui -- virou POST comum em
// /api/motorista/upload-photo/route.ts (Server Action tinha o mesmo
// problema de stale ID após deploy que motivou tirar o upload da
// assistência de Server Action também, ver actions.ts). Essa função ficou
// órfã (definida, nunca chamada) desde aquela troca -- removida em
// 26/08/2026 durante a auditoria pedida pelo Victor ("veja isso tambem
// para os motoristas e para todos que adicionam fotos") pra não confundir
// alguém procurando "o upload de foto de verdade" e cair nela por engano.

export async function driverDeletePhoto(photoId: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");

  const info = await getPhotoForAuth(photoId);
  if (!info || info.uploadedBy !== driverName) throw new Error("Essa foto não é sua.");

  await deleteRequestPhoto(photoId);
  revalidatePath("/assistencia/motorista");
}

// Motorista organiza a própria lista do dia na ordem que quiser (ex.: seguir
// por bairro) -- recebe a lista já reordenada (o cliente reordena local,
// otimista) e só grava um driver_order sequencial pra cada id, na ordem
// recebida. Confere que todo id é realmente do motorista logado antes de
// gravar, senão daria pra um motorista mexer na ordem de chamado alheio.
// Cada update leva o driver_order que o cliente acreditava ser o atual como
// trava de corrida (mesmo padrão usado nas outras mutações desta sessão) --
// se outra sessão/aba já mudou a ordem por baixo, a gravação não "vence"
// silenciosamente por cima, e o motorista recebe aviso pra recarregar.
export async function setDriverOrderAction(items: { id: string; expectedOrder: number | null }[]): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  if (items.length === 0) return;

  const admin = getSupabaseAdmin();
  const ids = items.map((i) => i.id);
  const { data: owned, error } = await admin.from("service_requests").select("id").in("id", ids).eq("driver_name", driverName);
  if (error) throw new Error(error.message);
  if (!owned || owned.length !== ids.length) {
    throw new Error("Um ou mais chamados não são seus.");
  }

  const results = await Promise.all(
    items.map((item, index) => {
      const query = admin.from("service_requests").update({ driver_order: index + 1 }).eq("id", item.id);
      return (item.expectedOrder === null ? query.is("driver_order", null) : query.eq("driver_order", item.expectedOrder))
        .select("id")
        .maybeSingle();
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  if (results.some((r) => !r.data)) {
    throw new Error("A ordem mudou em outra sessão. Recarregue a página e tente de novo.");
  }

  revalidatePath("/assistencia/motorista");
}

// Recolhimento e entrega são pernas independentes da mesma rota — marcar uma
// não conclui a outra. Só quando as duas estão feitas o motorista consegue
// (ou o sistema deveria) considerar o chamado encerrado.
export async function driverMarkPickupCompleted(requestId: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("driver_name, status, pickup_completed")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.driver_name !== driverName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }
  if (request.pickup_completed) return;

  const { error: updateError } = await admin.from("service_requests").update({ pickup_completed: true }).eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `${driverName} (motorista) recolheu o produto errado/avariado na casa do cliente.`,
  });

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

// A nota do cliente não entra mais aqui -- desde 17/08/2026 é coletada
// depois, numa tela pública separada (QR code que aparece na hora de
// concluir, ver RatingQrCode.tsx / avaliar/actions.ts). Mesma mudança de
// montadorCompleteRequest, ver comentário lá.
export async function driverCompleteRequest(requestId: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("driver_name, status, store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.driver_name !== driverName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  // Só está concluída quando o cliente assina -- pedido do Victor
  // 17/08/2026. Checado aqui (servidor), não só escondendo o botão na tela:
  // sem isso um motorista com o app desatualizado em cache ainda conseguiria
  // concluir sem nunca ter enviado o comprovante.
  if (!(await hasProofPhoto(requestId))) {
    throw new Error("Envie a foto do comprovante assinado pelo cliente antes de concluir.");
  }

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ status: "concluida", completed_at: new Date().toISOString(), pickup_completed: true })
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "concluida",
    note: `Concluído pelo motorista ${driverName}.`,
  });

  await notifyLoja(request.store_id, {
    type: "status_changed",
    title: "Solicitação: Concluída",
    message: `Concluído pelo motorista ${driverName}.`,
    link: `/assistencia/${requestId}`,
  });

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

// Quando o motorista não consegue completar a rota (cliente ausente, produto
// não confere etc.) — mesma lógica de montadorReportIssue.
export async function driverReportIssue(requestId: string, reason: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Informe o motivo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("driver_name, status, store_id, type, ticket_number")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.driver_name !== driverName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ status: "remarcar" })
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  const note = `${driverName} (motorista) não conseguiu concluir a rota: ${trimmed}`;
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "remarcar",
    note,
  });

  const link = `/assistencia/${requestId}`;
  await notifyLoja(request.store_id, { type: "status_changed", title: "Solicitação: Remarcar", message: note, link });
  await notifyRemarcarOwner(request.type, { type: "status_changed", title: "Precisa remarcar", message: `Chamado #${request.ticket_number} — ${note}`, link });

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function driverAddNote(requestId: string, note: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Escreva uma observação.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin.from("service_requests").select("driver_name").eq("id", requestId).maybeSingle();
  if (error || !request || request.driver_name !== driverName) {
    throw new Error("Esse chamado não é seu.");
  }

  const { error: insertError } = await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `${driverName} (motorista): ${trimmed}`,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/assistencia/motorista");
  revalidatePath(`/assistencia/${requestId}`);
}

// A partir daqui: ações só de Everton/Samuel (expedição, ver
// DISPATCH_SUPERVISOR_DRIVERS em assistenciaLabels.ts) -- pedido do Victor
// 19/08/2026, "conseguir trocar uma notificação de uma rota pra outra" e
// "adicionar rota e colocar o motorista pra aquela rota extra". Eles já
// enxergam a rota de todo mundo (isSupervisor em
// listRequestsForDriver/motorista/page.tsx); essas ações dão o mesmo
// controle que assistência/SAC/admin têm em
// setRotaDriverAssignment/addRotaExtra/removeRotaExtra (actions.ts), só que
// autenticado pela sessão de PIN do motorista (getDriverSession) em vez de
// getProfile() -- não dá pra chamar aquelas direto (elas exigem Supabase
// Auth, que o motorista não tem). Mesma lógica de negócio replicada aqui de
// propósito, não importada: é o mesmo padrão já usado no resto deste arquivo
// pra toda ação de motorista/montador (reverificar sessão + posse, nunca
// confiar só em RLS).
function requireDispatchSupervisor(driverName: string): void {
  if (!DISPATCH_SUPERVISOR_DRIVERS.includes(driverName)) {
    throw new Error("Só quem organiza a expedição pode mudar a rota de outros motoristas.");
  }
}

export async function driverGetRotaDriverAssignments(date: string) {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  return getRotaDriverAssignments(date);
}

export async function driverGetAvailableRotasForDate(date: string) {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return getAvailableRotasForDate(date);
}

// Mesma regra de setRotaDriverAssignment (actions.ts): só existe uma rota
// principal por dia, trocar aqui substitui a anterior (nunca cria uma
// segunda linha principal -- pra um carro a mais, ver driverAddRotaExtra).
export async function driverSetRotaDriverAssignment(date: string, rota: string, driverNameInput: string): Promise<{ updatedCount: number }> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);
  if (!isRota(rota)) throw new Error("Rota inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const typedName = driverNameInput.trim();
  if (!typedName) throw new Error("Informe o motorista.");

  const admin = getSupabaseAdmin();
  const name = await resolveDriverName(typedName);
  await admin.from("drivers").upsert({ name }, { onConflict: "name" });

  const { data: existingPrimary } = await admin
    .from("rota_driver_assignments")
    .select("id, driver_name")
    .eq("assignment_date", date)
    .eq("is_extra", false)
    .maybeSingle();
  const oldDriverName = existingPrimary?.driver_name as string | undefined;

  const { error: writeError } = existingPrimary
    ? await admin
        .from("rota_driver_assignments")
        .update({ rota, driver_name: name, updated_at: new Date().toISOString() })
        .eq("id", existingPrimary.id as string)
    : await admin.from("rota_driver_assignments").insert({ assignment_date: date, rota, driver_name: name, is_extra: false });
  if (writeError) throw new Error(writeError.message);

  let query = admin
    .from("service_requests")
    .update({ driver_name: name })
    .eq("rota", rota)
    .eq("scheduled_date", date)
    .not("status", "in", "(concluida,cancelada)");
  query = oldDriverName
    ? query.or(`driver_name.is.null,driver_name.eq.${sanitizeOrFilterValue(oldDriverName)}`)
    : query.is("driver_name", null);
  const { data: updated, error: updateError } = await query.select("id");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  return { updatedCount: updated?.length ?? 0 };
}

// Carro extra saindo no mesmo dia -- pedido do Victor 19/08/2026 ("adicionar
// rota e colocar o motorista pra aquela rota extra"). Só pega chamado ainda
// sem motorista, igual addRotaExtra (actions.ts).
export async function driverAddRotaExtra(date: string, rota: string, driverNameInput: string): Promise<{ updatedCount: number }> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);
  if (!isRota(rota)) throw new Error("Rota inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const typedName = driverNameInput.trim();
  if (!typedName) throw new Error("Informe o motorista.");

  const admin = getSupabaseAdmin();
  const name = await resolveDriverName(typedName);
  await admin.from("drivers").upsert({ name }, { onConflict: "name" });

  const { error: insertError2 } = await admin
    .from("rota_driver_assignments")
    .insert({ assignment_date: date, rota, driver_name: name, is_extra: true });
  if (insertError2) throw new Error(insertError2.message);

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ driver_name: name })
    .eq("rota", rota)
    .eq("scheduled_date", date)
    .is("driver_name", null)
    .not("status", "in", "(concluida,cancelada)")
    .select("id");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  return { updatedCount: updated?.length ?? 0 };
}

export async function driverRemoveRotaExtra(id: string): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_driver_assignments").delete().eq("id", id).eq("is_extra", true);
  if (error) throw new Error(error.message);
  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
}

// Mover uma ou mais notificações pra outra rota/data -- pedido do Victor
// 19/08/2026 ("conseguir trocar uma notificação de assistência de uma rota
// pra outra"). Mesma validação de setSchedule/bulkSetRotaAction (rota
// precisa ter carro saindo pra aquela data, ou ser a que o chamado já
// tinha) -- não mexe em turno/hora/status, só data+rota+motorista, então
// não precisa reaproveitar o setSchedule inteiro (que cobre mais campo do
// que uma troca de rota mexe). Não falha o lote inteiro se um item der
// erro -- devolve quantos deram certo + a lista de erros.
export async function driverBulkSetRota(
  requestIds: string[],
  scheduledDate: string,
  rota: string,
  // Motorista explícito da atribuição escolhida (ver DriverRouteGroup.tsx)
  // -- mesmo motivo de bulkSetRotaAction/setSchedule (actions.ts): sem
  // isso, duas atribuições com a mesma rota (rota extra genérica de João
  // Pessoa, pedido do Victor 24/08/2026, pode repetir em duas linhas do
  // mesmo dia) ficam ambíguas -- pega sempre a primeira, que pode não ser
  // a escolhida.
  rotaDriverName?: string
): Promise<{ successCount: number; errors: string[] }> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");
  requireDispatchSupervisor(driverName);
  if (requestIds.length === 0) throw new Error("Selecione pelo menos uma notificação.");
  if (!scheduledDate) throw new Error("Escolha uma data.");
  if (!isRota(rota)) throw new Error("Rota inválida.");

  const admin = getSupabaseAdmin();
  const availableRotas = await getAvailableRotasForDate(scheduledDate);
  const match = rotaDriverName
    ? availableRotas.find((r) => r.rota === rota && r.driverName === rotaDriverName)
    : availableRotas.find((r) => r.rota === rota);

  const { data: rows, error } = await admin
    .from("service_requests")
    .select("id, ticket_number, scheduled_date, rota, status")
    .in("id", requestIds);
  if (error) throw new Error(error.message);

  const errors: string[] = [];
  let successCount = 0;
  for (const row of rows ?? []) {
    if (row.status === "concluida" || row.status === "cancelada") {
      errors.push(`#${row.ticket_number}: já foi encerrado.`);
      continue;
    }
    const isCurrentAssignment = scheduledDate === row.scheduled_date && rota === row.rota;
    if (!match && !isCurrentAssignment) {
      errors.push(`#${row.ticket_number}: ${ROTA_LABELS[rota as Rota]} não tem carro saindo em ${scheduledDate.split("-").reverse().join("/")}.`);
      continue;
    }
    const updatePayload: Record<string, unknown> = { scheduled_date: scheduledDate, rota };
    if (match) updatePayload.driver_name = match.driverName ?? null;
    const { error: updateError } = await admin.from("service_requests").update(updatePayload).eq("id", row.id);
    if (updateError) {
      errors.push(`#${row.ticket_number}: ${updateError.message}`);
      continue;
    }
    await admin.from("service_request_events").insert({
      request_id: row.id,
      actor_id: null,
      event_type: "note_added",
      note: `${driverName} (expedição) moveu pra rota ${ROTA_LABELS[rota as Rota]} em ${scheduledDate}.`,
    });
    successCount++;
  }

  revalidatePath("/assistencia/motorista");
  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  return { successCount, errors };
}
