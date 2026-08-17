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

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

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
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("assemblers", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(MONTADOR_COOKIE_NAME, signMontadorSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MONTADOR_SESSION_MAX_AGE,
    // Path "/" (era "/assistencia/montador") -- a rota de upload de foto
    // (/api/montador/upload-photo, ver route.ts) é uma path irmã, fora do
    // escopo antigo, então o navegador nunca mandava esse cookie nela e a
    // rota sempre via "sem sessão". Mesma armadilha já documentada nesse
    // projeto: usar o prefixo mínimo comum entre todas as rotas que
    // precisam ler o cookie -- aqui isso é a raiz mesmo.
    path: "/",
  });

  redirect("/assistencia/montador");
}

export async function montadorSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: MONTADOR_COOKIE_NAME, path: "/" });
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

// A nota do cliente não entra mais aqui -- desde 17/08/2026 é coletada
// depois, numa tela pública separada (QR code que aparece na hora de
// concluir, ver RatingQrCode.tsx / avaliar/actions.ts). Antes o montador
// pedia a nota na hora ("vire o celular pro cliente avaliar"), o que dava
// pra ele mesmo preencher a nota sem o cliente participar de verdade.
export async function montadorCompleteRequest(requestId: string): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name, status, store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ status: "concluida", completed_at: new Date().toISOString() })
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
    note: `Concluído pelo montador ${assemblerName}.`,
  });

  await notifyLoja(request.store_id, {
    type: "status_changed",
    title: "Solicitação: Concluída",
    message: `Concluído pelo montador ${assemblerName}.`,
    link: `/assistencia/${requestId}`,
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
    .select("assembler_name, status, store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
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

  const note = `${assemblerName} (montador) não conseguiu montar: ${trimmed}`;
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "remarcar",
    note,
  });

  await notifyLoja(request.store_id, { type: "status_changed", title: "Solicitação: Remarcar", message: note, link: `/assistencia/${requestId}` });

  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

// Visita rendeu só parte dos itens (ex.: montou 2 dos 4 móveis) -- marca
// esses como feitos e joga o chamado pra "remarcar", igual montadorReportIssue,
// pra assistência decidir a nova data do que sobrou (montador não escolhe
// data, mesma regra de sempre). Diferente de "não consegui montar": aqui
// teve progresso de verdade, então fica registrado item por item em vez de
// só um motivo em texto livre.
export async function montadorCompletePartially(requestId: string, completedItemIds: string[], note: string): Promise<void> {
  const assemblerName = await getMontadorSession();
  if (!assemblerName) throw new Error("Sessão expirada. Faça login de novo.");
  if (completedItemIds.length === 0) throw new Error("Marque pelo menos um item como feito.");

  const admin = getSupabaseAdmin();
  const { data: request, error } = await admin
    .from("service_requests")
    .select("assembler_name, status, store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.assembler_name !== assemblerName) {
    throw new Error("Esse chamado não é seu.");
  }
  if (request.status === "concluida" || request.status === "cancelada") {
    throw new Error("Esse chamado já foi encerrado.");
  }

  const { error: itemsError } = await admin
    .from("service_request_items")
    .update({ completed: true })
    .eq("request_id", requestId)
    .in("id", completedItemIds);
  if (itemsError) throw new Error(itemsError.message);

  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ status: "remarcar" })
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Esse chamado já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");

  const { data: items } = await admin
    .from("service_request_items")
    .select("product, quantity, completed")
    .eq("request_id", requestId);
  const label = (i: { product: string; quantity: number }) => (i.quantity > 1 ? `${i.quantity}x ${i.product}` : i.product);
  const done = (items ?? []).filter((i) => i.completed).map(label);
  const pending = (items ?? []).filter((i) => !i.completed).map(label);
  const trimmedNote = note.trim();

  const eventNote =
    `${assemblerName} (montador) concluiu parcialmente. Feito: ${done.join(", ") || "—"}. Falta: ${pending.join(", ") || "—"}.` +
    (trimmedNote ? ` Observação: ${trimmedNote}` : "");
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: request.status,
    to_status: "remarcar",
    note: eventNote,
  });

  await notifyLoja(request.store_id, {
    type: "status_changed",
    title: "Solicitação: Concluída parcialmente",
    message: eventNote,
    link: `/assistencia/${requestId}`,
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
