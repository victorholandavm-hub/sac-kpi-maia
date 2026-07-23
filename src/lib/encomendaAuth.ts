import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashPin } from "./pinAuth";
import { resetPinAttempts } from "./pinLockout";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";

export type EncomendaActor = { name: string; role: "cd" | "fabrica" | "admin" | "assistencia" };

// Resolve quem está vendo a fila interna de encomendas: sessão PIN de CD, ou
// de fábrica, ou (por último, sem redirecionar pro login de nenhum dos dois)
// um perfil Supabase Auth de admin/assistência. Não usa getProfile() de
// dal.ts direto porque essa função redireciona pro /assistencia/login — aqui
// o destino de quem não tem nenhuma sessão válida é o hub de encomendas.
export async function requireEncomendaActor(): Promise<EncomendaActor> {
  const cdName = await getCdSession();
  if (cdName) return { name: cdName, role: "cd" };

  const fabricaName = await getFabricaSession();
  if (fabricaName) return { name: fabricaName, role: "fabrica" };

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (data && (data.role === "admin" || data.role === "assistencia")) {
      return { name: data.full_name, role: data.role };
    }
  }

  redirect("/assistencia/encomendas");
}

// --- Admin: caixa das lojas (PIN por loja) -------------------------------------

export type CaixaPinStatus = { storeId: string; storeName: string; hasPin: boolean };

export async function listCaixaPinStatus(): Promise<CaixaPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("stores").select("id, name, encomenda_caixa_pins(pin_hash)").order("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { id: string; name: string; encomenda_caixa_pins: { pin_hash: string | null } | null }[]).map(
    (s) => ({ storeId: s.id, storeName: s.name, hasPin: !!s.encomenda_caixa_pins?.pin_hash })
  );
}

export async function setCaixaPin(storeId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("encomenda_caixa_pins")
    .upsert({ store_id: storeId, pin_hash: hashPin(pin) }, { onConflict: "store_id" });
  if (error) throw new Error(error.message);
  await resetPinAttempts("encomenda_caixa_pins", "store_id", storeId);
}

// --- Admin: operadores CD / fábrica ---------------------------------------------

export type OperadorWithPinStatus = { name: string; hasPin: boolean };

export async function listCdOperadoresWithPinStatus(): Promise<OperadorWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("cd_operadores").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => ({ name: o.name, hasPin: !!o.pin_hash }));
}

export async function addCdOperador(name: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("cd_operadores").upsert({ name }, { onConflict: "name" });
  if (error) throw new Error(error.message);
}

export async function setCdOperadorPin(name: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("cd_operadores").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("cd_operadores", "name", name);
}

export async function listFabricaOperadoresWithPinStatus(): Promise<OperadorWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("fabrica_operadores").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => ({ name: o.name, hasPin: !!o.pin_hash }));
}

export async function addFabricaOperador(name: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("fabrica_operadores").upsert({ name }, { onConflict: "name" });
  if (error) throw new Error(error.message);
}

export async function setFabricaOperadorPin(name: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("O PIN precisa ter exatamente 4 números.");
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("fabrica_operadores").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("fabrica_operadores", "name", name);
}
