"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPin } from "@/lib/pinAuth";
import { resetPinAttempts } from "@/lib/pinLockout";
import { PIN_LENGTH, isValidPinFormat } from "@/lib/pinConfig";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { addCaixa as addCaixaLib, setCaixaAtivo as setCaixaAtivoLib } from "@/lib/caixas";
import { addVendedor as addVendedorLib, setVendedorAtivo as setVendedorAtivoLib } from "@/lib/vendedores";

export type FormState = { error?: string; success?: boolean } | undefined;

// Autorização real (não só esconder botão na UI): resolve o gerente
// autenticado e devolve as lojas dele; toda ação abaixo rejeita se a loja
// alvo não estiver nessa lista, mesmo que alguém monte a chamada na mão.
async function requireGerenteStoreIds(): Promise<string[]> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) redirect("/assistencia/loja/login");
  return getGerenteStoreIds(gerenteName);
}

async function requireOwnStore(storeId: string): Promise<void> {
  const storeIds = await requireGerenteStoreIds();
  if (!storeIds.includes(storeId)) throw new Error("Essa loja não é sua.");
}

// Verifica que o nome já cadastrado (caixa/vendedor) pertence a uma loja do
// gerente antes de deixar ele mexer no PIN/ativo — nunca confia só no nome
// vindo do form.
async function requireOwnEntry(table: "caixas" | "vendedores", name: string): Promise<void> {
  const storeIds = await requireGerenteStoreIds();
  const admin = getSupabaseAdmin();
  const { data } = await admin.from(table).select("store_id").eq("name", name).maybeSingle();
  if (!data || !storeIds.includes(data.store_id as string)) throw new Error("Esse cadastro não é de uma loja sua.");
}

// --- Caixa -----------------------------------------------------------------

export async function addCaixaComoGerente(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!name) return { error: "Informe o nome." };
  if (!storeId) return { error: "Selecione a loja." };

  try {
    await requireOwnStore(storeId);
    await addCaixaLib(name, storeId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar." };
  }

  revalidatePath("/assistencia/loja/equipe");
  return { success: true };
}

export async function setCaixaPinComoGerente(name: string, pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);
  await requireOwnEntry("caixas", name);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("caixas").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("caixas", "name", name);

  revalidatePath("/assistencia/loja/equipe");
}

export async function toggleCaixaAtivoComoGerente(name: string, ativo: boolean): Promise<void> {
  await requireOwnEntry("caixas", name);
  await setCaixaAtivoLib(name, ativo);
  revalidatePath("/assistencia/loja/equipe");
}

// --- Vendedor ----------------------------------------------------------------

export async function addVendedorComoGerente(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!name) return { error: "Informe o nome." };
  if (!storeId) return { error: "Selecione a loja." };

  try {
    await requireOwnStore(storeId);
    await addVendedorLib(name, storeId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar." };
  }

  revalidatePath("/assistencia/loja/equipe");
  return { success: true };
}

export async function toggleVendedorAtivoComoGerente(name: string, ativo: boolean): Promise<void> {
  await requireOwnEntry("vendedores", name);
  await setVendedorAtivoLib(name, ativo);
  revalidatePath("/assistencia/loja/equipe");
}
