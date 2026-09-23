"use server";

import { revalidatePath } from "next/cache";
import { getFinanceiroSession } from "@/app/assistencia/financeiro-actions";
import { getOptionalProfile } from "@/lib/dal";
import { recusarEstornoRequest } from "@/lib/estornoRequests";

// Financeiro (PIN) OU admin (Supabase Auth, via /assistencia/estornos) podem
// recusar -- mesmo fallback de lojaApproveMontagemConclusion (loja-actions.ts).
async function resolveFinanceiroOrAdminName(): Promise<string> {
  const financeiroName = await getFinanceiroSession();
  if (financeiroName) return financeiroName;

  const profile = await getOptionalProfile();
  if (profile && profile.role === "admin") return `${profile.fullName} (admin)`;

  throw new Error("Sessão expirada. Faça login de novo.");
}

export async function recusarEstornoAction(id: string, motivo: string): Promise<void> {
  const actorName = await resolveFinanceiroOrAdminName();
  await recusarEstornoRequest(id, actorName, motivo);

  revalidatePath("/assistencia/financeiro");
  revalidatePath("/assistencia/estornos");
}
