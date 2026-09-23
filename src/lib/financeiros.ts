import { getSupabaseAdmin } from "./supabaseAdmin";

// Contas do financeiro -- mesmo padrão de tecnicos.ts (lista simples,
// gerenciada em /assistencia/admin, sem loja fixa).

export type FinanceiroWithPinStatus = { name: string; hasPin: boolean };

export async function listFinanceirosWithPinStatus(): Promise<FinanceiroWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("financeiros").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({ name: f.name as string, hasPin: !!f.pin_hash }));
}

// "name" é a PK exata da tabela -- mesmo cuidado de resolveTecnicoName: sem
// isso, digitar "joão" quando já existe "João" cria uma linha duplicada.
export async function resolveFinanceiroName(typedName: string): Promise<string> {
  const trimmed = typedName.trim();
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("financeiros").select("name");
  const existing = (data ?? []).find((f) => (f.name as string).toLowerCase() === trimmed.toLowerCase());
  return existing?.name ?? trimmed;
}
