"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto, getPhotoForAuth, deleteRequestPhoto } from "@/lib/servicePhotos";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { notifyLoja, notifySac, notifyAssistencia } from "@/lib/notifications";
import { SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import type { RequestType } from "@/lib/serviceRequests";
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

export async function driverUploadPhoto(requestId: string, formData: FormData): Promise<void> {
  const driverName = await getDriverSession();
  if (!driverName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin.from("service_requests").select("driver_name").eq("id", requestId).maybeSingle();
  if (error || !request || request.driver_name !== driverName) {
    throw new Error("Esse chamado não é seu.");
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  const caption = String(formData.get("caption") ?? "");

  await saveRequestPhoto({ requestId, file, uploadedBy: driverName, caption });
  revalidatePath("/assistencia/motorista");
}

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
