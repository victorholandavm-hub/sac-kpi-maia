"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { checkIpRateLimit, getClientIp, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { isItemDestino, ITEM_DESTINO_LABELS } from "@/lib/tecnicos";
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

// Grava o destino de um item (fábrica/estoque/conserto/sem condições) --
// registrado por item, não pelo chamado inteiro (uma troca pode voltar com
// mais de um produto, cada um com destino diferente). Evento de auditoria
// vai pro histórico do chamado, igual toda outra mutação relevante do
// projeto.
export async function setItemDestino(itemId: string, destino: string): Promise<void> {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) throw new Error("Sessão expirada. Faça login de novo.");
  if (!isItemDestino(destino)) throw new Error("Destino inválido.");

  const admin = getSupabaseAdmin();
  const { data: item, error: itemError } = await admin
    .from("service_request_items")
    .select("request_id, product, quantity")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Item não encontrado.");

  const { error: updateError } = await admin
    .from("service_request_items")
    .update({ destino, destino_definido_por: tecnicoName, destino_definido_em: new Date().toISOString() })
    .eq("id", itemId);
  if (updateError) throw new Error(updateError.message);

  const label = item.quantity > 1 ? `${item.quantity}x ${item.product}` : item.product;
  await admin.from("service_request_events").insert({
    request_id: item.request_id,
    actor_id: null,
    event_type: "note_added",
    note: `${tecnicoName} (equipe técnica) definiu destino de "${label}": ${ITEM_DESTINO_LABELS[destino]}.`,
  });

  revalidatePath("/assistencia/tecnico");
  revalidatePath(`/assistencia/${item.request_id}`);
}
