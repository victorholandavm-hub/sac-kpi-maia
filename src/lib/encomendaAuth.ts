import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashPin } from "./pinAuth";
import { resetPinAttempts } from "./pinLockout";
import { PIN_LENGTH, isValidPinFormat } from "./pinConfig";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";

export type EncomendaActor = { name: string; role: "cd" | "fabrica" | "admin" | "assistencia"; fabricaId?: string | null };

// Resolve quem está vendo a fila interna de encomendas: sessão PIN de CD, ou
// de fábrica, ou (por último, sem redirecionar pro login de nenhum dos dois)
// um perfil Supabase Auth de admin/assistência. Não usa getProfile() de
// dal.ts direto porque essa função redireciona pro /assistencia/login — aqui
// o destino de quem não tem nenhuma sessão válida é o hub de encomendas.
export async function requireEncomendaActor(): Promise<EncomendaActor> {
  const cdName = await getCdSession();
  if (cdName) return { name: cdName, role: "cd" };

  const fabricaName = await getFabricaSession();
  if (fabricaName) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("fabrica_operadores").select("fabrica_id").eq("name", fabricaName).maybeSingle();
    return { name: fabricaName, role: "fabrica", fabricaId: data?.fabrica_id ?? null };
  }

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
  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("cd_operadores").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("cd_operadores", "name", name);
}

export type FabricaOperadorWithPinStatus = OperadorWithPinStatus & { fabricaId: string };

export async function listFabricaOperadoresWithPinStatus(): Promise<FabricaOperadorWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("fabrica_operadores").select("name, pin_hash, fabrica_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => ({ name: o.name, hasPin: !!o.pin_hash, fabricaId: o.fabrica_id }));
}

export async function addFabricaOperador(name: string, fabricaId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("fabrica_operadores").upsert({ name, fabrica_id: fabricaId }, { onConflict: "name" });
  if (error) throw new Error(error.message);
}

export async function setFabricaOperadorPin(name: string, pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) throw new Error(`O PIN precisa ter exatamente ${PIN_LENGTH} números.`);
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("fabrica_operadores").update({ pin_hash: hashPin(pin) }).eq("name", name);
  if (error) throw new Error(error.message);
  await resetPinAttempts("fabrica_operadores", "name", name);
}
