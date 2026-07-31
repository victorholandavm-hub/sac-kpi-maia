"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto, getPhotoForAuth, deleteRequestPhoto } from "@/lib/servicePhotos";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import {
  MONTADOR_COOKIE_NAME,
  MONTADOR_SESSION_MAX_AGE,
  signMontadorSession,
  verifyMontadorSession,
  verifyPin,
} from "@/lib/montadorAuth";

export type MontadorFormState = { error?: string } | undefined;

export async function montadorSignIn(_state: MontadorFormState, formData: FormData): Promise<MontadorFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  // Nome não diferencia maiúsculas/minúsculas ("Janailson" == "janailson") —
  // busca todo mundo e compara em minúsculo em vez de usar `ilike` (que trata
  // % e _ como curinga, o que um nome digitado não deveria acionar). Usa o
  // nome como está gravado no banco (não o que a pessoa digitou) daqui pra
  // frente, pra bloqueio de tentativas e sessão não divergirem por causa de caixa.
  const admin = getSupabaseAdmin();
  const { data: assemblers } = await admin.from("assemblers").select("name, pin_hash");
  const data = (assemblers ?? []).find((a) => a.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("assemblers", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("assemblers", "name", name);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("assemblers", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(MONTADOR_COOKIE_NAME, signMontadorSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MONTADOR_SESSION_MAX_AGE,
    path: "/assistencia/montador",
  });

  redirect("/assistencia/montador");
}

export async function montadorSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: MONTADOR_COOKIE_NAME, path: "/assistencia/montador" });
  redirect("/assistencia/montador/login");
}

export async function getMontadorSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyMontadorSession(cookieStore.get(MONTADOR_COOKIE_NAME)?.value);
}

export async function montadorUploadPhoto(requestId: string, formData: FormData): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  const caption = String(formData.get("caption") ?? "");

  await saveRequestPhoto({ requestId, file, uploadedBy: assemblerName, caption });
  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
}

export async function montadorDeletePhoto(photoId: string): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");

  const info = await getPhotoForAuth(photoId);
  if (!info || info.uploadedBy !== assemblerName) throw new Error("Essa foto não é sua.");

  await deleteRequestPhoto(photoId);
  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${info.requestId}`);
}

function validRating(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error("Nota inválida.");
  return value;
}

export async function montadorCompleteRequest(
  requestId: string,
  deliveryRating: number | null = null,
  resolutionRating: number | null = null
): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  const { error: updateError } = await admin
    .from("service_requests")
    .update({
      status: "concluida",
      completed_at: new Date().toISOString(),
      delivery_rating: validRating(deliveryRating),
      resolution_rating: validRating(resolutionRating),
    })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  const ratingNote =
    deliveryRating !== null || resolutionRating !== null
      ? ` Avaliação do cliente — montagem: ${deliveryRating ?? "—"}, resolução: ${resolutionRating ?? "—"}.`
      : "";
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "concluida",
    note: `Concluído pelo montador ${assemblerName}.${ratingNote}`,
  });

  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

// Quando o montador não consegue montar (avaria, cliente ausente etc.) —
// joga pra "remarcar" com o motivo registrado, mesmo status que a
// assistência já usa manualmente pra isso (ver updateStatus em actions.ts).
export async function montadorReportIssue(requestId: string, reason: string): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Informe o motivo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  const { error: updateError } = await admin.from("service_requests").update({ status: "remarcar" }).eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "remarcar",
    note: `${assemblerName} (montador) não conseguiu montar: ${trimmed}`,
  });

  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function montadorAddNote(requestId: string, note: string): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Escreva uma observação.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }

  const { error: insertError } = await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `${assemblerName} (montador): ${trimmed}`,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
  revalidatePath(`/assistencia/${requestId}`);
}
