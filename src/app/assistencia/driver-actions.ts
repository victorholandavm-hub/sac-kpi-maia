"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto, getPhotoForAuth, deleteRequestPhoto } from "@/lib/servicePhotos";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { notifyLoja } from "@/lib/notifications";
import {
  DRIVER_COOKIE_NAME,
  DRIVER_SESSION_MAX_AGE,
  signDriverSession,
  verifyDriverSession,
  verifyPin,
} from "@/lib/driverAuth";

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
    path: "/assistencia/motorista",
  });

  redirect("/assistencia/motorista");
}

export async function driverSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: DRIVER_COOKIE_NAME, path: "/assistencia/motorista" });
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

function validRating(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error("Nota inválida.");
  return value;
}

export async function driverCompleteRequest(
  requestId: string,
  deliveryRating: number | null = null,
  resolutionRating: number | null = null
): Promise<void> {
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
    .update({
      status: "concluida",
      completed_at: new Date().toISOString(),
      pickup_completed: true,
      delivery_rating: validRating(deliveryRating),
      resolution_rating: validRating(resolutionRating),
    })
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  const ratingNote =
    deliveryRating !== null || resolutionRating !== null
      ? ` Avaliação do cliente — entrega: ${deliveryRating ?? "—"}, resolução: ${resolutionRating ?? "—"}.`
      : "";
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "concluida",
    note: `Concluído pelo motorista ${driverName}.${ratingNote}`,
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

  await notifyLoja(request.store_id, { type: "status_changed", title: "Solicitação: Remarcar", message: note, link: `/assistencia/${requestId}` });

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
