"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { hashPin } from "@/lib/montadorAuth";
import { resetPinAttempts } from "@/lib/pinLockout";
import { PIN_LENGTH, isValidPinFormat } from "@/lib/pinConfig";
import { setGerenteStores } from "@/lib/gerentes";
import { addCaixa as addCaixaLib, setCaixaAtivo as setCaixaAtivoLib } from "@/lib/caixas";
import { resolveDriverName } from "@/lib/payments";
import { upsertProdutoEncomenda, setProdutoEncomendaAtivo } from "@/lib/pedidosEncomenda";
import {
  addCdOperador as addCdOperadorLib,
  setCdOperadorPin as setCdOperadorPinLib,
  addFabricaOperador as addFabricaOperadorLib,
  setFabricaOperadorPin as setFabricaOperadorPinLib,
} from "@/lib/encomendaAuth";
import { setRotaWeekday as setRotaWeekdayLib, isRota, type Rota } from "@/lib/rotas";
import { INTERNAL_FABRICAS } from "@/lib/fabricas";

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

  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("assemblers").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("assemblers", "name", name);

  revalidatePath("/assistencia/admin");
}

export async function addDriver(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const typedName = String(formData.get("name") ?? "").trim();
  if (!typedName) return { error: "Informe o nome." };
  const name = await resolveDriverName(typedName);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("drivers").upsert({ name }, { onConflict: "name" });
  if (error) return { error: error.message };

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setDriverPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);

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

  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("gerentes").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("gerentes", "name", name);

  revalidatePath("/assistencia/admin");
}

// Caixa é presa a UMA loja só (diferente do gerente, que é N:N) — por isso
// não reaproveita setGerenteStores, e cadastrar de novo com outra loja dá
// erro de PK duplicada em vez de silenciosamente trocar a loja (evita mover
// uma caixa de loja sem querer por um typo no nome).
export async function addCaixa(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!name) return { error: "Informe o nome." };
  if (!storeId) return { error: "Selecione a loja." };

  try {
    await addCaixaLib(name, storeId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar." };
  }

  revalidatePath("/assistencia/admin");
  return { success: true };
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

// Cadastra um produto do catálogo de encomendas (colchão, box, baú etc.) —
// não veio migrado da planilha antiga (descrição lá era texto livre demais
// pra deduplicar automaticamente), então o catálogo nasce vazio e é
// preenchido aqui conforme a necessidade real.
export async function addProdutoEncomenda(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!descricao) return { error: "Informe a descrição do produto." };
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  try {
    await upsertProdutoEncomenda(descricao, categoria);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar o produto." };
  }

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function toggleProdutoEncomendaAtivo(id: string, ativo: boolean): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setProdutoEncomendaAtivo(id, ativo);
  revalidatePath("/assistencia/admin");
}

// Caixa virou individual (nome + PIN próprio) — ver 0031_caixa_individual_e_ativo.sql.
export async function setCaixaPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("caixas").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("caixas", "name", name);

  revalidatePath("/assistencia/admin");
}

export async function toggleCaixaAtivo(name: string, ativo: boolean): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setCaixaAtivoLib(name, ativo);
  revalidatePath("/assistencia/admin");
}

export async function addCdOperador(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };

  try {
    await addCdOperadorLib(name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar." };
  }

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setCdOperadorPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setCdOperadorPinLib(name, pin);
  revalidatePath("/assistencia/admin");
}

export async function addFabricaOperador(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome." };

  const fabricaIdRaw = String(formData.get("fabrica_id") ?? "");
  if (fabricaIdRaw !== "__todas__" && !INTERNAL_FABRICAS.some((f) => f.id === fabricaIdRaw)) {
    return { error: "Selecione a fábrica." };
  }
  const fabricaId = fabricaIdRaw === "__todas__" ? null : fabricaIdRaw;

  try {
    await addFabricaOperadorLib(name, fabricaId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar." };
  }

  revalidatePath("/assistencia/admin");
  return { success: true };
}

export async function setFabricaOperadorPin(name: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setFabricaOperadorPinLib(name, pin);
  revalidatePath("/assistencia/admin");
}

// SAC loga por nome+PIN direto contra profiles (ver sacPinSignIn em
// actions.ts) -- sem tabela de operador separada, é a mesma conta que já
// existe (criada via CreateUserForm), só ganha um PIN a mais.
export type SacProfileWithPinStatus = { id: string; fullName: string; hasPin: boolean };

export async function listSacProfilesWithPinStatus(): Promise<SacProfileWithPinStatus[]> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("profiles").select("id, full_name, pin_hash").eq("role", "sac").order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, hasPin: !!p.pin_hash }));
}

export async function setSacProfilePin(id: string, pin: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("profiles").update({ pin_hash: hashPin(pin) }).eq("id", id).eq("role", "sac");
  if (error) throw new Error(error.message);
  await resetPinAttempts("profiles", "id", id);
  revalidatePath("/assistencia/admin");
}

export async function setRotaWeekday(weekday: number, rota: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  const value: Rota | null = rota === "" ? null : isRota(rota) ? rota : null;
  if (rota !== "" && !isRota(rota)) throw new Error("Rota inválida.");
  await setRotaWeekdayLib(weekday, value);
  revalidatePath("/assistencia/admin");
}
