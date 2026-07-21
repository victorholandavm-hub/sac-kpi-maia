"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { hashPin } from "@/lib/montadorAuth";
import { resetPinAttempts } from "@/lib/pinLockout";
import { setGerenteStores } from "@/lib/gerentes";

export type FormState = { error?: string; success?: boolean } | undefined;

export async function createAssistenciaUser(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "assistencia");

  if (!fullName) return { error: "Informe o nome." };
  if (!email) return { error: "Informe o e-mail." };
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };
  if (role !== "assistencia" && role !== "admin" && role !== "sac") return { error: "Papel inválido." };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { error: `Não foi possível criar o usuário: ${error?.message ?? "erro desconhecido"}` };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    role,
    store_id: null,
  });

  if (profileError) {
    return { error: `Usuário criado, mas não deu pra vincular o perfil: ${profileError.message}` };
  }

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function addAssembler(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("assemblers").upsert({ name }, { onConflict: "name" });
  if (error) return { error: error.message };

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setAssemblerPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("assemblers").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("assemblers", "name", name);

  revalidatePath("/assistencia/admin");
}

export async function addDriver(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("drivers").upsert({ name }, { onConflict: "name" });
  if (error) return { error: error.message };

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setDriverPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("drivers").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("drivers", "name", name);

  revalidatePath("/assistencia/admin");
}

// Cria o gerente (se ainda não existir) e (re)define de quais lojas ele
// cuida — chamar de novo pro mesmo nome com outras lojas marcadas substitui
// a lista inteira, então essa mesma ação serve tanto pra cadastrar quanto
// pra editar as lojas de um gerente já existente (um gerente pode cuidar de
// mais de uma loja).
export async function addGerente(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  const storeIds = formData.getAll("store_ids").map(String).filter(Boolean);
  if (!name) return { error: "Informe o nome." };
  if (storeIds.length === 0) return { error: "Selecione ao menos uma loja." };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("gerentes").upsert({ name }, { onConflict: "name" });
  if (error) return { error: error.message };

  await setGerenteStores(name, storeIds);

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setGerentePin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("gerentes").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("gerentes", "name", name);

  revalidatePath("/assistencia/admin");
}

export async function addSupplier(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("suppliers").upsert({ name }, { onConflict: "name" });
  if (error) return { error: error.message };

  revalidatePath("/assistencia/admin");
  return { success: true };
}
