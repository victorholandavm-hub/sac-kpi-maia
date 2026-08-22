"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { isItemDestino, ITEM_DESTINO_LABELS, ITEM_DESTINO_NEEDS_STORE } from "@/lib/tecnicos";
import {
  TECNICO_COOKIE_NAME,
  TECNICO_SESSION_MAX_AGE,
  signTecnicoSession,
  verifyTecnicoSession,
  verifyPin,
} from "@/lib/tecnicoAuth";

export type TecnicoFormState = { error?: string } | undefined;

export async function tecnicoSignIn(_state: TecnicoFormState, formData: FormData): Promise<TecnicoFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

  // Mesma lógica de montadorSignIn/driverSignIn: nome não diferencia
  // maiúsculas/minúsculas, usa o nome como está gravado no banco daqui pra
  // frente.
  const admin = getSupabaseAdmin();
  const { data: tecnicos } = await admin.from("tecnicos").select("name, pin_hash");
  const data = (tecnicos ?? []).find((t) => t.name.toLowerCase() === typedName.toLowerCase());
  const name = data?.name ?? typedName;

  const lockout = await checkPinLockout("tecnicos", "name", name);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!data || !data.pin_hash || !verifyPin(pin, data.pin_hash)) {
    await recordFailedPinAttempt("tecnicos", "name", name);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("tecnicos", "name", name);

  const cookieStore = await cookies();
  cookieStore.set(TECNICO_COOKIE_NAME, signTecnicoSession(data.name), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TECNICO_SESSION_MAX_AGE,
    path: "/",
  });

  redirect("/assistencia/tecnico");
}

export async function tecnicoSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: TECNICO_COOKIE_NAME, path: "/" });
  redirect("/assistencia/tecnico/login");
}

export async function getTecnicoSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyTecnicoSession(cookieStore.get(TECNICO_COOKIE_NAME)?.value);
}

// Grava o destino de um item (fábrica/estoque/conserto/sem condições/
// mostruário/pequena avaria/peça enviada) -- registrado por item, não
// pelo chamado inteiro (uma troca pode voltar com mais de um produto,
// cada um com destino diferente). "mostruario" exige a loja pra quem foi
// enviado (ver ITEM_DESTINO_NEEDS_STORE) -- pedido do Victor 21/08/2026:
// "enviado para mostruario... eles teriam que selecionar a loja pra qual
// foi enviada". Evento de auditoria vai pro histórico do chamado, igual
// toda outra mutação relevante do projeto.
export async function setItemDestino(itemId: string, destino: string, destinoLojaId?: string): Promise<void> {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) throw new Error("Sessão expirada. Faça login de novo.");
  if (!isItemDestino(destino)) throw new Error("Destino inválido.");

  const admin = getSupabaseAdmin();
  let lojaName: string | null = null;
  if (destino === ITEM_DESTINO_NEEDS_STORE) {
    const loja = (destinoLojaId ?? "").trim();
    if (!loja) throw new Error("Selecione a loja pra qual o item foi enviado.");
    const { data: store } = await admin.from("stores").select("id, name").eq("id", loja).maybeSingle();
    if (!store) throw new Error("Loja inválida.");
    lojaName = store.name;
  }

  const { data: item, error: itemError } = await admin
    .from("service_request_items")
    .select("request_id, product, quantity")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Item não encontrado.");

  const { error: updateError } = await admin
    .from("service_request_items")
    .update({
      destino,
      destino_definido_por: tecnicoName,
      destino_definido_em: new Date().toISOString(),
      destino_loja_id: destino === ITEM_DESTINO_NEEDS_STORE ? destinoLojaId : null,
    })
    .eq("id", itemId);
  if (updateError) throw new Error(updateError.message);

  const label = item.quantity > 1 ? `${item.quantity}x ${item.product}` : item.product;
  const lojaNote = lojaName ? ` (loja: ${lojaName})` : "";
  await admin.from("service_request_events").insert({
    request_id: item.request_id,
    actor_id: null,
    event_type: "note_added",
    note: `${tecnicoName} (equipe técnica) definiu destino de "${label}": ${ITEM_DESTINO_LABELS[destino]}${lojaNote}.`,
  });

  revalidatePath("/assistencia/tecnico");
  revalidatePath(`/assistencia/${item.request_id}`);
}

// Desfaz o destino de um item, a qualquer momento -- pedido do Victor
// 20/08/2026: "após ele dar o destino... ele tenha a opção de retornar o
// status, a qualquer tempo". Sem confirmação (mesmo padrão direto de
// setItemDestino, sem diálogo no meio) -- volta o item pra "pendente" (na
// aba de novo), pra corrigir clique errado ou mudar de ideia depois.
export async function clearItemDestino(itemId: string): Promise<void> {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) throw new Error("Sessão expirada. Faça login de novo.");

  const admin = getSupabaseAdmin();
  const { data: item, error: itemError } = await admin
    .from("service_request_items")
    .select("request_id, product, quantity, destino")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Item não encontrado.");

  const previousLabel = isItemDestino(item.destino) ? ITEM_DESTINO_LABELS[item.destino] : item.destino;

  const { error: updateError } = await admin
    .from("service_request_items")
    .update({ destino: null, destino_definido_por: null, destino_definido_em: null, destino_loja_id: null })
    .eq("id", itemId);
  if (updateError) throw new Error(updateError.message);

  const label = item.quantity > 1 ? `${item.quantity}x ${item.product}` : item.product;
  await admin.from("service_request_events").insert({
    request_id: item.request_id,
    actor_id: null,
    event_type: "note_added",
    note: `${tecnicoName} (equipe técnica) desfez o destino de "${label}" (era: ${previousLabel ?? "—"}) -- volta pra pendente.`,
  });

  revalidatePath("/assistencia/tecnico");
  revalidatePath(`/assistencia/${item.request_id}`);
}
