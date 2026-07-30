"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { classifyEntregaRisco } from "@/lib/entregasRisco";

export async function classifyEntregaRiscoAction(
  pedido: string,
  filialVenda: string,
  input: { note: string | null; reavaliarEm: string | null }
): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac", "admin");

  await classifyEntregaRisco(pedido, filialVenda, { name: profile.fullName, role: profile.role }, input);

  revalidatePath("/assistencia/sac/entregas-risco");
  revalidatePath("/assistencia/sac");
}
